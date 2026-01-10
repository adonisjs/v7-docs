---
summary: Learn how to use Vite to bundle frontend assets in AdonisJS applications.
---

# Vite

This guide covers frontend asset bundling with Vite in AdonisJS. You will learn how to:

- Install and configure the Vite integration
- Define entrypoints and reference assets in Edge templates
- Process static assets like images and fonts
- Configure TypeScript for frontend code
- Enable Hot Module Replacement with React
- Deploy bundled assets to a CDN

## Overview

Vite is a modern frontend build tool that provides fast development server startup and instant hot module replacement. AdonisJS embeds Vite directly into the development server rather than running it as a separate process. This embedded approach means you manage a single server during development, and AdonisJS can access Vite's runtime API directly for features like server-side rendering.

The integration handles the complexity of connecting Vite with a backend framework. During development, AdonisJS proxies asset requests to Vite through middleware. In production, AdonisJS reads the manifest file that Vite generates to resolve the correct paths for bundled assets.

The official `@adonisjs/vite` package provides Edge helpers and tags for generating asset URLs, a dedicated Vite plugin that simplifies configuration, and access to the Vite Runtime API for server-side rendering.

See also: [Vite documentation](https://vitejs.dev/)

## Installation

Run the following command to install and configure the package. This installs both `@adonisjs/vite` and `vite`, then creates the necessary configuration files.

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
      entrypoints: ['resources/js/app.js'],

      /**
       * Glob patterns for files that trigger a browser reload when
       * changed. Useful for template files that Vite doesn't track.
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ]
})
```

| Option | Description | Default |
|--------|-------------|---------|
| `entrypoints` | Array of entry point files for your frontend code. Each entry point produces a separate bundle. | Required |
| `buildDirectory` | Relative path to the output directory. Passed to Vite as `build.outDir`. | `public/assets` |
| `reload` | Array of glob patterns for files that trigger browser reload on change. | `[]` |
| `assetsUrl` | URL prefix for asset links in production. Set this to your CDN URL when deploying assets to a CDN. | `/assets` |

:::tip
If you change `buildDirectory`, you must update the same value in `config/vite.ts` to keep both configurations in sync.
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

| Option | Description |
|--------|-------------|
| `buildDirectory` | Path to Vite's build output directory. Must match the value in `vite.config.ts`. |
| `assetsUrl` | URL prefix for asset links in production. Set to your CDN URL when deploying assets to a CDN. |
| `scriptAttributes` | Key-value pairs of attributes to add to script tags generated by the `@vite` tag. |
| `styleAttributes` | Key-value pairs of attributes to add to link tags generated by the `@vite` tag. |

You can add custom attributes to the generated script and link tags.

```ts title="config/vite.ts"
import { defineConfig } from '@adonisjs/vite'

export default defineConfig({
  buildDirectory: 'public/assets',
  assetsUrl: '/assets',
  // [!code ++:4]
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

```
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

## Including entrypoints in templates

Use the `@vite` Edge tag to render script and link tags for your entrypoints. The tag accepts an array of entry point paths and generates the appropriate HTML tags.

```edge title="resources/views/layouts/main.edge"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    @vite(['resources/js/app.js'])
</head>
<body>
    @!section('content')
</body>
</html>
```

We recommend importing CSS files inside your JavaScript entry point rather than registering them as separate entrypoints. This approach lets Vite handle CSS processing and hot replacement automatically.

```ts title="resources/js/app.js"
/**
 * Import CSS in your JavaScript entry point. Vite processes
 * the CSS and handles hot replacement automatically.
 */
import '../css/app.css'
```

## Referencing assets in templates

Vite builds a dependency graph of files imported by your entry points and updates their paths in the bundled output. However, Vite cannot detect assets referenced only in Edge templates since it does not parse template files.

Use the `asset` helper to create URLs for files that Vite processes. During development, the helper returns a URL pointing to the Vite dev server. In production, it returns the path to the bundled file with the content hash in the filename.

```edge title="resources/views/pages/home.edge"
<img src="{{ asset('resources/images/logo.png') }}" alt="Logo">
```

```html
<!-- Output in development -->
<img src="http://localhost:5173/resources/images/logo.png" alt="Logo">
```

```html
<!-- Output in production -->
<img src="/assets/logo-3bc29777.png" alt="Logo">
```

## Processing static assets

Vite ignores static assets that are not imported by your frontend code. Images, fonts, and icons referenced only in Edge templates fall into this category.

To include these assets in the build, use Vite's glob import API in your entry point file. This tells Vite to process the matched files even though they are not directly imported.

```ts title="resources/js/app.js"
import '../css/app.css'

/**
 * Tell Vite to process all images in the resources/images directory.
 * Without this, images referenced only in templates would be missing
 * from the production build.
 */
import.meta.glob(['../images/**'])
```

After adding the glob import, you can reference these images in your templates using the `asset` helper.

```edge title="resources/views/pages/home.edge"
<img src="{{ asset('resources/images/hero.jpg') }}" alt="Hero image">
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
      entrypoints: ['resources/js/app.js'],
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
      entrypoints: ['resources/js/app.js'],
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

Add a glob import to your entry point to include static assets.

```ts title="resources/js/app.js"
import '../css/app.css'

// [!code ++:2]
// Include all images in the build
import.meta.glob(['../images/**', '../fonts/**'])
```

### HMR not working

Hot Module Replacement requires the `--hmr` flag when starting the dev server.

```sh
node ace serve --hmr
```

If HMR still does not work, check your browser console for WebSocket connection errors. Firewall or proxy configurations may block the HMR WebSocket connection.

## Middleware mode

With version 3.x, Vite runs in middleware mode. Rather than spawning Vite as a separate process with its own server, AdonisJS embeds Vite and proxies matching requests through middleware.

The advantages of middleware mode include direct access to the Vite Runtime API for server-side rendering and a single development server to manage. All assets are served through AdonisJS rather than a separate Vite process.

See also: [Vite SSR documentation](https://vitejs.dev/guide/ssr#setting-up-the-dev-server)

## Manifest file

When you build for production, Vite generates a manifest file alongside the bundled assets. The manifest is a JSON file that maps source file paths to their bundled output paths, including content hashes.

AdonisJS reads this manifest to resolve asset URLs. When you call the `asset` helper or use the `@vite` tag in production, AdonisJS looks up the file in the manifest and returns the correct bundled path.

The manifest file is located at `public/assets/.vite/manifest.json` by default.

See also: [Vite backend integration](https://vitejs.dev/guide/backend-integration.html)
