---
description: Learn about service providers in AdonisJS and how to use lifecycle hooks to execute code during application startup and shutdown.
---

# Service Providers

This guide covers service providers in AdonisJS applications. You will learn how to:

- Use lifecycle hooks to execute code at specific points during application startup and shutdown
- Create custom service providers
- Register bindings into the IoC container

## Overview

Service providers are JavaScript classes with lifecycle hooks that run at specific points during application startup and shutdown. You can use them to register IoC container bindings, extend framework classes using macros, initialize application-wide services, and release resources during graceful shutdown.

Providers keep initialization logic in one place and run it in a predictable order. AdonisJS applications and packages use them to integrate services with the application lifecycle.

## Understanding service providers

Before creating your own service providers, it's helpful to understand how they work within an AdonisJS application.

### Where service providers are registered

Service providers are registered in the `adonisrc.ts` file at the root of your project. This file defines which providers should load and in which runtime environments they should execute.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
  ],
})
```

Providers use lazy imports with the `() => import()` syntax, ensuring they're only loaded when needed.

### Built-in service providers

A typical AdonisJS application includes several framework providers that handle core functionality.

- `app_provider` registers the application, logger, encryption, and HTTP server services.
- `hash_provider` registers the hash service used for password hashing and verification.
- `repl_provider` adds REPL-specific bindings. In the example above, it only runs in the `repl` and `test` environments.
- `vinejs_provider` integrates VineJS with the application.
- `edge_provider` integrates the Edge template engine with the application.

When you install additional packages like `@adonisjs/lucid` for database access or `@adonisjs/auth` for authentication, these packages include their own service providers that you add to this array.

### Execution order and environments

AdonisJS calls lifecycle hooks in phases across all registered providers. First, the `register` hook runs for all providers in the order they are registered. Then the `boot` hook runs for all providers in the order they are registered, followed by `start`, `ready`, and finally `shutdown`. The preload files are imported between `start` and `ready`, so a preload file can rely on whatever a provider established in its `start` method.

Environment restrictions determine whether a provider runs at all. For instance, a WebSocket provider configured for the `web` environment won't execute when you run console commands.

The execution order tells you which services are available to each hook, while environment filtering prevents providers from loading where they are not needed.

## When to create a service provider

Create a custom service provider when you need to register services into the IoC container, extend framework classes with macros, perform initialization at specific lifecycle points, set up resources that require cleanup during shutdown, or configure third-party packages application-wide.

You typically don't need a service provider for simple utility functions, one-off setup that only runs in a single place, or services used within a single controller or middleware. In these cases, use regular modules or inject dependencies directly.

## Creating a custom service provider

Now that you understand when service providers are appropriate, let's build one that registers a `Cache` service into the IoC container.

::::steps
:::step{title="Generate the provider"}

AdonisJS includes a command to generate service provider files.

```sh title="terminal"
node ace make:provider cache
# Output:
# CREATE: providers/cache_provider.ts
```

The command creates the provider file. Accept the registration prompt to add it to the `providers` array in `adonisrc.ts`.

:::

:::step{title="Understand the generated code"}

Open the generated `providers/cache_provider.ts` file. You'll see a basic provider structure.

```ts title="providers/cache_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Called when the provider is registered
   */
  register() {}

  /**
   * Called when the application boots
   */
  async boot() {}

  /**
   * Called while the application warms up
   */
  async start() {}

  /**
   * Called when the application is ready
   */
  async ready() {}

  /**
   * Called during graceful shutdown
   */
  async shutdown() {}
}
```

The provider receives the `ApplicationService` through its constructor, giving you access to the IoC container and other application services. All lifecycle methods are optional. You only implement the hooks you need.

:::

:::step{title="Register a container binding"}

First, create a small in-memory cache service. Keeping the service separate from its provider makes it available as an injection token throughout the application.

```ts title="app/services/cache.ts"
export default class Cache {
  #store = new Map<string, unknown>()

  get<T>(key: string): T | undefined {
    return this.#store.get(key) as T | undefined
  }

  set(key: string, value: unknown): void {
    this.#store.set(key, value)
  }
}
```

Register the `Cache` class as a singleton so every consumer shares the same store.

```ts title="providers/cache_provider.ts"
import Cache from '#services/cache'
import type { ApplicationService } from '@adonisjs/core/types'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(Cache, () => {
      return new Cache()
    })
  }
}
```

:::

:::step{title="Use your registered service"}

Once registered, you can inject the Cache service into controllers or other container-managed classes.

```ts title="app/controllers/posts_controller.ts"
import Cache from '#services/cache'
import Post from '#models/post'
import { inject } from '@adonisjs/core'

