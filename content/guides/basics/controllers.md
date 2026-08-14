---
description: Learn how to create and use controllers to organize your route handlers in AdonisJS applications.
---

# Controllers

This guide covers controllers in AdonisJS applications. You will learn how to:

- Create and organize controllers to handle HTTP requests
- Use the barrel file system for importing controllers
- Understand the controller lifecycle and request handling
- Inject dependencies into controllers using the IoC container
- Wrap a single operation into a single action controller
- Build RESTful resource-driven controllers following conventions
- Configure controller locations and barrel file generation

:::note
**Prerequisite**: You should be familiar with [routing](./routing.md) before learning about controllers, as controllers are connected to your application through routes.
:::

## Overview

Controllers organize route handlers into dedicated JavaScript classes, solving the problem of route file bloat. Instead of defining all your route logic inline, controllers let you group related request handlers into a single class, where each method (called an action) handles a specific route.

A typical controller represents a resource (like Users, Posts, or Comments) and defines actions for creating, reading, updating, and deleting that resource. Controllers keep your routes file clean and readable, enable dependency injection for services and other dependencies, and follow RESTful conventions for resource-based CRUD operations.

Without controllers, your routes file becomes cluttered with inline handlers.

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

With controllers, you organize handlers into reusable classes.

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
  async index({ serialize }: HttpContext) {
    // Logic to fetch all posts
    return serialize({ posts: [] })
  }

  async show({ params, serialize }: HttpContext) {
    // Logic to fetch a single post
    return serialize({ post: {} })
  }

  async store({ request, serialize }: HttpContext) {
    // Logic to create a post
    return serialize({ post: {} })
  }
}
```

## Creating your first controller

::::steps
:::step{title="Generate the controller"}

Controllers are stored in the `app/controllers` directory. The easiest way to create a controller is using the `make:controller` command.

```bash
node ace make:controller posts
```

```
# Output
DONE:    create app/controllers/posts_controller.ts
```

This command creates a controller scaffolded with a plain JavaScript class and a default export.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
}
```

:::

:::step{title="Add your first action"}

A controller action is simply a method that handles an HTTP request. Let's add an `index` method to list all posts.

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
- Controller methods can return values directly (objects, arrays) or explicitly call `response.json()` or `response.send()`

:::

:::step{title="Connect the controller to a route"}

Now bind your controller action to a route.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
// [!code ++:3]
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
```

The first argument (`controllers.Posts`) references your `PostsController` class, while the second argument (`'index'`) specifies which method to call. The controller is lazy-loaded, meaning it's only imported when the route is accessed.

:::

:::step{title="Test it out"}

Start your development server if it's not already running.

```bash
node ace serve --hmr
```

Visit [`http://localhost:3333/posts`](http://localhost:3333/posts) in your browser. You should see the JSON response from your controller.

```json
{
  "posts": [
    { "id": 1, "title": "Getting started with AdonisJS" },
    { "id": 2, "title": "Understanding controllers" }
  ]
}
```

:::
::::

## The barrel file

The `#generated/controllers` import you used in the routing step is powered by a **barrel file** - a single file that consolidates all your controller imports into one convenient location. **This barrel file is automatically generated and maintained by AdonisJS**.

The barrel file is located at `.adonisjs/server/controllers.ts` and is automatically created when you start your development server. It stays up-to-date as you add or remove controllers.

Without the barrel file, you would need to manually import each controller individually in your routes file.

```ts title="❌ Without barrel file"
import router from '@adonisjs/core/services/router'

const PostsController = () => import('#controllers/posts_controller')
const UsersController = () => import('#controllers/users_controller')
const CommentsController = () => import('#controllers/comments_controller')
// ...dozens more imports as your app grows

router.get('/posts', [PostsController, 'index'])
router.get('/users', [UsersController, 'index'])
router.get('/comments', [CommentsController, 'index'])
```

The barrel file eliminates this repetition.

```ts title="✅ With barrel file"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
router.get('/users', [controllers.Users, 'index'])
router.get('/comments', [controllers.Comments, 'index'])
```

