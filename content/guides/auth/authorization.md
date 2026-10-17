---
description: Learn how to implement authorization in AdonisJS using abilities and policies with the Bouncer package.
---

# Authorization

This guide covers authorization in AdonisJS using Bouncer. You will learn how to:

- Define authorization checks as abilities and policies
- Use authorization throughout your application (controllers, templates, APIs)
- Handle advanced scenarios like guest users and policy hooks
- Implement authorization in API and Inertia applications

## Overview

Authorization determines what authenticated users are allowed to do in your application. While authentication answers "who are you?", authorization answers "what can you do?". Bouncer provides a structured way to define and check permissions throughout your AdonisJS application.

Instead of scattering authorization checks throughout your codebase, Bouncer encourages you to extract them into dedicated locations. This keeps your authorization logic centralized, reusable, and testable.

## Installation

Install and configure Bouncer using the following command.

```sh
node ace add @adonisjs/bouncer
```

:::disclosure{title="Steps performed by the add command"}

1. Registers the `@adonisjs/bouncer/bouncer_provider` service provider and `@adonisjs/bouncer/commands` inside the `adonisrc.ts` file.
2. Registers the `indexPolicies` init hook inside the `adonisrc.ts` file. This hook generates the policies [barrel file](../concepts/barrel_files.md).
3. Creates the `app/abilities/main.ts` file to define and export abilities.
4. Creates the `initialize_bouncer_middleware.ts` file inside the middleware directory and registers it within the `start/kernel.ts` file.

:::

## Defining abilities

An **ability** is a function that checks whether a user is authorized to perform a specific action. Abilities are lightweight and work well when you have a small number of simple authorization checks.

Abilities are defined in the `app/abilities/main.ts` file using the `Bouncer.ability()` method. Each ability receives the user as the first parameter, followed by any resources needed to make the authorization decision, then returns a boolean value indicating whether the action is allowed.

```ts title="app/abilities/main.ts"
import User from '#models/user'
import Post from '#models/post'
import { Bouncer } from '@adonisjs/bouncer'

export const editPost = Bouncer.ability((user: User, post: Post) => {
  return user.id === post.userId
})

export const sendEmail = Bouncer.ability((user: User) => {
  return user.role === 'admin'
})
```

The `editPost` ability checks if a user owns a specific post by comparing user IDs. The `sendEmail` ability verifies if a user has an admin role. Notice that `sendEmail` only needs the user parameter since it doesn't check permissions against a specific resource.

## Using abilities in controllers

You can check abilities in your controllers using the `ctx.bouncer` object. Import the ability you want to check and pass it to one of the bouncer methods.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import router from '@adonisjs/core/services/router'
import type { HttpContext } from '@adonisjs/core/http'
// [!code highlight]
import { editPost } from '#abilities/main'

export default class PostsController {
  async update({ bouncer, params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // [!code highlight:3]
    if (await bouncer.denies(editPost, post)) {
      return response.forbidden('You cannot edit this post')
    }

    // Continue with update logic
    return 'Post updated successfully'
  }
}
```

Notice that you only pass the `post` parameter to `bouncer.denies()`, not the user. The bouncer is already tied to the currently logged-in user and automatically provides it as the first argument to your ability.

## Authorization methods

Bouncer provides four methods for checking authorization, each suited to different use cases.

### Using allows and denies

The `allows` method checks if the user is authorized and returns `true` if they are. The `denies` method is the opposite, returning `true` if the user is not authorized.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { editPost } from '#abilities/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async update({ bouncer, params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // [!code highlight:3]
    if (await bouncer.allows(editPost, post)) {
      return 'You can edit this post'
    }

    return response.forbidden('You cannot edit this post')
  }
}
```

### Using authorize

The `authorize` method throws an [`E_AUTHORIZATION_FAILURE`](../../reference/exceptions.md#e_authorization_failure) exception when authorization fails. This exception is self-handled and converted to an HTTP response based on content negotiation.

- HTML requests receive the error message as plain text with the response status code (`403` by default).
- JSON requests receive an `errors` array containing the error message.
- JSON API requests (`application/vnd.api+json`) receive an `errors` array containing the error `code` and `title`.
- Form submissions (`POST`, `PUT`, `PATCH`, and `DELETE` requests expecting HTML) are redirected back to the previous page when the session package is installed. The form input is flashed (except passwords and the CSRF token), the error message is flashed under the `error` key, and also added to the flashed errors under the `E_AUTHORIZATION_FAILURE` key. This lets you display the error on the form the user just submitted.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { editPost } from '#abilities/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async update({ bouncer, params }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    await bouncer.authorize(editPost, post)

    // If we reach here, authorization succeeded
    return 'Post updated successfully'
  }
}
```

### Using execute

The `execute` method returns an `AuthorizationResponse` object that contains detailed information about the authorization check. This is useful for advanced scenarios where you need to inspect the authorization result beyond a simple boolean.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { editPost } from '#abilities/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async update({ bouncer, params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    const result = await bouncer.execute(editPost, post)

    if (!result.authorized) {
      return response
        .status(result.status || 403)
        .send({ error: result.message || 'Unauthorized' })
    }

    return 'Post updated successfully'
  }
}
```

