---
description: Learn about the Application class and how to access the environment, state, and make paths to project files.
---

# Application

This guide covers the Application class in AdonisJS. You will learn how to:

- Access the runtime environment (web, console, repl, test)
- Check the Node.js environment and application state
- Listen for process signals and notify parent processes
- Generate absolute paths to project directories and files
- Use generators for consistent naming conventions

## Overview

The [Application](https://github.com/adonisjs/application/blob/9.x/src/application.ts) class handles the heavy lifting of wiring together an AdonisJS application. It manages the application lifecycle, provides access to environment information, tracks the current state, and offers helper methods for generating paths to various project directories.

You access the Application instance through the `app` service, which is available throughout your application.

See also: [Application lifecycle](../guides/concepts/application_lifecycle.md)

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'
```

## Environment

The environment refers to the runtime context in which your application is running. AdonisJS recognizes four distinct environments:

| Environment | Description |
|-------------|-------------|
| `web` | The process started for the HTTP server |
| `console` | Ace commands (except the REPL command) |
| `repl` | The process started using `node ace repl` |
| `test` | The process started using `node ace test` |

You can access the current environment using the `getEnvironment` method.

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

console.log(app.getEnvironment())
```

### Switching the environment

You can switch the application environment before it has been booted. This is useful when a command needs to run in a different context than it was started in. For example, the `node ace repl` command starts in the `console` environment but switches to `repl` before presenting the prompt.

```ts title="commands/my_command.ts"
import app from '@adonisjs/core/services/app'

if (!app.isBooted) {
  app.setEnvironment('repl')
}
```

## Node environment

The `nodeEnvironment` property provides access to the Node.js environment, derived from the `NODE_ENV` environment variable. AdonisJS normalizes common variations to ensure consistency across different deployment configurations.

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

console.log(app.nodeEnvironment)
```

| NODE_ENV | Normalized to |
|----------|---------------|
| dev | development |
| develop | development |
| stage | staging |
| prod | production |
| testing | test |

### Shorthand properties

Instead of comparing strings, you can use these boolean properties to check the current environment.

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

/**
 * Check if running in production
 */
app.inProduction
app.nodeEnvironment === 'production'

/**
 * Check if running in development
 */
app.inDev
app.nodeEnvironment === 'development'

/**
 * Check if running tests
 */
app.inTest
app.nodeEnvironment === 'test'
```

## State

The state represents where the application is in its lifecycle. The features you can access depend on the current state—for example, you cannot access [container bindings](../guides/concepts/dependency_injection.md#bindings) or [container services](../guides/concepts/container_services.md) until the app reaches the `booted` state.

| State | Description |
|-------|-------------|
| `created` | Default state when Application instance is created |
| `initiated` | Environment variables parsed and `adonisrc.ts` processed |
| `booted` | Service providers registered and booted |
| `ready` | Application ready to handle requests (meaning varies by environment) |
| `terminated` | Application terminated and process will exit shortly |

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

console.log(app.getState())
```

### Shorthand properties

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

/**
 * True when state is past 'initiated'
 */
app.isBooted

/**
 * True when state is 'ready'
 */
app.isReady

/**
 * True when gracefully attempting to terminate
 */
app.isTerminating

/**
 * True when state is 'terminated'
 */
app.isTerminated
```

## Listening for process signals

You can listen for [POSIX signals](https://man7.org/linux/man-pages/man7/signal.7.html) using the `app.listen` or `app.listenOnce` methods. These register listeners with the Node.js `process` object.

```ts title="start/events.ts"
import app from '@adonisjs/core/services/app'

app.listen('SIGTERM', () => {
  // Handle SIGTERM
})

app.listenOnce('SIGTERM', () => {
  // Handle SIGTERM once
})
```

### Conditional listeners

Use `listenIf` or `listenOnceIf` to register listeners only when a condition is met. The listener is registered only when the first argument is truthy.

```ts title="start/events.ts"
import app from '@adonisjs/core/services/app'

/**
 * Only listen for SIGINT when running under pm2
 */
app.listenIf(app.managedByPm2, 'SIGINT', () => {
  // Handle SIGINT in pm2
})

app.listenOnceIf(app.managedByPm2, 'SIGINT', () => {
  // Handle SIGINT once in pm2
})
```

## Notifying parent process

When your application runs as a child process, you can send messages to the parent using the `app.notify` method. This wraps the `process.send` method.

```ts title="start/events.ts"
import app from '@adonisjs/core/services/app'

app.notify('ready')

app.notify({
  isReady: true,
  port: 3333,
  host: 'localhost'
})
```

## Making paths to project files

The Application class provides helper methods that generate absolute paths to files and directories within your project. These helpers respect the directory structure configured in your `adonisrc.ts` file, ensuring paths remain correct even if you customize directory locations.

### makePath

Returns an absolute path to a file or directory within the project root.

```ts title="app/services/some_service.ts"
import app from '@adonisjs/core/services/app'

app.makePath('app/middleware/auth.ts')
// /project_root/app/middleware/auth.ts
```

### makeURL

Returns a file URL to a file or directory within the project root. This is useful when dynamically importing files.

```ts title="app/services/test_runner.ts"
import app from '@adonisjs/core/services/app'

const files = [
  './tests/welcome.spec.ts',
  './tests/maths.spec.ts'
]

await Promise.all(files.map((file) => {
  return import(app.makeURL(file).href)
}))
```

### tmpPath

Returns a path to a file inside the `tmp` directory within the project root.

```ts title="app/services/some_service.ts"
app.tmpPath('logs/mail.txt')
// /project_root/tmp/logs/mail.txt

app.tmpPath()
// /project_root/tmp
```

### configPath

```ts title="app/services/some_service.ts"
app.configPath('shield.ts')
// /project_root/config/shield.ts

app.configPath()
// /project_root/config
```

### publicPath

```ts title="app/services/some_service.ts"
app.publicPath('style.css')
// /project_root/public/style.css

app.publicPath()
// /project_root/public
```

### viewsPath

```ts title="app/services/some_service.ts"
app.viewsPath('welcome.edge')
// /project_root/resources/views/welcome.edge

app.viewsPath()
// /project_root/resources/views
```

### languageFilesPath

```ts title="app/services/some_service.ts"
app.languageFilesPath('en/messages.json')
// /project_root/resources/lang/en/messages.json

app.languageFilesPath()
// /project_root/resources/lang
```

### httpControllersPath

```ts title="app/services/some_service.ts"
app.httpControllersPath('users_controller.ts')
// /project_root/app/controllers/users_controller.ts

app.httpControllersPath()
// /project_root/app/controllers
```

### modelsPath

```ts title="app/services/some_service.ts"
app.modelsPath('user.ts')
// /project_root/app/models/user.ts

app.modelsPath()
// /project_root/app/models
```

### servicesPath

```ts title="app/services/some_service.ts"
app.servicesPath('user_service.ts')
// /project_root/app/services/user_service.ts

app.servicesPath()
// /project_root/app/services
```

### middlewarePath

```ts title="app/services/some_service.ts"
app.middlewarePath('auth.ts')
// /project_root/app/middleware/auth.ts

app.middlewarePath()
// /project_root/app/middleware
```

### validatorsPath

```ts title="app/services/some_service.ts"
app.validatorsPath('create_user.ts')
// /project_root/app/validators/create_user.ts

app.validatorsPath()
// /project_root/app/validators
```

### policiesPath

```ts title="app/services/some_service.ts"
app.policiesPath('post_policy.ts')
// /project_root/app/policies/post_policy.ts

app.policiesPath()
// /project_root/app/policies
```

### exceptionsPath

```ts title="app/services/some_service.ts"
app.exceptionsPath('handler.ts')
// /project_root/app/exceptions/handler.ts

app.exceptionsPath()
// /project_root/app/exceptions
```

### transformersPath

```ts title="app/services/some_service.ts"
app.transformersPath('user.ts')
// /project_root/app/transformers/user.ts

app.transformersPath()
// /project_root/app/transformers
```

### eventsPath

```ts title="app/services/some_service.ts"
app.eventsPath('user_created.ts')
// /project_root/app/events/user_created.ts

app.eventsPath()
// /project_root/app/events
```

### listenersPath

```ts title="app/services/some_service.ts"
app.listenersPath('send_invoice.ts')
// /project_root/app/listeners/send_invoice.ts

app.listenersPath()
// /project_root/app/listeners
```

### mailsPath

```ts title="app/services/some_service.ts"
app.mailsPath('verify_email.ts')
// /project_root/app/mails/verify_email.ts

app.mailsPath()
// /project_root/app/mails
```

### migrationsPath

```ts title="app/services/some_service.ts"
app.migrationsPath('create_users_table.ts')
// /project_root/database/migrations/create_users_table.ts

app.migrationsPath()
// /project_root/database/migrations
```

### seedersPath

```ts title="app/services/some_service.ts"
app.seedersPath('user_seeder.ts')
// /project_root/database/seeders/user_seeder.ts

app.seedersPath()
// /project_root/database/seeders
```

### factoriesPath

```ts title="app/services/some_service.ts"
app.factoriesPath('user_factory.ts')
// /project_root/database/factories/user_factory.ts

app.factoriesPath()
// /project_root/database/factories
```

### generatedServerPath

Returns a path to a file inside the `.adonisjs/server` directory, which contains server-side barrel files like controller imports.

```ts title="app/services/some_service.ts"
app.generatedServerPath('controllers.ts')
// /project_root/.adonisjs/server/controllers.ts

app.generatedServerPath()
// /project_root/.adonisjs/server
```

### generatedClientPath

Returns a path to a file inside the `.adonisjs/client` directory, which contains client-side generated files.

```ts title="app/services/some_service.ts"
app.generatedClientPath('manifest.json')
// /project_root/.adonisjs/client/manifest.json

app.generatedClientPath()
// /project_root/.adonisjs/client
```

### startPath

```ts title="app/services/some_service.ts"
app.startPath('routes.ts')
// /project_root/start/routes.ts

app.startPath()
// /project_root/start
```

### providersPath

```ts title="app/services/some_service.ts"
app.providersPath('app_provider.ts')
// /project_root/providers/app_provider.ts

app.providersPath()
// /project_root/providers
```

### commandsPath

```ts title="app/services/some_service.ts"
app.commandsPath('greet.ts')
// /project_root/commands/greet.ts

app.commandsPath()
// /project_root/commands
```

## Generators

Generators create consistent class names and file names for different entities in your application. They ensure naming conventions are followed when creating new files programmatically.

```ts title="commands/make_resource.ts"
import app from '@adonisjs/core/services/app'

app.generators.controllerFileName('user')
// users_controller.ts

app.generators.controllerName('user')
// UsersController
```

See the [`generators.ts` source code](https://github.com/adonisjs/application/blob/9.x/src/generators.ts) for the complete list of available generators.
