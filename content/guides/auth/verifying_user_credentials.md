---
description: Learn how to securely verify user credentials in an AdonisJS application using the AuthFinder mixin.
---

# Verifying user credentials

This guide covers secure credential verification in AdonisJS. You will learn:

- Why naive password verification is vulnerable to timing attacks
- How to use the AuthFinder mixin for secure credential verification
- How password hashing is handled automatically
- How to handle verification errors
- How to confirm the current password before sensitive changes

## Overview

Before a user can be logged in or issued an access token, you need to verify their credentials. This typically means finding a user by their email (or username) and comparing the provided password against the stored hash.

AdonisJS provides the AuthFinder mixin to handle this securely. The mixin adds a `verifyCredentials` method to your User model that protects against timing attacks while providing a clean API for credential verification.

## Why secure verification matters

A naive approach to credential verification might look like this:
```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    /**
     * Find user by email
     */
    const user = await User.findBy('email', email)
    if (!user) {
      return response.abort('Invalid credentials')
    }

    /**
     * Verify password
     */
    const isPasswordValid = await hash.verify(user.password, password)
    if (!isPasswordValid) {
      return response.abort('Invalid credentials')
    }

    // Login user...
  }
}
```

This code is vulnerable to [timing attacks](https://en.wikipedia.org/wiki/Timing_attack). An attacker can measure response times to determine whether an email exists in your database:

- When the email doesn't exist, the response returns quickly because no password hashing occurs.
- When the email exists but the password is wrong, the response takes longer because password hashing algorithms are intentionally slow.

This timing difference is enough for attackers to enumerate valid email addresses, which they can then target with password attacks.

## Using the AuthFinder mixin

The AuthFinder mixin solves the timing attack problem by always performing a password hash comparison, even when the user doesn't exist. This ensures consistent response times regardless of whether the email is valid.

To use the mixin, apply it to your User model. The `add` command and the starter kits generate the following model, where `UserSchema` is the [schema class](../database/lucid.md#auto-generated-schema-classes) generated from your `users` table.

```ts title="app/models/user.ts"
import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {}
```

The `withAuthFinder` method accepts the hash manager as its first argument and uses the default hasher from `config/hash.ts` to hash and verify passwords. To pin a specific hasher configured in `config/hash.ts`, pass a callback that returns it instead.

The second argument is an optional configuration object. Pass it when users log in with something other than their email, or when the password is stored under a different property.

```ts title="app/models/user.ts"
import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email', 'username'],
  passwordColumnName: 'password',
})

export default class User extends compose(UserSchema, AuthFinder) {}
```

::::options

:::option{name="uids"}
An array of model properties that can identify a user. If your application allows login by username or phone number, include those fields here. Defaults to `['email']`.
:::

:::option{name="passwordColumnName"}
The model property that stores the hashed password. Defaults to `password`.
:::

::::

### Verifying credentials

With the mixin applied, use the `verifyCredentials` static method to verify credentials:
```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)

    // Login user...
  }
}
```

The `verifyCredentials` method finds the user by the provided UID (email in this case), verifies the password, and returns the user instance. If the credentials are invalid, it throws an `E_INVALID_CREDENTIALS` exception.

## Handling verification errors

When credentials are invalid, `verifyCredentials` throws the [E_INVALID_CREDENTIALS](../../reference/exceptions.md#e_invalid_credentials) exception. This exception is self-handling and converts to an appropriate HTTP response based on content negotiation:

- Requests with `Accept: application/json` receive an array of error objects with a `message` property.
- Requests with `Accept: application/vnd.api+json` receive errors formatted per the JSON API specification.
- Requests using sessions are redirected back with errors available via [flash messages](../basics/session.md#flash-messages).
- All other requests receive a plain text error response.

To customize error handling, catch the exception in your [global exception handler](../basics/exception_handling.md):
```ts title="app/exceptions/handler.ts"
import { errors } from '@adonisjs/auth'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof errors.E_INVALID_CREDENTIALS) {
      return ctx.response
        .status(error.status)
        .send(error.getResponseMessage(error, ctx))
    }

    return super.handle(error, ctx)
  }
}
```

## Automatic password hashing

The AuthFinder mixin registers a [beforeSave hook](https://github.com/adonisjs/auth/blob/10.x/src/mixins/lucid.ts#L88-L95) that automatically hashes passwords when creating or updating users. You don't need to manually hash passwords in your models or controllers:
```ts title="app/controllers/users_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async store({ request }: HttpContext) {
    const data = request.only(['email', 'password', 'fullName'])
    
    /**
     * Password is automatically hashed before saving
     */
    const user = await User.create(data)
    
    return user
  }
}
```

The hook only hashes the password when the `password` property has changed, so updating other user fields won't trigger unnecessary rehashing.

## Confirming the current password

Sensitive actions, such as changing the password or the email address, should ask the logged-in user to confirm their current password. Use the `user.validatePassword` method for this. It verifies the plain password against the stored hash and throws a validation error when they do not match.

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'

export const updatePasswordValidator = vine.create({
  currentPassword: vine.string(),
  password: vine.string().minLength(8).confirmed(),
})
```

```ts title="app/controllers/password_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import { updatePasswordValidator } from '#validators/user'

export default class PasswordController {
  async update({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, password } = await request.validateUsing(updatePasswordValidator)

    /**
     * Throws a validation error for the "currentPassword"
     * field when the password is incorrect
     */
    await user.validatePassword(currentPassword)

    /**
     * The beforeSave hook hashes the new password
     */
    user.password = password
    await user.save()

    return response.redirect().back()
  }
}
```

The error has the same shape as a VineJS validation error (`E_VALIDATION_ERROR` with a `422` status), so the exception handler renders it like any other validation failure. Server-rendered forms receive the message in the flashed validation errors, Inertia forms receive it through the `errors` prop, and JSON clients receive it in the `errors` array.

The error is reported for the `currentPassword` field by default. Pass the field name as the second argument when your form uses a different name.

```ts title="app/controllers/password_controller.ts"
await user.validatePassword(oldPassword, 'oldPassword')
```

If you only need a boolean, use `user.verifyPassword(plainPassword)` instead. It returns `true` or `false` without throwing.
