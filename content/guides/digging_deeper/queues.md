---
description: Learn how to use job queues in AdonisJS to process tasks in the background with support for retries, scheduling, and multiple backends.
---

# Queues

:::warning
The `@adonisjs/queue` package is currently experimental. Its API may change between minor releases until it reaches a stable version. Pin the package version in your `package.json` to avoid unexpected breaking changes during updates.
:::

This guide covers background job processing with queues in AdonisJS. You will learn how to:

- Install and configure the queue system with Redis or Database backends
- Create jobs and dispatch them for background processing
- Prevent duplicate jobs with dispatch-time deduplication
- Delay jobs, set priorities, and dispatch in batches
- Configure retry strategies with exponential, linear, or fixed backoff
- Schedule recurring jobs using cron expressions or intervals
- Start workers to process jobs from queues
- Upgrade the queue storage after updating the package
- Trace dispatched and executed jobs with OpenTelemetry
- Test job dispatching with the fake adapter

## Overview

Web applications often need to perform tasks that are too slow or resource-intensive to run during an HTTP request. Sending emails, generating reports, processing payments, or resizing images are all examples of work that should happen in the background so your users get an immediate response.

The `@adonisjs/queue` package provides a job queue system for AdonisJS, built on top of [@boringnode/queue](https://github.com/boringnode/queue). You define **jobs** as classes with typed payloads, dispatch them from your application code, and run a separate **worker** process that picks up and executes those jobs.

The package supports multiple backends. The **Redis** adapter is recommended for production, offering atomic operations and high throughput. The **Database** adapter uses your existing SQL database (PostgreSQL, MySQL, or SQLite) through Lucid. A **Sync** adapter is also available for development and testing, executing jobs immediately without a separate worker.

## Installation

The package requires `@adonisjs/core` 7.6 or later. Install and configure it using the following command:

```sh
node ace add @adonisjs/queue
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/queue` package using the detected package manager.
2. Registers the following service provider, commands, and preload file inside the `adonisrc.ts` file.

    ```ts title="adonisrc.ts"
    {
      commands: [
        // ...other commands
        () => import('@adonisjs/queue/commands')
      ],
      providers: [
        // ...other providers
        () => import('@adonisjs/queue/queue_provider')
      ],
      preloads: [
        // ...other preloads
        {
          file: () => import('#start/scheduler'),
          environment: ['web'],
        }
      ]
    }
    ```

3. Creates the `config/queue.ts` file.
4. Creates the `start/scheduler.ts` preload file for defining scheduled jobs. The preload only runs in the `web` environment, so schedules are registered when your HTTP server starts.
5. Creates the `app/jobs` directory and registers the `#jobs/*` import alias inside the `package.json` file.

    ```json title="package.json"
    {
      "imports": {
        "#jobs/*": "./app/jobs/*.js"
      }
    }
    ```

6. Defines the `QUEUE_DRIVER` environment variable and its validation.
7. If you select the database driver, creates a migration to set up queue tables.

:::

The examples in this guide import jobs with the `#jobs/*` alias. If you configured the package with an earlier version, add the alias to the `imports` object of your `package.json` file yourself.

## Configuration

The configuration file lives at `config/queue.ts`. It defines your adapters, the default adapter to use, worker settings, and the location of your job files.

See also: [Config stub](https://github.com/adonisjs/queue/blob/-/stubs/config/queue.stub)

```ts title="config/queue.ts"
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: env.get('QUEUE_DRIVER', 'redis'),

  adapters: {
    redis: drivers.redis({
      connectionName: 'main',
    }),
    sync: drivers.sync(),
  },

  worker: {
    concurrency: 5,
    idleDelay: '2s',
  },

  locations: ['./app/jobs/**/*.{ts,js}'],
})
```

::::options

:::option{name="default" dataType="string"}
The name of the adapter to use by default when dispatching jobs. This value is typically set via the `QUEUE_DRIVER` environment variable.
:::

:::option{name="adapters" dataType="Record<string, AdapterFactory>"}
A record of named adapters. Each adapter is created using one of the `drivers` helpers: `drivers.redis()`, `drivers.database()`, or `drivers.sync()`. You can configure multiple adapters and switch between them at runtime.
:::

:::option{name="worker" dataType="WorkerConfig"}
Configuration for the worker process. See [Worker configuration](#worker-configuration) for all available options.
:::

:::option{name="locations" dataType="string[]"}
An array of glob patterns that point to your job files. The queue system uses these patterns to auto-discover and register job classes.

```ts title="config/queue.ts"
{
  locations: ['./app/jobs/**/*.{ts,js}'],
}
```
:::

:::option{name="retry" dataType="RetryConfig"}
Global retry configuration applied to all jobs unless overridden at the queue or job level. See [Retries and backoff](#retries-and-backoff) for details.
:::

:::option{name="queues" dataType="Record<string, QueueConfig>"}
Per-queue configuration allowing you to set a different adapter, retry policy, or default job options for specific queues. Jobs dispatched to a queue use its `adapter` unless the dispatch selects one with `.with()`. A worker processes jobs from a single adapter, so a queue stored on another adapter needs its own worker started with [`--adapter`](#worker-options).

```ts title="config/queue.ts"
{
  queues: {
    emails: {
      adapter: 'database',
      retry: {
        maxRetries: 5,
      },
    },
  },
}
```
:::

:::option{name="defaultJobOptions" dataType="JobOptions"}
Default options applied to all jobs, including `maxRetries`, `retry`, `timeout`, and `failOnTimeout`. You can also set them per queue inside `queues`. Individual jobs can override these in their `static options` property.
:::

:::option{name="hotReload" dataType="boolean"}
Import the job file again before every execution, so a running process uses the latest version of your jobs. By default, it is enabled when the process runs with hot-hook (`node ace serve --hmr` or `node ace queue:work --hmr`) and disabled otherwise. See [Reloading jobs during development](#reloading-jobs-during-development).
:::

::::

### Adapter configuration

#### Redis

The Redis adapter uses your `@adonisjs/redis` connection. It is the recommended choice for production due to its atomic operations and high throughput.

```ts title="config/queue.ts"
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: 'redis',
  adapters: {
    redis: drivers.redis({
      // Uses the 'main' connection from config/redis.ts
      connectionName: 'main',
    }),
  },
  // ...
})
```

You must have `@adonisjs/redis` installed and configured for this adapter to work.

#### Database

The Database adapter uses your `@adonisjs/lucid` connection with PostgreSQL, MySQL, or SQLite. This is a good choice when you want to avoid adding Redis to your infrastructure.

```ts title="config/queue.ts"
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: 'database',
  adapters: {
    database: drivers.database({
      // Optional, defaults to the primary connection
      connectionName: 'primary',
      // Optional, defaults to 'queue_jobs'
      tableName: 'queue_jobs',
    }),
  },
  // ...
})
```

When selecting the database driver during installation, a migration is automatically created. If you need to create the tables manually, use `KnexQueueSchemaService`:

```ts title="database/migrations/xxxx_create_queue_tables.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'
import { KnexQueueSchemaService } from '@adonisjs/queue/drivers/knex_adapter'

export default class extends BaseSchema {
  async up() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.createJobsTable()
    await schemaService.createSchedulesTable()
  }

  async down() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    await schemaService.dropSchedulesTable()
    await schemaService.dropJobsTable()
  }
}
```

You must have `@adonisjs/lucid` installed and configured for this adapter to work.

:::warning
Tables created by a previous version of the package must be upgraded before the new version uses them. Run `node ace queue:migrate` after updating the package. See [Upgrading the queue storage](#upgrading-the-queue-storage).
:::

#### Sync

The Sync adapter executes jobs immediately in the same process, without a separate worker. This is useful for development and testing when you want to see job results right away.

Like the Redis and Database adapters, it passes the payload through JSON. Each attempt receives a fresh copy, so a `Date` arrives as a string, a class instance loses its class, and a dispatch rejects when the payload holds a value JSON cannot encode, such as a `BigInt`.

```ts title="config/queue.ts"
import { defineConfig, drivers } from '@adonisjs/queue'

export default defineConfig({
  default: 'sync',
  adapters: {
    sync: drivers.sync(),
  },
  // ...
})
```

:::tip
You can use the `QUEUE_DRIVER` environment variable to switch between adapters per environment. Use `redis` or `database` in production and `sync` in development.
:::

## Creating jobs

A **job** is a class that encapsulates a unit of work to be executed in the background. Each job extends the `Job` base class with a typed payload.

Generate a new job using the `make:job` Ace command:

```sh
node ace make:job process_payment
```

This creates a job class at `app/jobs/process_payment.ts`:

```ts title="app/jobs/process_payment.ts"
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

interface ProcessPaymentPayload {
  orderId: number
  amount: number
  currency: string
}

export default class ProcessPayment extends Job<ProcessPaymentPayload> {
  static options: JobOptions = {
    queue: 'default',
    maxRetries: 3,
  }

  async execute() {
    const { orderId, amount, currency } = this.payload

    // Process the payment using your payment gateway
    console.log(`Processing payment of ${amount} ${currency} for order ${orderId}`)
  }

  async failed(error: Error) {
    console.error(`Payment processing failed for order ${this.payload.orderId}:`, error.message)
  }
}
```

The `Job` class provides two methods to implement:

- **`execute()`** (required): Contains the main job logic. Any error thrown here triggers the retry mechanism.
- **`failed(error)`** (optional): Called when the job has permanently failed after all retries are exhausted. Use this for cleanup, logging, or sending notifications.

### Job options

Configure default behavior for your job by setting the `static options` property.

::::options

:::option{name="queue" dataType="string"}
The queue to dispatch this job to. Defaults to `'default'`.
:::

:::option{name="maxRetries" dataType="number"}
Maximum number of retry attempts before the job fails permanently. Defaults to `0` unless configured globally or at the queue level.
:::

:::option{name="priority" dataType="number"}
Job priority from 1 to 10. Lower numbers are processed first. Defaults to `5`.
:::

:::option{name="timeout" dataType="Duration"}
Maximum execution time before the job is timed out. Accepts a number in milliseconds or a duration string like `'30s'` or `'5m'`. No timeout by default, and `0` disables the timeout.

The timeout must be a whole number of milliseconds no larger than 2147483647 (about 24.8 days). The application fails to boot when a job declares an invalid timeout, such as `'30d'`, so you find the mistake before the job is dispatched.
:::

:::option{name="failOnTimeout" dataType="boolean"}
Whether to mark the job as permanently failed on timeout. When `false`, timed out jobs follow the normal retry policy. Defaults to `false`.
:::

:::option{name="retry" dataType="RetryConfig"}
Retry configuration specific to this job, overriding global and queue-level settings. See [Retries and backoff](#retries-and-backoff).
:::

:::option{name="removeOnComplete" dataType="JobRetention"}
Controls whether completed jobs are kept in the history. Set to `true` to remove immediately (default), `false` to keep forever, or an object with `age` and/or `count` constraints.

```ts
{ removeOnComplete: { age: '7d', count: 1000 } }
```

The `age` and `count` constraints apply to the whole queue, not to each job class. Dispatch job classes that need a different retention to their own queue.
:::

:::option{name="removeOnFail" dataType="JobRetention"}
Controls whether failed jobs are kept in the history. Same format as `removeOnComplete`.
:::

::::

### Job context

During execution, you can access metadata about the current job through `this.context`:

```ts title="app/jobs/process_payment.ts"
export default class ProcessPayment extends Job<ProcessPaymentPayload> {
  async execute() {
    // Access job metadata
    console.log(`Job ID: ${this.context.jobId}`)
    console.log(`Attempt: ${this.context.attempt}`)
    console.log(`Queue: ${this.context.queue}`)
    console.log(`Priority: ${this.context.priority}`)
  }
}
```

### Handling timeouts

For long-running jobs, you can check `this.signal` to detect when a timeout has been reached and handle it gracefully:

```ts title="app/jobs/generate_report.ts"
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

interface GenerateReportPayload {
  reportId: number
  rows: number[]
}

export default class GenerateReport extends Job<GenerateReportPayload> {
  static options: JobOptions = {
    timeout: '5m',
    failOnTimeout: false, // Retry instead of failing permanently
  }

  async execute() {
    for (const rowId of this.payload.rows) {
      // Check if the job has timed out before processing each row
      if (this.signal?.aborted) {
        throw new Error('Job timed out during report generation')
      }

      await this.processRow(rowId)
    }
  }

  private async processRow(rowId: number) {
    // Process individual row
  }
}
```

### Dependency injection

Jobs are instantiated through the AdonisJS IoC container, so you can use constructor injection to access services:

```ts title="app/jobs/process_payment.ts"
import { inject } from '@adonisjs/core'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import PaymentService from '#services/payment_service'

interface ProcessPaymentPayload {
  orderId: number
  amount: number
  currency: string
}

@inject()
export default class ProcessPayment extends Job<ProcessPaymentPayload> {
  static options: JobOptions = {
    queue: 'payments',
    maxRetries: 3,
  }

  constructor(private paymentService: PaymentService) {
    super()
  }

  async execute() {
    await this.paymentService.charge(
      this.payload.orderId,
      this.payload.amount,
      this.payload.currency
    )
  }
}
```

## Dispatching jobs

Dispatch a job from anywhere in your application using the static `dispatch` method. The job payload is type-safe, matching the generic parameter defined on the job class.

```ts title="app/controllers/orders_controller.ts"
import ProcessPayment from '#jobs/process_payment'

export default class OrdersController {
  async store({ request, response }: HttpContext) {
    const order = await Order.create(request.body())

    // Dispatch the job for background processing
    await ProcessPayment.dispatch({
      orderId: order.id,
      amount: order.total,
      currency: 'USD',
    })

    return response.created(order)
  }
}
```

### Dispatching jobs from Ace commands

When your application boots for HTTP requests, job files from the `locations` config are loaded automatically. The `queue:work` command also loads them before starting the worker.

Custom Ace commands are different: jobs are not auto-discovered during the console boot lifecycle. If your command dispatches jobs and you use the `sync` adapter locally or in tests, load the configured job locations before dispatching.

```ts title="commands/import_orders.ts"
import { BaseCommand } from '@adonisjs/core/ace'
import ImportOrders from '#jobs/import_orders'

export default class ImportOrdersCommand extends BaseCommand {
  static commandName = 'orders:import'

  static options = {
    startApp: true,
  }

  async run() {
    const queue = await this.app.container.make('queue.manager')

    await queue.loadJobs()

    await ImportOrders.dispatch({
      source: 'warehouse',
    })
  }
}
```

If your command only dispatches jobs to Redis or Database, importing the job class is enough to enqueue it. Calling `queue.loadJobs()` keeps the same command compatible with the `sync` adapter, which executes the job immediately in the current process.

### Dispatch options

The `dispatch` method returns a fluent builder that lets you customize job behavior before sending it to the queue:

```ts title="app/controllers/orders_controller.ts"
// Dispatch to a specific queue with high priority
await ProcessPayment.dispatch({
  orderId: order.id,
  amount: order.total,
  currency: 'USD',
})
  .toQueue('payments')
  .priority(1)
```

::::options

:::option{name=".toQueue(name)" dataType="string"}
Send the job to a specific queue instead of the default one.

```ts
await ProcessPayment.dispatch(payload).toQueue('payments')
```
:::

:::option{name=".priority(level)" dataType="number"}
Set the job priority. Lower numbers are processed first (1 = highest priority, 10 = lowest).

```ts
await ProcessPayment.dispatch(payload).priority(1)
```
:::

:::option{name=".in(delay)" dataType="Duration"}
Delay job execution by a specified duration. Accepts milliseconds or a string like `'5m'`, `'1h'`, `'7d'`.

```ts
// Send a reminder in 24 hours
await SendReminder.dispatch(payload).in('24h')
```
:::

:::option{name=".group(groupId)" dataType="string"}
Assign a group identifier for organizing related jobs. Useful for tracking batch operations.

```ts
await GenerateReport.dispatch(payload).group('monthly-reports-2025')
```
:::

:::option{name=".with(adapter)" dataType="string"}
Use a specific adapter for this job instead of the default one.

```ts
await ProcessPayment.dispatch(payload).with('redis')
```
:::

::::

### Deduplicating jobs

**Job deduplication** prevents multiple single-job dispatches from enqueueing the same work. This is useful when HTTP retries, webhook retries, or repeated button clicks can dispatch the same background task more than once.

The `dedup` method accepts a user-defined `id`. Internally, the queue prefixes it with the job name, so two different job classes can use the same `id` without colliding.

```ts title="app/controllers/orders_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Order from '#models/order'
import ProcessPayment from '#jobs/process_payment'

export default class OrdersController {
  async retryPayment({ params, response }: HttpContext) {
    const order = await Order.findOrFail(params.id)

    const result = await ProcessPayment.dispatch({
      orderId: order.id,
      amount: order.total,
      currency: order.currency,
    })
      .toQueue('payments')
      .dedup({ id: `order:${order.id}`, ttl: '10m' })

    return response.accepted({
      jobId: result.jobId,
      deduped: result.deduped,
    })
  }
}
```

When `.dedup()` is used, the dispatch result includes a `deduped` outcome. Use this value when your controller or service needs to react differently to a skipped or replaced dispatch.

| Outcome | Meaning |
| --- | --- |
| `added` | A new job was inserted |
| `skipped` | A duplicate job already exists and the new dispatch was ignored |
| `replaced` | A pending or delayed duplicate kept its job id, but received the latest payload |
| `extended` | A duplicate was skipped and its deduplication window was refreshed |

Deduplication supports the following dispatch modes:

| Method call | Behavior |
| --- | --- |
| `.dedup({ id })` | Skips duplicates while an existing job with the same key is still present |
| `.dedup({ id, ttl })` | Skips duplicates within a time window |
| `.dedup({ id, ttl, extend: true })` | Skips duplicates and refreshes the time window on each duplicate |
| `.dedup({ id, ttl, replace: true })` | Replaces the payload of an existing pending or delayed job |
| `.dedup({ id, ttl, extend: true, replace: true })` | Debounces dispatches by replacing the payload and refreshing the time window |

The `extend` and `replace` options require a positive `ttl`. When using `replace`, only the job payload is updated. The existing job keeps its queue, priority, delay, and group id. Active jobs and retained completed or failed jobs are skipped instead of being modified.

:::warning
Deduplication is only applied by the Redis and Database adapters for single-job dispatches. The Sync adapter runs every dispatch inline, and batch dispatching or scheduled jobs do not apply deduplication.

Use Redis or Database when duplicate prevention matters. For batch or scheduled workflows, enforce uniqueness in your application logic, database constraints, or a dedicated lock.
:::

The user-provided `id` must be 400 characters or fewer. The final key, built as `<jobName>::<id>`, must be 510 characters or fewer.

### Batch dispatching

When you need to dispatch many jobs of the same type, use `dispatchMany` for better performance. It uses batched operations (Redis pipelines or SQL batch inserts) under the hood.

```ts title="app/services/newsletter_service.ts"
import SendNewsletter from '#jobs/send_newsletter'

export default class NewsletterService {
  async sendToAllSubscribers(subscribers: { email: string }[]) {
    const payloads = subscribers.map((subscriber) => ({
      email: subscriber.email,
      subject: 'Monthly Newsletter',
    }))

    const { jobIds } = await SendNewsletter.dispatchMany(payloads)
      .toQueue('emails')
      .group('newsletter-march-2025')

    console.log(`Dispatched ${jobIds.length} newsletter jobs`)
  }
}
```

## Retries and backoff

When a job throws an error, the queue system automatically retries it according to the configured retry policy. You can configure retries at three levels, with more specific settings taking priority: **job > queue > global**.

At the queue and global levels, you can set retries with the `retry` option or with `maxRetries` and `retry` inside `defaultJobOptions`. The queue system resolves `maxRetries` and the backoff separately, and takes each one from the first place that sets it:

1. The `static options` of the job.
2. The `defaultJobOptions` of the queue.
3. The `retry` option of the queue.
4. The global `defaultJobOptions`.
5. The global `retry` option.

### Backoff strategies

A backoff strategy controls the delay between retry attempts. The package provides four built-in strategies:

```ts title="config/queue.ts"
import { defineConfig, drivers } from '@adonisjs/queue'
import { exponentialBackoff } from '@adonisjs/queue'

export default defineConfig({
  default: 'redis',
  adapters: {
    redis: drivers.redis({ connectionName: 'main' }),
  },
  retry: {
    maxRetries: 3,
    backoff: exponentialBackoff(),
  },
  // ...
})
```

**Exponential backoff** doubles the delay with each attempt: 1s, 2s, 4s, 8s, and so on. This is the recommended strategy for most use cases since it prevents overwhelming failing services.

```ts
import { exponentialBackoff } from '@adonisjs/queue'

// Default: 1s base, 5m max, 2x multiplier, jitter enabled
exponentialBackoff()

// Custom
exponentialBackoff({ baseDelay: '500ms', maxDelay: '1m' })
```

**Linear backoff** increases the delay by the base amount each attempt: 5s, 10s, 15s, 20s, and so on.

```ts
import { linearBackoff } from '@adonisjs/queue'

// Default: 5s base, 2m max
linearBackoff()

// Custom
linearBackoff({ baseDelay: '10s', maxDelay: '5m' })
```

**Fixed backoff** uses the same delay for every retry: 10s, 10s, 10s, and so on.

```ts
import { fixedBackoff } from '@adonisjs/queue'

// Default: 10s
fixedBackoff()

// Custom
fixedBackoff('30s')
```

**Custom backoff** gives you full control over the strategy configuration:

```ts
import { customBackoff } from '@adonisjs/queue'

customBackoff({
  strategy: 'exponential',
  baseDelay: '100ms',
  maxDelay: '30s',
  multiplier: 3,
  jitter: false,
})
```

:::tip
Enable `jitter` on exponential and linear strategies to add randomness to retry delays. This prevents multiple failed jobs from retrying at the exact same time, which can overload downstream services (a pattern known as "thundering herd").
:::

### Per-job retry

You can override the retry configuration for specific jobs:

```ts title="app/jobs/process_payment.ts"
import { Job } from '@adonisjs/queue'
import { exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

export default class ProcessPayment extends Job<ProcessPaymentPayload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: {
      backoff: exponentialBackoff({ baseDelay: '2s', maxDelay: '10m' }),
    },
  }

  async execute() {
    // Payment processing logic
  }
}
```

## Scheduled jobs

Scheduled jobs run automatically at defined intervals or cron expressions. Define your schedules in the `start/scheduler.ts` preload file.

The preload runs every time your HTTP server starts, so every deploy defines your schedules again. This does not reset them. A paused schedule stays paused, and it keeps its run count and its next run unless you change its timing. When a run was missed while the application was stopped, it runs once when a worker starts, as long as the schedule is active and has not reached its run limit or end date.

### Cron schedules

Use a cron expression for precise scheduling:

```ts title="start/scheduler.ts"
import CleanupExpiredSessions from '#jobs/cleanup_expired_sessions'
import GenerateWeeklyReport from '#jobs/generate_weekly_report'

// Run every night at midnight
await CleanupExpiredSessions.schedule({ retentionDays: 30 })
  .cron('0 0 * * *')
  .timezone('Europe/Paris')

// Run every Monday at 9 AM
await GenerateWeeklyReport.schedule({ type: 'weekly' })
  .cron('0 9 * * MON')
  .timezone('America/New_York')
```

### Interval schedules

For simpler use cases, schedule jobs at a fixed interval:

```ts title="start/scheduler.ts"
import SyncInventory from '#jobs/sync_inventory'

// Run every 5 minutes
await SyncInventory.schedule({ source: 'warehouse-api' })
  .every('5m')
```

### Schedule options

The schedule builder supports the following options:

::::options

:::option{name=".cron(expression)" dataType="string"}
A cron expression defining when the job should run. Mutually exclusive with `.every()`.
:::

:::option{name=".every(interval)" dataType="Duration"}
A duration interval between runs. Mutually exclusive with `.cron()`.
:::

:::option{name=".id(scheduleId)" dataType="string"}
A custom identifier for the schedule. Defaults to the job class name. If a schedule with this ID already exists, it is updated and keeps its status, run count, and next run.
:::

:::option{name=".timezone(tz)" dataType="string"}
An IANA timezone for evaluating cron expressions. Defaults to `'UTC'`.
:::

:::option{name=".from(date)" dataType="Date"}
Start boundary. No jobs will be dispatched before this date.
:::

:::option{name=".to(date)" dataType="Date"}
End boundary. No jobs will be dispatched after this date.
:::

:::option{name=".between(from, to)" dataType="Date, Date"}
Shorthand for setting both `.from()` and `.to()`.
:::

:::option{name=".limit(maxRuns)" dataType="number"}
Maximum number of times the schedule will run.
:::

::::

### Managing schedules

You can manage schedules programmatically using the `Schedule` class:

```ts title="app/controllers/admin_controller.ts"
import { Schedule } from '@adonisjs/queue'

export default class AdminController {
  async listSchedules() {
    // List all schedules
    const schedules = await Schedule.list()

    // List only active schedules
    const active = await Schedule.list({ status: 'active' })

    return schedules
  }

  async pauseSchedule({ params }: HttpContext) {
    const schedule = await Schedule.find(params.id)

    if (schedule) {
      await schedule.pause()
    }
  }

  async resumeSchedule({ params }: HttpContext) {
    const schedule = await Schedule.find(params.id)

    if (schedule) {
      await schedule.resume()
    }
  }

  async triggerSchedule({ params }: HttpContext) {
    const schedule = await Schedule.find(params.id)

    if (schedule) {
      // Immediately dispatch the scheduled job
      await schedule.trigger()
    }
  }

  async deleteSchedule({ params }: HttpContext) {
    const schedule = await Schedule.find(params.id)

    if (schedule) {
      await schedule.delete()
    }
  }
}
```

### Scheduler Ace commands

The package provides Ace commands for managing schedules from the terminal:

```sh
# List all scheduled jobs
node ace queue:scheduler:list

# List only active schedules
node ace queue:scheduler:list --status=active

# Remove a specific schedule
node ace queue:scheduler:remove <schedule-id>

# Remove all schedules
node ace queue:scheduler:clear
```

These commands read the schedules of the default adapter. Use the `--adapter` flag (or `-a`) to read the schedules stored on another adapter.

```sh
node ace queue:scheduler:list --adapter=database
```

## Running the worker

Jobs are not processed until you start a worker. The worker is a long-running process that polls the queue for available jobs and executes them.

Workers also send heartbeats for active jobs. These heartbeats renew the job ownership timestamp while the handler is still running, so healthy long-running jobs are not recovered as stalled just because they run longer than `stalledThreshold`. A worker can only renew jobs it still owns, so a late heartbeat cannot extend a job that was already recovered by another worker.

Start the worker using the `queue:work` Ace command:

```sh
node ace queue:work
```

### Worker options

```sh
# Process specific queues
node ace queue:work --queue=payments,emails

# Process the default queue and every queue defined in the config
node ace queue:work --all-queues

# Set concurrency (number of jobs processed simultaneously)
node ace queue:work --concurrency=10

# Process jobs from a specific adapter
node ace queue:work --adapter=database
```

::::options

:::option{name="--queue (-q)" dataType="string"}
A comma-separated list of queues to process. Defaults to the `default` queue. You cannot combine it with `--all-queues`.
:::

:::option{name="--all-queues" dataType="boolean"}
Process the `default` queue and every queue defined in the `queues` config.
:::

:::option{name="--concurrency (-c)" dataType="number"}
The number of jobs to process simultaneously. Must be a positive integer. Overrides `worker.concurrency` from the config.
:::

:::option{name="--adapter (-a)" dataType="string"}
The adapter to process jobs from. Defaults to the `default` adapter. A worker processes jobs from a single adapter, so start one worker for each adapter that stores jobs.
:::

:::option{name="--hmr" dataType="boolean"}
Run the worker with hot-hook, so changed jobs reload without restarting the worker. Use it during development only. See [Reloading jobs during development](#reloading-jobs-during-development).
:::

::::

:::warning
You must start the worker as a separate process alongside your web server. Jobs dispatched from your application will not be processed until a worker is running.

In production, use a process manager like [PM2](https://pm2.keymetrics.io/) or a container orchestrator to keep the worker running and restart it on failure.
:::

When the worker cannot start, the command prints the reason and exits with status `1`. This happens when you combine `--queue` with `--all-queues`, pass an `--adapter` that is not configured, pass a `--concurrency` that is not a positive integer, or set an invalid option in the `worker` config. Your process manager sees the failure instead of a worker that never processes jobs.

When the worker receives `SIGTERM` or `SIGINT`, it stops picking up new jobs and waits for every running job to finish before it closes the Redis and database connections. Your process manager can stop a worker during a deploy without a job running twice. Configure the stop timeout of your process manager to be longer than your slowest job, otherwise it kills the worker before the jobs finish.

Run one worker per process. Starting a second worker in a process where a worker is already running throws an error.

### Reloading jobs during development

By default, a running worker keeps the version of your jobs it loaded at startup, and you must restart it after every change. Start the worker with the `--hmr` flag to reload jobs as you edit them:

```sh
node ace queue:work --hmr
```

The worker runs with [hot-hook](https://github.com/Julien-R44/hot-hook), the same way `node ace serve --hmr` runs your HTTP server. A changed job is imported again on its next execution, and a job that is already running finishes with the version it started with. When you change a file hot-hook cannot reload, such as a config file, the worker waits for its running jobs to finish and restarts. Adding, removing, or renaming a job requires a manual restart, because the worker builds its list of jobs at startup.

The same applies to jobs that run inside your HTTP server, such as with the Sync adapter, when you start it with `node ace serve --hmr`. The queue system enables the [`hotReload`](#configuration) option whenever the process runs with hot-hook. Set `hotReload` in your config to override this behavior.

### Worker configuration

Configure worker behavior in your `config/queue.ts` file:

```ts title="config/queue.ts"
export default defineConfig({
  // ...
  worker: {
    concurrency: 5,
    idleDelay: '2s',
    stalledThreshold: '30s',
    stalledInterval: '30s',
    maxStalledCount: 1,
    gracefulShutdown: true,
  },
})
```

::::options

:::option{name="concurrency" dataType="number"}
Maximum number of jobs processed simultaneously. Defaults to `1`.
:::

:::option{name="idleDelay" dataType="Duration"}
How long the worker waits before polling again when no jobs are available. Defaults to `'2s'`.
:::

:::option{name="timeout" dataType="Duration"}
Global maximum execution time for any job. The `timeout` of a job or of `defaultJobOptions` takes precedence. No timeout by default.
:::

:::option{name="stalledThreshold" dataType="Duration"}
How long a job can go without a heartbeat before it is considered stalled. This is a crash-detection window, not a maximum job runtime. Use `timeout` or `JobOptions.timeout` when you want to limit how long a job may run. Defaults to `'30s'`.
:::

:::option{name="stalledInterval" dataType="Duration"}
How often the worker checks for stalled jobs. Defaults to `'30s'`.
:::

:::option{name="maxStalledCount" dataType="number"}
Maximum number of times a stalled job can be recovered before it is permanently failed. The job then fails through its `failed` method. Defaults to `1`.
:::

:::option{name="unknownJobRetries" dataType="number"}
How many times a job whose class the worker does not know goes back to the queue before it fails. During a rolling deploy, a worker running the previous version can pick up a job that only the new version defines. The job runs again 30 seconds later, giving the new workers time to start. Set it to `0` to fail these jobs immediately. Defaults to `10`.
:::

:::option{name="gracefulShutdown" dataType="boolean"}
When `true`, the worker stops on SIGINT/SIGTERM signals and waits for running jobs to finish before exiting. Defaults to `true`.
:::

::::

## Upgrading the queue storage

A new version of the package can change how the adapters store jobs and schedules. After updating `@adonisjs/queue`, run the `queue:migrate` command to upgrade the storage created by the previous version:

```sh
node ace queue:migrate
```

The command upgrades every configured adapter. Each step checks whether it is needed, so the command does nothing on a storage that is already up to date, such as the tables created by a fresh install. It handles the following changes:

- On Redis, it moves the schedules to their new keys.
- On SQL adapters, it converts the dates of the schedules table to epoch milliseconds and adds the unique index used by [job deduplication](#deduplicating-jobs). On MySQL, it also converts the payload and error columns to `LONGTEXT`.

:::warning
Stop every process running the previous version before running the command. That includes the workers and your HTTP server, which dispatches jobs and defines schedules. Then run `queue:migrate` before you start the new workers and HTTP server. Until the storage is migrated, a worker using SQL tables of the previous version processes no job, and the schedules stored on Redis by the previous version stay invisible. You cannot go back to the previous version once the storage is migrated.

On MySQL, converting the columns to `LONGTEXT` copies each table and blocks writes to it until the copy completes. Plan for a short downtime on large tables.
:::

Older versions stored the schedule dates without a time zone when using MySQL, or the Kysely driver with PostgreSQL. In that case, the command stops with an error and asks for the `--timezone` flag. Pass the time zone the previous version wrote the dates in, which is the time zone of your application process unless you configured the database driver otherwise. If you set the mysql2 `timezone: 'Z'` option, pass `UTC`.

```sh
node ace queue:migrate --timezone=Europe/Paris
```

Get this value right. The command drops the old date columns, and a wrong time zone shifts every schedule date for good.

The command can only upgrade the tables of adapters created with `drivers.database()` or `drivers.kysely()`, because these drivers know the connection to use. For an adapter you created with the `knex()` or `kysely()` functions of `@boringnode/queue`, the command only checks the schedule dates and prints a warning. Upgrade these tables yourself with the schema service of the adapter, inside a migration for example.

```ts title="database/migrations/xxxx_upgrade_queue_tables.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'
import { KnexQueueSchemaService } from '@adonisjs/queue/drivers/knex_adapter'

export default class extends BaseSchema {
  async up() {
    const schemaService = new KnexQueueSchemaService(this.db.getWriteClient())

    if (await schemaService.needsScheduleDatesMigration('queue_schedules')) {
      // The timezone is only used on MySQL, where dates have no time zone
      await schemaService.migrateScheduleDates('queue_schedules', { timezone: 'Europe/Paris' })
    }

    await schemaService.migrateTextColumns({
      jobsTable: 'queue_jobs',
      schedulesTable: 'queue_schedules',
    })
    await schemaService.addDedupColumns('queue_jobs')
  }
}
```

With Kysely, use `KyselyQueueSchemaService` from `@adonisjs/queue/drivers/kysely_adapter`. It provides the same methods.

::::options

:::option{name="--adapter (-a)" dataType="string"}
The name of the adapter to migrate. Defaults to every configured adapter.
:::

:::option{name="--timezone" dataType="string"}
The IANA time zone the previous version wrote the schedule dates in, such as `Europe/Paris`. Required only when the dates are stored without a time zone.
:::

:::option{name="--database-timezone" dataType="string"}
MySQL only. The session time zone of the connections used by the previous version, such as `+02:00`, when it differs from the one of the migration connection.
:::

:::option{name="--force" dataType="boolean"}
Skip the confirmation prompt the command shows in production.
:::

::::

## OpenTelemetry

:::warning
The OpenTelemetry integration is experimental. Its API may change in future releases.
:::

The `@adonisjs/queue/otel` entry point exports a `QueueInstrumentation` class that traces your jobs. It creates a **producer** span every time a job is dispatched and a **consumer** span every time a worker executes it, following the OpenTelemetry messaging semantic conventions. Spans you create inside `execute()`, such as database queries or HTTP calls, become children of the consumer span, so you can follow a job from the request that dispatched it to the queries it ran.

If you use [@adonisjs/otel](/guides/digging-deeper/opentelemetry), register the instrumentation inside `config/otel.ts`. The `manuallyRegister` call hooks into the queue manager before it is initialized, which is how the instrumentation attaches the job context to the spans created during execution.

```ts title="config/otel.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/otel'
import { QueueManager } from '@adonisjs/queue'
import { QueueInstrumentation } from '@adonisjs/queue/otel'

const queueInstrumentation = new QueueInstrumentation({
  /**
   * 'link' (default) starts a new trace for each job execution
   * and links it to the dispatch span. 'parent' makes the
   * execution a child of the dispatch span, in the same trace.
   */
  executionSpanLinkMode: 'link',
})
queueInstrumentation.manuallyRegister({ QueueManager })

export default defineConfig({
  serviceName: env.get('APP_NAME'),
  serviceVersion: env.get('APP_VERSION'),
  environment: env.get('APP_ENV'),
  instrumentations: {
    '@adonisjs/queue': queueInstrumentation,
  },
})
```

:::warning
The worker runs through `bin/console.ts`, which does not load OpenTelemetry by default. Without it, you will only see producer spans. Import the `otel.ts` file at the top of `bin/console.ts` to trace job executions as well.

```ts title="bin/console.ts"
import '../otel.js' // [!code ++]
```
:::

## Testing

The package provides a fake adapter that records dispatched jobs in memory and exposes assertion helpers. This lets you verify that your application dispatches the right jobs without actually processing them.

### Faking the queue

Use `QueueManager.fake()` to replace all adapters with the fake adapter, and `QueueManager.restore()` to revert back:

```ts title="tests/functional/orders.spec.ts"
import { test } from '@japa/runner'
import { QueueManager } from '@adonisjs/queue'
import ProcessPayment from '#jobs/process_payment'

test.group('Orders', (group) => {
  group.each.teardown(() => {
    QueueManager.restore()
  })

  test('dispatches a payment job when creating an order', async ({ client }) => {
    const fake = QueueManager.fake()

    const response = await client.post('/orders').json({
      product_id: 1,
      quantity: 2,
    })

    response.assertStatus(201)

    // Assert the job was dispatched
    fake.assertPushed(ProcessPayment)

    // Assert with payload matching
    fake.assertPushed(ProcessPayment, {
      payload: { orderId: 1, amount: 100, currency: 'USD' },
    })
  })

  test('does not dispatch a payment job for free orders', async ({ client }) => {
    const fake = QueueManager.fake()

    await client.post('/orders').json({
      product_id: 1,
      quantity: 0,
    })

    fake.assertNotPushed(ProcessPayment)
  })
})
```

:::note
The fake adapter passes payloads through JSON, like the real adapters. A payload holding a `Date` is recorded with a string, so compare it with `date.toISOString()` in your assertions.
:::

### Assertion methods

The fake adapter provides the following assertion methods:

::::options

:::option{name="assertPushed(job, query?)" dataType="void"}
Assert that a job was dispatched. Optionally filter by queue, payload, or delay.

```ts
fake.assertPushed(ProcessPayment)
fake.assertPushed(ProcessPayment, { queue: 'payments' })
fake.assertPushed(ProcessPayment, {
  payload: { orderId: 1 },
})
```
:::

:::option{name="assertNotPushed(job, query?)" dataType="void"}
Assert that a job was not dispatched.

```ts
fake.assertNotPushed(SendEmail)
```
:::

:::option{name="assertPushedCount(count, options?)" dataType="void"}
Assert the total number of dispatched jobs, optionally filtered by queue.

```ts
fake.assertPushedCount(3)
fake.assertPushedCount(2, { queue: 'emails' })
```
:::

:::option{name="assertNothingPushed()" dataType="void"}
Assert that no jobs were dispatched at all.

```ts
fake.assertNothingPushed()
```
:::

::::

### Advanced matching

You can use functions for more complex payload matching:

```ts title="tests/functional/newsletter.spec.ts"
import { test } from '@japa/runner'
import { QueueManager } from '@adonisjs/queue'
import SendNewsletter from '#jobs/send_newsletter'

test('dispatches newsletter jobs for all subscribers', async ({ client }) => {
  const fake = QueueManager.fake()

  await client.post('/newsletters/send')

  // Match with a function
  fake.assertPushed(SendNewsletter, {
    payload: (payload) => payload.email.endsWith('@example.com'),
  })

  // Check delay
  fake.assertPushed(SendNewsletter, {
    delay: (delay) => delay !== undefined && delay > 0,
  })
})
```
