---
summary: Learn how to use and create middleware in AdonisJS to handle cross-cutting concerns during HTTP requests
---

# Middleware

Middleware are a series of functions that execute during an HTTP request before the request reaches your route handler. Each middleware in the chain can either terminate the request by sending a response or forward it to the next middleware using the `next` method.

Middleware allows you to encapsulate logic that must run during a request into dedicated, reusable functions or classes. Instead of cluttering your controllers with repetitive logic for parsing request bodies, authenticating users, or logging requests, you can offload these responsibilities to dedicated middleware.

## Middleware stacks

AdonisJS divides middleware into three categories, known as stacks. Each stack serves a different purpose and executes at different points in the request lifecycle.

### Server middleware stack

The server middleware stack executes for every HTTP request your application receives, even when the request URI does not match any registered route. Server middleware run before the router attempts to find a matching route.

Use this stack for operations that apply to all requests without exception, such as logging all requests, handling CORS, or setting security headers globally.

### Router middleware stack

The router middleware stack executes only for requests that have a matching route. If the router cannot find a route for the incoming request, router middleware will not execute at all.

Router middleware run after the router finds a matching route but before any named middleware or the route handler executes. This stack is perfect for concerns that only matter when a valid route exists, such as loading shared data or parsing request body.

### Named middleware collection

Named middleware are explicitly applied to individual routes or route groups. Unlike server and router middleware that run automatically, named middleware only execute when you explicitly reference them on a route.

Named middleware are registered with a name, then applied to routes using that name. They can accept parameters, making them flexible for scenarios like role-based authorization where different routes require different permissions.

## Creating and using middleware

### Generating a middleware

Create a new middleware using the `make:middleware` command. This command generates a scaffolded middleware class in the `app/middleware` directory.

```bash
node ace make:middleware LogRequests
```

```bash
# CREATE: app/middleware/log_requests_middleware.ts
```

The generated middleware contains a basic class structure with a `handle` method:

```ts
// title: app/middleware/log_requests_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class LogRequestsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Middleware logic goes here (before the next call)
     */
    await next()
    /**
     * Middleware logic goes here (after the next call)
     */
  }
}
```

The `handle` method is where you write your middleware logic. It receives two parameters: the `HttpContext` object containing request and response information, and the `next` function to continue the middleware chain.

### Creating a logging middleware

Let's build a practical logging middleware that tracks how long each request takes to complete. This middleware will log the request method, URI, response status, and duration.

```ts
// title: app/middleware/log_requests_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import string from '@adonisjs/core/helpers/string'

export default class LogRequestsMiddleware {
  async handle({ request, response, logger }: HttpContext, next: NextFn) {
    /**
     * Capture the start time before calling next().
     * This happens in the downstream phase.
     */
    const startTime = process.hrtime()
    
    /**
     * Call next() to execute remaining middleware and route handler.
     * The await ensures we wait for the entire chain to complete.
     */
    await next()
    
    /**
     * After next() completes, we're in the upstream phase.
     * The response is ready, so we can log the completion details.
     */
    const endTime = process.hrtime(startTime)
    const responseStatus = response.getStatus()
    const uri = request.url()
    const method = request.method()
    
    logger.info(`${method} ${uri}: ${responseStatus} (${string.prettyHrTime(endTime)})`)
  }
}
```

### Registering server middleware

Server middleware are registered in the `start/kernel.ts` file using lazy imports. The `start/kernel.ts` file exists by default in new AdonisJS projects and comes pre-configured with several middleware. Server middleware execute in the order they are registered.

```ts
// title: start/kernel.ts
import server from '@adonisjs/core/services/server'

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('#middleware/log_requests_middleware'), // [!code++]
])
```


:::tip
Always use lazy imports with the `() => import()` syntax for middleware registration. This enables Hot Module Replacement (HMR) during development.
:::

## Understanding middleware execution flow

Middleware execute in two phases: the **downstream phase** and the **upstream phase**. Understanding this flow is crucial for knowing where to place your logic within a middleware.

The downstream phase occurs before the `await next()` call. During this phase, the request travels through each middleware in order: Server middleware → Router middleware → Named middleware → Route handler.

The upstream phase occurs after the `await next()` call. During this phase, the response travels back through the middleware in reverse order: Route handler → Named middleware → Router middleware → Server middleware.

```
Request Flow (Downstream):
  ↓ Server Middleware
  ↓ Router Middleware  
  ↓ Named Middleware
  ↓ Route Handler

Response Flow (Upstream):
  ↑ Named Middleware
  ↑ Router Middleware
  ↑ Server Middleware
  ↑ Client receives response
```

