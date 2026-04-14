---
description: Learn how to use Tuyau, a type-safe HTTP client for AdonisJS applications that enables end-to-end type safety between backend and frontend.
---

# Type-safe API client

This guide covers Tuyau, a type-safe HTTP client for AdonisJS applications. You will learn how to:

- Install and configure Tuyau for Inertia and monorepo setups
- Make type-safe API calls using route names
- Handle request parameters, validation, and error responses
- Work with file uploads
- Generate URLs programmatically
- Understand type-level serialization for end-to-end type safety

## Overview

Tuyau is a type-safe HTTP client that enables end-to-end type safety between your AdonisJS backend and frontend application. Instead of manually writing API client code and managing types, Tuyau automatically generates a fully typed client based on your routes, controllers, and validators.

The key benefit of Tuyau is eliminating the gap between your backend API definition and frontend consumption. When you define a route with validation in AdonisJS, Tuyau ensures your frontend calls use the exact same types for request bodies, query parameters, route parameters, and response data. This means TypeScript will catch errors at compile time rather than discovering them at runtime.

Tuyau works by analyzing your AdonisJS routes and generating a registry that maps route names to their types. Your frontend imports this registry and uses it to make type-safe API calls. Every parameter, every field in your request body, and every property in your response is fully typed and autocompleted in your IDE.

The library is built on top of [Ky](https://github.com/sindresorhus/ky), a modern fetch wrapper, which means you get all of Ky's features like automatic retries, timeout handling, and request/response hooks while maintaining full type safety.

## Installation

Tuyau installation differs depending on whether you're using Inertia (single repository) or a monorepo setup with separate frontend and backend applications.

### Inertia applications

For Inertia applications, installation is straightforward since your frontend and backend live in the same repository. **Official starter kits for [React](https://github.com/adonisjs/starter-kits/tree/main/inertia-react) and [Vue](https://github.com/adonisjs/starter-kits/tree/main/inertia-vue) come pre-configured with Tuyau, hence no manual setup is required.**

::::steps

:::step{title="Install the package"}

```bash
npm install @tuyau/core
```

:::

:::step{title="Configure the assembler hook"}

The assembler hook automatically generates the Tuyau registry whenever your codebase changes. Add the `generateRegistry` hook to your `adonisrc.ts` file. The `indexEntities` hook indexes your models and transformers for type generation, `indexPages` indexes your Inertia page components, and `generateRegistry` generates the Tuyau registry files in the `.adonisjs/client` directory.

```ts title="adonisrc.ts"
import { indexPages } from '@adonisjs/inertia'
import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  // ... other config
  hooks: {
    // [!code highlight:5]
    init: [
      indexEntities({ transformers: { enabled: true, withSharedProps: true } }),
      indexPages({ framework: 'react' }),
      generateRegistry(),
    ],
  },
})
```

:::

:::step{title="Configure TypeScript paths"}

Configure path aliases in your Inertia `tsconfig.json` to import the generated registry.

```json title="inertia/tsconfig.json"
{
  "compilerOptions": {
    // ... other options
    "paths": {
      "~/*": ["./*"],
      // [!code highlight]
      "@generated/*": ["../.adonisjs/client/*"]
    }
  }
}
```

:::

:::step{title="Configure Vite aliases"}

Add matching aliases to your `vite.config.ts`.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/vite'

export default defineConfig({
  plugins: [
    react(),
    inertia({ ssr: { enabled: false, entrypoint: 'inertia/ssr.tsx' } }),
    adonisjs({ entrypoints: ['inertia/app.tsx'], reload: ['resources/views/**/*.edge'] }),
  ],

  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
      // [!code highlight]
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
    },
  },
})
```

:::

:::step{title="Create the Tuyau client"}

Create a file to initialize your Tuyau client.

```ts title="inertia/client.ts"
import { registry } from '@generated/registry'
import { createTuyau } from '@tuyau/core/client'

export const client = createTuyau({
  baseUrl: '/',
  registry,
})

