---
description: Protect your web application or API server from abuse by implementing rate limits using the @adonisjs/limiter package.
---

# Rate limiting

This guide covers rate limiting in AdonisJS applications. You will learn how to:

- Install and configure the limiter package with Redis, database, or memory stores
- Create throttle middleware for HTTP requests
- Apply dynamic rate limits based on user authentication
- Use rate limiting directly for login protection and job queues
- Handle rate limit exceptions and customize error messages
- Create custom storage providers

## Overview

Rate limiting controls how many requests a user can make to your application within a given time period. When a user exceeds their limit, subsequent requests are rejected until the time window resets.

You need rate limiting to protect your application from abuse. Without it, a single user (or bot) can overwhelm your server with requests, consuming resources meant for legitimate users. Rate limiting also helps prevent brute-force attacks on login forms, protects expensive API endpoints from overuse, and ensures fair access to shared resources.

The `@adonisjs/limiter` package is built on top of [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible), which provides one of the fastest rate-limiting APIs and uses atomic increments to avoid race conditions.

## Installation

Install and configure the package using the following command:

```sh
node ace add @adonisjs/limiter
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/limiter` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.
    ```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/limiter/limiter_provider')
      ]
    }
    ```

3. Creates the `config/limiter.ts` file.

4. Creates the `start/limiter.ts` file for defining HTTP throttle middleware.

5. Defines the following environment variable and its validation inside the `start/env.ts` file.
   ```ts
   LIMITER_STORE=redis
   ```

6. Optionally creates the database migration for the `rate_limits` table if using the `database` store.

:::

## Configuration

The rate limiter configuration is stored in the `config/limiter.ts` file. You define which storage backends are available and which one to use by default.

```ts title="config/limiter.ts"
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  /**
   * The default store is selected via environment variable,
   * allowing different stores in different environments.
   */
  default: env.get('LIMITER_STORE'),

  stores: {
    redis: stores.redis({}),

    database: stores.database({
      tableName: 'rate_limits'
    }),

    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
```

The `default` property specifies which store to use for rate limiting. The `stores` object defines all available storage backends. We recommend always configuring the `memory` store so you can use it during testing.