The `AuthorizationResponse` object has the `authorized` (boolean), `message` (string or undefined), and `status` (number or undefined) properties. You can use these to create custom error responses with specific status codes and messages.

## Custom authorization responses

By default, abilities return boolean values. However, you can return an `AuthorizationResponse` object to specify custom error messages and status codes.

```ts title="app/abilities/main.ts"
import User from '#models/user'
import Post from '#models/post'
import { Bouncer, AuthorizationResponse } from '@adonisjs/bouncer'

export const editPost = Bouncer.ability((user: User, post: Post) => {
  if (user.id === post.userId) {
    return AuthorizationResponse.allow()
  }
  
  return AuthorizationResponse.deny('Post not found', 404)
})
```

In this example, when authorization fails, the error message will be "Post not found" with a 404 status code instead of the default 403 Forbidden. This is useful when you want to hide the existence of a resource from unauthorized users.

When your application uses [`@adonisjs/i18n`](../digging_deeper/i18n.md), you can attach a translation identifier to the response using the `t` method. The exception handler will translate the message using the current request locale and fall back to the message passed to `deny` when the translation is missing. Without a custom identifier, Bouncer uses the `errors.E_AUTHORIZATION_FAILURE` identifier.

```ts title="app/abilities/main.ts"
import User from '#models/user'
import Post from '#models/post'
import { Bouncer, AuthorizationResponse } from '@adonisjs/bouncer'

export const editPost = Bouncer.ability((user: User, post: Post) => {
  if (user.id === post.userId) {
    return AuthorizationResponse.allow()
  }

  // [!code highlight]
  return AuthorizationResponse.deny('Post not found', 404).t('errors.not_found')
})
```

## Defining policies

A **policy** is a class that groups multiple authorization checks for a specific resource. Policies are recommended when you need structured authorization around specific resources or when you have many authorization checks throughout your application. For example, you might create one policy for your Post model and another for your Comment model.

Policies extend the `BasePolicy` class and are stored in the `app/policies` directory. They benefit from dependency injection through the IoC container, making it easy to inject services and other dependencies.

Generate a new policy using the `make:policy` command.

```sh
node ace make:policy post
```

This creates an empty policy class in the `app/policies` directory. You may also pass action names after the policy name to pre-define methods, and the `--model` flag to import a model other than the one inferred from the policy name.

```sh
node ace make:policy post view edit delete --model=Article
```

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
}
```

Add methods to your policy for each authorization action. Each method receives the user as the first parameter, optionally followed by the resource, and returns an `AuthorizerResponse` (a boolean or `AuthorizationResponse` object).

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
  create(user: User): AuthorizerResponse {
    return true
  }

  edit(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }

  delete(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }
}
```

:::tip

Even when multiple actions have identical logic (like `edit` and `delete` in this example), create separate methods for each action. This makes it easier to evolve the logic independently later as your requirements change.

:::

## Using policies in controllers

You can use policies in controllers by calling `bouncer.with()` to select the policy, then using the same authorization methods you use with abilities.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import PostPolicy from '#policies/post_policy'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async delete({ bouncer, params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // [!code highlight:3]
    if (await bouncer.with(PostPolicy).denies('delete', post)) {
      return response.forbidden('Cannot delete this post')
    }

    await post.delete()
    return { message: 'Post deleted successfully' }
  }
}
```

The `bouncer.with()` method accepts the policy class and returns an object with the same `allows`, `denies`, `authorize`, and `execute` methods. TypeScript will provide autocomplete for the available actions from your policy.

### String-based policy references

Instead of importing the policy class, you can reference it by name as a string. This works because Bouncer maintains a barrel file of all policies at `.adonisjs/server/policies.ts`.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async delete({ bouncer, params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // [!code highlight:3]
    if (await bouncer.with('PostPolicy').denies('delete', post)) {
      return response.forbidden('Cannot delete this post')
    }

    await post.delete()
    return { message: 'Post deleted successfully' }
  }
}
```

The [barrel file](../concepts/barrel_files.md) is generated by the `indexPolicies` hook registered in your `adonisrc.ts` file. It is created when you start the development server or build your application, and stays up-to-date as you add or remove policies. This file exports an object where each key is the policy name and the value is the lazy import of that policy module.

## Policy hooks

