---
summary: Learn how to create and use controllers to organize your route handlers in AdonisJS applications.
---

# Controllers

Controllers are JavaScript classes that organize your route handlers into dedicated files. Each controller typically represents a resource (like Users, Posts, or Comments) and contains multiple methods, each handling requests for specific routes.

:::note
**Prerequisite**: You should be familiar with [routing](./routing.md) before learning about controllers, as controllers are connected to your application through routes.
:::

## Why use controllers?

Controllers keep your routes file clean, organize code into logical groups, and enable dependency injection for services and other dependencies. Here's the difference:

**Without controllers** (inline route handlers):
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/posts', async () => {
  // Logic to fetch all posts
  return { posts: [] }
})

router.get('/posts/:id', async ({ params }) => {
  // Logic to fetch a single post
  return { post: {} }
})

router.post('/posts', async ({ request }) => {
  // Logic to create a post
  return { post: {} }
})

// This file becomes unmanageable as routes grow
```

**With controllers** (organized and reusable):
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

// Clean, organized route definitions
router.get('/posts', [controllers.Posts, 'index'])
router.get('/posts/:id', [controllers.Posts, 'show'])
router.post('/posts', [controllers.Posts, 'store'])
```

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    // Logic to fetch all posts
    return response.json({ posts: [] })
  }

  async show({ params }: HttpContext) {
    // Logic to fetch a single post
    return { post: {} }
  }

  async store({ request }: HttpContext) {
    // Logic to create a post
    return { post: {} }
  }
}
```

## Creating your first controller

### Step 1: Generate the controller

Controllers are stored in the `app/controllers` directory. The easiest way to create a controller is using the `make:controller` command:

```bash
node ace make:controller posts
```

```
# Output
DONE:    create app/controllers/posts_controller.ts
```

This command creates a controller scaffolded with a plain JavaScript class and a default export:

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
}
```

### Step 2: Add your first action

A controller action is simply a method that handles an HTTP request. Let's add an `index` method to list all posts:

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  // [!code ++:11]
  /**
   * Handle GET requests to list all posts
   */
  async index({ response }: HttpContext) {
    const posts = [
      { id: 1, title: 'Getting started with AdonisJS' },
      { id: 2, title: 'Understanding controllers' },
    ]
    
    return response.json({ posts })
  }
}
```

A few important things to know about controller actions:
- The first parameter is always the **HTTPContext** object
- You can destructure specific properties like `request`, `response`, `params`, `session`, or `auth`
- You can also use the full context: `async index(ctx: HttpContext)`
- Controller methods can return values directly (objects, arrays) or explicitly call `response.json()` or `response.send()`

### Step 3: Connect the controller to a route

Now bind your controller action to a route:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
// [!code ++:3]
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
```

The first argument (`controllers.Posts`) references your `PostsController` class, while the second argument (`'index'`) specifies which method to call. The controller is lazy-loaded, meaning it's only imported when the route is accessed.


### Step 4: Test it out

Start your development server if it's not already running:

```bash
node ace serve --hmr
```

Visit `http://localhost:3333/posts` in your browser. You should see the JSON response from your controller:

```json
{
  "posts": [
    { "id": 1, "title": "Getting started with AdonisJS" },
    { "id": 2, "title": "Understanding controllers" }
  ]
}
```

## The barrel file

The `#generated/controllers` import you used in the routing step is powered by a **barrel file** - a single file that consolidates all your controller imports into one convenient location. This barrel file is automatically generated and maintained by AdonisJS.

The barrel file is located at `.adonisjs/server/controllers.ts` and is automatically created when you start your development server. It stays up-to-date as you add or remove controllers.

Without the barrel file, you would need to manually import each controller individually in your routes file:

```ts title="start/routes.ts (without barrel file)"
import router from '@adonisjs/core/services/router'

const PostsController = () => import('#controllers/posts_controller')
const UsersController = () => import('#controllers/users_controller')
const CommentsController = () => import('#controllers/comments_controller')
// ...dozens more imports as your app grows

router.get('/posts', [PostsController, 'index'])
router.get('/users', [UsersController, 'index'])
router.get('/comments', [CommentsController, 'index'])
```

The barrel file eliminates this repetition:

```ts title="start/routes.ts (with barrel file)"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
router.get('/users', [controllers.Users, 'index'])
router.get('/comments', [controllers.Comments, 'index'])
```