See also: [Barrel files generation guide](../concepts/barrel_files.md) for detailed configuration options.

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
  #requestId = Math.random()

  async index({ response }: HttpContext) {
    // Each request will see a different requestId
    return response.json({ requestId: this.#requestId })
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

@inject() // [!code highlight]
export default class UsersController {
  // [!code highlight]
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

- The `@inject()` decorator tells AdonisJS to use dependency injection for this controller. 
- Dependencies are type-hinted in the constructor parameters, and the IoC container automatically resolves and injects them when the controller is instantiated.

### Method injection

Method injection injects dependencies into individual controller methods. Use this when only specific methods need certain dependencies, or different methods require different dependencies.

```ts title="app/controllers/users_controller.ts"
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import UserService from '#services/user_service'
import EmailService from '#services/email_service'

export default class UsersController {
  async index(ctx: HttpContext) {
    return [{ id: 1, name: 'John' }]
  }

  // [!code highlight:2]
  @inject()
  async store(ctx: HttpContext, userService: UserService) {
    const data = ctx.request.all()
    return userService.create(data)
  }

// [!code highlight:6]
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

With method injection:

- The `@inject()` decorator is applied to individual methods rather than the class.
- The first parameter must always be HTTPContext, with dependencies following after. 
- This allows each method to have different dependencies based on its specific needs.

## Single action controllers

Not every operation belongs to a resource with multiple actions. Registering a newsletter subscription, exporting a report, or processing an incoming webhook are standalone tasks with no CRUD siblings to group them with. Putting them inside a broader controller forces you to pick a class they only loosely belong to, and the route no longer tells you what the request actually does.

A **single action controller** wraps one piece of functionality into a clearly named class. Name the class after the operation, then define a `handle` method to hold the logic.

```ts title="app/controllers/register_newsletter_subscription_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class RegisterNewsletterSubscriptionController {
  async handle({ request, response }: HttpContext) {
    const email = request.input('email')

    // Persist the subscription

    return response.created({ email })
  }
}
```

Pass the method name as an argument to `make:controller` to scaffold the class with the `handle` method already in place. The `--singular` flag is required here, because the generator pluralizes controller names by default and would otherwise produce `RegisterNewsletterSubscriptionsController`.

```bash
node ace make:controller register_newsletter_subscription handle --singular
```

```
# Output
DONE:    create app/controllers/register_newsletter_subscription_controller.ts
```

Reference the controller on the route by passing it inside an array without a method name. The router calls the `handle` method by default, so there is no second argument to write.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.post('/newsletter/subscriptions', [controllers.RegisterNewsletterSubscription])
```

The route is automatically named after the controller, converted to snake_case. The example above is reachable as `register_newsletter_subscription` when generating URLs or redirects. Use the `.as()` method to assign a different [route identifier](./routing.md#route-identifiers).

Single action controllers are regular controllers, so everything covered in this guide still applies to them. You can inject services through the constructor, attach middleware to the route, and rely on the same per-request lifecycle.

```ts title="app/controllers/register_newsletter_subscription_controller.ts"
// [!code ++:2]
import { inject } from '@adonisjs/core'
import NewsletterService from '#services/newsletter_service'
import type { HttpContext } from '@adonisjs/core/http'

@inject() // [!code ++]
export default class RegisterNewsletterSubscriptionController {
  constructor(protected newsletterService: NewsletterService) {} // [!code ++]

  async handle({ request, response }: HttpContext) {
    const email = request.input('email')
    const subscription = await this.newsletterService.subscribe(email)

    return response.created(subscription)
  }
}
```

:::tip
Name single action controllers after the operation they perform (`RegisterNewsletterSubscriptionController`, `ExportInvoicesController`) rather than after a resource. The verb in the class name is what makes the route readable at a glance.
:::

See also: [Make controller command](../../reference/commands.md#makecontroller) for the complete list of generator flags.

## Resource-driven controllers

Resource-driven controllers follow RESTful conventions for handling CRUD (Create, Read, Update, Delete) operations on a resource. AdonisJS provides special routing methods that automatically map HTTP verbs to standard controller methods.

### The seven resourceful actions

A typical resourceful controller defines seven methods that handle all CRUD operations.

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

Create a controller with all seven methods pre-filled using the `--resource` flag. This generates a controller with all seven method stubs already in place, saving you time and ensuring you follow RESTful conventions.

```bash
node ace make:controller posts --resource
```

### Registering resource routes

Instead of manually defining seven individual routes, use the `router.resource()` method to create all seven routes in a single line.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.resource('posts', controllers.Posts)
```

This generates the following routes.

::::options

:::option{name="GET /posts"}

- **Action:** `PostsController.index`
- **Name:** `posts.index`
- **Purpose:** Display a list of all posts

:::

:::option{name="GET /posts/create"}

- **Action:** `PostsController.create`
- **Name:** `posts.create`
- **Purpose:** Show form to create a new post

:::

:::option{name="POST /posts"}

- **Action:** `PostsController.store`
- **Name:** `posts.store`
- **Purpose:** Store a newly created post

:::

:::option{name="GET /posts/:id"}

- **Action:** `PostsController.show`
- **Name:** `posts.show`
- **Purpose:** Display a specific post

:::

:::option{name="GET /posts/:id/edit"}

- **Action:** `PostsController.edit`
- **Name:** `posts.edit`
- **Purpose:** Show form to edit a post

:::

:::option{name="PUT|PATCH /posts/:id"}

- **Action:** `PostsController.update`
- **Name:** `posts.update`
- **Purpose:** Update a specific post

:::

:::option{name="DELETE /posts/:id"}

- **Action:** `PostsController.destroy`
- **Name:** `posts.destroy`
- **Purpose:** Delete a specific post

:::

::::

### Nested resources

Nested resources represent hierarchical relationships between resources. For example, comments that belong to posts.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.resource('posts.comments', controllers.Comments)
```

This creates routes with both parent and child IDs.

```sh
GET        /posts/:post_id/comments
GET        /posts/:post_id/comments/create
POST       /posts/:post_id/comments

GET        /posts/:post_id/comments/:id
GET        /posts/:post_id/comments/:id/edit
PUT/PATCH  /posts/:post_id/comments/:id
DELETE     /posts/:post_id/comments/:id
```

Your controller receives both parent and child parameters.

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

```sh
GET        /posts/:post_id/comments
GET        /posts/:post_id/comments/create
POST       /posts/:post_id/comments

# Without parent ID
GET        /comments/:id
GET        /comments/:id/edit
PUT/PATCH  /comments/:id
DELETE     /comments/:id
```

Use shallow nesting when the child resource has a globally unique identifier and doesn't require the parent ID for lookup. This creates cleaner, shorter URLs while maintaining the hierarchical relationship where needed (creation and listing).

### Naming resource routes

Routes created by `router.resource()` are automatically named using a combination of the resource name and the controller action. The resource name is converted to snake_case and concatenated with the action name using a dot (`.`) separator.

For example, `router.resource('posts', controllers.Posts)` generates route names like:
- `posts.index`
- `posts.show`
- `posts.store`

You can customize the route names using the `.as()` method.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .as('articles')
```

This changes the route names while keeping the URL paths the same.

| Resource | Action name | Route name |
|----------|-------------|------------|
| posts | index | articles.index |
| posts | show | articles.show |
| posts | store | articles.store |
| posts | update | articles.update |
| posts | destroy | articles.destroy |

[Naming routes](./routing.md#route-identifiers) is important because it allows you to reference routes by name rather than hardcoding URLs throughout your application.

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

The `.only()` method creates only the specified routes.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts', controllers.Posts)
  .only(['index', 'store', 'destroy'])
```

The `.except()` method creates all routes except the specified ones.

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

The same approach works for nested resources, generating URLs like `/posts/:post/comments/:comment`.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .resource('posts.comments', controllers.Comments)
  .params({ posts: 'post', comments: 'comment' })
```

### Assigning middleware to resources

You can apply middleware to specific resource routes using the `.use()` method. This method accepts an array of action names and the middleware to apply. For example, to apply authentication middleware only to routes that modify data (create, store, update, destroy) while leaving read-only routes (index, show) public.

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

To apply middleware to all resource routes, use the wildcard `*` to ensure all routes in the resource require authentication.

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

By default, controllers are stored in the `app/controllers` directory. You can change this location in your `adonisrc.ts` file.

See also: [AdonisRC reference](../../reference/adonisrc_file.md)

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  directories: {
    controllers: 'app/http/controllers'
  }
})
```

### Barrel file configuration

The auto-generated barrel file at `#generated/controllers` can be customized to control which controllers are included or excluded, and how the file is generated.

See also: [Barrel files generation guide](../concepts/barrel_files.md)

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
