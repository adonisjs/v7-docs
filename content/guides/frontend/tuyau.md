# Tuyau

This guide covers Tuyau, a type-safe HTTP client for AdonisJS applications. You will learn how to install and configure Tuyau, make type-safe API calls using route names, handle request parameters and validation, work with file uploads, generate URLs programmatically, and understand type-level serialization for end-to-end type safety between your backend and frontend.

## Overview

Tuyau is a type-safe HTTP client that enables end-to-end type safety between your AdonisJS backend and frontend application. Instead of manually writing API client code and managing types, Tuyau automatically generates a fully typed client based on your routes, controllers, and validators.

The key benefit of Tuyau is eliminating the gap between your backend API definition and frontend consumption. When you define a route with validation in AdonisJS, Tuyau ensures your frontend calls use the exact same types for request bodies, query parameters, route parameters, and response data. This means TypeScript will catch errors at compile time rather than discovering them at runtime.

Tuyau works by analyzing your AdonisJS routes and generating a registry that maps route names to their types. Your frontend imports this registry and uses it to make type-safe API calls. Every parameter, every field in your request body, and every property in your response is fully typed and autocompleted in your IDE.

The library is built on top of [Ky](https://github.com/sindresorhus/ky), a modern fetch wrapper, which means you get all of Ky's features like automatic retries, timeout handling, and request/response hooks while maintaining full type safety.

## Installation

Tuyau installation differs depending on whether you're using Inertia (single repository) or a monorepo setup with separate frontend and backend applications.

### Inertia applications

For Inertia applications, installation is straightforward since your frontend and backend live in the same repository.

#### Step 1. Install the package

```bash
npm install @tuyau/core
```

#### Step 2. Configure the assembler hook

The assembler hook automatically generates the Tuyau registry whenever your codebase changes. Add the `generateRegistry` hook to your `adonisrc.ts` file:

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  // ... other config
  hooks: {
    onBuildStarting: [() => import('@adonisjs/vite/build_hook')],
    onSourceFileCreated: [() => import('@adonisjs/core/hooks/decorators')],
    // [!code highlight]
    routesScanned: [generateRegistry()],
  },
})
```

The `generateRegistry` hook runs whenever routes are scanned and generates files in the `.adonisjs/client` directory. These files contain the type information Tuyau needs to provide type safety.

#### Step 3. Configure TypeScript paths

Configure path aliases in your Inertia `tsconfig.json` to import the generated registry:

```json title="inertia/tsconfig.json"
{
  "compilerOptions": {
    // ... other options
    "paths": {
      "~/*": ["./*"],
      // [!code highlight:2]
      "~/generated/*": ["../.adonisjs/client/*"],
      "~registry": ["../.adonisjs/client/registry.ts"]
    }
  }
}
```

#### Step 4. Configure Vite aliases

Add matching aliases to your `vite.config.ts`:

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
      '~registry': `${import.meta.dirname}/.adonisjs/client/registry.ts`, 
    },
  },
})
```

#### Step 5. Create the Tuyau client

Create a file to initialize your Tuyau client:

```ts title="inertia/lib/client.ts"
import { registry } from '~registry'
import { createTuyau } from '@tuyau/core/client'

export const client = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL,
  registry,
})

export const urlFor = client.urlFor
```

The `baseUrl` should point to your API server. Using an environment variable allows different URLs for development and production.

