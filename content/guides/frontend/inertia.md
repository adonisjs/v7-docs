---
description: Learn how to build modern single-page applications using Inertia with AdonisJS, React, and Vue.
---

# Inertia

This guide covers using Inertia with AdonisJS to build single-page applications. You will learn how to:

- Configure Inertia and render pages with end-to-end type-safe props
- Navigate between pages, submit forms, and make non-Inertia HTTP requests
- Share data, display flash messages, and handle validation errors
- Load data using deferred, mergeable, once, and infinite-scroll props
- Configure redirects, browser history, and server-side rendering

## Overview

[Inertia acts as a bridge](https://inertiajs.com/how-it-works) between AdonisJS and frontend frameworks like React and Vue. It eliminates the need for client-side routing or complex state management libraries by embracing a server-first architecture. 

You write controllers and routes exactly as you would in a traditional server-rendered application, but instead of returning HTML or JSON, you render Inertia pages that your frontend framework displays.

This approach gives you the best of both worlds. The simplicity of server-side routing and data fetching combined with the rich interactivity of React or Vue for the view layer. AdonisJS officially supports both frameworks through the Inertia starter kit.

## Basic example

Let's walk through rendering a posts list end-to-end. The flow has four pieces: a route, a transformer, a controller that calls `inertia.render()`, and a page component inside `inertia/pages/`.

::::steps

:::step{title="Register a route"}

Routes look identical to any other AdonisJS route. There is no special routing layer for Inertia.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
```

:::

:::step{title="Create a transformer"}

Transformers define the data sent to the frontend and generate its TypeScript type. Create a transformer for the `Post` model using the following command.

```sh title="Terminal"
node ace make:transformer post
```

Define the fields you want to expose from each post inside the `toObject` method.

```ts title="app/transformers/post_transformer.ts"
import type Post from '#models/post'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return this.pick(this.resource, ['id', 'title'])
  }
}
```

:::

:::step{title="Render a page from the controller"}

The HTTP context exposes an `inertia` object. Transform the posts using the fields from the previous step, and pass the result to `inertia.render()` alongside the page component path.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.all()

    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts),
    })
  }
}
```

:::

:::step{title="Create the page component"}

The string `'posts/index'` resolves to `inertia/pages/posts/index.tsx` (or `.vue`). Scaffold the file with `node ace make:page posts/index`. The component receives the props from `inertia.render()` directly.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import type { InertiaProps } from '~/types'
import type { Data } from '@generated/data'

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

The `InertiaProps` helper merges your page-specific props with [shared data](#shared-data), so global props like `user` are typed alongside `posts`.

:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/index.vue"
<script setup lang="ts">
import type { Data } from '@generated/data'

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

On the very first request to `/posts`, Inertia returns an HTML shell containing the page object (component name and serialized props) inside a `<script type="application/json">` tag, alongside an empty `<div id="app">` mount element. The frontend bundle reads the JSON payload and boots React or Vue into the mount element.

For every subsequent navigation (link clicks, form submits) Inertia issues a `fetch` request with an `X-Inertia` header. The server runs the same controller but returns a JSON page object instead of HTML. The client swaps in the new component and updates the URL. No full page reload, no separate API.

## The inertia directory

The `inertia/` directory contains your frontend application. Here is the structure created by the starter kit:

```sh
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

The `@inertia` tag renders two elements: a `<script type="application/json">` tag holding the encoded page object, and the element where your frontend application mounts. The frontend reads the JSON payload to boot the SPA. By default, the mount element is `<div id="app">`. Pass an object to override the tag, id, or class.

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

After configuring type generation, AdonisJS will type-check:

- Transformer data passed between your controllers and page components. See [Transformers](./transformers.md).
- Page names and props passed to `inertia.render()`.
- Route names, parameters, query strings, HTTP methods, and request bodies used by `Link`, `Form`, and `useRouter`.

The Inertia starter kit configures type generation for you. If you are adding Inertia to an existing application, register the following hooks in `adonisrc.ts`. Set `framework` to `'react'` or `'vue3'`, and use `source` only when your pages live outside `inertia/pages`.

```ts title="adonisrc.ts"
import { indexPages } from '@adonisjs/inertia'
import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  hooks: {
    init: [
      indexEntities({
        transformers: { enabled: true, withSharedProps: true },
      }),
      indexPages({ framework: 'react' }),
      generateRegistry(),
    ],
  },
})
```

### Typing shared data

Shared data returned from the Inertia middleware is available on every page through the `InertiaProps` helper. Add the following augmentation at the bottom of your middleware file to infer these types from the `share()` method. The starter kit includes this setup by default.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import type { InferSharedProps } from '@adonisjs/inertia/types'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    return {
      user: ctx.auth?.user,
    }
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
```