export const urlFor = client.urlFor
```

The `baseUrl` is set to `'/'` since the frontend and backend are served from the same origin in an Inertia application.

:::

::::

### Monorepo applications

For monorepo setups where your frontend and backend are separate packages, the setup requires additional configuration to share types between workspaces.

This guide assumes you're using npm workspaces with Turborepo (as used by the [API Starter Kit](https://github.com/adonisjs/api-starter-kit)), but the concepts apply to other monorepo tools like pnpm or Yarn workspaces with slight variations in syntax.

::::steps

:::step{title="Structure your monorepo"}

Organize your monorepo with separate workspaces for your API and frontend application.

```text title="Directory structure"
my-app/
├── apps/
│   ├── backend/      # AdonisJS backend
│   └── frontend/     # Frontend (React, Vue, etc)
└── package.json
```

:::

:::step{title="Install Tuyau in the backend"}

Install `@tuyau/core` in your backend workspace. It handles both the assembler hook (registry generation) and exposes the client for your frontend to import.

```json title="apps/backend/package.json"
{
  "name": "@my-app/backend",
  "private": true,
  "type": "module",
  "dependencies": {
    "@tuyau/core": "^1.0.0" // [!code highlight]
  }
}
```

Then, in your frontend workspace, add your backend as a workspace dependency so it can import the generated registry and the Tuyau client.

```json title="apps/frontend/package.json"
{
  "name": "@my-app/frontend",
  "private": true,
  "type": "module",
  "dependencies": {
    "@my-app/backend": "*" // [!code highlight]
  }
}
```

The `"*"` version range tells npm to resolve `@my-app/backend` from your local workspace. Make sure the package name matches the `name` field in your backend's `package.json`.

:::

:::step{title="Enable experimental decorators"}

Tuyau uses TypeScript decorators internally. Enable them in your frontend `tsconfig.json`. You also need to include your backend source files so TypeScript can resolve the shared types during type-checking.

```json title="apps/frontend/tsconfig.json"
{
  "compilerOptions": {
    "experimentalDecorators": true, // [!code highlight]
    // ... other options
  },
  "include": [
    "./**/*.ts",
    "./**/*.tsx",
    // [!code highlight:2]
    "../backend/**/*.ts",
    "../backend/.adonisjs/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    // [!code highlight:2]
    "../backend/build",
    "../backend/node_modules"
  ]
}
```

:::

:::step{title="Configure the backend"}

In your backend AdonisJS application, add the `generateRegistry` hook just like in the Inertia setup.

```ts title="apps/backend/adonisrc.ts"
import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  hooks: {
    // [!code highlight:4]
    init: [
      indexEntities({ transformers: { enabled: true } }),
      generateRegistry(),
    ],
  },
})
```

:::

:::step{title="Export the registry"}

Configure your backend `package.json` to export the generated Tuyau files so your frontend can import them.

```json title="apps/backend/package.json"
{
  "name": "@my-app/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { // [!code highlight]
    "./registry": "./.adonisjs/client/registry/index.ts", // [!code highlight]
    "./data": "./.adonisjs/client/data.d.ts" // [!code highlight]
  } // [!code highlight]
}
```

These exports allow your frontend to import the registry using `@my-app/backend/registry`.

:::

:::step{title="Create the Tuyau client"}

In your frontend, create a file to initialize Tuyau.

```ts title="apps/frontend/src/lib/client.ts"
import { createTuyau } from '@tuyau/core/client'
import { registry } from '@my-app/backend/registry'

export const client = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  registry,
  headers: { Accept: 'application/json' },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      }
    ]
  }
})
```

The `baseUrl` should use an environment variable so you can configure different API URLs for development and production environments.

:::

::::

:::tip{title="Stuck somewhere?"}
Check out this [monorepo starter kit](https://github.com/Julien-R44/adonis-starter-kit) which uses TanStack for the frontend, alongside Tuyau for a Type-safe API client
:::

## Your first API call

Let's build a complete example showing how Tuyau provides end-to-end type safety from your backend route to your frontend API call.

::::steps

:::step{title="Define the backend route"}

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.post('posts', [controllers.Posts, 'store'])
```

The route name `posts.store` is automatically derived from the controller name and action. This is what you'll use to call the endpoint from your frontend.

:::

:::step{title="Create the validator"}

Define validation rules using [VineJS](../basics/validation.md).

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const createPostValidator = vine.create({
  title: vine.string().minLength(3).maxLength(255),
  content: vine.string().minLength(10),
  published: vine.boolean().optional(),
})
```

:::

:::step{title="Implement the controller"}

Create a controller action that uses the validator. The call to `request.validateUsing()` is essential for Tuyau to understand the shape of your request body and provide accurate types on the frontend.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import { createPostValidator } from '#validators/post'

export default class PostsController {
  async store({ request }: HttpContext) {
    const payload = await request.validateUsing(createPostValidator)

    const post = await Post.create(payload)
    return post
  }
}
```

:::

:::step{title="Make the API call from your frontend"}

Import your Tuyau client and call the route using its name.

```ts title="src/pages/posts/create.tsx"
import { client } from '~/client'

async function handleCreatePost() {
  const post = await client.api.posts.store({
    body: {
      title: 'My first blog post',
      content: 'This is the content of the blog post',
      published: true,
    },
  })

  console.log('Post created:', post)
}
```

Notice how the route name `posts.store` becomes a method chain `client.api.posts.store()`. The `body` parameter is fully typed based on your validator. Your IDE will autocomplete the fields and TypeScript will catch any mistakes.