See also: [Rate limiter config stub](https://github.com/adonisjs/limiter/blob/2.x/stubs/config/limiter.stub)

### Environment variables

The default store is controlled by the `LIMITER_STORE` environment variable, allowing you to switch stores between environments. For example, you might use `memory` during testing and `redis` in production.

The environment variable must be validated in `start/env.ts` to ensure only configured stores are allowed:

```ts title="start/env.ts"
{
  LIMITER_STORE: Env.schema.enum(['redis', 'database', 'memory'] as const),
}
```

### Shared options

All storage backends accept the following options:


```ts title="config/limiter.ts"
{
  duration: '1 minute',
  requests: 10,

  /**
   * After 12 requests, block the key in memory
   * and stop querying the database.
   */
  inMemoryBlockOnConsumed: 12,
  inMemoryBlockDuration: '1 min'
}
```

::::options

:::option{name="keyPrefix"}

Prefix for keys in storage. The database store ignores this since separate tables provide isolation.

:::

:::option{name="execEvenly"}

Adds artificial delay to spread requests evenly across the time window. See [smooth out traffic peaks](https://github.com/animir/node-rate-limiter-flexible/wiki/Smooth-out-traffic-peaks) for details.

:::

:::option{name="inMemoryBlockOnConsumed"}

Number of requests after which to block the key in memory, reducing database queries from abusive users.

:::

:::option{name="inMemoryBlockDuration"}

How long to block keys in memory. Reduces database load by checking memory first. The `inMemoryBlockOnConsumed` option is useful when users continue making requests after exhausting their quota. Instead of querying the database for every rejected request, you can block them in memory:

:::

::::

### Redis store

The Redis store requires the `@adonisjs/redis` package to be configured first.

```ts title="config/limiter.ts"
{
  redis: stores.redis({
    connectionName: 'main',
    rejectIfRedisNotReady: false,
  }),
}
```

::::options

:::option{name="connectionName"}

The Redis connection from `config/redis.ts`. We recommend using a separate database for the limiter.

:::

:::option{name="rejectIfRedisNotReady"}

When `true`, rejects rate-limiting requests if Redis connection status is not `ready`.

:::

::::


### Database store

The database store requires the `@adonisjs/lucid` package to be configured first.

:::warning
The database store only supports MySQL, PostgreSQL, and SQLite. Other databases like MongoDB are not compatible and will throw an error at runtime.
:::

```ts title="config/limiter.ts"
{
  database: stores.database({
    connectionName: 'mysql',
    dbName: 'my_app',
    tableName: 'rate_limits',
    schemaName: 'public',
    clearExpiredByTimeout: false,
  }),
}
```

:::options

:::option{name="connectionName"}

The database connection from `config/database.ts`. Uses the default connection if not specified.

:::

:::option{name="dbName"}

The database name for SQL queries. Inferred from connection config, but required when using a connection string.

:::

:::option{name="tableName"}

The table for storing rate limit data.

:::

:::option{name="schemaName"}

The schema for SQL queries (PostgreSQL only).

:::

:::option{name="clearExpiredByTimeout"}

When `true`, clears expired keys every 5 minutes. Only keys expired for more than 1 hour are removed.

:::

:::


## Throttling HTTP requests

The most common use case is throttling HTTP requests with middleware. The `limiter.define` method creates reusable throttle middleware that you can apply to routes.

Open the `start/limiter.ts` file to see the pre-defined global throttle middleware. This middleware allows users to make 10 requests per minute based on their IP address:

```ts title="start/limiter.ts"
import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(10).every('1 minute')
})
```

Apply the middleware to any route:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { throttle } from '#start/limiter'

router
  .get('/', () => {})
  .use(throttle)
```

When a user exceeds 10 requests within a minute, they receive a `429 Too Many Requests` response until the time window resets.

### Using a custom key

By default, requests are rate-limited by the user's IP address. You can specify a different key using the `usingKey` method. This is useful when you want to limit by user ID, API key, or any other identifier:

```ts title="start/limiter.ts"
export const throttle = limiter.define('global', (ctx) => {
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .usingKey(`user_${ctx.auth.user.id}`)
})
```

### Switching the backend store

You can override the default store for specific middleware using the `store` method:

```ts title="start/limiter.ts"
limiter
  .allowRequests(10)
  .every('1 minute')
  .store('redis')
```

### Blocking abusive users

The `blockFor` method extends the lockout period when users continue making requests after exhausting their quota. This discourages abuse more effectively than simply resetting the counter:

```ts title="start/limiter.ts"
limiter
  .allowRequests(10)
  .every('1 minute')
  /**
   * If a user sends an 11th request within one minute,
   * block them for 30 minutes instead of just waiting
   * for the 1-minute window to reset.
   */
  .blockFor('30 mins')
```

## Dynamic rate limiting

Different users often need different rate limits. Authenticated users might get higher limits than guests, or premium subscribers might get unlimited access while free users are restricted.

The callback passed to `limiter.define` receives the HTTP context, allowing you to apply different limits based on request properties:

```ts title="start/limiter.ts"
export const apiThrottle = limiter.define('api', (ctx) => {
  /**
   * Authenticated users get 100 requests per minute,
   * tracked by their user ID.
   */
  if (ctx.auth.user) {
    return limiter
      .allowRequests(100)
      .every('1 minute')
      .usingKey(`user_${ctx.auth.user.id}`)
  }

  /**
   * Guest users get 10 requests per minute,
   * tracked by their IP address.
   */
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .usingKey(`ip_${ctx.request.ip()}`)
})
```

```ts title="start/routes.ts"
import { apiThrottle } from '#start/limiter'

router
  .get('/api/repos/:id/stats', [RepoStatusController])
  .use(apiThrottle)
```

## Handling ThrottleException

When a user exhausts their rate limit, the middleware throws the `E_TOO_MANY_REQUESTS` exception. The exception is automatically converted to an HTTP response using content negotiation:

- Requests with `Accept: application/json` receive a JSON error object.
- Requests with `Accept: application/vnd.api+json` receive a JSON API formatted error.
- All other requests receive a plain text message. You can use [status pages](../basics/exception_handling.md#status-pages) to show a custom error page.

See also: [E_TOO_MANY_REQUESTS exception reference](../../reference/exceptions.md#e_too_many_requests)

### Customizing the error response

You can customize the error message without handling the exception globally using the `limitExceeded` hook:

```ts title="start/limiter.ts"
export const throttle = limiter.define('global', () => {
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .limitExceeded((error) => {
      error
        .setStatus(400)
        .setMessage('Cannot process request. Try again later')
    })
})
```

### Using translations

If you have configured the [@adonisjs/i18n](../digging_deeper/i18n.md) package, define a translation using the `errors.E_TOO_MANY_REQUESTS` key:

```json title="resources/lang/fr/errors.json"
{
  "E_TOO_MANY_REQUESTS": "Trop de demandes"
}
```

You can also use a custom translation key with interpolated values:

```ts title="start/limiter.ts"
limitExceeded((error) => {
  error.t('errors.rate_limited', {
    limit: error.response.limit,
    remaining: error.response.remaining,
  })
})
```

### Handling the exception globally

For more control, handle the exception in your [global exception handler](../basics/exception_handling.md#handling-exceptions):

```ts title="app/exceptions/handler.ts"
import { errors } from '@adonisjs/limiter'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof errors.E_TOO_MANY_REQUESTS) {
      const message = error.getResponseMessage(ctx)
      const headers = error.getDefaultHeaders()

      Object.keys(headers).forEach((header) => {
        ctx.response.header(header, headers[header])
      })

      return ctx.response.status(error.status).send(message)
    }

    return super.handle(error, ctx)
  }
}
```

## Direct usage

Beyond HTTP middleware, you can use the limiter directly in any part of your application. This is useful for protecting login forms from brute-force attacks, limiting background job execution, or controlling access to expensive operations.

### Creating a limiter instance

Use the `limiter.use` method to create a limiter instance with specific settings:

```ts title="app/services/reports_service.ts"
import limiter from '@adonisjs/limiter/services/main'