See also: [Barrel files generation guide](../concepts/barrel_files.md) for detailed configuration options.

## Common pitfalls

### Using static imports instead of lazy imports

Your editor's autocomplete might suggest importing a controller directly when you start typing. This creates a static import that breaks Hot Module Replacement (HMR):

```ts
import PostsController from '#controllers/posts_controller'
router.get('/posts', [PostsController, 'index'])
```

When you use static imports, your controller changes won't be reflected until you restart the server, even with HMR enabled. This slows down development significantly.

**The solution**: Always use the lazy import pattern with the `#generated/controllers` barrel file to ensure your controller changes are hot-reloaded during development without restarting the server:

```ts
import { controllers } from '#generated/controllers'
router.get('/posts', [controllers.Posts, 'index'])
```

## Understanding controller lifecycle

Controllers in AdonisJS are **instantiated per request**. Every time an HTTP request matches a route bound to a controller, AdonisJS creates a fresh instance of that controller class using the IoC container.

This means:
- Each request gets its own isolated controller instance
- No risk of state leakage between requests
- You can safely use instance properties if needed
- The controller instance is garbage collected after the request completes

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  // This property is unique to each request
  private requestId = Math.random()

  async index({ response }: HttpContext) {
    // Each request will see a different requestId
    return response.json({ requestId: this.requestId })
  }
}
```

## Dependency injection

Controllers support dependency injection, allowing you to inject services, repositories, or other classes into your controller methods or constructors. The IoC container automatically resolves and injects these dependencies for you.

See also: [Dependency Injection guide](../concepts/dependency_injection.md) for a comprehensive understanding of how dependency injection works in AdonisJS.

### Constructor injection

Constructor injection injects dependencies once when the controller is instantiated. Use this when all or most methods in your controller need the same dependencies.

```ts title="app/controllers/users_controller.ts"
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import UserService from '#services/user_service'

@inject()
export default class UsersController {
  constructor(protected userService: UserService) {}

  async index(ctx: HttpContext) {
    return this.userService.all()
  }

  async show({ params }: HttpContext) {
    return this.userService.find(params.id)
  }

  async store({ request }: HttpContext) {
    const data = request.all()
    return this.userService.create(data)
  }
}
```

The `@inject()` decorator tells AdonisJS to use dependency injection for this controller. Dependencies are type-hinted in the constructor parameters, and the IoC container automatically resolves and injects them when the controller is instantiated. Using `protected` or `private` access modifiers makes the service available to all methods in the controller.

### Method injection

Method injection injects dependencies into individual controller methods. Use this when:
- Only **specific methods** need certain dependencies
- Different methods require **different dependencies**
- You want to keep the controller lightweight

```ts title="app/controllers/users_controller.ts"
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import UserService from '#services/user_service'
import EmailService from '#services/email_service'

export default class UsersController {
  async index(ctx: HttpContext) {
    // No dependencies needed for simple listing
    return [{ id: 1, name: 'John' }]
  }

  @inject()
  async store(ctx: HttpContext, userService: UserService) {
    const data = ctx.request.all()
    return userService.create(data)
  }

  @inject()
  async sendEmail(
    ctx: HttpContext,
    userService: UserService,
    emailService: EmailService
  ) {
    const user = await userService.find(ctx.params.id)
    await emailService.send(user.email, 'Welcome!')
    return { sent: true }
  }
}
```

With method injection, the `@inject()` decorator is applied to individual methods rather than the class. The first parameter must always be HTTPContext, with dependencies following after. This allows each method to have different dependencies based on its specific needs.

## Resource-driven controllers

Resource-driven controllers follow RESTful conventions for handling CRUD (Create, Read, Update, Delete) operations on a resource. AdonisJS provides special routing methods that automatically map HTTP verbs to standard controller methods.

### The seven resourceful actions

A typical resourceful controller defines seven methods that handle all CRUD operations:

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  /**
   * Display a list of all posts
   * GET /posts
   */
  async index({ response }: HttpContext) {
    const posts = [] // Fetch from database
    return response.json({ posts })
  }

  /**
   * Render a form to create a new post
   * GET /posts/create
   * 
   * Not needed for API-only applications
   */
  async create({ view }: HttpContext) {
    return view.render('posts/create')
  }

  /**
   * Handle form submission to create a new post
   * POST /posts
   */
  async store({ request }: HttpContext) {
    const data = request.all()
    // Create post in database
    return { post: data }
  }

  /**
   * Display a single post by id
   * GET /posts/:id
   */
  async show({ params }: HttpContext) {
    // Fetch post from database
    return { post: { id: params.id } }
  }

  /**
   * Render a form to edit an existing post
   * GET /posts/:id/edit
   * 
   * Not needed for API-only applications
   */
  async edit({ params, view }: HttpContext) {
    return view.render('posts/edit', { id: params.id })
  }

  /**
   * Handle form submission to update a post
   * PUT/PATCH /posts/:id
   */
  async update({ params, request }: HttpContext) {
    const data = request.all()
    // Update post in database
    return { post: { id: params.id, ...data } }
  }

  /**
   * Delete a post by id
   * DELETE /posts/:id
   */
  async destroy({ params }: HttpContext) {
    // Delete post from database
    return { deleted: true }
  }
}
```

