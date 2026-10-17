---
description: Implement social authentication in your AdonisJS applications using the @adonisjs/ally package.
---

# Social authentication

This guide covers social authentication in AdonisJS using the Ally package. You will learn:

- How to install and configure Ally with OAuth providers
- How to redirect users to a provider and handle callbacks
- How to access user information from the provider
- How to create or find users and log them in
- How to use stateless authentication for SPAs and mobile apps
- How to create custom social drivers

## Overview

Social authentication allows users to log in using their existing accounts from services like GitHub, Google, X (formerly Twitter), or Discord. Instead of creating a new username and password, users authorize your application to access their profile information from the provider.

AdonisJS provides the `@adonisjs/ally` package for social authentication. Ally handles the OAuth flow (redirecting users, exchanging codes for tokens, fetching user data) and provides a consistent API across different providers. It supports OAuth 1.0 (Twitter) and OAuth 2.0 (X, GitHub, Google, and most other providers).

Ally does not store users or tokens in your database. It handles the OAuth flow and returns user information, which you then use to create or find a user in your database and log them in using an [auth guard](./introduction.md).

## Installation

Install and configure the package using the `add` command:
```sh
node ace add @adonisjs/ally

# Specify providers during installation
node ace add @adonisjs/ally --providers=github --providers=google
```

The `--providers` flag accepts `discord`, `facebook`, `github`, `google`, `linkedin`, `linkedinOpenidConnect`, `spotify`, `twitter`, and `twitterX`.

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/ally` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.
```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/ally/ally_provider')
      ]
    }
```

3. Creates `config/ally.ts` with configuration for the selected providers. Each provider is registered under a URL-friendly key (for example, `x` for `twitterX` and `linkedin` for `linkedinOpenidConnect`) and gets a default callback URL of `${APP_URL}/oauth/<key>/callback`.

4. Defines the `CLIENT_ID` and `CLIENT_SECRET` environment variables for each provider with placeholder values, and adds validation rules for them inside the `start/env.ts` file.

:::

## Configuration

Configure your OAuth providers in `config/ally.ts`. Each provider requires a client ID, client secret, and callback URL. The `declare module` block at the end of the file infers the configured providers, so `ally.use()` only accepts known provider names and returns the correct driver type.

```ts title="config/ally.ts"
import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