This two-phase execution allows middleware to execute logic both before and after the route handler runs. The logging middleware example demonstrates this pattern by capturing the start time in the downstream phase and calculating the duration in the upstream phase.

## Named middleware with parameters

Named middleware provide flexibility by allowing you to apply them selectively to specific routes and pass parameters to customize their behavior.

### Creating an authorization middleware

Let's create a named middleware that checks if the authenticated user has the required role or permissions to access a route. Named middleware can accept a third parameter for options, making them configurable per-route.

```ts
// title: app/middleware/authorize_request_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

type AuthorizationOptions = 
  | { permissions: string[] }
  | { role: string }

export default class AuthorizeRequestMiddleware {
  /**
   * The third parameter 'options' contains the authorization requirements
   * specified when applying this middleware to a route.
   */
  async handle({ auth, response }: HttpContext, next: NextFn, options: AuthorizationOptions) {
    /**
     * Get the authenticated user or throw an exception
     */
    const user = auth.getUserOrFail()
    
    /**
     * Check if the user has the required role
     */
    if ('role' in options && user.role !== options.role) {
      return response.unauthorized('Not authorized to access this route')
    }
    
    /**
     * Check if the user has all required permissions
     */
    if ('permissions' in options) {
      const hasPermission = options.permissions.every(permission => 
        user.permissions.includes(permission)
      )
      
      if (!hasPermission) {
        return response.unauthorized('Not authorized to access this route')
      }
    }
    
    /**
     * User is authorized, continue to the next middleware or handler
     */
    await next()
  }
}
```

### Registering named middleware

Named middleware are registered with a name in the `start/kernel.ts` file. Export them so they can be referenced in your routes with full TypeScript type safety.

```ts
// title: start/kernel.ts
import router from '@adonisjs/core/services/router'

export const middleware = router.named({
  authorize: () => import('#middleware/authorize_request_middleware'),
})
```

### Applying named middleware to routes

Named middleware are applied to routes using the `.use()` method. Import the middleware collection from `start/kernel.ts` to get full TypeScript autocomplete and type checking for the options parameter.

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router
  .get('/admin/reports', async () => {
    return { message: 'Admin reports' }
  })
  .use(middleware.authorize({ role: 'admin' }))

router
  .post('/posts', async () => {
    return { message: 'Post created' }
  })
  .use(middleware.authorize({ permissions: ['posts.create'] }))
```

## Dependency injection in middleware

Middleware classes are instantiated using the IoC container, allowing you to inject dependencies directly into the middleware constructor. Dependencies can only be injected through the constructor, not as method parameters. The container will automatically resolve and inject your dependencies when creating the middleware instance.

```ts
// title: app/middleware/rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import RateLimitService from '#services/rate_limit_service'

export default class RateLimitMiddleware {
  /**
   * The IoC container automatically creates an instance of 
   * RateLimitService and injects it here.
   */
  constructor(protected rateLimitService: RateLimitService) {}

  async handle({ request, response }: HttpContext, next: NextFn) {
    const ip = request.ip()
    const isAllowed = await this.rateLimitService.checkLimit(ip)
    
    if (!isAllowed) {
      return response.tooManyRequests('Rate limit exceeded')
    }
    
    await next()
  }
}
```

See also: [Dependency Injection guide](../concepts/dependency_injection.md)

## Modifying the response

Middleware can modify the response during both the downstream and upstream phases. Since the response object is mutable, changes you make in middleware will affect the final response sent to the client.

### Adding headers in the upstream phase

A common pattern is adding headers to the response after the route handler completes. Placing header logic after `await next()` ensures the response has been fully constructed by the handler before you modify it.

```ts
// title: app/middleware/add_headers_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AddHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    /**
     * Wait for the handler to construct the response
     */
    await next()
    
    /**
     * Add custom headers after the response is ready
     */
    response.header('X-Powered-By', 'AdonisJS')
    response.header('X-Response-Time', Date.now().toString())
  }
}
```

### Transforming the response body

You can also transform the response body in middleware by accessing and modifying it in the upstream phase. This middleware wraps all response bodies in a consistent format with metadata.

```ts
// title: app/middleware/wrap_response_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class WrapResponseMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    /**
     * Wait for the handler to generate the response
     */
    await next()
    
    /**
     * Wrap the original response in a standard envelope
     */
    const body = response.getBody()
    
    response.send({
      success: true,
      data: body,
      timestamp: new Date().toISOString()
    })
  }
}
```

## Exception handling

When a middleware throws an exception, AdonisJS's global exception handler catches and processes it just like exceptions thrown from route handlers. The upstream flow continues as normal, meaning any middleware that already executed in the downstream phase will still execute their upstream code.

```ts
// title: app/middleware/validate_api_key_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { errors } from '@adonisjs/core'

