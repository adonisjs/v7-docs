---
description: Learn how to add health checks to your AdonisJS application for monitoring liveness and readiness in production environments.
---

# Health checks

This guide covers health checks in AdonisJS applications. You will learn how to:

- Understand the difference between liveness and readiness probes
- Configure health checks using the built-in setup command
- Expose endpoints for monitoring services and orchestrators
- Use built-in checks for disk space, memory, database, and Redis
- Cache health check results for performance optimization
- Trace health check execution using diagnostic channels
- Create custom health checks for application-specific needs

## Overview

Health checks allow your application to report its operational status to external systems like load balancers, container orchestrators (Kubernetes, Docker Swarm), and monitoring services. These systems periodically probe your application to determine whether it should receive traffic or be restarted.

AdonisJS provides a health check system built into the core framework with several ready-made checks for common infrastructure concerns. You can also create custom checks for application-specific requirements like verifying external API connectivity or queue connections.

## Liveness vs readiness

Before implementing health checks, it's important to understand the two types of probes and when each should be used.

A **liveness probe** answers the question: "Is the process alive and responsive?" This is a simple check that verifies your application can respond to HTTP requests. If a liveness probe fails repeatedly, the orchestrator will restart the container. Liveness probes should be lightweight and avoid checking external dependencies, since a database outage shouldn't cause your application to enter a restart loop.

A **readiness probe** answers the question: "Is the application ready to accept traffic?" This check verifies that your application and its dependencies (database connections, Redis, external services) are functioning correctly. If a readiness probe fails, the orchestrator removes the instance from the load balancer but does not restart it. This allows the application time to recover, for example, when a database connection is temporarily unavailable.

| Probe | Purpose | On failure | Should check dependencies |
|-------|---------|------------|---------------------------|
| Liveness | Is the process alive? | Restart container | No |
| Readiness | Can it handle requests? | Remove from load balancer | Yes |

## Configuring health checks

Run the following command to set up health checks in your application. This creates the configuration file and a controller with both liveness and readiness endpoints.

```sh
node ace configure health_checks
```

The command creates two files. The first is the health checks configuration where you register which checks to run.

```ts title="start/health.ts"
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
])
```

The second is a controller that exposes both probe endpoints.

```ts title="app/controllers/health_checks_controller.ts"
import { healthChecks } from '#start/health'
import type { HttpContext } from '@adonisjs/core/http'

export default class HealthChecksController {
  /**
   * Liveness probe: Returns 200 if the process is running.
   * Does not check dependencies.
   */
  async live({ response }: HttpContext) {
    return response.ok()
  }

  /**
   * Readiness probe: Runs all registered health checks
   * and returns the detailed report.
   */
  async ready({ response }: HttpContext) {
    const report = await healthChecks.run()
    if (report.isHealthy) {
      return response.ok(report)
    }

    return response.serviceUnavailable(report)
  }
}
```

The liveness method simply returns a 200 status code, proving the process is alive and can handle HTTP requests. The readiness method runs all registered health checks and returns 200 when healthy or 503 (Service Unavailable) when any check fails.

## Exposing endpoints

