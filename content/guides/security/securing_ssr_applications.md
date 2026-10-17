---
description: Learn how to protect your server-rendered applications from common web attacks using the @adonisjs/shield package.
---

# Securing server-rendered applications

This guide covers security features for AdonisJS server-rendered applications. You will learn how to:

- Protect forms from CSRF (Cross-Site Request Forgery) attacks
- Define CSP (Content Security Policy) rules to prevent XSS attacks
- Configure HSTS to enforce HTTPS connections
- Prevent clickjacking with X-Frame-Options headers
- Disable MIME sniffing to avoid content-type attacks

## Overview

Web applications face constant security threats. Attackers exploit vulnerabilities like form submission forgery, malicious script injection, and clickjacking to compromise your users. The `@adonisjs/shield` package provides a unified defense layer that protects your server-rendered AdonisJS applications from these common attacks.

Shield works by adding security-focused HTTP headers and middleware to your application. Rather than configuring each protection separately, Shield gives you a single package with sensible defaults that you can customize as needed. All protections are configured through `config/shield.ts`, making it easy to audit and adjust your security posture.

The package comes pre-configured with the web starter kit. If you need to install it manually, ensure you have the `@adonisjs/session` package configured first, as Shield depends on sessions to store CSRF tokens.

```sh
node ace add @adonisjs/shield
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/shield` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.

    ```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/shield/shield_provider'),
      ]
    }
    ```

3. Creates the `config/shield.ts` file.

4. Registers the following middleware inside the `start/kernel.ts` file.

    ```ts
    router.use([() => import('@adonisjs/shield/shield_middleware')])
    ```

:::

## CSRF protection

CSRF (Cross-Site Request Forgery) attacks trick authenticated users into submitting malicious requests without their knowledge. Imagine a user is logged into your banking application. While browsing another site, that malicious site includes a hidden form that submits a money transfer request to your bank. Because the user's browser automatically includes their session cookie, the bank processes the transfer as if the user intended it.

Shield prevents CSRF attacks by requiring a secret token with every form submission. This token is generated server-side and embedded in your forms. Since attackers cannot access this token from their malicious site, their forged requests will be rejected.

### Protecting forms

Once Shield is configured, all form submissions without a valid CSRF token will fail automatically. You must include the token in every form using the `csrfField` Edge helper, which renders a hidden input field containing the token.

```edge title="resources/views/posts/create.edge"
<form method="POST" action="/posts">
  {{-- Renders a hidden input with the CSRF token --}}
  {{ csrfField() }}

  <input type="text" name="title" placeholder="Post title">
  <textarea name="content" placeholder="Write your post..."></textarea>
  <button type="submit">Create Post</button>
</form>
```

The helper generates a hidden input field that Shield's middleware validates on submission.

```html title="Output HTML"
<form method="POST" action="/posts">
  <input type="hidden" name="_csrf" value="Q9ghWSf0-3FD9eCiu5YxvKaxLEZ6F_K4DL8o"/>
  
  <input type="text" name="title" placeholder="Post title">
  <textarea name="content" placeholder="Write your post..."></textarea>
  <button type="submit">Create Post</button>
</form>
```

### Handling CSRF errors

Shield raises an `E_BAD_CSRF_TOKEN` exception when a token is missing or invalid. By default, AdonisJS redirects the user back to the form with an error flash message. You can display this message in your template using the `@error` tag.

```edge title="resources/views/posts/create.edge"
@error('E_BAD_CSRF_TOKEN')
  <p class="error">{{ $message }}</p>
@end

<form method="POST" action="/posts">
  {{ csrfField() }}
  {{-- form fields --}}
</form>
```

For custom error handling, you can catch the exception in your global exception handler. This is useful when you want to render a custom error page or return a specific response format.