const allyConfig = defineConfig({
  github: services.github({
    clientId: env.get('GITHUB_CLIENT_ID'),
    clientSecret: env.get('GITHUB_CLIENT_SECRET'),
    callbackUrl: `${env.get('APP_URL')}/oauth/github/callback`,
  }),
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    callbackUrl: `${env.get('APP_URL')}/oauth/google/callback`,
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
```

Replace the placeholder values of the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (and other providers') environment variables inside the `.env` file with the credentials from the provider's developer console.

### Registering callback URLs with providers

OAuth providers require you to register your callback URL in their developer console. For example, to use GitHub authentication:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the Authorization callback URL to match your `callbackUrl` in the config

The callback URL in your config must exactly match what you register with the provider.

## Redirecting users to the provider

Create a route that redirects users to the OAuth provider. Use `ally.use()` to get the driver instance and call `redirect()`.

Before redirecting, store `redirect.previousUrl` in the session so that error handlers and `back()` calls redirect the user to the correct page in your application instead of the OAuth provider's domain.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/oauth/github/redirect', ({ ally, session }) => {
  session.put('redirect.previousUrl', '/login')
  return ally.use('github').redirect()
})
```

The `redirect()` method also works with [Inertia](../frontend/inertia.md) requests. When the redirect route is visited through an Inertia link or form, Ally performs an external redirect using `inertia.location()`, since a regular redirect to the provider's domain cannot be followed by the Inertia client.

### Requesting scopes

Scopes define what data your application can access. Each provider has different available scopes. Configure them in `config/ally.ts` or during the redirect:
```ts title="config/ally.ts"
github: services.github({
  clientId: env.get('GITHUB_CLIENT_ID'),
  clientSecret: env.get('GITHUB_CLIENT_SECRET'),
  callbackUrl: `${env.get('APP_URL')}/oauth/github/callback`,
  scopes: ['user:email', 'read:user'],
}),
```
```ts title="start/routes.ts"
router.get('/oauth/github/redirect', ({ ally }) => {
  return ally.use('github').redirect((request) => {
    request.scopes(['user:email', 'read:user'])
  })
})
```

### Adding query parameters

Some providers accept additional parameters. For example, Google's `prompt` parameter controls the consent screen behavior:
```ts title="start/routes.ts"
router.get('/oauth/google/redirect', ({ ally }) => {
  return ally.use('google').redirect((request) => {
    request.param('prompt', 'select_account')
    request.param('access_type', 'offline')
  })
})
```

To remove a parameter set in the config, use `clearParam`:
```ts title="start/routes.ts"
router.get('/oauth/google/redirect', ({ ally }) => {
  return ally.use('google').redirect((request) => {
    request.clearParam('prompt')
  })
})
```

## Handling the callback

After the user authorizes (or denies) access, the provider redirects them to your callback URL. Call `user()` on the driver to exchange the authorization code for an access token and fetch the user's profile.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/oauth/github/callback', async ({ ally }) => {
  const github = ally.use('github')
  const githubUser = await github.user()

  return githubUser
})
```

If something goes wrong during the callback (the user denied access, the state token doesn't match, or the authorization code is missing), the `user()` method throws a self-handled exception. The exception content-negotiates the response automatically:

- **HTML requests with a session**: the error message is flashed to the session and the user is redirected back. If you stored `redirect.previousUrl` in the session before the OAuth redirect, the user returns to that page.
- **JSON requests**: a JSON error response is returned with the appropriate status code.
- **JSONAPI requests**: a JSONAPI-formatted error response is returned.

When the [i18n package](../digging_deeper/i18n.md) is configured, the error messages are translated using the `errors.E_OAUTH_STATE_MISMATCH`, `errors.E_OAUTH_MISSING_CODE`, `errors.E_UNKNOWN_ALLY_PROVIDER`, and `errors.E_LOCAL_SIGNUP_DISALLOWED` keys. See the [exceptions reference](../../reference/exceptions.md#e_oauth_state_mismatch) for the full list of Ally errors.

:::note
Ally treats a missing state cookie as a state mismatch. If the callback is opened in a different browser, or the cookie has expired or was blocked, `stateMisMatch()` returns `true` and `user()` throws `E_OAUTH_STATE_MISMATCH`. This prevents attackers from completing an OAuth flow on behalf of your users by omitting the `state` parameter. Make sure your callback URL uses the same domain as the redirect route so the cookie is sent back.
:::

If you need to handle specific error cases yourself, you can still check for them before calling `user()`.

```ts title="start/routes.ts"
router.get('/oauth/github/callback', async ({ ally, response }) => {
  const github = ally.use('github')

  if (github.accessDenied()) {
    return response.redirect().toPath('/login?error=access_denied')
  }

  const githubUser = await github.user()
  return githubUser
})
```

## User properties

The `user()` method returns a normalized user object with consistent properties across all providers:

| Property | Description |
|----------|-------------|
| `id` | Unique identifier from the provider |
| `email` | User's email address (may be `null` if not requested or not available) |
| `emailVerificationState` | One of `verified`, `unverified`, or `unsupported` |
| `name` | User's display name |
| `nickName` | Username or handle (same as `name` if provider doesn't support nicknames) |
| `avatarUrl` | URL to the user's profile picture |
| `token` | Access token object for making API calls |
| `original` | Raw response from the provider |

### Email verification state

Providers handle email verification differently. Check `emailVerificationState` before trusting the email:

- `verified`: The provider has verified this email address
- `unverified`: The email exists but isn't verified
- `unsupported`: The provider doesn't share verification status

### Access token

The `token` property contains the OAuth token for making additional API calls to the provider:

| Property | Protocol | Description |
|----------|----------|-------------|
| `token` | OAuth 1 & 2 | The access token string |
| `secret` | OAuth 1 only | Token secret (used by Twitter) |
| `type` | OAuth 2 | Token type (usually `bearer`) |
| `refreshToken` | OAuth 2 | Token for obtaining new access tokens |
| `expiresAt` | OAuth 2 | DateTime when the token expires |
| `expiresIn` | OAuth 2 | Seconds until expiration |

### Original response

Access provider-specific data through the `original` property:
```ts title="start/routes.ts"
const githubUser = await github.user()
console.log(githubUser.original)
```

## Creating users and logging in

Ally provides user information but doesn't create users or sessions. After getting the user data from the provider, you need to:

1. Find or create a user in your database
2. Log them in using an auth guard

### With the session guard

For server-rendered applications, create a session after social authentication. Errors during the callback (denied access, state mismatch) are self-handled and will redirect the user back with a flash message.

```ts title="start/routes.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'

router.get('/oauth/github/callback', async ({ ally, auth, response }) => {
  const githubUser = await ally.use('github').user()

  /**
   * Find existing user or create a new one
   */
  const user = await User.firstOrCreate(
    { email: githubUser.email },
    {
      email: githubUser.email,
      fullName: githubUser.name,
      /**
       * Generate a random password since social users
       * won't use password-based login
       */
      password: crypto.randomUUID(),
    }
  )

  /**
   * Create a session for the user
   */
  await auth.use('web').login(user)

  /**
   * Redirect to the page the user was trying to access,
   * or /dashboard if no intended URL was stored
   */
  return response.redirect().toIntended('/dashboard')
})
```

### With the access tokens guard

For APIs and mobile apps, issue an access token after social authentication.

```ts title="start/routes.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'

router.get('/oauth/github/callback', async ({ ally }) => {
  const github = ally.use('github')

  if (github.accessDenied()) {
    return { error: 'access_denied' }
  }

  if (github.stateMisMatch()) {
    return { error: 'state_mismatch' }
  }

  if (github.hasError()) {
    return { error: github.getError() }
  }

  const githubUser = await github.user()

  const user = await User.firstOrCreate(
    { email: githubUser.email },
    {
      email: githubUser.email,
      fullName: githubUser.name,
      password: crypto.randomUUID(),
    }
  )

  /**
   * Create an access token for the user
   */
  const token = await User.accessTokens.create(user)

  return {
    type: 'bearer',
    value: token.value!.release(),
  }
})
```

## Disallow signups for a provider

Use the `disallowLocalSignup` option when a provider should only be used for login or account linking, but not for creating new local accounts. This can be helpful when you have historically allowed signups using a given provider but now want to limit it to login only.

```ts title="config/ally.ts"
export default defineConfig({
  github: services.github({
    clientId: env.get('GITHUB_CLIENT_ID'),
    clientSecret: env.get('GITHUB_CLIENT_SECRET'),
    callbackUrl: `${env.get('APP_URL')}/oauth/github/callback`,
    disallowLocalSignup: true,
  }),
})
```

With `disallowLocalSignup` enabled, calling `ally.use(provider, { intent: 'signup' })` will throw the `E_LOCAL_SIGNUP_DISALLOWED` exception with status code `403`. The `login` and `link` intents remain allowed.

```ts title="start/routes.ts"
router.get('/oauth/github/signup/redirect', ({ ally }) => {
  return ally.use('github', { intent: 'signup' }).redirect()
})
```

Use `ally.allowsLocalSignup()` to check the policy of a provider before rendering a signup button or starting the flow.

```ts title="start/routes.ts"
router.get('/oauth/:provider/signup/redirect', ({ ally, params, response }) => {
  if (!ally.has(params.provider) || !ally.allowsLocalSignup(params.provider)) {
    return response.redirect().toPath('/signup')
  }

  return ally.use(params.provider, { intent: 'signup' }).redirect()
})
```

## Stateless authentication

By default, Ally uses a CSRF token stored in a cookie to prevent cross-site request forgery. If your application cannot use cookies (for example, a mobile app using a webview), enable stateless mode:
```ts title="start/routes.ts"
router.get('/oauth/github/redirect', ({ ally }) => {
  return ally.use('github').stateless().redirect()
})

router.get('/oauth/github/callback', async ({ ally }) => {
  const github = ally.use('github').stateless()

  // Handle callback...
  const user = await github.user()
})
```

Both the redirect and callback must use stateless mode. Without the CSRF check, ensure your application has other protections against unauthorized OAuth flows.

## Fetching user from an existing token

If you already have an access token (for example, from a mobile app's native OAuth flow), fetch user information directly:
```ts title="start/routes.ts"
router.post('/auth/github', async ({ request, ally }) => {
  const { accessToken } = request.only(['accessToken'])

  const user = await ally.use('github').userFromToken(accessToken)

  return user
})
```

For OAuth 1 providers (Twitter), use `userFromTokenAndSecret`:
```ts title="start/routes.ts"
const user = await ally.use('twitter').userFromTokenAndSecret(token, secret)
```

## Dynamic provider selection

Handle multiple providers with a single route using route parameters. Use `ally.has()` to narrow the route parameter to a configured provider name. Calling `ally.use()` with an unknown provider throws the self-handled `E_UNKNOWN_ALLY_PROVIDER` exception with status code `404`.

```ts title="start/routes.ts"
router
  .get('/oauth/:provider/redirect', ({ ally, params }) => {
    if (!ally.has(params.provider)) {
      return 'Unknown provider'
    }

    return ally.use(params.provider).redirect()
  })
  .where('provider', /github|google|twitter/)

router
  .get('/oauth/:provider/callback', async ({ ally, params }) => {
    if (!ally.has(params.provider)) {
      return 'Unknown provider'
    }

    const driver = ally.use(params.provider)
    // Handle callback...
  })
  .where('provider', /github|google|twitter/)
```

You can also inspect configured providers at runtime:

```ts title="start/routes.ts"
router.get('/login', ({ ally }) => {
  return {
    providers: ally.configuredProviderNames(),
    signupProviders: ally.signupProviderNames(),
  }
})
```

## Provider configuration reference

Each provider accepts specific configuration options. The following examples show all available options for each built-in provider.

:::disclosure{title="GitHub"}
```ts
github: services.github({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['user', 'gist'],
  login: 'adonisjs',
  allowSignup: true,
})
```

:::

:::disclosure{title="Google"}
```ts
google: services.google({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['userinfo.email', 'calendar.events'],
  prompt: 'select_account',
  accessType: 'offline',
  hostedDomain: 'adonisjs.com',
  display: 'page',
})
```

:::

:::disclosure{title="Twitter"}
```ts
twitter: services.twitter({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
})
```

:::

:::disclosure{title="X"}
```ts
x: services.twitterX({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['tweet.read', 'users.read', 'users.email'],
})
```

:::

:::disclosure{title="Discord"}
```ts
discord: services.discord({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['identify', 'email'],
  prompt: 'consent',
  guildId: '',
  disableGuildSelect: false,
  permissions: 10,
})
```

:::

:::disclosure{title="LinkedIn (OpenID Connect)"}
```ts
linkedin: services.linkedinOpenidConnect({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['openid', 'profile', 'email'],
})
```

:::

:::disclosure{title="LinkedIn"}
```ts
linkedin: services.linkedin({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['r_emailaddress', 'r_liteprofile'],
})
```

:::

:::disclosure{title="Facebook"}
```ts
facebook: services.facebook({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['email', 'user_photos'],
  userFields: ['first_name', 'picture', 'email'],
  display: '',
  authType: '',
})
```

:::

:::disclosure{title="Spotify"}
```ts
spotify: services.spotify({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
  disallowLocalSignup: false,
  scopes: ['user-read-email', 'streaming'],
  showDialog: false,
})
```

:::

## Creating a custom driver

If you need to integrate with a provider not included in Ally, you can create a custom driver. AdonisJS provides a [starter kit](https://github.com/adonisjs-community/ally-driver-boilerplate) for building and publishing custom drivers. See the starter kit README for implementation details.