:::

::::

## Making API calls

Tuyau provides three different ways to make API calls, each suited for different use cases. All three approaches provide full type safety, but they differ in syntax and flexibility.

### Using route names with proxy syntax

The recommended approach is using route names with the proxy syntax. Route names map directly to method chains on your Tuyau client.

```ts
// Route: router.post('register', [controllers.Auth, 'register'])
const result = await client.api.auth.register({
  body: { email: 'foo@ok.com', password: 'password123' }
})

// Route: router.get('users/:id', [controllers.Users, 'show'])
const user = await client.api.users.show({
  params: { id: '1' },
  query: { include: 'posts' }
})
```

Each segment of the route name becomes a property access. The route `users.show` becomes `client.api.users.show()`. This syntax provides excellent autocomplete and keeps your code clean.

:::note
Route name segments that contain underscores are converted to camelCase in the proxy syntax. For example, a route named `auth.new_account.store` becomes `client.api.auth.newAccount.store()`.
:::

### Using the request method

The `request` method provides an alternative syntax that explicitly passes the route name as a string.

```ts
const result = await client.request('auth.register', {
  body: { email: 'foo@ok.com', password: 'password123' }
})

const user = await client.request('users.show', {
  params: { id: '1' },
  query: { include: 'posts' }
})
```

This approach is functionally identical to the proxy syntax but provides a different API for constructing the request URL.

### Using HTTP method functions

Sometimes you need to call endpoints that are not part of your AdonisJS backend, for example a third-party API or a legacy service. In these cases, you can use HTTP method functions that accept URLs directly.

```ts
const user = await client.get('/users/:id', {
  params: { id: '123' },
  query: { include: 'posts' }
})

const post = await client.post('/posts', {
  body: { title: 'Hello', content: 'World' }
})

const updated = await client.patch('/posts/:id', {
  params: { id: '456' },
  body: { title: 'Updated title' }
})
```

This syntax mirrors the fetch API but maintains type safety for parameters and responses.

## Working with parameters

API calls often require different types of parameters: route parameters for dynamic URL segments, query parameters for filtering or pagination, and request bodies for data submission. Tuyau handles all of these with full type safety.

### Route parameters

Route parameters substitute dynamic segments in your URLs. When you define a route with parameters, Tuyau automatically types them.

```ts title="start/routes.ts"
router.get('users/:id', [controllers.Users, 'show'])
router.get('users/:userId/posts/:postId', [controllers.Posts, 'show'])
```

Pass route parameters using the `params` option. TypeScript will enforce that you provide all required parameters with the correct names, and your IDE will autocomplete parameter names and catch typos at compile time.

```ts
// Single parameter
const user = await client.api.users.show({
  params: { id: '123' }
})

// Multiple parameters
const post = await client.api.users.posts.show({
  params: { userId: '123', postId: '456' }
})
```

### Query parameters

Query parameters append to the URL for filtering, pagination, or passing optional data. Use the `query` option to pass them. Query parameters are automatically URL-encoded, and if your backend validates query parameters, those types are inferred on the frontend.

```ts
// Route: GET /posts
const posts = await client.api.posts.index({
  query: {
    page: 1,
    limit: 10,
    status: 'published'
  }
})
// Results in: GET /posts?page=1&limit=10&status=published
```

### Request body

For POST, PUT, and PATCH requests, send data using the `body` option. The request body types are automatically inferred from your validator. Every field is typed, and TypeScript will prevent you from sending fields that don't exist in your validator or with incorrect types.

```ts
const post = await client.api.posts.store({
  body: {
    title: 'My First Post',
    content: 'This is the content',
    published: true
  }
})
```

### Combining parameters

You can combine route parameters, query parameters, and body in a single request. Tuyau handles building the complete URL, encoding query parameters, and serializing the body while maintaining type safety for all three parameter types.

```ts
const comment = await client.api.posts.comments.store({
  params: { postId: '123' },
  query: { notify: true },
  body: {
    content: 'Great post!',
    author: 'John Doe'
  }
})
```

## Request validation and type inference

The connection between your backend validators and frontend types is what makes Tuyau's type safety possible. Understanding how this works is crucial for getting the most out of Tuyau.

### The role of request.validateUsing()

For Tuyau to infer types from your validators, you must use `request.validateUsing()` in your controller actions. Without it, Tuyau cannot determine what shape your request body should have, and your frontend types will fall back to `any`.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import { createPostValidator } from '#validators/post'

