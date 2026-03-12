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
- Delay jobs, set priorities, and dispatch in batches
- Configure retry strategies with exponential, linear, or fixed backoff
- Schedule recurring jobs using cron expressions or intervals
- Start workers to process jobs from queues
- Test job dispatching with the fake adapter

## Overview

Web applications often need to perform tasks that are too slow or resource-intensive to run during an HTTP request. Sending emails, generating reports, processing payments, or resizing images are all examples of work that should happen in the background so your users get an immediate response.

The `@adonisjs/queue` package provides a job queue system for AdonisJS, built on top of [@boringnode/queue](https://github.com/boringnode/queue). You define **jobs** as classes with typed payloads, dispatch them from your application code, and run a separate **worker** process that picks up and executes those jobs.

The package supports multiple backends. The **Redis** adapter is recommended for production, offering atomic operations and high throughput. The **Database** adapter uses your existing SQL database (PostgreSQL, MySQL, or SQLite) through Lucid. A **Sync** adapter is also available for development and testing, executing jobs immediately without a separate worker.

## Installation

Install and configure the package using the following command:

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
        () => import('#start/scheduler')
      ]
    }
    ```

3. Creates the `config/queue.ts` file.
4. Creates the `start/scheduler.ts` preload file for defining scheduled jobs.
5. Defines the `QUEUE_DRIVER` environment variable and its validation.
6. If you select the database driver, creates a migration to set up queue tables.

:::

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
Per-queue configuration allowing you to set different retry policies or default job options for specific queues.

```ts title="config/queue.ts"
{
  queues: {
    emails: {
      retry: {
        maxRetries: 5,
      },
    },
  },
}
```
:::

:::option{name="defaultJobOptions" dataType="JobOptions"}
Default options applied to all jobs. Individual jobs can override these in their `static options` property.
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
      connectionName: 'primary',
    }),
  },
  // ...
})
```

When selecting the database driver during installation, a migration is automatically created. If you need to create the tables manually, use `QueueSchemaService`:

```ts title="database/migrations/xxxx_create_queue_tables.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'
import { QueueSchemaService } from '@boringnode/queue'

export default class extends BaseSchema {
  async up() {
    const schemaService = new QueueSchemaService(this.db.getWriteClient())

    await schemaService.createJobsTable()
    await schemaService.createSchedulesTable()
  }

  async down() {
    const schemaService = new QueueSchemaService(this.db.getWriteClient())

    await schemaService.dropSchedulesTable()
    await schemaService.dropJobsTable()
  }
}
```

You must have `@adonisjs/lucid` installed and configured for this adapter to work.

#### Sync

The Sync adapter executes jobs immediately in the same process, without a separate worker. This is useful for development and testing when you want to see job results right away.

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
Maximum number of retry attempts before the job fails permanently. Defaults to `3`.
:::

:::option{name="priority" dataType="number"}
Job priority from 1 to 10. Lower numbers are processed first. Defaults to `5`.
:::

:::option{name="timeout" dataType="Duration"}
Maximum execution time before the job is timed out. Accepts a number in milliseconds or a duration string like `'30s'` or `'5m'`. No timeout by default.
:::

:::option{name="failOnTimeout" dataType="boolean"}
Whether to mark the job as permanently failed on timeout. When `false`, the job is retried instead. Defaults to `true`.
:::

:::option{name="retry" dataType="RetryConfig"}
Retry configuration specific to this job, overriding global and queue-level settings. See [Retries and backoff](#retries-and-backoff).
:::

:::option{name="removeOnComplete" dataType="JobRetention"}
Controls whether completed jobs are kept in the history. Set to `true` to remove immediately (default), `false` to keep forever, or an object with `age` and/or `count` constraints.

```ts
{ removeOnComplete: { age: '7d', count: 1000 } }
```
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
A custom identifier for the schedule. Defaults to the job class name. If a schedule with this ID already exists, it will be updated.
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

## Running the worker

Jobs are not processed until you start a worker. The worker is a long-running process that polls the queue for available jobs and executes them.

Start the worker using the `queue:work` Ace command:

```sh
node ace queue:work
```

### Worker options

```sh
# Process specific queues
node ace queue:work --queue=payments,emails

# Set concurrency (number of jobs processed simultaneously)
node ace queue:work --concurrency=10
```

:::warning
You must start the worker as a separate process alongside your web server. Jobs dispatched from your application will not be processed until a worker is running.

In production, use a process manager like [PM2](https://pm2.keymetrics.io/) or a container orchestrator to keep the worker running and restart it on failure.
:::

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
Global maximum execution time for any job. Can be overridden per job via `JobOptions.timeout`. No timeout by default.
:::

:::option{name="stalledThreshold" dataType="Duration"}
How long a job can run before it is considered stalled (the worker may have crashed). Defaults to `'30s'`.
:::

:::option{name="stalledInterval" dataType="Duration"}
How often the worker checks for stalled jobs. Defaults to `'30s'`.
:::

:::option{name="maxStalledCount" dataType="number"}
Maximum number of times a stalled job can be recovered before it is permanently failed. Defaults to `1`.
:::

:::option{name="gracefulShutdown" dataType="boolean"}
When `true`, the worker finishes running jobs before stopping on SIGINT/SIGTERM signals. Defaults to `true`.
:::

::::

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
