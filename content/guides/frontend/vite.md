---
description: Learn how to use Vite to bundle frontend assets in AdonisJS applications.
---

# Vite

This guide covers frontend asset bundling with Vite in AdonisJS. You will learn how to:

- Install and configure the Vite integration
- Define entry points and reference assets in Edge templates
- Include static assets like images and fonts in the build
- Load server-side modules processed by Vite
- Configure TypeScript for frontend code
- Enable Hot Module Replacement with React
- Deploy bundled assets to a CDN

## Overview

Vite is a modern frontend build tool that provides fast development server startup and instant hot module replacement. AdonisJS embeds Vite directly into the development server rather than running it as a separate process. This embedded approach means you manage a single server during development, and AdonisJS can access Vite's module runner directly for features like server-side rendering.

The integration handles the complexity of connecting Vite with a backend framework. During development, AdonisJS proxies asset requests to Vite through middleware. In production, AdonisJS reads the manifest file that Vite generates to resolve the correct paths for bundled assets.

The official `@adonisjs/vite` package provides Edge helpers and tags for generating asset URLs, a dedicated Vite plugin that simplifies configuration, and a runtime API for loading server-side modules processed by Vite.

See also: [Vite documentation](https://vitejs.dev/)

## Installation

Run the following command to install and configure the package. This installs both `@adonisjs/vite` and `vite`, then creates the necessary configuration files. The integration requires `vite@8` or later.

```sh
node ace add @adonisjs/vite
```

:::disclosure{title="See steps performed by the configure command"}
1. Registers the following service provider inside the `adonisrc.ts` file.
  ```ts
  {
    providers: [
      // ...other providers
      () => import('@adonisjs/vite/vite_provider')
    ]
  }
  ```
2. Creates `vite.config.ts` and `config/vite.ts` configuration files.
3. Creates the frontend entry point file at `resources/js/app.js`.
:::

After installation, add the following to your `adonisrc.ts` file to integrate Vite with the build process.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/build/standalone'

export default defineConfig({
  // [!code ++:3]
  hooks: {
    buildStarting: [() => import('@adonisjs/vite/build_hook')],
  },
})
```

The `assetsBundler` property disables the default asset bundler management in AdonisJS Assembler. The `hooks` property registers the Vite build hook to execute the Vite build process when you run `node ace build`.

See also: [Assembler hooks](../concepts/assembler_hooks.md)

## Configuration

The setup process creates two configuration files. The `vite.config.ts` file configures the Vite bundler itself, while `config/vite.ts` configures how AdonisJS interacts with Vite on the backend.

### Vite configuration

The `vite.config.ts` file is a standard Vite configuration file. You can install and register additional Vite plugins here based on your project requirements.

The AdonisJS plugin accepts the following options.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      /**
       * Entry point files for your frontend code. Each entry point
       * produces a separate output bundle. You can define multiple
       * entry points for different parts of your application.
       */
      entryPoints: ['resources/js/app.js'],

      /**
       * Glob patterns for files that trigger a browser reload when
       * changed. Useful for template files that Vite doesn't track.
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ]
})
```

:::::options

::::option{name="entryPoints"}

Entry point files for your frontend code. Each entry point produces a separate output bundle. You can define multiple entry points for different parts of your application, for example one for the public website and another for the admin panel. This option is required.

```ts
{
  entryPoints: ['resources/js/app.js', 'resources/js/admin.js']
}
```
::::

::::option{name="buildDirectory"}

Relative path to the output directory for bundled assets. The value is passed to Vite as `build.outDir` and defaults to `public/assets`.

If you change this option, you must update the `buildDirectory` value inside the `config/vite.ts` file as well to keep both configurations in sync.

```ts
{
  buildDirectory: 'public/dist'
}
```
::::

::::option{name="reload"}

Glob patterns for files that trigger a full browser reload when changed. Use this option for files that Vite does not track, like Edge templates. Defaults to `['./resources/views/**/*.edge']`.

```ts
{
  reload: ['resources/views/**/*.edge']
}
```
::::

::::option{name="assetsUrl"}

URL prefix for generating asset links in production. Set this to your CDN URL when deploying bundled assets to a CDN. Defaults to `/assets`.

```ts
{
  assetsUrl: 'https://cdn.example.com/'
}
```
::::

::::option{name="assets"}

Additional files to include in the build that are not imported by your entry points, like images and fonts referenced only inside Edge templates. See [Processing static assets](#processing-static-assets) for a complete example.

```ts
{
  assets: ['resources/images/**']
}
```
::::

::::option{name="serverEntryPoints"}

Server-side entry points bundled separately from your frontend code. Each entry becomes loadable at runtime using the `vite.loadServerModule` method. See [Loading server-side modules](#loading-server-side-modules) for a complete example.

```ts
{
  serverEntryPoints: ['resources/emails/verify_email.tsx']
}
```
::::

:::::

:::note
Vite 8 uses [Rolldown](https://rolldown.rs) as its bundler. If you copy Vite configuration from an older project, replace the `build.rollupOptions` property with `build.rolldownOptions`.
:::

### AdonisJS configuration

The `config/vite.ts` file tells AdonisJS where to find Vite's build output and how to generate asset URLs.

```ts title="config/vite.ts"
import { defineConfig } from '@adonisjs/vite'

export default defineConfig({
  /**
   * Path to Vite's build output directory. Must match the
   * buildDirectory option in vite.config.ts.
   */
  buildDirectory: 'public/assets',

  /**
   * URL prefix for asset links. Set to your CDN URL in production
   * if you deploy assets to a CDN.
   */
  assetsUrl: '/assets',
})
```

:::::options

::::option{name="buildDirectory"}

Path to Vite's build output directory. The value must match the `buildDirectory` option inside the `vite.config.ts` file.
::::

::::option{name="assetsUrl"}

URL prefix for generating asset links in production. The value must match the `assetsUrl` option inside the `vite.config.ts` file.
::::

::::option{name="scriptAttributes"}

Key-value pairs of attributes to add on every script tag generated by the `@vite` tag.
::::

::::option{name="styleAttributes"}

Key-value pairs of attributes to add on every link tag generated by the `@vite` tag.
::::

:::::

You can add custom attributes to the generated script and link tags.

```ts title="config/vite.ts"
import { defineConfig } from '@adonisjs/vite'

export default defineConfig({
  buildDirectory: 'public/assets',
  assetsUrl: '/assets',
  // [!code ++:3]
  scriptAttributes: {
    defer: true,
  },
})
```

For conditional attributes based on the asset being loaded, pass a function instead.

```ts title="config/vite.ts"
import { defineConfig } from '@adonisjs/vite'

export default defineConfig({
  buildDirectory: 'public/assets',
  assetsUrl: '/assets',
  // [!code ++:7]
  styleAttributes: ({ src, url }) => {
    if (src === 'resources/css/admin.css') {
      return {
        'data-turbo-track': 'reload'
      }
    }
  }
})
```

## Folder structure

AdonisJS does not enforce a specific folder structure for frontend assets. However, we recommend storing them in the `resources` directory with subdirectories for each asset type.

```sh
resources
├── css
│   └── app.css
├── js
│   └── app.js
├── fonts
└── images
```

Vite outputs bundled files to `public/assets` by default. The `/assets` subdirectory keeps Vite output separate from other static files in the `public` folder that you may not want Vite to process.

## Starting the development server

Start your application with the `--hmr` flag to enable Hot Module Replacement. AdonisJS automatically proxies asset requests to the embedded Vite server.

```sh
node ace serve --hmr
```

**Hot Module Replacement (HMR)** allows Vite to update modules in the browser without a full page reload. When you edit a CSS file or a JavaScript module, the changes appear instantly while preserving application state.

## Including entry points in templates

Use the `@vite` Edge tag to render script and link tags for your entry points. The tag accepts an array of entry point paths and generates the appropriate HTML tags.

```edge title="resources/views/layouts/main.edge"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  // [!code highlight]
  @vite(['resources/js/app.js'])
</head>
<body>
  @!section('content')
</body>
</html>
```

We recommend importing CSS files inside your JavaScript entry point rather than registering them as separate entry points. This approach lets Vite handle CSS processing and hot replacement automatically.

```ts title="resources/js/app.js"
/**
 * Import CSS in your JavaScript entry point. Vite processes
 * the CSS and handles hot replacement automatically.
 */
import '../css/app.css'
```

## Referencing assets in templates

Vite builds a dependency graph of files imported by your entry points and updates their paths in the bundled output. However, Vite cannot detect assets referenced only in Edge templates since it does not parse template files.

Use the `asset` helper to create URLs for files that Vite processes. During development, the helper returns the file path served by the AdonisJS server, which forwards the request to the embedded Vite dev server. In production, it returns the path to the bundled file with the content hash in the filename.

```edge title="resources/views/pages/home.edge"
<img src="{{ asset('resources/images/logo.png') }}" alt="Logo">
```

```html
<!-- Output in development -->
<img src="/resources/images/logo.png" alt="Logo">
```

```html
<!-- Output in production -->
<img src="/assets/logo-3bc29777.png" alt="Logo">
```

## Processing static assets

Vite ignores static assets that are not imported by your frontend code. Images, fonts, and icons referenced only in Edge templates fall into this category and would be missing from the production build.

Use the `assets` option of the AdonisJS plugin to include these files in the build. Glob patterns are expanded, and every matched file is processed by Vite, receiving a content hash in its filename.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entryPoints: ['resources/js/app.js'],
      // [!code highlight]
      assets: ['resources/images/**', 'resources/fonts/**'],
    }),
  ]
})
```

After registering the files, you can reference them in your templates using the `asset` helper.

```edge title="resources/views/pages/home.edge"
<img src="{{ asset('resources/images/hero.jpg') }}" alt="Hero image">
```

### Emitting files without processing

Files registered through glob patterns run through Vite's build pipeline, meaning other plugins can transform their content. When a file must be copied to the build output with its content preserved verbatim, use the object form of the `assets` option.

The `chunks` property behaves exactly like the array form. The `assets` property accepts exact file paths (glob patterns are not allowed and will throw an error) and emits each file as a raw asset. Both forms register the file in the manifest under its source path, so the `asset` helper resolves them the same way.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entryPoints: ['resources/js/app.js'],
      assets: {
        chunks: ['resources/images/**'],
        // [!code highlight]
        assets: ['resources/documents/terms.pdf'],
      },
    }),
  ]
})
```