Add the following augmentation to `inertia/types.ts` so `usePage().props` and layout callbacks also receive the shared data types. The starter kit includes this setup by default.

```ts title="inertia/types.ts"
import type { Data } from '@generated/data'

declare module '@inertiajs/core' {
  interface InertiaConfig {
    sharedPageProps: Data.SharedProps
  }
}
```

## Data loading patterns

Inertia provides several patterns for loading data efficiently. AdonisJS exposes helpers on the `inertia` object to support each pattern. Props may resolve to any serializable value, including `null`.

:::note
Prop helpers are detected only at the top level of the props object. A helper nested inside a plain object, like `stats: { views: inertia.defer(...) }`, will not be resolved. Give each wrapped value its own top-level key instead.
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

### Rescuing failed deferred props

Pass `rescue: true` when a deferred prop may fail because of a database outage or an upstream API timeout. AdonisJS will omit the failed prop, allowing the frontend to render a fallback instead of remaining in its loading state.

```ts title="app/controllers/dashboard_controller.ts"
return inertia.render('dashboard', {
  /**
   * If the analytics service is down, the prop is omitted
   * and the frontend renders its rescue fallback.
   */
  analytics: inertia.defer(() => fetchAnalytics(), { rescue: true }),
})
```

The second argument to `defer()` accepts either a group name string or an options object with `group` and `rescue` keys, so grouping and rescue combine freely.

On the frontend, the `Deferred` component renders its `rescue` content for any prop the server rescued.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/dashboard.tsx"
import { Deferred } from '@inertiajs/react'
import { InertiaProps } from '~/types'

type PageProps = InertiaProps<{
  analytics?: { pageViews: number }
}>

