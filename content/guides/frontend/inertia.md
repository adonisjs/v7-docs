---
description: Learn how to build modern single-page applications using Inertia with AdonisJS, React, and Vue.
---

# Inertia

This guide covers using Inertia with AdonisJS to build single-page applications. You will learn how to:

- Render Inertia pages from controllers and routes and pass props to frontend components
- Scaffold page components with the `make:page` command
- Structure the `inertia/` directory and understand key configuration files
- Generate end-to-end types for pages and shared data
- Use data loading patterns like optional, deferred, and mergeable props
- Build forms and navigation with the `Link` and `Form` components
- Share data globally and scope validation errors with error bags
- Customize the root Edge template with the `@inertia` and `@inertiaHead` tags
- Control redirects, browser history, and history encryption
- Enable server-side rendering (SSR)
- Understand the request lifecycle in Inertia applications

## Overview

Inertia acts as a bridge between AdonisJS and frontend frameworks like React and Vue. It eliminates the need for client-side routing or complex state management libraries by embracing a server-first architecture. You write controllers and routes exactly as you would in a traditional server-rendered application, but instead of returning HTML or JSON, you render Inertia pages that your frontend framework displays.

This approach gives you the best of both worlds: the simplicity of server-side routing and data fetching combined with the rich interactivity of React or Vue for the view layer. AdonisJS officially supports both frameworks through the Inertia starter kit.

See also: [How Inertia works](https://inertiajs.com/how-it-works) on the official Inertia documentation.

## Basic example

Let's walk through rendering a posts list end-to-end. The flow has three pieces: a route, a controller that calls `inertia.render()`, and a page component inside `inertia/pages/`.

::::steps

:::step{title="Register a route"}

Routes look identical to any other AdonisJS route. There is no special routing layer for Inertia.

```ts title="start/routes.ts"
router.get('/posts', [controllers.Posts, 'index'])
```

:::

:::step{title="Render a page from the controller"}

The HTTP context exposes an `inertia` object. Call `inertia.render()` with two arguments: the page component path (relative to `inertia/pages/`) and an object of props the component receives.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.all()

    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts)
    })
  }
}
```

Use a [transformer](./transformers.md) to serialize model instances into plain objects. Transformers also generate frontend types under the `Data` namespace, keeping props in sync with the backend.

:::

:::step{title="Create the page component"}

The string `'posts/index'` resolves to `inertia/pages/posts/index.tsx` (or `.vue`). Scaffold the file with `node ace make:page posts/index`. The component receives the props from `inertia.render()` directly.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '@generated/data'

type PageProps = InertiaProps<{ posts: Data.Post[] }>

export default function PostsIndex({ posts }: PageProps) {
  return (
    <>
      {posts.map((post) => (
        <div key={post.id}>
          <h2>{post.title}</h2>
        </div>
      ))}
    </>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/index.vue"
<script setup lang="ts">
import { Data } from '@generated/data'

defineProps<{ posts: Data.Post[] }>()
</script>

<template>
  <div v-for="post in posts" :key="post.id">
    <h2>{{ post.title }}</h2>
  </div>
</template>
```
:::

::::

