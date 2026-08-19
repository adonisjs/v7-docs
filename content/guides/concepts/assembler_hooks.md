---
description: Learn how to use Assembler hooks during development, testing, builds, and code generation.
---

# Assembler hooks

This guide covers Assembler hooks in AdonisJS. You will learn how to:

- Register hooks for development, testing, builds, and code generation
- React to file changes in watch mode
- Hook into the routes scanning pipeline
- Generate barrel files and type declarations using the IndexGenerator
- Create custom code generation workflows

## Overview

Assembler is the tooling layer that starts the development server, runs tests, creates production builds, and generates framework-owned files. Hooks let you run code at specific points in these workflows. For example, you can generate a barrel file when controllers change or display additional information when the development server starts.

Because Assembler runs in a separate process from your AdonisJS application, hooks do not have access to framework features like the IoC container, router service, or database connections. Instead, hooks receive purpose-built utilities like the `IndexGenerator` for code generation and scanner instances for route analysis.

Common use cases include generating barrel files, inspecting route metadata, reacting to file changes, and customizing command output.

## Hooks reference

The following table lists all available hooks, when they execute, and what parameters they receive.

| Hook | Triggered by | Description |
|------|--------------|-------------|
| `init` | DevServer, TestRunner, Bundler, CodeGen | First hook executed. Use for initialization tasks |
| `devServerStarting` | DevServer | Before the child process starts |
| `devServerStarted` | DevServer | After the child process is running |
| `testsStarting` | TestRunner | Before tests begin executing |
| `testsFinished` | TestRunner | After tests complete |
| `buildStarting` | Bundler | Before production build begins |
| `buildFinished` | Bundler | After production build completes |
| `fileChanged` | DevServer, TestRunner | When a file is modified in watch mode |
| `fileAdded` | DevServer, TestRunner | When a file is created |
| `fileRemoved` | DevServer, TestRunner | When a file is deleted |
| `routesCommitted` | DevServer, CodeGen | When routes are registered by the app |
| `routesScanning` | DevServer, CodeGen | Before route type scanning begins |
| `routesScanned` | DevServer, CodeGen | After route type scanning completes |

The `CodeGen` entries refer to the `node ace codegen` command. It runs code generation without starting the server or file watcher. The bundler and test runner do not execute route hooks, so use `node ace codegen` to refresh route-derived output without running the development server.

## Creating and registering hooks

Hooks are registered in the `adonisrc.ts` file under the `hooks` property. Each hook accepts an array of lazy-loaded imports, allowing you to split hook logic into separate files and only load them when needed.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  hooks: {
    devServerStarted: [() => import('./hooks/on_server_started.js')],
    fileChanged: [() => import('./hooks/on_file_changed.js')],
  },
})
```

The hook file must export a default function that receives the hook's parameters. Each hook has a typed helper available from `@adonisjs/core/app` that provides full TypeScript support for the parameters.

```ts title="hooks/on_server_started.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.devServerStarted((devServer, info, instructions) => {
  /**
   * info.host - The host address the server is bound to
   * info.port - The port number the server is running on
   * instructions - UI helper for displaying formatted output
   */
  console.log(`Server running at http://${info.host}:${info.port}`)
})
```

You can register multiple hooks for the same event. They execute in the order they are registered.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  hooks: {
    devServerStarted: [
      () => import('./hooks/log_server_info.js'),
      () => import('./hooks/notify_external_service.js'),
    ],
  },
})
```

:::warning
Assembler hooks run in a separate process from your AdonisJS application. They do not have access to the IoC container, router, database, or any other framework services. If you need to interact with your application, use the routes scanning hooks to extract metadata or communicate via HTTP/IPC.
:::

## Init hook

The `init` hook is the first hook executed when Assembler starts an operation. It receives the parent instance (`DevServer`, `TestRunner`, `Bundler`, or `CodeGen`), a hooks manager, and the `IndexGenerator`.

```ts title="hooks/init.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.init((parent, hooksManager, indexGenerator) => {
  console.log('Assembler initialized')
})
```

The `init` hook is the recommended place to configure the IndexGenerator for barrel file and type generation, as it runs before any other operations begin.

## Dev server hooks

The dev server hooks execute when starting and running the development server. The `devServerStarting` hook fires before the child process launches, and `devServerStarted` fires once the server is accepting connections.

```ts title="hooks/on_dev_server_starting.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.devServerStarting((devServer) => {
  /**
   * Perform setup tasks before the server starts.
   * The child process has not been spawned yet.
   */
  console.log('Preparing to start dev server...')
})
```

