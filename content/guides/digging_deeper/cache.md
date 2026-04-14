---
description: Learn how to use caching in AdonisJS applications to improve performance with multiple cache stores, multi-tier caching, and resiliency features.
---

# Cache

This guide covers caching in AdonisJS applications. You will learn how to:

- Configure cache stores with different drivers (Redis, Memory, Database, DynamoDB)
- Store, retrieve, and invalidate cached data
- Use multi-tier caching with L1 (memory) and L2 (distributed) layers
- Organize cache entries with namespaces and tags
- Improve resilience with grace periods, stampede protection, and timeouts
- Use Ace commands to manage your cache

## Overview

The `@adonisjs/cache` package provides a unified caching API for your AdonisJS application. Built on top of [Bentocache](https://bentocache.dev), it goes beyond simple key-value storage by offering multi-tier caching, cache stampede protection, grace periods, and more.

The package introduces two key concepts. A **driver** is the underlying storage mechanism (Redis, in-memory, database). A **store** is a configured caching layer that combines one or more drivers. You can configure multiple stores in your application, each with different drivers and settings, and switch between them at runtime.

Multi-tier caching is the standout feature. By combining an in-memory L1 cache with a distributed L2 cache (like Redis), you get the speed of local memory with the persistence and scalability of a shared cache. This setup can deliver responses between 2,000x and 5,000x faster compared to single-tier approaches.

## Installation

Install and configure the package using the following command:

```sh
node ace add @adonisjs/cache
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/cache` package using the detected package manager.
2. Registers the following service provider and command inside the `adonisrc.ts` file.

    ```ts title="adonisrc.ts"
    {
      commands: [
        // ...other commands
        () => import('@adonisjs/cache/commands')
      ],
      providers: [
        // ...other providers
        () => import('@adonisjs/cache/cache_provider')
      ]
    }
    ```

3. Creates the `config/cache.ts` file.
4. Defines the environment variables and their validations for the selected drivers.

:::

## Configuration

The cache configuration lives in `config/cache.ts`. This file defines your stores, the default store, and driver-specific settings.

See also: [Config stub](https://github.com/adonisjs/cache/blob/2.x/stubs/config.stub)

```ts title="config/cache.ts"
import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  /**
   * The store to use when none is specified
   */
  default: 'redis',

  /**
   * Default TTL for all cached entries.
   * Can be overridden per-store or per-operation.
   */
  ttl: '30s',

  /**
   * Configure one or more stores. Each store defines
   * its caching layers and driver settings.
   */
  stores: {
    /**
     * A multi-tier store combining in-memory speed
     * with Redis persistence and cross-instance sync.
     */
    redis: store()
      .useL1Layer(drivers.memory({ maxSize: '100mb' }))
      .useL2Layer(drivers.redis({ connectionName: 'main' }))
      .useBus(drivers.redisBus({ connectionName: 'main' })),

    /**
     * A simple in-memory store for single-instance apps
     */
    memory: store()
      .useL1Layer(drivers.memory({ maxSize: '100mb' })),

    /**
     * A database-backed store using your Lucid connection
     */
    database: store()
      .useL2Layer(drivers.database({ connectionName: 'default' })),
  },
})

export default cacheConfig
```

### Available drivers

:::disclosure{title="Redis"}

Uses Redis as a distributed cache. Requires the `@adonisjs/redis` package to be installed and configured. Compatible with Redis, Upstash, Vercel KV, Valkey, KeyDB, and DragonFly.

```ts title="config/cache.ts"
{
  stores: {
    redis: store()
      .useL2Layer(drivers.redis({
        connectionName: 'main',
      }))
  }
}
```

See also: [Redis setup guide](../database/redis.md)

:::

:::disclosure{title="Memory"}

Uses an in-memory LRU (Least Recently Used) cache. Best suited as an L1 layer in a multi-tier setup or for single-instance applications.

```ts title="config/cache.ts"
{
  stores: {
    memory: store()
      .useL1Layer(drivers.memory({
        maxSize: '100mb',
        maxItems: 1000,
      }))
  }
}
```

:::

:::disclosure{title="Database"}

Uses your database as a cache store. Requires `@adonisjs/lucid`. The cache table is created automatically by default.

```ts title="config/cache.ts"
{
  stores: {
    database: store()
      .useL2Layer(drivers.database({
        connectionName: 'default',
        tableName: 'cache',
        autoCreateTable: true,
      }))
  }
}
```

:::

:::disclosure{title="DynamoDB"}

Uses AWS DynamoDB as a cache store. Requires `@aws-sdk/client-dynamodb`. You must create the table beforehand with a string partition key named `key` and TTL enabled on the `ttl` attribute.

```sh
npm i @aws-sdk/client-dynamodb
```

```ts title="config/cache.ts"
{
  stores: {
    dynamo: store()
      .useL2Layer(drivers.dynamodb({
        table: { name: 'cache' },
        region: 'us-east-1',
        credentials: {
          accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
        },
      }))
  }
}
```

:::

## Storing and retrieving data

Import the cache service to interact with your cache. All cache operations are available through the `cache` object.

```ts title="app/controllers/posts_controller.ts"
import cache from '@adonisjs/cache/services/main'
```

### Getting and setting values

The most common pattern is `getOrSet`. It tries to find a value in the cache and, if missing, executes the factory function to compute the value, stores it, and returns it.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import cache from '@adonisjs/cache/services/main'
import Post from '#models/post'

export default class PostsController {
  async index({ request }: HttpContext) {
    const page = request.input('page', 1)

    const posts = await cache.getOrSet({
      key: `posts:page:${page}`,
      ttl: '10m',
      factory: () => Post.query().paginate(page, 20),
    })

    return posts
  }
}
```

You can also use `get` and `set` independently when you need more control over the flow.

```ts title="app/services/settings_service.ts"
import cache from '@adonisjs/cache/services/main'

/**
 * Store a value with a 5-minute TTL
 */
await cache.set({
  key: 'app:settings',
  value: { maintenance: false, theme: 'dark' },
  ttl: '5m',
})

/**
 * Retrieve a value. Returns undefined if the key
 * does not exist.
 */
const settings = await cache.get({ key: 'app:settings' })

/**
 * Store a value that never expires
 */
await cache.setForever({
  key: 'app:version',
  value: '2.0.0',
})
```

:::warning
Cached data must be serializable to JSON. If you are caching Lucid models, call `.toJSON()` or `.serialize()` before storing them, or use `getOrSet` which handles serialization automatically.
:::

### Checking for existence

Use `has` and `missing` to check whether a key exists in the cache without retrieving its value.

```ts title="app/controllers/products_controller.ts"
import cache from '@adonisjs/cache/services/main'

if (await cache.has({ key: 'products:featured' })) {
  // Key exists in cache
}

if (await cache.missing({ key: 'products:featured' })) {
  // Key does not exist
}
```

### Pulling values

The `pull` method retrieves a value and immediately deletes it from the cache. This is useful for one-time-use data like flash messages or temporary tokens.

```ts title="app/controllers/auth_controller.ts"
import cache from '@adonisjs/cache/services/main'

/**
 * Get the token and remove it from cache in one operation
 */
const token = await cache.pull({ key: `email-verify:${userId}` })
```

## Deleting data

Remove individual entries with `delete`, multiple entries with `deleteMany`, or all entries with `clear`.

```ts title="app/controllers/posts_controller.ts"
import cache from '@adonisjs/cache/services/main'

/**
 * Delete a single key
 */
await cache.delete({ key: 'posts:page:1' })

/**
 * Delete multiple keys at once
 */
await cache.deleteMany({
  keys: ['posts:page:1', 'posts:page:2', 'posts:page:3'],
})

/**
 * Delete all entries in the cache
 */
await cache.clear()
```

## Tagging

Tags let you group related cache entries so you can invalidate them together. This is especially useful when a change affects multiple cached values. For example, when a post is updated, you can invalidate all pages that might display it.

```ts title="app/controllers/posts_controller.ts"
import cache from '@adonisjs/cache/services/main'
import Post from '#models/post'

export default class PostsController {
  async index({ request }: HttpContext) {
    const page = request.input('page', 1)

    /**
     * Tag the cached page with "posts" so we can
     * invalidate all pages when any post changes.
     */
    const posts = await cache.getOrSet({
      key: `posts:page:${page}`,
      ttl: '10m',
      tags: ['posts'],
      factory: () => Post.query().paginate(page, 20),
    })

    return posts
  }

  async update({ params, request }: HttpContext) {
    const post = await Post.findOrFail(params.id)
    post.merge(request.all())
    await post.save()

    /**
     * Invalidate all cache entries tagged with "posts".
     * Every paginated page will be refreshed on next request.
     */
    await cache.deleteByTag({ tags: ['posts'] })

    return post
  }
}
```

You can assign multiple tags to a single entry. An entry is invalidated when any of its tags is invalidated.

```ts title="app/services/dashboard_service.ts"
import cache from '@adonisjs/cache/services/main'

await cache.getOrSet({
  key: `dashboard:user:${userId}`,
  ttl: '5m',
  tags: ['dashboard', `user:${userId}`],
  factory: () => buildDashboard(userId),
})

/**
 * Invalidate a specific user's dashboard
 */
await cache.deleteByTag({ tags: [`user:${userId}`] })

/**
 * Or invalidate all dashboards
 */
await cache.deleteByTag({ tags: ['dashboard'] })
```

:::tip
Avoid using too many tags per entry. BentoCache uses client-side tagging, which means each retrieval checks tag invalidation timestamps. A large number of tags per entry can slow down lookups.
:::

## Namespaces

Namespaces group cache keys under a common prefix, allowing you to clear all entries in a namespace without affecting the rest of your cache.

```ts title="app/services/user_service.ts"
import cache from '@adonisjs/cache/services/main'

const usersCache = cache.namespace('users')

/**
 * Keys are automatically prefixed with "users:"
 * This stores the value under "users:42"
 */
await usersCache.set({ key: '42', value: { name: 'John' } })
await usersCache.set({ key: '43', value: { name: 'Jane' } })

/**
 * Retrieve from the namespace
 */
const user = await usersCache.get({ key: '42' })

/**
 * Clear only the "users" namespace.
 * Other cache entries remain untouched.
 */
await usersCache.clear()
```

## Switching stores

When you configure multiple stores, you can switch between them using the `use` method. Without it, the default store is used.

```ts title="app/controllers/products_controller.ts"
import cache from '@adonisjs/cache/services/main'

/**
 * Use the default store
 */
await cache.getOrSet({
  key: 'products:featured',
  factory: () => Product.query().where('featured', true).exec(),
})

/**
 * Use the "memory" store for short-lived data
 */
await cache.use('memory').set({
  key: 'rate-limit:user:42',
  value: 1,
  ttl: '1m',
})

/**
 * Use the "database" store for long-lived data
 */
await cache.use('database').setForever({
  key: 'site:config',
  value: { theme: 'dark' },
})
```

## Multi-tier caching

Multi-tier caching combines a fast in-memory L1 cache with a persistent distributed L2 cache. This is the recommended setup for production applications running multiple instances.

### How it works

When you read a value, the cache checks the L1 (in-memory) layer first. If the value is found, it returns immediately without any network call. If missing, it fetches from the L2 (Redis) layer, stores a copy in L1, and returns it.

When you write or delete a value, both layers are updated. A **bus** notifies other application instances to evict their stale L1 entries, so every instance stays consistent.

### Configuration

Combine `useL1Layer`, `useL2Layer`, and `useBus` to create a multi-tier store.

```ts title="config/cache.ts"
import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  default: 'multitier',

  stores: {
    multitier: store()
      .useL1Layer(drivers.memory({ maxSize: '100mb' }))
      .useL2Layer(drivers.redis({ connectionName: 'main' }))
      .useBus(drivers.redisBus({ connectionName: 'main' })),
  },
})