export default class PostsController {
  async store({ request }: HttpContext) {
    const payload = await request.validateUsing(createPostValidator)

    const post = await Post.create(payload)
    return post
  }
}
```

### Defining validators

Use [VineJS](../basics/validation.md) to define validation schemas. Every field you define becomes part of the type signature on the frontend.

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const createPostValidator = vine.create({
  title: vine.string().minLength(3).maxLength(255),
  content: vine.string().minLength(10),
  published: vine.boolean().optional(),
  categoryId: vine.number(),
  tags: vine.array(vine.string()).optional(),
})
```

On your frontend, the `body` parameter will have this exact shape. TypeScript will enforce required fields, prevent extra fields, and ensure correct types for each property.

```ts
await client.api.posts.store({
  body: {
    title: 'My Post',        // string (required)
    content: 'Content here', // string (required)
    published: true,         // boolean (optional)
    categoryId: 1,           // number (required)
    tags: ['news', 'tech']   // string[] (optional)
  }
})
```

### Query parameter validation

Query parameters can also be validated and typed. Define a validator for query parameters and use it in your controller. The frontend query parameters will be typed to match your validator, so TypeScript only allows valid values.

```ts title="app/validators/post.ts"
export const listPostsValidator = vine.create({
  page: vine.number().optional(),
  limit: vine.number().optional(),
  status: vine.enum(['draft', 'published']).optional(),
  search: vine.string().optional(),
})
```

```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async index({ request }: HttpContext) {
    const filters = await request.validateUsing(listPostsValidator)
    const posts = await Post.query()
      .where('status', filters.status)
      .paginate(filters.page || 1, filters.limit || 10)

    return posts
  }
}
```

```ts
const posts = await client.api.posts.index({
  query: {
    page: 1,
    limit: 20,
    status: 'published', // Only 'draft' or 'published' allowed
    search: 'typescript'
  }
})
```

## Error handling

Tuyau supports both throwing and non-throwing error handling.

By default, requests behave like regular promises. Successful responses resolve to the response payload, while failed requests throw. HTTP failures throw a `TuyauHTTPError`, and transport failures such as DNS issues, refused connections, or offline states throw a `TuyauNetworkError`.

### Using `.safe()`

If you prefer not to throw, call `.safe()` on the request. It returns a tuple where the first element is the data and the second element is the error. The error is always typed as `TuyauError`, giving you a single error shape for both HTTP and network failures.

```ts
const [data, error] = await client.api.posts.show({
  params: { id: '123' }
}).safe()

if (error) {
  console.log(error.message)
  return
}

console.log(data.title)
```

### Narrowing HTTP errors with `isStatus()`

When your controller returns typed non-2xx responses, Tuyau automatically extracts those error payloads from the controller's return type and makes them available on the client. Use `isStatus()` to narrow the error to a specific status code. After `error.isStatus(404)`, TypeScript narrows `error.response` to the exact payload shape returned by `response.notFound()` in the controller.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async show({ params, response }: HttpContext) {
    const post = await Post.find(params.id)

    if (!post) {
      return response.notFound({ message: 'Post not found', key: 'post_not_found' })
    }

    return response.ok({ post })
  }
}
```

```ts
const [data, error] = await client.api.posts.show({
  params: { id: '123' }
}).safe()

if (error?.isStatus(404)) {
  // error.response is narrowed to { message: string, key: string } (inferred from the controller)
  console.log(error.response.message)
  console.log(error.response.key)
  return
}

console.log(data.post.title)
```

### Validation errors

Routes that use `request.validateUsing()` automatically get a typed 422 error response. The type uses `SimpleError` from `@vinejs/vine/types`. Use `isValidationError()` as a shorthand for `isStatus(422)`.

```ts
const [data, error] = await client.api.posts.store({
  body: { title: '', content: '' }
}).safe()

if (error?.isValidationError()) {
  // error.response is typed as { errors: SimpleError[] }
  for (const err of error.response.errors) {
    console.log(err.field, err.message)
  }
}
```

You can customize the error type or disable it via the `validationErrorType` option in the `generateRegistry` hook in case your API returns a different shape for validation errors.

```ts title="adonisrc.ts"
generateRegistry({
  validationErrorType: '{ errors: { path: string; message: string }[] }',
  // or set to `false` to disable
})
```

### Distinguishing HTTP and network failures

The `TuyauError` type includes a `kind` property. Use it when you need to treat network failures differently from server responses.

```ts
const [, error] = await client.api.posts.show({
  params: { id: '123' }
}).safe()

if (error?.kind === 'network') {
  console.log('The server is unreachable')
}
```

For network failures, `status` and `response` are `undefined` because the server did not send a response.

### Using try/catch

If you prefer the throwing flow, cast the caught error using `Route.Error` to get full type narrowing.

```ts
import type { Route } from '@tuyau/core/types'