```ts title="app/exceptions/handler.ts"
import app from '@adonisjs/core/services/app'
import { errors } from '@adonisjs/shield'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Check if the error is a CSRF token error and return
     * a custom response instead of the default redirect.
     */
    if (error instanceof errors.E_BAD_CSRF_TOKEN) {
      return ctx.response
        .status(error.status)
        .send('Your session has expired. Please refresh the page and try again.')
    }

    return super.handle(error, ctx)
  }
}
```

### Enabling CSRF tokens for Ajax requests

Single-page applications and interactive interfaces often submit forms via JavaScript instead of traditional form submissions. For these cases, Shield can expose the CSRF token in a cookie that your frontend code can read.

When `enableXsrfCookie` is enabled, Shield stores the token in an encrypted cookie named `XSRF-TOKEN`. Frontend libraries like Axios automatically read this cookie and include it as an `X-XSRF-TOKEN` header with every request.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csrf: {
    enabled: true,
    exceptRoutes: [],
    enableXsrfCookie: true, // [!code highlight]
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
})

export default shieldConfig
```

:::tip
Only enable `enableXsrfCookie` if your application makes Ajax requests. For traditional server-rendered forms that use full page submissions, the hidden input field is sufficient and more secure.
:::

### Exempting routes from CSRF protection

API endpoints that receive webhooks or requests from external services cannot include CSRF tokens. You can exempt specific routes using the `exceptRoutes` option.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csrf: {
    enabled: true,
    exceptRoutes: [
      '/api/webhooks/*',
      '/api/payments/callback',
    ],
    enableXsrfCookie: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
})

export default shieldConfig
```

For dynamic exemption logic, pass a function that receives the HTTP context and returns a boolean.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csrf: {
    enabled: true,
    exceptRoutes: (ctx) => {
      /**
       * Exempt all routes starting with /api/ since these
       * are consumed by external services with their own
       * authentication mechanisms.
       */
      return ctx.request.url().startsWith('/api/')
    },
    enableXsrfCookie: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
})

export default shieldConfig
```

### CSRF configuration reference

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Turn CSRF protection on or off. |
| `exceptRoutes` | `string[]` or `function` | Routes to exempt from CSRF protection. Accepts route patterns or a function receiving `HttpContext`. |
| `enableXsrfCookie` | `boolean` | When `true`, stores the CSRF token in an `XSRF-TOKEN` cookie for Ajax requests. |
| `methods` | `string[]` | HTTP methods that require CSRF token validation. Defaults to `POST`, `PUT`, `PATCH`, `DELETE`. |
| `cookieOptions` | `object` | Configuration for the `XSRF-TOKEN` cookie. See [cookies configuration](../basics/response.md#cookie-options). |

## CSP (Content Security Policy)

XSS (Cross-Site Scripting) attacks inject malicious scripts into your pages. An attacker might exploit a comment form that doesn't sanitize input, injecting JavaScript that steals user cookies or redirects them to phishing sites. Even with proper input sanitization, XSS vulnerabilities can slip through.

CSP provides a second line of defense by telling browsers which sources of content are trusted. When you define a CSP policy, browsers will block any scripts, styles, or other resources that don't match your allowed sources. Even if an attacker manages to inject a script tag, the browser refuses to execute it because it wasn't loaded from a trusted source.

### Enabling CSP

CSP is disabled by default because policies must be tailored to your application's needs. Enable it and define your directives in the configuration file.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      scriptSrc: [`'self'`, 'https://cdnjs.cloudflare.com'],
      styleSrc: [`'self'`, 'https://fonts.googleapis.com'],
      fontSrc: [`'self'`, 'https://fonts.gstatic.com'],
      imgSrc: [`'self'`, 'data:', 'https://images.example.com'],
    },
    reportOnly: false,
  },
})

export default shieldConfig
```

The `defaultSrc` directive acts as a fallback for any resource type you don't explicitly configure. The `'self'` keyword allows resources from your own domain. Each directive controls a specific resource type: `scriptSrc` for JavaScript, `styleSrc` for CSS, `fontSrc` for fonts, and so on.

