---
description: Learn how to construct HTTP responses in AdonisJS, including sending different response formats, headers, cookies, redirects, and file downloads.
---

# Response

This guide covers the AdonisJS Response class and the methods available to construct HTTP responses. You will learn about:

- Sending response bodies in different formats
- Working with headers and cookies
- Handling redirects and file downloads
- Understanding how the response serialization works
- Extending the Response class with custom methods

## Overview

The Response class provides helpers for constructing HTTP responses in AdonisJS applications. Instead of working directly with Node.js's raw response object, the Response class offers a fluent, expressive API for common tasks like sending JSON, setting headers, handling redirects, and streaming file downloads.

The Response class is available via the `ctx.response` property. You can access it in route handlers, middleware, and exception handlers throughout your application. For many simple responses, you can return values directly from route handlers, and AdonisJS will automatically use the Response class to send them.

## Sending response body

The Response class provides multiple ways to send response bodies. You can either return values directly from route handlers or use explicit response methods.

### Returning values from route handlers

The simplest approach is to return values directly from your route handler. AdonisJS will automatically serialize the value and set appropriate content headers.

```ts title="start/routes.ts"
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

You can also explicitly use the `response.send()` method, which provides the same automatic content-type detection.

```ts title="start/routes.ts"
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

When you need to ensure the response is sent as JSON (even if it might be detected as HTML), use the `response.json()` method.

See also: [Response body serialization](#response-body-serialization)

```ts title="app/controllers/posts_controller.ts"
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

## Working with headers

The Response class provides methods for setting, appending, and removing HTTP headers. Headers must be set before the response body is sent.

### Setting headers

Use the `response.header()` method to set a response header. If the header already exists, it will be overridden.

```ts title="app/controllers/api_controller.ts"
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

The `response.safeHeader()` method sets a header only if it doesn't already exist. This is useful when you want to provide a default value without overriding existing headers.

```ts title="app/middleware/cors_middleware.ts"
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

Some headers can have multiple values. Use `response.append()` to add additional values without removing existing ones.

```ts title="app/controllers/downloads_controller.ts"
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

Remove a previously set header using `response.removeHeader()`.

```ts title="app/middleware/security_middleware.ts"
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

Use `response.redirect().toPath()` to redirect to a specific URI or external URL.

```ts title="app/controllers/auth_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async logout({ response, auth }: HttpContext) {
    await auth.logout()
    
    /**
     * Redirect to the home page after logout
     */
    // [!code highlight]
    response.redirect().toPath('/')
  }
  
  async external({ response }: HttpContext) {
    /**
     * Redirect to an external website
     */
    // [!code highlight]
    response.redirect().toPath('https://adonisjs.com')
  }
}
```

### Redirecting to a named route

The `response.redirect().toRoute()` method accepts a route identifier and its parameters, making redirects maintainable when URLs change.

```ts title="app/controllers/posts_controller.ts"
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
    // [!code highlight]
    response.redirect().toRoute('posts.show', [post.id])
  }
}
```

### Redirecting back

Use `response.redirect().back()` to redirect to the previous page. The method reads the `Referer` header and validates that the referrer's host matches the current request's host (the HTTP/2 `:authority` pseudo-header, or the `Host` header). If the referrer is missing, invalid, or from an unknown host, the redirect falls back to `/`.

You can provide a custom fallback URL as an argument to `back()`.

```ts title="app/controllers/comments_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class CommentsController {
  async destroy({ response, params }: HttpContext) {
    /**
     * Redirect back to the page the user came from.
     * Falls back to /posts if no valid referrer is found.
     */
    response.redirect().back('/posts')
  }
}
```

### Allowing external referrer hosts

By default, `back()` only accepts referrers that match the current request's host. This prevents open redirect attacks where a malicious referrer could send users to an external site.

If your application spans multiple domains (for example, `app.example.com` and `admin.example.com`), you can add trusted hosts to the `redirect.allowedHosts` config so that `back()` accepts referrers from those domains as well.

```ts title="config/app.ts"
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  redirect: {
    allowedHosts: [
      'app.example.com',
      'admin.example.com',
    ],
  },
})
```

### Customizing previous URL resolution

When using the `@adonisjs/session` package, you can store a previous URL in the session by setting the `redirect.previousUrl` property. When set, `back()` will use the session value instead of the `Referer` header.

This is useful when your application redirects users to third-party websites (like OAuth providers). The browser's `Referer` header will point to the external site when the user returns, so `back()` would fall back to `/` instead of the page the user was originally on. By storing the intended return URL in the session before the redirect, you ensure `back()` takes them to the right place.

```ts title="app/controllers/auth_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async redirectToProvider({ session, response }: HttpContext) {
    /**
     * Store the current URL so back() returns here
     * after the OAuth flow completes
     */
    session.put('redirect.previousUrl', '/dashboard')
    response.redirect().toPath('https://accounts.google.com/o/oauth2/auth')
  }

  async handleCallback({ response }: HttpContext) {
    /**
     * This will redirect to /dashboard (from the session)
     * instead of using the Referer header
     */
    response.redirect().back()
  }
}
```

:::note
The session-based previous URL resolution requires the `@adonisjs/session` package. Without it, `back()` will always use the `Referer` header.
:::

### Setting redirect status code

By default, redirects use a `302` status code. Use the `status()` method to set a different redirect status.

```ts title="app/controllers/pages_controller.ts"
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