## Loading server-side modules

Some TypeScript modules must run inside your Node.js process yet still need Vite's processing before they can execute. Email templates written with [React Email](https://react.email) are a good example. They are authored as React components inside `.tsx` files, so Node.js cannot import them directly, but they render on the server rather than in the browser.

The `serverEntryPoints` option and the `vite.loadServerModule` method solve this problem together. You declare the modules in your Vite configuration, and AdonisJS loads them through Vite at runtime.

During development, the module is evaluated through Vite's module runner with full TypeScript, JSX, and plugin support. Vite's HMR keeps the module fresh, so editing the file is reflected on the next load without restarting the server. When you build for production, each server entry point is bundled into the `server` directory inside your build output, and `loadServerModule` imports the pre-built file instead.

Start by declaring the module in the `serverEntryPoints` option.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entryPoints: ['resources/js/app.js'],
      // [!code ++:1]
      serverEntryPoints: ['resources/emails/verify_email.tsx'],
    }),
  ]
})
```

Next, create the email template. The component and its rendering logic stay together inside the `.tsx` file, so the rest of your application only deals with plain strings.

```tsx title="resources/emails/verify_email.tsx"
import { render } from '@react-email/render'
import { Html, Button, Text } from '@react-email/components'

function VerifyEmail(props: { verificationUrl: string }) {
  return (
    <Html lang="en">
      <Text>Click the button below to verify your email address.</Text>
      <Button href={props.verificationUrl}>Verify email</Button>
    </Html>
  )
}