The `InertiaProps` helper merges your page-specific props with [shared data](#shared-data), so global props like `user` or `flash` are typed alongside `posts`.

:::

::::

### Rendering from a route

For pages without controller logic, skip the controller and render directly from the route definition using `renderInertia()`.

```ts title="start/routes.ts"
router.on('/about').renderInertia('about')

router.on('/pricing').renderInertia('marketing/pricing', {
  plans: ['starter', 'pro', 'enterprise'],
})
```

The component name is type-checked against the generated `InertiaPages` interface, so typos are caught at compile time.

### What happens behind the scenes

On the very first request to `/posts`, Inertia returns an HTML shell containing a root `<div>` with the page component name and serialized props as a `data-page` attribute. The frontend bundle reads that attribute and boots React or Vue.

For every subsequent navigation (link clicks, form submits) Inertia issues a `fetch` request with an `X-Inertia` header. The server runs the same controller but returns a JSON page object instead of HTML. The client swaps in the new component and updates the URL. No full page reload, no separate API.

## The inertia directory

The `inertia/` directory contains your frontend application. Here is the structure created by the starter kit:

```
inertia/
├── app.tsx (or app.vue)     # Frontend application entrypoint
├── client.ts                # Tuyau API client setup
├── ssr.tsx (or ssr.vue)     # SSR entrypoint (when enabled)
├── tsconfig.json            # TypeScript config for frontend code
├── types.ts                 # Shared type definitions
├── css/
│   └── app.css              # Global styles
├── layouts/                 # Reusable layout components
│   └── default.tsx
└── pages/                   # Page components rendered by controllers
    └── home.tsx
```

The `pages/` directory is where Inertia looks for components when you call `inertia.render()`. The path you pass (like `posts/index`) maps directly to a file in this directory (`inertia/pages/posts/index.tsx`).

The `app.tsx` (or `app.vue`) file is the entrypoint that boots your frontend application. It initializes Inertia with your page components and any global configuration. The `ssr.tsx` file serves the same purpose for server-side rendering.

You can create additional directories as your project grows, such as `components/` for shared UI elements or `hooks/` for custom React hooks.

## Configuration files

Two configuration files control how Inertia works in your AdonisJS application.

The `config/inertia.ts` file defines the Inertia adapter settings.

```ts title="config/inertia.ts"
import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  rootView: 'inertia_layout',

  ssr: {
    enabled: false,
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
```

The supported options are:

::::options

:::option{name="rootView" type="string | (ctx) => string"}
The Edge template that renders the initial HTML shell. Defaults to `inertia_layout`. Pass a function to choose a different template per request, for example to render a marketing layout for unauthenticated users.

```ts
rootView: (ctx) => ctx.auth.isAuthenticated ? 'app_layout' : 'marketing_layout'
```
:::

:::option{name="encryptHistory" type="boolean"}
Encrypts sensitive page props stored in the browser's history state. Defaults to `false`. See [history encryption](https://inertiajs.com/history-encryption) on the Inertia documentation.
:::

:::option{name="assetsVersion" type="string | number"}
Pins the asset version string used for [asset versioning](#asset-versioning). When omitted, the version is computed from the Vite manifest. Set this to override the default with a git commit hash, build timestamp, or any custom identifier.
:::

:::option{name="ssr.enabled" type="boolean"}
Enables server-side rendering. See [Server-side rendering](#server-side-rendering).
:::

:::option{name="ssr.entrypoint" type="string"}
Path to the SSR entrypoint file relative to the project root. Defaults to `inertia/ssr.tsx`.
:::

:::option{name="ssr.bundle" type="string"}
Path to the production SSR bundle generated by Vite. Defaults to `ssr/ssr.js`.
:::

:::option{name="ssr.pages" type="string[] | (ctx, page) => boolean"}
Restricts SSR to a subset of pages. Pass an array of component names, or a function that returns a boolean for each page.

```ts
ssr: {
  enabled: true,
  entrypoint: 'inertia/ssr.tsx',
  pages: ['home', 'marketing/pricing'],
}
```
:::

::::

The `resources/views/inertia_layout.edge` template renders the initial HTML shell that contains the root `div` where your frontend application mounts. See [Root template](#root-template) for the available Edge tags.

## Root template

The Edge template configured under `rootView` is rendered for the very first request. It contains the root element where your frontend application mounts and any HTML the SSR output needs to slot into.

The Inertia package registers two Edge tags for this template.

```edge title="resources/views/inertia_layout.edge"
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  @inertiaHead()
  @vite(['inertia/app.tsx'])
</head>
<body>
  @inertia()
</body>
</html>
```

The `@inertia` tag renders a `div` with the encoded page object as a `data-page` attribute. The frontend reads this attribute to boot the SPA. By default, the element is `<div id="app">`. Pass an object to override the tag, id, or class.

```edge
@inertia({ as: 'main', id: 'app-root', class: 'min-h-screen' })
```

The `@inertiaHead` tag outputs the head fragments (title, meta tags) collected during server-side rendering. Include it whenever SSR is enabled. It is a no-op for non-SSR responses.

### Passing data to the template

The third argument to `inertia.render()` is forwarded to the root template as view props. Use this for values that belong in the HTML shell rather than as page props, such as the page title or `<meta>` tags for non-SSR pages.

```ts title="app/controllers/posts_controller.ts"
return inertia.render(
  'posts/show',
  { post: PostTransformer.transform(post) },
  { title: post.title, description: post.summary }
)
```

```edge title="resources/views/inertia_layout.edge"
<head>
  <title>{{ title ?? 'My App' }}</title>
  @if(description)
    <meta name="description" content="{{ description }}">
  @end
  @inertiaHead()
</head>
```

## Generated types

Inertia in AdonisJS is fully type-safe end to end. Two generated artifacts power this:

- The `Data` namespace at `.adonisjs/client/data.d.ts` mirrors transformer output, so props passed from the controller are typed in the page component. See [Transformers](./transformers.md).
- The `InertiaPages` interface at `.adonisjs/server/pages.d.ts` maps each file in `inertia/pages/` to its component prop types. This is what makes `inertia.render('posts/index', { posts })` autocomplete and type-check the component name and props.

The `InertiaPages` types are produced by the `indexPages` Assembler hook. Register it in `adonisrc.ts`, passing the framework you use.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'
import { indexPages } from '@adonisjs/inertia/index_pages'

export default defineConfig({
  hooks: {
    onDevServerStarted: [indexPages({ framework: 'react' })],
    onBuildStarting: [indexPages({ framework: 'react' })],
  },
})
```

The `framework` option accepts `'vue3'` or `'react'`. Pass `source` to scan a directory other than `inertia/pages`.

### Typing shared data

Shared data returned from the Inertia middleware is available on every page through the `InertiaProps` helper. To make it type-safe, augment the `SharedProps` interface with the inferred return type of your `share()` method.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import type { InferSharedProps } from '@adonisjs/inertia/types'

export default class InertiaMiddleware {
  share(ctx: HttpContext) {
    return {
      user: ctx.auth?.user,
      flash: ctx.session?.flashMessages.all(),
    }
  }
}

declare module '@adonisjs/inertia/types' {
  interface SharedProps extends InferSharedProps<InertiaMiddleware> {}
}
```

Once augmented, `props.user` and `props.flash` are typed inside every page component without redeclaring them.

## Data loading patterns

Inertia provides several patterns for loading data efficiently. AdonisJS exposes helpers on the `inertia` object to support each pattern.

:::tip
Optional and deferred props look similar but behave differently. Optional props are evaluated **only** when the frontend explicitly asks for them through a partial reload. Deferred props are evaluated on a follow-up request that Inertia issues automatically right after the page mounts. Reach for `optional` when the value is rarely needed (a tab a user may never click) and `defer` when the value is always needed but slow to compute (a dashboard chart).
:::

### Optional props

Optional props are only evaluated when the frontend explicitly requests them during a partial reload. This is useful for expensive queries that aren't needed on every page load.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  /**
   * The database query only runs when the frontend
   * includes 'users' in a partial reload request.
   */
  users: inertia.optional(async () => {
    const users = await User.all()
    return UserTransformer.transform(users)
  })
})
```

See also: [Partial reloads](https://inertiajs.com/partial-reloads) on the Inertia documentation.

### Always props

The `always` helper ensures a prop is always included in responses, even during partial reloads that don't explicitly request it. This is the opposite of optional props.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  /**
   * Permissions are always computed and included,
   * regardless of what the frontend requests.
   */
  permissions: inertia.always(async () => {
    const permissions = await Permissions.all()
    return PermissionTransformer.transform(permissions)
  })
})
```

### Deferred props

Deferred props are loaded after the initial page render, allowing the page to display immediately while slower data loads in the background. The frontend shows a loading state until the deferred data arrives.

```ts title="app/controllers/dashboard_controller.ts"
return inertia.render('dashboard', {
  /**
   * These props load after the page renders.
   * The frontend can show loading indicators.
   */
  metrics: inertia.defer(async () => {
    return computeMetrics()
  }),
  newSignups: inertia.defer(async () => {
    return getNewSignups()
  })
})
```

You can group deferred props so they load together in a single request.

```ts title="app/controllers/dashboard_controller.ts"
return inertia.render('dashboard', {
  /**
   * Both props are fetched in the same deferred request
   * because they share the 'dashboard' group name.
   */
  metrics: inertia.defer(async () => {
    return computeMetrics()
  }, 'dashboard'),
  newSignups: inertia.defer(async () => {
    return getNewSignups()
  }, 'dashboard')
})
```

See also: [Deferred props](https://inertiajs.com/deferred-props) on the Inertia documentation.

### Mergeable props

Mergeable props are merged with existing frontend data rather than replacing it. This is useful for infinite scrolling or appending new items to a list.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  /**
   * New notifications are merged with existing ones
   * instead of replacing the entire array.
   */
  notifications: inertia.merge(await fetchNotifications())
})
```

You can combine merging with deferred loading by chaining the `merge()` method.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  notifications: inertia.defer(() => {
    return fetchNotifications()
  }).merge()
})
```

By default, data is shallow merged. For nested objects that need recursive merging, use `deepMerge()` instead.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  notifications: inertia.defer(() => {
    return fetchNotifications()
  }).deepMerge()
})
```

See also: [Merging props](https://inertiajs.com/merging-props) on the Inertia documentation.

## Link and Form components

Inertia provides `Link` and `Form` components for navigation and form submissions. AdonisJS wraps these components with additional functionality that lets you reference routes by name instead of hardcoding URLs.

Import the components from the AdonisJS package rather than directly from Inertia.

::::tabs

:::tab{title="React"}
```tsx
// [!code --]
import { Form, Link } from '@inertiajs/react'
// [!code ++]
import { Form, Link } from '@adonisjs/inertia/react'
```
:::

:::tab{title="Vue"}
```vue
<script setup>
// [!code --]
import { Form, Link } from '@inertiajs/vue3'
// [!code ++]
import { Form, Link } from '@adonisjs/inertia/vue'
</script>
```
:::

::::

### Creating links

The `Link` component creates navigation links using route names defined in your AdonisJS routes.

```tsx
<Link route="accounts.create">Signup</Link>
<Link route="session.create">Login</Link>
```

### Creating forms

The `Form` component handles form submissions with automatic CSRF protection and error handling.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/edit.tsx"
import { Form } from '@adonisjs/inertia/react'

export default function EditPost({ post }) {
  return (
    <Form route="posts.update" routeParams={{ id: post.id }}>
      {({ errors }) => (
        <>
          <div>
            <label htmlFor="title">Post title</label>
            <input type="text" name="title" id="title" defaultValue={post.title} />
            {errors.title && <div>{errors.title}</div>}
          </div>

          <button type="submit">Update post</button>
        </>
      )}
    </Form>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/edit.vue"
<script setup lang="ts">
import { Form } from '@adonisjs/inertia/vue'

defineProps<{ post: { id: number; title: string } }>()
</script>

<template>
  <Form
    route="posts.update"
    :params="{ id: post.id }"
    v-slot="{ errors }"
  >
    <div>
      <label for="title">Post title</label>
      <input type="text" name="title" id="title" :value="post.title" />
      <div v-if="errors.title">{{ errors.title }}</div>
    </div>

    <button type="submit">Update post</button>
  </Form>
</template>
```
:::

