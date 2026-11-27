---
description: Learn how to implement CORS in AdonisJS to control cross-origin access to your API.
---

# CORS

This guide covers Cross-Origin Resource Sharing (CORS) in AdonisJS applications. You will learn how to:

- Install and configure the CORS middleware
- Control which origins, methods, and headers are allowed
- Handle credentials in cross-origin requests
- Debug common CORS errors

## Overview

When a browser makes a request to a different domain than the one serving the current page, it enforces Cross-Origin Resource Sharing (CORS) restrictions. This security mechanism prevents malicious scripts from making unauthorized requests to your API on behalf of users.

For example, if your frontend runs on `app.example.com` and your API runs on `api.example.com`, the browser will block requests from the frontend unless your API explicitly allows that origin. The same applies during local development when your frontend runs on `localhost:3000` and your API on `localhost:3333`.

Before making certain cross-origin requests, browsers send a **preflight request** using the `OPTIONS` HTTP method. This preflight asks your server which origins, methods, and headers are permitted. Your server must respond with the appropriate CORS headers, and only then will the browser proceed with the actual request.

AdonisJS handles CORS through the `@adonisjs/cors` package, which provides middleware that automatically responds to preflight requests and attaches the correct headers to all responses.

## Installation

Install and configure the package using the following command:

```sh
node ace add @adonisjs/cors
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/cors` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.

    ```ts title="adonisrc.ts"
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/cors/cors_provider')
      ]
    }
    ```

3. Creates the `config/cors.ts` file. This file contains the configuration settings for CORS.

4. Registers the following middleware inside the `start/kernel.ts` file.

    ```ts title="start/kernel.ts"
    server.use([
      () => import('@adonisjs/cors/cors_middleware')
    ])
    ```

:::

## Configuration

The CORS configuration lives in `config/cors.ts`. Here is the configuration created by `node ace add @adonisjs/cors`, with all available options:

```ts title="config/cors.ts"
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
```

The default `origin: true` reflects every requesting origin, which keeps local frontend/backend setups working without extra configuration. Before deploying, you should replace it with the list of origins your API actually serves. Options you omit from `defineConfig` fall back to the values shown above.

:::note
The Inertia starter kits ship with `origin: []`, which blocks all cross-origin requests because the frontend is served from the same origin as the API.
:::

### Enabling and disabling CORS

The `enabled` option turns the middleware on or off without removing it from the middleware stack. This is useful when you want to disable CORS temporarily during debugging or in specific environments.

```ts title="config/cors.ts"
{
  enabled: process.env.NODE_ENV !== 'test'
}
```

You can also pass a function to decide per request. The middleware calls it with the current `HttpContext` and skips CORS handling when it returns `false`.

```ts title="config/cors.ts"
{
  /**
   * Only apply CORS to the API routes
   */
  enabled: (ctx) => ctx.request.url().startsWith('/api')
}
```

### Configuring allowed origins

The `origin` option controls which domains can make cross-origin requests to your API. This sets the `Access-Control-Allow-Origin` response header.

To allow all origins dynamically (the response header will mirror the requesting origin):

```ts title="config/cors.ts"
{
  origin: true
}
```

To disallow all cross-origin requests:

```ts title="config/cors.ts"
{
  origin: false
}
```

To allow specific domains, provide an array of origins:

```ts title="config/cors.ts"
{
  origin: ['https://app.example.com', 'https://admin.example.com']
}
```

To allow any origin using the wildcard:

```ts title="config/cors.ts"
{
  origin: '*'
}
```

:::warning
When `credentials` is set to `true`, the wildcard `*` cannot be used as the `Access-Control-Allow-Origin` header value. Browsers reject this combination for security reasons. AdonisJS automatically handles this by reflecting the requesting origin instead of sending the literal `*` when both `origin: '*'` and `credentials: true` are configured.
:::

For dynamic origin validation, provide a callback function. This is useful when allowed origins are stored in a database or when you need custom validation logic:

```ts title="config/cors.ts"
{
  origin: (requestOrigin, ctx) => {
    /**
     * requestOrigin is the value of the Origin header.
     * Return true to allow, false to deny. You can also
     * return any other value accepted by the origin option,
     * like an array of allowed origins.
     */
    const allowedOrigins = ['https://app.example.com']
    return allowedOrigins.includes(requestOrigin)
  }
}
```

### Configuring allowed methods

The `methods` option specifies which HTTP methods are permitted for cross-origin requests. The browser's preflight request includes an `Access-Control-Request-Method` header, and the server checks this value against the allowed methods.

```ts title="config/cors.ts"
{
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE']
}
```

### Configuring allowed headers

The `headers` option controls which request headers are permitted in cross-origin requests. The browser's preflight request includes an `Access-Control-Request-Headers` header listing the headers the client wants to send.

To allow all headers:

```ts title="config/cors.ts"
{
  headers: true
}
```

To allow specific headers:

```ts title="config/cors.ts"
{
  headers: ['Content-Type', 'Accept', 'Authorization']
}
```

For dynamic header validation, provide a callback:

```ts title="config/cors.ts"
{
  headers: (requestHeaders, ctx) => {
    return true
  }
}
```

### Exposing response headers

By default, browsers only expose a limited set of response headers to JavaScript. The `exposeHeaders` option lets you specify additional headers that should be accessible to the client.

```ts title="config/cors.ts"
{
  exposeHeaders: ['X-Request-Id', 'X-RateLimit-Remaining']
}
```

### Allowing credentials

The `credentials` option controls whether cookies, authorization headers, and TLS client certificates can be included in cross-origin requests. When enabled, the server sends the `Access-Control-Allow-Credentials: true` header.

```ts title="config/cors.ts"
{
  credentials: true
}
```

:::tip
Enable `credentials` when your frontend needs to send authentication cookies or the `Authorization` header to your API. Without this, browsers strip credentials from cross-origin requests.
:::

### Caching preflight responses

The `maxAge` option specifies how long (in seconds) browsers should cache preflight responses. This reduces the number of preflight requests for repeated cross-origin calls.

```ts title="config/cors.ts"
{
  maxAge: 90
}
```

Setting `maxAge` to `0` omits the `Access-Control-Max-Age` header entirely, so browsers apply their own default cache duration. Setting it to `-1` sends the header and disables caching.

## Common scenarios

### API serving a single-page application

When your API and frontend are deployed on different domains, configure CORS to allow your frontend's origin with credentials:

```ts title="config/cors.ts"
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: ['https://app.example.com'],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  credentials: true,
  maxAge: 90,
})

export default corsConfig
```

### Local development with different ports

During development, your frontend and backend often run on different ports. Configure CORS to allow your local frontend origin:

```ts title="config/cors.ts"
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    /**
     * Allow localhost on any port during development.
     */
    return requestOrigin.startsWith('http://localhost')
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  credentials: true,
  maxAge: 90,
})

export default corsConfig
```

### Public API with no credentials

If your API is public and does not require cookies or authentication headers, you can use a permissive configuration:

```ts title="config/cors.ts"
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: '*',
  methods: ['GET', 'HEAD', 'POST'],
  headers: true,
  credentials: false,
  maxAge: 86400,
})

export default corsConfig
```

## See also

- [MDN CORS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) for an in-depth explanation of how CORS works
- [Middleware](../basics/middleware.md) to learn about the AdonisJS middleware system
- [Session](../basics/session.md) for handling cookies in cross-origin requests