```ts title="hooks/on_dev_server_started.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.devServerStarted((devServer, info, instructions) => {
  instructions.add(`API docs: http://${info.host}:${info.port}/docs`)
})
```

These hooks re-trigger every time the child process restarts, such as when a full reload occurs due to file changes.

## Test runner hooks

The test runner hooks execute before and after your test suite. Use `testsStarting` to prepare external resources or generated fixtures, and `testsFinished` to generate reports or clean up those resources. These hooks run outside the application process and cannot resolve framework services.

```ts title="hooks/on_tests_starting.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.testsStarting((testRunner) => {
  console.log('Preparing test environment...')
})
```

```ts title="hooks/on_tests_finished.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.testsFinished((testRunner) => {
  console.log('Tests complete, generating coverage report...')
})
```

When running tests in watch mode, these hooks re-trigger each time the test suite re-runs.

## Bundler hooks

The bundler hooks execute when creating a production build with `node ace build`. Use `buildStarting` for pre-build tasks like asset optimization, and `buildFinished` to display build statistics or run post-build scripts.

```ts title="hooks/on_build_starting.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.buildStarting((bundler) => {
  console.log('Starting production build...')
})
```

```ts title="hooks/on_build_finished.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.buildFinished((bundler, instructions) => {
  instructions.add('Run `npm run start` in the build folder to start the server')
})
```

## Watcher hooks

The watcher hooks fire when files change during development or test watch mode. In HMR mode, Assembler relies on hot-hook to detect changes; otherwise, the built-in file watcher handles detection.

Each watcher hook receives both the relative path (from your application root, using Unix-style slashes) and the absolute path to the affected file.

```ts title="hooks/on_file_changed.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.fileChanged((relativePath, absolutePath, info, parent) => {
  /**
   * info.source - Either 'hot-hook' or 'watcher'
   * info.hotReloaded - True if the file was hot reloaded without restart
   * info.fullReload - True if a full server restart is required
   */
  if (relativePath.startsWith('app/controllers/')) {
    console.log(`Controller changed: ${relativePath}`)
  }
})
```

```ts title="hooks/on_file_added.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.fileAdded((relativePath, absolutePath, parent) => {
  console.log(`New file created: ${relativePath}`)
})
```

```ts title="hooks/on_file_removed.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.fileRemoved((relativePath, absolutePath, parent) => {
  console.log(`File deleted: ${relativePath}`)
})
```

## Routes hooks

The routes hooks provide access to your application's route definitions and their associated types. They run for the development server and `node ace codegen`, but not for builds or tests.

### Routes committed

The `routesCommitted` hook fires when your AdonisJS application registers its routes. The routes are transmitted from the child process to Assembler via IPC, giving you access to route metadata without parsing files yourself.

```ts title="hooks/on_routes_committed.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.routesCommitted((devServer, routes) => {
  /**
   * routes is an object with domains as keys.
   * Each domain contains an array of route definitions.
   */
  const defaultRoutes = routes['root'] || []
  console.log(`${defaultRoutes.length} routes registered`)
})
```

### Routes scanning

The `routesScanning` hook fires before Assembler begins analyzing your routes to extract request and response types. Use this hook to configure the scanner, such as skipping certain routes from analysis.

```ts title="hooks/on_routes_scanning.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.routesScanning((devServer, routesScanner) => {
  const excludedRoutes = ['session.create', 'session.store', 'oauth.callback']

  routesScanner.filter((route) => {
    return !excludedRoutes.includes(route.name)
  })
})
```

### Routes scanned

The `routesScanned` hook fires after route analysis completes. The scanner contains extracted type information that you can use to generate API clients or type declarations.

```ts title="hooks/on_routes_scanned.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.routesScanned((devServer, routesScanner) => {
  const routes = routesScanner.getScannedRoutes()
  const controllers = routesScanner.getControllers()

  console.log(`Scanned ${routes.length} routes from ${controllers.length} controllers`)
})
```

:::note
The types extracted by the routes scanner are internal import references pointing to your controllers and validators. They are not fully resolved standalone types that can be used in a separate project. Generating standalone types requires additional tooling like [Tuyau](https://tuyau.julr.dev/docs/introduction).
:::

## IndexGenerator

The IndexGenerator is a utility for watching directories and generating barrel files or type declarations from their contents. It handles file watching automatically, regenerating output files when source files are added or removed.

### Configuring the IndexGenerator

Register IndexGenerator configurations in the `init` hook. Each configuration specifies a source directory to watch, an output file to generate, and how to transform the source files.

```ts title="hooks/init.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.init((parent, hooksManager, indexGenerator) => {
  indexGenerator.add('controllers', {
    source: './app/controllers',
    importAlias: '#controllers',
    as: 'barrelFile',
    exportName: 'controllers',
    removeSuffix: 'controller',
    output: './.adonisjs/server/controllers.ts',
  })
})
```

The configuration options are:

| Option | Description |
|--------|-------------|
| `source` | Directory to scan for source files |
| `importAlias` | The import alias to use in generated imports (e.g., `#controllers`) |
| `as` | Either `'barrelFile'` for automatic generation or a callback for custom output |
| `exportName` | Name of the exported constant in barrel files |
| `removeSuffix` | Suffix to strip from file names when generating property keys |
| `output` | Path where the generated file will be written |

