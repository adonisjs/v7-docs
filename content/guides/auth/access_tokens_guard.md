---
description: Learn how to authenticate HTTP requests using opaque access tokens in AdonisJS.
---

# Access tokens guard

This guide covers token-based authentication in AdonisJS. You will learn:

- How access tokens work and when to use them
- How to configure the tokens provider on your User model
- How to issue tokens with abilities and expiration
- How to authenticate requests using tokens
- How to manage tokens (list, delete, revoke)

## Overview

Access tokens authenticate HTTP requests in contexts where the server cannot use cookies. This includes native mobile apps, desktop applications, third-party API integrations, and web applications hosted on a different domain than your API.

AdonisJS uses opaque access tokens rather than JWTs. An opaque token is a cryptographically secure random string with no embedded data. The token is hashed and stored in your database, and verification happens by comparing the provided token against the stored hash. This approach allows you to revoke tokens instantly by deleting them from the database, something that's not possible with JWTs until they expire.

A token consists of three parts: a configurable prefix (`oat_` by default), the random token value, and a CRC32 checksum. The prefix and checksum help [secret scanning tools](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning) identify leaked tokens in codebases.

## Configuring the User model

Before using the access tokens guard, configure a tokens provider on your User model. The provider handles creating, storing, and verifying tokens.
```ts title="app/models/user.ts"
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column()
  declare password: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
```

The `DbAccessTokensProvider.forModel` method accepts the User model as its first argument and an optional configuration object as its second:
```ts title="app/models/user.ts"
static accessTokens = DbAccessTokensProvider.forModel(User, {
  expiresIn: '30 days',
  prefix: 'oat_',
  table: 'auth_access_tokens',
  type: 'auth_token',
  tokenSecretLength: 40,
})
```

| Option | Description |
|--------|-------------|
| `expiresIn` | Default token lifetime. Accepts seconds as a number or a time expression like `'30 days'`. Tokens don't expire by default. Can be overridden when creating individual tokens. |
| `prefix` | Prefix for the public token value. Helps secret scanners identify your tokens. Defaults to `oat_`. Changing this invalidates existing tokens. |
| `table` | Database table for storing tokens. Defaults to `auth_access_tokens`. |
| `type` | Identifier for this token type. Useful when your application issues multiple types of tokens. Defaults to `auth_token`. |
| `tokenSecretLength` | Length of the random token value in characters. Defaults to `40`. |

## Creating the tokens table

The `add` command creates a migration for the tokens table when you select the access tokens guard. Run the migration to create the table:
```sh
node ace migration:run
```

If you're configuring access tokens manually, create the migration yourself:
```sh
node ace make:migration auth_access_tokens
```
```ts title="database/migrations/TIMESTAMP_create_auth_access_tokens_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tokenable_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

## Issuing tokens

Use the tokens provider on your User model to create tokens. The `create` method accepts a user instance and returns an [AccessToken](https://github.com/adonisjs/auth/blob/10.x/modules/access_tokens_guard/access_token.ts) object:
```ts title="start/routes.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'

router.post('/users/:id/tokens', async ({ params }) => {
  const user = await User.findOrFail(params.id)
  const token = await User.accessTokens.create(user)

  return {
    type: 'bearer',
    value: token.value!.release(),
  }
})
```

The `token.value` property contains the actual token string wrapped in a [Secret](../../reference/helpers.md#secret) object. Call `.release()` to get the plain string value. This value is only available at creation time. Once the response is sent, the plain token cannot be retrieved again because only its hash is stored.

You can also return the token object directly, which serializes to JSON automatically:
```ts title="start/routes.ts"
router.post('/users/:id/tokens', async ({ params }) => {
  const user = await User.findOrFail(params.id)
  const token = await User.accessTokens.create(user)

  return token
})

/**
 * Response:
 * {
 *   "type": "bearer",
 *   "value": "oat_MTA.aWFQUmo2WkQzd3M5cW0zeG5JeHdiaV9rOFQzUWM1aTZSR2xJaDZXYzM5MDE4MzA3NTU",
 *   "expiresAt": null
 * }
 */
```

### Token abilities

Abilities let you restrict what a token can do. For example, you might issue a token that can read projects but not create or delete them.
```ts title="start/routes.ts"
const token = await User.accessTokens.create(user, ['projects:read', 'projects:list'])
```

Abilities are stored as an array of strings. Define whatever abilities make sense for your application. Common patterns include resource-based abilities (`projects:read`, `users:delete`) and role-based abilities (`admin`, `editor`).

To allow all abilities, use the wildcard:
```ts title="start/routes.ts"
const token = await User.accessTokens.create(user, ['*'])
```

Check abilities when handling requests:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .delete('/projects/:id', async ({ auth, response }) => {
    if (!auth.user!.currentAccessToken.allows('projects:delete')) {
      return response.forbidden('Token lacks projects:delete ability')
    }

    // Delete project...
  })
  .use(middleware.auth({ guards: ['api'] }))
```

The `AccessToken` class provides these methods for checking abilities:

| Method | Description |
|--------|-------------|
| `allows(ability)` | Returns `true` if the token has the specified ability or the wildcard (`*`). |
| `denies(ability)` | Returns `true` if the token does not have the specified ability. |

### Token expiration

Set an expiration time when creating a token:
```ts title="start/routes.ts"
const token = await User.accessTokens.create(user, ['*'], {
  expiresIn: '7 days',
})
```

You can also set a default expiration in the provider configuration, which applies to all tokens unless overridden.

### Token names