::::

The `Form` component infers the HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`) from the route name automatically. You do not need to pass a `method` prop — in fact, the AdonisJS wrapper omits `method` and `action` from the accepted props since both are derived from the route definition.

When validation fails on the server, AdonisJS automatically adds validation errors to the session flash messages. The Inertia middleware then shares these errors with the frontend, making them available through the `errors` object in your form.

### Scoping errors with error bags

When a page renders multiple independent forms, errors from one form will leak into the others because they all read from the same `errors` object. To isolate them, set the `errorBag` prop on the form. Inertia sends this name in the `X-Inertia-Error-Bag` header, and the middleware nests the validation errors under that key.

```tsx
<Form route="comments.store" errorBag="newComment">
  {({ errors }) => (
    /**
     * errors.newComment.body holds errors from this form only.
     */
    <textarea name="body" />
  )}
</Form>
```

### Route parameters

Both `Link` and `Form` accept route parameters for routes with dynamic segments. The keys in the object correspond to the parameter names defined in your route:

```ts title="start/routes.ts"
// Single parameter — :id
router.get('posts/:id', [PostsController, 'show']).as('posts.show')

// Multiple parameters — :userId and :postId
router.get('users/:userId/posts/:postId', [PostsController, 'show']).as('users.posts.show')
```

Pass the matching parameter values to the component. In React, use `routeParams`. In Vue, use `params`.

::::tabs

:::tab{title="React"}

```tsx
{/* Single parameter */}
<Link route="posts.show" routeParams={{ id: post.id }}>
  {post.title}