export default function Dashboard({ analytics }: PageProps) {
  return (
    <Deferred
      data="analytics"
      fallback={<p>Loading analytics...</p>}
      rescue={<p>Analytics are temporarily unavailable.</p>}
    >
      <p>{analytics?.pageViews} page views</p>
    </Deferred>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/dashboard.vue"
<script setup lang="ts">
import { Deferred } from '@inertiajs/vue3'

defineProps<{
  analytics?: { pageViews: number }
}>()
</script>

<template>
  <Deferred data="analytics">
    <template #fallback>
      <p>Loading analytics...</p>
    </template>

    <template #rescue>
      <p>Analytics are temporarily unavailable.</p>
    </template>

    <p>{{ analytics?.pageViews }} page views</p>
  </Deferred>
</template>
```
:::

::::

Rescued errors never reach the response, but they are not silent. By default, each error is logged through the request logger. Register a listener with `Inertia.onRescue()` in a preload file to route rescued errors to your monitoring service instead.

```ts title="start/inertia.ts"
import * as Sentry from '@sentry/node'
import { Inertia } from '@adonisjs/inertia'

Inertia.onRescue((error, { prop }) => {
  Sentry.captureException(error, { extra: { prop } })
})
```

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

By default, data is shallow merged. For nested objects that need recursive merging, use `deepMerge()` instead.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  /**
   * Nested settings are deep merged with existing ones
   * instead of replacing the entire object.
   */
  settings: inertia.deepMerge(await fetchSettings())
})
```

You can combine merging with deferred loading by chaining the `merge()` or `deepMerge()` method.

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  notifications: inertia.defer(() => {
    return fetchNotifications()
  }).merge()
})
```

```ts title="app/controllers/users_controller.ts"
return inertia.render('users/index', {
  settings: inertia.defer(() => {
    return fetchSettings()
  }).deepMerge()
})
```

Merged arrays are appended to the existing data by default. Chain `prepend()` when new items belong at the front, such as a feed where the newest entries appear first. Direction applies to shallow merges only, since `deepMerge()` has no notion of order. The `append()` method exists to state the default explicitly.

```ts title="app/controllers/feed_controller.ts"
return inertia.render('feed', {
  /**
   * New posts are added to the front of the
   * existing list on the frontend.
   */
  posts: inertia.merge(await fetchLatestPosts()).prepend(),
})
```

When consecutive responses can contain the same records (an item moved between pages, or a feed shifted while paginating), chain `matchOn()` to merge by a key. An incoming item replaces the existing item with the same key value instead of being appended as a duplicate.

```ts title="app/controllers/notifications_controller.ts"
return inertia.render('notifications', {
  /**
   * A notification whose id already exists on the frontend
   * replaces the old entry instead of duplicating it.
   */
  notifications: inertia.merge(await fetchNotifications()).matchOn('id'),
})
```

:::note
When the frontend explicitly resets a prop (the `reset` option on partial reloads), the server sends that prop as a plain replacement and the client discards the previously merged data. You don't need to handle resets on the server.
:::

See also: [Merging props](https://inertiajs.com/merging-props) on the Inertia documentation.

### Once props

Once props are computed on the first visit and reused across later visits. Use them for data that is expensive to compute and rarely changes, like lookup tables, country lists, or plan catalogs.

```ts title="app/controllers/products_controller.ts"
return inertia.render('products/index', {
  /**
   * Computed on the first visit. Skipped on later visits
   * while the client still holds the cached value.
   */
  categories: inertia.once(async () => {
    const categories = await Category.all()
    return CategoryTransformer.transform(categories)
  }),
})
```

The cached value never expires by default. Pass options as the second argument to control expiry and the cache identity:

::::options

:::option{name="key" type="string"}
The cache key the client uses to identify the value. Defaults to the prop name. Use the same key for the same data on different pages so they share one cached value.
:::

:::option{name="expiresIn" type="number | string"}
Relative time-to-live: milliseconds as a number, or a duration string like `'30m'` or `'2h'`. After expiry, the client discards the cached value and the server recomputes the prop on the next visit.
:::

:::option{name="expiresAt" type="Date | number"}
Absolute expiry as a `Date` or epoch milliseconds. Takes precedence over `expiresIn`.
:::

:::option{name="fresh" type="boolean"}
Recompute the value for this response even when the client holds a cached copy. Useful right after the underlying data changes, for example in the response following a mutation.
:::

::::

Once behavior also chains onto the other helpers. Call `.once()` on `optional`, `defer`, `merge`, or `deepMerge` to combine client-side caching with their loading behavior.

```ts title="app/controllers/dashboard_controller.ts"
return inertia.render('dashboard', {
  /**
   * Deferred on the first load, then cached by the client
   * so later visits skip the computation entirely.
   */
  stats: inertia.defer(() => computeStats()).once({ expiresIn: '15m' }),
})
```

:::note
Partial reloads that explicitly request a once prop always recompute it. The cache only short-circuits standard visits, so `router.reload({ only: ['categories'] })` remains a reliable way to force-refresh the value from the frontend.
:::

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

The `Form` component infers the HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`) from the route name automatically. You do not need to pass a `method` prop. In fact, the AdonisJS wrapper omits `method` and `action` from the accepted props since both are derived from the route definition.

