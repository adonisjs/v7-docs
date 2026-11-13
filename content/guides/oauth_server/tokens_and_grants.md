---
description: Refresh and revoke OAuth tokens, manage connected applications, issue client credentials tokens, and test OAuth-protected routes with @adonisjs/sesame.
---

# Tokens and grants

This guide covers the lifecycle of OAuth tokens issued by Sésame. You will learn:

- How refresh token rotation and replay detection work
- How to revoke and inspect tokens
- How to list and revoke a user's connected applications
- How to attach application context, such as a team, to an authorization
- How to issue tokens to services with the client credentials grant
- How to test OAuth-protected routes
- How to purge old records

## Overview

Every time a user approves a client, Sésame creates a **grant**. A grant records the client, the user, the approved scopes, an expiry, and optional application context. The authorization codes, access tokens, and refresh tokens issued from that authorization all reference the grant, which gives you a single handle to revoke everything a client obtained from one approval.

The database only stores SHA-256 hashes of access tokens, refresh tokens, authorization codes, pending authorization tokens, and client secrets. The OAuth guard looks up the token and its grant on every request, so a revocation takes effect immediately instead of waiting for the token to expire.

The examples below assume your OAuth routes use the `/oauth` prefix, as shown in the [routes setup](./introduction.md#registering-routes).

## Refreshing tokens

Access tokens are short-lived (one hour by default). A client exchanges its refresh token for a new pair at the token endpoint. Both the server and the client must allow the `refresh_token` grant.

```sh
curl https://auth.example.com/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode grant_type=refresh_token \
  --data-urlencode "refresh_token=$REFRESH_TOKEN"
```

A public client omits `-u` and sends `client_id` in the body. To narrow the permissions of the new token, the client adds a `scope` parameter. A refresh can never add scopes beyond those of the presented refresh token, and narrowing also narrows the new refresh token. A client that needs more permissions must send the user through authorization again.

### Rotation and replay detection

Each refresh issues a new refresh token and revokes the previous one. If an attacker steals a refresh token and the legitimate client also uses it, one of them presents a token that was already rotated. Sésame treats that as a **replay** and revokes the whole grant with all its tokens. Other grants of the same user stay valid.

Networks fail, so a client sometimes never receives the response to its refresh. To avoid logging out users after a lost response or two concurrent refreshes, Sésame accepts a recently revoked refresh token for 120 seconds and issues another pair. It does not return the original pair.

:::warning
The grace period also lets a stolen token be reused within that window. For strict replay detection, set `refreshTokenRotationGracePeriod: 0` in `config/sesame.ts`. Clients must then save both new tokens together and serialize their refresh requests, since any retry revokes the grant.
:::

The `offline_access` scope does not enable refresh tokens on its own. The server issues a refresh token when its `grantTypes` include `refresh_token`, and the client can only redeem it when its own grant types include `refresh_token`.

## Revoking tokens

Clients revoke their own tokens through the revocation endpoint, for example when a user logs out of the client application.

```sh
curl https://auth.example.com/oauth/revoke \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode "token=$REFRESH_TOKEN" \
  --data-urlencode token_type_hint=refresh_token
```

Revoking a refresh token revokes its whole grant. Revoking an access token only revokes that token. Once the client authenticates, the endpoint returns `200` with `{}` even for an unknown token, so it cannot be used to probe which tokens exist.

When your application deactivates or deletes a user, revoke everything issued to that user with `revokeAllForUser`.

```ts title="app/controllers/users_controller.ts"
import User from '#models/user'
import sesame from '@adonisjs/sesame/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async destroy({ params }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await sesame.revokeAllForUser(String(user.id))
    await user.delete()
  }
}
```

### Inspecting a token

A client can check the state of one of its tokens with the introspection endpoint. An active token returns `active: true` with its client, subject, scopes, and expiry, plus `aud` when it is bound to a resource. Any expired, revoked, unknown, or other client's token returns `{ "active": false }`.

```sh
curl https://auth.example.com/oauth/introspect \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode "token=$ACCESS_TOKEN" \
  --data-urlencode token_type_hint=access_token
```

## Managing grants

Users expect a settings page listing the applications connected to their account, with a way to disconnect each one. The `listGrants` method returns the user's active grants, newest first, each with its public client record.

```ts title="app/controllers/connections_controller.ts"
import sesame from '@adonisjs/sesame/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class ConnectionsController {
  async index({ auth, view }: HttpContext) {
    const user = await auth.authenticate()
    const grants = await sesame.listGrants({ userId: String(user.id) })

    return view.render('settings/connections', { grants })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = await auth.authenticate()

    /**
     * Passing the authenticated user ID ensures a user
     * can only revoke their own grants
     */
    await sesame.revokeGrant({
      grantId: params.id,
      userId: String(user.id),
    })

    return response.redirect().back()
  }
}
```

Revoking a grant invalidates every code, access token, and refresh token issued from it. A user can hold several grants for the same client, so group the list by `clientId` when your page shows one row per application. To disconnect a whole application, call `sesame.revokeGrants({ userId, clientId })`. Omit `clientId` to disconnect every application.

:::tip
Always take the user ID from the session, never from request input. Keep [CSRF protection](../security/securing_ssr_applications.md#csrf-protection) on these routes since they mutate the user's data.
:::

### Attaching application context

Multi-tenant applications often need to know which team or workspace a user picked when approving a client. Store that choice as **grant context** from your [custom consent controller](./introduction.md#customizing-the-decision). The context must be a plain JSON object or `null`.

```ts title="app/controllers/oauth_consent_controller.ts"
const { redirectUrl } = await sesame.approveAuthorization({
  authToken: input.auth_token,
  userId: String(user.id),
  context: { teamId: authorizedTeamId },
})
```

:::warning
Validate the selected team against the user's memberships before calling `approveAuthorization`. Sésame stores the context as supplied, so keep secrets out of it. The context is never exposed in token responses or introspection.
:::

Declare the context shape once to type it everywhere.

```ts title="config/sesame.ts"
declare module '@adonisjs/sesame/types' {
  interface SesameGrantContext {
    teamId: number
  }
}
```

The guard reads the grant on every request, so the context is available after authentication.

```ts title="app/controllers/projects_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class ProjectsController {
  async index({ auth }: HttpContext) {
    const guard = auth.use('oauth')
    await guard.authenticate()

    const teamId = guard.context?.teamId
    // Recheck that the user still belongs to this team before using it
  }
}
```

The context records the user's choice at approval time. It does not replace your current permission checks. A grant with context never skips the consent page, and refresh rotation preserves it. To change it later, call `sesame.updateGrant({ grantId, userId, context })`, or pass `context: null` to remove it.

## Client credentials

The **client credentials** grant issues tokens to a service rather than to a user, for example a reporting job calling your API. There is no browser and no consent. Enable the grant in `config/sesame.ts`.

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'], // [!code ++]
  clientCredentialsAccessTokenTtl: '2h', // [!code ++]
})
```

Create a confidential client with that grant and an owner user ID. The OAuth guard resolves this user when the service calls your API, so use a dedicated service account.

```ts title="commands/create_reporting_client.ts"
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import sesame from '@adonisjs/sesame/services/main'

export default class CreateReportingClient extends BaseCommand {
  static commandName = 'clients:reporting'
  static options: CommandOptions = { startApp: true }

  async run() {
    const { client, clientSecret } = await sesame.createClient({
      name: 'Reporting service',
      redirectUris: [],
      userId: '42',
      grantTypes: ['client_credentials'],
      scopes: ['read'],
    })

    this.logger.info(`Client ID: ${client.clientId}`)
    this.logger.info(`Client secret: ${clientSecret}`)
  }
}
```

The service then requests a token with its credentials.

```sh
curl https://auth.example.com/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  --data-urlencode grant_type=client_credentials \
  --data-urlencode scope=read
```

The response contains an access token but no refresh token and no ID token. The service requests a new token after expiry. Without `scope`, Sésame grants the client's own scopes, and it rejects `openid`, `profile`, `email`, and `offline_access` for this grant.

## Testing

With the [Japa API client](../testing/api_tests.md) and the Auth plugin configured, authenticate requests through the OAuth guard with `loginAs`. Sésame creates a real access token for the user, along with a shared `__test_client__` client on first use.

```ts title="tests/functional/posts.spec.ts"
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'

test.group('Posts', () => {
  test('lists posts for an OAuth client', async ({ client }) => {
    const user = await UserFactory.create()

    const response = await client
      .get('/api/posts')
      .withGuard('oauth')
      .loginAs(user, { scopes: ['read'], context: { teamId: 1 } })

    response.assertStatus(200)
  })
})
```

Without options, the token uses your configured `defaultScopes`. A guard configured with a `resource` binds the test token to that resource.

:::note
`loginAs` bypasses the authorization flow entirely. Cover PKCE, callbacks, consent expiry, and refresh token rotation with separate tests that call the OAuth endpoints.
:::

## Events

The OAuth guard emits `oauth_auth:authentication_attempted`, `oauth_auth:authentication_succeeded`, and `oauth_auth:authentication_failed`. Listen to failures to spot misconfigured clients or token abuse.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'

emitter.on('oauth_auth:authentication_failed', (event) => {
  logger.warn({ guardName: event.guardName, err: event.error }, 'OAuth authentication failed')
})
```

Never log raw tokens or secrets. The success event includes the `accessToken` record, which contains neither.

## Purging old records

Revoked and expired tokens stay in the database until you remove them. Run the `sesame:purge` command from your scheduler.

```sh
node ace sesame:purge --hours=168
```

The command removes revoked records and expired records older than the retention window. Pass `--revoked` or `--expired` to select only one category. Revoked refresh tokens stay until the retention cutoff on purpose: deleting them earlier would turn a replayed token into an unknown token, and Sésame could no longer detect the replay and revoke the grant.

Clients created through [dynamic registration](./mcp.md) that never completed an authorization pile up as well. Add `--clients` to remove the ones older than `--client-days` (30 by default). Manually created clients and Client ID Metadata Document clients are never removed.

```sh
node ace sesame:purge --clients --client-days=30
```

The same operations are available from code through `sesame.purgeTokens({ retentionHours: 168 })` and `sesame.purgeUnusedClients({ olderThanDays: 30 })`. See the [commands reference](./reference.md#commands) for every flag.
