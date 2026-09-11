---
description: Learn how to manage application state during testing in AdonisJS, including database migrations, state cleanup, and test environment configuration.
---

# Resetting state between tests

This guide covers managing application state during testing in AdonisJS. You will learn how to:

- Migrate and seed the database before running tests
- Clean up database state between individual tests using transactions or truncation
- Manage filesystem state with automatic cleanup
- Reset Redis data between tests
- Configure separate test databases using environment overrides

## Overview

Tests that modify application state, such as creating database records, uploading files, or caching data in Redis, need a strategy for resetting that state between test runs. Without proper cleanup, tests can interfere with each other, leading to flaky results that pass or fail depending on execution order.

AdonisJS provides utilities through the `testUtils` service that handle common state management patterns. The general approach is to run database migrations once before all tests, then reset data between individual tests using either transactions or truncation. For filesystem and Redis, similar patterns ensure each test starts with a clean slate.

:::warning
Make sure your test environment is configured to use separate databases and storage systems from your development and production environments. Running tests against production data can result in data loss. You can use the `.env.test` file to override environment variables specifically for tests.
:::

## Database state management

### Migrating the database

Register a global setup hook in `tests/bootstrap.ts` to run migrations before any tests execute. The `testUtils.db().migrate()` method applies all pending migrations to prepare the database schema.

```ts title="tests/bootstrap.ts"
import testUtils from '@adonisjs/core/services/test_utils'

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [() => testUtils.db().migrate()],
  teardown: [],
}
```

If your application uses multiple database connections, pass the connection name to target a specific database.

```ts title="tests/bootstrap.ts"
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    () => testUtils.db().migrate(),
    // [!code highlight]
    () => testUtils.db('tenant').migrate(),
  ],
  teardown: [],
}
```

### Seeding the database

If your tests require seed data, add the `seed()` hook after migration. This runs your database seeders to populate tables with initial data.

```ts title="tests/bootstrap.ts"
import testUtils from '@adonisjs/core/services/test_utils'

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    () => testUtils.db().migrate(),
    // [!code highlight]
    () => testUtils.db().seed(),
  ],
  teardown: [],
}
```

### Cleaning Up between tests

While migrations run once globally, you need to clean up data between individual tests to prevent state from leaking. AdonisJS offers two approaches: global transactions and truncation.

**Global transactions** wrap all database operations within a test inside a transaction, then roll back when the test completes. Nothing is actually persisted to the database, which can result in faster test execution.

```ts title="tests/functional/users.spec.ts"
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('can create a user', async () => {
    // Database changes here are automatically rolled back after the test
  })
})
```

The `wrapInGlobalTransaction()` method returns a cleanup function that Japa calls automatically after each test to roll back the transaction.

**Truncation** clears all data from tables between tests. This approach actually deletes records rather than rolling back transactions.

```ts title="tests/functional/posts.spec.ts"
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Posts', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('can create a post', async () => {
    // Tables are truncated before each test
  })
})
```

Global transactions are generally faster, especially when your database has many tables, since rolling back a transaction is less expensive than truncating every table. Choose the approach that best fits your testing needs.

## Filesystem state management

For tests that create files, use the `@japa/file-system` plugin. This plugin provides a simple API for managing files and automatically cleans them up after each test.

Install the plugin as a dev dependency.

```sh
npm i -D @japa/file-system
```

Register the plugin in your test bootstrap file.

```ts title="tests/bootstrap.ts"
import { fileSystem } from '@japa/file-system'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  // [!code highlight]
  fileSystem(),
]
```

Access the `fs` object within your tests to create files. Any files created through this API are automatically deleted when the test completes.

```ts title="tests/functional/uploads.spec.ts"
import { test } from '@japa/runner'

test('can process an uploaded file', async ({ fs }) => {
  await fs.create('document.pdf', 'file contents')

  // Test your file processing logic
  // The file is automatically cleaned up after the test
})
```

Files are created in a temporary directory managed by the plugin. For more configuration options and advanced usage, see the [Japa file-system plugin documentation](https://japa.dev/docs/plugins/file-system).

## Redis state management

For tests that interact with Redis, flush the test database between tests to ensure a clean state. Use a group setup hook to call `flushdb()` before each test.

```ts title="tests/functional/cache.spec.ts"
import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'

test.group('Cache', (group) => {
  group.each.teardown(async () => {
    await redis.flushdb()
  })

  test('can cache a value', async () => {
    // Redis is empty at the start of each test
  })
})
```

The `flushdb()` command clears all keys in the currently selected Redis database without affecting other databases on the same Redis server. Make sure your test environment is configured to use a different Redis database number than development or production.

## Environment configuration

Use the `.env.test` file to override environment variables specifically for your test environment. This file is automatically loaded when running tests.

```dotenv title=".env.test"
DB_DATABASE=my_app_test
REDIS_DB=1
```

This ensures your tests run against isolated databases without risking your development or production data.
