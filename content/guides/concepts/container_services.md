---
description: Learn about container services in AdonisJS and how they provide convenient access to framework components through ES module imports.
---

# Container Services

This guide covers container services in AdonisJS. You will learn:

- What container services are and how they work
- How to use existing services in your application
- When to use services versus dependency injection
- How to create your own services for packages

## Overview

Container services are a convenience pattern in AdonisJS that simplifies how you access framework functionality. When you need to use features like routing, hashing, or logging, you can import a ready-to-use instance instead of manually constructing classes or interacting with the IoC container directly.

This pattern exists because many framework components require dependencies that the IoC container already knows how to provide. Rather than making you resolve these dependencies yourself in every file, AdonisJS packages expose pre-configured instances as standard ES module exports. You import them like any other module, and they work immediately.

## Understanding container services

Without container services, you have two options for using framework classes. You could import a class and construct it yourself, manually providing all its dependencies.

```ts title="Manual construction"
import { Router } from '@adonisjs/core/http'

export const router = new Router(/** Router dependencies */)
```

Alternatively, you could use the IoC container's `make` method to construct the class, letting the container handle dependency resolution.

```ts title="Using app.make()"
import app from '@adonisjs/core/services/app'
import { Router } from '@adonisjs/core/http'

export const router = await app.make(Router)
```

Container services eliminate this ceremony by doing exactly what the second approach does, but packaging it as a convenient import. The service module uses the IoC container internally and exports the resolved instance.

```ts title="Using a container service"
import router from '@adonisjs/core/services/router'
import hash from '@adonisjs/core/services/hash'
import logger from '@adonisjs/core/services/logger'
```

When you import a service, you're getting a singleton instance that was constructed by the IoC container with all its dependencies properly injected. The service itself is just a thin wrapper that makes this instance available as a standard module export.

## Using container services

Container services are available automatically when you install AdonisJS packages. No configuration or registration is required. You simply import the service and use it.

Here's an example using the Drive service to upload a file to S3.

```ts title="app/controllers/posts_controller.ts"
import drive from '@adonisjs/drive/services/main'

export class PostsController {
  async store(post: Post, coverImage: File) {
    const coverImageName = 'random_name.jpg'

    /**
     * The drive service gives you direct access to the
     * DriveManager instance. Use it to select a disk
     * and perform file operations.
     */
    const disk = drive.use('s3')
    await disk.put(coverImageName, coverImage)
    
    post.coverImage = coverImageName
    await post.save()
  }
}
```

This approach is straightforward and requires no setup beyond importing the service. The Drive service is a singleton, so the same instance is shared across your entire application.

## Using dependency injection instead

For applications that prefer dependency injection, you can inject the underlying class directly into your services or controllers. This approach makes your code more testable since dependencies can be easily mocked or stubbed.

Here's the same file upload functionality using constructor injection.

```ts title="app/services/post_service.ts"
import { Disk } from '@adonisjs/drive'
import { inject } from '@adonisjs/core'

@inject()
export class PostService {
  /**
   * The Disk instance is injected by the IoC container.
   * This makes it easy to swap implementations during
   * testing or use different disk configurations.
   */
  constructor(protected disk: Disk) {
  }

  async save(post: Post, coverImage: File) {
    const coverImageName = 'random_name.jpg'

    await this.disk.put(coverImageName, coverImage)
    
    post.coverImage = coverImageName
    await post.save()
  }
}
```

With dependency injection, the IoC container automatically resolves and injects the Disk instance. Your class declares what it needs, and the container provides it. This pattern is particularly valuable when writing business logic that needs to remain decoupled from framework specifics.

## Available services

AdonisJS core and official packages expose the following container services. Each service corresponds to a container binding and provides access to the fully constructed class instance.

<table>
  <thead>
    <tr>
      <th width="100px">Binding</th>
      <th width="140px">Class</th>
      <th>Service</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <code>app</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/application/blob/9.x/src/application.ts">Application</a>
      </td>
      <td>
        <code>@adonisjs/core/services/app</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>ace</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/core/blob/main/modules/ace/kernel.ts">Kernel</a>
      </td>
      <td>
        <code>@adonisjs/core/services/kernel</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>config</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/config/blob/6.x/src/config.ts">Config</a>
      </td>
      <td>
        <code>@adonisjs/core/services/config</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>encryption</code>
      </td>
      <td>
        <a href="https://github.com/boringnode/encryption/blob/1.x/src/encryption.ts">Encryption</a>
      </td>
      <td>
        <code>@adonisjs/core/services/encryption</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>emitter</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/events/blob/10.x/src/emitter.ts">Emitter</a>
      </td>
      <td>
        <code>@adonisjs/core/services/emitter</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>hash</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/hash/blob/10.x/src/hash_manager.ts">HashManager</a>
      </td>
      <td>
        <code>@adonisjs/core/services/hash</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>logger</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/logger/blob/7.x/src/logger_manager.ts">LoggerManager</a>
      </td>
      <td>
        <code>@adonisjs/core/services/logger</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>repl</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/repl/blob/main/src/repl.ts">Repl</a>
      </td>
      <td>
        <code>@adonisjs/core/services/repl</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>router</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/http-server/blob/8.x/src/router/main.ts">Router</a>
      </td>
      <td>
        <code>@adonisjs/core/services/router</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>server</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/http-server/blob/8.x/src/server/main.ts">Server</a>
      </td>
      <td>
        <code>@adonisjs/core/services/server</code>
      </td>
    </tr>
    <tr>
      <td>
        <code>testUtils</code>
      </td>
      <td>
        <a href="https://github.com/adonisjs/core/blob/main/src/test_utils/main.ts">TestUtils</a>
      </td>
      <td>
        <code>@adonisjs/core/services/test_utils</code>
      </td>
    </tr>
  </tbody>
</table>

## Creating your own services

If you're building a package or want to expose your own container bindings as services, you can follow the same pattern that AdonisJS uses internally. A container service is simply a module that resolves a binding from the container and exports it.

You can view the [complete implementation on GitHub](https://github.com/adonisjs/drive/blob/4.x/services/main.ts#L19-L21) to see how the Drive package creates its service.

```ts title="Example service structure"
import app from '@adonisjs/core/services/app'

let drive: DriveManager

await app.booted(async () => {
  drive = await app.container.make('drive')
})

export { drive as default }
```

The service waits for the application to boot, then resolves the binding from the container and exports it. This ensures all service providers have registered their bindings before the service attempts to resolve them.