export default cacheConfig
```

:::tip
If your application runs on a single instance, you can omit the bus. The bus is only necessary when multiple instances need to synchronize their L1 caches.
:::

The bus sends only invalidation messages (not the actual values) to other instances. When an instance receives an invalidation message, it removes the key from its L1 cache. The next read will fetch the updated value from L2.

## Grace periods

Grace periods allow you to serve slightly stale cached data while refreshing the value in the background. This makes your application resilient to temporary outages in your data source (database downtime, API failures).

When a cached entry expires but remains within its grace period, the cache returns the stale value to the caller and triggers a background refresh. If the refresh fails (because the database is down, for example), the stale value continues to be served instead of returning an error.

```ts title="app/controllers/products_controller.ts"
import cache from '@adonisjs/cache/services/main'
import Product from '#models/product'

const products = await cache.getOrSet({
  key: 'products:featured',

  /**
   * Data is "fresh" for 10 minutes
   */
  ttl: '10m',

  /**
   * After expiring, stale data remains available for 6 hours.
   * If the factory fails during this window, the stale
   * value is returned instead of an error.
   */
  grace: '6h',

  factory: () => Product.query().where('featured', true).exec(),
})
```

### Backoff strategy

When a factory call fails during the grace period, you probably do not want to retry on every subsequent request. The `graceBackoff` option sets a delay between retry attempts.

```ts title="app/controllers/products_controller.ts"
const products = await cache.getOrSet({
  key: 'products:featured',
  ttl: '10m',
  grace: '6h',

  /**
   * After a failed refresh, wait 5 minutes before
   * trying again. Stale data is served in the meantime.
   */
  graceBackoff: '5m',

  factory: () => Product.query().where('featured', true).exec(),
})
```

You can also enable grace periods globally in your configuration so you do not have to repeat them on every operation.

```ts title="config/cache.ts"
const cacheConfig = defineConfig({
  default: 'redis',
  ttl: '10m',
  grace: '6h',
  graceBackoff: '30s',

  stores: {
    // ...
  },
})
```

## Stampede protection

A **cache stampede** occurs when a cache entry expires and many concurrent requests all try to regenerate it at the same time, overwhelming your data source. BentoCache prevents this automatically.

When the first request finds a missing or expired key, it acquires a lock and executes the factory function. All other concurrent requests for the same key wait for the lock to release and then receive the cached result. This means only one factory execution happens, regardless of how many requests arrive simultaneously.

For example, if 10,000 requests hit an expired key at the same time, only one database query is made. The other 9,999 requests receive the cached result once it is available. This protection is built in and requires no configuration.

## Timeouts

Timeouts prevent slow factory functions from blocking your responses. BentoCache supports two types.

### Soft timeouts

A soft timeout works alongside grace periods. If the factory takes longer than the timeout and a stale entry exists in the grace window, the stale value is returned immediately while the factory continues running in the background.

```ts title="app/controllers/products_controller.ts"
const products = await cache.getOrSet({
  key: 'products:featured',
  ttl: '10m',
  grace: '6h',

  /**
   * If the factory takes more than 200ms, return the
   * stale value immediately. The factory keeps running
   * in the background to update the cache.
   */
  timeout: '200ms',

  factory: () => Product.query().where('featured', true).exec(),
})
```

:::note
Soft timeouts only take effect when a stale entry is available in the grace period. If no stale entry exists (first-time cache population), the request waits for the factory to complete.
:::

### Hard timeouts

A hard timeout sets an absolute limit on how long to wait for the factory. If exceeded, an exception is thrown. The factory continues executing in the background so the cache will be populated for subsequent requests.

```ts title="app/controllers/products_controller.ts"
const products = await cache.getOrSet({
  key: 'products:featured',
  ttl: '10m',

  /**
   * If the factory takes more than 1 second,
   * throw an error.
   */
  hardTimeout: '1s',

  factory: () => Product.query().where('featured', true).exec(),
})
```

You can combine both timeouts. The soft timeout returns stale data quickly, and the hard timeout acts as a safety net.

```ts title="app/controllers/products_controller.ts"
const products = await cache.getOrSet({
  key: 'products:featured',
  ttl: '10m',
  grace: '6h',
  timeout: '200ms',
  hardTimeout: '1s',
  factory: () => Product.query().where('featured', true).exec(),
})
```

## Adaptive caching

Adaptive caching lets you dynamically adjust cache options based on the data being cached. This is useful when the ideal TTL depends on the actual value.

The factory function receives a context object with helper methods to adjust cache behavior after inspecting the fetched data.

```ts title="app/services/auth_service.ts"
import cache from '@adonisjs/cache/services/main'

