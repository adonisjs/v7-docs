# Request

This guide covers working with HTTP requests in AdonisJS. You will learn about:

- Reading request body and uploaded files
- Accessing query strings and route parameters
- Working with request headers and metadata
- Reading cookies
- Understanding request ID generation
- Configuring trusted proxies and IP address extraction

## Overview

The Request class holds all the information related to an HTTP request, including the request body, uploaded files, query string, URL, method, headers, and cookies. You access it via the `request` property of HttpContext, which is available in route handlers, middleware, and exception handlers.

## Reading request body and files

The request body contains data sent by the client, typically from HTML forms or API requests. AdonisJS uses the [bodyparser](./body_parser.md) to automatically parse the request body based on the `Content-Type` header, converting JSON, form data, and multipart data into JavaScript objects you can easily work with.

### Accessing the entire request body

Use the `all` method to retrieve all data from the request body as an object. This is useful when you want to process all submitted fields together.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/signup', ({ request }) => {
  const body = request.all()
  console.log(body)
  // { fullName: 'John Doe', email: 'john@example.com', password: 'secret' }
})
```

:::note
**Type safety and validation:** The request body data is not type-safe because the bodyparser only collects and parses the raw request data — it does not validate it. Use the [validation system](./validation.md) to ensure both runtime safety and TypeScript type safety for your request data.
:::

### Accessing specific fields

Use the `input` method when you need to read a specific field from the request body. This method accepts a field name and an optional default value if the field doesn't exist.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/signup', ({ request }) => {
  const email = request.input('email')
  const newsletter = request.input('newsletter', false)
  
  console.log(email)
  console.log(newsletter)
})
```

You can also use the `only` method to retrieve multiple specific fields, or the `except` method to retrieve all fields except certain ones.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/signup', ({ request }) => {
  /**
   * Get only fullName and email, ignoring other fields
   */
  const credentials = request.only(['fullName', 'email'])
  console.log(credentials)
  
  /**
   * Get all fields except password
   */
  const safeData = request.except(['password'])
  console.log(safeData)
})
```

### Accessing uploaded files

Files uploaded through multipart form data are available using the `file` method. The method returns a file object with metadata and methods for validation and storage.

See also: [File uploads guide](./file_uploads.md) for detailed file handling and storage

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/avatar', ({ request }) => {
  const avatar = request.file('avatar')
  console.log(avatar)
})
```

You can validate files at the time of accessing them by providing validation options.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/avatar', ({ request }) => {
  const avatar = request.file('avatar', {
    size: '2mb',
    extnames: ['jpg', 'png', 'jpeg']
  })
  
  console.log(avatar)
})
```

:::tip
**File validation approaches:** You can validate files either when accessing them with `request.file()` or using the validator. The validator approach is recommended as it provides consistent validation alongside other request data and better error handling.
:::

### Available methods

| Method | Description |
|--------|-------------|
| `all()` | Returns all request body data as an object |
| `body()` | Alias for `all()` method |
| `input(key, defaultValue?)` | Returns a specific field value with optional default |
| `only(keys)` | Returns only the specified fields |
| `except(keys)` | Returns all fields except the specified ones |
| `file(key, options?)` | Returns an uploaded file with optional validation |

## Reading request query string and route params

Query strings and route parameters are two different ways to pass data through URLs. The query string is the portion after the `?` in a URL (like `?page=1&limit=10`), while route parameters are dynamic segments defined in your route pattern (like `/posts/:id`).

### Accessing query string parameters

Use the `qs` method to retrieve all query string parameters as an object.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', ({ request }) => {
  const queryString = request.qs()
  console.log(queryString)
  // { page: '1', limit: '10', orderBy: 'created_at' }
})
```

You can access individual query parameters using the `input` method, which works for both body data and query string parameters.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', ({ request }) => {
  const page = request.input('page', 1)
  const limit = request.input('limit', 20)
  const orderBy = request.input('orderBy', 'id')
  
  console.log({ page, limit, orderBy })
})
```

### Accessing route parameters

Route parameters are available through the `param` method or by accessing the `params` object directly. The params object is also available directly on HttpContext.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts/:id', ({ request }) => {
  const id = request.param('id')
  console.log(id)
})
```

### Available methods

| Method | Description |
|--------|-------------|
| `qs()` | Returns all query string parameters as an object |
| `param(key, defaultValue?)` | Returns a specific route parameter with optional default |
| `params()` | Returns all route parameters as an object |

