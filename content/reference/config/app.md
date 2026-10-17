---
description: Complete reference for all configuration options available in the config/app.ts file for HTTP server behavior, cookies, and runtime settings.
---

# App Configuration Reference

This reference guide documents all configuration options available in the `config/app.ts` file. The app configuration controls the HTTP server behavior, cookie settings, request parsing, and various other runtime settings for your AdonisJS application.

## Overview

The `config/app.ts` file exports configuration that controls how your AdonisJS application handles HTTP requests. This includes settings for request identification, cookie management, query string parsing, and timeout configurations. The configuration is defined using the `defineConfig` helper from `@adonisjs/core/http`, which provides full TypeScript support.

Three main exports are available:
- `appKey` - Used for encrypting cookies, generating signed URLs, and by the encryption module
- `appUrl` - The canonical URL of your application, used for generating absolute URLs
- `http` - The HTTP server configuration object containing all runtime settings

## App Key

The `appKey` is used for encrypting cookies, generating signed URLs, and by the encryption module. The encryption module will fail to decrypt data if the key is lost or changed, so keep the app key secure.

```ts
// title: config/app.ts
import env from '#start/env'

export const appKey = env.get('APP_KEY')
```

Generate a new app key using the following Ace command:

```sh
node ace generate:key
```

## App URL

The `appUrl` is used in various places where you need to create absolute URLs to your application. For example, when sending emails, images should use absolute URLs.

```ts
// title: config/app.ts
import env from '#start/env'

export const appUrl = env.get('APP_URL')
```

## Request ID Generation

The `generateRequestId` option controls whether a unique identifier is generated for each incoming HTTP request. This is useful for correlating logs and debugging a request flow across your application.

```ts
// title: config/app.ts
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  generateRequestId: true
})
```

When enabled, requests without an `X-Request-Id` header receive a generated ID accessible via `request.id()`. The option defaults to `false`, unless you define a custom `createRequestId` function, which enables it automatically.

## Form Method Spoofing

HTML forms only support GET and POST methods. Method spoofing allows you to specify other HTTP methods (PUT, PATCH, DELETE) via a query parameter, enabling full RESTful routing with standard HTML forms.

```ts
// title: config/app.ts
import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  /**
   * Enable method spoofing for HTML forms.
   * This allows forms to use PUT, PATCH, and DELETE methods
   * by adding ?_method=PUT to the form action.
   */
  allowMethodSpoofing: true
})
```

With method spoofing enabled, you can use the `_method` query parameter in your forms:

```html
<!-- Form will be processed as a PUT request -->
<form method="POST" action="/posts/1?_method=PUT">
  <input type="text" name="title" />
  <button type="submit">Update Post</button>
</form>

<!-- Form will be processed as a DELETE request -->
<form method="POST" action="/posts/1?_method=DELETE">
  <button type="submit">Delete Post</button>
</form>
```

Method spoofing is disabled by default for security reasons. Only enable it when you need to support traditional HTML forms that require non-GET/POST methods.

## Async Local Storage

Async local storage allows you to access the HTTP context from anywhere in your application without explicitly passing it through function parameters. This is useful for accessing the current request context in utility functions, service classes, or deeply nested code.

```ts
// title: config/app.ts
import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  /**
   * Enable async local storage to access HTTP context globally.
   * Once enabled, you can use HttpContext.getOrFail() from anywhere.
   */
  useAsyncLocalStorage: true
})
```

With async local storage enabled, you can access the HTTP context without passing it explicitly:

```ts
// title: app/services/audit_logger.ts
import { HttpContext } from '@adonisjs/core/http'

export class AuditLogger {
  log(action: string) {
    /**
     * Access the current request context without it being passed
     * as a parameter. This works because async local storage
     * maintains the context across async operations.
     */
    const ctx = HttpContext.getOrFail()
    
    console.log({
      action,
      userId: ctx.auth.user?.id,
      ip: ctx.request.ip(),
      url: ctx.request.url()
    })
  }
}
```

## Redirect Configuration

The `redirect` option controls the behavior of HTTP redirects, including referrer host validation for `back()` and query string forwarding.

```ts
// title: config/app.ts
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  redirect: {
    /**
     * Array of allowed hosts for referrer-based redirects.
     * The back() method validates the Referer header against the
     * current request's Host header. Add additional trusted hosts
     * here if your application spans multiple domains.
     *
     * Defaults to []
     */
    allowedHosts: [],

    /**
     * Whether to forward the query string from the current request
     * to the redirect destination by default.
     *
     * Defaults to false
     */
    forwardQueryString: true,
  },
})
```

When `forwardQueryString` is enabled, all redirects automatically carry over the current URL's query parameters. You can disable forwarding for a specific redirect by calling `withQs(false)` on the redirect instance.

The `allowedHosts` array is checked alongside the request's authority (the HTTP/2 `:authority` pseudo-header, falling back to `request.host()`) when `back()` validates the `Referer` header. Referrers from hosts not in this list and not matching the current request's host will cause `back()` to use the fallback URL instead.

## Router Configuration

The `router` option selects the algorithm used to match incoming requests against registered routes. See the [routing guide](../../guides/basics/routing.md#using-the-tree-matcher) for guidance on choosing a matcher.

```ts
// title: config/app.ts
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  router: {
    /**
     * The "linear" matcher compares the URL against every route
     * in registration order. The "tree" matcher indexes routes
     * by segment and is faster for applications with many routes.
     *
     * Defaults to "linear"
     */
    matcher: 'tree',

    /**
     * Only available with the "tree" matcher. Use "specificity"
     * to let static segments win over params regardless of
     * registration order.
     *
     * Defaults to "registration"
     */
    precedence: 'registration',
  },
})
```