:::tip
**Recommended approach**: Instead of manual setup, use the [React Starter Kit](https://github.com/adonisjs/react-starter-kit) which comes with Tuyau pre-configured and ready to use.
:::

### Monorepo applications

For monorepo setups where your frontend and backend are separate packages, the setup requires additional configuration to share types between workspaces.

This guide assumes you're using `pnpm workspaces`, but the concepts apply to other monorepo tools like Yarn or npm workspaces with slight variations in syntax.

#### Step 1. Structure your monorepo

Organize your monorepo with separate workspaces for your API and frontend application:

```
my-app/
├── apps/
│   ├── api/          # AdonisJS backend
│   └── web/          # Frontend (React, Vue, etc)
├── pnpm-workspace.yaml
└── package.json
```

#### Step 2. Install Tuyau in the frontend

In your frontend workspace, install Tuyau and add your API as a dependency:

```json title="apps/web/package.json"
{
  "name": "@acme/web",
  "private": true,
  "type": "module",
  "dependencies": {
    // [!code highlight:2]
    "@tuyau/core": "^3.0.0", 
    "@acme/api": "workspace:*" 
  }
}
```

The `workspace:*` syntax tells pnpm to link to your local API package. Make sure the package name matches the `name` field in your API's `package.json`.

#### Step 3. Enable experimental decorators

Tuyau uses TypeScript decorators internally. Enable them in your frontend `tsconfig.json`:

```json title="apps/web/tsconfig.json"
{
  "compilerOptions": {
    "experimentalDecorators": true, // [!code highlight]
    // ... other options
  }
}
```

#### Step 4. Configure the backend

In your backend AdonisJS application, add the `generateRegistry` hook just like in the Inertia setup:

```ts title="apps/api/adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  hooks: {
    onBuildStarting: [() => import('@adonisjs/vite/build_hook')],
    onSourceFileCreated: [() => import('@adonisjs/core/hooks/decorators')],
    routesScanned: [generateRegistry()], // [!code highlight]
  },
})
```

#### Step 5. Export the registry

Configure your backend `package.json` to export the generated Tuyau files so your frontend can import them:

```json title="apps/api/package.json"
{
  "name": "@acme/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { // [!code highlight]
    "./registry": "./.adonisjs/client/registry.ts", // [!code highlight]
    "./data": "./.adonisjs/client/data.d.ts" // [!code highlight]
  } // [!code highlight]
}
```

These exports allow your frontend to import the registry using `@acme/api/registry`.

#### Step 6. Create the Tuyau client

In your frontend, create a file to initialize Tuyau:

```ts title="apps/web/src/lib/client.ts"
import { createTuyau } from '@tuyau/core/client'
import { registry } from '@acme/api/registry'

export const tuyau = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  registry,
  headers: { Accept: 'application/json' },
  credentials: 'include',
  redirect: 'manual',
})
```

The `baseUrl` should use an environment variable so you can configure different API URLs for development and production environments.

:::tip
**Reference implementation**: Check out this [monorepo starter kit](https://github.com/Julien-R44/adonis-starter-kit) for a complete working example of Tuyau in a monorepo setup.
:::

## Your first API call

Let's build a complete example showing how Tuyau provides end-to-end type safety from your backend route to your frontend API call.

### Step 1. Define the backend route

Create a route with a name using the `as` method:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
const AuthController = () => import('#controllers/auth_controller')

router.post('register', [AuthController, 'register']).as('auth.register')
```

The route name `auth.register` is what you'll use to call this endpoint from your frontend.

### Step 2. Create the validator

Define validation rules using VineJS:

```ts title="app/validators/auth.ts"
import vine from '@vinejs/vine'

export const signupValidator = vine.compile(
  vine.object({
    fullName: vine.string().nullable(),
    email: vine.string().email().maxLength(254),
    password: vine.string().minLength(8).maxLength(32)
  })
)
```

### Step 3. Implement the controller

Create a controller action that uses the validator:

```ts title="app/controllers/auth_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { signupValidator } from '#validators/auth'

export default class AuthController {
  async register({ request, auth }: HttpContext) {
    /**
     * Validate the request body using the signup validator.
     * This is critical - Tuyau requires this to infer types.
     */
    const payload = await request.validateUsing(signupValidator)
    
    const user = await User.create({ ...payload })
    await auth.use('web').login(user)

    return { authenticated: true }
  }
}
```

The call to `request.validateUsing()` is essential for Tuyau to understand the shape of your request body and provide accurate types on the frontend.

### Step 4. Make the API call from your frontend

Import your Tuyau client and call the route using its name:

```ts title="src/pages/register.tsx"
import { tuyau } from '~/lib/client'

async function handleRegister() {
  const { authenticated } = await tuyau.auth.register({
    body: {
      email: 'foo@example.com',
      fullName: 'Foo Bar',
      password: 'password123',
    },
  })
  
  console.log('User registered:', authenticated)
}
```

Notice how the route name `auth.register` becomes a method chain `tuyau.auth.register()`. The `body` parameter is fully typed based on your validator - your IDE will autocomplete the fields and TypeScript will catch any mistakes.

## Making API calls

Tuyau provides three different ways to make API calls, each suited for different use cases. All three approaches provide full type safety, but they differ in syntax and flexibility.

### Using route names with proxy syntax

The recommended approach is using route names with the proxy syntax. Route names map directly to method chains on your Tuyau client:

```ts
// Route: router.post('register').as('auth.register')
const result = await tuyau.auth.register({
  body: { email: 'foo@ok.com', password: 'password123' }
})

// Route: router.get('users/:id').as('users.show')
const user = await tuyau.users.show({
  params: { id: '1' },
  query: { include: 'posts' }
})
```

Each segment of the route name becomes a property access. The route `users.show` becomes `tuyau.users.show()`. This syntax provides excellent autocomplete and keeps your code clean.

### Using the request method

The `request` method provides an alternative syntax that explicitly passes the route name as a string:

```ts
const result = await tuyau.request('auth.register', {
  body: { email: 'foo@ok.com', password: 'password123' }
})

const user = await tuyau.request('users.show', {
  params: { id: '1' },
  query: { include: 'posts' }
})
```

This approach is functionally identical to the proxy syntax but can be useful when you want to store route names in variables or generate them dynamically.

### Using HTTP method functions

For cases where you need to work directly with URLs instead of route names, Tuyau provides HTTP method functions:

```ts
const user = await tuyau.get('/users/:id', {
  params: { id: '123' },
  query: { include: 'posts' }
})

const post = await tuyau.post('/posts', {
  body: { title: 'Hello', content: 'World' }
})

const updated = await tuyau.patch('/posts/:id', {
  params: { id: '456' },
  body: { title: 'Updated title' }
})
```

This syntax mirrors the fetch API but maintains type safety for parameters and responses.

:::tip
**Which method should I use?**

We recommend using route names (proxy syntax or `request` method) over URL-based calls. Route names provide a layer of indirection - if you change a URL, you only need to update it in one place (the route definition) rather than searching through your frontend codebase for every hardcoded URL string.

The proxy syntax (`tuyau.auth.register()`) is slightly more ergonomic with better autocomplete, while the `request` method is useful when route names come from variables or configuration.
:::

## Working with parameters

API calls often require different types of parameters: route parameters for dynamic URL segments, query parameters for filtering or pagination, and request bodies for data submission. Tuyau handles all of these with full type safety.

### Route parameters

Route parameters substitute dynamic segments in your URLs. When you define a route with parameters, Tuyau automatically types them:

```ts title="start/routes.ts"
router.get('users/:id', [UsersController, 'show']).as('users.show')
router.get('users/:userId/posts/:postId', [PostsController, 'show']).as('users.posts.show')
```

Pass route parameters using the `params` option:

```ts
// Single parameter
const user = await tuyau.users.show({
  params: { id: '123' }
})

// Multiple parameters
const post = await tuyau.users.posts.show({
  params: { userId: '123', postId: '456' }
})
```

TypeScript will enforce that you provide all required parameters with the correct names. Your IDE will autocomplete parameter names and catch typos or missing parameters at compile time.

### Query parameters

Query parameters append to the URL for filtering, pagination, or passing optional data. Use the `query` option to pass them:

```ts
// Route: GET /posts
const posts = await tuyau.posts.index({
  query: { 
    page: 1, 
    limit: 10,
    status: 'published'
  }
})
// Results in: GET /posts?page=1&limit=10&status=published
```

Query parameters are automatically URL-encoded and appended to the request. If your backend validates query parameters, those types are inferred on the frontend.

### Request body

For POST, PUT, and PATCH requests, send data using the `body` option:

```ts
const post = await tuyau.posts.store({
  body: {
    title: 'My First Post',
    content: 'This is the content',
    published: true
  }
})
```

The request body types are automatically inferred from your validator. Every field is typed, and TypeScript will prevent you from sending fields that don't exist in your validator or with incorrect types.

### Combining parameters

You can combine route parameters, query parameters, and body in a single request:

```ts
const comment = await tuyau.posts.comments.store({
  params: { postId: '123' },
  query: { notify: true },
  body: {
    content: 'Great post!',
    author: 'John Doe'
  }
})
```

Tuyau handles building the complete URL, encoding query parameters, and serializing the body while maintaining type safety for all three parameter types.

## Request validation and type inference

The connection between your backend validators and frontend types is what makes Tuyau's type safety possible. Understanding how this works is crucial for getting the most out of Tuyau.

### The role of request.validateUsing()

For Tuyau to infer types from your validators, you must use `request.validateUsing()` in your controller actions:

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import { createPostValidator } from '#validators/post'

export default class PostsController {
  async store({ request }: HttpContext) {
    /**
     * This call is required for type inference.
     * Tuyau analyzes the validator passed to validateUsing()
     * and generates types for the frontend.
     */
    const payload = await request.validateUsing(createPostValidator)
    
    // Create the post with validated data
    const post = await Post.create(payload)
    return post
  }
}
```

Without `request.validateUsing()`, Tuyau cannot determine what shape your request body should have, and your frontend types will fall back to `any`.

### Defining validators

Use VineJS to define validation schemas. Every field you define becomes part of the type signature on the frontend:

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const createPostValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(3).maxLength(255),
    content: vine.string().minLength(10),
    published: vine.boolean().optional(),
    categoryId: vine.number(),
    tags: vine.array(vine.string()).optional()
  })
)
```

On your frontend, the `body` parameter will have this exact shape:

```ts
await tuyau.posts.store({
  body: {
    title: 'My Post',        // string (required)
    content: 'Content here', // string (required)
    published: true,         // boolean (optional)
    categoryId: 1,           // number (required)
    tags: ['news', 'tech']   // string[] (optional)
  }
})
```

TypeScript will enforce required fields, prevent extra fields, and ensure correct types for each property.

### Query parameter validation

Query parameters can also be validated and typed. Define a validator for query parameters and use it in your controller:

```ts title="app/validators/post.ts"
export const listPostsValidator = vine.compile(
  vine.object({
    page: vine.number().optional(),
    limit: vine.number().optional(),
    status: vine.enum(['draft', 'published']).optional(),
    search: vine.string().optional()
  })
)
```

```ts
// title: app/controllers/posts_controller.ts
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