Query string forwarding is enabled by default in AdonisJS starter kits via the `redirect.forwardQueryString` option in your server config. You can verify this in your `config/app.ts` file.

```ts title="config/app.ts"
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  redirect: {
    forwardQueryString: true,
  },
})
```

When enabled, all redirects automatically carry over the current URL's query string to the destination. For example, if the current URL is `/search?q=adonis&sort=date` and you redirect to `/results`, the user will be sent to `/results?q=adonis&sort=date`.

You can disable forwarding for a specific redirect by passing `false` to `withQs()`.

```ts title="app/controllers/auth_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class AuthController {
  async logout({ response }: HttpContext) {
    /**
     * Disable query string forwarding for this redirect.
     * The user will be sent to / without any query parameters.
     */
    response.redirect().withQs(false).toPath('/')
  }
}
```

If query string forwarding is not enabled by default, you can enable it for a specific redirect by calling `withQs()` without arguments.

```ts title="app/controllers/search_controller.ts"
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

Pass an object to `withQs()` to set custom query parameters. Chain the method multiple times to append additional parameters.

```ts title="app/controllers/products_controller.ts"
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

### Redirecting to the intended URL

The `toIntended()` method redirects to a URL previously stored in the session via `session.setIntendedUrl()`. If no intended URL is stored, it redirects to the provided fallback. The stored URL is consumed (removed from session) after use.

The `withIntendedUrl()` method stores the current request URL in the session as the intended destination. It only stores for GET, navigational requests that matched a route.