Register the health check routes in your routes file. Using separate paths for each probe allows orchestrators to configure them independently.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/health/live', [controllers.HealthChecks, 'live'])
router.get('/health/ready', [controllers.HealthChecks, 'ready'])
```

With these routes in place, your monitoring system can probe `/health/live` for liveness and `/health/ready` for readiness checks.

### Understanding the readiness report

The readiness endpoint returns a detailed JSON report containing the results of all registered checks.

```json
{
  "isHealthy": true,
  "status": "warning",
  "finishedAt": "2024-06-20T07:09:35.275Z",
  "debugInfo": {
    "pid": 16250,
    "ppid": 16051,
    "platform": "darwin",
    "uptime": 16.271809083,
    "version": "v21.7.3"
  },
  "checks": [
    {
      "name": "Disk space check",
      "isCached": false,
      "message": "Disk usage is 76%, which is above the threshold of 75%",
      "status": "warning",
      "finishedAt": "2024-06-20T07:09:35.275Z",
      "meta": {
        "sizeInPercentage": {
          "used": 76,
          "failureThreshold": 80,
          "warningThreshold": 75
        }
      }
    },
    {
      "name": "Memory heap check",
      "isCached": false,
      "message": "Heap usage is under defined thresholds",
      "status": "ok",
      "finishedAt": "2024-06-20T07:09:35.265Z",
      "meta": {
        "memoryInBytes": {
          "used": 41821592,
          "failureThreshold": 314572800,
          "warningThreshold": 262144000
        }
      }
    }
  ]
}
```

The report contains the following properties:

::::options
:::option{name="isHealthy"}
Boolean indicating whether all checks passed. Set to `false` if one or more checks fail.
:::

:::option{name="status"}
Overall status: `ok` (all passed), `warning` (warnings present), or `error` (failures present).
:::

:::option{name="finishedAt"}
Timestamp when the checks completed.
:::

:::option{name="debugInfo"}
Process information including PID, platform, uptime in seconds, and Node.js version.
:::

:::option{name="checks"}
Array containing the detailed result of each registered check.

Each check in the `checks` array includes its name, status, message, whether the result was cached, and any metadata specific to that check type.
:::
::::

### Protecting the readiness endpoint

The readiness report contains detailed information about your infrastructure that you may not want exposed publicly. You can protect the endpoint using a secret header that your monitoring system includes with each request.

Kubernetes and most monitoring tools support custom HTTP headers on probe requests, so you can configure them to include your secret.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/health/live', [controllers.HealthChecks, 'live'])
router
  .get('/health/ready', [controllers.HealthChecks, 'ready'])
  // [!code ++:6]
  .use(({ request, response }, next) => {
    if (request.header('x-monitoring-secret') === 'some_secret_value') {
      return next()
    }
    return response.unauthorized({ message: 'Unauthorized access' })
  })
```

In Kubernetes, configure the probe to include the header.

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3333
    httpHeaders:
      - name: x-monitoring-secret
        value: some_secret_value
```

## Available health checks

AdonisJS provides several built-in health checks that you can register in your `start/health.ts` file.

### DiskSpaceCheck

Monitors available disk space and reports warnings or errors when usage exceeds configured thresholds.

```ts title="start/health.ts"
import { HealthChecks, DiskSpaceCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck()
])
```

The default warning threshold is 75% and the failure threshold is 80%. You can customize these values.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck()
    .warnWhenExceeds(80)
    .failWhenExceeds(90),
])
```

### MemoryHeapCheck

Monitors the heap size reported by `process.memoryUsage()` and alerts when memory consumption exceeds thresholds.

```ts title="start/health.ts"
import { HealthChecks, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new MemoryHeapCheck()
])
```

The default warning threshold is 250MB and the failure threshold is 300MB. You can customize these values using human-readable strings.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new MemoryHeapCheck()
    .warnWhenExceeds('300 mb')
    .failWhenExceeds('700 mb'),
])
```

Fixed byte values don't adapt when you run the same application on machines with different memory limits. In that case, define the thresholds as a percentage of the V8 heap size limit (configurable with the `--max-old-space-size` Node.js flag) instead.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new MemoryHeapCheck()
    .warnWhenExceedsPercentage(80)
    .failWhenExceedsPercentage(90),
])
```

When percentage thresholds are set, the check reports `sizeInPercentage` and `heapInBytes` in its metadata instead of `memoryInBytes`.

### MemoryRSSCheck

Monitors the Resident Set Size (total memory allocated for the process) reported by `process.memoryUsage()`.

```ts title="start/health.ts"
import { HealthChecks, MemoryRSSCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new MemoryRSSCheck()
])
```

The default warning threshold is 320MB and the failure threshold is 350MB.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new MemoryRSSCheck()
    .warnWhenExceeds('600 mb')
    .failWhenExceeds('800 mb'),
])
```

You can also define the thresholds as a percentage of the total system memory reported by `os.totalmem()`.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new MemoryRSSCheck()
    .warnWhenExceedsPercentage(70)
    .failWhenExceedsPercentage(85),
])
```

