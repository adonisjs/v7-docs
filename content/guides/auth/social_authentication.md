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

Social authentication allows users to log in using their existing accounts from services like GitHub, Google, or Twitter. Instead of creating a new username and password, users authorize your application to access their profile information from the provider.

AdonisJS provides the `@adonisjs/ally` package for social authentication. Ally handles the OAuth flow (redirecting users, exchanging codes for tokens, fetching user data) and provides a consistent API across different providers. It supports OAuth 1.0 (Twitter) and OAuth 2.0 (most other providers).

Ally does not store users or tokens in your database. It handles the OAuth flow and returns user information, which you then use to create or find a user in your database and log them in using an [auth guard](./introduction.md).

## Installation

Install and configure the package using the `add` command:
```sh
node ace add @adonisjs/ally

# Specify providers during installation
node ace add @adonisjs/ally --providers=github --providers=google
```

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

3. Creates `config/ally.ts` with configuration for the selected providers.

4. Defines environment variables for `CLIENT_ID` and `CLIENT_SECRET` for each provider.

:::

## Configuration

Configure your OAuth providers in `config/ally.ts`. Each provider requires a client ID, client secret, and callback URL:
```ts title="config/ally.ts"
import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

export default defineConfig({
  github: services.github({
    clientId: env.get('GITHUB_CLIENT_ID'),
    clientSecret: env.get('GITHUB_CLIENT_SECRET'),
    callbackUrl: 'http://localhost:3333/github/callback',
  }),
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    callbackUrl: 'http://localhost:3333/google/callback',
  }),
})
```

### Registering callback URLs with providers

OAuth providers require you to register your callback URL in their developer console. For example, to use GitHub authentication:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set the Authorization callback URL to match your `callbackUrl` in the config

The callback URL in your config must exactly match what you register with the provider.

## Redirecting users to the provider

Create a route that redirects users to the OAuth provider. Use `ally.use()` to get the driver instance and call `redirect()`:
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/github/redirect', ({ ally }) => {
  return ally.use('github').redirect()
})
```

### Requesting scopes

Scopes define what data your application can access. Each provider has different available scopes. Configure them in `config/ally.ts` or during the redirect:
```ts title="config/ally.ts"
github: services.github({
  clientId: env.get('GITHUB_CLIENT_ID'),
  clientSecret: env.get('GITHUB_CLIENT_SECRET'),
  callbackUrl: 'http://localhost:3333/github/callback',
  scopes: ['user:email', 'read:user'],
}),
```
```ts title="start/routes.ts"
router.get('/github/redirect', ({ ally }) => {
  return ally.use('github').redirect((request) => {
    request.scopes(['user:email', 'read:user'])
  })
})
```

### Adding query parameters

Some providers accept additional parameters. For example, Google's `prompt` parameter controls the consent screen behavior:
```ts title="start/routes.ts"
router.get('/google/redirect', ({ ally }) => {
  return ally.use('google').redirect((request) => {
    request.param('prompt', 'select_account')
    request.param('access_type', 'offline')
  })
})
```

To remove a parameter set in the config, use `clearParam`:
```ts title="start/routes.ts"
router.get('/google/redirect', ({ ally }) => {
  return ally.use('google').redirect((request) => {
    request.clearParam('prompt')
  })
})
```

## Handling the callback

After the user authorizes (or denies) access, the provider redirects them to your callback URL. Handle this redirect to complete authentication:
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

router.get('/github/callback', async ({ ally, response }) => {
  const github = ally.use('github')

  /**
   * User cancelled the authentication flow
   */
  if (github.accessDenied()) {
    return 'Access denied. You cancelled the login process.'
  }

  /**
   * OAuth state verification failed (possible CSRF attack)
   */
  if (github.stateMisMatch()) {
    return 'State mismatch. Request may have been tampered with.'
  }

  /**
   * Provider returned an error
   */
  if (github.hasError()) {
    return github.getError()
  }

  /**
   * Get the authenticated user's information
   */
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

For server-rendered applications, create a session after social authentication:
```ts title="start/routes.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'

router.get('/github/callback', async ({ ally, auth, response }) => {
  const github = ally.use('github')

  if (github.accessDenied()) {
    return response.redirect('/login?error=access_denied')
  }

  if (github.stateMisMatch()) {
    return response.redirect('/login?error=state_mismatch')
  }

  if (github.hasError()) {
    return response.redirect(`/login?error=${github.getError()}`)
  }

  const githubUser = await github.user()

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

  return response.redirect('/dashboard')
})
```

### With the access tokens guard

For APIs and mobile apps, issue an access token after social authentication:
```ts title="start/routes.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'

router.get('/github/callback', async ({ ally }) => {
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

## Stateless authentication

By default, Ally uses a CSRF token stored in a cookie to prevent cross-site request forgery. If your application cannot use cookies (for example, a mobile app using a webview), enable stateless mode:
```ts title="start/routes.ts"
router.get('/github/redirect', ({ ally }) => {
  return ally.use('github').stateless().redirect()
})

router.get('/github/callback', async ({ ally }) => {
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

Handle multiple providers with a single route using route parameters:
```ts title="start/routes.ts"
router
  .get('/:provider/redirect', ({ ally, params }) => {
    return ally.use(params.provider).redirect()
  })
  .where('provider', /github|google|twitter/)

router
  .get('/:provider/callback', async ({ ally, params }) => {
    const driver = ally.use(params.provider)
    // Handle callback...
  })
  .where('provider', /github|google|twitter/)
```

## Provider configuration reference

Each provider accepts specific configuration options. The following examples show all available options for each built-in provider.

:::disclosure{title="GitHub"}
```ts
github: services.github({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
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
})
```

:::

:::disclosure{title="Discord"}
```ts
discord: services.discord({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
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
  scopes: ['openid', 'profile', 'email'],
})
```

:::

:::disclosure{title="Facebook"}
```ts
facebook: services.facebook({
  clientId: '',
  clientSecret: '',
  callbackUrl: '',
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
  scopes: ['user-read-email', 'streaming'],
  showDialog: false,
})
```

:::

## Creating a custom driver

If you need to integrate with a provider not included in Ally, you can create a custom driver. AdonisJS provides a [boilerplate](https://github.com/adonisjs-community/ally-driver-boilerplate) for building and publishing custom drivers. See the boilerplate README for implementation details.
