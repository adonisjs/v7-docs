---
description: Reference for Sésame configuration options, OAuth endpoints, Ace commands, the manager and guard APIs, error codes, and the storage contract.
---

# Reference

This reference covers the public surface of `@adonisjs/sesame`. You will find:

- Every `defineConfig` option with its default value
- The OAuth, OpenID Connect, and discovery endpoints with their parameters
- The Ace commands and their flags
- The manager service and OAuth guard APIs
- The OAuth error codes and authentication challenges
- The contract a custom storage driver must implement

## Overview

Sésame turns your AdonisJS application into an OAuth 2.1 authorization server, with optional OpenID Connect. The [introduction guide](./introduction.md#configuration) walks through the setup. This page lists the exact options, request parameters, and method contracts you need once the server is running.

Most APIs come from these export paths.

| Export path | Contents |
| --- | --- |
| `@adonisjs/sesame` | `defineConfig`, `stores`, `SesameManager`, `OAuthGuard`, `oauthGuard` |
| `@adonisjs/sesame/services/main` | The initialized manager service |
| `@adonisjs/sesame/guard` | `oauthGuard`, `OAuthGuard`, and guard types |
| `@adonisjs/sesame/guard/lucid` | `oauthUserProvider`, `OAuthLucidUserProvider`, `OAuthLucidUserProviderOptions` |
| `@adonisjs/sesame/scope_middleware` | Middleware requiring every listed scope |
| `@adonisjs/sesame/any_scope_middleware` | Middleware requiring at least one listed scope |
| `@adonisjs/sesame/exceptions` | `OAuthError` and the `E_*` exception classes |
| `@adonisjs/sesame/types` | Configuration, scope, grant, and record types |
| `@adonisjs/sesame/storage/types` | `SesameStore` and the storage record and option types |
| `@adonisjs/sesame/client_id_metadata_documents/fetcher` | `ClientMetadataDocumentFetcher`, `isSpecialUseAddress` |
| `@adonisjs/sesame/commands` | The Ace commands |

## Configuration options

The configuration lives in `config/sesame.ts` and is defined with the `defineConfig` helper. The helper applies defaults and validates the configuration at boot, so a missing `store` throws an `InvalidArgumentsException` before the server accepts any request.

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

/**
 * Supplies your scope names to the package's TypeScript APIs
 */
declare module '@adonisjs/sesame/types' {
  interface SesameScopes extends InferScopes<typeof sesameConfig> {}
}
```

Lifetime options accept duration strings such as `'30m'`, `'1h'`, and `'30d'`. The refresh token rotation grace period is the only duration expressed as a number of seconds.

### Required options

::::options

:::option{name="store" dataType="ConfigProvider<SesameStore>"}
The storage driver, created with `stores.lucid()`. A missing store throws an `InvalidArgumentsException` at boot.
:::

:::option{name="issuer" dataType="string"}
The public URL of the authorization server. Sésame uses it in discovery metadata, client redirects, and ID token claims.
:::

:::option{name="loginPage" dataType="string | (ctx: HttpContext, params: URLSearchParams) => string"}
Where Sésame redirects an unauthenticated authorization request. For a string, Sésame appends the forwarded authorization parameters as a query string, using `&` when the string already contains `?`. A function receives the HTTP context and the parameters, and returns the URL.
:::

:::option{name="consentPage" dataType="string | (ctx: HttpContext, params: URLSearchParams) => string"}
Where Sésame redirects when the requested scopes require the user's approval. It accepts the same forms as `loginPage`.
:::

::::

### Scopes and grants

::::options

:::option{name="scopes" dataType="Record<string, string>" defaultValue="{}"}
Scope names mapped to their descriptions.
:::

:::option{name="defaultScopes" dataType="string[]" defaultValue="[]"}
Scopes used when an authorization request omits `scope`, and when client creation omits scopes.
:::

:::option{name="grantTypes" dataType="string[]" defaultValue="['authorization_code', 'refresh_token']"}
The token grants the server accepts. Add `'client_credentials'` to enable machine-to-machine tokens.
:::

::::

### Token lifetimes

::::options

:::option{name="accessTokenTtl" dataType="string" defaultValue="'1h'"}
Access token lifetime.
:::

:::option{name="clientCredentialsAccessTokenTtl" dataType="string"}
Lifetime of access tokens issued by the client credentials grant. Defaults to `accessTokenTtl`.
:::

:::option{name="refreshTokenTtl" dataType="string" defaultValue="'30d'"}
Refresh token lifetime.
:::

:::option{name="refreshTokenRotationGracePeriod" dataType="number" defaultValue="120"}
Number of seconds during which an already rotated refresh token can still issue a new token pair. The grace period absorbs retries from clients that lost the previous response. Set it to `0` to disable it.
:::

:::option{name="authorizationCodeTtl" dataType="string" defaultValue="'10m'"}
Authorization code lifetime.
:::

:::option{name="authorizationRequestTtl" dataType="string"}
Lifetime of a pending authorization request waiting for consent. Defaults to `authorizationCodeTtl`.
:::

:::option{name="idTokenTtl" dataType="string" defaultValue="'1h'"}
ID token lifetime.
:::

::::

### Client registration

::::options

:::option{name="allowDynamicRegistration" dataType="boolean" defaultValue="false"}
Enables the `POST /oauth/register` endpoint.
:::

:::option{name="allowPublicRegistration" dataType="boolean" defaultValue="false"}
Permits dynamic registration without an authenticated user.
:::

:::option{name="clientIdMetadataDocuments" dataType="boolean | ClientIdMetadataDocumentsConfig" defaultValue="false"}
Accepts HTTPS URLs as `client_id` and resolves the client from the document at that URL. Pass `true` for the defaults below, or an object to override them. When disabled, the resolved value is `null`.

- `allowedHosts`: exact hosts or leftmost wildcard hosts (`*.example.com`). A wildcard does not match the parent host. Host names are lowercased. Defaults to any public HTTPS host.
- `cache.minTtl`: minimum document cache lifetime. Defaults to `'5m'`.
- `cache.maxTtl`: maximum document cache lifetime. Defaults to `'24h'`.
- `fetchTimeout`: deadline for the whole fetch. Defaults to `'5s'`.
- `maxResponseSize`: maximum response size in bytes. Defaults to `5120`.

See [client metadata documents](#client-metadata-documents) for the validation, fetch, and cache rules.
:::

::::

### Signing keys and OpenID Connect

OpenID Connect is enabled only when both `jwk` and `oidcProvider` are set. See the [OpenID Connect guide](./openid_connect.md).

::::options

:::option{name="jwk" dataType="JWK"}
RSA private JWK used for RS256 signing of ID tokens and JWT access tokens. Generate one with [`sesame:key`](#sesamekey).
:::

:::option{name="previousJwks" dataType="JWK[]" defaultValue="[]"}
Keys that signed tokens before the current `jwk`. They are published in the JWKS for verification only and never sign new tokens, so tokens issued before a key rotation stay verifiable. Public JWKs are enough. Setting this option without `jwk` throws at boot.
:::

:::option{name="oidcProvider" dataType="OAuthUserProviderContract"}
User provider resolving the subject and claims for ID tokens and the UserInfo endpoint. It is independent from your `@adonisjs/auth` guards.
:::

::::

### Access token format and resources

::::options

:::option{name="accessTokenFormat" dataType="'opaque' | 'jwt'" defaultValue="'opaque'"}
`'opaque'` issues random strings. `'jwt'` issues RFC 9068 JWT access tokens signed with `jwk`, which resource servers can verify against the JWKS without calling Sésame. Only the token hash is stored in both cases, so revocation, introspection, and the guard behave the same. Setting `'jwt'` without `jwk` throws at boot.
:::

:::option{name="accessTokenClaims" dataType="(context: AccessTokenClaimsContext) => Record<string, unknown> | Promise<Record<string, unknown>>"}
Returns extra claims for JWT access tokens. The context contains `userId`, `clientId`, `scopes`, `resource`, and `grantId`. The protocol claims `iss`, `sub`, `aud`, `exp`, `iat`, `nbf`, `jti`, `client_id`, and `scope` cannot be overridden. The function is ignored for opaque tokens.
:::

:::option{name="externalResources" dataType="string[]" defaultValue="[]"}
Absolute HTTP or HTTPS URIs of APIs hosted outside this application that clients can request with the `resource` parameter. Invalid URIs throw at boot. Resources served by this application are registered with [`registerProtectedResource`](#route-registration) instead.
:::

::::

### Store factories

`stores.lucid()` returns an AdonisJS config provider rather than a raw driver instance. It uses your application's Lucid connection.

### Types

`InferScopes`, `SesameConfig`, `ResolvedSesameConfig`, `Scope`, `SesameStore`, and the record types are exported from `@adonisjs/sesame/types`. Augmenting `SesameScopes` with `InferScopes<typeof sesameConfig>`, as shown in the configuration example above, types your scope names across the package's APIs.

## Endpoints

The paths below assume you call `registerRoutes()` inside a `/oauth` prefix group and `registerDiscoveryRoutes()` at the root.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/oauth/token` | Exchange a grant for tokens |
| GET | `/oauth/authorize` | Start browser authorization |
| POST | `/oauth/consent` | Approve or deny the logged-in user's pending request |
| POST | `/oauth/introspect` | Inspect a token owned by the authenticated client |
| POST | `/oauth/revoke` | Revoke a token owned by the authenticated client |
| POST | `/oauth/register` | Register a client when dynamic registration is enabled |
| GET | `/oauth/client-info` | Return a client's public ID and name |
| GET and POST | `/oauth/userinfo` | Return OpenID Connect claims of the subject |
| GET | `/.well-known/oauth-authorization-server` | OAuth authorization server metadata |
| GET | `/.well-known/openid-configuration` | OpenID Connect discovery |
| GET | `/.well-known/oauth-protected-resource` | Root protected resource metadata |
| GET | `/jwks` | Public signing keys. The path is configurable |

`registerProtectedResource({ resource: '/api/mcp' })` adds `GET /.well-known/oauth-protected-resource/api/mcp`. It does not register or protect `/api/mcp` itself. See the [MCP guide](./mcp.md).

### Client authentication

The token, introspection, and revocation endpoints authenticate the client. Confidential clients send HTTP Basic credentials, or `client_id` and `client_secret` in the body. Public clients send `client_id` without a secret. A request cannot combine HTTP Basic credentials with a body `client_secret`, and a body `client_id` sent with HTTP Basic must match the Basic `client_id`.

A browser session never replaces client authentication on these endpoints. The client credentials grant only accepts confidential clients.

### Authorization

`GET /oauth/authorize` reads the following query parameters.

::::options

:::option{name="client_id" dataType="string"}
Required. A registered client ID.
:::

:::option{name="response_type" dataType="string"}
Required. Only `code` is supported.
:::

:::option{name="redirect_uri" dataType="string"}
Required. A registered redirect URI. HTTP loopback callbacks match regardless of port, but host, path, and query must still match.
:::

:::option{name="scope" dataType="string"}
Space-separated scopes. Defaults to the server's `defaultScopes`. Requested scopes must pass server validation and the client's allowed scope list.
:::

:::option{name="state" dataType="string"}
Opaque value returned to the client on redirect.
:::

:::option{name="code_challenge" dataType="string"}
Required. The PKCE code challenge.
:::

:::option{name="code_challenge_method" dataType="string"}
Required. Must be `S256`. PKCE remains mandatory even when a client record has `requirePkce: false`.
:::

:::option{name="nonce" dataType="string"}
OpenID Connect nonce, copied into the ID token issued by the code exchange.
:::

:::option{name="prompt" dataType="string"}
Space-separated values. `consent` forces the consent page. `none` returns `login_required` or `consent_required` instead of showing a page, and combining `none` with another value returns `invalid_request`. Other values and `max_age` are ignored.
:::

:::option{name="resource" dataType="string"}
Absolute target URI, resolved to a registered resource. See [resource indicators](#resource-indicators).
:::

::::

Errors raised before the callback is validated produce an HTTP error. Later errors redirect to the validated callback with `error` and `error_description`.

An active grant without context lets the user skip consent. Metadata document clients, and public clients redirecting to a loopback or custom scheme URI, always require consent because any local application can reuse their `client_id`.

Client callback redirects include `iss`, and return `state` when present. Redirects to the login and consent pages carry the original authorization query. The consent page also receives `auth_token`, and the resolved resource when present.

### Consent

`POST /oauth/consent` requires the default authenticated user and a body `auth_token` identifying that user's unexpired, unconsumed pending request.

::::options

:::option{name="auth_token" dataType="string"}
Required. The token passed to the consent page.
:::

:::option{name="accept" dataType="any"}
A truthy value approves the request. A missing or falsy value denies it. The string `'false'` is truthy.
:::

:::option{name="scope" dataType="string | string[]"}
A nonempty subset of the requested scopes to grant. Omitting it grants every requested scope. An invalid selection fails before the request is consumed.
:::

::::

A valid decision consumes the request atomically. Submitted client IDs and callback URLs never replace the saved request, and the controller never reads grant context from the body. Approval creates a grant. Denial redirects with `error=access_denied` and leaves existing grants intact.

### Token grants

Every token request has a body `grant_type`, and that grant must be enabled on the server. See the [tokens and grants guide](./tokens_and_grants.md).

| Grant | Body fields | Result |
| --- | --- | --- |
| `authorization_code` | `code`, `redirect_uri`, `code_verifier`, optional `resource` | Access token, a refresh token when the server enables refresh, and an ID token for an OpenID Connect grant |
| `refresh_token` | `refresh_token`, optional `scope` and `resource` | New access and refresh tokens, and an optional ID token |
| `client_credentials` | Optional `scope` and `resource` | Access token only. Requires a confidential client with a `userId` and that grant enabled |

Refresh exchanges also require the `refresh_token` grant on the client. Receiving a refresh token during a code exchange does not enable that grant for the client. Reusing a consumed authorization code revokes its grant, including concurrent exchanges. Consumed codes remain stored with `consumedAt`.

Client credentials rejects `openid`, `profile`, `email`, and `offline_access`. When the request omits `scope`, it defaults to the client's scopes that are neither built-in nor OpenID Connect scopes.

Successful responses contain `access_token`, `token_type: 'Bearer'`, `expires_in` in seconds, and a space-separated `scope`. Token responses set `Cache-Control: no-store` and `Pragma: no-cache`.

### Resource indicators

Authorization and every token grant accept one `resource` parameter. It must be an absolute HTTP or HTTPS URI on the issuer's origin, or match an `externalResources` entry. It cannot contain credentials, a fragment, whitespace, control characters, or backslashes. Repeated parameters and unknown origins return `invalid_target`.

The value maps to the most specific registered resource path, or to the issuer when no path covers it. With `/api/mcp` registered, the same origin's `/api/mcp/` and `/api/mcp/tools` map to that resource, while `/other` maps to the issuer. Scheme and host are lowercased, default ports and one trailing slash are removed, and prefix matches require a path segment boundary. A resource containing a query must match a registered identifier exactly.

Codes and tokens store the resolved resource. A token exchange cannot change a bound resource, and refresh preserves it. An unbound code or refresh token can acquire a resource at exchange, and omitting the parameter keeps unbound requests valid.

### Introspection and revocation

Both endpoints accept a body `token` and an optional `token_type_hint` (`access_token` or `refresh_token`). Lookup is limited to the authenticated client's records. The hint only sets the lookup order: `refresh_token` looks up refresh tokens first, and anything else looks up access tokens first. The other type is tried when the first lookup finds nothing.

Introspection returns `{ active: false }` for missing, invalid, expired, revoked, or other-client tokens, and for tokens whose grant is missing, revoked, or expired. Active responses include `active`, `token_type`, `client_id`, `sub`, `scope`, `iss`, `iat`, and `exp`, plus `aud` for bound resources.

After valid client authentication, revocation returns 200 with `{}`, even for an unknown token. Revoking a refresh token revokes its whole grant and every token issued from it. For a legacy token without a grant, it revokes the linked access token. Revoking an access token only affects that token.

### Dynamic registration

`POST /oauth/register` requires `allowDynamicRegistration`. It also requires an already populated `ctx.auth.user` unless `allowPublicRegistration` is `true`.

::::options

:::option{name="redirect_uris" dataType="string[]"}
Required nonempty array of redirect URLs. Malformed URLs, fragments, and the `javascript:`, `data:`, and `vbscript:` schemes are rejected. HTTP URLs are accepted only for `localhost`, `127.0.0.1`, and `[::1]`. Custom schemes are not rejected for being non-HTTPS.
:::

:::option{name="client_name" dataType="string" defaultValue="'Unnamed Client'"}
Client name, at most 255 characters.
:::

:::option{name="token_endpoint_auth_method" dataType="string" defaultValue="'client_secret_basic'"}
Also accepts `client_secret_post`, and `none` for a public client.
:::

:::option{name="grant_types" dataType="string[]" defaultValue="['authorization_code', 'refresh_token']"}
Each grant must be enabled on the server.
:::

:::option{name="response_types" dataType="string[]" defaultValue="['code']"}
Only `code` is supported.
:::

:::option{name="scope" dataType="string"}
Space-separated scopes. Defaults to the server's `defaultScopes`.
:::

:::option{name="client_uri, logo_uri, tos_uri, policy_uri" dataType="string"}
Optional metadata URLs. They require a protocol and reject dangerous schemes, but do not need to share the redirect URI's host.
:::

:::option{name="contacts" dataType="string[]"}
Optional email addresses.
:::

:::option{name="software_id, software_version" dataType="string"}
Optional strings.
:::

::::

A successful response has status 201 and `Cache-Control: no-store`. It contains the registered metadata with `client_id` and `client_secret_expires_at: 0`. Confidential registrations include the raw `client_secret`. Public registrations use `none` and omit the secret.

### Client information

`GET /oauth/client-info` requires a query `client_id`. The response contains `client_id` and `client_name`, plus the stored `client_uri`, `logo_uri`, `tos_uri`, `policy_uri`, `client_id_metadata_document`, and `client_id_host` values when applicable. The endpoint never resolves a metadata document, so a metadata document client is unavailable until an authenticated authorization persists it. A response does not prove that a pending request belongs to that client.

### Client metadata documents

When `clientIdMetadataDocuments` is enabled, an HTTPS URL is accepted as `client_id`. When it is disabled, URL client IDs are rejected, including stored ones. The URL must be canonical HTTPS, have a non-root path and a hostname rather than an IP address, and be at most 255 characters. Query, fragment, and userinfo are rejected. Host checks against `allowedHosts` are case-insensitive, while client ID comparisons are exact.

:::note
MySQL and MariaDB case-insensitive collations make case variants of a client ID collide, and Sésame rejects the mismatched stored ID. To support both variants, use binary collations on the client ID column and its foreign key columns.
:::

The fetched document must satisfy these rules.

| Field | Requirement |
| --- | --- |
| `client_id` | Required. Exactly the fetched URL |
| `client_name` | Required, nonempty, at most 255 characters |
| `redirect_uris` | Required nonempty array, validated like dynamic registration |
| `token_endpoint_auth_method` | Absent or `none`. Shared secrets and `private_key_jwt` are unsupported |
| `client_secret`, `client_secret_expires_at` | Forbidden |
| `response_types` | Includes `code` when present |
| `grant_types` | Defaults to authorization code and refresh. Only enabled authorization code and refresh grants are kept, and authorization code must remain. Unsupported grants are ignored |
| `scope` | Keeps the scopes valid for the server and its OpenID Connect setup. Uses `defaultScopes` when absent or empty |
| `software_id`, `software_version` | Optional strings, at most 255 characters |
| `client_uri`, `logo_uri`, `tos_uri`, `policy_uri` | Optional HTTPS URLs, stored for display and never fetched |

Stored clients are public with mandatory PKCE. Anonymous resolutions are not persisted, and an authenticated authorization persists the record.

The default fetcher checks every resolved IP at connection time and rejects special-use ranges, including loopback, private, link-local, and IPv4-mapped IPv6 addresses. It accepts only status 200, never follows redirects, requires a JSON content type (including `application/*+json`), and forbids content encoding. The timeout and size limits apply to the whole fetch, and `HTTPS_PROXY` is not used. Fetch failures return `invalid_client` before the callback is trusted, and network details are logged under `err` instead of being shown to the browser.

Stored client freshness follows the response `Cache-Control: max-age` or `Expires`, adjusted by `Age` and `Date`, then clamped to `cache.minTtl` and `cache.maxTtl`. Stale responses, missing freshness, `no-store`, and `no-cache` use the minimum. After expiry, the next authorization fetches the document again, and a failed fetch or validation fails the authorization even when a stored copy exists. A refresh overwrites document-derived fields and preserves the disabled state and custom metadata keys. Anonymous resolutions use a per-process cache of at most 500 entries, where successes last `minTtl` and failures last five seconds.

The container resolves `ClientMetadataDocumentFetcher`, so an application provider or a test can swap it. Its constructor accepts `isAddressAllowed(address)` and `ca`, which replaces Node's default certificate authorities. A subclass can override `fetch()` to serve fixture documents.

:::warning
Relaxing `isAddressAllowed` lets client-supplied URLs reach the addresses you allow, including internal services. Only relax it in development or tests, and keep the default fetcher in production.
:::

### Discovery

Authorization server metadata lists the endpoint URLs, supported grants and scopes, the `code` response type, the `query` response mode, S256 PKCE, and the supported client authentication methods. It advertises `prompt_values_supported: ['none', 'consent']` and `authorization_response_iss_parameter_supported: true`. The registration endpoint appears only when dynamic registration is enabled, `jwks_uri` appears when a signing key is configured, and `client_id_metadata_document_supported: true` appears when metadata documents are enabled.

OpenID Connect discovery adds the UserInfo and JWKS URLs, the `public` subject type, RS256 signing, and the supported protocol claims. Protected resource metadata lists the resource, its authorization servers, its scopes, and header Bearer authentication. Per-resource scope lists also include `offline_access`.

### OpenID Connect endpoints

OpenID Connect discovery returns 404 unless both `jwk` and `oidcProvider` are configured. Without them, OpenID Connect scopes fail with `invalid_scope`. The JWKS endpoint returns 404 only when no `jwk` is configured. It exposes the public components of `jwk` and `previousJwks` with `Cache-Control: public, max-age=900`.

UserInfo accepts a Bearer header or a body `access_token`, on both GET and POST. It requires an active token with the `openid` scope and returns `sub` with the claims the user's scopes allow.

ID tokens are RS256-signed JWTs with `iss`, `sub`, `aud`, `iat`, `exp`, `at_hash`, and the permitted user claims. The authorization code exchange includes the requested `nonce`, and refresh omits it. See the [OpenID Connect guide](./openid_connect.md).

## Commands

The package installer registers these commands through `@adonisjs/sesame/commands`.

### sesame:client

Creates an OAuth client and prints its client ID, plus the raw secret for a confidential client. The command prompts for the name and redirect URIs when you omit them, and asks whether the client is public unless you pass `--public`. Array flags accept repeated flags or comma-separated values.

```sh
node ace sesame:client --name="Mobile app" --public --redirect-uris="myapp://callback"
```

::::options

:::option{name="--name" dataType="string"}
Client name.
:::

:::option{name="--public" dataType="boolean"}
Creates a public client without a secret.
:::

:::option{name="--redirect-uris" dataType="string[]"}
Redirect URIs.
:::

:::option{name="--scopes" dataType="string[]"}
Allowed scopes. Defaults to the configured `defaultScopes`.
:::

:::option{name="--grant-types" dataType="string[]" defaultValue="['authorization_code']"}
Allowed grants.
:::

:::option{name="--user-id" dataType="string"}
Owner user ID. Required for the client credentials grant.
:::

::::

### sesame:key

Generates an RSA private JWK and displays configuration instructions. The JWKS endpoint only exposes the key's public components.

```sh
node ace sesame:key --write-env
```

::::options

:::option{name="--raw" dataType="boolean"}
Prints only the raw JWK JSON, for a file or a secret manager.
:::

:::option{name="--write-env" dataType="boolean"}
Adds or replaces `OIDC_JWK` in the application's `.env` file.
:::

::::

### sesame:upgrade

Publishes the database migrations needed to upgrade to a Sésame version. It does not run them.

```sh
node ace sesame:upgrade 0.8
```

::::options

:::option{name="version" dataType="string"}
Required argument. The target version as `major.minor` or `major.minor.0`. A version without bundled migrations exits with code 1.
:::

::::

### sesame:purge

Deletes revoked and expired OAuth records. Schedule it to keep the tables small.

```sh
node ace sesame:purge --hours=72 --clients
```

::::options

:::option{name="--revoked" dataType="boolean"}
Selects revoked records.
:::

:::option{name="--expired" dataType="boolean"}
Selects expired records.
:::

:::option{name="--hours" dataType="number" defaultValue="168"}
Retention in hours for expired records and revoked refresh tokens.
:::

:::option{name="--clients" dataType="boolean"}
Also removes unused dynamic registrations after the token purge.
:::

:::option{name="--client-days" dataType="number" defaultValue="30"}
Minimum client age in days, used with `--clients`. Must be a positive integer, otherwise the command exits before deleting anything.
:::

::::

With neither selection flag, or with both, both categories are purged. Revoked refresh tokens are kept until the retention cutoff so replay detection keeps working, while revoked access tokens are deleted immediately. Expired pending authorization requests are always removed, regardless of flags and retention. The printed total counts access tokens, refresh tokens, codes, grants, and deleted clients, but not pending requests.

## Manager API

The manager service is imported from `@adonisjs/sesame/services/main`.

```ts title="app/controllers/grants_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import sesame from '@adonisjs/sesame/services/main'

export default class GrantsController {
  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return sesame.listGrants({ userId: String(user.id) })
  }
}
```

### Server state

::::options

:::option{name="config" dataType="ResolvedSesameConfig"}
The resolved server configuration.
:::

:::option{name="isOidcEnabled" dataType="boolean"}
`true` when both `jwk` and `oidcProvider` are configured.
:::

:::option{name="findPendingAuthorizationRequest" dataType="({ token, userId }) => Promise<record | null>"}
Hashes the raw token and returns the pending request when it belongs to that user and is neither expired nor consumed. It does not consume the request.
:::

::::

### Grants and authorization decisions

Use these methods to build your own consent flow or a "connected apps" page. The `userId` filter on single-grant update and revocation restricts the operation to that owner, but these methods never authenticate the calling route. See the [tokens and grants guide](./tokens_and_grants.md).

::::options

:::option{name="approveAuthorization" dataType="({ authToken, userId, scopes?, context? }) => Promise<AuthorizationDecision>"}
Consumes a pending request, creates a grant, and returns `{ redirectUrl, clientId, scopes }`. `scopes` defaults to all requested scopes, and an explicit list must be a nonempty subset with valid OpenID Connect combinations. An invalid selection does not consume the request. `context` must be a plain JSON object or `null`.
:::

:::option{name="denyAuthorization" dataType="({ authToken, userId }) => Promise<AuthorizationDecision>"}
Consumes a request and returns the same shape with a denial redirect and empty scopes. Existing grants remain.
:::

:::option{name="listGrants" dataType="({ userId, clientId? }) => Promise<SesameGrant[]>"}
Active grants, newest first, with their public client records. Grants whose client no longer exists are omitted.
:::

:::option{name="findGrant" dataType="(grantId) => Promise<OAuthGrantRecord | null>"}
The grant record, including expired grants. Non-UUID IDs return `null`.
:::

:::option{name="revokeGrant" dataType="({ grantId, userId? }) => Promise<boolean>"}
Revokes the grant with its codes and tokens.
:::

:::option{name="revokeGrants" dataType="({ userId, clientId? }) => Promise<number>"}
Revokes a user's grants, optionally for one client, and returns the count.
:::

:::option{name="updateGrant" dataType="({ grantId, userId?, context }) => Promise<OAuthGrantRecord | null>"}
Replaces the grant context and returns the record.
:::

:::option{name="revokeAllForUser" dataType="(userId) => Promise<void>"}
Revokes the user's tokens and removes their authorization artifacts through the store.
:::

::::

The grant types `ApproveAuthorizationOptions`, `DenyAuthorizationOptions`, `AuthorizationDecision`, `ListGrantsOptions`, `SesameGrant`, `RevokeGrantOptions`, `RevokeGrantsOptions`, `UpdateGrantOptions`, `GrantContext`, and the augmentable `SesameGrantContext` are exported from `@adonisjs/sesame/types`.

### Client management

These methods take the public `clientId` and return plain records, not Lucid models. The stored `clientSecret` hash is non-enumerable on the results, but direct property access still returns it. They do not apply the dynamic registration HTTP validator.

::::options

:::option{name="createClient" dataType="(options) => Promise<{ client, clientSecret }>"}
Requires `name` and `redirectUris`. Optional fields are `scopes` (defaults to `defaultScopes`), `grantTypes` (defaults to `['authorization_code']`), `isPublic` (defaults to `false`), `requirePkce` (defaults to `true`), `userId`, and `metadata` (both default to `null`). `clientSecret` is raw, and `null` for public clients.
:::

:::option{name="findClient" dataType="(clientId) => Promise<record | null>"}
Finds a client.
:::

:::option{name="listClients" dataType="({ userId? }?) => Promise<record[]>"}
Lists clients, optionally filtered by owner.
:::

:::option{name="updateClient" dataType="(clientId, options) => Promise<record | null>"}
Accepts `name`, `redirectUris`, `scopes`, `grantTypes`, `isDisabled`, `requirePkce`, and `metadata`. It cannot change ownership or client type.
:::

:::option{name="deleteClient" dataType="(clientId) => Promise<boolean>"}
Deletes the client with its tokens, codes, grants, and pending requests.
:::

:::option{name="rotateClientSecret" dataType="(clientId) => Promise<string | null>"}
Returns the new raw secret, or `null` for public or missing clients.
:::

::::

### Maintenance

::::options

:::option{name="purgeTokens" dataType="({ revokedOnly?, expiredOnly?, retentionHours? }?) => Promise<counts>"}
Deletes revoked and expired records and returns the deleted access tokens, refresh tokens, codes, pending requests, and grants. Both categories are selected by default, and `retentionHours` defaults to `168`.
:::

:::option{name="purgeUnusedClients" dataType="({ olderThanDays? }?) => Promise<number>"}
Deletes unused dynamic clients and returns the count. `olderThanDays` defaults to `30` and must be a positive integer.
:::

::::

### Route registration

::::options

:::option{name="registerRoutes" dataType="() => void"}
Registers the relative OAuth routes on the injected router. Wrap the call in a prefix group.
:::

:::option{name="registerDiscoveryRoutes" dataType="({ jwksPath? }?) => void"}
Registers the root discovery routes and the JWKS route. `jwksPath` defaults to `/jwks`.
:::

:::option{name="registerProtectedResource" dataType="({ resource, scopes? }) => void"}
Publishes discovery metadata for a resource path. It does not protect the resource.
:::

:::option{name="registerWellKnownRoutes" dataType="({ jwksPath? }?) => void"}
Deprecated alias for `registerDiscoveryRoutes`.
:::

::::

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import sesame from '@adonisjs/sesame/services/main'

router
  .group(() => {
    sesame.registerRoutes()
  })
  .prefix('/oauth')

sesame.registerDiscoveryRoutes()
sesame.registerProtectedResource({ resource: '/api/mcp', scopes: ['read'] })
```

## Guard API

`oauthGuard` is exported from `@adonisjs/sesame/guard` and plugs into `@adonisjs/auth`. The guard checks the token record, expiry, revocation, user lookup, grant validity, and the configured audience. It does not use the current client record to decide token validity.

```ts title="config/auth.ts"
import { defineConfig } from '@adonisjs/auth'
import { oauthGuard } from '@adonisjs/sesame/guard'
import { oauthUserProvider } from '@adonisjs/sesame/guard/lucid'

const authConfig = defineConfig({
  /**
   * Keep your session guard as the default: authorization and
   * consent use it to identify the logged-in user
   */
  default: 'web',
  guards: {
    // ...your session guard
    oauth: oauthGuard({
      provider: oauthUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig
```

### Guard options

::::options

:::option{name="provider" dataType="OAuthUserProviderContract"}
Required. The user provider resolving the token's user.
:::

:::option{name="resource" dataType="string"}
The protected resource path used for challenge metadata and audience checks. Without it, no audience check runs.
:::

:::option{name="requireAudience" dataType="boolean" defaultValue="false"}
When `true` and `resource` is set, rejects tokens not bound to a resource.
:::

::::

### Guard members

::::options

:::option{name="authenticate" dataType="({ scopes?, match? }?) => Promise<User>"}
Resolves the token's user or throws. `scopes` and `match` (`'all'` by default, or `'any'`) declare the route's scopes for the 401 challenge. They advertise scopes without enforcing them. With `match: 'any'`, route scopes do not extend the challenge when a declared resource scope already satisfies the route.
:::

:::option{name="check" dataType="() => Promise<boolean>"}
`true` after successful authentication, `false` for unauthorized access.
:::

:::option{name="getUserOrFail" dataType="() => User"}
Returns the user or throws.
:::

:::option{name="hasScope" dataType="(...scopes) => boolean"}
`true` when the token has every listed scope.
:::

:::option{name="hasAnyScope" dataType="(...scopes) => boolean"}
`true` when the token has at least one listed scope.
:::

:::option{name="insufficientScopeError" dataType="(scopes) => E_INSUFFICIENT_SCOPE"}
Builds an error carrying the resource metadata URL and the union of granted and required scopes.
:::

:::option{name="authenticateAsClient" dataType="(user, { scopes?, context? }?) => Promise<AuthClientResponse>"}
Creates database-backed test credentials for the Japa API client. `scopes` defaults to the configured `defaultScopes`, and `context` defaults to none. The token's resource follows the guard's configuration.
:::

:::option{name="user" dataType="User | undefined"}
The application user after success.
:::

:::option{name="scopes" dataType="Scope[]"}
The token's granted scopes after success.
:::

:::option{name="clientId" dataType="string | undefined"}
The token's public client ID after success.
:::

:::option{name="authenticationAttempted" dataType="boolean"}
Whether the guard already attempted authentication.
:::

:::option{name="isAuthenticated" dataType="boolean"}
Whether authentication succeeded.
:::

:::option{name="accessToken" dataType="OAuthGuardAccessToken | undefined"}
The authenticating record's ID, client ID, user ID, scopes, timestamps, grant ID, context, and resource. It never contains the token value or hash.
:::

:::option{name="grantId" dataType="string | undefined"}
The grant ID, or `undefined` for legacy and client credentials tokens.
:::

:::option{name="context" dataType="GrantContext | null"}
The current grant context.
:::

:::option{name="audience" dataType="string | null"}
The token's bound resource.
:::

:::option{name="resourceMetadataUrl" dataType="string"}
URL of the guard's protected resource discovery document.
:::

::::

Scope enforcement happens in the scope middleware (`@adonisjs/sesame/scope_middleware` for all scopes, `@adonisjs/sesame/any_scope_middleware` for any scope) or in explicit `hasScope` checks. The middleware accepts `{ scopes, guard? }`, where `guard` defaults to `oauth`, and throws `insufficientScopeError` when a scope is missing.

### Guard events

| Event | Payload |
| --- | --- |
| `oauth_auth:authentication_attempted` | `ctx`, `guardName` |
| `oauth_auth:authentication_succeeded` | `ctx`, `guardName`, `user`, `accessToken` |
| `oauth_auth:authentication_failed` | `ctx`, `guardName`, `error` |

The attempted event runs when authentication starts, including requests without a Bearer token. Calling `authenticate` again on the same guard does not start another attempt.

### User providers and claims

A custom provider implements `OAuthUserProviderContract<User>` from `@adonisjs/sesame/guard`, which requires `[symbols.PROVIDER_REAL_USER]`, `createUserForGuard(user)`, and `findById(identifier)`. A guard user has `getId()` and `getOriginal()`. The Lucid adapter `oauthUserProvider`, the `OAuthLucidUserProvider` class, and the `OAuthLucidUserProviderOptions` type are exported from `@adonisjs/sesame/guard/lucid`.

`OidcSubject`, `Scope`, and `collectOidcClaims` are exported from `@adonisjs/sesame/types`. `collectOidcClaims` combines the claims mapped to the granted scopes. Sésame filters the protocol-managed `sub`, `iss`, `aud`, `exp`, `iat`, `nbf`, `jti`, `nonce`, `at_hash`, `auth_time`, `acr`, `azp`, and `sid` claims out of custom claims.

## Errors

OAuth controller errors return a JSON body with `error` and `error_description`. The description can name the failing parameter or scope. `OAuthError` is the base class, and every exception is exported from `@adonisjs/sesame/exceptions`.

| Class | OAuth code | Status | Typical condition |
| --- | --- | --- | --- |
| `E_INVALID_REQUEST` | `invalid_request` | 400 | Missing parameters, invalid callback, or missing consent user |
| `E_INVALID_CLIENT` | `invalid_client` | 401 | Unknown, disabled, or incorrectly authenticated client |
| `E_INVALID_GRANT` | `invalid_grant` | 400 | Invalid, expired, consumed, or revoked grant |
| `E_INVALID_TARGET` | `invalid_target` | 400 | Malformed, repeated, other-origin, or incompatible resource indicator |
| `E_INVALID_SCOPE` | `invalid_scope` | 400 | Unknown scope or disallowed scope combination |
| `E_INVALID_TOKEN` | `invalid_token` | 401 | Invalid token at an OAuth endpoint such as UserInfo |
| `E_UNSUPPORTED_GRANT_TYPE` | `unsupported_grant_type` | 400 | Missing, disabled, or unsupported token grant |
| `E_UNSUPPORTED_RESPONSE_TYPE` | `unsupported_response_type` | 400 | Response type other than `code` |
| `E_ACCESS_DENIED` | `access_denied` | 403 | Dynamic registration disabled |
| `E_INVALID_CLIENT_METADATA` | `invalid_client_metadata` | 400 | Registration validation failure |
| `E_SERVER_ERROR` | `server_error` | 500 | Server error represented as an OAuth exception |
| `E_INSUFFICIENT_SCOPE` | `insufficient_scope` | 403 | Valid authentication without the required scopes |

### Redirect errors

Once the callback is validated, authorization errors redirect to it with `error` and `error_description` query parameters instead of returning JSON. A client without the authorization code grant receives `unauthorized_client` this way. `prompt=none` redirects with `login_required` or `consent_required`, and invalid prompt combinations redirect with `invalid_request`. Consent denial redirects with `error=access_denied` rather than returning a 403 JSON body. These redirects preserve `state` and include `iss`.

### Authentication challenges

`E_INVALID_CLIENT` adds `WWW-Authenticate: Basic` when the request attempted HTTP Basic authentication. `E_INVALID_TOKEN` adds a Bearer challenge with `error="invalid_token"` and its description. `E_INSUFFICIENT_SCOPE` adds a Bearer challenge with `error="insufficient_scope"` and a space-separated `scope`. The guard's `insufficientScopeError`, used by the scope middleware, also adds `resource_metadata`.

OAuth guard authentication failures use the `E_UNAUTHORIZED_ACCESS` exception of `@adonisjs/auth`, not `OAuthError`. Their Bearer challenge includes `resource_metadata`, which lets MCP clients discover the authorization server. Invalid tokens also get `error="invalid_token"`, while missing Bearer tokens receive the metadata challenge without that field. Challenges can include the configured resource scopes and the route scopes passed to `authenticate` or the scope middleware.

## Storage contract

The bundled Lucid store implements the full contract, so you only need this section to write a custom store. `SesameStore` and its record and option types are exported from `@adonisjs/sesame/storage/types` and re-exported from `@adonisjs/sesame/types`. Provide the store through an AdonisJS `ConfigProvider<SesameStore>`, as `stores.lucid()` does.

A custom store must keep the guarantees of the bundled ones. Authorization code exchange, refresh token rotation, and pending request consumption must be atomic, so a concurrent request cannot issue a second set of tokens. Revoking a grant must invalidate every code and token issued from it, and revoked refresh tokens must stay detectable until they are purged, since replay detection depends on them.

The complete contract, with the expected behavior of each method, is documented in `src/storage/types.ts` of the [package repository](https://github.com/adonisjs/sesame).