Policies support `before` and `after` hooks that run around authorization checks. These hooks provide powerful ways to create reusable authorization logic.

### The before hook

The `before` hook runs before the actual authorization method is called. This is useful for implementing logic that applies to all actions in a policy, such as granting full access to administrators.

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
  // [!code highlight:5]
  before(user: User | null, action: string, ...params: any[]) {
    if (user && user.role === 'admin') {
      return true
    }
  }

  edit(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }

  delete(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }
}
```

The `before` hook receives the user, the action name being checked, and any additional parameters passed to the action method. The return value controls how authorization proceeds.

| Return Value | Behavior |
|--------------|----------|
| `true` | Authorization succeeds immediately. The action method is not called. |
| `false` | Authorization fails immediately. The action method is not called. |
| `undefined` | Continue to the action method to perform the authorization check. |

In this example, any user with the `role = 'admin'` property will bypass all authorization checks. Regular users will proceed through the normal `edit` and `delete` methods.

### The after hook

The `after` hook runs after the action method completes. This allows you to inspect or override the authorization response.

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
  // [!code highlight:10]
  after(
    user: User | null,
    action: string,
    response: AuthorizerResponse,
    ...params: any[]
  ) {
    if (user && user.isAdmin) {
      return true
    }
  }

  edit(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }

  delete(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }
}
```

The `after` hook receives the user, action name, the authorization response from the action method, and any additional parameters. The return value determines the final result.

| Return Value | Behavior |
|--------------|----------|
| `true` | Authorization succeeds. The original response is discarded. |
| `false` | Authorization fails. The original response is discarded. |
| `undefined` | The original response from the action method is used. |

The `after` hook is useful for applying organization-wide policies that override resource-specific checks. For example, you might allow administrators or support staff to access all resources regardless of individual authorization rules.

## Handling guest users

By default, authorization checks automatically return `false` when there is no authenticated user. This means guests are denied access unless you explicitly allow them.

### Allowing guests in abilities

To allow guest users in an ability, pass the `allowGuest` option as the first argument to `Bouncer.ability()`. The user parameter will be typed as `User | null`.

```ts title="app/abilities/main.ts"
import User from '#models/user'
import Post from '#models/post'
import { Bouncer } from '@adonisjs/bouncer'

export const viewPost = Bouncer.ability(
  { allowGuest: true },
  (user: User | null, post: Post) => {
    if (post.isPublished) {
      return true
    }

    if (!user) {
      return false
    }

    return user.id === post.userId
  }
)
```

### Allowing guests in policies

Use the `@allowGuest` decorator on policy methods that should accept guest users.

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
import { BasePolicy, allowGuest } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class PostPolicy extends BasePolicy {
  @allowGuest()
  view(user: User | null, post: Post): AuthorizerResponse {
    if (post.isPublished) {
      return true
    }

    if (!user) {
      return false
    }

    return user.id === post.userId
  }

  edit(user: User, post: Post): AuthorizerResponse {
    return user.id === post.userId
  }
}
```

The `@allowGuest` decorator expects the type of the user parameter to be `User | null`, and the authorization check will execute even when no user is authenticated.

## Using Bouncer in Edge templates

You can use authorization checks in Edge templates to conditionally show or hide UI elements. Edge provides `@can` and `@cannot` tags that work with both abilities and policies.

### Using abilities in templates

Reference abilities by their exported name as a string. Edge will resolve and import them automatically.

```edge title="resources/views/posts/show.edge"
@can('editPost', post)
  @link({ route: 'posts.edit', routeParams: [post.id] })
    Edit Post
  @end
@end

@cannot('deletePost', post)
  <p>You cannot delete this post</p>
@end
```

### Using policies in templates

Reference policy actions using the format `PolicyName.methodName`.

```edge title="resources/views/posts/show.edge"
@can('PostPolicy.edit', post)
  @link({ route: 'posts.edit', routeParams: [post.id] })
    Edit Post
  @end
@end

@can('PostPolicy.delete', post)
  @form({ method: 'delete', route: 'posts.delete', routeParams: [post.id] })
    @!button({ type: 'submit', text: 'Delete Post' })
  @end
@end
```

## Creating custom Bouncer instances

During HTTP requests, the `InitializeBouncerMiddleware` automatically creates a Bouncer instance for the currently logged-in user by fetching it from `ctx.auth.user`. This instance is available via `ctx.bouncer` and is also shared with Edge templates.

You can create a custom Bouncer instance for a different user, such as when sending notifications or performing background jobs.

```ts title="app/services/notification_service.ts"
import User from '#models/user'
import Post from '#models/post'
import { Bouncer } from '@adonisjs/bouncer'
import * as abilities from '#abilities/main'
import { editPost } from '#abilities/main'
import { policies } from '#generated/policies'