These methods are available when the `@adonisjs/session` package is installed. See [Redirecting to the intended URL after login](../auth/session_guard.md#redirecting-to-the-intended-url) for a complete example.

```ts title="app/controllers/session_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ auth, request, response }: HttpContext) {
    await auth.use('web').login(
      await User.verifyCredentials(
        request.input('email'),
        request.input('password')
      )
    )

    /**
     * Redirect to the intended URL or /dashboard
     */
    return response.redirect().toIntended('/dashboard')
  }
}
```

## Streaming and downloads

The Response class provides methods for streaming data and serving file downloads. These methods handle proper headers, caching, and cleanup automatically.

### Streaming responses

Use `response.stream()` to send a readable stream as the response. AdonisJS waits for the route handler and upstream middleware to finish before beginning to read from the stream.

```ts title="app/controllers/exports_controller.ts"
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

The `response.download()` method streams a file and sets appropriate headers for downloads. It accepts an absolute path to the file.

```ts title="app/controllers/invoices_controller.ts"
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

Use `response.attachment()` to force a download and specify a custom filename. The browser will prompt the user to save the file with the given name.

```ts title="app/controllers/reports_controller.ts"
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

Use `response.status()` to set the HTTP status code. This method overrides any previously set status code.

```ts title="app/controllers/api/posts_controller.ts"
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

The `response.safeStatus()` method sets a status code only if one hasn't been set already. This is useful in middleware where you want to provide a default without overriding explicit status codes.

```ts title="app/middleware/json_api_middleware.ts"
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

AdonisJS provides shorthand methods that set both the status code and response body in one call.

```ts title="app/controllers/users_controller.ts"
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

AdonisJS provides shorthand methods for common HTTP status codes. Each method sets the status code and optionally sends a response body.

| Method | Status Code |
|--------|-------------|
| `response.continue()` | 100 |
| `response.switchingProtocols()` | 101 |
| `response.ok(body?, generateEtag?)` | 200 |
| `response.created(body?, generateEtag?)` | 201 |
| `response.accepted(body?, generateEtag?)` | 202 |
| `response.nonAuthoritativeInformation(body?, generateEtag?)` | 203 |
| `response.noContent()` | 204 |
| `response.resetContent()` | 205 |
| `response.partialContent(body?, generateEtag?)` | 206 |
| `response.multipleChoices(body?, generateEtag?)` | 300 |
| `response.movedPermanently(body?, generateEtag?)` | 301 |
| `response.movedTemporarily(body?, generateEtag?)` | 302 |
| `response.seeOther(body?, generateEtag?)` | 303 |
| `response.notModified(body?, generateEtag?)` | 304 |
| `response.useProxy(body?, generateEtag?)` | 305 |
| `response.temporaryRedirect(body?, generateEtag?)` | 307 |
| `response.badRequest(body?, generateEtag?)` | 400 |
| `response.unauthorized(body?, generateEtag?)` | 401 |
| `response.paymentRequired(body?, generateEtag?)` | 402 |
| `response.forbidden(body?, generateEtag?)` | 403 |
| `response.notFound(body?, generateEtag?)` | 404 |
| `response.methodNotAllowed(body?, generateEtag?)` | 405 |
| `response.notAcceptable(body?, generateEtag?)` | 406 |
| `response.proxyAuthenticationRequired(body?, generateEtag?)` | 407 |
| `response.requestTimeout(body?, generateEtag?)` | 408 |
| `response.conflict(body?, generateEtag?)` | 409 |
| `response.gone(body?, generateEtag?)` | 410 |
| `response.lengthRequired(body?, generateEtag?)` | 411 |
| `response.preconditionFailed(body?, generateEtag?)` | 412 |
| `response.requestEntityTooLarge(body?, generateEtag?)` | 413 |
| `response.requestUriTooLong(body?, generateEtag?)` | 414 |
| `response.unsupportedMediaType(body?, generateEtag?)` | 415 |
| `response.requestedRangeNotSatisfiable(body?, generateEtag?)` | 416 |
| `response.expectationFailed(body?, generateEtag?)` | 417 |
| `response.unprocessableEntity(body?, generateEtag?)` | 422 |
| `response.tooManyRequests(body?, generateEtag?)` | 429 |
| `response.internalServerError(body?, generateEtag?)` | 500 |
| `response.notImplemented(body?, generateEtag?)` | 501 |
| `response.badGateway(body?, generateEtag?)` | 502 |
| `response.serviceUnavailable(body?, generateEtag?)` | 503 |
| `response.gatewayTimeout(body?, generateEtag?)` | 504 |
| `response.httpVersionNotSupported(body?, generateEtag?)` | 505 |

## Working with cookies

The Response class provides methods for setting cookies with different security levels. AdonisJS supports signed cookies, encrypted cookies, and plain cookies.

### Setting signed cookies

The `response.cookie()` method creates a signed cookie. Signed cookies cannot be tamprered but their content is visible to the client.

```ts title="app/controllers/preferences_controller.ts"
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

Use `response.encryptedCookie()` to encrypt cookie values. The `app.appKey` encrypts the value, making it unreadable to clients. If the app key changes, the cookie cannot be decrypted.

```ts title="app/controllers/sessions_controller.ts"
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

The `response.plainCookie()` method creates a base64-encoded cookie without signing or encryption.

```ts title="app/controllers/tracking_controller.ts"
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

### Supported cookie value types

Cookie values can be any of the following data types: `string`, `number`, `bigInt`, `boolean`, `null`, `object`, and `array`.

```ts title="app/controllers/cart_controller.ts"
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

### Cookie options

All cookie methods accept an options object to control cookie behavior. These options match the configuration in `config/app.ts` under the `http.cookie` block.

```ts title="app/controllers/auth_controller.ts"
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

::::options

:::option{name="domain" dataType="string"}
Cookie domain. Empty string means current domain.
:::

:::option{name="path" dataType="string"}
Cookie path. Default is `/`.
:::

:::option{name="maxAge" dataType="string | number"}
Cookie expiry time. Can be a duration string like `'2h'` or milliseconds.
:::

:::option{name="httpOnly" dataType="boolean"}
Prevent JavaScript access to the cookie.
:::

:::option{name="secure" dataType="boolean"}
Only send cookie over HTTPS connections.
:::

:::option{name="sameSite" dataType="'lax' | 'strict' | 'none'"}
CSRF protection. Default is `'lax'`.
:::

:::option{name="partitioned" dataType="boolean"}
Experimental: Enable cookie partitioning (CHIPS).
:::

:::option{name="priority" dataType="'low' | 'medium' | 'high'"}
Experimental: Cookie priority hint for browsers.
:::

::::

## Running actions after response has been sent

The `response.onFinish()` method allows you to register callbacks that execute after the response has been sent to the client. This is useful for cleanup tasks, logging, or operations that shouldn't block the response.

### Cleaning up after file downloads

A common use case is deleting temporary files after they've been streamed to the client.

```ts title="app/controllers/files_controller.ts"
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

You can use `onFinish()` to log analytics or metrics without delaying the response.

```ts title="app/middleware/analytics_middleware.ts"
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

The Response class automatically serializes response bodies and sets appropriate content-type headers based on the data type you send.

When you send a response, AdonisJS performs two operations: it serializes the value into a string format suitable for HTTP transmission, and it sets the appropriate `content-type` and `content-length` headers.

::::options

:::option{name="Arrays and objects"}

- **Content-Type:** `application/json`
- **Serialization Behavior:** Stringified using safe stringify (like `JSON.stringify()` but removes circular references and serializes BigInt)

:::

:::option{name="HTML fragments"}

- **Content-Type:** `text/html`
- **Serialization Behavior:** Sent as-is (strings starting with `<`)

:::

:::option{name="Numbers and booleans"}

- **Content-Type:** `text/plain`
- **Serialization Behavior:** Converted to string

:::

:::option{name="Date instances"}

- **Content-Type:** `text/plain`
- **Serialization Behavior:** Converted to ISO string using `toISOString()`

:::

:::option{name="Regular expressions"}

- **Content-Type:** `text/plain`
- **Serialization Behavior:** Converted to string using `toString()`

:::

:::option{name="Error objects"}

- **Content-Type:** `text/plain`
- **Serialization Behavior:** Converted to string using `toString()`

:::

:::option{name="JSONP responses"}

- **Content-Type:** `text/javascript`
- **Serialization Behavior:** Stringified appropriately

:::

:::option{name="Other plain strings"}

- **Content-Type:** `text/plain`
- **Serialization Behavior:** Sent as-is

:::

:::option{name="Other data types"}

- **Content-Type:** `-`
- **Serialization Behavior:** Results in an exception

:::

::::

This automatic handling means you rarely need to manually set content-type headers.

```ts title="start/routes.ts"
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

## Extending HttpResponse class

You can add custom methods and properties to the `HttpResponse` class using macros and getters. This allows you to create reusable response helpers that match your application's needs.

:::note
Read the [Extending AdonisJS](../concepts/extending_adonisjs.md) guide if you are new to the concept of macros and getters.
:::

### Adding custom methods

Use `HttpResponse.macro()` to add methods to all response instances throughout your application.

```ts title="providers/app_provider.ts"
import { HttpResponse } from '@adonisjs/core/http'

export default class AppProvider {
  async boot() {
    /**
     * Add a custom method to send API responses with consistent structure
     */
    HttpResponse.macro('api', function (data: any, meta?: Record<string, any>) {
      return this.json({
        success: true,
        data: data,
        meta: meta || {}
      })
    })
    
    /**
     * Add a custom method for paginated responses
     */
    HttpResponse.macro('paginated', function (items: any[], pagination: any) {
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

### Augmenting the HttpResponse class type

After adding custom methods, you must inform TypeScript about them by augmenting the `HttpResponse` interface. Otherwise, you will get type errors when trying to use the custom methods.

```ts title="types/response.ts"
import { HttpResponse } from '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  export interface HttpResponse {
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

### Using custom methods

Once defined, your custom methods are available on all response instances.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    const posts = await Post.all()
    
    /**
     * Use the custom api() method for consistent responses
     */
    // [!code highlight:4]
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
    // [!code highlight]
    return response.paginated(posts.all(), posts.getMeta())
  }
}
```