## Reading request headers, method, URL, and IP address

Request metadata includes information about how the request was made, where it came from, and what the client expects in response. This includes HTTP headers, the request method (GET, POST, etc.), the requested URL, and the client's IP address.

### Accessing request headers

Use the `header` method to read a specific header value. Header names are case-insensitive.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/profile', ({ request }) => {
  const authToken = request.header('Authorization')
  const userAgent = request.header('User-Agent')
  
  console.log(authToken)
  console.log(userAgent)
})
```

You can retrieve all headers using the `headers` method.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/debug', ({ request }) => {
  const allHeaders = request.headers()
  console.log(allHeaders)
})
```

### Accessing the request method

The request method (GET, POST, PUT, DELETE, etc.) is available through the `method` method.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.all('/endpoint', ({ request }) => {
  const method = request.method()
  console.log(method) // 'GET', 'POST', etc.
})
```

### Accessing the request URL

Use the `url` method to get the request URL without the domain and protocol, or `completeUrl` to get the full URL including domain.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', ({ request }) => {
  const path = request.url()
  console.log(path) // '/posts?page=1'
  
  const fullUrl = request.completeUrl()
  console.log(fullUrl) // 'https://example.com/posts?page=1'
})
```

### Accessing the client IP address

The `ip` method returns the client's IP address. When your application is behind a reverse proxy or load balancer, you need to configure [trusted proxies](#trusting-proxy-servers) to correctly [detect the real client IP](#custom-ip-address-extraction).

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/track', ({ request }) => {
  const clientIp = request.ip()
  console.log(clientIp)
})
```

The `ips` method returns an array of IP addresses when the request has passed through multiple proxies.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/track', ({ request }) => {
  const ipChain = request.ips()
  console.log(ipChain) // ['client-ip', 'proxy-1', 'proxy-2']
})
```

### Available methods

| Method                       | Description                               |
| ---------------------------- | ----------------------------------------- |
| `header(key, defaultValue?)` | Returns a specific header value           |
| `headers()`                  | Returns all headers as an object          |
| `method()`                   | Returns the HTTP method (GET, POST, etc.) |
| `url()`                      | Returns the request URL without domain    |
| `completeUrl()`              | Returns the complete URL including domain |
| `ip()`                       | Returns the client IP address             |
| `ips()`                      | Returns array of IPs when behind proxies  |

## Reading request cookies

Cookies are small pieces of data stored in the client's browser and sent with every request. AdonisJS provides methods to read both plain and signed/encrypted cookies through the Request class.

### Accessing signed cookies

Use the `cookie` method to read a signed cookie value. By default all cookies are signed.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/preferences', ({ request }) => {
  const theme = request.cookie('theme', 'light')
  const language = request.cookie('language', 'en')
  
  console.log({ theme, language })
})
```

### Accessing encrypted

Use `encryptedCookie` for encrypted cookies. This method automatically decrypt and verify the cookie value.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/dashboard', ({ request }) => {
  const sessionId = request.encryptedCookie('session_id')
  console.log(sessionId)
})
```

### Available methods

| Method | Description |
|--------|-------------|
| `cookie(key, defaultValue?)` | Returns a signed cookie value |
| `cookiesList()` | Returns all cookies as an object without decrypting or unsigning them |
| `encryptedCookie(key, defaultValue?)` | Returns a decrypted cookie value |
| `plainCookie(key, defaultValue?)` | Returns value for plain cookie |

## Reading request ID and understanding ID generation

Every HTTP request in AdonisJS is assigned a unique request ID. This ID is useful for distributed tracing, logging, and correlating related operations across your application and microservices.

### Accessing the request ID

Use the `id` method to retrieve the unique identifier assigned to the current request.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/api/posts', ({ request }) => {
  const requestId = request.id()
  console.log(`Processing request: ${requestId}`)
})
```

### How request IDs are generated

AdonisJS generates request IDs using one of these methods, in order of preference.

:::note
You must enable request ID generation in `config/app.ts` file for AdonisJS to generate request ids (incase `X-Request-Id` header is missing).
:::

1. **From X-Request-Id header:** If the client or a proxy sends an `X-Request-Id` header, AdonisJS uses that value. This allows you to trace requests across multiple services.
2. **Generated by AdonisJS:** If no `X-Request-Id` header exists, AdonisJS generates a unique ID using the `uuid` package by default (if enabled).

### Using request IDs for distributed tracing

Request IDs are particularly valuable in distributed systems where a single user request might trigger operations across multiple services. By logging the request ID with every operation, you can trace the complete flow of a request through your system.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import logger from '@adonisjs/core/services/logger'

router.post('/checkout', async ({ request }) => {
  const requestId = request.id()
  
  logger.info({ requestId }, 'Starting checkout process')
  // Your checkout logic here
  logger.info({ requestId }, 'Checkout completed')
})
```