When validation fails on the server, AdonisJS automatically adds validation errors to the session flash messages. The Inertia middleware then shares these errors with the frontend, making them available through the `errors` object in your form.

### Server responses for optimistic submissions

Optimistic submissions do not require a special server response. Process the mutation in your controller and return a normal redirect to the page containing the updated props.

```ts title="app/controllers/launch_tasks_controller.ts"
import LaunchTask from '#models/launch_task'
import type { HttpContext } from '@adonisjs/core/http'

export default class LaunchTasksController {
  async toggle({ params, response }: HttpContext) {
    const task = await LaunchTask.findOrFail(params.id)

    task.completed = !task.completed
    await task.save()

    return response.redirect().back()
  }
}
```

### Scoping errors with error bags

When a page renders multiple independent forms, set the `errorBag` prop to keep their validation errors separate. The `errors` value passed to the `Form` callback is already scoped to that bag, so you can access each field directly.

```tsx title="inertia/pages/comments/index.tsx"
<Form route="comments.store" errorBag="newComment">
  {({ errors }) => (
    /**
     * errors.body holds errors from this form only.
     */
    <textarea name="body" />
  )}
</Form>
```

### Showing multiple errors per field

By default, each field in the `errors` object holds the first validation message as a string. When a field can fail several rules at once (a password with both length and complexity requirements), collect every message by passing `allMessages: true` to `getValidationErrors()` in your middleware.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    return {
      errors: ctx.inertia.always(
        this.getValidationErrors(ctx, { allMessages: true }) // [!code highlight]
      ),
    }
  }
}
```

Every field is now a `string[]`, including fields with a single message, so the shape stays uniform across the response. Tell the Inertia client about the new shape with a one-line module augmentation:

```ts title="inertia/types.ts"
declare module '@inertiajs/core' {
  interface InertiaConfig {
    errorValueType: string[]
  }
}
```

With both changes in place, render the messages as a list:

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/auth/register.tsx"
import { Form } from '@adonisjs/inertia/react'

export default function Register() {
  return (
    <Form route="auth.register">
      {({ errors }) => (
        <>
          <div>
            <label htmlFor="password">Password</label>
            <input type="password" name="password" id="password" />
            {errors.password && (
              <ul>
                {errors.password.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit">Create account</button>
        </>
      )}
    </Form>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/auth/register.vue"
<script setup lang="ts">
import { Form } from '@adonisjs/inertia/vue'
</script>

<template>
  <Form route="auth.register" v-slot="{ errors }">
    <div>
      <label for="password">Password</label>
      <input type="password" name="password" id="password" />
      <ul v-if="errors.password">
        <li v-for="message in errors.password" :key="message">
          {{ message }}
        </li>
      </ul>
    </div>

    <button type="submit">Create account</button>
  </Form>
</template>
```
:::

::::

### Route parameters

Both `Link` and `Form` accept route parameters for routes with dynamic segments. The keys in the object correspond to the parameter names defined in your route:

```ts title="start/routes.ts"
// Single parameter (:id)
router.get('posts/:id', [PostsController, 'show']).as('posts.show')

// Multiple parameters (:userId and :postId)
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

Both components accept query parameters through the `qs` prop in route mode, so adding parameters like `?page=2` keeps the type-safe `route` prop. The query string is serialized into the generated URL for you:

::::tabs

:::tab{title="React"}
```tsx
<Link route="posts.index" qs={{ page: 2, status: 'published' }}>
  Page 2
</Link>
```
:::

:::tab{title="Vue"}
```vue
<template>
  <Link route="posts.index" :qs="{ page: 2, status: 'published' }">
    Page 2
  </Link>
