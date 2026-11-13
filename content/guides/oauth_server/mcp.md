---
description: Protect an MCP endpoint with Sésame, bind tokens to a resource audience, and let external clients register through dynamic registration or Client ID Metadata Documents.
---

# MCP and client registration

This guide covers protecting MCP servers and onboarding external clients with Sésame. You will learn:

- How to bind tokens to one API with a resource audience
- How to authenticate an MCP endpoint and request more scopes
- How to let clients register themselves through dynamic client registration
- How to accept Client ID Metadata Documents as client identifiers
- How to show metadata clients safely on the consent page
- How to fetch metadata documents from a local server during development

## Overview

The [Model Context Protocol](https://modelcontextprotocol.io) (MCP) lets AI applications call tools exposed by your server. When an MCP endpoint needs a user's data, the MCP client must obtain an OAuth access token first. MCP clients do this without any manual setup: they discover your authorization server, identify themselves, run a PKCE authorization, and retry the request with a Bearer token.

Sésame supplies the parts of that flow that belong to the authorization server: discovery metadata, Bearer authentication, scope challenges, and client identification. Your application still supplies the MCP transport itself (the handler that speaks the protocol).

Two problems need solving before an MCP client can connect. First, a token issued for your MCP server must not be usable on another API, and the reverse. You solve this with a **resource audience**. Second, you cannot [create every client manually](./introduction.md#creating-clients) when any MCP client in the world may connect. Sésame offers two ways for clients to identify themselves: **dynamic client registration**, where the client posts its metadata to your server, and **Client ID Metadata Documents**, where the client uses the URL of a JSON document it hosts as its `client_id`.

This guide assumes you have [registered the OAuth routes](./introduction.md#registering-routes) and know how to [protect routes with the OAuth guard](./introduction.md#protecting-routes).

## Enforcing a resource audience

By default, a valid access token works on every route protected by the OAuth guard. When you host several APIs, this means a token obtained for one of them also unlocks the others. Binding tokens to a **resource** (defined by [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)) restricts each token to the API it was requested for.

### Registering the resource

Register the API path with `sesame.registerProtectedResource()` after registering the OAuth routes. This example uses `/api/mcp`. Declare the listed scopes in your [scope configuration](./introduction.md#configuration).

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import sesame from '@adonisjs/sesame/services/main'

router
  .group(() => {
    sesame.registerRoutes()
  })
  .prefix('/oauth')

sesame.registerDiscoveryRoutes()

sesame.registerProtectedResource({ resource: '/api/mcp', scopes: ['read', 'write'] })
```

Registration publishes the resource metadata at `/.well-known/oauth-protected-resource/api/mcp` and records the path as a valid target for tokens. It does not protect the handler. You still need a guard on the route.

### Configuring a guard for the resource

Add a dedicated OAuth guard for the resource in `config/auth.ts`, next to your existing guards. The guard name (`mcp` here) is what you pass to `auth.use()` later.

```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'
import { oauthGuard } from '@adonisjs/sesame/guard'
import { oauthUserProvider } from '@adonisjs/sesame/guard/lucid'

const authConfig = defineConfig({
  default: 'web',
  guards: {
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({ model: () => import('#models/user') }),
    }),
    oauth: oauthGuard({
      provider: oauthUserProvider({ model: () => import('#models/user') }),
    }),
    // [!code ++:5]
    mcp: oauthGuard({
      provider: oauthUserProvider({ model: () => import('#models/user') }),
      resource: '/api/mcp',
      requireAudience: true,
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

::::options

:::option{name="resource" dataType="string"}
Path of the protected resource served behind this guard, relative to the issuer. It must match a path registered with `registerProtectedResource()`. When set, the guard rejects tokens bound to another resource. A guard without `resource` does not check the audience at all.
:::

:::option{name="requireAudience" dataType="boolean"}
Also reject tokens that are not bound to any resource, such as tokens issued to clients that do not send the `resource` parameter. Only applies when `resource` is set. Defaults to `false`.
:::

::::

When you add a resource to an existing API, clients may still hold older unbound tokens. Omit `requireAudience` during the transition: the guard then accepts unbound tokens while still rejecting tokens bound elsewhere. Turn it on once those tokens have expired. This transition only applies to opaque tokens: with [JWT access tokens](./openid_connect.md#jwt-access-tokens), a token requested without `resource` is bound to the issuer, so this guard rejects it either way.

:::warning
Register the exact path used by the guard. When the guard path is not registered, Sésame falls back to the closest registered resource and logs a warning once. See [resource indicators](./reference.md#resource-indicators) in the endpoints reference for how resource URIs are normalized and matched.
:::

### Requesting a bound token

A client binds a token by adding `resource=https://auth.example.com/api/mcp` to the [authorization request](./introduction.md#authorizing-a-client) and to the code exchange. On refresh, it either omits the parameter or sends the same value. A bound token can never change its target. An unbound authorization code or refresh token, however, can acquire a target at exchange time.

A request with a token bound to `/api/mcp` succeeds, and `guard.audience` contains the target URL. A token bound to another resource receives a 401 response.

## Protecting an MCP endpoint

With the resource and guard in place, attach authentication to the MCP route so it runs before the transport. The following example assumes `McpController.handle` already implements the MCP transport.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router
  .post('/api/mcp', [controllers.Mcp, 'handle'])
  .use(async ({ auth }, next) => {
    const guard = auth.use('mcp')

    /**
     * The scopes passed here are advertised in the 401
     * challenge when the request has no valid token.
     */
    await guard.authenticate({ scopes: ['read'] })

    /**
     * A valid token without "read" receives a 403 response.
     */
    if (!guard.hasScope('read')) {
      throw guard.insufficientScopeError(['read'])
    }

    await next()
  })
```

The explicit `auth.use('mcp').authenticate()` call matters. The `scopes` named middleware also accepts a `guard: 'mcp'` option, but it lets a request without an `Authorization` header through when the user has a valid session. An MCP endpoint must always require a token, so authenticate the guard yourself.

Apply the same protection to the GET or DELETE routes if your transport exposes them. When you serve several MCP resources, register each one and give each its own guard.

### Requesting more scopes

Some tools need more permissions than others. Inside a handler, check the scope on the same guard and throw the insufficient scope error when it is missing.

```ts title="app/controllers/mcp_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class McpController {
  async handle({ auth }: HttpContext) {
    const guard = auth.use('mcp')

    if (!guard.hasScope('write')) {
      throw guard.insufficientScopeError(['write'])
    }

    // ...run the MCP transport
  }
}
```

The 403 challenge points to the resource metadata and lists the union of the granted scopes and the required ones, so a client stepping up its authorization does not lose what it already has. A refresh cannot add permissions, so the client needs a new authorization to get the broader scopes. Declaring scopes on the resource or the route ensures 401 challenges also advertise the permissions the client should request.

:::tip
How clients react to a 403 response depends on the MCP SDK version. If a client only refreshes its token and keeps failing, discard its saved tokens and reconnect so it requests the broader scopes.

Discovery also lists `offline_access` among the supported scopes. A client that requests the full list will trigger consent for it.
:::

### Verifying the connection

Request `/.well-known/oauth-protected-resource/api/mcp` and confirm it describes the resource. Then call the handler without a token and check that the 401 challenge points to that metadata URL. Finally, complete a PKCE authorization from an MCP client and test a scoped call, a token bound to the wrong audience, and [grant revocation](./tokens_and_grants.md#managing-grants).

Before a client can authorize, it needs a `client_id`. The next two sections cover the ways MCP clients obtain one.

## Dynamic client registration

**Dynamic client registration** ([RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591)) lets a client create itself by posting its metadata to the registration endpoint. Discovery advertises the endpoint once registration is enabled, so clients find it automatically.

### Enabling registration

Registration is disabled by default. Two options control it in `config/sesame.ts`.

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  // [!code ++:2]
  allowDynamicRegistration: true,
  allowPublicRegistration: true,
})
```

::::options

:::option{name="allowDynamicRegistration" dataType="boolean"}
Enables the `POST /oauth/register` endpoint. Defaults to `false`.
:::

:::option{name="allowPublicRegistration" dataType="boolean"}
Allows registration without an authenticated user, which MCP clients need since they register before any user signs in. Defaults to `false`. This flag only controls who may call the endpoint. It does not decide whether the resulting OAuth client is public or confidential.
:::

::::

When registration requires a user, the registration controller reads `ctx.auth.user` and does not authenticate anyone itself. Add middleware to the registration request pipeline that authenticates your chosen guard before the controller runs. A Bearer header alone does not populate the user. Apply this policy to the registration endpoint only, and keep the rest of the OAuth group callable without a browser session, since external clients call the token, introspection, and revocation endpoints directly.

### Registering a client

A client sends its metadata as JSON. The following request registers a public desktop client.

```sh
curl https://auth.example.com/oauth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "Desktop client",
    "redirect_uris": ["http://localhost:8080/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "scope": "read",
    "token_endpoint_auth_method": "none"
  }'
```

The server responds with a 201 status, the new client ID, and the registered metadata. Setting `token_endpoint_auth_method` to `none` creates a public client without a secret. For a confidential client, use `client_secret_basic` or `client_secret_post`. The secret appears only in the registration response, so the client must save it then.

Sésame marks dynamic registrations with private metadata, and records the first time the client obtains a token. These markers stay out of the registration response, and allow `sesame:purge --clients` to remove registrations that never authorized (see [purging old records](./tokens_and_grants.md#purging-old-records)).

:::warning
An open registration endpoint lets anyone create clients on your server. Before exposing it, test disabled registration, missing authentication (when you require a user), invalid callback URLs, unknown scopes, and disabled grant types. The [dynamic registration reference](./reference.md#dynamic-registration) lists the defaults and accepted fields.
:::

Sésame does not implement the registration access token workflow for managing a client after registration. When registered clients need updates, use your application's own authenticated management code.

## Client ID Metadata Documents

With **Client ID Metadata Documents**, a public client uses the HTTPS URL of a JSON document as its `client_id`. Sésame fetches the document to learn the client name, callbacks, and permissions, so no registration request is needed. The MCP specification recommends this approach. Since the client is identified by a URL on a host it controls, you can also show that host to the user on the consent page.

### Enabling document resolution

Add the `clientIdMetadataDocuments` option to your existing config. Discovery then advertises `client_id_metadata_document_supported: true`. Keep dynamic registration enabled if older clients still rely on it.

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  // [!code ++:6]
  clientIdMetadataDocuments: {
    allowedHosts: ['clients.example.com', '*.trusted.example.com'],
    cache: { minTtl: '5m', maxTtl: '24h' },
    fetchTimeout: '5s',
    maxResponseSize: 5120,
  },
})
```

To accept documents from any public HTTPS host with the default limits, set `clientIdMetadataDocuments: true` instead.

::::options

:::option{name="allowedHosts" dataType="string[]"}
Hosts allowed to serve documents. When omitted, any public HTTPS host is accepted. List approved hosts for restricted deployments. A wildcard such as `*.trusted.example.com` does not match `trusted.example.com` itself.
:::

:::option{name="cache" dataType="{ minTtl?: string, maxTtl?: string }"}
Bounds applied to the cache lifetime advertised by the document response. Responses without freshness information, or with `no-store` or `no-cache`, use `minTtl`. Defaults to `{ minTtl: '5m', maxTtl: '24h' }`.
:::

:::option{name="fetchTimeout" dataType="string"}
Maximum time spent fetching a document, including the connection, headers, and body. Defaults to `'5s'`.
:::

:::option{name="maxResponseSize" dataType="number"}
Maximum document size in bytes. Defaults to `5120`.
:::

::::

### Publishing a client document

The client serves a JSON document at a canonical HTTPS URL. The `client_id` inside the document must be that same URL.

```json title="https://clients.example.com/oauth/client.json"
{
  "client_id": "https://clients.example.com/oauth/client.json",
  "client_name": "Desktop app",
  "redirect_uris": ["http://127.0.0.1/callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "read"
}
```

Serve the document with a 200 status, a `Content-Type: application/json` header, and no content encoding. Do not redirect the document URL. The client then starts authorization with that exact URL as `client_id` and S256 PKCE. Loopback callbacks may use a different port from the registered URL, but the host, path, and query must still match.

Sésame validates anonymous authorization requests without storing the client. Once the user authenticates, it persists the client before displaying consent. Token, introspection, and revocation requests use the stored client and never fetch the document.

### Showing the client on the consent page

Anyone can claim a client name in a document, so the name alone does not tell the user who they are authorizing. For metadata clients, display the document host and the callback host as well. Read them from the owner-checked pending request in your [consent page](./introduction.md#rendering-the-consent-page), never from query parameters.

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

    // [!code ++:5]
    const isMetadataDocument = pending.clientId.startsWith('https://')
    const clientHost = isMetadataDocument ? new URL(pending.clientId).host : null
    const redirectUri = new URL(pending.redirectUri)
    const redirectHost = redirectUri.host
    const isLoopbackRedirect = ['localhost', '127.0.0.1', '[::1]'].includes(redirectUri.hostname)

    return view.render('oauth/consent', {
      authToken,
      clientName: client.name,
      // [!code ++:3]
      clientHost,
      redirectHost,
      isLoopbackRedirect,
      scopes: pending.scopes.map((scope) => ({
        name: scope,
        description: sesame.config.scopes[scope] ?? scope,
      })),
    })
  }
}
```

For a loopback redirect, explain in the view that the callback goes to an application running on the user's machine.

Consent appears on every authorization for these clients, because any process can reuse a public document URL. For the same reason, `prompt=none` returns `consent_required`. Each authorization creates its own grant, so a replay or a revocation only affects that authorization.

:::note
If you display the document's `logo_uri`, the user's browser requests the logo from its host. Sésame does not proxy logos.
:::

### Disabling or removing a client

Management calls use the document URL as the client ID.

```ts title="app/controllers/oauth_clients_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import sesame from '@adonisjs/sesame/services/main'

export default class OAuthClientsController {
  async disable({ response }: HttpContext) {
    await sesame.updateClient('https://clients.example.com/oauth/client.json', {
      isDisabled: true,
    })

    return response.noContent()
  }
}
```

The disabled state survives metadata refreshes. A refresh replaces the name, callbacks, scopes, grants, and other document-derived metadata, while your custom metadata keys survive. Local edits to document-derived fields are therefore temporary.

Turning the feature off, or removing a host from `allowedHosts`, rejects that client's authorize, consent, token, introspection, revocation, and client-info requests. Access tokens already issued remain usable until they expire. To remove the client together with its tokens, call `sesame.deleteClient(documentUrl)`. Metadata clients are never removed by the unused client purge. See the [client metadata documents reference](./reference.md#client-metadata-documents) for document validation, fetch limits, and cache behavior.

### Using a development fetcher

Sésame fetches documents through the `ClientMetadataDocumentFetcher` class, which refuses to connect to special-use addresses such as loopback and private ranges. This protects your server against **server-side request forgery** (SSRF), where an attacker uses a crafted `client_id` to make your server call internal services. It also means a document served from your own machine is rejected during development.

You can swap the fetcher in the container for development only. This example assumes `certs/dev-ca.pem` contains your development certificate authority, and that a hostname resolves to a loopback address. The client ID URL must still pass document URL validation.

```ts title="providers/app_provider.ts"
import { readFileSync } from 'node:fs'
import type { ApplicationService } from '@adonisjs/core/types'
import {
  ClientMetadataDocumentFetcher,
  isSpecialUseAddress,
} from '@adonisjs/sesame/client_id_metadata_documents/fetcher'

const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1']

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    /**
     * Never relax the address checks outside development
     */
    if (!this.app.inDev) return

    this.app.container.swap(
      ClientMetadataDocumentFetcher,
      () =>
        new ClientMetadataDocumentFetcher({
          ca: readFileSync('certs/dev-ca.pem'),
          isAddressAllowed: (address) =>
            LOOPBACK_ADDRESSES.includes(address) || !isSpecialUseAddress(address),
        })
    )
  }
}
```

Register the provider in `adonisrc.ts` if it is not registered already, and serve the document over HTTPS with the trusted development certificate. Start authorization with the document URL on the local hostname, then confirm that the authenticated request reaches your document server and creates a public client.

:::warning
Keep the `inDev` check on this swap. Allowing loopback addresses in production reopens the SSRF protection the default fetcher provides.

For an internal certificate authority in production, set only the `ca` option and keep the default address restrictions. The `ca` list replaces Node's default certificate authorities, so include every CA your deployment needs.
:::

See also: [Configuration options](./reference.md#configuration-options) and [Endpoints](./reference.md#endpoints).
