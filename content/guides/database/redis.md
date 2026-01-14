---
summary: Use Redis inside your AdonisJS applications using the `@adonisjs/redis` package.
---

# Redis

This guide covers Redis integration in AdonisJS applications. You will learn how to:

- Install and configure the package
- Execute Redis commands
- Manage multiple connections
- Use Pub/Sub messaging
- Handle connection errors
- Configure clusters and sentinels

## Overview

The `@adonisjs/redis` package is a thin wrapper on top of **ioredis** (a Node.js Redis client) with better developer experience around Pub/Sub and automatic management of multiple Redis connections.

You can use Redis for caching, session storage, job queues, rate limiting, and real-time messaging. The package provides a clean API to execute Redis commands, manage multiple named connections, and subscribe to Pub/Sub channels without manually managing subscriber connections.

## Installation

Install and configure the package using the following command:

```sh
node ace add @adonisjs/redis
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/redis` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.

    ```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/redis/redis_provider')
      ]
    }
    ```

3. Creates the `config/redis.ts` file with connection configuration for your Redis server.

4. Defines the following environment variables and their validation rules.

    ```dotenv
    REDIS_HOST=127.0.0.1
    REDIS_PORT=6379
    REDIS_PASSWORD=
    ```

:::

## Configuration

The configuration for the Redis package is stored inside the `config/redis.ts` file.