export default class ValidateApiKeyMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const apiKey = request.header('X-API-Key')
    
    if (!apiKey) {
      /**
       * Throwing an exception terminates the request.
       * The global exception handler will catch and handle this.
       */
      throw new errors.E_UNAUTHORIZED_ACCESS('API key is required')
    }
    
    await next()
  }
}
```

See also: [Exception handling guide](../concepts/exception_handling.md)

## Conditional middleware execution

AdonisJS does not provide a way to conditionally register or apply middleware at runtime. However, middleware can use configuration files to decide at runtime whether they should execute for the current request. This pattern lets you control middleware behavior through environment variables or configuration files without changing your middleware registration.

```ts
// title: config/features.ts
export default {
  enableRateLimit: env.get('ENABLE_RATE_LIMIT', true),
}
```
```ts
// title: app/middleware/rate_limit_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import featuresConfig from '#config/features'

export default class RateLimitMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Skip rate limiting if disabled in configuration.
     * Immediately call next() to make this middleware a no-op.
     */
    if (!featuresConfig.enableRateLimit) {
      return next()
    }
    
    /**
     * Apply rate limiting logic when enabled
     */
    // ... rate limit checks
    
    await next()
  }
}
```

## Augmenting the HttpContext

Middleware can add custom properties to the `HttpContext` object to share data with downstream middleware and route handlers. However, this requires TypeScript module augmentation to ensure the properties appear at the type level.

### Adding properties to the context

```ts
// title: app/middleware/detect_tenant_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class DetectTenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Detect tenant from subdomain, header, or database
     */
    const tenant = await this.detectTenant(ctx)
    
    /**
     * Add tenant to context for downstream middleware and handlers
     */
    ctx.tenant = tenant
    
    await next()
  }
  
  private async detectTenant(ctx: HttpContext) {
    // ... tenant detection logic
    return { id: 1, name: 'Acme Corp' }
  }
}
```

### Augmenting the HttpContext type

To make TypeScript aware of the new `tenant` property, you must augment the `HttpContext` interface. After augmentation, TypeScript will recognize `ctx.tenant` in all your middleware and route handlers.

```ts
// title: types/http.ts
declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenant: {
      id: number
      name: string
    }
  }
}
```


:::warning

When you augment the `HttpContext` interface, the type changes are global. However, if you add properties via named middleware that only runs on specific routes, those properties will not exist at runtime on routes where the middleware doesn't execute. Only augment the `HttpContext` in server or router middleware that run broadly across your application.

:::

## Common mistakes

### Forgetting to call next()

A common mistake is forgetting to call the `next()` function in your middleware. Without calling `next()`, the middleware chain stops and your route handler never executes. The request will appear to hang.

Always call `await next()` unless you're intentionally terminating the request by sending a response:

```ts
async handle(ctx: HttpContext, next: NextFn) {
  console.log('Before handler')
  // Request stops here!
}
```

```ts
// ✅ Correct: Always call await next()
async handle(ctx: HttpContext, next: NextFn) {
  console.log('Before handler')
  await next()
  console.log('After handler')
}
```

```ts
// ✅ Also correct: Terminating early with a response
async handle({ response }: HttpContext, next: NextFn) {
  if (someCondition) {
    return response.unauthorized()
    // No next() needed - we're ending the request
  }
  await next()
}
```

### Trying to use middleware directly on routes

Another common mistake is trying to apply middleware directly on routes using lazy imports instead of registering them as named middleware first.

Named middleware must be registered in `start/kernel.ts` before you can use them on routes. This registration is what enables parameter passing and type safety.

```ts
// ❌ Wrong: Trying to use middleware directly
router
  .get('/admin', () => {})
  .use(() => import('#middleware/authorize_request_middleware'))

// ✅ Correct: Register in start/kernel.ts first
// start/kernel.ts
export const middleware = router.named({
  authorize: () => import('#middleware/authorize_request_middleware'),
})

// start/routes.ts
import { middleware } from '#start/kernel'
router
  .get('/admin', () => {})
  .use(middleware.authorize({ role: 'admin' }))
```