### Barrel file generation

When `as` is set to `'barrelFile'`, the IndexGenerator scans the source directory recursively and generates a barrel file that exports lazy-loaded imports. The directory structure is preserved as nested objects.

Given this controller structure:

```text title="app/controllers"
app/controllers/
├── auth/
│   ├── login_controller.ts
│   └── register_controller.ts
├── blog/
│   ├── posts_controller.ts
│   └── post_comments_controller.ts
└── users_controller.ts
```

The IndexGenerator produces:

```ts title=".adonisjs/server/controllers.ts"
export const controllers = {
  auth: {
    Login: () => import('#controllers/auth/login_controller'),
    Register: () => import('#controllers/auth/register_controller'),
  },
  blog: {
    Posts: () => import('#controllers/blog/posts_controller'),
    PostComments: () => import('#controllers/blog/post_comments_controller'),
  },
  Users: () => import('#controllers/users_controller'),
}
```

This barrel file enables lazy-loading controllers in your routes without manual import management. The file automatically updates when you add or remove controllers.

### Custom output generation

For custom output, pass a callback to the `as` option. The callback receives a virtual file system, a file buffer, the source configuration, and helpers for generating import paths. The following example scans React pages and generates the `InertiaPages` type used by `inertia.render()`.

```ts title="hooks/init.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.init((_parent, _hooksManager, indexGenerator) => {
  indexGenerator.add('inertiaPages', {
    source: './inertia/pages',
    glob: ['**/*.ts', '**/*.tsx'],
    as: (vfs, buffer, _config, helpers) => {
      const pages = vfs.asList()

      buffer.writeLine(`import '@adonisjs/inertia/types'`)
      buffer.writeLine(`import type React from 'react'`)
      buffer.writeLine(`import type { Prettify } from '@adonisjs/core/types/common'`)
      buffer.writeLine(``)
      buffer.writeLine(`type ExtractProps<T> =`)
      buffer.indent().writeLine(`T extends React.FC<infer Props>`)
      buffer.indent().writeLine(`? Prettify<Omit<Props, 'children'>>`)
      buffer.writeLine(`: never`).dedent().dedent()
      buffer.writeLine(``)
      buffer.writeLine(`declare module '@adonisjs/inertia/types' {`).indent()
      buffer.writeLine(`export interface InertiaPages {`).indent()

      for (const [page, filePath] of Object.entries(pages)) {
        buffer.writeLine(
          `'${page}': ExtractProps<(typeof import('${helpers.toImportPath(filePath)}'))['default']>`
        )
      }

      buffer.dedent().writeLine(`}`)
      buffer.dedent().writeLine(`}`)
    },
    output: './.adonisjs/server/pages.d.ts',
  })
})
```

### Complete IndexGenerator example

The following example shows a complete `init` hook that configures barrel file generation for controllers, events, and listeners. This is the default setup used by AdonisJS.

```ts title="hooks/init.ts"
import { hooks } from '@adonisjs/core/app'

export default hooks.init((parent, hooksManager, indexGenerator) => {
  /**
   * Generate a barrel file for controllers.
   * Enables lazy-loading in routes: [controllers.Posts, 'index']
   */
  indexGenerator.add('controllers', {
    source: './app/controllers',
    importAlias: '#controllers',
    as: 'barrelFile',
    exportName: 'controllers',
    removeSuffix: 'controller',
    output: './.adonisjs/server/controllers.ts',
  })

  /**
   * Generate a barrel file for event classes.
   * Enables type-safe event emission.
   */
  indexGenerator.add('events', {
    source: './app/events',
    importAlias: '#events',
    as: 'barrelFile',
    exportName: 'events',
    output: './.adonisjs/server/events.ts',
  })

  /**
   * Generate a barrel file for event listeners.
   * Enables lazy-loading listeners in event bindings.
   */
  indexGenerator.add('listeners', {
    source: './app/listeners',
    importAlias: '#listeners',
    as: 'barrelFile',
    exportName: 'listeners',
    output: './.adonisjs/server/listeners.ts',
  })
})
```