</Link>

{/* Multiple parameters */}
<Link route="users.posts.show" routeParams={{ userId: user.id, postId: post.id }}>
  View post
</Link>
```
:::

:::tab{title="Vue"}
```vue
<template>
  <!-- Single parameter -->
  <Link route="posts.show" :params="{ id: post.id }">
    {{ post.title }}
  </Link>

  <!-- Multiple parameters -->
  <Link route="users.posts.show" :params="{ userId: user.id, postId: post.id }">
    View post
  </Link>
</template>
```
:::

::::

TypeScript enforces that you provide all required parameters with the correct names. Missing or misspelled parameters are caught at compile time.

### Query parameters

The `Link` and `Form` components use the `route` prop for type-safe navigation, but they don't accept query parameters directly. To add query parameters (for example, `?page=2`), generate the URL with `urlFor` and pass it as the `href` prop instead:

```tsx
import { urlFor } from '~/client'

<Link href={urlFor('posts.index', {}, { qs: { page: 2, status: 'published' } })}>
  Page 2
</Link>
```

:::note
When using `href`, you lose the type-safe route name checking that the `route` prop provides. Use `route` with route parameters for standard navigation and fall back to `href` with `urlFor` only when you need query parameters.
:::

## Shared data

Shared data is available to every page in your application without explicitly passing it from each controller. This is useful for global data like the authenticated user, flash messages, or application settings.

The `InertiaMiddleware` defines what data is shared. This middleware is stored at `app/middleware/inertia_middleware.ts` and contains a `share` method that returns the shared data.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

export default class InertiaMiddleware {
  share(ctx: HttpContext) {
    /**
     * The share method may be called before all middleware runs.
     * For example, during a 404 response. Always treat context
     * properties as potentially undefined.
     */
    const { session, auth } = ctx as Partial<HttpContext>

    const error = session?.flashMessages.get('error')
    const success = session?.flashMessages.get('success')

    return {
      /**
       * Using always() ensures these props are included
       * even during partial reloads.
       */
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      flash: ctx.inertia.always({
        error,
        success,
      }),
      user: ctx.inertia.always(
        auth?.user ? UserTransformer.transform(auth.user) : undefined
      ),
    }
  }
}
```