The frontend query parameters are now typed:

```ts
const posts = await tuyau.posts.index({
  query: {
    page: 1,
    limit: 20,
    status: 'published', // Only 'draft' or 'published' allowed
    search: 'typescript'
  }
})
```

## File uploads

Tuyau automatically handles file uploads by detecting File objects in your request body and switching to FormData encoding. You don't need to manually construct FormData or change content types.

### Basic file upload

When you pass a File object in your request body, Tuyau converts the entire payload to FormData:

```ts title="src/pages/profile.tsx"
import { tuyau } from '~/lib/client'

async function uploadAvatar(file: File) {
  const result = await tuyau.users.avatar.update({
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

The presence of the File object triggers FormData encoding automatically. The `description` field is included in the same FormData payload.

### Backend handling

On the backend, handle file uploads using AdonisJS's standard file validation:

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'

export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg']
    }),
    description: vine.string().optional()
  })
)
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

Upload multiple files by including multiple File objects in your payload:

```ts
const result = await tuyau.posts.attachments.create({
  params: { postId: '123' },
  body: {
    files: [file1, file2, file3],
    visibility: 'public'
  }
})
```

Tuyau handles the FormData serialization for arrays of files automatically.

## Generating URLs

Tuyau provides the `urlFor` helper to generate URLs from route names in a type-safe way. This is useful when you need URLs for links, redirects, or sharing, rather than making an actual API call.

### Basic URL generation

The `urlFor` method searches across all HTTP methods and returns the URL as a string:

```ts
import { urlFor } from '~/lib/client'

