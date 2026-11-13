---
description: Issue signed ID tokens, serve the UserInfo endpoint, and switch to JWT access tokens that resource servers verify against your published keys.
---

# OpenID Connect and JWT access tokens

This guide covers OpenID Connect (OIDC) and JWT access tokens in Sésame. You will learn:

- How to generate and store the signing key
- How to enable OpenID Connect and return user claims
- How clients request an identity and verify the ID token
- How to issue JWT access tokens and add custom claims to them
- How a resource server verifies a JWT access token
- How to bind tokens to APIs hosted outside your application
- How to rotate the signing key without rejecting issued tokens

## Overview

Sésame issues **opaque access tokens** by default. They are random strings with no embedded data, and your API checks them with the [OAuth guard](./introduction.md#protecting-routes) or the introspection endpoint. Opaque tokens authorize API requests, but they do not tell a client who the user is.

**OpenID Connect** adds an identity layer on top of OAuth. When a client requests the `openid` scope, the token response also contains an **ID token**: a JWT signed by your server that carries claims about the user (their identifier, and optionally their name or email). The client verifies the signature with your public key and learns who signed in, without calling your API. Access tokens remain the credential for API requests. The OAuth guard does not authenticate ID tokens, so never send an ID token as a Bearer token.

Once a signing key exists, you can also issue **JWT access tokens**. This is useful when an API runs elsewhere, in another language, or without access to your database. Instead of calling Sésame, that API verifies the token signature against the keys your server publishes at `/jwks`.

Both features share the same key, so this guide starts with the key and then builds on it. It assumes you have already [installed](./introduction.md#installation) and [configured](./introduction.md#configuration) Sésame and [registered its routes](./introduction.md#registering-routes).

## Generating a signing key

ID tokens and JWT access tokens are signed with an RSA private key in JWK format. The `sesame:key` command generates one and writes it to your `.env` file as `OIDC_JWK`. If the variable already exists, the command replaces it.

```sh
node ace sesame:key --write-env
```

When your secrets live in a secret manager rather than a `.env` file, use the `--raw` flag. It prints only the JSON of the key to standard output, so you can pipe it to another tool.

```sh
node ace sesame:key --raw
```

:::warning
`OIDC_JWK` is a private key. Anyone holding it can sign ID tokens and access tokens that your clients and APIs will trust. Keep it out of version control and store it like any other production secret.
:::

Validate the variable as a string in `start/env.ts`, so the application fails at boot when it is missing instead of failing on the first token request.

```ts title="start/env.ts"
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // ...other variables
  // [!code ++]
  OIDC_JWK: Env.schema.string(),
})
```

## Enabling OpenID Connect

OpenID Connect requires two options in `config/sesame.ts`. The `jwk` option holds the parsed signing key. The `oidcProvider` option tells Sésame how to load the user behind a token, so it can build the ID token and answer UserInfo requests. This provider is independent from your `@adonisjs/auth` guards, and it must stay stable for the issuer.

Keep your existing store, pages, and scopes, and add both options.

```ts title="config/sesame.ts"
import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/sesame'
// [!code ++]
import { oauthUserProvider } from '@adonisjs/sesame/guard/lucid'
import type { InferScopes } from '@adonisjs/sesame/types'

const sesameConfig = defineConfig({
  issuer: env.get('APP_URL'),
  store: stores.lucid(),
  scopes: {
    read: 'Read access',
    write: 'Write access',
    // [!code ++:2]
    profile: 'Your name',
    email: 'Your email address',
  },
  defaultScopes: ['read'],
  loginPage: '/login',
  consentPage: '/oauth/consent',
  // [!code ++:2]
  jwk: JSON.parse(env.get('OIDC_JWK')),
  oidcProvider: oauthUserProvider({ model: () => import('#models/user') }),
})

export default sesameConfig

declare module '@adonisjs/sesame/types' {
  interface SesameScopes extends InferScopes<typeof sesameConfig> {}
}
```

Sésame recognizes the `openid`, `profile`, and `email` scopes at runtime even when you do not declare them. Declaring `profile` and `email` in the `scopes` map adds them to the inferred TypeScript scope names, so you can use them in typed calls such as `guard.hasScope('email')`.

If your users are not stored with Lucid, pass [your custom user provider](./introduction.md#custom-user-provider) to `oidcProvider` instead.

## Returning user claims

Sésame does not guess which user fields belong in an ID token. Instead, it calls a `getOidcClaims` method on the user returned by the provider and passes it the granted scopes. Without this method, ID tokens only contain protocol claims and UserInfo only returns `sub`.

The `collectOidcClaims` helper maps each scope to a set of claims and keeps only the claims for scopes the user granted. Implementing the `OidcSubject` interface lets TypeScript check the method signature.

```ts title="app/models/user.ts"
import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { collectOidcClaims } from '@adonisjs/sesame/types'
import type { OidcSubject, Scope } from '@adonisjs/sesame/types'

export default class User extends compose(UserSchema, withAuthFinder(hash)) implements OidcSubject {
  getOidcClaims(scopes: Scope[]) {
    /**
     * A client granted only "openid profile" receives the name,
     * but not the email address.
     */
    return collectOidcClaims(scopes, {
      profile: { name: this.fullName },
      email: { email: this.email },
    })
  }
}
```

The method can also return a promise when a claim needs a database query. Protocol claims such as `sub`, `iss`, `aud`, `exp`, `iat`, `nbf`, `jti`, `nonce`, `at_hash`, `auth_time`, `acr`, `azp`, and `sid` are managed by Sésame and cannot be overridden by `getOidcClaims`. See [user providers and claims](./reference.md#user-providers-and-claims) for the full contract.

## Requesting an identity

A client receives an ID token when it requests the `openid` scope. First, allow `openid`, `profile`, and `email` on the client (see [creating clients](./introduction.md#creating-clients)). Then [authorize it with PKCE](./introduction.md#authorizing-a-client) using `scope=openid profile email`.

The `profile` and `email` scopes describe the identity that `openid` asks for, so requesting them without `openid` fails with `invalid_scope`. When the client relies on nonce validation, it should also send a random `nonce` parameter in the authorization request.

The token response then contains an `id_token` field signed with RS256. The nonce is included when the client exchanges the authorization code, and omitted from ID tokens issued on refresh.

The client (the **relying party**) must verify the ID token before trusting it. It checks the signature with the public key published at `/jwks`, then checks that the issuer matches your server, the audience matches its own client ID, the token has not expired, and the nonce matches the one it sent. Skipping any of these checks lets an attacker replay an ID token issued for another client or another login.

## Discovery and UserInfo

OIDC clients find your endpoints and keys through the discovery document. Request it to confirm OIDC is enabled.

```sh
curl https://auth.example.com/.well-known/openid-configuration
```

The **UserInfo** endpoint returns the claims of the user behind an access token. Clients call it with the access token, not the ID token, and the token must have been granted the `openid` scope. The response contains `sub` and the claims returned by `getOidcClaims`.

```sh
curl https://auth.example.com/oauth/userinfo \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## JWT access tokens

An opaque token only means something to the server that stored it. A JWT access token is self-contained: any API holding your public key can check it locally, which removes a network call to Sésame on every request.

### Enabling JWT access tokens

JWT access tokens are signed with the same `jwk` as ID tokens, so configure the key [as shown above](#generating-a-signing-key) first. Sésame refuses to boot when `accessTokenFormat` is `jwt` and `jwk` is missing.

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  jwk: JSON.parse(env.get('OIDC_JWK')),
  // [!code ++:2]
  accessTokenFormat: 'jwt',
  accessTokenTtl: '5m',
})
```

Tokens follow [RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068). The header contains `typ: at+jwt`, and the payload contains `iss`, `sub`, `client_id`, `scope`, `iat`, `exp`, and `jti`. The `aud` claim is the resource the token is bound to, or the issuer when the token is not bound to any resource.

Sésame still stores only the hash of each token, so revocation, introspection, UserInfo, and the OAuth guard work as they do with opaque tokens. One difference: a JWT access token requested without `resource` is bound to the issuer, since RFC 9068 requires an `aud` claim. A guard that declares a `resource` therefore rejects it, even without `requireAudience`.

:::warning
A resource server that only verifies the signature cannot know that a token was revoked. It will keep accepting a revoked token until the token expires.

Keep `accessTokenTtl` short (the example uses five minutes) so a revoked token stops working quickly. Clients obtain new tokens with their refresh token in the meantime.
:::

### Adding custom claims

APIs often need data that is not part of the standard claims, such as the tenant a user belongs to. The `accessTokenClaims` hook receives the context of each token and returns extra claims to embed. The hook is ignored for opaque tokens.

```ts title="config/sesame.ts"
import env from '#start/env'
import Membership from '#models/membership'
import { defineConfig } from '@adonisjs/sesame'

const sesameConfig = defineConfig({
  // ...other options
  jwk: JSON.parse(env.get('OIDC_JWK')),
  accessTokenFormat: 'jwt',
  accessTokenClaims: async ({ userId, clientId, scopes, resource, grantId }) => {
    const membership = await Membership.findByOrFail('userId', userId)
    return { tenant_id: membership.tenantId }
  },
})
```

The `grantId` is `null` for client credentials tokens, and `resource` is `null` for tokens not bound to a resource. The hook cannot override `iss`, `sub`, `aud`, `exp`, `iat`, `nbf`, `jti`, `client_id`, or `scope`, since resource servers rely on them for verification.

### Verifying tokens in a resource server

A resource server fetches your public keys from `/jwks` (also advertised in `/.well-known/openid-configuration`) and caches them. The following example uses the [jose](https://github.com/panva/jose) library, and works in any Node.js API, AdonisJS or not.

```ts title="app/services/token_verifier.ts"
import { createRemoteJWKSet, jwtVerify } from 'jose'

const jwks = createRemoteJWKSet(new URL('https://auth.example.com/jwks'))

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: 'https://auth.example.com',
    audience: 'https://api.example.com',
    /**
     * Rejects ID tokens, which are signed with the same key
     */
    typ: 'at+jwt',
  })

  return payload
}
```

Both the `typ` and `audience` checks matter. Without the `typ` check, a client could present an ID token as an access token, since both are signed with the same key. Without the `audience` check, a token issued for another API would be accepted by yours.

`createRemoteJWKSet` selects the key matching the `kid` header of the token. When it meets an unknown `kid`, it refetches the key set, at most once every 30 seconds by default.

### Issuing tokens for external APIs

Resources registered with `sesame.registerProtectedResource()` are paths of the application that runs Sésame (see [MCP and client registration](./mcp.md#enforcing-a-resource-audience)). To bind tokens to an API hosted elsewhere, list its URI in the `externalResources` option.

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  accessTokenFormat: 'jwt',
  // [!code ++]
  externalResources: ['https://api.example.com'],
})
```

A client requests this API by adding `resource=https://api.example.com` to the authorization request, and the `aud` claim of the issued token is that URI. A more specific URI, such as `https://api.example.com/orders`, maps to the listed resource. Any other value makes the request fail with an `invalid_target` error.

Sésame normalizes the listed URIs at boot and throws when one is invalid, for example when it is not an absolute `http` or `https` URI.

## Rotating the signing key

Relying parties and resource servers reject any token whose `kid` is missing from `/jwks`. If you simply replace `OIDC_JWK`, every token signed with the old key becomes invalid at once. To rotate without that disruption, keep publishing the old key in `previousJwks` until the tokens it signed have expired.

::::steps

:::step{title="Move the current key"}

Copy the current value of `OIDC_JWK` to a new `OIDC_PREVIOUS_JWK` variable, and validate it in `start/env.ts`. Previous keys only need their public components, so you can remove `d` and the other private members from the stored value.

:::

:::step{title="Generate the new key"}

```sh
node ace sesame:key --write-env
```

:::

:::step{title="Publish the previous key"}

```ts title="config/sesame.ts"
const sesameConfig = defineConfig({
  // ...other options
  jwk: JSON.parse(env.get('OIDC_JWK')),
  // [!code ++]
  previousJwks: [JSON.parse(env.get('OIDC_PREVIOUS_JWK'))],
})
```

:::

::::

Sésame signs new tokens with `jwk` only. The `/jwks` endpoint publishes `jwk` first, then each previous key, so tokens signed with the old key keep verifying. Each key is identified by its `kid` member, or by a hash of its public components when `kid` is absent. Keys must have distinct `kid` values, and Sésame throws an error when two keys share one.

Remove the old key once every token it signed has expired. Measured from the last token signed with the old key, wait for the longest of `idTokenTtl`, `accessTokenTtl`, and `clientCredentialsAccessTokenTtl`.

:::warning
Verifiers cache the key set. Sésame serves `/jwks` with a 15 minute cache lifetime, so some verifiers will reject tokens signed with the new key until they refetch it. `createRemoteJWKSet` refetches on an unknown `kid`, but at most once every 30 seconds by default.

When no token may be rejected at all, publish the new key before signing with it. Add its public JWK to `previousJwks`, wait for verifier caches to expire, then make it the `jwk` and move the old key to `previousJwks`.
:::

See also: [Configuration options](./reference.md#configuration-options) and [Commands](./reference.md#commands).