const reportsLimiter = limiter.use('redis', {
  requests: 1,
  duration: '1 hour'
})
```

| Option | Description |
|--------|-------------|
| `requests` | Number of requests allowed within the duration. |
| `duration` | Time window in seconds or as a [time expression](../../reference/helpers.md#seconds) string. |
| `blockDuration` | Optional. Duration to block the key after all requests are exhausted. |
| `inMemoryBlockOnConsumed` | Optional. See [shared options](#shared-options). |
| `inMemoryBlockDuration` | Optional. See [shared options](#shared-options). |

To use the default store, omit the first parameter:

```ts
const reportsLimiter = limiter.use({
  requests: 1,
  duration: '1 hour'
})
```

### Limiting expensive operations

The `attempt` method executes a callback only if the rate limit hasn't been exceeded. It returns the callback's result, or `undefined` if the limit was reached:

```ts title="app/services/reports_service.ts"
import limiter from '@adonisjs/limiter/services/main'

const reportsLimiter = limiter.use({
  requests: 1,
  duration: '1 hour'
})

export async function generateUserReport(userId: number) {
  const key = `reports_user_${userId}`

  const executed = await reportsLimiter.attempt(key, async () => {
    await generateReport(userId)
    return true
  })

  if (!executed) {
    const availableIn = await reportsLimiter.availableIn(key)
    throw new Error(`Too many requests. Try after ${availableIn} seconds`)
  }

  return 'Report generated'
}
```

### Preventing brute-force login attacks

The `penalize` method is designed for scenarios where you want to consume a request only when an operation fails. This is perfect for login protection where you want to track failed attempts, not successful ones.

```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import limiter from '@adonisjs/limiter/services/main'

export default class SessionController {
  async store({ request, response, session }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    /**
     * Create a limiter that allows 5 failed attempts per minute,
     * then blocks for 20 minutes.
     */
    const loginLimiter = limiter.use({
      requests: 5,
      duration: '1 min',
      blockDuration: '20 mins'
    })

    /**
     * Use IP + email combination as the key. This ensures that if
     * an attacker is trying multiple emails, we block the attacker's
     * IP without affecting legitimate users trying to log in with
     * their own email from different IPs.
     */
    const key = `login_${request.ip()}_${email}`

    /**
     * The penalize method consumes one request only if
     * the callback throws an error.
     */
    const [error, user] = await loginLimiter.penalize(key, () => {
      return User.verifyCredentials(email, password)
    })

    if (error) {
      session.flashAll()
      session.flashErrors({
        E_TOO_MANY_REQUESTS: `Too many login attempts. Try again after ${error.response.availableIn} seconds`
      })
      return response.redirect().back()
    }

    /**
     * Login successful - proceed with creating the session
     */
  }
}
```

## Manual request consumption

For fine-grained control, you can manually check and consume requests instead of using `attempt` or `penalize`.

:::warning
Calling `remaining` and `increment` separately creates a race condition where multiple concurrent requests might both pass the check before either increments the counter. Use the `consume` method instead, which performs an atomic check-and-increment.
:::

The `consume` method increments the counter and throws an exception if the limit has been reached. You can optionally pass an **amount** as the second argument to consume multiple slots at once (useful for "weighted" rate limiting).

```ts title="app/services/api_service.ts"
import { errors } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'