:::warning
Inside a container, `os.totalmem()` returns the memory of the host machine, not the container's memory limit. Use byte thresholds matching your container limit when running in Kubernetes or Docker.
:::

### DbCheck

Provided by the `@adonisjs/lucid` package, this check verifies connectivity to your SQL database.

```ts title="start/health.ts"
import db from '@adonisjs/lucid/services/db'
import { DbCheck } from '@adonisjs/lucid/database'
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  // [!code ++:1]
  new DbCheck(db.connection()),
])
```

A successful check returns a report like this.

```json
{
  "name": "Database health check (postgres)",
  "isCached": false,
  "message": "Successfully connected to the database server",
  "status": "ok",
  "finishedAt": "2024-06-20T07:18:23.830Z",
  "meta": {
    "connection": {
      "name": "postgres",
      "dialect": "postgres"
    }
  }
}
```

To monitor multiple database connections, register the check once for each connection.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  // [!code ++:3]
  new DbCheck(db.connection()),
  new DbCheck(db.connection('mysql')),
  new DbCheck(db.connection('pg')),
])
```

### DbConnectionCountCheck

Monitors active database connections and alerts when the count exceeds thresholds. This check is supported for PostgreSQL and MySQL databases only.

```ts title="start/health.ts"
import db from '@adonisjs/lucid/services/db'
import { DbCheck, DbConnectionCountCheck } from '@adonisjs/lucid/database'
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  new DbCheck(db.connection()),
  // [!code ++:1]
  new DbConnectionCountCheck(db.connection()),
])
```

The default warning threshold is 10 connections and the failure threshold is 15 connections.

```ts title="start/health.ts"
new DbConnectionCountCheck(db.connection())
  .warnWhenExceeds(4)
  .failWhenExceeds(10)
```

### RedisCheck

Provided by the `@adonisjs/redis` package, this check verifies connectivity to your Redis server, including cluster configurations.

```ts title="start/health.ts"
import redis from '@adonisjs/redis/services/main'
import { RedisCheck } from '@adonisjs/redis'
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  // [!code ++:1]
  new RedisCheck(redis.connection()),
])
```

To monitor multiple Redis connections, register the check once for each connection.

```ts title="start/health.ts"
export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  // [!code ++:3]
  new RedisCheck(redis.connection()),
  new RedisCheck(redis.connection('cache')),
  new RedisCheck(redis.connection('locks')),
])
```

### RedisMemoryUsageCheck

Monitors memory consumption on the Redis server and alerts when usage exceeds thresholds.

```ts title="start/health.ts"
import redis from '@adonisjs/redis/services/main'
import { RedisCheck, RedisMemoryUsageCheck } from '@adonisjs/redis'
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  new RedisCheck(redis.connection()),
  // [!code ++:1]
  new RedisMemoryUsageCheck(redis.connection()),
])
```

The default warning threshold is 100MB and the failure threshold is 120MB.

```ts title="start/health.ts"
new RedisMemoryUsageCheck(redis.connection())
  .warnWhenExceeds('200 mb')
  .failWhenExceeds('240 mb')
```

## Caching results

Health checks run every time the readiness endpoint is called. For checks that don't need to run on every request (like disk space, which changes slowly), you can cache results for a specified duration.

```ts title="start/health.ts"
import {
  HealthChecks,
  MemoryRSSCheck,
  DiskSpaceCheck,
  MemoryHeapCheck,
} from '@adonisjs/core/health'