## Content negotiation

Content negotiation allows your application to serve different response formats or languages based on what the client accepts. The Request class provides methods to read the `Accept`, `Accept-Language`, `Accept-Charset`, and `Accept-Encoding` headers and match them against the formats your application supports.

### Selecting response format

Use the `accepts` method to determine the best response format based on the client's `Accept` header. This is useful when your API can return data in multiple formats like JSON, HTML, or XML.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', ({ request, response }) => {
  const bestFormat = request.accepts(['html', 'json'])
  
  if (bestFormat === 'json') {
    return response.json({ posts: [] })
  }
  
  if (bestFormat === 'html') {
    return response.view('posts/index')
  }
  
  // Client doesn't accept any supported format
  return response.status(406).send('Not Acceptable')
})
```

The `types` method returns all accepted content types in order of client preference.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', ({ request }) => {
  const acceptedTypes = request.types()
  console.log(acceptedTypes) // ['application/json', 'text/html', '*/*']
})
```

### Internationalization

Use the `language` method to determine the best language based on the client's `Accept-Language` header. This helps serve content in the user's preferred language.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/welcome', ({ request, response }) => {
  const language = request.language(['en', 'fr', 'es']) || 'en'
  
  const messages = {
    en: 'Welcome',
    fr: 'Bienvenue',
    es: 'Bienvenido'
  }
  
  return response.send(messages[language])
})
```

The `languages` method returns all accepted languages in order of client preference.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/welcome', ({ request }) => {
  const acceptedLanguages = request.languages()
  console.log(acceptedLanguages) // ['en-US', 'fr', 'es']
})
```

### Available methods

| Method | Description |
|--------|-------------|
| `accepts(types)` | Returns the best matching content type or null |
| `types()` | Returns all accepted content types in preference order |
| `language(languages)` | Returns the best matching language or null |
| `languages()` | Returns all accepted languages in preference order |
| `charset(charsets)` | Returns the best matching charset or null |
| `charsets()` | Returns all accepted charsets in preference order |
| `encoding(encodings)` | Returns the best matching encoding or null |
| `encodings()` | Returns all accepted encodings in preference order |

## Trusting Proxy Servers

When your application runs behind a reverse proxy (like Nginx) or load balancer, you need to configure which proxy IP addresses to trust. This allows AdonisJS to correctly read the `X-Forwarded-*` headers that proxies add to requests.

```ts title="config/app.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'
import proxyAddr from 'proxy-addr'

export const http = defineConfig({
  /**
   * Trust the loopback address and private IP ranges.
   * This is safe for most deployment scenarios where your
   * proxy runs on the same machine or private network.
   */
  trustProxy: proxyAddr.compile(['loopback', 'uniquelocal'])
})
```

The `trustProxy` option accepts any value supported by the [proxy-addr](https://www.npmjs.com/package/proxy-addr) package. Common configurations include:
```ts
// Trust all proxies (not recommended for production)
trustProxy: () => true

// Trust specific IP addresses
trustProxy: proxyAddr.compile(['127.0.0.1', '192.168.1.1'])

// Trust IP ranges using CIDR notation
trustProxy: proxyAddr.compile('10.0.0.0/8')
```

## Custom IP Address Extraction

By default, AdonisJS extracts the client IP address from the request using standard methods. However, when running behind proxies or CDNs like Cloudflare, you may need to extract the IP from custom headers.

```ts title="config/app.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'
import type { IncomingMessage } from 'node:http'

export const http = defineConfig({
  /**
   * Extract IP from Cloudflare's CF-Connecting-IP header
   * Falls back to standard IP extraction if header is not present
   */
  getIp(request: IncomingMessage) {
    const cloudflareIp = request.headers['cf-connecting-ip']
    
    if (cloudflareIp && typeof cloudflareIp === 'string') {
      return cloudflareIp
    }
    
    // Return undefined to fall back to default IP extraction
    return undefined
  }
})
```

The `getIp` method receives the Node.js `IncomingMessage` object and must return a string IP address or `undefined` to fall back to default behavior. This is useful when working with CDNs that provide the real client IP in custom headers.