const requestsLimiter = limiter.use({
  requests: 10,
  duration: '1 minute'
})

export async function handleApiRequest(userId: number) {
  const key = `api_user_${userId}`

  try {
    /**
     * Consume 5 slots at once for a heavy operation
     */
    await requestsLimiter.consume(key, 5)
    return await performAction()
  } catch (error) {
    if (error instanceof errors.E_TOO_MANY_REQUESTS) {
      throw new Error('Rate limit exceeded')
    }
    throw error
  }
}
```

## Incrementing without throwing

The `increment` method works like `consume` but does not throw an exception when the limit is exceeded, it also accepts an optional amount. Instead of throwing an exception, it returns the limiter response object, allowing you to check the remaining requests and decide how to handle the situation:

```ts title="app/services/api_service.ts"
import limiter from '@adonisjs/limiter/services/main'

const requestsLimiter = limiter.use({
  requests: 10,
  duration: '1 minute'
})

export async function handleApiRequest(userId: number) {
  const key = `api_user_${userId}`
  const response = await requestsLimiter.increment(key, 5)

  if (response.remainingPoints < 0) {
    throw new Error('Rate limit exceeded')
  }

  return await performAction()
}
```

:::info
Validation of the amount parameter
The amount parameter must be a positive integer. To prevent logic errors or security bypasses, if you provide a value less than or equal to `0`, the limiter will automatically fallback to `1`.
:::

## Blocking keys

You can extend the lockout period for users who continue making requests after exhausting their quota. This is more punitive than standard rate limiting and discourages abuse.

Automatic blocking occurs when you create a limiter with the `blockDuration` option:

```ts title="app/services/api_service.ts"
import limiter from '@adonisjs/limiter/services/main'

const requestsLimiter = limiter.use({
  requests: 10,
  duration: '1 minute',
  blockDuration: '30 mins'
})

/**
 * A user can make 10 requests per minute. If they send
 * an 11th request, they're blocked for 30 minutes.
 * The consume, attempt, and penalize methods all
 * enforce this behavior automatically.
 */
await requestsLimiter.consume('a_unique_key')
```

You can also block a key manually:

```ts
await requestsLimiter.block('a_unique_key', '30 mins')
```

## Resetting attempts

Sometimes you need to restore requests to a user. For example, if a background job completes, you might want to let the user queue another one.

The decrement method reduces the request count. By default, it decrements by 1, but you can specify a custom amount as the second argument.

```ts title="app/jobs/process_report.ts"
import limiter from '@adonisjs/limiter/services/main'

const jobsLimiter = limiter.use({
  requests: 10,
  duration: '5 mins',
})

export async function processReportJob(userId: number) {
  const key = `jobs_user_${userId}`

  await jobsLimiter.attempt(key, async () => {
    await processJob()

    /**
     * Job completed - give the slot back so
     * another job can be queued.
     */
    await jobsLimiter.decrement(key, 5)
  })
}
```

:::info
Just like increment and consume, providing an amount `<= 0` will cause the method to fallback to `1`.
:::

:::tip
The `decrement` method is not atomic. Under high concurrency, the request count might briefly go to `-1`. Use the `delete` method if you need to completely reset a key.
:::

The `delete` method removes a key entirely:

```ts
await requestsLimiter.delete('unique_key')
```

## Testing

During testing, you typically want to use the `memory` store instead of Redis or a database. Set the environment variable in your `.env.test` file:

```dotenv title=".env.test"
LIMITER_STORE=memory
```

Clear the rate-limiting storage between tests using the `limiter.clear` method:

```ts title="tests/functional/reports.spec.ts"
import limiter from '@adonisjs/limiter/services/main'

