---
description: Learn how testing is configured in AdonisJS applications using Japa, and how to create, run, and filter tests.
---

# Introduction to testing

This guide covers the testing setup in AdonisJS applications. You will learn:

- About Japa, the testing framework used by AdonisJS
- How testing is configured through suites and plugins
- How to create and run your first test
- How to filter tests by file, name, tags, or suite
- How to use watch mode for rapid development
- How to split tests across parallel CI jobs using shards
- How to override environment variables for testing

## Overview

AdonisJS has built-in support for testing, and all starter kits come pre-configured with a complete testing setup. You can start writing tests immediately without any additional configuration.

The testing layer is powered by [Japa](https://japa.dev), a testing framework we've built and maintained for over seven years. Unlike general-purpose test runners like Jest or Vitest, Japa is purpose-built for backend applications. It runs natively in Node.js without transpilers and includes plugins specifically designed for backend testing, such as an API client for testing JSON endpoints and a filesystem plugin for managing temporary files during tests.

We chose to build and maintain our own testing framework to avoid the churn that's common in the JavaScript ecosystem. Having seen the community shift from Mocha to Jest to Vitest, we're glad we invested in tooling we control and can evolve alongside AdonisJS.

## Japa and AdonisJS integration

Japa integrates deeply with AdonisJS through the `@japa/plugin-adonisjs` package. This plugin extends Japa with AdonisJS-specific utilities, giving your tests access to the application instance, route helpers for computing URLs, and methods for reading and writing cookies during HTTP and browser tests.

The integration means you write tests that feel native to AdonisJS rather than bolting on a generic test runner that doesn't understand your application's structure.

## Project structure

AdonisJS organizes tests into suites, where each suite represents a category of tests with its own configuration. A typical project structure looks like this.

```sh
tests/
├── bootstrap.ts
├── unit/
│   └── posts_service.spec.ts
└── browser/
    └── posts.spec.ts
```

The `tests/bootstrap.ts` file configures Japa plugins and lifecycle hooks. Individual test files live in suite directories, and each suite can have different timeouts, plugins, and setup logic appropriate for that type of testing.

### Understanding suites

A test suite groups related tests that share common characteristics. For example, unit tests run quickly and don't need an HTTP server, while browser tests require a running server and have longer timeouts to account for browser automation.

Hypermedia and Inertia starter kits come with two suites pre-configured:

- **unit** tests isolated pieces of code like services, utilities, and models
- **browser** tests run end-to-end with Playwright, simulating real user interactions

Suites are defined in your `adonisrc.ts` file.

```ts title="adonisrc.ts"
{
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.ts'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/browser/**/*.spec.ts'],
        name: 'browser',
        timeout: 300000,
      },
    ],
    forceExit: false,
  }
}
```

Each suite specifies a glob pattern for locating test files, a name for filtering, and a timeout in milliseconds. Browser tests have a much longer timeout (5 minutes) because browser automation is inherently slower than in-process unit tests.

### Configuring plugins and hooks

The `tests/bootstrap.ts` file is where you configure Japa plugins and define lifecycle hooks that run before and after your test suites.

```ts title="tests/bootstrap.ts"
import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import { browserClient } from '@japa/browser-client'
import { authBrowserClient } from '@adonisjs/auth/plugins/browser_client'
import { sessionBrowserClient } from '@adonisjs/session/plugins/browser_client'

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  browserClient({ runInSuites: ['browser'] }),
  sessionBrowserClient(app),
  authBrowserClient(app),
]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
```

The `configureSuite` function allows you to add setup logic specific to certain suites. In this example, browser, functional, and e2e suites automatically start the HTTP server before tests run.

## Creating your first test

Generate a new test file using the `make:test` command.

```sh
node ace make:test posts/index --suite=browser
```

This creates a test file at `tests/browser/posts/index.spec.ts` with the following structure.

```ts title="tests/browser/posts/index.spec.ts"
import { test } from '@japa/runner'

test.group('Posts index', () => {
  test('display a list of all posts', async ({ assert }) => {})
})
```

Tests are organized into groups using `test.group()`, which helps structure related tests and allows you to apply shared setup and teardown logic. Individual tests are defined with `test()` and receive a context object containing utilities like `assert` for making assertions.

## Running tests

Run your entire test suite with the following command.

```sh
node ace test
```

To run a specific suite, pass the suite name as an argument.

```sh
node ace test unit
node ace test browser
```

### Filtering tests

Japa provides several flags for running a subset of tests.

::::options

:::option{name="--tests"}
Filter by exact test title.

```sh
# Run tests with exact title match
node ace test --tests="can list all posts"
```
:::

:::option{name="--files"}
Filter by test filename (matches against the end of the filename without `.spec.ts`). The `--files` flag supports wildcards for running all tests in a directory.

```sh
# Run a specific test file
node ace test --files="posts/index"

# Run all tests in the posts directory
node ace test --files="posts/*"
```
:::

:::option{name="--groups"}
Filter by exact group name.

```sh
# Run all tests in a specific group
node ace test --groups="Posts index"
```
:::

:::option{name="--tags"}
Filter by tags (prefix with `~` to exclude).
:::

:::option{name="--matchAll"}
Require all specified tags to match instead of any.
:::

::::

### Watch mode

During development, use watch mode to automatically re-run tests when files change.

```sh
node ace test --watch
```

When a test file changes, only that file's tests are re-run. When a source file changes, all tests are executed.

:::tip
If you're iterating on a single test, combine watch mode with the `--files` filter. This ensures any file change runs only the tests you're focused on, providing faster feedback.
:::

### Additional flags

Two flags are particularly useful during development.

```sh
# Stop on first failure
node ace test --bail

# Re-run only tests that failed in the last run
node ace test --failed
```

The `--bail` flag helps when debugging a failing test by preventing subsequent tests from running. The `--failed` flag is useful for quickly verifying that your fix resolved all failures without running the entire suite.

### Sharding tests

As your test suite grows, you can split it across multiple processes or CI jobs using the `--shard` flag. The flag accepts the shard to run and the total number of shards in the `current/total` format.

```sh
node ace test --shard=1/3
node ace test --shard=2/3
node ace test --shard=3/3
```

Sharding works at the file level. Japa collects the test files of the selected suites, applies the `--files` filter, and distributes the remaining files across shards in round-robin order. Running every shard from `1` to `total` runs each test file exactly once.

The most common setup is to run each shard as a separate CI job. Following is an example GitHub Actions workflow that splits the tests into four parallel jobs.

```yaml title=".github/workflows/test.yml"
name: test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: node ace test --shard=${{ matrix.shard }}/4
```

Each CI job runs on its own machine, so every shard gets its own database and other services defined within the job.

You can also run shards in parallel on your machine using a tool like [concurrently](https://www.npmjs.com/package/concurrently). However, shards running on the same machine share the same database. Since environment variables defined in the shell take precedence over the `.env.test` file, you can point each shard to a separate database.

```json title="package.json"
{
  "scripts": {
    "test:parallel": "concurrently --group \"DB_DATABASE=app_test_1 node ace test --shard=1/2\" \"DB_DATABASE=app_test_2 node ace test --shard=2/2\""
  }
}
```

:::note
Each database must exist before running the tests. The migrations defined in the `tests/bootstrap.ts` file run separately for every shard.
:::

## Environment variables

AdonisJS automatically loads a `.env.test` file when running tests, merging its values with your standard `.env` file. Any variable defined in `.env.test` overrides the corresponding value from `.env`.

Create a `.env.test` file in your project root to configure test-specific settings.

```dotenv title=".env.test"
SESSION_DRIVER=memory
```

The memory session driver is commonly used in tests because it doesn't persist sessions between requests, ensuring test isolation. Other variables you might override include database connection settings, mail drivers, or any service configuration that should behave differently during testing.

## Next steps

Now that you understand how testing is configured in AdonisJS, explore the specific testing guides:

<!-- - [Unit testing](./unit_tests.md) - Testing services, utilities, and isolated logic -->

- [Browser tests](./browser_tests.md) - Browser testing with Playwright for Hypermedia and Inertia applications
- [Testing APIs](./api_tests.md) - HTTP testing for JSON APIs
- [CLI tests](./console_tests.md) - Testing Ace commands
