# Response

This reference guide covers the AdonisJS Response class and the methods available to construct HTTP responses. You will learn how to send different types of response bodies (text, JSON, HTML), work with response headers, handle redirects, stream files and downloads, set response status codes, manage cookies, run cleanup actions after responses are sent, understand response body serialization, and extend the Response class with custom methods.

## Overview

The Response class provides helpers for constructing HTTP responses in AdonisJS applications. Instead of working directly with Node.js's raw response object, the Response class offers a fluent, expressive API for common tasks like sending JSON, setting headers, handling redirects, and streaming file downloads.

The Response class is available via the `HttpContext` using the `response` property. You can access it in route handlers, middleware, and exception handlers throughout your application. For many simple responses, you can return values directly from route handlers, and AdonisJS will automatically use the Response class to send them.

See also: [HttpContext reference](./http_context.md)

## Sending response body

The Response class provides multiple ways to send response bodies. You can either return values directly from route handlers or use explicit response methods.

### Returning values from route handlers

The simplest approach is to return values directly from your route handler. AdonisJS will automatically serialize the value and set appropriate content headers:

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'

router.get('/', async () => {
  /**
   * Returns plain text with content-type: text/plain
   */
  return 'This is the homepage.'
})

router.get('/welcome', async () => {
  /**
   * Returns HTML fragment with content-type: text/html
   */
  return '<p>This is the homepage</p>'
})

router.get('/api/page', async () => {
  /**
   * Returns JSON with content-type: application/json
   */
  return { page: 'home' }
})

router.get('/timestamp', async () => {
  /**
   * Date instances are converted to ISO strings
   */
  return new Date()
})
```

### Using response.send()

You can also explicitly use the `response.send()` method, which provides the same automatic content-type detection:

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'

router.get('/', async ({ response }) => {
  /**
   * send() method works identically to returning values.
   * Useful when you need to set headers or status before sending.
   */
  response.send('This is the homepage')
})

router.get('/data', async ({ response }) => {
  /**
   * Objects and arrays are automatically stringified
   */
  response.send({ page: 'home' })
})
```

### Forcing JSON responses

When you need to ensure the response is sent as JSON (even if it might be detected as HTML), use the `response.json()` method:

```ts
// title: app/controllers/posts_controller.ts
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    const posts = await Post.all()
    
    /**
     * Explicitly sets content-type to application/json
     * and serializes the posts array
     */
    response.json(posts)
  }
}
```