### Generating resourceful controllers

Create a controller with all seven methods pre-filled using the `--resource` flag. This generates a controller with all seven method stubs already in place, saving you time and ensuring you follow RESTful conventions:

```bash
node ace make:controller posts --resource
```

### Registering resource routes

Instead of manually defining seven individual routes, use the `router.resource()` method to create all seven routes in a single line:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.resource('posts', controllers.Posts)
```

This generates the following routes:

| HTTP Method | Path              | Controller Method | Purpose                  |
| ----------- | ----------------- | ----------------- | ------------------------ |
| `GET`       | `/posts`          | `index`           | List all posts           |
| `GET`       | `/posts/create`   | `create`          | Show form to create post |
| `POST`      | `/posts`          | `store`           | Create new post          |
| `GET`       | `/posts/:id`      | `show`            | Display single post      |
| `GET`       | `/posts/:id/edit` | `edit`            | Show form to edit post   |
| `PUT/PATCH` | `/posts/:id`      | `update`          | Update existing post     |
| `DELETE`    | `/posts/:id`      | `destroy`         | Delete post              |

### Nested resources

Nested resources represent hierarchical relationships between resources. For example, comments that belong to posts:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.resource('posts.comments', controllers.Comments)
```

This creates routes with both parent and child IDs:

| HTTP Method | Path | Controller Method | Purpose |
|-------------|------|-------------------|---------|
| `GET` | `/posts/:post_id/comments` | `index` | List all comments for a post |
| `GET` | `/posts/:post_id/comments/create` | `create` | Show form to create comment |
| `POST` | `/posts/:post_id/comments` | `store` | Create new comment for a post |
| `GET` | `/posts/:post_id/comments/:id` | `show` | Display single comment |
| `GET` | `/posts/:post_id/comments/:id/edit` | `edit` | Show form to edit comment |
| `PUT/PATCH` | `/posts/:post_id/comments/:id` | `update` | Update comment |
| `DELETE` | `/posts/:post_id/comments/:id` | `destroy` | Delete comment |

Your controller receives both parent and child parameters:

```ts title="app/controllers/comments_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class CommentsController {
  async index({ params }: HttpContext) {
    // params.post_id - the parent post ID
    // Fetch comments for this post
    return { post_id: params.post_id, comments: [] }
  }

  async show({ params }: HttpContext) {
    // params.post_id - the parent post ID
    // params.id - the comment ID
    return { post_id: params.post_id, comment: { id: params.id } }
  }
}
```

### Shallow nested resources

Shallow resources omit the parent ID from routes where the child resource can be uniquely identified on its own. This is useful when the child ID is globally unique and doesn't need to be scoped to the parent.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.shallowResource('posts.comments', controllers.Comments)
```

With shallow resources, the `show`, `edit`, `update`, and `destroy` actions omit the parent ID since a comment can be looked up by its own ID:

| HTTP Method | Path | Controller Method | Notes |
|-------------|------|-------------------|-------|
| `GET` | `/posts/:post_id/comments` | `index` | Needs parent ID to list |
| `GET` | `/posts/:post_id/comments/create` | `create` | Needs parent ID for form |
| `POST` | `/posts/:post_id/comments` | `store` | Needs parent ID to create |
| `GET` | `/comments/:id` | `show` | âš¡ No parent ID needed |
| `GET` | `/comments/:id/edit` | `edit` | âš¡ No parent ID needed |
| `PUT/PATCH` | `/comments/:id` | `update` | âš¡ No parent ID needed |
| `DELETE` | `/comments/:id` | `destroy` | âš¡ No parent ID needed |

Use shallow nesting when the child resource has a globally unique identifier and doesn't require the parent ID for lookup. This creates cleaner, shorter URLs while maintaining the hierarchical relationship where needed (creation and listing).

### Naming resource routes

Routes created by `router.resource()` are automatically named using a combination of the resource name and the controller action. The resource name is converted to snake_case and concatenated with the action name using a dot (`.`) separator.

For example, `router.resource('posts', controllers.Posts)` generates route names like:
- `posts.index`
- `posts.show`
- `posts.store`

You can customize the route names using the `.as()` method:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .as('articles')
```