You can find the complete list of available directives at [content-security-policy.com](https://content-security-policy.com/#directive).

### Using nonces for inline scripts and styles

Inline scripts and styles are blocked by default under CSP because they're a common XSS attack vector. However, you may need inline code for legitimate purposes. Nonces (number used once) allow specific inline blocks while keeping the general policy strict.

Add the `@nonce` keyword to your directives, then include the `nonce` attribute on your inline script and style tags using the `cspNonce` variable available in Edge templates.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      scriptSrc: [`'self'`, '@nonce'],
      styleSrc: [`'self'`, '@nonce'],
    },
    reportOnly: false,
  },
})

export default shieldConfig
```

```edge title="resources/views/pages/home.edge"
<script nonce="{{ cspNonce }}">
  // This inline script will execute because it has a valid nonce
  console.log('Application initialized')
</script>

<style nonce="{{ cspNonce }}">
  /* This inline style will apply because it has a valid nonce */
  .highlight { background: yellow; }
</style>
```

Shield generates a unique nonce for each request. Attackers cannot predict this value, so even if they inject a script tag, it won't have a valid nonce and the browser will block it.

### Configuring CSP for Vite

During development, AdonisJS serves Vite assets from the same origin as your application, so `'self'` already covers scripts and stylesheets. The HMR WebSocket is the exception. It listens on its own port (`24678` by default, or the value of the `VITE_HMR_PORT` environment variable), and you must allow it in the `connectSrc` directive.

```ts title="config/shield.ts"
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      connectSrc: [`'self'`, ...(app.inDev ? ['ws://localhost:24678'] : [])],
      scriptSrc: [`'self'`, '@nonce'],
      styleSrc: [`'self'`, '@nonce'],
    },
    reportOnly: false,
  },
})

export default shieldConfig
```

If you deploy bundled assets to a CDN, add the `@viteUrl` keyword to the directives that load those assets. The `@adonisjs/vite` package registers this keyword, and it resolves to the `assetsUrl` from `config/vite.ts` when the value is an HTTP or HTTPS URL. For relative URLs like `/assets`, it resolves to an empty string.

```ts title="config/shield.ts"
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`, '@viteUrl'], // [!code highlight]
      connectSrc: [`'self'`, ...(app.inDev ? ['ws://localhost:24678'] : [])],
      scriptSrc: [`'self'`, '@nonce', '@viteUrl'], // [!code highlight]
      styleSrc: [`'self'`, '@nonce', '@viteUrl'], // [!code highlight]
    },
    reportOnly: false,
  },
})

export default shieldConfig
```

:::warning
Vite currently does not support adding `nonce` attributes to style tags it injects into the DOM during development. This is a [known limitation](https://github.com/vitejs/vite/pull/11864) being addressed by the Vite team. Until resolved, you may need to use `'unsafe-inline'` for `styleSrc` during development, then switch to nonce-based policies in production.
:::

### Testing policies with report-only mode

A misconfigured CSP can break your application by blocking legitimate resources. Use `reportOnly` mode to test your policy without enforcement. In this mode, browsers report violations but don't block resources.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      reportUri: ['/csp-report'],
    },
    reportOnly: true,
  },
})

export default shieldConfig
```

Create an endpoint to collect violation reports. This helps you identify resources you forgot to whitelist before enabling enforcement.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.post('/csp-report', async ({ request, logger }) => {
  const report = request.input('csp-report')
  logger.warn({ report }, 'CSP violation detected')
})
```

Once you've verified your policy isn't blocking legitimate resources, set `reportOnly` to `false` to enable enforcement.

### CSP configuration reference

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Turn CSP on or off. |
| `directives` | `object` | CSP directives defining allowed sources for each resource type. |
| `reportOnly` | `boolean` | When `true`, violations are reported but not blocked. Use for testing policies. |

## HSTS (HTTP Strict Transport Security)

When users type your domain without `https://`, browsers first connect over insecure HTTP before redirecting to HTTPS. This brief window allows attackers to intercept the initial request through man-in-the-middle attacks, potentially downgrading the connection or stealing sensitive data.