const token = await cache.getOrSet({
  key: `auth:token:${provider}`,
  ttl: '1h',
  factory: async (ctx) => {
    const token = await fetchOAuthToken(provider)

    /**
     * Set the TTL based on the token's actual expiration
     * rather than using a fixed value
     */
    ctx.setOptions({ ttl: `${token.expiresIn}s` })

    return token
  },
})
```

The context object also provides:

- `ctx.skip()` to prevent caching the returned value
- `ctx.fail()` to prevent caching and throw an error
- `ctx.setTags([...])` to dynamically set tags based on the cached value
- `ctx.gracedEntry` to access the stale value from the grace period (if any)

## Edge integration

The cache service is available in your Edge templates. You can use it to display cached values directly in your views.

```edge title="resources/views/pages/home.edge"
<p>Hello {{ await cache.get({ key: 'username' }) }}</p>
```

## Ace commands

The `@adonisjs/cache` package provides Ace commands for managing your cache from the terminal.

### cache:clear

Remove all entries from a store, namespace, or tag.

```sh
# Clear the default store
node ace cache:clear

# Clear a specific store
node ace cache:clear redis

# Clear a specific namespace
node ace cache:clear --namespace=users

# Clear entries matching specific tags
node ace cache:clear --tags=products --tags=users
```

### cache:delete

Remove a specific key from the cache.

```sh
# Delete from the default store
node ace cache:delete posts:page:1

