---
summary: A guide to upgrade your AdonisJS v6 applications to v7.
---

# Upgrading from v6 to v7

AdonisJS v7 is a major release after two years of v6. This guide covers the changes you must make to upgrade your existing v6 application.

We have worked hard to keep the breaking changes surface area low. Yet, there are some breaking changes, and certain updates are necessary. At a foundational level:

- AdonisJS v7 requires Node.js 24
- Works with TypeScript 5.9/6.0 and ESLint 10
- And the Vite integration has been updated to work with Vite 8

## Helpful links

- [v6 documentation](https://v6-docs.adonisjs.com) - In case you need to reference the old APIs during the upgrade.
- [Report Upgrade issues](https://github.com/orgs/adonisjs/discussions/5051) - Running into something unexpected? Post it here and we'll help.

## Upgrade to Node.js 24

AdonisJS v7 requires Node.js 24 or above. Older Node.js versions are no longer supported. Make sure you update your local development environment, CI pipelines, and production servers before proceeding with the rest of this guide.

```sh
node -v
```

## Upgrade using a coding agent
Use the following prompt with your coding agent (Cursor, Claude Code, Copilot, etc.) to handle the mechanical parts of the upgrade. Review the changes it makes against the breaking changes listed above.

:upgradeprompt

## Upgrade all packages

Update every `@adonisjs/*` package in your project to its latest version. You must also upgrade `@vinejs/vine`, `edge.js` and Inertia depedencies to their latest versions.

Following is a cross-platform script you can run to automatically find AdonisJS specific dependencies within your project's `package.json` file and update them in one go.

```sh
npm i $(node -e "const pkg = require('./package.json'); const deps = {...pkg.dependencies, ...pkg.devDependencies}; console.log(Object.keys(deps).filter(k => k.startsWith('@adonisjs/') || k === '@vinejs/vine' || k === 'edge.js' || k === '@japa/plugin-adonisjs' || k === 'vite' || k === 'argon2').map(k => k + '@latest').join(' '))") --force
```

## Replace the TypeScript JIT compiler
We have replaced `ts-node` (and `ts-node-maintained`) with `@poppinss/ts-exec` as the JIT compiler. Remove the old packages and install the new one.

```sh
npm uninstall ts-node ts-node-maintained @swc/core
npm install -D @poppinss/ts-exec
```

Then update the import in your `ace.js` file.

```ts title="ace.js"
// [!code --]
import 'ts-node-maintained/register/esm'
// [!code ++]
import '@poppinss/ts-exec'
```

## Install Youch as a project dependency
Youch is no longer bundled inside `@adonisjs/ace` and `@adonisjs/http-server`. It has been rewritten from scratch, but this does not impact your application code since Youch is consumed internally by the framework. You just need to install it as a dev dependency.

```sh
npm install -D youch
```

## Configure hooks in `adonisrc.ts`
v7 introduces a new hooks system in `adonisrc.ts`. You must add the `indexEntities` hook at a minimum. Depending on your stack, you will need additional hooks for Inertia, Tuyau, Bouncer, and Vite.

If your app uses Tuyau, make sure to install the `@tuyau/core` package.

```sh
npm install @tuyau/core
```

The following example shows a complete hooks configuration. Include only the hooks relevant to your stack.

```ts title="adonisrc.ts"
import { indexEntities } from '@adonisjs/core/generators'
import { indexPages } from '@adonisjs/inertia'
import { defineConfig } from '@adonisjs/core/app'
import { indexPolicies } from '@adonisjs/bouncer'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  hooks: {
    init: [
      // [!code highlight:2]
      // Always needed
      indexEntities(),

      // [!code highlight:6]
      // If using Inertia (adjust framework to match yours)
      indexPages({ framework: 'react' }),
      generateRegistry(),
      indexEntities({
        transformers: { enabled: true, withSharedProps: true },
      }),

      // [!code highlight:2]
      // If using Bouncer
      indexPolicies(),
    ],
    buildStarting: [
      // [!code highlight:2]
      // If using Vite
      () => import('@adonisjs/vite/build_hook'),
    ],
  },
})
```

## Bouncer policies are indexed automatically
Bouncer no longer reads policies from the `app/policies/main.ts` file. The `indexPolicies` hook scans the `app/policies` directory and generates the `.adonisjs/server/policies.ts` barrel file, which you import using the `#generated/policies` alias.

Once you have registered the `indexPolicies` hook (see the previous section), delete the `app/policies/main.ts` file and update the import inside the `initialize_bouncer_middleware.ts` file.

```ts title="app/middleware/initialize_bouncer_middleware.ts"
import * as abilities from '#abilities/main'
// [!code --]
import { policies } from '#policies/main'
// [!code ++]
import { policies } from '#generated/policies'
```

## Assembler hooks have been renamed
The assembler hook names have changed. If you were using the `onBuildStarting` hook (the most common one, used for Vite), update it to `buildStarting`.

```ts title="adonisrc.ts"
{
  hooks: {
    // [!code --]
    onBuildStarting: [() => import('@adonisjs/vite/build_hook')],
    // [!code ++]
    buildStarting: [() => import('@adonisjs/vite/build_hook')],
  }
}
```

The full list of renamed hooks is as follows.

```diff
- onSourceFileChanged
+ fileChanged

- onDevServerStarted
+ devServerStarted

- onBuildCompleted
+ buildFinished

- onBuildStarting
+ buildStarting

+ fileAdded
+ fileRemoved
+ devServerStarting
+ testsStarting
+ testsFinished
```

## Update the tests glob pattern
We replaced the `glob` package with the Node.js built-in glob helper. This requires a small syntax change in the test file patterns inside `adonisrc.ts`.

```ts title="adonisrc.ts"
tests: {
  suites: [
    {
      // [!code --]
      files: ['tests/unit/**/*.spec(.ts|.js)'],
      // [!code ++]
      files: ['tests/unit/**/*.spec.{ts,js}'],
    },
  ],
  forceExit: false,
},
```

## Remove the `assetsBundler` property
The `assetsBundler` property in `adonisrc.ts` is no longer in use. Remove it to resolve the TypeScript error you will see after upgrading.

## Encryption config changes
The `appKey` export from `config/app.ts` is no longer used for encryption. Instead, you must create a dedicated `config/encryption.ts` file. The `APP_KEY` environment variable is still in use.

```ts title="config/app.ts"
// [!code --]
export const appKey = env.get('APP_KEY')
```

v6 apps must use the `legacy` driver to continue decrypting existing data. Learn more about new [Encryption drivers](../../guides/security/encryption.md#choosing-an-algorithm)

```ts title="config/encryption.ts"
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

export default defineConfig({
  default: 'legacy',
  list: {
    legacy: drivers.legacy({
      keys: [env.get('APP_KEY')],
    }),
  },
})
```

Resolving the `encryption` binding from the container now returns an instance of `EncryptionManager` instead of the `Encryption` class. This is because the rewritten encryption package supports multiple algorithms and uses a manager to switch between them.

```ts
const encryption = await app.container.make('encryption')

// In v6
encryption instanceof Encryption

// In v7
encryption instanceof EncryptionManager
```

If you were resolving the `Encryption` class from the container and passing it as a dependency, fix this by resolving the class constructor directly.

```ts
import { Encryption } from '@adonisjs/core/encryption'
const encryption = await app.container.make(Encryption)

encryption instanceof Encryption // true
```

## `router.makeUrl` deprecated in favor of URL builder

The `router.makeUrl` and `router.makeSignedUrl` methods have been deprecated. Use the new type-safe `urlFor` helper instead.

```ts
// [!code --:2]
import router from '@adonisjs/core/services/router'
router.makeUrl('posts.show', { id: 1 })

// [!code ++:2]
import { urlFor } from '@adonisjs/core/services/url_builder'
urlFor('posts.show', { id: 1 })
```

Inside Edge templates, the `route` helper is deprecated in favor of `urlFor`.

```edge
// [!code --]
route('posts.show', { id: 1 })
// [!code ++]
urlFor('posts.show', { id: 1 })
```

## Removed helpers
The following helpers have been removed from `@adonisjs/core/helpers`. Each one has a straightforward replacement.

| Removed helper | Replacement |
|---------------|-------------|
| `getDirname` | `import.meta.dirname` |
| `getFilename` | `import.meta.filename` |
| `slash` | `stringHelpers.toUnixSlash` |
| `joinToURL` | `new URL()` |
| `cuid` / `isCuid` | Use UUIDs instead |
| `parseImports` | Use the `parse-imports` package directly |

```ts
// [!code --:3]
import { getDirname, getFilename } from '@adonisjs/core/helpers'
getDirname()
getFilename()

// [!code ++:2]
import.meta.dirname
import.meta.filename
```

```ts
// [!code --:2]
import { slash } from '@adonisjs/core/helpers'
slash('foo\\bar') // foo/bar

// [!code ++:2]
import stringHelpers from '@adonisjs/core/helpers/string'
stringHelpers.toUnixSlash('foo\\bar') // foo/bar
```

## `Request` and `Response` classes renamed
The `Request` and `Response` classes in the HTTP package have been renamed to `HttpRequest` and `HttpResponse`. This avoids conflicts with the globally available platform-native `Request` and `Response` classes.

Most projects will not be affected since the majority of codebases interact with the `HttpContext` object rather than importing these classes directly. However, you will need to update your code if you extend these classes, use module augmentation to add custom properties, or register macros on them.

```ts
// [!code --]
import { Request } from '@adonisjs/core/http'
// [!code ++]
import { HttpRequest } from '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  // [!code --:3]
  interface Request {
    someMethod(): void
  }

  // [!code ++:3]
  interface HttpRequest {
    someMethod(): void
  }
}

// [!code --]
Request.macro('someMethod', () => {})
// [!code ++]
HttpRequest.macro('someMethod', () => {})
```

## Flash messages `errors` key removed
The deprecated `errors` key has been removed from the flash messages store. 

Validation errors have always been available under the `inputErrorsBag` key. The `errors` key was a duplicate that unnecessarily increased session payload size. 

If your templates or frontend code read from `errors`, update them to use `inputErrorsBag` instead.

```edge
// [!code --]
{{ flashMessages.get('errors.email') }}
// [!code ++]
{{ flashMessages.get('inputErrorsBag.email') }}
```

## Multipart files and fields merged in `request.all()`
Calling `request.all()` method now returns a merged object containing both request fields and multipart files. Previously, it only returned fields. 

The `request.allFiles()`, `request.file(name)`, and `request.files(name)` methods continue to work as before.

## Auto-generated route names from controllers

Routes that use controllers now automatically receive a generated name. This can cause a conflict:

- If you have two routes pointing to the same controller method where only one of them has an explicit name.
- The auto-generated name for the unnamed route will collide with the other, and a duplicate route error will be thrown at boot time. 
- You will catch this immediately when starting your application.

## Status pages skipped for JSON API requests
The status pages rendered by the [global exception handler](../../guides/basics/exception_handling.md#status-pages) are no longer returned when the request's `Accept` header asks for a JSON response. API clients will now receive JSON error responses instead of rendered HTML pages. This was a bug fix, but it changes behavior if your API consumers were previously receiving HTML error pages.

## `BaseModifiers` removed from VineJS
The `BaseModifiers` class has been removed in the latest version of VineJS. In most cases, this will not affect your application. However, if you were extending or directly using `BaseModifiers` for a custom use case, you will need to adjust your implementation. See the [VineJS v4 release notes](https://github.com/vinejs/vine/releases/tag/v4.0.0) for details.

## Application shutdown hooks run in reverse order
Shutdown hooks now execute in reverse order (last registered, first executed). This is a bug fix that aligns with the expected behavior of cleanup logic, but it may affect your app if you relied on the previous (incorrect) ordering.

## Inertia integration rewrite
The Inertia integration has been significantly reworked in v7. The goals were to bring end-to-end type safety to the `render` method and page props, add first-class support for Transformers when computing props, and align with upstream changes in the Inertia ecosystem.

### Type-safe `render` method
The `inertia.render` method is now type-safe. This may surface TypeScript errors in your application where invalid or incomplete data was previously allowed.

### Config changes
The following changes have been made to the `config/inertia.ts` file.

```ts title="config/inertia.ts"
export default defineConfig({
  // [!code --]
  entrypoint: 'inertia/app/app.tsx',

  // [!code --:3]
  history: {
    encrypt: true,
  },
  // [!code ++]
  encryptHistory: true,

  // [!code --:3]
  sharedData: {
    // ...
  },
  // Replaced by inertia_middleware (see below)
})
```

- The `entrypoint` config option has been removed. This configuration option was not used anywhere.
- The `history.encrypt` option has been renamed to `encryptHistory` as a top-level property.
- The `sharedData` property has been removed in favor of the Inertia middleware (covered below).

### File structure changes
The Inertia entrypoint and SSR files have been moved out of the `app` subdirectory and now live directly in the `inertia` root.

```diff
- inertia/app/app.tsx
+ inertia/app.tsx

- inertia/app/ssr.tsx
+ inertia/ssr.tsx
```

The exact file extension depends on your framework. For example, Vue apps will use `inertia/app.ts` and `inertia/ssr.ts`.

### Shared data moved to middleware
The `sharedData` property in `config/inertia.ts` has been removed. You must create an Inertia middleware to define shared data instead and register it as a server middleware in the kernel file.

```sh
node ace make:middleware inertia_middleware
```

```ts title="start/kernel.ts"
server.use([
  () => import('#middleware/inertia_middleware'),
])
```

The `share` method receives the `HttpContext`, which may not be fully hydrated if a response is sent before the request reaches the route handler (for example, during a 404). Guard your property access carefully.

Following is the default middleware file. Since, you are upgrading from v6, there will not be a `UserTransformer` in your app. So feel free to remove this import and serialize the user as you are doing it in other parts of your codebase.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import UserTransformer from '#transformers/user_transformer'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    /**
     * The share method is called every time an Inertia page is rendered. In
     * certain cases, a page may get rendered before the session middleware
     * or the auth middleware are executed. For example: During a 404 request.
     *
     * In that case, we must always assume that HttpContext is not fully hydrated
     * with all the properties.
     */
    const { session, auth } = ctx as Partial<HttpContext>

    /**
     * Data shared with all Inertia pages. Make sure you are using
     * transformers for rich data-types like Models.
     */
    return {
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      flash: ctx.inertia.always({
        error: session?.flashMessages.get('error'),
        success: session?.flashMessages.get('success'),
      }),
      user: ctx.inertia.always(auth?.user ? UserTransformer.transform(auth.user) : undefined),
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
```

### Add `tsconfig.inertia.json`
You must create a new `tsconfig.inertia.json` file to avoid circular reference issues between the Inertia frontend codebase and the backend codebase. 

This circular reference occurs because the codegen has the Inertia app referencing backend code, and the backend code referencing Inertia pages for inferring prop types.

Create the file in the root of your project.

```json title="tsconfig.inertia.json"
{
  "extends": "./inertia/tsconfig.json",
  "compilerOptions": {
    "rootDir": "./inertia",
    "composite": true
  },
  "include": ["./inertia/**/*.ts", "./inertia/**/*.tsx"]
}
```

Then add a `references` entry to your main `tsconfig.json`.

```json title="tsconfig.json"
{
  "extends": "@adonisjs/tsconfig/tsconfig.app.json",
  "compilerOptions": {
    "rootDir": "./",
    "jsx": "react",
    "outDir": "./build"
  },
  // [!code ++]
  "references": [{ "path": "./tsconfig.inertia.json" }]
}
```

## Add new subpath imports to `package.json`
Add the following entries to the `imports` field in your `package.json`. These are in addition to any existing aliases your project already has.

```json title="package.json"
{
  "imports": {
    "#generated/*": "./.adonisjs/server/*.js",
    "#transformers/*": "./app/transformers/*.js",
    "#database/*": "./database/*.js"
  }
}
```