:::tip
The `share` method may be called before the request passes through all middleware or reaches the controller. This happens when rendering error pages or aborting requests early. Always check that context properties exist before accessing them.
:::

### Accessing shared data

Shared data is automatically included in the props for every page. When you define page props using the `InertiaProps` type helper, it includes both your page-specific props and all shared data.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '@generated/data'

type PageProps = InertiaProps<{
  posts: Data.Post[]
}>

export default function PostsIndex(props: PageProps) {
  /**
   * Access shared data alongside page-specific props.
   */
  if (props.flash.error) {
    console.log('Error:', props.flash.error)
  }

  return (
    <div>
      {props.user && <p>Welcome, {props.user.name}</p>}
      {/* render posts */}
    </div>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/index.vue"
<script setup lang="ts">
import { computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Data } from '@generated/data'

defineProps<{
  posts: Data.Post[]
}>()

/**
 * Access shared data.
 */
const page = usePage<Data.SharedProps>()

const user = computed(() => page.props.user)

watch(
  () => page.props.flash,
  (flashMessages) => {
    if (flashMessages.error) {
      console.log('Error:', flashMessages.error)
    }
  },
  { immediate: true }
)
</script>

<template>
  <p v-if="user">Welcome, {{ user.name }}</p>
  <!-- render posts -->
</template>
```
:::

::::

## Pagination

Pagination in Inertia applications requires coordination between the controller, transformer, and frontend component. Here is a complete example using a posts list.

### Controller

Use a transformer's `paginate` method to serialize both the data and pagination metadata, then pass everything to `inertia.render()`:

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ request, inertia }: HttpContext) {
    const page = request.input('page', 1)
    const posts = await Post.query().paginate(page, 10)

    return inertia.render('posts/index', {
      posts: PostTransformer.paginate(posts.all(), posts.getMeta()),
    })
  }
}
```

### Frontend component

Type the paginated props using the `Data` namespace. The pagination metadata includes `currentPage`, `lastPage`, and other fields you can use to render controls:

```tsx title="inertia/pages/posts/index.tsx"
import { Link } from '@adonisjs/inertia/react'
import { urlFor } from '~/client'
import { InertiaProps } from '~/types'
import { Data } from '@generated/data'

type PageProps = InertiaProps<{
  posts: {
    data: Data.Post[]
    metadata: {
      total: number
      perPage: number
      currentPage: number
      lastPage: number
      firstPage: number
    }
  }
}>

export default function PostsIndex({ posts }: PageProps) {
  const { data, metadata } = posts

  return (
    <div>
      {data.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
        </article>
      ))}

      <nav>
        {metadata.currentPage > 1 && (
          <Link href={urlFor('posts.index', {}, { qs: { page: metadata.currentPage - 1 } })}>
            Previous
          </Link>
        )}
        {metadata.currentPage < metadata.lastPage && (
          <Link href={urlFor('posts.index', {}, { qs: { page: metadata.currentPage + 1 } })}>
            Next
          </Link>
        )}
      </nav>
    </div>
  )
}
```

The pagination links use `urlFor` with the `qs` option to generate URLs like `/posts?page=2`. See [Transformers](./transformers.md) for details on the `paginate` method and the shape of the metadata object.

## CSRF protection

CSRF protection is automatically configured in the Inertia starter kit. The `enableXsrfCookie` option in `config/shield.ts` sets a cookie that Inertia reads and includes with every request. You don't need to manually add CSRF tokens to your forms.

See also: [Shield](../security/securing_ssr_applications.md#csrf-configuration-reference) for more details on CSRF protection.

## Asset versioning

Asset versioning tells the frontend when your JavaScript or CSS bundles have changed, triggering a full page reload instead of a partial update. This ensures users always run the latest version of your frontend code after a deployment.

By default, AdonisJS computes a hash of the `.vite/manifest.json` file (created when you build your frontend assets) and uses it as the version identifier. To pin the version to a custom value, set `assetsVersion` in `config/inertia.ts` to a git commit hash, build timestamp, or any other identifier you control.

```ts title="config/inertia.ts"
const inertiaConfig = defineConfig({
  assetsVersion: process.env.RELEASE_SHA,
})
```

Inertia sends the current asset version with every request in the `X-Inertia-Version` header. When the server detects a mismatch on a `GET` request, it responds with a `409` and instructs the client to perform a full page reload at the same URL. Flash messages are reflashed automatically so they survive the reload.

## Redirects and history

Inertia's redirect and history behaviour differs from a traditional server-rendered application because navigation happens over `fetch`. The `inertia` object on the HTTP context exposes helpers for the cases the framework cannot handle automatically.

### Redirects from mutations

When a `PUT`, `PATCH`, or `DELETE` request is followed by a `302` redirect, browsers replay the original method against the new URL. The Inertia middleware automatically upgrades these redirects to `303` so the browser issues a `GET` instead. You don't need to set the status code yourself.

```ts title="app/controllers/posts_controller.ts"
async update({ request, response }: HttpContext) {
  await Post.updateOrFail(request.param('id'), request.all())
  return response.redirect().toRoute('posts.index')
}
```

### External redirects

Inertia cannot follow redirects to a different origin over `fetch`. Use `inertia.location()` to send the client a `409` response with an `X-Inertia-Location` header, which triggers a full browser navigation to the target URL.

```ts
async checkout({ inertia }: HttpContext) {
  const session = await stripe.createCheckoutSession()
  return inertia.location(session.url)
}
```

### Clearing browser history

Call `inertia.clearHistory()` before rendering to clear the client-side history stack. This is useful after sign-out, where you don't want the user to navigate back to authenticated pages.

```ts
async destroy({ inertia, auth }: HttpContext) {
  await auth.use('web').logout()
  inertia.clearHistory()
  return inertia.location('/')
}
```

### Encrypting history state

Inertia stores the page object for each visit in the browser's history state to support back/forward navigation. For pages that contain sensitive data (account settings, billing details), enable encryption so the data is unreadable from the history API.

Toggle encryption per request before calling `render()`:

```ts
async settings({ inertia, auth }: HttpContext) {
  inertia.encryptHistory()
  return inertia.render('account/settings', {
    user: UserTransformer.transform(auth.user),
  })
}
```

Or enable it globally through the [`encryptHistory`](#configuration-files) config option.

See [history encryption](https://inertiajs.com/history-encryption) on the Inertia documentation for the trade-offs.

## Server-side rendering

Server-side rendering (SSR) generates the initial HTML on the server, improving perceived performance and SEO. Enabling SSR requires configuration in both Vite and AdonisJS.

First, enable SSR in your Vite configuration. This tells Vite to create a separate SSR bundle using your `ssr.tsx` or `ssr.vue` entrypoint.

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    // [!code highlight:6]
    inertia({
      ssr: {
        enabled: true,
        entrypoint: 'inertia/ssr.tsx'
      }
    }),
  ],
})
```

Then enable SSR in your AdonisJS configuration so the server knows to use the SSR bundle for rendering.

```ts title="config/inertia.ts"
import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  ssr: {
    // [!code highlight:2]
    enabled: true,
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
```

## Request lifecycle

Understanding how requests flow through an Inertia application helps when debugging or extending the default behavior.

When a user first visits your application, the request follows this path:

1. The request hits your AdonisJS routes and is handled by a controller
2. The controller calls `inertia.render()` with a page component and props
3. The Inertia middleware's `share()` method adds shared data to the props
4. Since this is the first visit, Inertia returns a full HTML response containing a shell layout with a `div` that holds the serialized page component name and props
5. The frontend bundle boots, reads the props from the `div`, and renders the React or Vue component

For subsequent navigation (clicking links or submitting forms):

1. Inertia intercepts the navigation and makes a `fetch` request with an `X-Inertia` header
2. The request flows through routes, controllers, and middleware as before
3. Since the `X-Inertia` header is present, Inertia returns a JSON response with just the page component name and props
4. The frontend receives the JSON and swaps the current component with the new one, updating the URL without a full page reload

This architecture gives you the developer experience of a traditional server-rendered app with the user experience of a modern SPA.