</template>
```
:::

::::

When a route declares query string types (inferred from its validator), TypeScript checks the `qs` keys and value types against them. Routes without declared query types accept any object.

### Programmatic navigation

Use the `useRouter` hook for navigation outside of links and forms, such as event handlers, keyboard shortcuts, or redirects after client-side work completes. The returned router carries the same route awareness as the `Link` and `Form` components: URLs and HTTP methods resolve from your route definitions, and the compiler validates route names, parameters, and request bodies.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import { useRouter } from '@adonisjs/inertia/react'

export default function PostsIndex() {
  const router = useRouter()

  function openPost(id: number) {
    router.visit({ route: 'posts.show', routeParams: { id } })
  }

  function archivePost(id: number) {
    router.patch({ route: 'posts.archive', routeParams: { id } }, { reason: 'outdated' })
  }

  // ...
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/index.vue"
<script setup lang="ts">
import { useRouter } from '@adonisjs/inertia/vue'

const router = useRouter()

function openPost(id: number) {
  router.visit({ route: 'posts.show', routeParams: { id } })
}

function archivePost(id: number) {
  router.patch({ route: 'posts.archive', routeParams: { id } }, { reason: 'outdated' })
}
</script>
```
:::

::::

The `visit` method resolves the HTTP method from the route definition, and you can override it with the `method` prop. The `get`, `post`, `put`, `patch`, and `delete` shortcuts fix the method instead: each one accepts only routes registered for that verb. The request body passed to `post`, `put`, and `patch` follows the route's declared body type, so sending a field the route does not accept is a compile-time error.

Pass `href` instead of `route` to navigate to a URL directly. Href navigation skips route validation and accepts any request payload.

```ts title="inertia/pages/session/logout_button.tsx"
router.visit({ href: '/logout' }, { method: 'post' })
```

## Non-Inertia HTTP requests

Use a non-Inertia HTTP request when you need server data without replacing the current page, changing browser history, or updating page props. The AdonisJS `useHttp` wrapper binds the request to a named route and infers its request body, response, and validation errors.

::::steps

:::step{title="Define the request validator"}

Create a VineJS validator for the request body. The generated route types will use this validator to type the data passed to `useHttp`.

```ts title="app/validators/post_lookup.ts"
import vine from '@vinejs/vine'

export const postLookupValidator = vine.create({
  id: vine.number(),
})
```

:::

:::step{title="Register a named route"}

Give the endpoint a route name. The frontend will use this name instead of constructing the URL and HTTP method manually.

```ts title="start/routes.ts"
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.post('/api/posts/lookup', [controllers.Posts, 'lookup']).as('posts.lookup')
```

:::

:::step{title="Return a serialized response"}

Validate the request and return transformed values with `HttpContext.serialize`. The generated route response type will match the values received by the browser after serialization.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'
import { postLookupValidator } from '#validators/post_lookup'

export default class PostsController {
  async lookup({ request, serialize }: HttpContext) {
    const { id } = await request.validateUsing(postLookupValidator)
    const post = await Post.findOrFail(id)

    return serialize({
      post: PostTransformer.transform(post),
    })
  }
}
```

:::

:::step{title="Submit the request from React"}

Pass the route name and initial form data to `useHttp`. The `submit` method uses the route's URL and HTTP method, while `data`, `errors`, and `response` are inferred from the validator and controller.

```tsx title="inertia/components/post_lookup.tsx"
import { useHttp } from '@adonisjs/inertia/react'