export default class PostsController {
  @inject()
  constructor(protected cache: Cache) {}

  async index() {
    const cachedPosts = this.cache.get<Post[]>('posts')

    if (cachedPosts) {
      return cachedPosts
    }

    const posts = await Post.all()
    this.cache.set('posts', posts)
    return posts
  }
}
```

:::
::::

## Understanding all lifecycle hooks

Service providers offer five lifecycle hooks that run at different stages of your application's lifetime. Here's when each hook executes:

| Hook | Type | When It Runs | Common Use Cases |
|------|------|-------------|------------------|
| `register` | Sync | Immediately on provider import | Register IoC container bindings |
| `boot` | Async | After all providers registered | Extend framework classes, configure services |
| `start` | Async | During warmup, before preload files are imported | Register routes, define named middleware |
| `ready` | Async | After the HTTP server is ready or before a command runs | Attach to the running server, start workers |
| `shutdown` | Async | During graceful termination | Close connections, release resources |

The `register`, `boot`, and `start` hooks also run when tooling warms up your application for inspection. The `ready` and `shutdown` hooks only run in `run` mode, which makes `ready` the right place for long-running side effects.

### The register hook

The `register` method is called as soon as AdonisJS imports your provider, very early in the boot process before any other hooks run. Its primary purpose is to register bindings into the IoC container.

```ts title="providers/cache_provider.ts"
import Cache from '#services/cache'
import type { ApplicationService } from '@adonisjs/core/types'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(Cache, () => {
      return new Cache()
    })
  }
}
```

The `register` hook must remain synchronous. Do not resolve bindings, perform I/O, or access framework services during this hook because the other providers have not finished registering.

### The boot hook

The `boot` method runs after all providers have finished registering their bindings. At this point, the container is fully populated and you can safely resolve any binding. This makes `boot` the natural place to extend framework classes or configure services that depend on other registered bindings. The following provider adds an `apiSuccess` macro to `HttpResponse`. You can use the same hook to configure validators, register Edge helpers, or extend other framework classes.

```ts title="providers/app_provider.ts"
import { HttpResponse } from '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  interface HttpResponse {
    apiSuccess(data: unknown): void
  }
}

export default class AppProvider {
  async boot() {
    HttpResponse.macro('apiSuccess', function (this: HttpResponse, data: unknown) {
      this.json({
        success: true,
        data,
      })
    })
  }
}
```

### The start hook

The `start` method runs during the warmup phase, just before the HTTP server starts (in the web environment) or before an Ace command executes (in the console environment). Preload files are imported after this hook completes, so use it to establish anything a preload file depends upon. Common examples include registering routes, defining named middleware, and attaching event listeners.

The method also runs when your application is warmed up for inspection rather than started, for example by the `node ace codegen` command. Guard anything that opens a connection, spawns a worker, or performs a health check, and leave the registration itself unguarded. See [application modes](./application_lifecycle.md#application-modes).

### The ready hook

The `ready` method runs after the HTTP server has started accepting connections (in the web environment) or just before executing an Ace command's `run` method (in the console environment). Use it for services that need the running HTTP server or for other long-running side effects. The following provider attaches Socket.IO to the underlying Node.js server and closes it during shutdown.

```ts title="providers/websocket_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import { Server } from 'socket.io'

export default class WebSocketProvider {
  #io?: Server

  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() !== 'web') {
      return
    }

    const server = await this.app.container.make('server')
    this.#io = new Server(server.getNodeServer())

    this.#io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)
    })
  }

  async shutdown() {
    await this.#io?.close()
  }
}
```

### The shutdown hook

The `shutdown` method runs when AdonisJS receives a signal to terminate gracefully. This is your opportunity to clean up resources, close connections, and ensure your application shuts down without losing data or leaving dangling processes.

The method is skipped for applications in `warmup` mode. Providers must therefore avoid opening long-lived resources before `ready`, or guard that work using the [application mode](./application_lifecycle.md#application-modes). The `WebSocketProvider` above demonstrates the complete lifecycle by creating the Socket.IO server in `ready` and closing it in `shutdown`.

Use `shutdown` to close database connection pools, flush pending log writes, disconnect from Redis, close file handles, or perform any other cleanup necessary for graceful termination. The framework waits for all `shutdown` hooks to complete before exiting.