HSTS tells browsers to always use HTTPS for your domain, even when users type `http://` or click plain HTTP links. After receiving the HSTS header, browsers automatically upgrade all requests to HTTPS for the specified duration, eliminating the insecure redirect window.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  hsts: {
    enabled: true,
    maxAge: '180 days',
    includeSubDomains: true,
  },
})

export default shieldConfig
```

The `maxAge` option tells browsers how long to remember the HTTPS-only policy. The `includeSubDomains` option extends this protection to all subdomains, preventing attackers from exploiting insecure subdomains to compromise your main domain.

:::warning
Only enable HSTS after confirming HTTPS works correctly across your entire domain and all subdomains. Once browsers cache the HSTS policy, they will refuse to connect over HTTP for the duration of `maxAge`. If your HTTPS configuration breaks, users won't be able to access your site until you fix it or the cached policy expires.

Start with a short `maxAge` (like `1 day`) during testing, then increase it to `180 days` or longer once you're confident in your HTTPS setup.
:::

### HSTS configuration reference

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Turn HSTS on or off. |
| `maxAge` | `number` or `string` | How long browsers should remember the HTTPS-only policy. Accepts seconds as a number or a time expression like `'180 days'`. |
| `includeSubDomains` | `boolean` | When `true`, applies the HTTPS-only policy to all subdomains. |

## X-Frame-Options (clickjacking protection)

Clickjacking attacks embed your site in an invisible iframe on a malicious page. The attacker overlays deceptive content, tricking users into clicking buttons on your hidden site. A user might think they're clicking a "Play Video" button, but they're actually clicking "Delete Account" on your application.

The X-Frame-Options header prevents your pages from being embedded in frames on other sites.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  xFrame: {
    enabled: true,
    action: 'DENY',
  },
})

export default shieldConfig
```

The `DENY` action blocks all framing. If you need to embed your site in frames on your own domain (like for an admin panel preview), use `SAMEORIGIN` instead.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  xFrame: {
    enabled: true,
    action: 'SAMEORIGIN',
  },
})

export default shieldConfig
```

To allow a specific external domain to frame your content, use `ALLOW-FROM` with the domain.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  xFrame: {
    enabled: true,
    action: 'ALLOW-FROM',
    domain: 'https://trusted-partner.com',
  },
})

export default shieldConfig
```

:::tip
If you've configured CSP, you can use the `frame-ancestors` directive instead of X-Frame-Options. The CSP directive offers more flexibility, including support for multiple domains. When using `frame-ancestors`, you can disable the `xFrame` guard to avoid redundant headers.
:::

### X-Frame configuration reference

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Turn X-Frame protection on or off. |
| `action` | `string` | The framing policy: `'DENY'`, `'SAMEORIGIN'`, or `'ALLOW-FROM'`. |
| `domain` | `string` | Required when `action` is `'ALLOW-FROM'`. The domain allowed to frame your content. |

## Content-Type sniffing protection

Browsers try to be helpful by guessing content types when servers don't specify them correctly. If your server accidentally serves a user-uploaded file with the wrong content type, browsers might "sniff" the content and execute it as a script. An attacker could upload a file that looks like an image but contains JavaScript, and the browser might execute it.

The `X-Content-Type-Options: nosniff` header tells browsers to trust the `Content-Type` header and never guess. This prevents content-type confusion attacks.

```ts title="config/shield.ts"
import { defineConfig } from '@adonisjs/shield'

const shieldConfig = defineConfig({
  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
```

This guard has no additional configuration options. When enabled, Shield adds the `X-Content-Type-Options: nosniff` header to all responses.

## See also

- [Session configuration](../basics/session.md) for setting up the session package required by Shield
- [Exception handling](../basics/exception_handling.md) for customizing error responses
- [Vite integration](../frontend/vite.md) for configuring asset bundling with CSP
