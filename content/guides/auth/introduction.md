---
description: Learn about the authentication system in AdonisJS and how to authenticate users in your application.
---

# Authentication

This guide introduces the AdonisJS authentication system. You will learn:

- How guards and providers work together to authenticate users
- Which guard to choose for your application type
- How to install and configure the auth package
- What the Initialize auth middleware does

## Overview

AdonisJS provides a robust authentication system for logging in and authenticating users across different application types, whether you're building a server-rendered application, an API for a SPA, or a backend for mobile apps.

The authentication package is built around two core concepts:

- **Guards** are end-to-end implementations of a specific authentication method. For example, the session guard authenticates users via cookies and sessions, while the access tokens guard authenticates requests using bearer tokens.
- **Providers** handle user lookup and token verification from your database. You can use the built-in Lucid provider or implement your own for custom data sources.

The security primitives of AdonisJS are designed to protect against common vulnerabilities. Passwords and tokens are properly hashed, and the implementation guards against [timing attacks](https://en.wikipedia.org/wiki/Timing_attack) and [session fixation attacks](https://owasp.org/www-community/attacks/Session_fixation).

## What the auth package does not include

The auth package focuses specifically on authenticating HTTP requests. The following features are outside its scope:

- User registration (forms, email verification, account activation)
- Account management (password recovery, email updates)
- Authorization and permissions (use [Bouncer](./authorization.md) instead)

:::tip

Looking for a complete authentication system? [AdonisJS Kit](https://plus.adonisjs.com/kit) provides full-stack components with ready-to-use flows for user registration, email verification, password recovery, profile management, and more.

:::

## Choosing an auth guard

AdonisJS ships with three built-in guards. Use the table below to determine which guard fits your application.

| Application Type | Recommended Guard | Why |
|-----------------|-------------------|-----|
| Server-rendered web app | Session | Cookies work naturally with browser requests |
| SPA on the same domain | Session | Share cookies between `api.example.com` and `example.com` |
| SPA on a different domain | Access tokens | Cross-origin requests cannot share cookies |
| Mobile app | Access tokens | Native apps cannot use cookie-based sessions |
| Third-party API access | Access tokens | Clients need long-lived tokens they can store |
| Quick prototyping | Basic auth | Simple to set up, no database tables required |

### Session guard

The session guard uses the [@adonisjs/session](../basics/session.md) package to track logged-in users. After a successful login, the user's identifier is stored in the session, and a session cookie is sent to the browser. Subsequent requests include this cookie, allowing the server to restore the user's authenticated state.

Sessions and cookies have been the standard for web authentication for decades. They work well when your client can accept and send cookies, which is the case for server-rendered applications and SPAs hosted on the same top-level domain as your API.

See also: [Session guard documentation](./session_guard.md)

### Access tokens guard

Access tokens are cryptographically secure random strings issued to users after login. The client stores the token and includes it in the `Authorization` header of subsequent requests. AdonisJS uses opaque access tokens (not JWTs) that are stored as hashes in your database for verification.

Use access tokens when your client cannot work with cookies:

- Native mobile applications
- Desktop applications
- Web applications on a different domain than your API
- Third-party integrations that need programmatic API access

The client application is responsible for storing tokens securely. Access tokens provide unrestricted access to your application on behalf of a user, so leaking them creates security risks.

See also: [Access tokens guard documentation](./access_tokens_guard.md)

### Basic auth guard

The basic auth guard implements the [HTTP authentication framework](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication). The client sends credentials as a base64-encoded string in the `Authorization` header with each request. If credentials are invalid, the browser displays a native login prompt.

Basic authentication is not recommended for production applications because credentials are sent with every request and the user experience is limited to the browser's built-in prompt. However, it can be useful during early development or for internal tools.

See also: [Basic auth guard documentation](./basic_auth_guard.md)

## Choosing a user provider

User providers handle finding users and verifying tokens during authentication. Each guard type has specific requirements for its provider.

The session guard provider finds users by their ID (stored in the session). The access tokens guard provider additionally verifies tokens against hashed values in the database. AdonisJS ships with Lucid-based providers for all built-in guards, which use your Lucid models to query the database.

## Installation

The auth package comes pre-configured with the `web` and `api` starter kits. To add it to an existing application, run one of the following commands based on your preferred guard:
```sh
# Session guard (recommended for web apps)
node ace add @adonisjs/auth --guard=session

# Access tokens guard (recommended for APIs)
node ace add @adonisjs/auth --guard=access_tokens

# Basic auth guard
node ace add @adonisjs/auth --guard=basic_auth
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/auth` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file.
```ts
    {
      providers: [
        // ...other providers
        () => import('@adonisjs/auth/auth_provider')
      ]
    }
```

3. Creates and registers the following middleware inside the `start/kernel.ts` file.
```ts
    router.use([
      () => import('@adonisjs/auth/initialize_auth_middleware')
    ])
```
```ts
    router.named({
      auth: () => import('#middleware/auth_middleware'),
      // Only registered when using the session guard
      guest: () => import('#middleware/guest_middleware')
    })
```

4. Creates the `User` model inside `app/models`.

5. Creates database migrations for the `users` table.

6. Creates additional migrations based on the selected guard (for example, `auth_access_tokens` for the access tokens guard).

:::

## The initialize auth middleware

During setup, the `@adonisjs/auth/initialize_auth_middleware` is added to your application's middleware stack. This middleware runs on every request and creates an instance of the [Authenticator](https://github.com/adonisjs/auth/blob/10.x/src/authenticator.ts) class, which it attaches to `ctx.auth`.

The initialize auth middleware does not authenticate requests or protect routes. Its only job is to set up the authenticator instance so it's available throughout the request lifecycle. To protect routes, use the [auth middleware](./session_guard.md#protecting-routes).

If your application uses Edge templates, the authenticator is also available as the `auth` variable:
```edge
@if(auth.isAuthenticated)
  <p>Hello {{ auth.user.email }}</p>
@end
```

## Creating the users table

The `add` command creates a migration for the `users` table in `database/migrations`. You can modify this file to match your application's requirements before running the migration.
```ts title="database/migrations/TIMESTAMP_create_users_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('full_name').nullable()
      table.string('email', 254).notNullable().unique()
      table.string('password').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

After modifying the migration, update the `User` model in `app/models/user.ts` to reflect any columns you've added, renamed, or removed.

## Next steps

With the auth package installed, you're ready to implement authentication in your application:

- [Verifying user credentials](./verifying_user_credentials.md): Learn how to safely verify passwords during login
- [Session guard](./session_guard.md): Implement cookie-based authentication for web applications
- [Access tokens guard](./access_tokens_guard.md): Implement token-based authentication for APIs and mobile apps
- [Social authentication](./social_authentication.md): Allow users to log in with GitHub, Google, and other providers