try {
  await client.api.posts.show({ params: { id: '123' } })
} catch (e) {
  const error = e as Route.Error<'posts.show'>

  if (error.isStatus(404)) {
    // error.response is narrowed to the 404 payload from the controller
    console.log(error.response.message)
    return
  }

  if (error.kind === 'network') {
    console.log('The server is unreachable')
  }
}
```

## Retrieving typings

Tuyau provides two type helper namespaces, `Path` and `Route`, that let you extract request, response, and error types from your API definition. This is useful when you need to type a variable, a function parameter, or a return type based on your API schema.

Both helpers are imported from `@tuyau/core/types` and expose the same utilities: `Request`, `Response`, `Error`, `Params`, `Body`, and `Query`. `Route` extracts types by route name, while `Path` extracts types by HTTP method and URL pattern.

```ts
import type { Route, Path } from '@tuyau/core/types'

// By route name
type StoreRequest = Route.Request<'posts.store'>
type StoreResponse = Route.Response<'posts.store'>
type ShowError = Route.Error<'posts.show'>
type ShowParams = Route.Params<'posts.show'>
type StoreBody = Route.Body<'posts.store'>
type IndexQuery = Route.Query<'posts.index'>

// By HTTP method + URL pattern
type LoginRequest = Path.Request<'POST', '/auth/login'>
type LoginResponse = Path.Response<'POST', '/auth/login'>
type LoginError = Path.Error<'POST', '/auth/login'>
type UserParams = Path.Params<'GET', '/users/:id'>
type LoginBody = Path.Body<'POST', '/auth/login'>
type PostsQuery = Path.Query<'GET', '/posts'>
```

The `Error` helper resolves to `TuyauError`, which means it models both HTTP and network failures while still supporting `isStatus()` for HTTP error narrowing.

## File uploads

Tuyau automatically handles file uploads by detecting File objects in your request body and switching to FormData encoding. You don't need to manually construct FormData or change content types.

### Basic file upload

When you pass a File object in your request body, Tuyau converts the entire payload to FormData automatically. Other fields like `description` are included in the same FormData payload.

```ts title="src/pages/profile.tsx"
import { client } from '~/client'

async function uploadAvatar(file: File) {
  const result = await client.api.users.avatar.update({
    body: {
      avatar: file,
      description: 'My new avatar'
    }
  })
}

// In your component
function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  if (file) {
    uploadAvatar(file)
  }
}
```

:::note
When Tuyau detects a File object in the body, it converts the entire payload to FormData. A few things to keep in mind:

- **Field names must match your validator.** The keys in the `body` object (e.g., `avatar`, `description`) become FormData field names, which must match the corresponding keys in your VineJS validator.
- **You can mix files and regular fields.** Scalar values like strings and numbers are included in the same FormData payload alongside file fields.
- **Optional file fields.** If a file field is optional in your validator, simply omit the key from the body. Do not send `undefined` or `null`, as these may be serialized as literal strings in FormData.
:::

### Backend handling

On the backend, handle file uploads using AdonisJS's standard file validation.

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'

export const updateAvatarValidator = vine.create({
  avatar: vine.file({
    size: '2mb',
    extnames: ['jpg', 'png', 'jpeg'],
  }),
  description: vine.string().optional(),
})
```

```ts title="app/controllers/users_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import { updateAvatarValidator } from '#validators/user'

export default class UsersController {
  async updateAvatar({ request, auth }: HttpContext) {
    const { avatar, description } = await request.validateUsing(updateAvatarValidator)
    
    // Move the file to storage
    await avatar.move('uploads/avatars', {
      name: `${auth.user!.id}.${avatar.extname}`
    })
    
    return { success: true }
  }
}
```

### Multiple file uploads

Upload multiple files by including multiple File objects in your payload. Tuyau handles the FormData serialization for arrays of files automatically.

```ts
const result = await client.api.posts.attachments.create({
  params: { postId: '123' },
  body: {
    files: [file1, file2, file3],
    visibility: 'public'
  }
})
```

## Generating URLs

Tuyau provides the `urlFor` helper to generate URLs from route names in a type-safe way. This is useful when you need URLs for links, redirects, or sharing, rather than making an actual API call.

### Basic URL generation

The `urlFor` method searches across all HTTP methods and returns the URL as a string. TypeScript ensures you provide the correct route name and required parameters. Invalid route names or missing parameters are caught at compile time.

```ts
import { urlFor } from '~/client'

// Generate URL for a named route
const logoutUrl = urlFor('auth.logout')
// Returns: '/logout'

const profileUrl = urlFor('users.profile', { id: '123' })
// Returns: '/users/123/profile'
```

### Method-specific URL generation

For more control, use method-specific variants like `urlFor.get` or `urlFor.post`. These return an object containing both the HTTP method and URL.