See also: [Response body serialization](#response-body-serialization) for details on how different data types are handled.

## Working with headers

The Response class provides methods for setting, appending, and removing HTTP headers. Headers must be set before the response body is sent.

### Setting headers

Use the `response.header()` method to set a response header. If the header already exists, it will be overridden:

```ts
// title: app/controllers/api_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class ApiController {
  async index({ response }: HttpContext) {
    /**
     * Set custom header for API versioning
     */
    response.header('X-API-Version', 'v1')
    
    /**
     * Set cache control headers
     */
    response.header('Cache-Control', 'public, max-age=3600')
    
    return { status: 'ok' }
  }
}
```

### Setting headers safely

The `response.safeHeader()` method sets a header only if it doesn't already exist. This is useful when you want to provide a default value without overriding existing headers:

```ts
// title: app/middleware/cors_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class CorsMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    /**
     * Set CORS header only if not already set by another middleware
     */
    response.safeHeader('Access-Control-Allow-Origin', '*')
    
    await next()
  }
}
```

### Appending to headers

Some headers can have multiple values. Use `response.append()` to add additional values without removing existing ones:

```ts
// title: app/controllers/downloads_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class DownloadsController {
  async show({ response }: HttpContext) {
    /**
     * Append multiple Set-Cookie headers for different cookies
     */
    response.append('Set-Cookie', 'session=abc123; HttpOnly')
    response.append('Set-Cookie', 'preferences=dark-mode; Path=/')
    
    return { download: 'ready' }
  }
}
```

### Removing headers

Remove a previously set header using `response.removeHeader()`:

```ts
// title: app/middleware/security_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SecurityMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    await next()
    
    /**
     * Remove server header to hide server implementation details
     */
    response.removeHeader('X-Powered-By')
  }
}
```

## Handling redirects

The `response.redirect()` method returns an instance of the `Redirect` class, which provides a fluent API for creating redirect responses with different destinations and options.

### Redirecting to a path

Use `response.redirect().toPath()` to redirect to a specific URI or external URL:

```ts
// title: app/controllers/auth_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async logout({ response, auth }: HttpContext) {
    await auth.logout()
    
    /**
     * Redirect to the home page after logout
     */
    response.redirect().toPath('/')
  }
  
  async external({ response }: HttpContext) {
    /**
     * Redirect to an external website
     */
    response.redirect().toPath('https://adonisjs.com')
  }
}
```

### Redirecting to a named route

The `response.redirect().toRoute()` method accepts a route identifier and its parameters, making redirects maintainable when URLs change:

```ts
// title: app/controllers/posts_controller.ts
import Post from '#models/post'
import { createPostValidator } from '#validators/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    /**
     * Validate the incoming request data
     */
    const payload = await request.validateUsing(createPostValidator)
    
    /**
     * Create the post
     */
    const post = await Post.create(payload)
    
    /**
     * Redirect to the show page for the newly created post
     */
    response.redirect().toRoute('posts.show', [post.id])
  }
}
```

### Redirecting back

Use `response.redirect().back()` to redirect to the previous page. This uses the referrer header and falls back to `/` if the referrer is not available:

```ts
// title: app/controllers/comments_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class CommentsController {
  async destroy({ response, params }: HttpContext) {
    /**
     * Delete the comment logic here
     */
    
    /**
     * Redirect back to the page the user came from
     */
    response.redirect().back()
  }
}
```

### Setting redirect status code

By default, redirects use a `302` status code. Use the `status()` method to set a different redirect status:

```ts
// title: app/controllers/pages_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class PagesController {
  async oldPage({ response }: HttpContext) {
    /**
     * Permanent redirect (301) for moved pages
     */
    response.redirect().status(301).toPath('/new-page')
  }
}
```

### Forwarding query strings

Use the `withQs()` method to forward the current URL's query string to the redirect destination:

```ts
// title: app/controllers/search_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class SearchController {
  async filter({ response }: HttpContext) {
    /**
     * Forward existing query parameters to the new URL.
     * If the current URL is /search?q=adonis&sort=date,
     * this redirects to /results?q=adonis&sort=date
     */
    response.redirect().withQs().toPath('/results')
  }
}
```

### Setting custom query strings

Pass an object to `withQs()` to set custom query parameters. Chain the method multiple times to append additional parameters:

```ts
// title: app/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class ProductsController {
  async search({ response }: HttpContext) {
    /**
     * Redirect with custom query parameters.
     * Results in /products?category=electronics&sort=price
     */
    response
      .redirect()
      .withQs({ category: 'electronics' })
      .withQs({ sort: 'price' })
      .toPath('/products')
  }
}
```

## Streaming and downloads

The Response class provides methods for streaming data and serving file downloads. These methods handle proper headers, caching, and cleanup automatically.

### Streaming responses

Use `response.stream()` to send a readable stream as the response. AdonisJS waits for the route handler and upstream middleware to finish before beginning to read from the stream:

```ts
// title: app/controllers/exports_controller.ts
import { createReadStream } from 'node:fs'
import type { HttpContext } from '@adonisjs/core/http'

export default class ExportsController {
  async generate({ response }: HttpContext) {
    /**
     * Create a readable stream from a file
     */
    const stream = createReadStream('./exports/data.csv')
    
    /**
     * Stream the file to the client.
     * AdonisJS handles backpressure and cleanup automatically.
     */
    response.stream(stream)
  }
}
```

### Downloading files

The `response.download()` method streams a file and sets appropriate headers for downloads. It accepts an absolute path to the file:

```ts
// title: app/controllers/invoices_controller.ts
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'

export default class InvoicesController {
  async download({ response, params }: HttpContext) {
    /**
     * Construct absolute path to the invoice file
     */
    const filePath = app.makePath(`storage/invoices/${params.id}.pdf`)
    
    /**
     * Stream the file for download with ETag support.
     * Browser caches the response as long as file contents remain unchanged.
     */
    response.download(filePath)
  }
}
```

### Force download with custom filename

Use `response.attachment()` to force a download and specify a custom filename. The browser will prompt the user to save the file with the given name:

```ts
// title: app/controllers/reports_controller.ts
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'

export default class ReportsController {
  async export({ response, params }: HttpContext) {
    /**
     * Absolute path to the report file
     */
    const filePath = app.makePath(`storage/reports/${params.id}.xlsx`)
    
    /**
     * Force download with a user-friendly filename.
     * The second parameter sets the filename in Content-Disposition header.
     */
    response.attachment(filePath, `monthly-report-${params.month}.xlsx`)
  }
}
```

## Setting response status

The Response class provides methods for setting HTTP status codes. Status codes communicate the result of the request to the client.

### Setting status code

Use `response.status()` to set the HTTP status code. This method overrides any previously set status code:

```ts
// title: app/controllers/api/posts_controller.ts
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    const post = await Post.create(request.all())
    
    /**
     * Return 201 Created for successful resource creation
     */
    response.status(201)
    
    return post
  }
}
```

### Setting status safely

The `response.safeStatus()` method sets a status code only if one hasn't been set already. This is useful in middleware where you want to provide a default without overriding explicit status codes:

```ts
// title: app/middleware/json_api_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class JsonApiMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    await next()
    
    /**
     * Set default success status only if not already set.
     * Controller-specific status codes take precedence.
     */
    response.safeStatus(200)
  }
}
```

### Status shorthand methods

AdonisJS provides shorthand methods that set both the status code and response body in one call:

```ts
// title: app/controllers/users_controller.ts
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async show({ response, params }: HttpContext) {
    const user = await User.find(params.id)
    
    if (!user) {
      /**
       * Sets status 404 and sends response body in one call
       */
      return response.notFound({ error: 'User not found' })
    }
    
    return user
  }
  
  async destroy({ response, params, auth }: HttpContext) {
    const user = await User.findOrFail(params.id)
    
    if (user.id !== auth.user.id) {
      /**
       * Sets status 403 and sends error message
       */
      return response.forbidden({ error: 'Cannot delete other users' })
    }
    
    await user.delete()
    return response.noContent()
  }
}
```

### Response shorthand methods

AdonisJS provides shorthand methods for common HTTP status codes. Each method sets the status code and optionally sends a response body:

| Method | Status Code | Description |
|--------|-------------|-------------|
| `response.continue()` | 100 | Continue |
| `response.switchingProtocols()` | 101 | Switching Protocols |
| `response.ok(body?, generateEtag?)` | 200 | OK |
| `response.created(body?, generateEtag?)` | 201 | Created |
| `response.accepted(body?, generateEtag?)` | 202 | Accepted |
| `response.nonAuthoritativeInformation(body?, generateEtag?)` | 203 | Non-Authoritative Information |
| `response.noContent()` | 204 | No Content |
| `response.resetContent()` | 205 | Reset Content |
| `response.partialContent(body?, generateEtag?)` | 206 | Partial Content |
| `response.multipleChoices(body?, generateEtag?)` | 300 | Multiple Choices |
| `response.movedPermanently(body?, generateEtag?)` | 301 | Moved Permanently |
| `response.movedTemporarily(body?, generateEtag?)` | 302 | Found (Moved Temporarily) |
| `response.seeOther(body?, generateEtag?)` | 303 | See Other |
| `response.notModified(body?, generateEtag?)` | 304 | Not Modified |
| `response.useProxy(body?, generateEtag?)` | 305 | Use Proxy |
| `response.temporaryRedirect(body?, generateEtag?)` | 307 | Temporary Redirect |
| `response.badRequest(body?, generateEtag?)` | 400 | Bad Request |
| `response.unauthorized(body?, generateEtag?)` | 401 | Unauthorized |
| `response.paymentRequired(body?, generateEtag?)` | 402 | Payment Required |
| `response.forbidden(body?, generateEtag?)` | 403 | Forbidden |
| `response.notFound(body?, generateEtag?)` | 404 | Not Found |
| `response.methodNotAllowed(body?, generateEtag?)` | 405 | Method Not Allowed |
| `response.notAcceptable(body?, generateEtag?)` | 406 | Not Acceptable |
| `response.proxyAuthenticationRequired(body?, generateEtag?)` | 407 | Proxy Authentication Required |
| `response.requestTimeout(body?, generateEtag?)` | 408 | Request Timeout |
| `response.conflict(body?, generateEtag?)` | 409 | Conflict |
| `response.gone(body?, generateEtag?)` | 410 | Gone |
| `response.lengthRequired(body?, generateEtag?)` | 411 | Length Required |
| `response.preconditionFailed(body?, generateEtag?)` | 412 | Precondition Failed |
| `response.requestEntityTooLarge(body?, generateEtag?)` | 413 | Payload Too Large |
| `response.requestUriTooLong(body?, generateEtag?)` | 414 | URI Too Long |
| `response.unsupportedMediaType(body?, generateEtag?)` | 415 | Unsupported Media Type |
| `response.requestedRangeNotSatisfiable(body?, generateEtag?)` | 416 | Range Not Satisfiable |
| `response.expectationFailed(body?, generateEtag?)` | 417 | Expectation Failed |
| `response.unprocessableEntity(body?, generateEtag?)` | 422 | Unprocessable Entity |
| `response.tooManyRequests(body?, generateEtag?)` | 429 | Too Many Requests |
| `response.internalServerError(body?, generateEtag?)` | 500 | Internal Server Error |
| `response.notImplemented(body?, generateEtag?)` | 501 | Not Implemented |
| `response.badGateway(body?, generateEtag?)` | 502 | Bad Gateway |
| `response.serviceUnavailable(body?, generateEtag?)` | 503 | Service Unavailable |
| `response.gatewayTimeout(body?, generateEtag?)` | 504 | Gateway Timeout |
| `response.httpVersionNotSupported(body?, generateEtag?)` | 505 | HTTP Version Not Supported |

## Working with cookies

The Response class provides methods for setting cookies with different security levels. AdonisJS supports signed cookies, encrypted cookies, and plain cookies.

### Setting signed cookies

The `response.cookie()` method creates a signed cookie. Signed cookies can be verified but their content is visible to the client:

```ts
// title: app/controllers/preferences_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class PreferencesController {
  async update({ response, request }: HttpContext) {
    const theme = request.input('theme')
    
    /**
     * Set a signed cookie that expires in 2 hours.
     * The signature prevents client-side tampering.
     */
    response.cookie('theme', theme, {
      maxAge: '2h'
    })
    
    return { success: true }
  }
}
```

### Setting encrypted cookies

Use `response.encryptedCookie()` to encrypt cookie values. The `app.appKey` encrypts the value, making it unreadable to clients. If the app key changes, the cookie cannot be decrypted:

```ts
// title: app/controllers/sessions_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionsController {
  async create({ response, auth }: HttpContext) {
    /**
     * Store sensitive session data in an encrypted cookie.
     * The value is encrypted using app.appKey.
     */
    response.encryptedCookie('session_data', {
      userId: auth.user.id,
      loginAt: new Date()
    })
    
    return { success: true }
  }
}
```

### Setting plain cookies

The `response.plainCookie()` method creates a base64-encoded cookie without signing or encryption:

```ts
// title: app/controllers/tracking_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class TrackingController {
  async view({ response }: HttpContext) {
    /**
     * Set a plain cookie for non-sensitive tracking data
     */
    response.plainCookie('last_visit', new Date().toISOString())
    
    return { success: true }
  }
}
```

### Cookie options

All cookie methods accept an options object to control cookie behavior. These options match the configuration in `config/app.ts` under the `http.cookie` block:

```ts
// title: app/controllers/auth_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async login({ response, auth }: HttpContext) {
    /**
     * Set authentication cookie with security options
     */
    response.encryptedCookie('auth_token', auth.token, {
      domain: '',
      path: '/',
      maxAge: '2h',
      httpOnly: true,      // Prevent JavaScript access
      secure: true,        // Only send over HTTPS
      sameSite: 'lax',     // CSRF protection
      partitioned: false,  // Experimental: CHIPS
      priority: 'medium'   // Experimental: Cookie priority
    })
    
    return { success: true }
  }
}
```

### Supported cookie value types

Cookie values can be any of the following data types: string, number, bigInt, boolean, null, object, or array. Objects and arrays are automatically serialized:

```ts
// title: app/controllers/cart_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class CartController {
  async add({ response, request }: HttpContext) {
    const cartItems = [
      { id: 1, name: 'Product A', quantity: 2 },
      { id: 2, name: 'Product B', quantity: 1 }
    ]
    
    /**
     * Arrays and objects are automatically serialized
     */
    response.encryptedCookie('cart', cartItems)
    
    return { success: true }
  }
}
```

### Cookie options reference

| Option | Type | Description |
|--------|------|-------------|
| `domain` | `string` | Cookie domain. Empty string means current domain. |
| `path` | `string` | Cookie path. Default is `/`. |
| `maxAge` | `string \| number` | Cookie expiry time. Can be a duration string like `'2h'` or milliseconds. |
| `httpOnly` | `boolean` | Prevent JavaScript access to the cookie. |
| `secure` | `boolean` | Only send cookie over HTTPS connections. |
| `sameSite` | `'lax' \| 'strict' \| 'none'` | CSRF protection. Default is `'lax'`. |
| `partitioned` | `boolean` | Experimental: Enable cookie partitioning (CHIPS). |
| `priority` | `'low' \| 'medium' \| 'high'` | Experimental: Cookie priority hint for browsers. |

See also: [Config reference](./config.md) for global cookie configuration.

## Running actions after response has been sent

The `response.onFinish()` method allows you to register callbacks that execute after the response has been sent to the client. This is useful for cleanup tasks, logging, or operations that shouldn't block the response.

### Cleaning up after file downloads

A common use case is deleting temporary files after they've been streamed to the client:

```ts
// title: app/controllers/files_controller.ts
import { unlink } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'

export default class FilesController {
  async download({ response, params }: HttpContext) {
    const filePath = app.makePath(`tmp/exports/${params.id}.zip`)
    
    /**
     * Register cleanup callback before streaming the file
     */
    response.onFinish(async () => {
      await unlink(filePath)
    })
    
    /**
     * Stream the file. After the download completes,
     * the cleanup callback will run automatically.
     */
    response.download(filePath)
  }
}
```

### Logging response metrics

You can use `onFinish()` to log analytics or metrics without delaying the response:

```ts
// title: app/middleware/analytics_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AnalyticsMiddleware {
  async handle({ response, request }: HttpContext, next: NextFn) {
    const startTime = Date.now()
    
    /**
     * Register analytics logging after response is sent.
     * This doesn't delay the response to the client.
     */
    response.onFinish(() => {
      const duration = Date.now() - startTime
      console.log(`${request.method()} ${request.url()} - ${duration}ms`)
    })
    
    await next()
  }
}
```

## Response body serialization

The Response class automatically serializes response bodies and sets appropriate content-type headers. Understanding this process helps you control how different data types are handled.

### Automatic serialization

When you send a response, AdonisJS serializes the body based on its data type:

- **Arrays and objects** are stringified using a safe stringify function similar to `JSON.stringify()`, but with circular references removed and BigInt values serialized
- **Numbers and booleans** are converted to strings
- **Date instances** are converted to ISO strings by calling `toISOString()`
- **Regular expressions and error objects** are converted to strings by calling `toString()`
- **Other data types** result in an exception

### Content-type inference

After serializing the response, AdonisJS automatically infers and sets the `content-type` and `content-length` headers:

- **`application/json`** for arrays and objects
- **`text/html`** for HTML fragments (strings starting with `<`)
- **`text/javascript`** for JSONP responses
- **`text/plain`** for everything else

This automatic detection means you rarely need to set content-type headers manually:

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'

router.get('/api/data', async () => {
  /**
   * Returns JSON with content-type: application/json
   * BigInt values are safely serialized as strings
   */
  return {
    id: BigInt(9007199254740991),
    timestamp: new Date(),
    active: true
  }
})

router.get('/page', async () => {
  /**
   * Returns HTML with content-type: text/html
   */
  return '<h1>Welcome</h1>'
})

router.get('/text', async () => {
  /**
   * Returns plain text with content-type: text/plain
   */
  return 'Hello, world!'
})
```

### Handling special cases

For complete control over serialization, implement a `toJSON()` method on your objects:

```ts
// title: app/models/user.ts
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class User extends BaseModel {
  @column()
  declare email: string
  
  @column()
  declare password: string
  
  @column.dateTime()
  declare createdAt: DateTime
  
  /**
   * Custom serialization to exclude sensitive fields
   * and format dates
   */
  toJSON() {
    return {
      email: this.email,
      memberSince: this.createdAt.toISODate()
      // password intentionally excluded
    }
  }
}
```

## Extending Response class

You can add custom methods to the Response class using macros. This allows you to create reusable response helpers that match your application's needs.

### Adding custom methods

Use `Response.macro()` to add methods to all Response instances throughout your application:

```ts
// title: providers/app_provider.ts
import { Response } from '@adonisjs/core/http'

export default class AppProvider {
  async boot() {
    /**
     * Add a custom method to send API responses with consistent structure
     */
    Response.macro('api', function (data: any, meta?: Record<string, any>) {
      return this.json({
        success: true,
        data: data,
        meta: meta || {}
      })
    })
    
    /**
     * Add a custom method for paginated responses
     */
    Response.macro('paginated', function (items: any[], pagination: any) {
      return this.json({
        data: items,
        pagination: {
          page: pagination.page,
          perPage: pagination.perPage,
          total: pagination.total
        }
      })
    })
  }
}
```

### Using custom methods

Once defined, your custom methods are available on all Response instances:

```ts
// title: app/controllers/posts_controller.ts
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    const posts = await Post.all()
    
    /**
     * Use the custom api() method for consistent responses
     */
    return response.api(posts, {
      version: 'v1',
      timestamp: new Date()
    })
  }
  
  async paginated({ response, request }: HttpContext) {
    const page = request.input('page', 1)
    const posts = await Post.query().paginate(page, 20)
    
    /**
     * Use the custom paginated() method
     */
    return response.paginated(posts.all(), posts.getMeta())
  }
}
```

### TypeScript support

To get TypeScript support for your custom methods, augment the Response interface:

```ts
// title: types/response.ts
import { Response } from '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  export interface Response {
    /**
     * Send a standardized API response
     */
    api(data: any, meta?: Record<string, any>): void
    
    /**
     * Send a paginated response
     */
    paginated(items: any[], pagination: {
      page: number
      perPage: number
      total: number
    }): void
  }
}
```

See also: [Extending AdonisJS guide](../guides/extending_adonisjs.md) for comprehensive information about macros and extending framework classes.

## Related documentation

- [HttpContext reference](./http_context.md) - Learn about the HttpContext object that provides access to the Response instance
- [Request reference](./request.md) - Explore the Request class for reading incoming HTTP requests
- [Config reference](./config.md) - Configure global cookie settings and other HTTP options
- [Extending AdonisJS](../guides/extending_adonisjs.md) - Deep dive into macros and framework extensibility