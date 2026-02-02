---
summary: Learn how to use atomic locks in AdonisJS to prevent race conditions and coordinate concurrent operations.
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

The `@adonisjs/lock` package is a wrapper over [Verrou](https://verrou.dev), a framework-agnostic locking library created and maintained by the AdonisJS core team. It supports three storage backends: Redis, database, and memory.

## Installation

Install and configure the package using the following command.

```sh
node ace add @adonisjs/lock
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

4. Defines the `LOCK_STORE` environment variable and its validation inside the `start/env.ts` file.

5. Creates a database migration for the locks table (if using the database store).

:::

## Configuration

The configuration is stored in the `config/lock.ts` file.

```ts title="config/lock.ts"
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/lock'

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

The `connectionName` is a reference to a database connection defined within the `config/database.ts` file. If not defined, the default database connection is used.

```ts title="config/lock.ts"
{
  database: stores.database({
    connectionName: 'postgres',
    tableName: 'my_locks',
  }),
}
```

The data is stored within the `locks` table. A migration for this table is automatically created during installation. However, if needed, you can manually create a migration with the following contents.

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

The TTL accepts either a time expression string (like `'10s'`, `'5m'`, or `'1h'`) or a number in milliseconds. The TTL acts as a safety mechanism. If a process crashes while holding a lock, the lock will automatically expire after the TTL, preventing deadlocks.

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
    
    const [acquired, result] = await lock.run(async () => {
      /**
       * This callback only executes after acquiring the lock.
       * The lock is automatically released when the callback
       * completes or throws an error.
       */
      const charge = await this.chargeCustomer(order)
      await order.merge({ status: 'paid', chargeId: charge.id }).save()
      return charge
    })

    if (!acquired) {
      return { success: false, message: 'Payment already in progress' }
    }

    return { success: true, charge: result }
  }
}
```

By default, `run` waits indefinitely until the lock becomes available. You can configure this behavior using options.

### Running immediately or not at all

The `runImmediately` method attempts to acquire the lock without waiting. If the lock is already held by another process, the callback does not execute.

```ts
const [acquired, result] = await lock.runImmediately(async () => {
  // Only runs if lock was acquired immediately
})

if (!acquired) {
  // Lock was not available
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

The `acquireImmediately` method attempts to acquire the lock without waiting and returns `true` if successful.

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

When acquiring a lock, you can configure retry behavior and timeouts.

::::options

:::option{name="timeout"}
Maximum time to wait before giving up on acquiring the lock. Accepts a time expression string or milliseconds.

```ts
await lock.acquire({ timeout: '5s' })
```
:::

:::option{name="attempts"}
Maximum number of retry attempts before throwing an error.

```ts
await lock.acquire({ attempts: 3 })
```
:::

:::option{name="delay"}
Delay between retry attempts. Accepts a time expression string or milliseconds.

```ts
await lock.acquire({ delay: '100ms' })
```
:::

::::

You can combine these options for fine-grained control.

```ts
const acquired = await lock.acquire({
  timeout: '10s',
  attempts: 5,
  delay: '500ms'
})
```

## Checking lock state

You can inspect the current state of a lock using the following methods.

```ts
const lock = lockManager.createLock('my_resource', '30s')

/**
 * Check if the lock is currently held by any process.
 */
const locked = await lock.isLocked()

/**
 * Check if the lock has expired.
 */
const expired = await lock.isExpired()

/**
 * Get the remaining time in milliseconds before the lock expires.
 * Returns null if the lock is not held.
 */
const remaining = await lock.getRemainingTime()
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

In distributed systems, you might need to acquire a lock in one process and release it in another. The `serialize` method converts a lock into a string that can be stored and restored elsewhere.

```ts title="app/jobs/start_processing.ts"
import lockManager from '@adonisjs/lock/services/main'

const lock = lockManager.createLock('batch_job:123', '5m')
await lock.acquire()

/**
 * Serialize the lock for storage. This string contains
 * all information needed to restore the lock.
 */
const serialized = lock.serialize()

/**
 * Store the serialized lock (e.g., in a database or cache)
 * for retrieval by another process.
 */
await redis.set('batch_job:123:lock', serialized)
```

In another process, restore the lock using `restoreLock`.

```ts title="app/jobs/finish_processing.ts"
import lockManager from '@adonisjs/lock/services/main'

const serialized = await redis.get('batch_job:123:lock')

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