export default class NotificationService {
  async sendNotification(user: User, post: Post) {
    const bouncer = new Bouncer(user, abilities, policies)

    if (await bouncer.allows(editPost, post)) {
      // Send notification about post editing
    }
  }
}
```

TypeScript will provide intelligent autocomplete based on the user type, suggesting only policies and abilities that accept the same user type.

## Dependency injection in policies

Policy classes are instantiated using the IoC container, which means you can inject dependencies into the constructor.

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
import { inject } from '@adonisjs/core'
import { BasePolicy } from '@adonisjs/bouncer'
import { Logger } from '@adonisjs/core/logger'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

@inject()
export default class PostPolicy extends BasePolicy {
  constructor(protected logger: Logger) {
    super()
  }

  edit(user: User, post: Post): AuthorizerResponse {
    this.logger.info('Checking edit permission', { userId: user.id, postId: post.id })
    return user.id === post.userId
  }
}
```

The `@inject()` decorator tells the IoC container to resolve the dependencies automatically.

## Authorization in API and Inertia applications

Abilities and policies are defined server-side and require access to server resources like models, databases, and services. This means you cannot share them directly with frontend code in API or Inertia applications.

However, you can compute the authorization results on the server and include them in your API responses. Your frontend application only needs to know which actions a user can perform to show or hide UI elements appropriately.

### Computing permissions in transformers

For row-level permissions where you need to check authorization for individual records, compute the permissions within transformers.

```ts title="app/transformers/post_transformer.ts"
import Post from '#models/post'
import { inject } from '@adonisjs/core'
import PostPolicy from '#policies/post_policy'
import { HttpContext } from '@adonisjs/core/http'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class PostTransformer extends BaseTransformer<Post> {
  @inject()
  async toObject({ bouncer }: HttpContext) {
    // [!code highlight]
    const policy = bouncer.with(PostPolicy)

    return {
      id: this.resource.id,
      title: this.resource.title,
      content: this.resource.content,
      // [!code highlight:5]
      permissions: {
        edit: await policy.allows('edit', this.resource),
        delete: await policy.allows('delete', this.resource),
      },
    }
  }
}
```

### Computing permissions in Inertia middleware

For application-level permissions that don't vary by record, compute them once as shared data inside the Inertia middleware.

```ts title="app/middleware/inertia_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  async share(ctx: HttpContext) {
    const postPolicy = ctx.bouncer.with('PostPolicy')

    return {
      // ...rest of the properties
      permissions: ctx.inertia.once(async () => {
        return {
          post: {
            create: await postPolicy.allows('create'),
          }
        }
      }),
    }
  }
}
```

## Testing authorization logic

You can test your authorization logic using either unit tests for individual policies and abilities, or functional tests that verify authorization end-to-end through HTTP requests.

### Unit testing policies

Test policy classes directly by instantiating them and calling their methods with the required arguments.

```ts title="tests/unit/post_policy.spec.ts"
import { test } from '@japa/runner'
import User from '#models/user'
import Post from '#models/post'
import PostPolicy from '#policies/post_policy'

test.group('Post policy', () => {
  test('allows owner to edit post', async ({ assert }) => {
    const user = new User()
    user.id = 1

    const post = new Post()
    post.userId = 1

    const policy = new PostPolicy()
    const canEdit = policy.edit(user, post)

    assert.isTrue(canEdit)
  })

  test('denies non-owner from editing post', async ({ assert }) => {
    const user = new User()
    user.id = 1

    const post = new Post()
    post.userId = 2

    const policy = new PostPolicy()
    const canEdit = policy.edit(user, post)

    assert.isFalse(canEdit)
  })
})
```

### Functional testing with HTTP requests

Test authorization end-to-end by making HTTP requests and verifying that unauthorized users receive appropriate error responses.

```ts title="tests/functional/posts/update.spec.ts"
import { test } from '@japa/runner'
import User from '#models/user'
import Post from '#models/post'

test.group('Posts update', () => {
  test('allows owner to update post', async ({ client }) => {
    const user = await User.create({ email: 'user@example.com' })
    const post = await Post.create({ userId: user.id, title: 'Test' })

    const response = await client
      .put(`/posts/${post.id}`)
      .loginAs(user)
      .json({ title: 'Updated' })

    response.assertStatus(200)
  })

  test('denies non-owner from updating post', async ({ client }) => {
    const owner = await User.create({ email: 'owner@example.com' })
    const otherUser = await User.create({ email: 'other@example.com' })
    const post = await Post.create({ userId: owner.id, title: 'Test' })

    const response = await client
      .put(`/posts/${post.id}`)
      .loginAs(otherUser)
      .json({ title: 'Updated' })

    response.assertStatus(403)
  })
})
```