test.group('Reports', (group) => {
  group.each.setup(() => {
    return () => limiter.clear(['memory'])
  })
})
```

You can also call `clear` without arguments to flush all configured stores:

```ts
return () => limiter.clear()
```

:::warning
When using Redis, the `clear` method flushes the entire database. Use a separate Redis database for the rate limiter to avoid clearing application data. Configure this in `config/redis.ts` by creating a dedicated connection.
:::

## Creating a custom storage provider

You can create custom storage providers by implementing the `LimiterStoreContract` interface. This is useful when you need to use a database not supported by the built-in stores.

```ts title="app/limiter/mongodb_store.ts"
import string from '@adonisjs/core/helpers/string'
import { LimiterResponse } from '@adonisjs/limiter'
import {
  LimiterStoreContract,
  LimiterConsumptionOptions
} from '@adonisjs/limiter/types'

export type MongoDbLimiterConfig = {
  client: MongoDBConnection
}

export class MongoDbLimiterStore implements LimiterStoreContract {
  readonly name = 'mongodb'
  declare readonly requests: number
  declare readonly duration: number
  declare readonly blockDuration: number

  constructor(config: MongoDbLimiterConfig & LimiterConsumptionOptions) {
    this.requests = config.requests
    this.duration = string.seconds.parse(config.duration)
    this.blockDuration = string.seconds.parse(config.blockDuration)
  }

  /**
   * Consume one request for the key. Throws an error
   * when all requests have been consumed.
   */
  async consume(key: string | number, amount?: number): Promise<LimiterResponse> {}

  /**
   * Consume one request without throwing when exhausted.
   */
  async increment(key: string | number, amount?: number): Promise<LimiterResponse> {}

  /**
   * Restore one request to the key.
   */
  async decrement(key: string | number, amount?: number): Promise<LimiterResponse> {}

  /**
   * Block a key for the specified duration.
   */
  async block(
    key: string | number,
    duration: string | number
  ): Promise<LimiterResponse> {}

  /**
   * Set the consumed request count for a key.
   */
  async set(
    key: string | number,
    requests: number,
    duration?: string | number
  ): Promise<LimiterResponse> {}

  /**
   * Delete a key from storage.
   */
  async delete(key: string | number): Promise<boolean> {}

  /**
   * Flush all keys from storage.
   */
  async clear(): Promise<void> {}

  /**
   * Get the limiter response for a key, or null if
   * the key doesn't exist.
   */
  async get(key: string | number): Promise<LimiterResponse | null> {}
}
```

### Creating the config helper

Create a helper function to use your store in the config file. The helper should return a `LimiterManagerStoreFactory` function:

```ts title="app/limiter/mongodb_store.ts"
import { LimiterManagerStoreFactory } from '@adonisjs/limiter/types'

export function mongoDbStore(config: MongoDbLimiterConfig) {
  const storeFactory: LimiterManagerStoreFactory = (runtimeOptions) => {
    return new MongoDbLimiterStore({
      ...config,
      ...runtimeOptions
    })
  }

  return storeFactory
}
```

### Using your custom store

```ts title="config/limiter.ts"
import env from '#start/env'
import { mongoDbStore } from '#app/limiter/mongodb_store'
import { defineConfig } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),

  stores: {
    mongodb: mongoDbStore({
      client: mongoDb
    })
  },
})
```

### Wrapping rate-limiter-flexible drivers

If you're wrapping an existing driver from [node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible), use the `RateLimiterBridge` class for simpler implementation:

```ts title="app/limiter/mongodb_store.ts"
import { RateLimiterBridge } from '@adonisjs/limiter'
import { RateLimiterMongo } from 'rate-limiter-flexible'

export class MongoDbLimiterStore extends RateLimiterBridge {
  readonly name = 'mongodb'

  constructor(config: MongoDbLimiterConfig & LimiterConsumptionOptions) {
    super(
      new RateLimiterMongo({
        storeClient: config.client,
        points: config.requests,
        duration: string.seconds.parse(config.duration),
        blockDuration: string.seconds.parse(config.blockDuration)
      })
    )
  }

  /**
   * The bridge handles most methods, but you must
   * implement clear() yourself.
   */
  async clear() {
    await this.config.client.collection('rate_limits').deleteMany({})
  }
}
```
