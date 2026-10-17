---
description: Learn how to use the AdonisJS logger to write logs to the console, files, and external services. Built on top of Pino, the logger is fast and supports multiple targets.
---

# Logger

This guide covers logging in AdonisJS applications. You will learn how to:

- Write logs during HTTP requests using the request-aware logger
- Configure pretty-printed logs for development and file-based logs for production
- Define multiple loggers for different parts of your application
- Inject the logger into services using dependency injection
- Create child loggers that inherit context from their parent
- Protect sensitive data from appearing in log output

## Overview

AdonisJS includes an inbuilt logger for writing logs to the terminal, files, and external services. Under the hood, the logger uses [Pino](https://getpino.io), one of the fastest logging libraries in the Node.js ecosystem. Logs are produced in the [NDJSON format](https://github.com/ndjson/ndjson-spec), making them easy to parse and process with standard tooling.

The logger integrates deeply with AdonisJS. During HTTP requests, each request automatically gets its own logger instance that includes the request ID in every log entry, making it straightforward to trace logs back to specific requests.

:::note
This guide focuses on logging during HTTP requests. For CLI applications, see the [Ace ANSI logger documentation](../ace/tui.md#displaying-log-messages) which provides terminal-friendly colored output designed for command-line tools.
:::

## Writing your first log

Import the logger service and call any of the logging methods to write a message. During development, logs appear in your terminal with pretty formatting that includes timestamps, colors, and readable structure.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import logger from '@adonisjs/core/services/logger'

router.get('/', async () => {
  logger.info('Processing home page request')
  return { hello: 'world' }
})
```

When you visit the route, you'll see output like this in your terminal:
```
[10:24:36.842] INFO: Processing home page request
```

The logger provides methods for each log level, from most to least verbose:
```ts title="app/controllers/posts_controller.ts"
import logger from '@adonisjs/core/services/logger'

export default class PostsController {
  async store() {
    logger.trace({ config }, 'Using config')      // Most verbose, for tracing execution
    logger.debug('User details: %o', { id: 1 })   // Debug information
    logger.info('Creating new post')              // General information
    logger.warn('Rate limit approaching')         // Warning conditions
    logger.error({ err }, 'Failed to save post')  // Error conditions
    logger.fatal({ err }, 'Database connection lost') // Critical failures
  }
}
```

### Adding context to logs

Pass an object as the first argument to include additional data in the log entry. The object properties are merged into the JSON output.
```ts
const user = { id: 1, email: 'virk@adonisjs.com' }
logger.info({ user }, 'User logged in')
```

When logging errors, use the `err` key so Pino's built-in serializer formats the error properly with stack traces:
```ts
try {
  await riskyOperation()
} catch (error) {
  logger.error({ err: error }, 'Operation failed')
}
```

### String interpolation

Log messages support printf-style interpolation for embedding values directly in the message string:
```ts
logger.info('User %s logged in from %s', username, ipAddress)
logger.debug('Request body: %o', requestBody)  // %o for objects
logger.info('Processing %d items', items.length) // %d for numbers
```

## Request-aware logging

During HTTP requests, use `ctx.logger` instead of importing the logger service directly. The context logger automatically includes the request ID in every log entry, making it easy to correlate all logs from a single request.
```ts title="app/controllers/users_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class UsersController {
  async show({ logger, params }: HttpContext) {
    logger.info('Fetching user by id %s', params.id)
    
    const user = await User.find(params.id)
    if (!user) {
      logger.warn('User not found')
      return { error: 'Not found' }
    }
    
    logger.info('User retrieved successfully')
    return user
  }
}
```

The output includes the request ID, allowing you to filter logs for a specific request:
```
[10:24:36.842] INFO (request_id=cjkl3402k0001...): Fetching user by id 42
[10:24:36.901] INFO (request_id=cjkl3402k0001...): User retrieved successfully
```

## Configuring the logger

The logger configuration lives in `config/logger.ts`. The default setup uses pretty-printed output in development and structured JSON in production.
```ts title="config/logger.ts"
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      destination: !app.inProduction ? await syncDestination() : undefined,
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
```

### Understanding the configuration

The `syncDestination()` helper configures synchronous, pretty-printed output for development. By default, Pino writes logs asynchronously for better performance, but this can make it harder to correlate logs with the code that produced them during debugging. The synchronous destination writes logs inline as your code executes, with human-readable formatting.

When a `destination` is defined, the logger ignores the `transport` option. In production, the `destination` is left as `undefined`, which means logs flow through the configured transport targets. The `targets.file({ destination: 1 })` target writes JSON logs to stdout (file descriptor 1), which is the standard approach for containerized deployments where a log aggregator collects stdout.

:::tip
Applications created before `@adonisjs/logger@7.1.1` may define the option as `desination` (a typo). The misspelled key still works but is deprecated. Rename it to `destination`.

```ts title="config/logger.ts"
desination: !app.inProduction ? await syncDestination() : undefined, // [!code --]
destination: !app.inProduction ? await syncDestination() : undefined, // [!code ++]
```
:::

### Configuration reference

| Property | Description |
|----------|-------------|
| `default` | The name of the logger to use when calling `logger.info()` without specifying a logger |
| `enabled` | Set to `false` to disable the logger entirely |
| `name` | A name included in every log entry, useful for identifying the source application |
| `level` | The minimum level to log. Messages below this level are ignored |
| `destination` | A custom destination stream. Use `syncDestination()` for synchronous pretty output |
| `transport` | Configuration for Pino transports that process and route logs. Ignored when `destination` is set |
| `timestamp` | Controls the timestamp added to every log entry. See [customizing timestamps](#customizing-timestamps) |
| `redact` | Keys to hide from log output. See [hiding sensitive values](#hiding-sensitive-values) |

### Log levels

The logger supports six levels, ordered from most to least verbose. When you set a level, the logger produces logs at that level and above.

| Level | Value | Description |
|-------|-------|-------------|
| `trace` | 10 | Extremely detailed tracing information |
| `debug` | 20 | Debug information useful during development |
| `info` | 30 | General operational information |
| `warn` | 40 | Warning conditions that should be reviewed |
| `error` | 50 | Error conditions that need attention |
| `fatal` | 60 | Critical failures that require immediate action |

Set the level in your `.env` file:
```dotenv title=".env"
LOG_LEVEL=debug
```

### Customizing timestamps

By default, Pino adds the number of milliseconds since the Unix epoch to every log entry. Use the `timestamp` option to pick another format with one of the `iso`, `unix`, or `epoch` keywords, to remove timestamps with `false`, or to compute the value with a function.

```ts title="config/logger.ts"
loggers: {
  app: {
    enabled: true,
    name: env.get('APP_NAME'),
    level: env.get('LOG_LEVEL'),
    // ISO 8601 string, e.g. "time":"2026-10-17T10:24:36.842Z"
    timestamp: 'iso',
  },
}
```

A function must return the partial JSON string to append to the log line, including the leading comma.

```ts title="config/logger.ts"
timestamp: () => `,"time":"${new Date().toUTCString()}"`,
```

### Writing logs to a file

To write logs to a file instead of stdout, configure the `targets.file()` helper with a file path:
```ts title="config/logger.ts"
transport: {
  targets: [
    targets.file({ destination: '/var/log/apps/adonisjs.log' })
  ],
}
```

### File rotation

Pino does not include built-in file rotation. Use either a system tool like [logrotate](https://getpino.io/#/docs/help?id=rotate) or the [pino-roll](https://github.com/feugy/pino-roll) package.
```sh
npm i pino-roll
```
```ts title="config/logger.ts"
transport: {
  targets: [
    {
      target: 'pino-roll',
      level: 'info',
      options: {
        file: '/var/log/apps/adonisjs.log',
        frequency: 'daily',
        mkdir: true,
      },
    },
  ],
}
```

### Defining targets conditionally

Use the `targets()` helper to build the targets array with conditional logic. This is cleaner than spreading arrays with ternary operators.
```ts title="config/logger.ts"
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

export default defineConfig({
  default: 'app',
  
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
})
```

The `pushIf` method only adds the target when the condition is true, keeping your configuration readable.

## Using multiple loggers

Define multiple loggers in your configuration when different parts of your application need separate logging behavior. For example, you might want payment-related logs to go to a separate file with a different retention policy.
```ts title="config/logger.ts"
export default defineConfig({
  default: 'app',

  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      destination: !app.inProduction ? await syncDestination() : undefined,
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
    payments: {
      enabled: true,
      name: 'payments',
      level: 'info',
      transport: {
        targets: [
          targets.file({ destination: '/var/log/apps/payments.log' }),
        ],
      },
    },
  },
})
```

Access a specific logger using the `logger.use()` method:
```ts title="app/services/payment_service.ts"
import logger from '@adonisjs/core/services/logger'