See also: [Config file stub](https://github.com/adonisjs/redis/blob/main/stubs/config/redis.stub)

```ts title="config/redis.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
      keyPrefix: '',
    },
  },
})

export default redisConfig
```

::::options

:::option{name="connection"}

The `connection` property defines which connection to use by default. When you run Redis commands without choosing an explicit connection, they will be executed against the default connection.

:::

:::option{name="connections"}

The `connections` property is a collection of multiple named connections. You can define one or more connections inside this object and switch between them using the `redis.connection()` method.

Every named connection config is identical to the [config accepted by ioredis](https://redis.github.io/ioredis/index.html#RedisOptions).

:::

::::

### Connecting via Unix socket

You can configure Redis to use a Unix socket for local connections. Use the `path` property to specify the socket file location.

```ts title="config/redis.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      /**
       * Path to the Unix socket file.
       * Remove host and port when using socket connections.
       */
      path: env.get('REDIS_SOCKET_PATH'),
      db: 0,
      keyPrefix: '',
    },
  },
})

export default redisConfig
```

### Configuring clusters

The `@adonisjs/redis` package creates a [cluster connection](https://github.com/redis/ioredis#cluster) when you define an array of cluster nodes in your connection config.

**Clusters** distribute data across multiple Redis nodes for horizontal scaling and high availability. Use clusters when you need to scale beyond a single server's memory capacity or want automatic sharding of data across nodes.

```ts title="config/redis.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      // highlight-start
      clusters: [
        { host: '127.0.0.1', port: 6380 },
        { host: '127.0.0.1', port: 6381 },
      ],
      clusterOptions: {
        scaleReads: 'slave',
        slotsRefreshTimeout: 10 * 1000,
      },
      // highlight-end
    },
  },
})

export default redisConfig
```

::::options

:::option{name="clusters"}

An array of cluster node addresses. Each node should specify `host` and `port`. The package will discover all cluster nodes automatically after connecting to the initial nodes.

:::

:::option{name="clusterOptions"}

Cluster-specific options for controlling behavior.

**Common options:**
- `scaleReads`: How to distribute read operations (`'master'`, `'slave'`, or `'all'`)
- `slotsRefreshTimeout`: How often to refresh cluster slot information (in milliseconds)

See the [ioredis cluster documentation](https://github.com/redis/ioredis#cluster) for the complete list of options.

:::

::::

### Configuring sentinels

**Sentinels** provide high availability through automatic failover. Sentinel nodes monitor your master and replica servers and automatically promote a replica to master if the master fails.

You can configure a Redis connection to use sentinels by defining an array of sentinel nodes within the connection config.

See also: [IORedis docs on Sentinels config](https://github.com/redis/ioredis?tab=readme-ov-file#sentinel)

```ts title="config/redis.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      // highlight-start
      sentinels: [
        { host: 'localhost', port: 26379 },
        { host: 'localhost', port: 26380 },
      ],
      name: 'mymaster',
      // highlight-end
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
    },
  },
})

export default redisConfig
```

::::options

:::option{name="sentinels"}

An array of sentinel node addresses. Sentinels will automatically detect which server is the current master and redirect connections accordingly.

:::

:::option{name="name"}

The name of the master group as configured in your sentinels. This must match the sentinel configuration.

:::

::::

## Usage

You can execute Redis commands using the `redis` service exported by the package. The redis service is a singleton instance configured using the settings from your `config/redis.ts` file.

:::note

The commands API is identical to [ioredis](https://redis.github.io/ioredis/classes/Redis.html). Consult the ioredis documentation to view the complete list of available methods.

:::

```ts
import redis from '@adonisjs/redis/services/main'

await redis.set('username', 'virk')
const username = await redis.get('username')
```

### Switching between connections

Commands executed using the `redis` service are invoked against the default connection defined inside the config file. You can execute commands on a specific connection by first getting an instance of it.

The `.connection()` method creates and caches a connection instance for the lifetime of the process. Subsequent calls return the same cached instance.

```ts
import redis from '@adonisjs/redis/services/main'

/**
 * Get connection instance
 */
const redisMain = redis.connection('main')

await redisMain.set('username', 'virk')
const username = await redisMain.get('username')
```

### Quitting connections

Connections are long-lived and you will get the same instance every time you call the `.connection()` method. You can quit a connection gracefully using the `quit` method or force close it immediately using the `disconnect` method.

```ts
import redis from '@adonisjs/redis/services/main'

/**
 * Quit the main connection gracefully
 */
await redis.quit('main')

/**
 * Force quit the main connection immediately
 */
await redis.disconnect('main')
```

You can also quit using the connection instance directly.

```ts
import redis from '@adonisjs/redis/services/main'

const redisMain = redis.connection('main')

/**
 * Quit using connection instance
 */
await redisMain.quit()

/**
 * Force quit using connection instance
 */
await redisMain.disconnect()
```

## Error handling

Redis connections can fail at any time during your application's lifecycle. Without proper error handling, connection failures will crash your application with unhandled promise rejections.

By default, AdonisJS logs Redis connection errors using the application logger and retries connections up to 10 times before closing them permanently. The retry strategy uses exponential backoff to balance between recovering from brief outages and not wasting resources on prolonged failures.

The retry strategy is defined for each connection in your configuration.

See also: [IORedis docs on auto reconnect](https://github.com/redis/ioredis#auto-reconnect)

```ts title="config/redis.ts"
{
  main: {
    host: env.get('REDIS_HOST'),
    port: env.get('REDIS_PORT'),
    password: env.get('REDIS_PASSWORD', ''),
    // highlight-start
    /**
     * Called each time a connection attempt fails.
     * Return null to stop retrying.
     * Return a number (milliseconds) to retry after that delay.
     */
    retryStrategy(times) {
      // Stop after 10 attempts
      if (times > 10) {
        return null
      }
      
      // Exponential backoff: 50ms, 100ms, 150ms, etc.
      return times * 50
    },
    // highlight-end
  },
}
```

:::warning

Without proper error handling, Redis connection failures will crash your application. The default retry strategy attempts 10 reconnections before giving up. For production deployments, customize the retry strategy based on your availability requirements and monitor Redis connection health.

**Customizing for production:**

```ts
retryStrategy(times) {
  // More retries for production
  if (times > 20) {
    return null
  }
  
  // Exponential backoff with max 5 seconds
  return Math.min(times * 50, 5000)
}
```

:::

You can disable the default error reporter using the `.doNotLogErrors()` method. This removes the `error` event listener from Redis connections.

```ts
import redis from '@adonisjs/redis/services/main'

/**
 * Disable default error reporter
 */
redis.doNotLogErrors()

redis.on('connection', (connection) => {
  /**
   * Always define an error listener to prevent crashes.
   * Without this, unhandled errors will crash your application.
   */
  connection.on('error', (error) => {
    console.log(error)
  })
})
```

## Pub/Sub

**Pub/Sub** (Publish/Subscribe) is a messaging pattern where publishers send messages to channels without knowing who receives them, and subscribers listen to channels without knowing who sent them. This decoupling makes Pub/Sub ideal for real-time features like notifications, live updates, and chat systems.

Redis needs multiple connections for Pub/Sub. The subscriber connection cannot perform regular Redis operations other than subscribing and unsubscribing. When you call the `subscribe` method for the first time, the package automatically creates a subscriber connection for you.

### Subscribing to channels

The `subscribe` method handles both subscribing to a channel and listening for messages. This is different from the ioredis API where you need to use separate methods.

```ts
import redis from '@adonisjs/redis/services/main'

redis.subscribe('user:add', function (message) {
  console.log(message)
})
```

You can handle subscription lifecycle events using the options parameter.

```ts
redis.subscribe(
  'user:add',
  (message) => {
    console.log(message)
  },
  {
    /**
     * Called when subscription fails
     */
    onError(error) {
      console.log(error)
    },
    
    /**
     * Called when subscription is established.
     * Count is the total number of active subscriptions.
     */
    onSubscription(count) {
      console.log(count)
    },
  }
)
```

### API differences from IORedis

When using ioredis directly, you need to use two different APIs to subscribe to a channel and listen for messages. The AdonisJS wrapper combines these into a single convenient method.

```ts title="With IORedis"
redis.on('message', (channel, message) => {
  console.log(message)
})

redis.subscribe('user:add', (error, count) => {
  if (error) {
    console.log(error)
  }
})
```

```ts title="With AdonisJS wrapper"
redis.subscribe(
  'user:add',
  (message) => {
    console.log(message)
  },
  {
    onError(error) {
      console.log(error)
    },
    onSubscription(count) {
      console.log(count)
    },
  }
)
```

### Publishing messages

You can publish messages using the `publish` method. The method accepts the channel name as the first parameter and the message data as the second parameter.

```ts
redis.publish(
  'user:add',
  JSON.stringify({
    id: 1,
    username: 'virk',
  })
)
```

:::tip

Make sure to subscribe before publishing messages. Messages published before a subscription is established will be lost since there are no subscribers to receive them.

:::

### Subscribing to patterns

You can subscribe to channel patterns using wildcards with the `psubscribe` method. The callback receives both the channel name and the message.

```ts
redis.psubscribe('user:*', (channel, message) => {
  console.log(channel)
  console.log(message)
})

redis.publish(
  'user:add',
  JSON.stringify({
    id: 1,
    username: 'virk',
  })
)
```

### Unsubscribing

You can unsubscribe from channels or patterns using the `unsubscribe` and `punsubscribe` methods.

```ts
await redis.unsubscribe('user:add')
await redis.punsubscribe('user:*add*')
```

## Using Lua scripts

**Lua scripts** allow you to execute complex operations atomically on the Redis server. This is useful when you need multiple Redis commands to succeed or fail together without race conditions.

You can register Lua scripts as commands with the Redis service. These commands are automatically applied to all connections.

See also: [IORedis docs on Lua Scripting](https://github.com/redis/ioredis#lua-scripting)

```ts
import redis from '@adonisjs/redis/services/main'

redis.defineCommand('release', {
  numberOfKeys: 2,
  lua: `
    redis.call('zrem', KEYS[2], ARGV[1])
    redis.call('zadd', KEYS[1], ARGV[2], ARGV[1])
    return true
  `,
})
```

Once you have defined a command, you can execute it using the `runCommand` method. Keys are passed first, followed by arguments.

```ts
redis.runCommand(
  'release',         // command name
  'jobs:completed',  // key 1
  'jobs:running',    // key 2
  '11023',           // argv 1
  100                // argv 2
)
```

You can execute the same command on a specific connection.

```ts
redis.connection('jobs').runCommand(
  'release',
  'jobs:completed',
  'jobs:running',
  '11023',
  100
)
```

You can also define commands for specific connection instances using the `connection` event.

```ts
redis.on('connection', (connection) => {
  if (connection.connectionName === 'jobs') {
    connection.defineCommand('release', {
      numberOfKeys: 2,
      lua: `
        redis.call('zrem', KEYS[2], ARGV[1])
        redis.call('zadd', KEYS[1], ARGV[2], ARGV[1])
        return true
      `,
    })
  }
})
```

## Transforming arguments and replies

You can customize how arguments are sent to Redis and how replies are parsed using the `redis.Command` property. This is useful when you want to work with JavaScript objects, Maps, or custom data types.

The API is identical to the [IORedis transformers API](https://github.com/redis/ioredis#transforming-arguments--replies).

### Argument transformers

Argument transformers modify data before sending it to Redis.

```ts title="Transforming arguments for hmset"
import redis from '@adonisjs/redis/services/main'

redis.Command.setArgumentTransformer('hmset', (args) => {
  if (args.length === 2) {
    /**
     * If second argument is a Map, convert to array
     */
    if (args[1] instanceof Map) {
      return [args[0], ...utils.convertMapToArray(args[1])]
    }
    
    /**
     * If second argument is an object, convert to array
     */
    if (typeof args[1] === 'object' && args[1] !== null) {
      return [args[0], ...utils.convertObjectToArray(args[1])]
    }
  }
  return args
})
```

### Reply transformers

Reply transformers modify data received from Redis.

```ts title="Transforming hgetall reply"
import redis from '@adonisjs/redis/services/main'

redis.Command.setReplyTransformer('hgetall', (result) => {
  if (Array.isArray(result)) {
    const obj = {}
    
    /**
     * Redis returns [key1, value1, key2, value2].
     * Convert to object format.
     */
    for (let i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1]
    }
    
    return obj
  }
  return result
})
```

## Testing

When testing code that uses Redis, you can configure a separate connection for your tests to isolate test data from development or production data.

First, define a test connection in your Redis configuration.

```ts title="config/redis.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: env.get('REDIS_CONNECTION', 'main'),
  connections: {
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
    },
    // [!code highlight:6]
    test: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 1, // Use a different database for tests
    },
  },
})

export default redisConfig
```

Then, set the `REDIS_CONNECTION` environment variable to `test` when running tests within the `.env.test` file

```ts title=".env.test"
REDIS_CONNECTION=test
```

Clean up test data after each test to ensure test isolation.

```ts title="tests/functional/posts.spec.ts"
import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'

test.group('Posts', (group) => {
  group.each.teardown(async () => {
    /**
     * Clear all keys in the test database
     */
    await redis.flushdb()
  })
  
  test('caches post data', async ({ client }) => {
    // Your test code
  })
})
```

## Events

The following events are emitted by Redis connection instances. You can listen to these events using the `redis.on('connection')` method.

```ts
import redis from '@adonisjs/redis/services/main'

redis.on('connection', (connection) => {
  connection.on('connect', () => {
    console.log('Connected')
  })
})
```

### Connection lifecycle events

::::options

:::option{name="connect / subscriber:connect"}

Emitted when a connection is established. The `subscriber:connect` event is emitted when a subscriber connection is made.

```ts
redis.on('connection', (connection) => {
  connection.on('connect', () => {})
  connection.on('subscriber:connect', () => {})
})
```

:::

:::option{name="wait"}

Emitted when the connection is in wait mode because the `lazyConnect` option is enabled in the config. The connection moves out of wait mode after executing the first command.

```ts
redis.on('connection', (connection) => {
  connection.on('wait', () => {})
})
```

:::

:::option{name="ready / subscriber:ready"}

Emitted after the `connect` event when Redis is ready to accept commands. If you enable the `enableReadyCheck` flag in your config, this event waits for the Redis server to report readiness.

```ts
redis.on('connection', (connection) => {
  connection.on('ready', () => {})
  connection.on('subscriber:ready', () => {})
})
```

:::

:::option{name="error / subscriber:error"}

Emitted when unable to connect to the Redis server or when a connection error occurs. See [error handling](#error-handling) for proper error management.

```ts
redis.on('connection', (connection) => {
  connection.on('error', () => {})
  connection.on('subscriber:error', () => {})
})
```

:::

:::option{name="close / subscriber:close"}

Emitted when a connection is closed. IORedis might retry establishing a connection after emitting the `close` event, depending on the retry strategy.

```ts
redis.on('connection', (connection) => {
  connection.on('close', () => {})
  connection.on('subscriber:close', () => {})
})
```

:::

:::option{name="reconnecting / subscriber:reconnecting"}

Emitted when attempting to reconnect after a connection closes.

```ts
redis.on('connection', (connection) => {
  connection.on('reconnecting', ({ waitTime }) => {
    console.log(waitTime)
  })
  connection.on('subscriber:reconnecting', ({ waitTime }) => {
    console.log(waitTime)
  })
})
```

:::

:::option{name="end / subscriber:end"}

Emitted when the connection has been closed permanently and no further reconnections will be attempted.

```ts
redis.on('connection', (connection) => {
  connection.on('end', () => {})
  connection.on('subscriber:end', () => {})
})
```

:::

::::

### Cluster events

::::options

:::option{name="node:added"}

Emitted when a new node is added to the cluster. Only applicable to cluster connections.

```ts
redis.on('connection', (connection) => {
  connection.on('node:added', () => {})
})
```

:::

:::option{name="node:removed"}

Emitted when a node is removed from the cluster. Only applicable to cluster connections.

```ts
redis.on('connection', (connection) => {
  connection.on('node:removed', () => {})
})
```

:::

:::option{name="node:error"}

Emitted when unable to connect to a cluster node. Only applicable to cluster connections.

```ts
redis.on('connection', (connection) => {
  connection.on('node:error', ({ error, address }) => {
    console.log(error, address)
  })
})
```

:::

::::

### Subscription events

::::options

:::option{name="subscription:ready / psubscription:ready"}

Emitted when a subscription is established on a channel or pattern.

```ts
redis.on('connection', (connection) => {
  connection.on('subscription:ready', ({ count }) => {
    console.log(count)
  })
  connection.on('psubscription:ready', ({ count }) => {
    console.log(count)
  })
})
```

:::

:::option{name="subscription:error / psubscription:error"}

Emitted when unable to subscribe to a channel or pattern.

```ts
redis.on('connection', (connection) => {
  connection.on('subscription:error', () => {})
  connection.on('psubscription:error', () => {})
})
```

:::

::::