Assign names to tokens so users can identify them in a management interface:
```ts title="start/routes.ts"
const token = await User.accessTokens.create(user, ['*'], {
  name: 'CLI Tool Token',
})
```

## Configuring the guard

After setting up the tokens provider, configure the authentication guard in `config/auth.ts`:
```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'

const authConfig = defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig
```

The `tokensGuard` method creates an instance of [AccessTokensGuard](https://github.com/adonisjs/auth/blob/10.x/modules/access_tokens_guard/guard.ts).

The `tokensUserProvider` method accepts two options:

| Option | Description |
|--------|-------------|
| `model` | A function that imports your User model. |
| `tokens` | The name of the static property on your model that references the tokens provider (typically `accessTokens`). |

## Authenticating requests

Clients include the token in the `Authorization` header as a bearer token:
```
Authorization: Bearer oat_MTA.aWFQUmo2WkQzd3M5cW0zeG5JeHdiaV9rOFQzUWM1aTZSR2xJaDZXYzM5MDE4MzA3NTU
```

### Using the auth middleware

Apply the `auth` middleware to routes that require authentication:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .post('/projects', async ({ auth }) => {
    console.log(auth.user)                    // User instance
    console.log(auth.authenticatedViaGuard)   // 'api'
    console.log(auth.user!.currentAccessToken) // AccessToken instance
  })
  .use(middleware.auth({ guards: ['api'] }))
```

The middleware throws [E_UNAUTHORIZED_ACCESS](../../reference/exceptions.md#e_unauthorized_access) if the token is missing, invalid, or expired.

### Manual authentication

To authenticate without the middleware, call `auth.authenticate()` or `auth.authenticateUsing()`:
```ts title="start/routes.ts"
router.post('/projects', async ({ auth }) => {
  /**
   * Authenticate using the default guard
   */
  const user = await auth.authenticate()

  /**
   * Authenticate using specific guards
   */
  const user = await auth.authenticateUsing(['api'])
})
```

### Checking authentication status

Use `auth.isAuthenticated` to check if the request is authenticated:
```ts title="app/controllers/projects_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class ProjectsController {
  async store({ auth }: HttpContext) {
    if (auth.isAuthenticated) {
      await auth.user!.related('projects').create(projectData)
    }
  }
}
```

### Avoiding non-null assertions

Use `auth.getUserOrFail()` instead of `auth.user!` to avoid the non-null assertion operator:
```ts title="app/controllers/projects_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class ProjectsController {
  async store({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await user.related('projects').create(projectData)
  }
}
```

## The current access token

After successful authentication, the guard attaches the token to `user.currentAccessToken`. Use this to check abilities, expiration, or other token properties:
```ts title="start/routes.ts"
router
  .get('/projects', async ({ auth }) => {
    const token = auth.user!.currentAccessToken

    console.log(token.identifier)   // Token ID from database
    console.log(token.abilities)    // Array of abilities
    console.log(token.isExpired())  // Boolean
    console.log(token.lastUsedAt)   // DateTime or null
  })
  .use(middleware.auth({ guards: ['api'] }))
```

The guard updates the `last_used_at` column each time a token is used for authentication.

If you reference the User model with `currentAccessToken` elsewhere in your codebase (such as in Bouncer abilities), declare the property on your model to avoid type errors:
```ts title="app/models/user.ts"
import { AccessToken } from '@adonisjs/auth/access_tokens'

export default class User extends BaseModel {
  // ...other properties

  currentAccessToken?: AccessToken
}
```

## Listing tokens

Retrieve all tokens for a user with the `all` method:
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

router
  .get('/tokens', async ({ auth }) => {
    return User.accessTokens.all(auth.user!)
  })
  .use(middleware.auth({ guards: ['api'] }))
```

The `all` method returns both valid and expired tokens. Filter or label expired tokens in your UI:
```edge
@each(token in tokens)
  <div>
    <h3>{{ token.name ?? 'Unnamed token' }}</h3>
    @if(token.isExpired())
      <span class="badge">Expired</span>
    @end
    <p>Abilities: {{ token.abilities.join(', ') }}</p>
  </div>
@end
```

## Deleting tokens

Delete a token by its identifier:
```ts title="start/routes.ts"
await User.accessTokens.delete(user, tokenId)
```

## Login and logout via guard

When using access tokens as your primary authentication method (common for mobile apps), the guard provides `createToken` and `invalidateToken` methods that mirror the session guard's `login` and `logout`:
```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)

    return await auth.use('api').createToken(user)
  }

  async destroy({ auth }: HttpContext) {
    await auth.use('api').invalidateToken()
  }
}
```
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const SessionController = () => import('#controllers/session_controller')

router.post('/session', [SessionController, 'store'])
router
  .delete('/session', [SessionController, 'destroy'])
  .use(middleware.auth({ guards: ['api'] }))
```

:::warning
When verifying credentials fails, `User.verifyCredentials` throws [E_INVALID_CREDENTIALS](../../reference/exceptions.md#e_invalid_credentials). For API clients, include an `Accept: application/json` header to receive JSON error responses instead of redirects.
:::

:::tip
If your API is accessed exclusively via access tokens (not from a browser), you may want to disable [CSRF protection](../security/securing_ssr_applications.md#csrf-protection) for API routes. See the [shield configuration reference](../security/securing_ssr_applications.md#config-reference) for details.
:::

## Events

The access tokens guard emits events during authentication. See the [events reference guide](../../reference/events.md#access_tokens_authauthentication_attempted) for the complete list.
