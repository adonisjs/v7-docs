---
description: Turn your AdonisJS application into an OAuth 2.1 authorization server with the @adonisjs/sesame package.
---

# OAuth server

This guide covers running an OAuth 2.1 authorization server with the `@adonisjs/sesame` package. You will learn:

- When your application needs an OAuth server
- How to install and configure Sésame
- How to register the OAuth routes and connect your login and consent pages
- How to create OAuth clients
- How to protect API routes with the OAuth guard and scopes
- How a client completes the authorization code flow with PKCE
- How to load users from another data source

## Overview

The [access tokens guard](../auth/access_tokens_guard.md) works well when your own frontend or mobile app logs users in. It stops being enough when **other applications** need to act on behalf of your users: a partner integration, a CLI, or an AI agent connecting through MCP. Those applications must never see the user's password, they must only receive the permissions the user approved, and the user must be able to revoke that access later. This is what OAuth solves.

Sésame turns your AdonisJS application into an **authorization server**. It implements the authorization code flow with mandatory PKCE, refresh token rotation with replay detection, token introspection and revocation, client credentials, dynamic client registration, and OpenID Connect.

Sésame does not own your users. You keep your user accounts, your login page, and your consent screen. Sésame adds the OAuth endpoints, stores clients, grants, and tokens in your database, and provides an `oauth` auth guard to authenticate requests carrying an OAuth access token.

The flow works as follows:

1. A client application redirects the user's browser to your `/oauth/authorize` endpoint.
2. If the user is not logged in, Sésame redirects them to your login page. Once logged in, it redirects them to your consent page.
3. When the user approves, Sésame redirects the browser back to the client with a short-lived authorization code.
4. The client exchanges the code for an access token and a refresh token at your `/oauth/token` endpoint.
5. The client calls your API with the access token, which the `oauth` guard verifies.

## Installation

Sésame requires AdonisJS 7, Node.js 24 or later, and `@adonisjs/auth` configured with a session guard as the default guard. Authorization and consent use that guard to identify the logged-in user.

Install and configure the package using the `add` command. The default store uses [Lucid](../database/lucid.md), so configure Lucid first.

```sh
node ace add @adonisjs/sesame
node ace migration:run
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/sesame` package using the detected package manager.

2. Registers the following service provider and commands inside the `adonisrc.ts` file.

```ts title="adonisrc.ts"
{
  providers: [
    // ...other providers
    () => import('@adonisjs/sesame/sesame_provider')
  ],
  commands: [
    // ...other commands
    () => import('@adonisjs/sesame/commands')
  ]
}
```

3. Registers the `scopes` and `anyScope` named middleware inside the `start/kernel.ts` file.

4. Creates the `config/sesame.ts` file.

5. Creates six migrations for the clients, authorization codes, access tokens, refresh tokens, grants, and pending authorization requests tables.

:::

## Configuration

The configuration lives in `config/sesame.ts`. The `issuer` must be the public URL of your authorization server, since Sésame uses it in discovery metadata, redirects, and token claims. Use HTTPS in production, and never use your frontend URL or a bind address like `0.0.0.0`.

```ts title="config/sesame.ts"
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/sesame'
import type { InferScopes } from '@adonisjs/sesame/types'

const sesameConfig = defineConfig({
  issuer: env.get('APP_URL'),
  store: stores.lucid(),
  scopes: {
    read: 'Read access',
    write: 'Write access',
  },
  defaultScopes: ['read'],
  loginPage: '/login',
  consentPage: '/oauth/consent',
})

export default sesameConfig

declare module '@adonisjs/sesame/types' {
  interface SesameScopes extends InferScopes<typeof sesameConfig> {}
}
```

**Scopes** are the permissions a client can request. Each scope maps to a human-readable description that you can display on your consent page. The `declare module` block infers your scope names, so the guard and middleware only accept scopes you declared.

