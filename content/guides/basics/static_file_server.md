---
description: Learn how to serve static files from the public directory using the @adonisjs/static package.
---

# Static files server

This guide covers serving static files in AdonisJS applications. You will learn how to:

- Install and configure the static files middleware
- Understand when to use static files versus compiled assets
- Configure caching, ETags, and HTTP headers for optimal performance
- Control access to dot files for security
- Set up custom headers for specific file types
- Copy static files to production builds

## Overview

The static file server lets you serve files directly from the file system without creating route handlers for each file. This is essential for assets that don't need processing, like favicons, robots.txt files, user uploads, or downloadable PDFs.

Without a static file server, you would need to create individual routes for every file you want to serve. This quickly becomes unmaintainable:
```ts title="start/routes.ts"
// Without static middleware - tedious and error-prone
router.get('/favicon.ico', async ({ response }) => {
  return response.download('public/favicon.ico')
})
router.get('/robots.txt', async ({ response }) => {
  return response.download('public/robots.txt')
})
router.get('/images/logo.png', async ({ response }) => {
  return response.download('public/images/logo.png')
})
// ... potentially hundreds of routes
```

With the static middleware, all files in the `public` directory are automatically available. The middleware intercepts HTTP requests before they reach your routes. If a file matching the request path exists, it serves the file with appropriate HTTP headers for caching and performance. If no file exists, the request continues to your route handlers as normal.

:::warning
The AdonisJS static file server is convenient during development, but in production you should prefer serving static files through a reverse proxy (Nginx, Caddy, Traefik, Apache) or a CDN. These tools are purpose-built for static file delivery and offer better performance, caching, and compression than a Node.js process. This frees your AdonisJS server to focus on handling dynamic requests.

