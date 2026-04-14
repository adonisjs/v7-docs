---
description: Learn how to extend the AdonisJS framework using macros and getters.
---

# Extending the framework

This guide covers how to extend AdonisJS with custom functionality. You will learn how to:

- Add custom methods to framework classes using macros
- Create computed properties with getters
- Ensure type safety with TypeScript declaration merging
- Organize extension code in your application
- Extend specific framework modules like Hash, Session, and Authentication

## Overview

AdonisJS provides a powerful extension system that lets you add custom methods and properties to framework classes without modifying the framework's source code. This means you can enhance the `HttpRequest` class with custom validation logic, add utility methods to the `HttpResponse` class, or extend any other framework class to fit your application's specific needs.

The extension system is built on two core concepts: **macros** (custom methods) and **getters** (computed properties). Both are added at runtime and integrate seamlessly with TypeScript through declaration merging, giving you full type safety and autocomplete in your editor.

This same extension API is used throughout AdonisJS's own first-party packages, making it a proven pattern for building reusable functionality. Whether you're adding a few helper methods for your application or building a package to share with the community, the extension system provides a clean, type-safe way to enhance the framework.

## Why extend the framework?

Before diving into the mechanics, let's understand when and why you'd want to extend framework classes.

Without extensions, you'd need to write the same logic repeatedly across your application. For example, checking if a request expects JSON responses:

```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async index({ request, response }: HttpContext) {
    // Repeated in every action that returns different formats
    const acceptHeader = request.header('accept', '')
    const wantsJSON = acceptHeader.includes('application/json') || 
                      acceptHeader.includes('+json')
    
    if (wantsJSON) {
      return response.json({ posts: [] })
    }
    
    return view.render('posts/index')
  }
}
```

With a macro, you write this logic once and use it everywhere:

```ts title="src/extensions.ts"
import { HttpRequest } from '@adonisjs/core/http'

/**
 * Check if the request expects a JSON response based on Accept header
 */
HttpRequest.macro('wantsJSON', function (this: HttpRequest) {
  const firstType = this.types()[0]
  if (!firstType) {
    return false
  }
  
  return firstType.includes('/json') || firstType.includes('+json')
})
```

```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async index({ request, response }: HttpContext) {
    if (request.wantsJSON()) {
      return response.json({ posts: [] })
    }
    
    return view.render('posts/index')
  }
}
```

Extensions are ideal when you:

- Have framework-specific logic reused across your application
- Want to maintain AdonisJS's fluent API style
- Are building a package that integrates deeply with the framework
- Need type-safe custom functionality with autocomplete support

## Understanding macros and getters

Before we start adding extensions, let's clarify what macros and getters are and when to use each.

**Macros** are custom methods you add to a class. They work like regular methods and can accept parameters, perform computations, and return values. Use macros when you need functionality that requires input or performs actions.

**Getters** are computed properties that look like regular properties when you access them. They're calculated on-demand and can optionally cache their result. Use getters for read-only derived data that doesn't require parameters.

Both macros and getters use **declaration merging**, a TypeScript feature that extends existing type definitions to include your custom additions. This ensures your extensions have full type safety and autocomplete support.