export default class PaymentService {
  async processPayment(amount: number) {
    const paymentLogger = logger.use('payments')
    
    paymentLogger.info({ amount }, 'Processing payment')
    // ... payment logic
    paymentLogger.info('Payment completed successfully')
  }
}
```

Calling `logger.use()` without arguments returns the default logger.

## Dependency injection

When using dependency injection, type-hint the `Logger` class and the IoC container resolves an instance of the default logger. If the class is constructed during an HTTP request, the container automatically injects the request-aware logger with the request ID included.
```ts title="app/services/user_service.ts"
import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'
import User from '#models/user'

@inject()
export default class UserService {
  constructor(protected logger: Logger) {}

  async find(userId: string | number) {
    this.logger.info('Fetching user by id %s', userId)
    return User.find(userId)
  }
}
```

## Child loggers

A child logger inherits configuration and bindings from its parent while allowing you to add additional context. This is useful when you want all logs from a particular operation to include shared metadata.
```ts
import logger from '@adonisjs/core/services/logger'

const orderLogger = logger.child({ orderId: 'order_123' })

orderLogger.info('Processing order')      // Includes orderId
orderLogger.info('Validating items')      // Includes orderId
orderLogger.info('Order complete')        // Includes orderId
```

Every log entry from `orderLogger` automatically includes the `orderId` field. You can also override the log level for a child logger:
```ts
const verboseLogger = logger.child({}, { level: 'trace' })
```

## Conditional logging

If computing data for a log message is expensive, check whether the level is enabled before doing the work:
```ts
import logger from '@adonisjs/core/services/logger'