export default function renderVerifyEmail(props: { verificationUrl: string }) {
  return render(<VerifyEmail {...props} />)
}
```

Finally, load the module with the `vite.loadServerModule` method wherever you need it. The following example renders the email to an HTML string when sending it.

```ts title="app/controllers/signups_controller.ts"
import mail from '@adonisjs/mail/services/main'
import vite from '@adonisjs/vite/services/main'

export default class SignupsController {
  async store() {
    const { default: renderVerifyEmail } = await vite.loadServerModule<
      typeof import('../../resources/emails/verify_email.tsx')
    >('resources/emails/verify_email.tsx')

    const html = await renderVerifyEmail({
      verificationUrl: 'https://example.com/verify/token',
    })

    await mail.send((message) => {
      message.to('user@example.com').subject('Verify your email address').html(html)
    })
  }
}
```

:::warning
The entry path passed to `loadServerModule` must be declared in the `serverEntryPoints` option. Otherwise, the bundled file will not exist in production and the import will fail.
:::

### Typing server modules

Instead of passing the module type on every call, you can register entries globally by merging into the `ServerModuleMap` interface. After merging, the entry paths are autocompleted, and the return value of `loadServerModule` is typed automatically.

```ts title="types/vite.ts"
declare module '@adonisjs/vite/types' {
  interface ServerModuleMap {
    'resources/emails/verify_email.tsx': typeof import('../resources/emails/verify_email.tsx')
  }
}
```

### Re-evaluating modules

By default, `loadServerModule` trusts Vite's HMR to invalidate cached modules when their source changes. If a module registers top-level state that must be reset on every load, pass the `fresh` option to clear the module runner cache before importing. The option only applies during development. In production, bundled imports are always cached.

```ts
await vite.loadServerModule('resources/emails/verify_email.tsx', { fresh: true })
```

## TypeScript configuration

If you use TypeScript for frontend code, create a separate `tsconfig.json` inside the `resources` directory. Vite and your code editor will use this configuration for TypeScript files within the `resources` directory.

```json title="resources/tsconfig.json"
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "lib": ["DOM"],
    "paths": {
      "@/*": ["./js/*"]
    }
  }
}
```

If you use React, add the `jsx` option.

```json title="resources/tsconfig.json"
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "lib": ["DOM"],
    "jsx": "preserve",
    "paths": {
      "@/*": ["./js/*"]
    }
  }
}
```

## React with Hot Module Replacement

To enable React Fast Refresh during development, add the `@viteReactRefresh` Edge tag before the `@vite` tag in your layout.

```edge title="resources/views/layouts/main.edge"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  @viteReactRefresh()
  @vite(['resources/js/app.js'])
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