# Delete from a specific store
node ace cache:delete posts:page:1 redis
```

### cache:prune

Remove expired entries from drivers that do not support automatic TTL expiration (like the database and filesystem drivers). Redis handles expiration natively and does not need pruning.

```sh
# Prune the default store
node ace cache:prune

# Prune a specific store
node ace cache:prune database
```

## Method reference

All methods are available on the `cache` object imported from `@adonisjs/cache/services/main`. They are also available on instances returned by `cache.use()` and `cache.namespace()`.

::::options

:::option{name="getOrSet" dataType="Promise<T>"}
Try to get a value from cache. If missing, execute the factory, cache the result, and return it.

```ts
await cache.getOrSet({
  key: 'users:1',
  ttl: '10m',
  grace: '6h',
  tags: ['users'],
  factory: () => User.find(1),
})
```
:::

:::option{name="get" dataType="Promise<T | undefined>"}
Retrieve a value from the cache. Returns `undefined` if the key does not exist.

```ts
const user = await cache.get({ key: 'users:1' })
```
:::

:::option{name="set" dataType="Promise<void>"}
Store a value in the cache with an optional TTL.

```ts
await cache.set({ key: 'users:1', value: user, ttl: '10m' })
```
:::

:::option{name="setForever" dataType="Promise<void>"}
Store a value in the cache that never expires.

```ts
await cache.setForever({ key: 'app:version', value: '2.0.0' })
```
:::

:::option{name="has" dataType="Promise<boolean>"}
Check if a key exists in the cache.

```ts
const exists = await cache.has({ key: 'users:1' })
```
:::

:::option{name="missing" dataType="Promise<boolean>"}
Check if a key does not exist in the cache.

```ts
const notCached = await cache.missing({ key: 'users:1' })
```
:::

:::option{name="pull" dataType="Promise<T | undefined>"}
Retrieve a value from the cache and delete it immediately.

```ts
const token = await cache.pull({ key: 'verify:token:123' })
```
:::

:::option{name="delete" dataType="Promise<void>"}
Remove a single key from the cache.

```ts
await cache.delete({ key: 'users:1' })
```
:::

:::option{name="deleteMany" dataType="Promise<void>"}
Remove multiple keys from the cache.

```ts
await cache.deleteMany({ keys: ['users:1', 'users:2'] })
```
:::

:::option{name="deleteByTag" dataType="Promise<void>"}
Remove all entries associated with the given tags.

```ts
await cache.deleteByTag({ tags: ['users'] })
```
:::

:::option{name="clear" dataType="Promise<void>"}
Remove all entries from the cache (or from the current namespace).

```ts
await cache.clear()
```
:::

:::option{name="namespace" dataType="CacheNamespace"}
Return a namespace instance. All operations on the returned instance are scoped to the namespace.

```ts
const usersCache = cache.namespace('users')
await usersCache.set({ key: '1', value: user })
```
:::

:::option{name="use" dataType="CacheStore"}
Return a specific store instance by name.

```ts
const redisCache = cache.use('redis')
await redisCache.get({ key: 'users:1' })
```
:::

::::