The authorization code and refresh token grants are enabled by default, access tokens live one hour, and refresh tokens live 30 days. See the [configuration reference](./reference.md#configuration-options) for every option and its default.

## Registering routes

Mount the OAuth endpoints inside a `/oauth` group, and the discovery endpoints at the root so they stay under `/.well-known`.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import sesame from '@adonisjs/sesame/services/main'

router
  .group(() => {
    sesame.registerRoutes()
  })
  .prefix('/oauth')

sesame.registerDiscoveryRoutes()
```

`registerRoutes` registers the token, authorize, consent, introspection, revocation, registration, client info, and UserInfo endpoints. `registerDiscoveryRoutes` registers the OAuth authorization server metadata, OpenID Connect discovery, protected resource metadata, and `/jwks`. To serve the key set elsewhere, pass `{ jwksPath: '/.well-known/jwks.json' }`.

Keep the OAuth group reachable without a browser session. External clients call the token, introspection, revocation, registration, and UserInfo endpoints directly from their servers.

:::tip
These endpoints receive form posts from other applications, so [CSRF protection](../security/securing_ssr_applications.md#csrf-protection) will reject them. Exempt the token, introspection, revocation, registration, and UserInfo endpoints in `config/shield.ts`, and keep protection on the consent submission, which comes from your own page.
:::

Once your application runs, verify the setup by requesting the discovery document. The response must contain your public issuer and endpoint URLs under the `/oauth` prefix.

```sh
curl http://localhost:3333/.well-known/oauth-authorization-server
```

## Login and consent pages

Sésame does not render any HTML. When an authorization request arrives, it sends the browser to your `loginPage` if the user is not logged in, then to your `consentPage` when the requested scopes need approval. A user who already approved the same scopes skips the consent page.

### Returning from login

Sésame forwards the authorization query parameters to your login page. After a successful login, send the browser back to `/oauth/authorize` with the same parameters so the flow resumes. Always redirect to your own authorize route rather than accepting an arbitrary return URL, otherwise your login page becomes an open redirect.

```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)
    await auth.use('web').login(user)

    /**
     * The login page stores the query string it received in a
     * hidden "authorization_query" field, and the form posts it back
     */
    const query = request.input('authorization_query')
    if (query) {
      return response.redirect().toPath(`/oauth/authorize?${new URLSearchParams(query)}`)
    }

    return response.redirect().toPath('/')
  }
}
```

Sésame validates the whole request again on `/oauth/authorize`, so you do not need to validate these parameters yourself.

### Rendering the consent page

Sésame redirects to your consent page with an `auth_token` that identifies a pending authorization request stored in the database. Load the request with `findPendingAuthorizationRequest`, which only returns it to the user who started it.

```ts title="app/controllers/oauth_consent_controller.ts"
import sesame from '@adonisjs/sesame/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class OAuthConsentController {
  async show({ auth, request, response, view }: HttpContext) {
    const user = await auth.authenticate()
    const authToken = request.input('auth_token')

    const pending = await sesame.findPendingAuthorizationRequest({
      token: authToken,
      userId: String(user.id),
    })
    if (!pending) {
      return response.badRequest('Authorization request expired. Start again.')
    }

    const client = await sesame.findClient(pending.clientId)
    if (!client) {
      return response.badRequest('Client no longer exists')
    }

    return view.render('oauth/consent', {
      authToken,
      clientName: client.name,
      scopes: pending.scopes.map((scope) => ({
        name: scope,
        description: sesame.config.scopes[scope] ?? scope,
      })),
    })
  }
}
```

:::warning
Always read the client and the scopes from the stored request. The query string is controlled by whoever built the authorization URL, so displaying it would let an attacker show a trusted name or fewer permissions than the ones actually granted.
:::

The registered `POST /oauth/consent` endpoint handles the decision, so the page and the submission can share the same URL.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/oauth/consent', [() => import('#controllers/oauth_consent_controller'), 'show'])
```

The form posts the `auth_token` with an `accept` field. A truthy `accept` approves the request, and a missing one denies it. Sésame then redirects the browser to the client's callback.

```edge title="resources/views/oauth/consent.edge"
<h1>Allow {{ clientName }} to access your account?</h1>
<ul>
  @each(scope in scopes)
    <li>{{ scope.description }}</li>
  @end
</ul>
<form method="POST" action="/oauth/consent">
  {{ csrfField() }}
  <input type="hidden" name="auth_token" value="{{ authToken }}">
  <button type="submit" name="accept" value="1">Allow</button>
  <button type="submit">Deny</button>
</form>
```

To let the user approve only some permissions, submit a `scope` field with a subset of the requested scopes. When posting JSON, use booleans for `accept`, since the string `'false'` is truthy.

### Customizing the decision

When you need your own fields, such as a team selector, submit to your own controller and call `approveAuthorization` or `denyAuthorization`. Both return the `redirectUrl` to send the browser to.

```ts title="app/controllers/oauth_consent_controller.ts"
import vine from '@vinejs/vine'
import sesame from '@adonisjs/sesame/services/main'
import type { HttpContext } from '@adonisjs/core/http'

const decisionValidator = vine.create({
  auth_token: vine.string(),
  decision: vine.enum(['approve', 'deny']),
  read_only: vine.boolean().optional(),
})

export default class OAuthConsentController {
  async decide({ auth, request, response }: HttpContext) {
    const user = await auth.authenticate()
    const input = await request.validateUsing(decisionValidator)
    const options = { authToken: input.auth_token, userId: String(user.id) }

    if (input.decision === 'deny') {
      const { redirectUrl } = await sesame.denyAuthorization(options)
      return response.redirect().toPath(redirectUrl)
    }

    const { redirectUrl } = await sesame.approveAuthorization({
      ...options,
      scopes: input.read_only ? ['read'] : undefined,
    })
    return response.redirect().toPath(redirectUrl)
  }
}
```