export default function PostLookup() {
  const request = useHttp({ route: 'posts.lookup' }, { id: 1 })

  async function lookup() {
    await request.submit()
  }

  return (
    <div>
      <button type="button" onClick={lookup} disabled={request.processing}>
        {request.processing ? 'Loading post…' : 'Load post'}
      </button>

      {request.errors.id && <p>{request.errors.id}</p>}
      {request.response && <p>{request.response.post.title}</p>}
    </div>
  )
}
```

:::

::::

## Shared data

Shared data is available to every page in your application without explicitly passing it from each controller. This is useful for global data like the authenticated user, validation errors, or application settings. For one-time notifications, use [flash messages](#flash-messages) instead.

Return shared data from the `share()` method in `app/middleware/inertia_middleware.ts`.

:::warning
Add or update methods on the middleware created by the starter kit. Do not replace the middleware class when adding shared data or flash data. Keep the existing `share()`, `flash()`, and `handle()` methods.
:::

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  share(ctx: HttpContext) {
    /**
     * The share method may be called before all middleware runs.
     * For example, during a 404 response. Always treat context
     * properties as potentially undefined.
     */
    const { auth } = ctx as Partial<HttpContext>

    return {
      /**
       * Using always() ensures these props are included
       * even during partial reloads.
       */
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
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

:::note
Shared props remain available during instant visits without additional configuration.
:::

### Accessing shared data

Shared data is automatically included in the props for every page. In React, when you define page props using the `InertiaProps` type helper, it includes both your page-specific props and all shared data. In Vue, use `usePage`.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '@generated/data'

type PageProps = InertiaProps<{
  posts: Data.Post[]
}>

export default function PostsIndex(props: PageProps) {
  return (
    <div>
      {/**
        * Access shared data alongside page-specific props.
        */}
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
import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { Data } from '@generated/data'

defineProps<{
  posts: Data.Post[]
}>()

/**
 * Shared props are typed, so no generic is needed.
 */
const page = usePage()

const user = computed(() => page.props.user)
</script>

<template>
  <p v-if="user">Welcome, {{ user.name }}</p>
  <!-- render posts -->
</template>
```
:::

::::

## Flash messages

Flash messages are one-time notifications stored in the session, like "Post created" after a successful mutation. They are available from `usePage().flash` and will not reappear when navigating back. Validation errors remain available through the shared page props.

Define a `flash()` method in the Inertia middleware to choose which session flash messages are sent to the frontend. Keep the existing `share()` and `handle()` methods when updating the middleware.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  flash(ctx: HttpContext) {
    const success: string | undefined = ctx.session?.flashMessages.get('success')
    const error: string | undefined = ctx.session?.flashMessages.get('error')

    return { success, error }
  }
}
```

Flash a message in the controller and redirect. The middleware picks it up on the request that follows.

```ts title="app/controllers/posts_controller.ts"
async store({ request, response, session }: HttpContext) {
  await Post.create(request.all())

  session.flash('success', 'Post created')
  return response.redirect().toRoute('posts.index')
}
```

On the frontend, flash data is available on `page.flash`, a sibling of `props`. The starter kit's default layout reads it through `usePage()` and forwards messages to toast notifications, dismissing stale toasts when the URL changes.

::::tabs

:::tab{title="React"}
```tsx title="inertia/layouts/default.tsx"
import { toast, Toaster } from 'sonner'
import { usePage } from '@inertiajs/react'
import { ReactElement, useEffect } from 'react'