This changes the route names while keeping the URL paths the same:

| Resource | Action name | Route name |
|----------|-------------|------------|
| posts | index | articles.index |
| posts | show | articles.show |
| posts | store | articles.store |
| posts | update | articles.update |
| posts | destroy | articles.destroy |

Naming routes is important because it allows you to reference routes by name rather than hardcoding URLs throughout your application.

See also: [Route identifiers](./routing.md#route-identifier) to understand why naming routes matters.

### Filtering resource routes

By default, `router.resource()` creates all seven RESTful routes. You can filter which routes are generated using several methods.

#### API-only resources

When building APIs, you typically don't need the `create` and `edit` routes since forms are displayed by client-side code. The `.apiOnly()` method excludes these routes and creates only five routes: `index`, `store`, `show`, `update`, and `destroy`:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.resource('posts', controllers.Posts).apiOnly()
```

#### Selective filtering with `only` and `except`

For more granular control, use the `.only()` or `.except()` methods. These methods accept an array of action names.

The `.only()` method creates only the specified routes:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .only(['index', 'store', 'destroy'])
```

The `.except()` method creates all routes except the specified ones:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .except(['create', 'edit'])
```

### Renaming resource params

By default, resource routes use `:id` as the parameter name. You can customize this using the `.params()` method, which accepts an object where the key is the resource name and the value is the desired parameter name.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .params({ posts: 'post' })
```

This changes the URL parameters from `:id` to `:post`:

| Before (default)              | After (with custom param)       |
| ----------------------------- | ------------------------------- |
| `/posts/:id`                  | `/posts/:post`                  |
| `/posts/:id/edit`             | `/posts/:post/edit`             |
| `/posts/:id` (update/destroy) | `/posts/:post` (update/destroy) |

The same approach works for nested resources, generating URLs like `/posts/:post/comments/:comment`:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts.comments', controllers.Comments)
  .params({ posts: 'post', comments: 'comment' })
```

### Assigning middleware to resources

You can apply middleware to specific resource routes using the `.use()` method. This method accepts an array of action names and the middleware to apply. For example, to apply authentication middleware only to routes that modify data (create, store, update, destroy) while leaving read-only routes (index, show) public:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .resource('posts', controllers.Posts)
  .use(
    ['create', 'store', 'update', 'destroy'],
    middleware.auth()
  )
```

To apply middleware to all resource routes, use the wildcard `*` to ensure all routes in the resource require authentication:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router
  .resource('posts', controllers.Posts)
  .use('*', middleware.auth())
```

## Configuration

Controllers work out of the box with no initial configuration required. However, you can customize certain aspects of how controllers are generated and organized.

### Customizing controller location

By default, controllers are stored in the `app/controllers` directory. You can change this location in your `adonisrc.ts` file:

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  directories: {
    controllers: 'app/http/controllers'
  }
})
```

See also: [adonisrc reference](../reference/adonisrc_file.md) for complete configuration options.

### Barrel file configuration

The auto-generated barrel file at `#generated/controllers` can be customized to control which controllers are included or excluded, and how the file is generated.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  barrelFiles: {
    controllers: {
      enabled: true,
      export: (path) => `export * as ${path.name} from '${path.modulePath}'`
    }
  }
})
```

See also: [Barrel files generation guide](../concepts/barrel_files.md) for detailed configuration options.

## See also

- [Routing guide](./routing.md) - Prerequisite for understanding controllers
- [Dependency Injection](../concepts/dependency_injection.md) - Deep dive into the IoC container and DI patterns
- [Barrel files generation](../concepts/barrel_files.md) - Customize the auto-generated controller imports
- [adonisrc reference](../reference/adonisrc_file.md) - Configure controller directory and other project settings
- [make:controller command](../reference/commands.md#makecontroller) - Complete command reference with all options