export const healthChecks = new HealthChecks().register([
  // [!code ++:1]
  new DiskSpaceCheck().cacheFor('1 hour'),
  new MemoryHeapCheck(),
  new MemoryRSSCheck(),
])
```

In this example, the disk space check runs at most once per hour, returning the cached result for subsequent requests. Memory checks run on every request since memory usage can change rapidly.

When a result is served from cache, the `isCached` property in the check's report will be `true`.

Cached results are stored by check name. If you register the same check more than once, for example to monitor two disks, give each instance a unique name using the `as` method so their results don't overwrite each other.

```ts title="start/health.ts"
const uploadsDisk = new DiskSpaceCheck().as('Uploads disk space check').cacheFor('1 hour')
uploadsDisk.diskPath = '/mnt/uploads'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck().cacheFor('1 hour'),
  uploadsDisk,
])
```

## Creating custom health checks

You can create custom health checks to verify application-specific requirements like external API connectivity, message queue connections, or business-critical service availability.

A custom health check is a class that extends `BaseCheck` and implements the `run` method. You can place custom checks anywhere in your project, though `app/health_checks/` is a sensible location.

```ts title="app/health_checks/payment_gateway_check.ts"
import { Result, BaseCheck } from '@adonisjs/core/health'
import type { HealthCheckResult } from '@adonisjs/core/types/health'

export class PaymentGatewayCheck extends BaseCheck {
  async run(): Promise<HealthCheckResult> {
    /**
     * Attempt to reach the payment gateway's health endpoint.
     * In a real implementation, you would make an HTTP request
     * to verify the service is reachable.
     */
    const isReachable = await this.checkGatewayConnectivity()

    if (!isReachable) {
      return Result.failed('Payment gateway is unreachable')
    }

    const latency = await this.measureLatency()

    if (latency > 2000) {
      return Result.warning('Payment gateway latency is high').mergeMetaData({
        latencyMs: latency,
      })
    }

    return Result.ok('Payment gateway is healthy').mergeMetaData({
      latencyMs: latency,
    })
  }

  protected async checkGatewayConnectivity(): Promise<boolean> {
    // Implementation here
    return true
  }

  protected async measureLatency(): Promise<number> {
    // Implementation here
    return 150
  }
}
```

The `Result` class provides three factory methods for creating health check results:

| Method | Usage |
|--------|-------|
| `Result.ok(message)` | Check passed successfully |
| `Result.warning(message)` | Check passed but with concerns |
| `Result.failed(message, error?)` | Check failed, optionally include the error |

Use the `mergeMetaData` method to include additional information in the check's report, such as latency measurements, connection counts, or version numbers.

### Registering custom health checks

Import your custom check in `start/health.ts` and register it with the others.

```ts title="start/health.ts"
import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/core/health'
// [!code ++:1]
import { PaymentGatewayCheck } from '#health_checks/payment_gateway_check'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck().cacheFor('1 hour'),
  new MemoryHeapCheck(),
  // [!code ++:1]
  new PaymentGatewayCheck(),
])
```

Your custom check will now run alongside the built-in checks whenever the readiness endpoint is called.

## Tracing health checks

Every check executed by `healthChecks.run()` is wrapped in the `adonisjs.health.check` [diagnostic tracing channel](https://nodejs.org/api/diagnostics_channel.html#class-tracingchannel). You can subscribe to it to measure how long each check takes or to report checks that throw an exception to your monitoring tools. Cached results are not traced, since the check does not run.

The context object passed to each event contains the `check` instance being executed. Use the `HealthCheckTracingData` type to get type-safety when subscribing to the channel.

```ts title="start/health_tracing.ts"
import diagnostics_channel from 'node:diagnostics_channel'
import logger from '@adonisjs/core/services/logger'
import type { HealthCheckTracingData } from '@adonisjs/core/types/health'

const healthCheckChannel = diagnostics_channel.tracingChannel<HealthCheckTracingData>(
  'adonisjs.health.check'
)
const startTimes = new WeakMap<HealthCheckTracingData, number>()

healthCheckChannel.subscribe({
  start(data) {
    startTimes.set(data, performance.now())
  },
  end() {},
  asyncStart() {},
  asyncEnd(data) {
    const duration = performance.now() - startTimes.get(data)!
    logger.info({ duration }, `health check "${data.check.name}" finished`)
  },
  error(data) {
    logger.error({ err: data.error }, `health check "${data.check.name}" threw an error`)
  },
})
```

You can create this file using the `node ace make:preload health_tracing` command, which also registers it as a [preload file](../../reference/adonisrc_file.md#preloads) inside the `adonisrc.ts` file. This ensures the subscription is active before any check runs.