See the [deployment guide](../../start/deployment.md#serving-static-files-in-production) for recommended production setups.
:::

The key distinction in AdonisJS: files in the `public` directory are served as-is without any processing, while files in the `resources` directory are processed by your assets bundler (like Vite). Use `public` for files that are already in their final form.

## Installation

The `@adonisjs/static` package comes pre-configured with the `web` starter kit. If you're using a different starter kit, you can install and configure it manually.

Install and configure the package using the following command:
```sh
node ace add @adonisjs/static
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/static` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.
```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/static/static_provider')
      ]
    }
```

3. Creates the `config/static.ts` file.

4. Registers the following middleware inside the `start/kernel.ts` file.
```ts
    server.use([
      () => import('@adonisjs/static/static_middleware')
    ])
```

:::

## Configuration

The configuration for the static middleware is stored in the `config/static.ts` file.
```ts title="config/static.ts"
import { defineConfig } from '@adonisjs/static'

const staticServerConfig = defineConfig({
  enabled: true,
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
})

export default staticServerConfig
```

::::options

:::option{name="enabled"}

The `enabled` property allows you to temporarily disable the middleware without removing it from the middleware stack. This is useful when debugging or testing different configurations. Set it to `false` to stop serving static files while keeping the middleware registered.
```ts
{
  enabled: true
}
```

:::

:::option{name="etag"}

The `etag` property controls whether the server generates [ETags](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) for cache validation. ETags help browsers determine if their cached version of a file is still valid without downloading it again. 

When a browser requests a file it has cached, it sends the ETag value. If the file hasn't changed, the server responds with a `304 Not Modified` status, saving bandwidth. This is enabled by default and should generally stay enabled for production.
```ts
{
  etag: true
}
```

:::

:::option{name="indexFiles"}

When enabled, the middleware scans `public/` once when it is constructed and keeps an index of files and directories in memory. GET and HEAD requests for paths absent from the index continue to your routes without a filesystem lookup. Existing files still use the normal static server, including ETags, HEAD and range responses, custom headers, and dotfile rules. Symlinks and their descendants retain filesystem lookups.

This option defaults to `false`. Enable it only when public files are fixed for the lifetime of the application process.

```ts title="config/static.ts"
export default defineConfig({
  indexFiles: true,
})
```

Restart the application after adding files or directories. Leave indexing disabled during development and when serving uploads. Building the index requires a synchronous directory scan and memory proportional to the size of `public/`.

The index covers all public files, not just entries in the Vite manifest. It reduces filesystem operations for missing paths, but it does not remove file reads when serving an existing asset or guarantee a reduction in physical disk reads when metadata is already cached by the operating system.

:::

:::option{name="lastModified"}

The `lastModified` property enables the [Last-Modified](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Last-Modified) header. The server uses the file's modification time from the file system (the [stat.mtime](https://nodejs.org/api/fs.html#statsmtime) property) as the header value. 

Browsers can use this header along with ETags for cache validation. Like ETags, this is enabled by default.
```ts
{
  lastModified: true
}
```

:::

:::option{name="dotFiles"}

The `dotFiles` property defines how to handle requests for files starting with a dot (like `.env` or `.gitignore`). You can set one of three values: `'ignore'` (default), `'deny'`, or `'allow'`.

The `'ignore'` option pretends dot files don't exist and returns a `404` status code. This is the recommended setting for security. The `'deny'` option explicitly denies access with a `403` status code. The `'allow'` option serves dot files like any other file.
```ts
{
  dotFiles: 'ignore' // Recommended
}
```

:::warning
Setting `dotFiles` to `'allow'` can expose sensitive files like `.env` or `.git` directories if they're accidentally placed in the public folder. The `'ignore'` setting (default) is recommended for security. It returns a `404` response as if the file doesn't exist, preventing information disclosure.

If you need to serve specific files for domain verification (like `.well-known/acme-challenge` for SSL certificates), create a subdirectory without a leading dot and configure your verification tool to use that path instead.
:::

:::

:::option{name="acceptRanges"}

The `acceptRanges` property allows browsers to resume interrupted downloads instead of restarting from the beginning. When enabled, the server adds an `Accept-Ranges` header to responses. This is particularly useful for large files like videos or software downloads. The property defaults to `true`.
```ts
{
  acceptRanges: true
}
```

:::

:::option{name="cacheControl"}

The `cacheControl` property enables the [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) header. This header tells browsers and CDNs how long to cache files before checking for updates. When enabled, you can use the `maxAge` and `immutable` properties to fine-tune caching behavior.
```ts
{
  cacheControl: true
}
```

:::

:::option{name="maxAge"}

The `maxAge` property sets the [max-age](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#max-age) directive for the `Cache-Control` header. This tells browsers how long they can cache the file before checking for updates. You can specify the value in milliseconds or as a time expression string like `'30 mins'`, `'1 day'`, or `'1 year'`.
```ts
{
  cacheControl: true,
  maxAge: '30 days'
}
```

:::

:::option{name="immutable"}

The `immutable` property adds the [immutable](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#immutable) directive to the `Cache-Control` header. This tells browsers that the file will never change during its cache lifetime, allowing more aggressive caching. 

Use this for files with versioned or hashed filenames (like `app-v2.css` or `bundle-abc123.js`). By default, `immutable` is disabled.
```ts
{
  cacheControl: true,
  maxAge: '1 year',
  immutable: true
}
```

:::tip
The `immutable` directive only works when `maxAge` is also set. If you enable `immutable` without setting `maxAge`, browsers will ignore it. This prevents accidental long-term caching without an explicit expiration time.
:::

:::

:::option{name="headers"}

The `headers` property accepts a function that returns custom HTTP headers for specific files. The function receives the file path as the first argument and the [file stats](https://nodejs.org/api/fs.html#class-fsstats) object as the second argument. This allows you to set different headers based on file type, size, or other attributes.

The function should return an object where keys are header names and values are header values. If the function returns `undefined` or doesn't return anything, no additional headers are added for that file.
```ts
{
  headers: (path, stats) => {
    /**
     * Set custom content type for .mc2 files
     * since they're not recognized by default
     */
    if (path.endsWith('.mc2')) {
      return {
        'content-type': 'application/octet-stream'
      }
    }

    /**
     * Add security headers for HTML files
     * to prevent XSS attacks
     */
    if (path.endsWith('.html')) {
      return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    }
  }
}
```

:::

::::

## Serving static files

Once the middleware is registered, you can create files inside the `public` directory and access them in the browser using their file path. For example, the `./public/css/style.css` file can be accessed at `http://localhost:3333/css/style.css`.

Here's what a typical `public` directory looks like in production:

```sh
public/
├── favicon.ico           # Browser tab icon
├── robots.txt           # Search engine crawling instructions
├── sitemap.xml          # SEO sitemap for search engines
├── images/
│   ├── logo.png         # Static logo (doesn't need optimization)
│   └── og-image.jpg     # Social media preview image
├── downloads/
│   ├── user-guide.pdf   # Downloadable documentation
│   └── terms.pdf        # Legal documents
└── uploads/
    └── avatars/         # User-uploaded profile pictures
```

Each of these files would be accessible at its corresponding URL:

- `http://localhost:3333/favicon.ico`
- `http://localhost:3333/images/logo.png`
- `http://localhost:3333/downloads/user-guide.pdf`

## `public` directory vs `resources` directory

Understanding when to use the `public` directory versus the `resources` directory is crucial for organizing your application's assets correctly.

Use the `public` directory for files that are already in their final form and don't need any processing:
- Favicons and app icons
- `robots.txt` and `sitemap.xml` files
- Static images that don't need optimization (logos, icons)
- Downloadable files (PDFs, ZIP archives, executables)
- Third-party JavaScript libraries you want to serve as-is
- User-uploaded content (avatars, documents)

Use the `resources` directory with an assets bundler for files that need compilation or optimization:
- CSS/SCSS files that need compilation
- Modern JavaScript/TypeScript that needs transpilation
- Images that benefit from optimization and responsive variants
- Assets that need versioning or cache-busting hashes
- Any file that should be processed by Vite or your build pipeline

```sh title="❌Source files in public won't be compiled"
public/styles/main.scss  # This won't be compiled
public/app.ts            # This won't be transpiled
```

```sh title="✅ Source files in resources will be processed"
resources/css/main.scss  # Compiled by Vite
resources/js/app.ts      # Transpiled by Vite
```

:::tip
A common mistake is placing source files (like `.scss` or modern `.ts`) in the `public` directory and expecting them to be compiled. The static middleware serves files exactly as they are without any processing. Source files that need compilation should go in the `resources` directory and be processed by Vite or your assets bundler.
:::

## Copying static files to production

The files in your `public` directory are automatically copied to the `build` folder when you run the `node ace build` command. This ensures your static files are available in production alongside your compiled application code.

The rule for copying public files is defined in the `adonisrc.ts` file:
```ts title="adonisrc.ts"
{
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: false
    }
  ]
}
```

The `pattern` property uses glob syntax to match all files inside the `public` directory. The `reloadServer: false` setting indicates that changes to these files during development don't require restarting the development server.

With the default configuration, files added to `public` are served immediately without restarting the server. If you enable `indexFiles`, restart the application after adding files so the index includes them. Changes to `config/static.ts` also require a restart.

## See also

- [Middleware guide](./middleware.md) - Learn more about how middleware works in AdonisJS
- [Vite integration](../frontend/vite.md) - Set up asset compilation for the resources directory
- [File uploads guide](./file_uploads.md) - Handle user-uploaded files that go in the public directory