export default function Layout({ children }: { children: ReactElement }) {
  const { url, flash } = usePage()

  useEffect(() => {
    toast.dismiss()
  }, [url])

  useEffect(() => {
    if (flash.error) {
      toast.error(flash.error)
    }
    if (flash.success) {
      toast.success(flash.success)
    }
  })

  return (
    <>
      <main>{children}</main>
      <Toaster position="top-center" richColors />
    </>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/layouts/default.vue"
<script setup lang="ts">
import { watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'

const page = usePage()

watch(() => page.url, () => toast.dismiss())

watch(
  () => page.flash,
  (flash) => {
    if (flash.error) {
      toast.error(flash.error)
    }
    if (flash.success) {
      toast.success(flash.success)
    }
  },
  { immediate: true }
)
</script>

<template>
  <main><slot /></main>
  <Toaster position="top-center" richColors />
</template>
```
:::

::::

For handling flash data outside a component, the client also exposes a global `flash` event (`router.on('flash', callback)`) and an `onFlash` callback on individual visits.

See also: [Flash data](https://inertiajs.com/docs/v3/data-props/flash-data) on the Inertia documentation.

Flash data follows the session's flash semantics: a message survives exactly one redirect and is cleared afterwards. When an [asset version mismatch](#asset-versioning) forces a full reload, the messages are reflashed automatically so they are not lost.

### Typing flash data

Add the following augmentation to `inertia/types.ts` to infer `usePage().flash` and flash event payloads from the middleware's `flash()` method. The starter kit includes this setup by default.

```ts title="inertia/types.ts"
import type { InferFlashData } from '@adonisjs/inertia/types'
import type InertiaMiddleware from '#middleware/inertia_middleware'

declare module '@inertiajs/core' {
  interface InertiaConfig {
    flashDataType: InferFlashData<InertiaMiddleware>
  }
}
```

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
          <Link route="posts.index" qs={{ page: metadata.currentPage - 1 }}>
            Previous
          </Link>
        )}
        {metadata.currentPage < metadata.lastPage && (
          <Link route="posts.index" qs={{ page: metadata.currentPage + 1 }}>
            Next
          </Link>
        )}
      </nav>
    </div>
  )
}
```

The pagination links use the [`qs` prop](#query-parameters) to generate URLs like `/posts?page=2`. See [Transformers](./transformers.md) for details on the `paginate` method and the shape of the metadata object.

For lists that load continuously instead of page by page, see [Infinite scroll](#infinite-scroll).

## Infinite scroll

Infinite scroll replaces pagination links with a list that keeps extending as the user scrolls. Use `inertia.scroll()` in your controller and render the prop with Inertia's `InfiniteScroll` component.

Pass `inertia.scroll()` a callback that reads the current page from the query string and returns a transformer's `paginate()` output.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ request, inertia }: HttpContext) {
    return inertia.render('posts/index', {
      posts: inertia.scroll(async () => {
        const page = request.input('page', 1)
        const posts = await Post.query().paginate(page, 10)
        return PostTransformer.paginate(posts.all(), posts.getMeta())
      }),
    })
  }
}
```

On the frontend, type the prop with the `Scroll` marker and wrap the list in the `InfiniteScroll` component, naming the prop through the `data` attribute. The marker enforces the pairing end to end: a prop declared as `Scroll<Data.Post>` type-checks only when the server produces it with `inertia.scroll()`.

::::tabs

:::tab{title="React"}
```tsx title="inertia/pages/posts/index.tsx"
import { InfiniteScroll } from '@inertiajs/react'
import type { Scroll } from '@adonisjs/inertia/types'
import { InertiaProps } from '~/types'
import { Data } from '@generated/data'

type PageProps = InertiaProps<{
  posts: Scroll<Data.Post>
}>

export default function PostsIndex({ posts }: PageProps) {
  return (
    <InfiniteScroll data="posts">
      {posts.data.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </InfiniteScroll>
  )
}
```
:::

:::tab{title="Vue"}
```vue title="inertia/pages/posts/index.vue"
<script setup lang="ts">
import { InfiniteScroll } from '@inertiajs/vue3'
import type { Scroll } from '@adonisjs/inertia/types'
import { Data } from '@generated/data'

defineProps<{
  posts: Scroll<Data.Post>
}>()
</script>

<template>
  <InfiniteScroll data="posts">
    <article v-for="post in posts.data" :key="post.id">
      <h2>{{ post.title }}</h2>
    </article>
  </InfiniteScroll>
</template>
```
:::

::::

Scroll props compose with the patterns you already know. Chain `matchOn()` to dedupe overlapping pages by a key, which matters when rows shift between requests:

```ts title="app/controllers/posts_controller.ts"
return inertia.render('posts/index', {
  /**
   * A post that appears on two consecutive pages is
   * rendered once instead of twice.
   */
  posts: inertia.scroll(async () => {
    const posts = await Post.query().paginate(request.input('page', 1), 10)
    return PostTransformer.paginate(posts.all(), posts.getMeta())
  }).matchOn('id'),
})
```

Chain `deferred()` to skip the first page during the initial render and load it right after the page mounts, matching the [deferred props](#deferred-props) behavior. Since a deferred scroll prop is absent on the first render, declare it optional on the frontend (`posts?: Scroll<Data.Post>`).

### Custom pagination cursors

For data sources without a transformer paginator (cursor pagination, an external API), pass a provider as the second argument. It receives the resolved value, which must expose a `data` array, and returns the cursor description: the query parameter name and the current, next, and previous pages.

```ts title="app/controllers/activities_controller.ts"
return inertia.render('activities/index', {
  activities: inertia.scroll(
    () => fetchActivities(request.input('cursor')),
    (result) => ({
      pageName: 'cursor',
      currentPage: result.meta.cursor,
      nextPage: result.meta.next,
      previousPage: null,
    })
  ),
})
```

:::warning
A value that is neither a transformer paginator nor accompanied by a provider cannot be paginated, and the server throws an error when rendering. Pass a provider whenever the value doesn't come from a transformer's `paginate()` method.
:::

See also: [Infinite scrolling](https://inertiajs.com/infinite-scrolling) on the Inertia documentation for the `InfiniteScroll` component options, like custom triggers and manual mode.

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

When the asset version changes during a `GET` visit, Inertia performs a full page reload at the same URL. Background requests, such as polling, postpone the reload until the user's next visit. Flash messages are preserved across the reload.

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

Server-side rendering (SSR) generates the initial HTML on the server, improving perceived performance and SEO.

The starter kit pre-wires everything SSR needs: the `inertia/ssr.tsx` entrypoint exists, `vite.config.ts` declares it under `serverEntrypoints`, and `config/inertia.ts` points at it. Enabling SSR is a single switch.

```ts title="config/inertia.ts"
import { defineConfig } from '@adonisjs/inertia'

const inertiaConfig = defineConfig({
  ssr: {
    enabled: true, // [!code highlight]
    entrypoint: 'inertia/ssr.tsx',
  },
})

export default inertiaConfig
```

If you are adding SSR to an existing application, add the same entrypoint to `serverEntrypoints` in `vite.config.ts`.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    adonisjs({
      entrypoints: ['inertia/app.tsx'],
      serverEntrypoints: ['inertia/ssr.tsx'], // [!code highlight]
    }),
  ],
})
```

## Understanding the Inertia request lifecycle

Inertia requests follow two flows: the **initial page visit** and **subsequent Inertia visits**. Both flows use the same AdonisJS routes, middleware, controllers, and `inertia.render()` calls. The response format changes based on whether the request includes the `X-Inertia` header.

### Initial page visit

The initial visit is a standard browser document request without an `X-Inertia` header. The browser needs a complete HTML document before it can boot your React or Vue application.

```sh
Initial visit (HTML response)

  Browser document request
            │
            ▼
  AdonisJS route and middleware
            │
            ▼
  Controller calls inertia.render()
            │
            ▼
  Shared props and flash data are resolved
            │
            ▼
  Root Edge template is rendered
            │
            ▼
  React or Vue boots in the browser
```

Without server-side rendering, the root template contains the application mount element and a serialized page object. The page object contains the component name, props, URL, and other Inertia state needed to start the frontend application.

When SSR is enabled for the page, the flow remains the same, but the root template also contains the server-rendered component HTML and document head elements.

### Subsequent Inertia visits

After the frontend application has booted, Inertia intercepts navigation from `Link`, `Form`, and router visits. It sends a `fetch` request with the `X-Inertia` header, telling the server that the browser already has the HTML shell.

```sh
Subsequent visit (JSON response)

  Link, Form, or router visit
            │
            ▼
  Fetch request with X-Inertia header
            │
            ▼
  Same AdonisJS route and middleware
            │
            ▼
  Same controller calls inertia.render()
            │
            ▼
  JSON page object is returned
            │
            ▼
  Inertia replaces the current page component
```

The server does not render the root Edge template during an Inertia visit. It returns the page object as JSON, and the client replaces the current component, updates browser history, and manages the scroll position without performing a full page reload.