Then configure the React plugin in your Vite configuration.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'
// [!code ++:1]
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    adonisjs({
      entryPoints: ['resources/js/app.js'],
    }),
    // [!code ++:1]
    react(),
  ],
})
```

## Deploying assets to a CDN

To serve bundled assets from a CDN in production, configure the `assetsUrl` option in both configuration files. This ensures that URLs in the manifest file and lazy-loaded chunks point to your CDN server.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entryPoints: ['resources/js/app.js'],
      reload: ['resources/views/**/*.edge'],
      // [!code ++:1]
      assetsUrl: 'https://cdn.example.com/',
    }),
  ]
})
```

```ts title="config/vite.ts"
import { defineConfig } from '@adonisjs/vite'

export default defineConfig({
  buildDirectory: 'public/assets',
  // [!code ++:1]
  assetsUrl: 'https://cdn.example.com/',
})
```

After building your application with `node ace build`, upload the contents of `public/assets` to your CDN.

## Common issues

### Assets not loading in production

If assets fail to load in production, verify that Vite has generated the manifest file at `public/assets/.vite/manifest.json`. The manifest maps source files to their bundled output paths.

If the manifest is missing, ensure the build hook is registered in `adonisrc.ts` and run `node ace build` again.

### Static images missing from build

Images and other static assets referenced only in templates are not automatically included in the build. Vite only processes files that are imported by your JavaScript code.

Register these files with the `assets` option of the AdonisJS plugin, as covered in the [Processing static assets](#processing-static-assets) section.

```ts title="vite.config.ts"
adonisjs({
  entryPoints: ['resources/js/app.js'],
  // [!code ++:1]
  assets: ['resources/images/**', 'resources/fonts/**'],
})
```

If your images disappeared after upgrading to Vite 8, check your entry point for `import.meta.glob` calls. Vite 8 no longer emits non-JavaScript files through glob imports, so these patterns must move to the `assets` option.

### HMR not working

Hot Module Replacement requires the `--hmr` flag when starting the dev server.

```sh
node ace serve --hmr
```

If HMR still does not work, check your browser console for WebSocket connection errors. Firewall or proxy configurations may block the HMR WebSocket connection.

## Middleware mode

With version 3.x, Vite runs in middleware mode. Rather than spawning Vite as a separate process with its own server, AdonisJS embeds Vite and proxies matching requests through middleware.

The advantages of middleware mode include direct access to Vite's module runner for loading server-side modules and a single development server to manage. All assets are served through AdonisJS rather than a separate Vite process.

See also: [Vite SSR documentation](https://vitejs.dev/guide/ssr#setting-up-the-dev-server)

## Manifest file

When you build for production, Vite generates a manifest file alongside the bundled assets. The manifest is a JSON file that maps source file paths to their bundled output paths, including content hashes.

AdonisJS reads this manifest to resolve asset URLs. When you call the `asset` helper or use the `@vite` tag in production, AdonisJS looks up the file in the manifest and returns the correct bundled path.

The manifest file is located at `public/assets/.vite/manifest.json` by default.

See also: [Vite backend integration](https://vitejs.dev/guide/backend-integration.html)