if (logger.isLevelEnabled('debug')) {
  const data = await computeExpensiveDebugData()
  logger.debug(data, 'Debug information')
}
```

The `ifLevelEnabled` method provides a callback-based alternative:
```ts
logger.ifLevelEnabled('debug', async () => {
  const data = await computeExpensiveDebugData()
  logger.debug(data, 'Debug information')
})
```

## Hiding sensitive values

Logs can inadvertently expose sensitive data. Use the `redact` option to automatically hide values for specific keys. Under the hood, this uses the [fast-redact](https://github.com/davidmarkclements/fast-redact) package.
```ts title="config/logger.ts"
loggers: {
  app: {
    enabled: true,
    name: env.get('APP_NAME'),
    level: env.get('LOG_LEVEL'),
    redact: {
      paths: ['password', '*.password', 'creditCard'],
    },
  },
}
```
```ts
logger.info({ username: 'virk', password: 'secret123' }, 'User signup')
// Output: {"username":"virk","password":"[Redacted]","msg":"User signup"}
```

Customize the placeholder or remove the keys entirely:
```ts title="config/logger.ts"
redact: {
  paths: ['password', '*.password'],
  censor: '[PRIVATE]',
}

// Or remove the property entirely
redact: {
  paths: ['password'],
  remove: true,
}
```

### Using the Secret class

An alternative to redaction is wrapping sensitive values in the `Secret` class. The logger automatically redacts any `Secret` instance.

See also: [Secret class documentation](../../reference/helpers.md#secret)

```ts
import { Secret } from '@adonisjs/core/helpers'

const password = new Secret(request.input('password'))

logger.info({ username, password }, 'User signup')
// Output: {"username":"virk","password":"[redacted]","msg":"User signup"}
```

## Pino statics

The `@adonisjs/core/logger` module re-exports Pino's static methods and properties for advanced use cases.

See the [Pino documentation](https://getpino.io/#/docs/api?id=statics) for details on these exports.

```ts
import {
  multistream,
  destination,
  transport,
  stdSerializers,
  stdTimeFunctions,
  version,
} from '@adonisjs/core/logger'
```
