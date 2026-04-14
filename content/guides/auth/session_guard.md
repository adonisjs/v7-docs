---
description: Learn how to authenticate users using the session guard in AdonisJS.
---

# Session guard

This guide covers session-based authentication in AdonisJS. You will learn:

- How to configure the session guard
- How to log users in and out
- How to protect routes from unauthenticated access
- How to access the authenticated user
- How to implement "Remember Me" functionality
- How to prevent logged-in users from accessing guest-only pages

## Overview

The session guard uses the [@adonisjs/session](../basics/session.md) package to track logged-in users. When a user logs in, their identifier is stored in the session, and a cookie is sent to the browser. On subsequent requests, the session middleware reads this cookie and restores the authenticated state.

Sessions and cookies have been the standard for web authentication for decades. Use the session guard when building server-rendered applications or SPAs hosted on the same top-level domain as your API (for example, your app at `example.com` with an API at `api.example.com`).

## Configuring the guard

Authentication guards are defined in `config/auth.ts`. The following example shows a session guard configuration:
```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

const authConfig = defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig
```

The `sessionGuard` method creates an instance of the [SessionGuard](https://github.com/adonisjs/auth/blob/10.x/modules/session_guard/guard.ts) class. It accepts a user provider and an optional configuration object for remember me tokens.

The `sessionUserProvider` method creates an instance of [SessionLucidUserProvider](https://github.com/adonisjs/auth/blob/10.x/modules/session_guard/user_providers/lucid.ts), which uses a Lucid model to find users during authentication.

## Logging in

Use the `auth.use('web').login()` method to create a session for a user. The method accepts a User model instance and stores their identifier in the session.
```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth, response }: HttpContext) {
    /**
     * Get credentials from request body
     */
    const { email, password } = request.only(['email', 'password'])

    /**
     * Verify credentials using the AuthFinder mixin
     */
    const user = await User.verifyCredentials(email, password)

    /**
     * Create session for the user
     */
    await auth.use('web').login(user)

    /**
     * Redirect to a protected page
     */
    return response.redirect('/dashboard')
  }
}
```

The `auth.use('web')` method returns the guard instance configured under the name `web` in your `config/auth.ts` file.

## Logging out

Use the `auth.use('web').logout()` method to destroy the user's session. If the user has an active remember me token, it will also be deleted.
```ts title="app/controllers/session_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/login')
  }
}
```

## Protecting routes

Use the `auth` middleware to protect routes from unauthenticated users. The middleware is registered in `start/kernel.ts` under the named middleware collection:
```ts title="start/kernel.ts"
import router from '@adonisjs/core/services/router'

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
})
```

Apply the middleware to routes that require authentication:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('dashboard', ({ auth }) => {
    return `Welcome ${auth.user!.fullName}`
  })
  .use(middleware.auth())
```

By default, the auth middleware authenticates using the `default` guard from your config. To specify guards explicitly, pass them as an option:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('dashboard', ({ auth }) => {
    return `Welcome ${auth.user!.fullName}`
  })
  .use(
    middleware.auth({
      guards: ['web', 'api'],
    })
  )
```

When multiple guards are specified, authentication succeeds if any of them authenticates the request.

### Handling authentication errors

When the auth middleware cannot authenticate a request, it throws the [E_UNAUTHORIZED_ACCESS](https://github.com/adonisjs/auth/blob/10.x/src/errors.ts#L21) exception. The exception is converted to an HTTP response using content negotiation:

- Requests with `Accept: application/json` receive an array of error objects.
- Requests with `Accept: application/vnd.api+json` receive errors formatted per the JSON API specification.
- Server-rendered applications redirect to `/login`. You can customize this path in `app/middleware/auth_middleware.ts`.

## Accessing the authenticated user

After authentication, the user instance is available via `auth.user`. This property is populated when using the `auth` middleware, the `silent_auth` middleware, or when manually calling `auth.authenticate()` or `auth.check()`.
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('dashboard', async ({ auth }) => {
    const user = auth.user!
    return await user.getAllMetrics()
  })
  .use(middleware.auth())
```

### Avoiding non-null assertions

If you prefer not to use the non-null assertion operator (`!`), use the `auth.getUserOrFail()` method instead. It returns the user or throws [E_UNAUTHORIZED_ACCESS](../../reference/exceptions.md#e_unauthorized_access):
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('dashboard', async ({ auth }) => {
    const user = auth.getUserOrFail()
    return await user.getAllMetrics()
  })
  .use(middleware.auth())
```

### Checking authentication status

Use the `auth.isAuthenticated` property to check if the current request is authenticated:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('dashboard', async ({ auth }) => {
    if (auth.isAuthenticated) {
      return await auth.user!.getAllMetrics()
    }
  })
  .use(middleware.auth())
```

### Silent authentication

The `silent_auth` middleware works like the `auth` middleware but doesn't throw an exception when the user is unauthenticated. The request continues normally, allowing you to optionally use authentication data when available.

This is useful for pages that work for both guests and authenticated users, such as a homepage that shows personalized content for logged-in users.

Register the middleware in your router middleware stack:
```ts title="start/kernel.ts"
import router from '@adonisjs/core/services/router'

router.use([
  // ...other middleware
  () => import('#middleware/silent_auth_middleware'),
])
```

### Accessing the user in Edge templates

The [initialize auth middleware](./introduction.md#the-initialize-auth-middleware) shares the `ctx.auth` object with Edge templates. Access the authenticated user via `auth.user`:
```edge
@if(auth.isAuthenticated)
  <p>Hello {{ auth.user.email }}</p>
@end
```

On public pages that aren't protected by the auth middleware, call `auth.check()` to attempt authentication before accessing `auth.user`:
```edge
{{-- Check if user is logged in without requiring authentication --}}
@eval(await auth.check())

<header>
  @if(auth.isAuthenticated)
    <p>Hello {{ auth.user.email }}</p>
  @else
    <a href="/login">Sign in</a>
  @end
</header>
```

## Remember me

The "Remember Me" feature keeps users logged in after their session expires by storing a long-lived token in a cookie. When the session expires, AdonisJS uses this token to automatically recreate the session.

### Creating the tokens table

Remember me tokens are stored in the database. Create a migration for the tokens table:
```sh
node ace make:migration remember_me_tokens
```
```ts title="database/migrations/TIMESTAMP_create_remember_me_tokens_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'remember_me_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments()
      table
        .integer('tokenable_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('hash').notNullable().unique()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.timestamp('expires_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### Configuring the token provider

Assign the `DbRememberMeTokensProvider` to your User model:
```ts title="app/models/user.ts"
import { BaseModel } from '@adonisjs/lucid/orm'
import { DbRememberMeTokensProvider } from '@adonisjs/auth/session'

export default class User extends BaseModel {
  // ...other model properties

  static rememberMeTokens = DbRememberMeTokensProvider.forModel(User)
}
```

### Enabling remember me tokens

Enable the feature in your guard configuration:
```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'

const authConfig = defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: true,
      rememberMeTokensAge: '2 years',
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig
```

### Generating tokens during login

Pass a boolean as the second argument to `login()` to generate a remember me token:
```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(
      user,
      !!request.input('remember_me')
    )

    return response.redirect('/dashboard')
  }
}
```

## Redirecting to the intended URL

When unauthenticated users try to access a protected page, the auth middleware redirects them to the login page. After login, you will want to send them back to the page they originally requested instead of a generic dashboard.

### Forced login flow

When the auth middleware rejects an unauthenticated request, it automatically stores the current URL in the session before redirecting to the login page. This happens for GET, navigational (non-AJAX) requests that matched a route. No changes to your auth middleware are needed.

In your login controller, use `toIntendedRoute()` to redirect after successful authentication. It reads the stored URL from the session and falls back to the provided default.

```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)

    /**
     * Redirect to the page the user was trying to access,
     * or dashboard if no intended URL was stored
     */
    return response.redirect().toIntendedRoute('dashboard')
  }
}
```

### Voluntary login flow

When a user voluntarily clicks a login link from a public page, the current URL can be passed as a query parameter. The login page handler stores it in the session using `session.setIntendedUrl()`, which validates the URL to prevent open redirects.

```edge title="resources/views/partials/header.edge"
<a href="{{ route('auth.login', {}, { qs: { intended: request.url(true) } }) }}">
  Login
</a>
```

```ts title="app/controllers/session_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async show({ request, session, view }: HttpContext) {
    const intended = request.input('intended')
    if (intended) {
      session.setIntendedUrl(intended)
    }

    return view.render('auth/login')
  }
}
```

After login, `toIntended()` works the same way regardless of how the intended URL was stored.

## Guest middleware

The guest middleware redirects authenticated users away from pages like `/login` or `/register`. This prevents users from creating multiple sessions on a single device.
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('/login', () => {
    // Show login form
  })
  .use(middleware.guest())
```

By default, the middleware checks authentication using the `default` guard. To specify guards explicitly:
```ts title="start/routes.ts"
router
  .get('/login', () => {
    // Show login form
  })
  .use(
    middleware.guest({
      guards: ['web', 'admin_web'],
    })
  )
```

Configure the redirect path for authenticated users in `app/middleware/guest_middleware.ts`.

## Events

The session guard emits events during authentication. See the [events reference guide](../../reference/events.md#session_authauthentication_succeeded) for the complete list.