Approval fails with `invalid_scope` when you pass a scope the client did not request. To attach a team or workspace to the authorization, see [grant context](./tokens_and_grants.md#attaching-application-context).

:::tip
With [Inertia](../frontend/inertia.md), submit the consent page through a native form. The callback usually lives on another origin, so an Inertia request would need your adapter's external redirect (`inertia.location()`). Sésame only sends standard HTTP redirects.
:::

## Creating clients

A **client** is an application allowed to request tokens. A **confidential client** runs on a server and authenticates with a secret. A **public client**, such as a single-page app, a mobile app, or a CLI, cannot keep a secret and relies on PKCE alone.

Create a client from the terminal with the `sesame:client` command. The command prompts for the name, the redirect URIs, and the client type when you omit them, and prints the client ID and, for a confidential client, its secret.

```sh
node ace sesame:client

# Public client, without prompts for name and callbacks
node ace sesame:client --name="Browser app" --public --redirect-uris=https://app.example.com/callback --scopes=read --grant-types=authorization_code,refresh_token
```

To let your users register their own applications, create clients from your code with the `createClient` method. The raw secret is only available in this result, since Sésame stores a hash.

```ts title="app/controllers/developer_apps_controller.ts"
import sesame from '@adonisjs/sesame/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class DeveloperAppsController {
  async store({ auth, request }: HttpContext) {
    const user = await auth.authenticate()

    const { client, clientSecret } = await sesame.createClient({
      name: request.input('name'),
      redirectUris: [request.input('redirect_uri')],
      scopes: ['read'],
      grantTypes: ['authorization_code', 'refresh_token'],
      userId: String(user.id),
    })

    return { clientId: client.clientId, clientSecret }
  }
}
```

Pass `isPublic: true` to create a public client without a secret. Validate user input with [VineJS](../basics/validation.md) before calling `createClient`, since management methods do not run the dynamic registration validator.

:::warning
`createClient` defaults to the `authorization_code` grant only, even though the server enables refresh tokens. List `refresh_token` in `grantTypes` when the client needs to use refresh tokens.
:::

The manager also lets you find, list, update, disable, and delete clients, and rotate a leaked secret. Always pass the public `clientId`, not the internal record `id`.

```ts title="app/controllers/developer_apps_controller.ts"
await sesame.listClients({ userId: '42' })
await sesame.updateClient('CLIENT_ID', { name: 'Renamed app', isDisabled: true })
const newSecret = await sesame.rotateClientSecret('CLIENT_ID')
await sesame.deleteClient('CLIENT_ID')
```

Disabling a client blocks client authentication and new authorization requests. Deleting it also removes its tokens, codes, grants, and pending requests. `rotateClientSecret` returns `null` for a public or missing client.

## Protecting routes

Add an `oauth` guard next to your session guard in `config/auth.ts`. Keep the session guard as the default, since Sésame uses it to identify the user during authorization.

```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'
import { oauthGuard } from '@adonisjs/sesame/guard' // [!code ++]
import { oauthUserProvider } from '@adonisjs/sesame/guard/lucid' // [!code ++]

const authConfig = defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({ model: () => import('#models/user') }),
    }),
    // [!code ++:3]
    oauth: oauthGuard({
      provider: oauthUserProvider({ model: () => import('#models/user') }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}

declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
```

Authenticate the guard, then check scopes on it. A request without a valid Bearer token receives a `401`, and a valid token missing a scope receives a `403` whose `WWW-Authenticate` challenge tells the client which scopes it needs.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/api/me', async ({ auth }) => {
  const guard = auth.use('oauth')
  const user = await guard.authenticate()

  if (!guard.hasScope('read')) {
    throw guard.insufficientScopeError(['read'])
  }

  return { id: user.id, clientId: guard.clientId }
})
```

`hasScope('read', 'write')` requires all listed scopes, and `hasAnyScope('read', 'write')` requires at least one. After authentication, the guard also exposes `accessToken` (the token record, without its value or hash), `grantId`, `context`, and `audience`.

### Using the scope middleware

The `add` command registers two named middleware. `scopes` requires every listed scope, and `anyScope` requires at least one.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

router
  .get('/posts', [() => import('#controllers/posts_controller'), 'index'])
  .use(middleware.scopes({ scopes: ['read'] }))

router
  .get('/dashboard', [() => import('#controllers/dashboard_controller'), 'index'])
  .use(middleware.anyScope({ scopes: ['read', 'write'] }))
```

These middleware are designed for routes shared by your own frontend and OAuth clients. A request with an `Authorization` header authenticates through the OAuth guard and must hold the scopes. A request without that header passes with a valid default session, without any scope check.

