---
description: The adonisrc.ts file is used to configure the workspace settings of your application.
---

# AdonisRC file

This guide covers the `adonisrc.ts` configuration file. You will learn how to:

- Register service providers and preload files
- Configure directory paths for scaffolding commands
- Define command aliases for frequently used Ace commands
- Set up assembler hooks for build-time code generation
- Specify meta files to include in production builds
- Configure test suites and runner options

## Overview

The `adonisrc.ts` file serves as the central configuration for your AdonisJS workspace. It controls how the framework boots, where scaffolding commands place generated files, which providers to load, and how the build process behaves.

This file is processed by multiple tools beyond your main application, including the Ace CLI, the Assembler (which handles the dev server and production builds), and various code generators. Because of this broad usage, the file must remain environment-agnostic and free of application-specific logic.

The file contains the minimum required configuration to run your application. You can view the complete expanded configuration, including all defaults, by running the `node ace inspect:rcfile` command.

```sh
node ace inspect:rcfile
```

You can access the parsed RCFile contents programmatically using the `app` service.

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

console.log(app.rcFile)
```

## directories

The `directories` object maps logical directory names to their filesystem paths. Scaffolding commands use these mappings to determine where to place generated files.

If you rename directories in your project structure, update the corresponding paths here so that commands like `node ace make:controller` continue to work correctly.

```ts title="adonisrc.ts"
{
  directories: {
    config: 'config',
    commands: 'commands',
    contracts: 'contracts',
    public: 'public',
    providers: 'providers',
    languageFiles: 'resources/lang',
    migrations: 'database/migrations',
    seeders: 'database/seeders',
    factories: 'database/factories',
    views: 'resources/views',
    start: 'start',
    tmp: 'tmp',
    tests: 'tests',
    httpControllers: 'app/controllers',
    models: 'app/models',
    services: 'app/services',
    exceptions: 'app/exceptions',
    mailers: 'app/mailers',
    mails: 'app/mails',
    middleware: 'app/middleware',
    policies: 'app/policies',
    validators: 'app/validators',
    events: 'app/events',
    listeners: 'app/listeners',
    transformers: 'app/transformers',
    stubs: 'stubs',
    generatedClient: '.adonisjs/client',
    generatedServer: '.adonisjs/server',
  }
}
```

## preloads

The `preloads` array specifies files to import during application boot. These files are imported immediately after service providers have been registered and booted, making them ideal for setup code that needs access to the container but should run before the application starts handling requests.

You can register a preload file to run in all environments or restrict it to specific ones.

| Environment | Description |
|-------------|-------------|
| `web` | The HTTP server process |
| `console` | Ace commands (except `repl`) |
| `repl` | The interactive REPL session |
| `test` | The test runner process |

The simplest form registers a file to run in all environments.

```ts title="adonisrc.ts"
{
  preloads: [
    () => import('#start/view')
  ]
}
```

To restrict a preload file to specific environments, use the object form with an `environment` array.

```ts title="adonisrc.ts"
{
  preloads: [
    {
      file: () => import('#start/view'),
      environment: ['web', 'console', 'test']
    },
  ]
}
```

:::note

You can create and register a preload file using the `node ace make:preload` command.

:::

## providers

The `providers` array lists [service providers](../guides/concepts/service_providers.md) to load during application boot. Providers are loaded in the order they appear in the array, which matters when providers depend on each other.

Like preload files, providers can be registered for all environments or restricted to specific ones using the same environment values: `web`, `console`, `repl`, and `test`.

```ts title="adonisrc.ts"
{
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/http_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('./providers/app_provider.js'),
  ]
}
```

To load a provider only in specific environments, use the object form.

```ts title="adonisrc.ts"
{
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/http_provider'),
      environment: ['web']
    },
    {
      file: () => import('./providers/app_provider.js'),
      environment: ['web', 'console', 'test']
    },
  ]
}
```

See also: [Service providers](../guides/concepts/service_providers.md)

## commands

The `commands` array registers Ace commands from installed packages. Your application's own commands (in the `commands` directory) are discovered automatically and do not need to be registered here.

```ts title="adonisrc.ts"
{
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands')
  ]
}
```

See also: [Creating Ace commands](../guides/ace/creating_commands.md)

## commandsAliases

The `commandsAliases` object creates shortcuts for frequently used commands. This is useful for commands with long names or commands you run often.

```ts title="adonisrc.ts"
{
  commandsAliases: {
    migrate: 'migration:run'
  }
}
```

You can define multiple aliases pointing to the same command.

```ts title="adonisrc.ts"
{
  commandsAliases: {
    migrate: 'migration:run',
    up: 'migration:run'
  }
}
```

See also: [Creating command aliases](../guides/ace/introduction.md#creating-command-aliases)

## hooks

The `hooks` object registers callbacks that run at specific points during the Assembler lifecycle. The Assembler is the tool responsible for running the dev server, creating production builds, running tests, and performing code generation.

Hooks can be defined inline or as lazily-imported modules. They run in a separate process from your AdonisJS application and do not have access to the IoC container or framework services.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'
import { indexEntities } from '@adonisjs/core/app'

export default defineConfig({
  hooks: {
    init: [indexEntities()],
    buildStarting: [() => import('@adonisjs/vite/build_hook')],
  },
})
```

The `indexEntities()` hook generates barrel files for controllers, events, and listeners, enabling lazy-loading and type-safe references. Package hooks like `@adonisjs/vite/build_hook` handle build-time asset compilation.

See also: [Assembler hooks](../guides/concepts/assembler_hooks.md) for a complete reference of available hooks and how to create custom hooks for code generation.

## metaFiles

The `metaFiles` array specifies non-TypeScript files to copy into the `build` folder when creating a production build. This includes templates, language files, and other assets your application needs at runtime.

Each entry accepts a glob pattern and an optional `reloadServer` flag that triggers a dev server restart when matching files change.

| Property | Description |
|----------|-------------|
| `pattern` | A [glob pattern](https://nodejs.org/api/fs.html#fspromisesglobpattern-options) to match files |
| `reloadServer` | Whether to restart the dev server when these files change |

```ts title="adonisrc.ts"
{
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: false
    },
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false
    }
  ]
}
```

## tests

The `tests` object configures the test runner, including global timeout settings and test suite definitions.

```ts title="adonisrc.ts"
{
  tests: {
    timeout: 2000,
    forceExit: false,
    suites: [
      {
        name: 'functional',
        files: ['tests/functional/**/*.spec.ts'],
        timeout: 30000
      }
    ]
  }
}
```

| Property | Description |
|----------|-------------|
| `timeout` | Default timeout in milliseconds for all tests |
| `forceExit` | Whether to force-exit the process after tests complete. Graceful exit is recommended |
| `suites[].name` | A unique identifier for the test suite |
| `suites[].files` | Glob patterns to discover test files |
| `suites[].timeout` | Suite-specific timeout that overrides the global default |

See also: [Introduction to testing](../guides/testing/introduction.md)