Under the hood, AdonisJS uses the [macroable](https://github.com/poppinss/macroable) package to implement this functionality. If you want to understand the implementation details, you can refer to that package's documentation.

## Creating your first macro

Let's build a simple macro step-by-step. We'll add a method to the `HttpRequest` class that checks if the incoming request is from a mobile device.

::::steps

:::step{title="Create the extensions file"}

Create a dedicated file to hold all your framework extensions. This keeps your extension code organized in one place.

```ts title="src/extensions.ts"
// This file contains all framework extensions for your application
```

The file can be named anything you like, but `extensions.ts` clearly communicates its purpose.
:::

:::step{title="Import the class you want to extend"}

Import the framework class you want to add functionality to. For our example, we'll extend the `HttpRequest` class.

```ts title="src/extensions.ts"
import { HttpRequest } from '@adonisjs/core/http'
```
:::

:::step{title="Add the macro method"}

Use the `macro` method to add your custom functionality. The method receives the class instance as `this`, giving you access to all the class's existing properties and methods.

```ts title="src/extensions.ts"
import { HttpRequest } from '@adonisjs/core/http'

HttpRequest.macro('isMobile', function (this: HttpRequest) {
  /**
   * Get the User-Agent header, defaulting to empty string if not present
   */
  const userAgent = this.header('user-agent', '')
  
  /**
   * Check if the User-Agent contains common mobile identifiers
   */
  return /mobile|android|iphone|ipad|phone/i.test(userAgent)
})
```

The `function (this: HttpRequest)` syntax is important because it gives you the correct `this` context. Don't use arrow functions here, as they don't preserve the `this` binding.
:::

:::step{title="Add TypeScript type definitions"}

Tell TypeScript about your new method using declaration merging. Add this at the end of your extensions file.

```ts title="src/extensions.ts"
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    isMobile(): boolean
  }
}
```

The module path in `declare module` must exactly match the import path you use. The interface name must exactly match the class name.
:::

:::step{title="Load extensions in your provider"}

Import your extensions file in a service provider's `boot` method to ensure the extensions are registered when your application starts.

```ts title="providers/app_provider.ts"
export default class AppProvider {
  async boot() {
    await import('../src/extensions.ts')
  }
}
```

:::

:::step{title="Use your macro"}

Your macro is now available throughout your application with full type safety and autocomplete.

```ts title="app/controllers/home_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class HomeController {
  async index({ request, view }: HttpContext) {
    /**
     * TypeScript knows about isMobile() and provides autocomplete
     */
    if (request.isMobile()) {
      return view.render('mobile/home')
    }
    
    return view.render('home')
  }
}
```
:::

::::

## Creating your first getter

Getters are computed properties that work like regular properties but are calculated on-demand. Let's add a getter to the `HttpRequest` class that provides a cleaned version of the request path.

```ts title="src/extensions.ts"
import { HttpRequest } from '@adonisjs/core/http'

HttpRequest.getter('cleanPath', function (this: HttpRequest) {
  /**
   * Get the current URL path
   */
  const path = this.url()
  
  /**
   * Remove trailing slashes and convert to lowercase
   */
  return path.replace(/\/+$/, '').toLowerCase()
})
```

```ts title="src/extensions.ts"
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    cleanPath: string  // Note: property, not a method
  }
}
```

Notice the type declaration differs from macros. Getters are properties, not methods, so you don't include `()` in the type definition.

You can use getters like regular properties:

```ts title="app/middleware/log_middleware.ts"
export default class LogMiddleware {
  async handle({ request, logger }: HttpContext, next: NextFn) {
    /**
     * Access the getter like a property, not a method
     */
    logger.info('Request path: %s', request.cleanPath)
    
    await next()
  }
}
```

:::note
Getter callbacks cannot be async because [JavaScript getters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) are synchronous by design. If you need async computation, use a macro instead.
:::

## Singleton getters

By default, getters recalculate their value every time you access them. For expensive computations, you can make a getter a **singleton**, which caches the result after the first calculation.

```ts title="src/extensions.ts"
import { HttpRequest } from '@adonisjs/core/http'

/**
 * The third parameter (true) makes this a singleton getter
 */
HttpRequest.getter('ipAddress', function (this: HttpRequest) {
  /**
   * Check for proxy headers first, fall back to direct IP
   * This only runs once per request instance
   */
  return this.header('x-forwarded-for') || 
         this.header('x-real-ip') || 
         this.ips()[0] || 
         this.ip()
}, true)
```

```ts title="src/extensions.ts"
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    ipAddress: string
  }
}
```

With singleton getters, the function executes once per instance of the class, and the return value is cached for that instance:

```ts
const ip1 = request.ipAddress  // Executes the getter function
const ip2 = request.ipAddress  // Returns cached value, doesn't re-execute
const ip3 = request.ipAddress  // Still returns cached value
```

:::tip
Use singleton getters when the computed value won't change during the instance's lifetime. For example, a request's IP address won't change during a single HTTP request, so caching it makes sense.

Don't use singleton getters for values that might change, like computed properties based on mutable state.
:::

## When to use macros vs getters

Choosing between macros and getters depends on your use case. Here's a practical guide.

**Use macros when you need to:**

- Accept parameters
- Perform actions with side effects
- Return different values based on input
- Execute async operations

```ts title="src/extensions.ts"
/**
 * Macro example: Accepts a role parameter
 */
HttpRequest.macro('hasRole', function (this: HttpRequest, role: string) {
  const user = this.ctx.auth.user
  return user?.role === role
})

// Usage: request.hasRole('admin')
```

**Use getters when you need to:**

- Provide computed read-only properties
- Calculate derived data from existing properties
- Cache expensive computations (with singleton)
- Maintain a property-like API

```ts title="src/extensions.ts"
/**
 * Getter example: Computed property with no parameters
 */
HttpRequest.getter('isAuthenticated', function (this: HttpRequest) {
  return this.ctx.auth.isAuthenticated
})

// Usage: request.isAuthenticated
```

Both can coexist on the same class. Choose based on the API you want to provide.

## Understanding declaration merging

Declaration merging is how TypeScript learns about your runtime extensions. Getting this right is crucial for type safety.

The module path in your `declare module` statement must exactly match the path you use to import the class:

```ts title="src/extensions.ts"
// If you import like this:
import { HttpRequest } from '@adonisjs/core/http'

// You must declare like this (exact same path):
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    isMobile(): boolean
  }
}
```

:::warning
**Why this matters**: TypeScript uses the module path to determine which type definition to merge with.

**What happens**: If the paths don't match, TypeScript won't recognize your extension. You'll see errors like "Property 'isMobile' does not exist on type 'Request'" even though your code runs correctly.

**Solution**: Always copy the exact import path when writing your declaration:

```ts
// ✅ Correct: Paths match
import { HttpRequest } from '@adonisjs/core/http'
declare module '@adonisjs/core/http' { ... }

// ❌ Wrong: Paths don't match
import { HttpRequest } from '@adonisjs/core/http'
declare module '@adonisjs/http-server' { ... }
```
:::

You can declare multiple extensions in the same `declare module` block:

```ts title="src/extensions.ts"
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    isMobile(): boolean
    hasRole(role: string): boolean
    cleanPath: string
    ipAddress: string
  }
}
```

Or split them across multiple blocks if you prefer:

```ts title="src/extensions.ts"
declare module '@adonisjs/core/http' {
  interface HttpRequest {
    isMobile(): boolean
  }
}

declare module '@adonisjs/core/http' {
  interface HttpRequest {
    hasRole(role: string): boolean
  }
}
```

Both approaches work identically. Choose based on your organization preferences.

## Common mistakes

Here are the most common issues developers encounter when extending the framework and how to fix them.

:::tip
**Mistake**: Using arrow functions for macros

**Why it fails**: Arrow functions don't have their own `this` binding, so you can't access the class instance.

```ts
// ❌ Wrong: Arrow function
HttpRequest.macro('isMobile', () => {
  return this.header('user-agent')  // `this` is undefined!
})

// ✅ Correct: Regular function
HttpRequest.macro('isMobile', function (this: HttpRequest) {
  return this.header('user-agent')  // `this` is the Request instance
})
```
:::

:::tip
**Mistake**: Forgetting the singleton parameter defaults to `false`

**What happens**: Your getter recalculates every time it's accessed, even if the value won't change.

```ts
// This executes the function every single time
HttpRequest.getter('expensiveCalculation', function (this: HttpRequest) {
  return someExpensiveOperation()
})

// Add true for singleton to cache the result
HttpRequest.getter('expensiveCalculation', function (this: HttpRequest) {
  return someExpensiveOperation()
}, true)  // Caches after first access
```
:::

:::tip
**Mistake**: Treating getters like methods

**What happens**: You'll get errors because getters are properties, not functions.

```ts
HttpRequest.getter('ipAddress', function (this: HttpRequest) {
  return this.ip()
})

// ❌ Wrong: Calling it like a method
const ip = request.ipAddress()

// ✅ Correct: Accessing it like a property
const ip = request.ipAddress
```
:::

## Macroable classes

The following framework classes support macros and getters. Each entry includes the import path and typical use cases.

::::options

:::option{name="Application" import="@adonisjs/core/app"}
The main application instance. Extend this to add application-level utilities.

**Common use cases**: Add custom environment checks, application state getters, or global configuration accessors.

**Example**: Add a getter to check if the app is running in a specific mode.

```ts
import app from '@adonisjs/core/services/app'

app.getter('isProduction', function () {
  return this.inProduction
})
```

[View source](https://github.com/adonisjs/application/blob/9.x/src/application.ts)
:::

:::option{name="HttpRequest" import="@adonisjs/core/http"}
The HTTP request class. Extend this to add request validation or parsing logic.

**Common use cases**: Add methods for checking request characteristics, parsing custom headers, or validating request types.

**Example**: Add a method to check if the request is an AJAX request.

```ts
import { HttpRequest } from '@adonisjs/core/http'

HttpRequest.macro('isAjax', function (this: HttpRequest) {
  return this.header('x-requested-with') === 'XMLHttpRequest'
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/request.ts)
:::

:::option{name="HttpResponse" import="@adonisjs/core/http"}
The HTTP response class. Extend this to add custom response methods or formatters.

**Common use cases**: Add methods for sending formatted responses, setting common headers, or handling specific response types.

**Example**: Add a method for sending paginated JSON responses.

```ts
import { HttpResponse } from '@adonisjs/core/http'

HttpResponse.macro('paginated', function (this: HttpResponse, data: any, meta: any) {
  return this.json({ data, meta })
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/response.ts)
:::

:::option{name="HttpContext" import="@adonisjs/core/http"}
The HTTP context class passed to route handlers and middleware. Extend this to add context-level utilities.

**Common use cases**: Add helpers that combine request and response logic, or add shortcuts for common operations.

**Example**: Add a method to get the current user or fail.

```ts
import { HttpContext } from '@adonisjs/core/http'

HttpContext.macro('getCurrentUser', async function (this: HttpContext) {
  return await this.auth.getUserOrFail()
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/http_context/main.ts)
:::

:::option{name="Route" import="@adonisjs/core/http"}
Individual route instances. Extend this to add custom route configuration methods.

**Common use cases**: Add methods for applying common middleware patterns, setting route metadata, or configuring routes in specific ways.

**Example**: Add a method to mark routes as requiring authentication.

```ts
import { Route } from '@adonisjs/core/http'

Route.macro('protected', function (this: Route) {
  return this.middleware('auth')
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/router/route.ts)
:::

:::option{name="RouteGroup" import="@adonisjs/core/http"}
Route group instances. Extend this to add custom group-level configuration.

**Common use cases**: Add methods for applying common patterns to groups of routes.

**Example**: Add a method to apply API versioning to a group.

```ts
import { RouteGroup } from '@adonisjs/core/http'

RouteGroup.macro('apiVersion', function (this: RouteGroup, version: number) {
  return this.prefix(`/api/v${version}`)
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/router/group.ts)
:::

:::option{name="RouteResource" import="@adonisjs/core/http"}
Resourceful route instances. Extend this to customize resource route behavior.

**Common use cases**: Add methods for customizing which resource routes are created or adding resource-specific middleware.

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/router/resource.ts)
:::

:::option{name="BriskRoute" import="@adonisjs/core/http"}
Brisk (quick) route instances used for simple route definitions. Extend this for shortcuts.

**Common use cases**: Add convenience methods for quick route configurations.

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/router/brisk.ts)
:::

:::option{name="ExceptionHandler" import="@adonisjs/core/http"}
The global exception handler. Extend this to add custom error handling methods.

**Common use cases**: Add methods for handling specific error types or formatting error responses.

**Example**: Add a method to handle validation errors consistently.

```ts
import { ExceptionHandler } from '@adonisjs/core/http'

ExceptionHandler.macro('handleValidationError', function (error: any) {
  return this.ctx.response.status(422).json({ errors: error.messages })
})
```

[View source](https://github.com/adonisjs/http-server/blob/8.x/src/exception_handler.ts)
:::

:::option{name="MultipartFile" import="@adonisjs/core/bodyparser"}
Uploaded file instances. Extend this to add file validation or processing methods.

**Common use cases**: Add methods for validating file types, processing images, or generating thumbnails.

**Example**: Add a method to check if a file is an image.

```ts
import { MultipartFile } from '@adonisjs/core/bodyparser'

MultipartFile.macro('isImage', function (this: MultipartFile) {
  return this.type?.startsWith('image/')
})
```

[View source](https://github.com/adonisjs/bodyparser/blob/11.x/src/multipart/file.ts)
:::

::::

## Extending specific modules

Beyond macros and getters, many AdonisJS modules provide dedicated extension APIs for adding custom implementations. These are designed for more complex integrations like custom drivers or loaders.

The following modules can be extended with custom implementations:

- [Creating a custom hash driver](../security/hashing.md#creating-a-custom-hash-driver) - Add support for custom password hashing algorithms
- [Creating a custom session store](../basics/session.md#creating-a-custom-session-store) - Store sessions in custom backends like MongoDB or Redis
- [Creating a custom social auth driver](../auth/social_authentication.md#creating-a-custom-social-driver) - Add OAuth providers beyond the built-in ones
- [Adding custom REPL methods](../ace/repl.md#adding-custom-methods-to-repl) - Extend the REPL with custom commands
- [Creating a custom translations loader](../digging_deeper/i18n.md#creating-a-custom-translation-loader) - Load translations from custom sources
- [Creating a custom translations formatter](../digging_deeper/i18n.md#creating-a-custom-translation-formatter) - Format translations with custom logic

These extension points go beyond simple methods and properties, allowing you to deeply integrate custom functionality into the framework.

## Next steps

Now that you understand how to extend the framework, you can:

- Learn about [Service Providers](./service_providers.md) to organize extension code in packages
- Explore [Dependency Injection](./dependency_injection.md) to understand how the container works
- Read about [Testing](../testing/introduction.md) to learn how to test your extensions
- Study the [first-party packages](https://github.com/adonisjs) to see real-world extension examples
