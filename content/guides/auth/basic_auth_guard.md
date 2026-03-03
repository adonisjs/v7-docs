---
description: Learn how to authenticate HTTP requests using the HTTP Basic Authentication protocol in AdonisJS.
---

# Basic auth guard

This guide covers authenticating HTTP requests using the HTTP Basic Authentication protocol. You will learn:

- How basic authentication works and when to use it
- How to configure the basic auth guard and user provider
- How to authenticate requests using basic auth
- How to protect routes with the auth middleware

## Overview

The **Basic auth guard** implements the [HTTP authentication framework](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication). The client sends credentials as a base64-encoded string in the `Authorization` header with each request. For example, `Authorization: Basic am9obkBleGFtcGxlLmNvbTpzZWNyZXQ=` contains the email and password for a user.

Basic authentication is stateless because the server does not maintain any persistent sessions or issue tokens. Instead, the client must include the credentials in every request. Because credentials are sent in plain (only base64 encoded), basic authentication must always be used over HTTPS in production.

While simple to set up, basic authentication is not recommended for production applications due to the lack of modern security features like MFA or account management. It is primarily used during early development or for simple internal tools.

## Configuring the guard

First, define the basic auth guard in your `config/auth.ts` file. You must import `basicAuthGuard` and `basicAuthUserProvider` from the `@adonisjs/auth/basic_auth` module.

```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { basicAuthGuard, basicAuthUserProvider } from '@adonisjs/auth/basic_auth'

const authConfig = defineConfig({
  default: 'api',
  guards: {
    api: basicAuthGuard({
      provider: basicAuthUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig
```

The `basicAuthUserProvider` uses your User model to find and verify credentials. It expects the model to have a `verifyCredentials` static method, which is typically provided by the [AuthFinder mixin](./verifying_user_credentials.md#using-the-authfinder-mixin).

## Configuring the User model

The `basicAuthUserProvider` works with any Lucid model that represents your user entity. During installation, the `add` command generates a `User` model with the `withAuthFinder` mixin applied.

```ts title="app/models/user.ts"
import { DateTime } from 'luxon'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

/**
 * Applying the withAuthFinder mixin adds the verifyCredentials
 * static method to your model.
 */
const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare password: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

## Authenticating requests

Clients must include the `Authorization` header with the word `Basic` followed by a space and the base64-encoded credentials (usually `email:password`).

```text
Authorization: Basic am9obkBleGFtcGxlLmNvbTpzZWNyZXQ=
```

### Using the auth middleware

Apply the `auth` middleware to routes that require authentication. The middleware automatically reads the header, verifies the credentials using the configured provider, and attaches the user to the HTTP context.

```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('/projects', async ({ auth }) => {
    /**
     * The auth.user property is now the authenticated user.
     * Use auth.getUserOrFail() to avoid non-null assertions.
     */
    const user = auth.getUserOrFail()
    return user.related('projects').query()
  })
  .use(middleware.auth({ guards: ['api'] }))
```

The middleware throws [E_UNAUTHORIZED_ACCESS](../../reference/exceptions.md#e_unauthorized_access) if the credentials are missing or invalid.

### Manual authentication

To authenticate without the middleware, call `auth.authenticate()` or `auth.authenticateUsing()`.

```ts title="start/routes.ts"
router.get('/projects', async ({ auth }) => {
  /**
   * Authenticate using the default guard.
   * Throws E_UNAUTHORIZED_ACCESS on failure.
   */
  const user = await auth.authenticate()
  
  return user.related('projects').query()
})
```

:::warning
Basic authentication performs a database lookup and password verification on **every** request. This is computationally expensive compared to session or token-based authentication. If performance is a concern, consider moving to the [Session guard](./session_guard.md) or [Access tokens guard](./access_tokens_guard.md) as your application grows.
:::

## Next steps

- [Verifying user credentials](./verifying_user_credentials.md): Learn how the User model handles password verification.
- [Session guard](./session_guard.md): Cookie-based authentication for web apps.
- [Access tokens guard](./access_tokens_guard.md): Token-based authentication for APIs and mobile apps.