:::warning
Because a session also passes the scope middleware, it does not require an OAuth token on its own. For a route that only OAuth clients may call, authenticate `auth.use('oauth')` explicitly as shown above, or add the `auth` middleware with `guards: ['oauth']` before the scope middleware.

```ts title="start/routes.ts"
router
  .get('/api/posts', [() => import('#controllers/posts_controller'), 'index'])
  .use(middleware.auth({ guards: ['oauth'] }))
  .use(middleware.scopes({ scopes: ['read'] }))
```
:::

To bind tokens to a specific API and reject tokens issued for another one, see [resource audiences](./mcp.md).

## Authorizing a client

This section shows the flow from the client's side, which helps you test your server end to end. The client first generates a random **code verifier**, its S256 **code challenge**, and a random `state`. It keeps the verifier and the state for the callback. PKCE is mandatory in OAuth 2.1, and Sésame only accepts the `S256` method.

```ts title="client/authorize.ts"
import { createHash, randomBytes } from 'node:crypto'

const verifier = randomBytes(32).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')
const state = randomBytes(32).toString('base64url')

const url = new URL('https://auth.example.com/oauth/authorize')
url.search = new URLSearchParams({
  client_id: 'CLIENT_ID',
  redirect_uri: 'https://app.example.com/callback',
  response_type: 'code',
  scope: 'read',
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
}).toString()
```

The client sends the browser to that URL. After login and consent, Sésame redirects to the callback with `code`, `state`, and `iss`. The client must compare `state` with the saved value and `iss` with the expected issuer, then exchange the code along with the verifier.

```sh
curl https://auth.example.com/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode grant_type=authorization_code \
  --data-urlencode "code=$CODE" \
  --data-urlencode redirect_uri=https://app.example.com/callback \
  --data-urlencode "code_verifier=$VERIFIER"
```

A public client omits `-u` and sends `client_id` in the body instead. The response contains `access_token`, `token_type`, `expires_in`, `scope`, and a `refresh_token` when the server enables the `refresh_token` grant. The client can only use it if its own grant types include `refresh_token`. The client then calls your API with the `Authorization: Bearer <access_token>` header.

The client can control the browser interaction with the `prompt` parameter. `prompt=consent` forces the consent page even when the user approved the scopes before. `prompt=none` never displays a page and returns `login_required` or `consent_required` to the callback when interaction is needed.

:::note
Public clients redirecting to a loopback address or a custom scheme always see the consent page. Any local application can reuse their `client_id`, so a stored approval does not prove the same application is asking.
:::

## Custom user provider

The `oauthUserProvider` loads users from a Lucid model. When your users live elsewhere, such as in another service, implement the `OAuthUserProviderContract` interface. The provider converts your user into a guard user and finds a user by ID. Sésame calls `findById` on every authenticated request.

This example loads users from an internal users API whose base URL is stored in the `USERS_API_URL` environment variable.

```ts title="app/auth/api_oauth_user_provider.ts"
import env from '#start/env'
import { symbols } from '@adonisjs/auth'
import type { OAuthGuardUser, OAuthUserProviderContract } from '@adonisjs/sesame/guard'

type User = {
  id: string
  email: string
}

class ApiOAuthUserProvider implements OAuthUserProviderContract<User> {
  declare [symbols.PROVIDER_REAL_USER]: User

  async createUserForGuard(user: User): Promise<OAuthGuardUser<User>> {
    return { getId: () => user.id, getOriginal: () => user }
  }

  async findById(identifier: string | number | BigInt) {
    const response = await fetch(`${env.get('USERS_API_URL')}/users/${identifier}`)
    if (!response.ok) {
      return null
    }

    const user = (await response.json()) as User
    return this.createUserForGuard(user)
  }
}

export const apiOAuthUserProvider = new ApiOAuthUserProvider()
```

Use the same provider for the session guard and the OAuth guard. Your login handler must verify credentials and log this user object into the session guard.

```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard } from '@adonisjs/auth/session'
import { oauthGuard } from '@adonisjs/sesame/guard'
import { apiOAuthUserProvider } from '../app/auth/api_oauth_user_provider.js'

const authConfig = defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: apiOAuthUserProvider,
    }),
    oauth: oauthGuard({ provider: apiOAuthUserProvider }),
  },
})

export default authConfig
```

## Next steps

- [Manage tokens and grants](./tokens_and_grants.md): refresh and revoke tokens, list connected applications, issue client credentials tokens, and test your API.
- [OpenID Connect and JWT access tokens](./openid_connect.md): issue ID tokens and let other services verify access tokens.
- [MCP and client registration](./mcp.md): protect an MCP server and let clients register themselves.
- [Reference](./reference.md): every option, endpoint, command, and error.