```ts
const userUrl = urlFor.get('users.show', { id: 1 })
// Returns: { method: 'get', url: '/users/1' }

const createUserUrl = urlFor.post('users.store')
// Returns: { method: 'post', url: '/users' }
```

This is useful when you need to know both the URL and which HTTP method should be used, for example when building generic link components.

### Query parameters in URLs

Add query parameters to generated URLs using the `qs` option. Query parameters are automatically URL-encoded and appended to the generated URL.

```ts
const postsUrl = urlFor.get('posts.index', {}, {
  qs: { page: 2, limit: 10, status: 'published' }
})
// Returns: { method: 'get', url: '/posts?page=2&limit=10&status=published' }
```

### Wildcard parameters

For routes with wildcard parameters, pass them as arrays.

```ts
// Route: router.get('docs/*', [controllers.Docs, 'show'])

const docsUrl = urlFor.get('docs.show', { '*': ['introduction', 'getting-started'] })
// Returns: { method: 'get', url: '/docs/introduction/getting-started' }
```

### Positional parameters

Instead of an object, you can pass parameters as an array in the order they appear in the route.

```ts
// Route: /users/:id/posts/:postId

// Using object syntax
const url1 = urlFor.get('users.posts.show', { id: '123', postId: '456' })

// Using array syntax (positional)
const url2 = urlFor.get('users.posts.show', ['123', '456'])

// Both return: { method: 'get', url: '/users/123/posts/456' }
```

Positional parameters can be convenient when parameter names are obvious from context.

## Route introspection

Tuyau provides two methods for inspecting routes at runtime. These are useful for building navigation components that highlight active links or conditionally rendering UI based on the available routes in your application.

### Checking if a route exists

The `has()` method checks whether a route name exists in the registry.

```ts
client.has('users.show')   // true
client.has('auth.login')   // true
client.has('nope')         // false
```

This is useful for conditionally rendering UI elements based on whether a route is available in the current application.

### Getting the current route

The `current()` method uses `window.location` to determine which route the user is currently on. It only matches navigable routes (GET or HEAD).

**Without arguments**, it returns the current route name, or `undefined` if no route matches (or when running server-side).

```ts
// On /users/42
client.current() // 'users.show'

// On /unknown/path
client.current() // undefined
```

**With a route name**, it returns `true` if the current URL matches that route.

```ts
// On /users/42
client.current('users.show') // true
client.current('auth.login') // false
```

**With wildcard patterns**, you can match groups of routes using `*`:

```ts
// On /users/42
client.current('users.*')    // true
client.current('posts.*')    // false
```

**With options**, you can additionally verify that the current URL params and/or query string match expected values.

```ts
// On /users/42?foo=bar
client.current('users.show', { params: { id: 42 } })           // true
client.current('users.show', { params: { id: 99 } })           // false
client.current('users.show', { query: { foo: 'bar' } })        // true
client.current('users.show', { query: { foo: 'baz' } })        // false
```

## Type-level serialization

An important concept to understand when working with Tuyau is type-level serialization. This refers to how types are automatically transformed to match what actually gets sent over the network as JSON.

### Date serialization

When you pass a Date object from your backend to the frontend, it cannot be transmitted as a Date object through JSON. Instead, it's serialized to a string. Tuyau's types automatically reflect this transformation.

```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async show({ params }: HttpContext) {
    const post = await Post.find(params.id)
    
    return {
      id: post.id,
      title: post.title,
      createdAt: new Date() // This is a Date object here
    }
  }
}
```

On the frontend, Tuyau automatically infers the type as `string`, not `Date`. This is because dates are serialized to ISO string format when sent over HTTP, and Tuyau's type system reflects this reality at compile time.

```ts
const post = await client.api.posts.show({ params: { id: '1' } })

// TypeScript knows createdAt is a string, not a Date
console.log(post.createdAt.toUpperCase()) // ✅ Works - string method
console.log(post.createdAt.getTime())     // ❌ Error - Date method doesn't exist
```

### Model serialization

A common mistake is returning [Lucid models](../database/lucid.md) directly from your controllers. When you do this, Tuyau cannot accurately infer the response types because models serialize to a generic `ModelObject` type that contains almost no useful type information.

```ts title="❌ Problematic - returns a model directly"
export default class PostsController {
  async show({ params }: HttpContext) {
    const post = await Post.find(params.id)
    return post // Model is serialized, but types are lost
  }
}
```

On the frontend, you'll get a generic `ModelObject` type with no specific fields.

```ts
const post = await client.api.posts.show({ params: { id: '1' } })
// post has type ModelObject - no autocomplete, no type safety
```

To maintain type safety, explicitly transform your models using [HTTP Transformers](./transformers.md) to plain objects before returning them.