// Generate URL for a named route
const logoutUrl = urlFor('auth.logout')
// Returns: '/logout'

const profileUrl = urlFor('users.profile', { id: '123' })
// Returns: '/users/123/profile'
```

TypeScript ensures you provide the correct route name and required parameters. Invalid route names or missing parameters are caught at compile time.

### Method-specific URL generation

For more control, use method-specific variants like `urlFor.get` or `urlFor.post`. These return an object containing both the HTTP method and URL:

```ts
const userUrl = urlFor.get('users.show', { id: 1 })
// Returns: { method: 'get', url: '/users/1' }

const createUserUrl = urlFor.post('users.store')
// Returns: { method: 'post', url: '/users' }
```

This is useful when you need to know both the URL and which HTTP method should be used, for example when building generic link components.

### Query parameters in URLs

Add query parameters to generated URLs using the `qs` option:

```ts
const postsUrl = urlFor.get('posts.index', {}, {
  qs: { page: 2, limit: 10, status: 'published' }
})
// Returns: { method: 'get', url: '/posts?page=2&limit=10&status=published' }
```

Query parameters are automatically URL-encoded and appended to the generated URL.

### Wildcard parameters

For routes with wildcard parameters, pass them as arrays:

```ts
// Route: router.get('docs/*', [DocsController, 'show']).as('docs.show')

