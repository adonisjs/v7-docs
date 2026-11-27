---
description: Learn how to use atomic locks in AdonisJS to prevent race conditions and coordinate concurrent operations.
---

# Atomic Locks

This guide covers atomic locks in AdonisJS applications. You will learn how to:

- Install and configure the `@adonisjs/lock` package
- Create and release locks to protect critical sections
- Use different acquisition methods for various scenarios
- Extend lock expiry for long-running operations
- Share locks between different processes

## Overview

Atomic locks prevent race conditions when multiple processes or parts of your codebase might perform concurrent actions on the same resource. Consider a payment processing scenario where a queue job could be enqueued twice due to a network retry. Without proper locking, the system might charge the user twice. Atomic locks ensure that only one process can execute the critical section at a time.

The `@adonisjs/lock` package is a wrapper over [Verrou](https://verrou.dev), a framework-agnostic locking library created and maintained by the AdonisJS core team. It supports four storage backends: Redis, database, DynamoDB, and memory.

## Installation

Install and configure the package using the following command.

```sh
node ace add @adonisjs/lock
```

The command prompts you to select a store (`database`, `redis`, or `dynamodb`). You can skip the prompt by passing the `--store` flag.

```sh
node ace add @adonisjs/lock --store=redis
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/lock` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.

    ```ts title="adonisrc.ts"
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/lock/lock_provider')
      ]
    }
    ```

3. Creates the `config/lock.ts` file.

4. Defines the `LOCK_STORE` environment variable and its validation inside the `start/env.ts` file. The validation allows the selected store and the `memory` store.

    ```ts title="start/env.ts"
    {
      LOCK_STORE: Env.schema.enum(['redis', 'memory'] as const)
    }
    ```

5. Creates a database migration for the `locks` table (only when you select the database store).

:::

## Configuration

The configuration is stored in the `config/lock.ts` file.

```ts title="config/lock.ts"
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/lock'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

const lockConfig = defineConfig({
  default: env.get('LOCK_STORE'),
  stores: {
    /**
     * Redis store to manage locks.
     * Requires the @adonisjs/redis package.
     */
    redis: stores.redis({}),

    /**
     * Database store to manage locks.
     * Requires the @adonisjs/lucid package.
     */
    database: stores.database({
      tableName: 'locks'
    }),

    /**
     * DynamoDB store to manage locks.
     * Requires the @aws-sdk/client-dynamodb package.
     */
    dynamodb: stores.dynamodb({
      table: { name: 'locks' },
      connection: new DynamoDBClient({ region: env.get('AWS_REGION') }),
    }),

    /**
     * Memory store could be used during testing.
     */
    memory: stores.memory()
  },
})

export default lockConfig

declare module '@adonisjs/lock/types' {
  export interface LockStoresList extends InferLockStores<typeof lockConfig> {}
}
```

The generated config file only contains the store you selected during installation, along with the `memory` store. The example above lists every store for reference.

### Redis store

The `redis` store has a peer dependency on the `@adonisjs/redis` package. You must [configure the Redis package](../database/redis.md) before using the Redis store.

The `connectionName` is a reference to the connection defined within the `config/redis.ts` file. If not defined, the default Redis connection is used.

```ts title="config/lock.ts"
{
  redis: stores.redis({
    connectionName: 'main',
  }),
}
```

### Database store

The `database` store has a peer dependency on the `@adonisjs/lucid` package. You must [configure Lucid](../database/lucid.md) before using the database store.

The `connectionName` is a reference to a database connection defined within the `config/database.ts` file. If not defined, the default database connection is used. The store supports the PostgreSQL, MySQL, and SQLite (`better-sqlite3` and `sqlite3`) dialects.

```ts title="config/lock.ts"
{
  database: stores.database({
    connectionName: 'postgres',
    tableName: 'my_locks',
  }),
}
```

The data is stored within the table defined by the `tableName` option. Always set it explicitly, since it defaults to `verrou` when omitted. A migration for the `locks` table is automatically created during installation. However, if needed, you can manually create a migration with the following contents.

:::disclosure{title="Migration file contents"}

```ts title="database/migrations/xxxx_create_locks_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'locks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('key', 255).notNullable().primary()
      table.string('owner').notNullable()
      table.bigint('expiration').unsigned().nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

:::

### DynamoDB store

The `dynamodb` store uses the AWS SDK to persist locks in a DynamoDB table. Install the `@aws-sdk/client-dynamodb` package before using it.

```sh
npm i @aws-sdk/client-dynamodb
```

The store accepts the table name and an instance of the `DynamoDBClient`. The table is created automatically (with `key` as the partition key) if it does not exist.

```ts title="config/lock.ts"
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

{
  dynamodb: stores.dynamodb({
    table: { name: 'locks' },
    connection: new DynamoDBClient({
      region: env.get('AWS_REGION'),
    }),
  }),
}
```

### Environment variables

The default store is configured using the `LOCK_STORE` environment variable.

```dotenv title=".env"
LOCK_STORE=redis
```

## Creating locks

Create a lock using the `createLock` method from the lock manager service. The method accepts a unique key that identifies the resource being locked and a TTL (time-to-live) that defines how long the lock remains valid.

```ts
import lockManager from '@adonisjs/lock/services/main'

const lock = lockManager.createLock('processing_payment:order:42', '30s')
```

The lock key should uniquely identify the resource being protected. A common pattern is to use a descriptive prefix followed by an identifier, such as `processing_payment:order:${orderId}` or `sending_email:user:${userId}`.

The TTL accepts either a time expression string (like `'10s'`, `'5m'`, or `'1h'`) or a number in milliseconds, and defaults to `30s` when omitted. The TTL acts as a safety mechanism. If a process crashes while holding a lock, the lock will automatically expire after the TTL, preventing deadlocks. Passing `null` creates a lock that never expires, which you should only do when you are certain the lock will be released.

Locks are created using the default store. Use the `use` method to create a lock with a different store.

```ts
const lock = lockManager.use('redis').createLock('processing_payment:order:42', '30s')
```

## Acquiring locks

The package provides several methods for acquiring locks, each suited to different scenarios.

### Running code within a lock

The `run` method is the recommended way to execute code within a lock. It acquires the lock, executes your callback, and automatically releases the lock when the callback completes (or throws an error).

```ts title="app/services/payment_service.ts"
import lockManager from '@adonisjs/lock/services/main'

export default class PaymentService {
  async processPayment(order: Order) {
    const lock = lockManager.createLock(
      `processing_payment:order:${order.id}`,
      '30s'
    )
    
    const [, charge] = await lock.run(async () => {
      /**
       * This callback only executes after acquiring the lock.
       * The lock is automatically released when the callback
       * completes or throws an error.
       */
      const charge = await this.chargeCustomer(order)
      await order.merge({ status: 'paid', chargeId: charge.id }).save()
      return charge
    })

    return charge
  }
}
```

The `run` method returns a tuple containing a boolean (whether the lock was acquired) and the callback's return value. It retries every 250ms, indefinitely, until the lock becomes available, and it does not accept retry options. Use `runImmediately` when the callback should be skipped if the lock is already held, or acquire the lock manually with [retry options](#lock-options) when you need a timeout.

### Running immediately or not at all

The `runImmediately` method attempts to acquire the lock without waiting. If the lock is already held by another process, the callback does not execute.

```ts
const [acquired, result] = await lock.runImmediately(async () => {
  // Only runs if lock was acquired immediately
})

if (!acquired) {
  // Lock was held by another process. Skip the work.
}
```

### Manual lock management

For more control over the lock lifecycle, use the `acquire` and `release` methods directly. When using manual acquisition, you must ensure the lock is released, even if an error occurs.

```ts
const acquired = await lock.acquire()

if (acquired) {
  try {
    // Perform protected operations
  } finally {
    await lock.release()
  }
}
```

The `acquire` method returns `false` when the lock could not be acquired within the configured retry limits. The `acquireImmediately` method attempts to acquire the lock without waiting and returns `true` if successful.

```ts
const acquired = await lock.acquireImmediately()

if (!acquired) {
  // Lock was not available, handle accordingly
}
```

:::tip
Prefer the `run` method over manual acquisition when possible. It handles lock release automatically, including when exceptions occur, which prevents accidental lock leaks.
:::

## Lock options

When acquiring a lock with the `acquire` method, you can configure the retry behavior using the `retry` option. If the lock cannot be acquired within these limits, `acquire` returns `false`.

::::options

:::option{name="retry.timeout"}
Maximum time to wait before giving up on acquiring the lock. Accepts a time expression string or milliseconds. Defaults to no timeout.

```ts
await lock.acquire({ retry: { timeout: '5s' } })
```
:::

:::option{name="retry.attempts"}
Maximum number of attempts before giving up. Defaults to `Infinity`.

```ts
await lock.acquire({ retry: { attempts: 3 } })
```
:::

:::option{name="retry.delay"}
Delay between retry attempts. Accepts a time expression string or milliseconds. Defaults to `250ms`.

```ts
await lock.acquire({ retry: { delay: '100ms' } })
```
:::

::::

You can combine these options for fine-grained control.

```ts
const acquired = await lock.acquire({
  retry: {
    timeout: '10s',
    attempts: 5,
    delay: '500ms',
  },
})

if (!acquired) {
  // Could not acquire the lock within the retry limits
}
```

## Checking lock state

You can inspect the current state of a lock using the following methods.

```ts
const lock = lockManager.createLock('my_resource', '30s')

/**
 * Check if the lock is currently held by any process.
 * This method queries the store.
 */
const locked = await lock.isLocked()

/**
 * Check if the lock acquired by this instance has expired.
 * This method is synchronous and does not query the store.
 */
const expired = lock.isExpired()

/**
 * Get the remaining time in milliseconds before the lock
 * acquired by this instance expires. Returns null if the
 * lock has not been acquired or has no TTL.
 */
const remaining = lock.getRemainingTime()
```

## Releasing locks owned by others

The `release` method only releases a lock owned by the current instance. Releasing a lock held by another owner throws the `E_LOCK_NOT_OWNED` exception. If you must release a lock regardless of its owner (for example, from an admin command that clears stuck locks), use the `forceRelease` method.

```ts
import lockManager from '@adonisjs/lock/services/main'

await lockManager.createLock('batch_job:123').forceRelease()
```

## Extending locks

For long-running operations that might exceed the initial TTL, you can extend the lock duration. This is useful when you cannot predict exactly how long an operation will take.

```ts
const lock = lockManager.createLock('long_running_task', '10s')

await lock.acquire()

try {
  for (const item of largeDataset) {
    await processItem(item)
    
    /**
     * Extend the lock by another 10 seconds to prevent
     * expiration during processing.
     */
    await lock.extend('10s')
  }
} finally {
  await lock.release()
}
```

## Sharing locks between processes

In distributed systems, you might need to acquire a lock in one process and release it in another. The `serialize` method converts a lock into a plain object that can be stored and restored elsewhere.

```ts title="app/jobs/start_processing.ts"
import redis from '@adonisjs/redis/services/main'
import lockManager from '@adonisjs/lock/services/main'

const lock = lockManager.createLock('batch_job:123', '5m')
await lock.acquire()

/**
 * Serialize the lock for storage. This object contains
 * all information needed to restore the lock.
 */
const serialized = lock.serialize()

/**
 * Store the serialized lock (e.g., in a database or cache)
 * for retrieval by another process.
 */
await redis.set('batch_job:123:lock', JSON.stringify(serialized))
```

In another process, restore the lock using `restoreLock`.

```ts title="app/jobs/finish_processing.ts"
import redis from '@adonisjs/redis/services/main'
import lockManager from '@adonisjs/lock/services/main'

const serialized = JSON.parse((await redis.get('batch_job:123:lock'))!)

/**
 * Restore the lock from its serialized form.
 * This creates a lock instance with the same owner,
 * allowing this process to release it.
 */
const lock = lockManager.restoreLock(serialized)

try {
  // Complete the processing
} finally {
  await lock.release()
}
```

## See also

- [Verrou documentation](https://verrou.dev) for advanced features and detailed API reference
- [Redis](../database/redis.md) for setting up the Redis store
- [Lucid ORM](../database/lucid.md) for setting up the database store
