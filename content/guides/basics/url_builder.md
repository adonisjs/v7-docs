---
description: Learn how to generate type-safe URLs for named routes in templates, redirects, and frontend applications.
---

# URL Builder

This guide covers URL generation in AdonisJS applications. You will learn how to:

- Generate URLs for named routes with type-safe autocompletion
- Pass route parameters using arrays or objects
- Add query strings to generated URLs
- Create signed URLs with cryptographic signatures for secure links
- Verify signed URLs to prevent tampering
- Integrate URL generation into frontend applications using Inertia

## Overview

The URL builder provides a type-safe API for generating URLs from named routes. Instead of hard-coding URLs throughout your application in templates, frontend components, API responses, or redirects, you reference routes by name. This ensures that when you change a route's path, you don't need to hunt down and update every URL reference across your codebase.

Once a route is named, you can generate URLs for it using the `urlFor` helper in templates, the `response.redirect().toRoute()` method for redirects, or by importing the `urlFor` function from the URL builder service for other contexts.

The URL builder is type-safe, meaning your IDE will provide autocompletion for route names and TypeScript will catch errors if you reference a non-existent route. This eliminates an entire class of bugs where URLs might break silently after refactoring routes.

## Defining named routes

Every route using a controller is automatically assigned a name based on the controller and method name. The naming convention follows the pattern `controller.method` (explained in detail in the [routing guide](./routing.md#route-identifiers)).

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

// Automatically named as 'posts.show'
router.get('/posts/:id', [controllers.posts, 'show'])

// Automatically named as 'posts.index'
router.get('/posts', [controllers.posts, 'index'])
```

For routes without controllers, you must explicitly assign a name using the `.as()` method.

```ts title="start/routes.ts"
router.get('/about', async () => {
  return 'About page'
}).as('about')
```

You can view all named routes in your application using the following Ace command.

```bash
node ace list:routes
```

## Generating URLs in templates

Edge templates have access to the `urlFor` helper by default. This helper generates URLs for named routes and accepts route parameters as either an array or an object.

```edge title="resources/views/posts/index.edge"
<a href="{{ urlFor('posts.show', { id: post.id }) }}">
  View post
</a>
```

When using the Hypermedia starter kit, you can also use the `@link` component, which accepts the route and parameters as component props.

```edge title="resources/views/posts/index.edge"
@link({ route: 'posts.show', routeParams: { id: post.id } })
  View post
@end
```

## Generating URLs during redirects

When redirecting users to a different page, use the `response.redirect().toRoute()` method instead of hard-coding URLs. You can only redirect to `GET` routes.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    const post = await Post.create(request.all())
    
    return response
      .redirect()
      .toRoute('posts.show', { id: post.id })
  }
}
```

## Generating URLs in other contexts

For contexts outside of templates and HTTP responses, such as background jobs, email notifications, or service classes, import the `urlFor` function from the URL builder service.

```ts title="app/services/notification_service.ts"
import { urlFor } from '@adonisjs/core/services/url_builder'

export default class NotificationService {
  async sendPostNotification(post: Post) {
    const postUrl = urlFor('posts.show', { id: post.id })
    
    await mail.send({
      subject: 'New post published',
      html: `<a href="${postUrl}">View post</a>`
    })
  }
}
```

## Passing route parameters

Route parameters can be passed as either an array (positional matching) or an object (named matching). Choose the approach that makes your code more readable.

**Array (positional parameters):** Parameters are matched by position to the route pattern.

```ts
// Route: /posts/:id
urlFor('posts.show', [1])
// Output: /posts/1

// Route: /users/:userId/posts/:postId
urlFor('users.posts.show', [5, 10])
// Output: /users/5/posts/10
```

**Object (named parameters):** Parameters are matched by name to the route pattern.

```ts
// Route: /posts/:id
urlFor('posts.show', { id: 1 })
// Output: /posts/1

// Route: /users/:userId/posts/:postId
urlFor('users.posts.show', { userId: 5, postId: 10 })
// Output: /users/5/posts/10
```

## Adding query strings

Query strings can be added to generated URLs by passing a third options parameter with a `qs` property. The query string object can contain nested values, which are automatically serialized into the proper format.

```ts title="app/controllers/posts_controller.ts"
import { urlFor } from '@adonisjs/core/services/url_builder'

const url = urlFor('posts.index', [], {
  qs: {
    filters: {
      title: 'typescript',
    },
    order: {
      direction: 'asc',
      column: 'id'
    },
  }
})

// Output: /posts?filters[title]=typescript&order[direction]=asc&order[column]=id
```

The same `qs` option works in templates and redirects.

```edge title="resources/views/partials/pagination.edge"
<a href="{{ urlFor('posts.index', [], { qs: { page: 2, sort: 'title' } }) }}">
  Next page
</a>
```

```ts title="app/controllers/posts_controller.ts"
response.redirect().toRoute('posts.index', [], {
  qs: { page: 2, sort: 'title' }
})
```

## Signed URLs

Signed URLs include a cryptographic signature that prevents tampering. If someone modifies the URL, the signature becomes invalid and the request can be rejected. This is useful for scenarios where URLs are publicly accessible but need protection against manipulation, such as newsletter unsubscribe links or password reset tokens.

### Creating signed URLs

Signed URLs are created using the `signedUrlFor` helper exported from the URL builder service. The API is identical to `urlFor`, but the generated URL includes a signature.

```ts title="app/mails/newsletter_mail.ts"
import User from '#models/user'
import { appUrl } from '#config/app'
import { BaseMail } from '@adonisjs/mail'
// [!code highlight]
import { signedUrlFor } from '@adonisjs/core/services/url_builder'

export default class NewsletterMail extends BaseMail {
  subject = 'Weekly Newsletter'

  constructor(protected user: User) {
    super()
  }

  prepare() {
    // [!code highlight:8]
    const unsubscribeUrl = signedUrlFor(
      'newsletter.unsubscribe',
      { email: this.user.email },
      {
        expiresIn: '30 days',
        prefixUrl: appUrl,
      }
    )

    this.message.htmlView('emails/newsletter', {
      user: this.user,
      unsubscribeUrl
    })
  }
}
```

The `expiresIn` option sets when the signed URL expires. After expiration, the signature is no longer valid. The `prefixUrl` option is required when the URL will be shared externally, such as in emails or external notifications, to ensure the URL includes the full domain. For internal app navigation, relative URLs without the domain are sufficient.

### Creating signed URLs from route patterns

By default, `signedUrlFor` looks up the route by its name and uses the route definition to build the URL. You may disable the lookup when you need to sign a URL from a route pattern that is not registered in the router.

```ts
import { signedUrlFor } from '@adonisjs/core/services/url_builder'

const url = signedUrlFor(
  '/files/:key',
  { key: 'invoice.pdf' },
  {
    disableRouteLookup: true,
    prefixUrl: 'https://example.com',
    qs: {
      download: true,
    },
  }
)
```

When `disableRouteLookup` is enabled, the first argument is parsed as a route pattern and signed directly. Regular `signedUrlFor` calls continue to use route lookup and keep their route-name type safety.

The generated signed URL includes a signature query parameter appended to the URL.

```text
https://example.com/newsletter/unsubscribe?email=user@example.com&signature=eyJtZXNzYWdlIjoiL25ld3NsZXR0ZXIvdW5zdWJzY3JpYmU_ZW1haWw9dXNlckBleGFtcGxlLmNvbSIsInB1cnBvc2UiOiJzaWduZWRfdXJsIn0.1234567890abcdef
```

:::note
Signed URLs can only be created in backend code, not in frontend applications. This is because they rely on the encryption module, which uses a secret key. Exposing this key to the frontend would compromise security.
:::

### Verifying signed URLs

The route for which the signed URL was generated can verify the signature using the `request.hasValidSignature()` method during an HTTP request. This method checks both the signature and expiration.

```ts title="app/controllers/newsletter_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class NewsletterController {
  async unsubscribe({ request, response }: HttpContext) {
    if (!request.hasValidSignature()) {
      return response.badRequest('Invalid or expired unsubscribe link')
    }
    
    const email = request.qs().email
    // Process unsubscribe request
  }
}
```

## Frontend integration

The URL builder service is available only within the backend application since that's where routes are defined. However, applications using Inertia or a separate frontend inside a monorepo can generate a similar URL builder for the frontend codebase.

### Why separate frontend and backend URL builders?

AdonisJS enforces a clear boundary between frontend and backend codebases to prevent issues like leaking sensitive information to the client. Routes on the backend contain details about controller mappings and internal application structure. Making all this information available on the frontend would not only leak unnecessary information but also significantly increase your bundle size.

Additionally, from a runtime perspective, you cannot share an object between two different runtimes (Node.js and the browser). Creating the illusion of a shared URL builder is not something we support or believe in.

### Using the URL builder in Inertia apps

The Inertia React and Vue starter kits come with the URL builder pre-configured. The URL builder (along with the API client) is generated using [Tuyau](../frontend/api_client.md) and written to the `.adonisjs/client` directory.

Import and use the URL builder in your frontend components with an identical API to the backend version.

```tsx title="inertia/pages/posts/index.tsx"
import { urlFor } from '~/client'

export default function PostsIndex({ posts }) {
  return (
    <div>
      {posts.map(post => (
        <a key={post.id} href={urlFor('posts.show', { id: post.id })}>
          {post.title}
        </a>
      ))}
    </div>
  )
}
```

The usage API is identical to the backend URL builder service, supporting both array and object parameters, as well as query strings.

```ts
// Using positional parameters
urlFor('posts.show', [post.id])

// Using named parameters
urlFor('posts.show', { id: post.id })

// Adding query strings
urlFor('posts.index', [], {
  qs: { page: 2, sort: 'title' }
})
```

### Excluding routes from frontend bundle

You can configure which routes are available in the frontend URL builder to reduce bundle size and prevent exposing internal routes. The URL builder is generated using an Assembler hook named `generateRegistry` registered in your `adonisrc.ts` file.

Define routes to exclude using the `exclude` option.

```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@adonisjs/assembler/hooks'

export default defineConfig({
  init: [
    generateRegistry({
      exclude: ['admin.*'],
    })
  ],
})
```

The exclude pattern can use one of the following approaches, tested against the route name:

:::option{name="Wildcard pattern"}

Exclude all routes starting with the prefix before the wildcard.

```ts title="adonisrc.ts"
generateRegistry({
  exclude: ['admin.*', 'api.internal.*'],
})
```

:::

:::option{name="Regular expression"}

Use a custom regular expression to exclude matching routes.

```ts title="adonisrc.ts"
generateRegistry({
  exclude: [/^admin\./, /^api\.internal\./],
})
```

:::

:::option{name="Custom function"}

Write a custom function for advanced filtering logic. Return `false` to skip the route and `true` to include it.

```ts title="adonisrc.ts"
generateRegistry({
  exclude: [
    (route) => {
      // Exclude all routes on the admin domain
      if (route.domain === 'admin.myapp.com') {
        return false
      }
      // Include all other routes
      return true
    }
  ],
})
```

:::

You can combine multiple patterns for complex filtering requirements.

```ts title="adonisrc.ts"
generateRegistry({
  exclude: [
    'admin.*',
    /^api\.internal\./,
    (route) => route.domain !== 'admin.myapp.com'
  ],
})
```