const docsUrl = urlFor.get('docs.show', { '*': ['introduction', 'getting-started'] })
// Returns: { method: 'get', url: '/docs/introduction/getting-started' }
```

### Positional parameters

Instead of an object, you can pass parameters as an array in the order they appear in the route:

```ts
// Route: /users/:id/posts/:postId

// Using object syntax
const url1 = urlFor.get('users.posts.show', { id: '123', postId: '456' })

// Using array syntax (positional)
const url2 = urlFor.get('users.posts.show', ['123', '456'])

// Both return: { method: 'get', url: '/users/123/posts/456' }
```

Positional parameters can be convenient when parameter names are obvious from context.

## Type-level serialization

An important concept to understand when working with Tuyau is type-level serialization. This refers to how types are automatically transformed to match what actually gets sent over the network as JSON.

### Date serialization

When you pass a Date object from your backend to the frontend, it cannot be transmitted as a Date object through JSON. Instead, it's serialized to a string. Tuyau's types automatically reflect this transformation:

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

On the frontend, Tuyau automatically infers the type as string, not Date:

```ts
const post = await tuyau.posts.show({ params: { id: '1' } })

// TypeScript knows createdAt is a string, not a Date
console.log(post.createdAt.toUpperCase()) // ✅ Works - string method
console.log(post.createdAt.getTime())     // ❌ Error - Date method doesn't exist
```

This makes sense because dates are serialized to ISO string format when sent over HTTP. Tuyau's type system reflects this reality at compile time.

### Model serialization

A common mistake is returning Lucid models directly from your controllers. When you do this, Tuyau cannot accurately infer the response types because models serialize to a generic `ModelObject` type that contains almost no useful type information:

```ts
// ❌ Problematic - returns a model directly
export default class PostsController {
  async show({ params }: HttpContext) {
    const post = await Post.find(params.id)
    return post // Model is serialized, but types are lost
  }
}
```

On the frontend, you'll get a generic `ModelObject` type with no specific fields:

```ts
const post = await tuyau.posts.show({ params: { id: '1' } })
// post has type ModelObject - no autocomplete, no type safety
```

### Solution: HTTP Transformers

To maintain type safety, explicitly transform your models using [HTTP Transformers](./transformers.md) to plain objects before returning them:

```ts
// ✅ Better - explicit serialization
export default class PostsController {
  async show({ params, serialize }: HttpContext) {
    const post = await Post.find(params.id)
    return serialize(PostTransformer.transform(post))
  }
}
```

Now the frontend has accurate types:

```ts
const post = await tuyau.posts.show({ params: { id: '1' } })
// post.title is string
// post.author.name is string
// Full autocomplete and type safety
```

## Configuration reference

The `createTuyau` function accepts several configuration options to customize how your API client behaves.

```ts
const tuyau = createTuyau({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3333',
  registry,
})
```

**baseUrl** (string, required)
The base URL of your API server. All requests are prefixed with this URL. Use environment variables to configure different URLs for development and production:

**registry** (object, required)
The generated registry that maps route names to URLs and types. Import this from the generated files in `.adonisjs/client` or from your backend package in a monorepo setup.

### Recommended options

These optional settings are highly recommended for most applications:

```ts
const tuyau = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  headers: { Accept: 'application/json' },
  credentials: 'include',
})
```

**headers** (object, optional)
Default headers sent with every request. Setting `Accept: 'application/json'` ensures your API returns JSON responses rather than HTML error pages or other formats:

```ts
headers: { 
  Accept: 'application/json',
  'X-Custom-Header': 'value'
}
```

**credentials** (string, optional)
Controls whether cookies are sent with cross-origin requests. Set to `'include'` to send cookies for authentication:

```ts
credentials: 'include' // Send cookies with every request
```

This is essential for session-based authentication where your frontend and backend are on different domains.

### Advanced options

Tuyau is built on top of [Ky](https://github.com/sindresorhus/ky), which means you can pass any Ky option to `createTuyau`. Some useful advanced options include:

**timeout** (number, optional)
Request timeout in milliseconds. Requests that exceed this duration are automatically aborted:

```ts
const tuyau = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  timeout: 30000, // 30 seconds
})
```

**retry** (number | object, optional)
Configure automatic retry behavior for failed requests:

```ts
const tuyau = createTuyau({
  baseUrl: 'http://localhost:3333',
  registry,
  retry: {
    limit: 3,
    methods: ['get', 'post'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504]
  }
})
```

**hooks** (object, optional)
Add request/response interceptors for logging, authentication, or error handling:

```ts
const tuyau = createTuyau({
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

For a complete list of available options, see the [Ky documentation](https://github.com/sindresorhus/ky#options).

## Related resources

Tuyau integrates with several parts of the AdonisJS ecosystem and provides additional packages for specific use cases.

### Inertia integration

If you're using Inertia, Tuyau provides enhanced type safety for Inertia-specific features. The `@adonisjs/inertia` package exports a `<TuyauProvider>` component that enables type-safe routing and other cool features:

```tsx
import { TuyauProvider } from '@adonisjs/inertia/react'
import { tuyau } from '~/lib/client'

function App() {
  return (
    <TuyauProvider client={tuyau}>
      <Link route="auth.login">Login</Link>
    </TuyauProvider>
  )
}
```

The `<Link>` component's `route` prop is fully typed - TypeScript ensures you use valid route names and provide required parameters. See the [Inertia documentation](https://docs.adonisjs.com/guides/inertia) for complete details on this integration and additional features.

### TanStack Query integration

The `@tuyau/tanstack-query` package provides React hooks that integrate Tuyau with TanStack Query (formerly React Query) for data fetching, caching, and state management. See the [TanStack Query guide](./tanstack-query.md) for instructions on setting up and using these hooks in your React components.

### Starter kits

Rather than setting up Tuyau manually, consider using one of these starter kits with Tuyau pre-configured:

- **[React Starter Kit](https://github.com/adonisjs/react-starter-kit)** - Official AdonisJS starter with React, Inertia, and Tuyau ready to use
- **[Monorepo Starter Kit](https://github.com/Julien-R44/adonis-starter-kit)** - Complete monorepo setup with separate frontend and backend packages

These repositories serve as reference implementations showing best practices for Tuyau configuration.