```ts title="✅ Better - explicit serialization"
export default class PostsController {
  async show({ params, serialize }: HttpContext) {
    const post = await Post.find(params.id)
    return serialize(PostTransformer.transform(post))
  }
}
```

Now the frontend has accurate types.

```ts
const post = await client.api.posts.show({ params: { id: '1' } })
// post.title is string
// post.author.name is string
// Full autocomplete and type safety
```

## SuperJSON

As described above, when data crosses the HTTP boundary, rich JavaScript types like `Date`, `BigInt`, `Map`, or `Set` are lost — they get serialized to strings or plain objects by `JSON.stringify()`. [SuperJSON](https://github.com/flightcontrolhq/superjson) solves this by automatically preserving type information during serialization, so you receive proper typed values on the frontend instead of plain strings.

The `@tuyau/superjson` package provides both a server-side middleware and a client-side plugin that work together transparently.

### Installation

::::steps

:::step{title="Install and configure the package"}

```bash
node ace add @tuyau/superjson
```

This registers the SuperJSON middleware in your application. The middleware intercepts responses and serializes them with type metadata, then deserializes incoming request bodies on the server.

:::

:::step{title="Add the client plugin"}

On the frontend, add the `superjson` plugin when creating your Tuyau client.

```ts
import { superjson } from '@tuyau/superjson/plugin'

const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  // [!code highlight]
  plugins: [superjson()],
})
```

:::

::::

That's it for the basic setup. Native JavaScript types like `Date`, `BigInt`, `Map`, `Set`, `RegExp`, and `URL` are now automatically preserved across HTTP calls.

### Custom recipes

SuperJSON only handles native JavaScript types out of the box. If your application uses custom classes — like Luxon `DateTime` which is used by Lucid models for date fields — SuperJSON won't recognize them and they will end up as plain strings on the frontend.

You can teach SuperJSON how to handle any custom type by registering a recipe with three things: an `isApplicable` check to identify the type, a `serialize` function to convert it to a JSON-safe value, and a `deserialize` function to reconstruct it on the other side.

Since recipes must be registered on both the server and client, they should live in a shared file imported by both sides.

Here's an example with Luxon `DateTime`, which is the most common case in AdonisJS applications.

::::steps

:::step{title="Create a shared recipes file"}

```ts title="app/superjson_recipes.ts"
import { DateTime } from 'luxon'
import SuperJSON from 'superjson'

SuperJSON.registerCustom<DateTime, string>(
  {
    isApplicable: (v) => DateTime.isDateTime(v),
    serialize: (v) => v.toISO()!,
    deserialize: (v) => DateTime.fromISO(v),
  },
  'DateTime'
)
```

:::

:::step{title="Register as a server preload"}

Add the recipes file to your preloads so it runs when the server starts.

```ts title="adonisrc.ts"
export default defineConfig({
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    // [!code highlight]
    () => import('#app/superjson_recipes'),
  ],
})
```

:::

:::step{title="Import on the client side"}

Import the same file where you create your Tuyau client, so the recipes are registered before any API calls.

```ts title="inertia/client.ts"
import '#app/superjson_recipes'
import { superjson } from '@tuyau/superjson/plugin'

const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  plugins: [superjson()],
})
```

:::

::::

### Type-level integration with transformers

When using custom SuperJSON recipes with [HTTP Transformers](./transformers.md), you need to tell the transformer type system that certain types should not be converted to strings at the type level. Without this, TypeScript would still infer your `DateTime` fields as `string` in the frontend response types, even though SuperJSON preserves them at runtime.

Add a module augmentation in your API provider to extend the allowed JSON types.

```ts title="providers/api_provider.ts"
declare module '@adonisjs/core/types/transformers' {
  interface ExtendedJSONTypes {
    DateTime: import('luxon').DateTime
  }
}
```

With this augmentation, transformers that return `DateTime` values will preserve the `DateTime` type in the generated frontend types instead of converting it to `string`.

## Response parsing

By default, Tuyau parses responses based on the `Content-Type` header: JSON for `application/json`, `ArrayBuffer` for `application/octet-stream`, and text for everything else.

You can override this per-request with the `responseType` option (`'json'`, `'text'`, `'arrayBuffer'`, or `'blob'`).

```ts
const blob = await client.api.files.download({
  params: { id: '123' },
  responseType: 'blob',
})
```

## Configuration reference

The `createTuyau` function accepts several configuration options to customize how your API client behaves.

```ts
const client = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  registry,
})
```

::::options

:::option{name="baseUrl" dataType="string" required}
The base URL of your API server. All requests are prefixed with this URL. Use environment variables to configure different URLs for development and production.
:::

:::option{name="registry" dataType="object" required}
The generated registry that maps route names to URLs and types. Import this from the generated files in `.adonisjs/client` or from your backend package in a monorepo setup.
:::

::::

### Recommended options

These optional settings are highly recommended for most applications.

```ts
const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  headers: { Accept: 'application/json' },
  credentials: 'include',
})
```

::::options

:::option{name="headers" dataType="object"}
Default headers sent with every request. Setting `Accept: 'application/json'` ensures your API returns JSON responses rather than HTML error pages or other formats.

```ts
headers: {
  Accept: 'application/json',
  'X-Custom-Header': 'value'
}
```
:::

:::option{name="credentials" dataType="string"}
Controls whether cookies are sent with cross-origin requests. Set to `'include'` to send cookies for session-based authentication where your frontend and backend are on different domains.

```ts
credentials: 'include'
```
:::

::::

:::note
When `credentials: 'include'` is set, Tuyau automatically handles CSRF protection. It reads the `XSRF-TOKEN` cookie and sends it as an `X-XSRF-TOKEN` header with every request. No extra configuration is needed.
:::

### Advanced options

Tuyau is built on top of [Ky](https://github.com/sindresorhus/ky), which means you can pass any Ky option to `createTuyau`. Some useful advanced options include:

::::options

:::option{name="timeout" dataType="number"}
Request timeout in milliseconds. Requests that exceed this duration are automatically aborted.

```ts
const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  timeout: 30000, // 30 seconds
})
```
:::

:::option{name="retry" dataType="number | object"}
Configure automatic retry behavior for failed requests.

```ts
const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  retry: {
    limit: 3,
    methods: ['get', 'post'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504]
  }
})
```
:::

:::option{name="hooks" dataType="object"}
Add request/response interceptors for logging, authentication, or error handling.

```ts
const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  hooks: {
    beforeRequest: [
      request => {
        console.log('Request:', request.url)
      }
    ],
    afterResponse: [
      (request, options, response) => {
        console.log('Response:', response.status)
      }
    ],
    beforeError: [
      error => {
        console.error('Error:', error.message)
        return error
      }
    ]
  }
})
```
:::

::::

### Access token authentication

For APIs that use access token authentication (like the [API Starter Kit](https://github.com/adonisjs/api-starter-kit)), use the `hooks.beforeRequest` option to dynamically attach the `Authorization` header to every request.

```ts
const client = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  headers: { Accept: 'application/json' },
  hooks: {
    beforeRequest: [
      (request) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      }
    ]
  }
})
```

This pattern reads the token from storage before each request. You can adapt it to read from a different source (e.g., a state management store or cookie) depending on where your application stores the token after login.

For a complete list of available options, see the [Ky documentation](https://github.com/sindresorhus/ky#options).

### Filtering routes

By default, `generateRegistry` includes all named routes. Use the `routes` option to include or exclude specific routes from the generated registry.

```ts title="adonisrc.ts"
generateRegistry({
  routes: {
    only: ['api.*'],                          // substring match
    // or
    except: [/^admin\./, (name) => name.startsWith('internal.')],
  },
})
```

Filters accept strings (substring match), RegExp, or functions. You cannot use `only` and `except` together.

## Related resources

Tuyau integrates with several parts of the AdonisJS ecosystem and provides additional packages for specific use cases.

### Inertia integration

If you're using Inertia, Tuyau provides enhanced type safety for Inertia-specific features. The `@adonisjs/inertia` package exports a `<TuyauProvider>` component that enables type-safe routing and other cool features.

```tsx
import { TuyauProvider } from '@adonisjs/inertia/react'
import { client } from '~/client'

function App() {
  return (
    <TuyauProvider client={client}>
      <Link route="auth.login">Login</Link>
    </TuyauProvider>
  )
}
```

The `<Link>` component's `route` prop is fully typed. TypeScript ensures you use valid route names and provide required parameters. See the [Inertia documentation](https://docs.adonisjs.com/guides/inertia) for complete details on this integration and additional features.

### TanStack Query integration

The `@tuyau/tanstack-query` package provides React hooks that integrate Tuyau with TanStack Query (formerly React Query) for data fetching, caching, and state management. See the [TanStack Query guide](./tanstack_query.md) for instructions on setting up and using these hooks in your React components.

### Starter kits

Rather than setting up Tuyau manually, consider using one of these starter kits with Tuyau pre-configured:

- **[React Starter Kit](https://github.com/adonisjs/react-starter-kit)** - Official AdonisJS starter with React, Inertia, and Tuyau ready to use
- **[Vue Starter Kit](https://github.com/adonisjs/vue-starter-kit)** - Official AdonisJS starter with Vue, Inertia, and Tuyau ready to use
- **[Monorepo Starter Kit](https://github.com/Julien-R44/adonis-starter-kit)** - Complete monorepo setup with separate frontend and backend packages
