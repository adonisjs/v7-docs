---
description: Learn how to test JSON API endpoints in AdonisJS using Japa's API client.
---

# API tests

This guide covers testing JSON API endpoints in AdonisJS applications. You will learn how to:

- Configure the API client and related plugins
- Write tests for API endpoints using route names
- Send JSON and form data with requests
- Work with cookies and sessions during tests
- Authenticate users using sessions or access tokens
- Assert Inertia page components, props, and partial reloads
- Debug requests and responses
- Assert on response status, body, headers, and more

## Overview

API testing in AdonisJS uses [Japa's API client](https://japa.dev/docs/plugins/api-client) to make real HTTP requests against your application. Unlike mocked or simulated requests, the API client boots your AdonisJS server and sends actual network requests from outside in. This approach tests your entire HTTP layer—routes, middleware, controllers, and responses—exactly as they would behave in production.

The API client integrates with AdonisJS features like sessions and authentication through dedicated plugins, making it straightforward to test protected endpoints and stateful interactions.

## Configuration

The `api` starter kit comes pre-configured with three plugins in the `tests/bootstrap.ts` file.

```ts title="tests/bootstrap.ts"
import { apiClient } from '@japa/api-client'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'
import type { Registry } from '../.adonisjs/client/registry/schema.d.ts'

declare module '@japa/api-client/types' {
  interface RoutesRegistry extends Registry {}
}

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  // [!code highlight:12]
  /**
   * Configures Japa's API client for making HTTP requests
   */
  apiClient(),
  /**
   * Adds support for reading/writing session data during requests
   */
  sessionApiClient(app),
  /**
   * Adds support for authenticating users during requests
   */
  authApiClient(app),
]
```

When using sessions during tests, the session driver must be set to `memory` in your `.env.test` file. This is configured by default in the starter kit.

```dotenv title=".env.test"
SESSION_DRIVER=memory
```

### Configuring Inertia assertions

Add the `inertiaApiClient` plugin alongside the standard API client to use Inertia request helpers and response assertions. Keep any session, authentication, Shield, and database plugins already configured by your starter kit.

```ts title="tests/bootstrap.ts"
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { inertiaApiClient } from '@adonisjs/inertia/plugins/api_client'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  apiClient(),
  inertiaApiClient(app),
]
```

## Writing your first test

Let's test an account creation endpoint that validates input and creates a new user. We'll write two tests: one for validation errors and one for successful creation.

The route is defined in `start/routes.ts`.

```ts title="start/routes.ts"
router.post('signup', [controllers.NewAccount, 'store'])
```

The first test verifies that validation errors are returned when required fields are missing. The `client.visit()` method accepts a route name and automatically determines the HTTP method and URL pattern from your route definition.

```ts title="tests/functional/auth/signup.spec.ts"
import { test } from '@japa/runner'

test.group('Auth signup', () => {
  test('return error when required fields are not provided', async ({ client }) => {
    /**
     * Make a POST request to the signup route.
     * Since no data is sent, validation should fail.
     */
    const response = await client.visit('new_account.store')

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [
        {
          field: 'fullName',
          message: 'The fullName field must be defined',
          rule: 'required',
        },
        {
          field: 'email',
          message: 'The email field must be defined',
          rule: 'required',
        },
        {
          field: 'password',
          message: 'The password field must be defined',
          rule: 'required',
        },
        {
          field: 'passwordConfirmation',
          message: 'The passwordConfirmation field must be defined',
          rule: 'required',
        },
      ],
    })
  })
})
```

The second test sends valid data and verifies the user was created. You can query the database directly in your tests to verify side effects.

```ts title="tests/functional/auth/signup.spec.ts"
import { test } from '@japa/runner'
import User from '#models/user'

test.group('Auth signup', () => {
  test('create user account', async ({ client, assert }) => {
    /**
     * Send JSON data using the fluent .json() method
     */
    const response = await client.visit('new_account.store').json({
      fullName: 'John doe',
      email: 'john@example.com',
      password: 'secret@123A',
      passwordConfirmation: 'secret@123A',
    })

    response.assertStatus(200)
    response.assertBodyContains({
      data: {
        fullName: 'John doe',
        email: 'john@example.com',
      },
    })

    /**
     * Verify the user was persisted to the database
     */
    const user = await User.findOrFail(response.body().data.id)
    assert.equal(user.email, 'john@example.com')
  })
})
```

## Cleaning up database state

Tests that create database records need cleanup between runs to ensure isolation. The `testUtils.db().truncate()` hook migrates the database and truncates all tables after each test.

See also: [Database testing utilities](./resetting_state_between_tests.md) for additional methods like migrations and seeders.

```ts title="tests/functional/auth/signup.spec.ts"
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Auth signup', (group) => {
  /**
   * Truncate tables after each test to ensure
   * a clean state for the next test
   */
  group.each.setup(() => {
    return testUtils.db().truncate()
  })

  test('create user account', async ({ client, assert }) => {
    // ...
  })
})
```

## Making requests

The API client provides two approaches for making HTTP requests: using route names or explicit HTTP methods.

### Using route names

The `client.visit()` method accepts a route name and looks up the HTTP method and URL pattern from your router. This keeps your tests in sync with route changes and also provides type-safety within tests.

```ts
const response = await client.visit('posts.store')
```

### Using HTTP methods

When you need to hit a specific URL directly, use the explicit HTTP method functions.

```ts
const response = await client.get('/api/posts')
const response = await client.post('/api/posts')
const response = await client.put('/api/posts/1')
const response = await client.patch('/api/posts/1')
const response = await client.delete('/api/posts/1')
```

## Sending request data

### JSON data

Use the `json()` method to send a JSON payload. The `Content-Type` header is set automatically.

```ts
const response = await client.visit('posts.store').json({
  title: 'Hello World',
  content: 'This is my first post',
})
```

### Form data

Use the `form()` method to send URL-encoded form data.

```ts
const response = await client.visit('posts.store').form({
  title: 'Hello World',
  content: 'This is my first post',
})
```

### Multipart data

Use the `field()` method to send multipart form fields.

```ts
const response = await client
  .visit('posts.store')
  .field('title', 'Hello World')
  .field('content', 'This is my first post')
```

## Testing Inertia responses

Chain `withInertia()` to request an Inertia response, then assert the rendered page component and its props. Use `assertInertiaProps` when the complete props object must match exactly, or `assertInertiaPropsContains` when the test only cares about a subset of page props.

```ts title="tests/functional/posts/index.spec.ts"
import { test } from '@japa/runner'

test.group('Posts index', () => {
  test('renders the posts page', async ({ client }) => {
    const response = await client.get('/posts').withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('posts/index')
    response.assertInertiaPropsContains({
      filters: { status: 'published' },
    })
  })
})
```

### Testing partial reloads

Use `withInertiaPartialReload` to request specific props from a page. Both arguments are type-checked, so a misspelled page or prop fails type-checking.

```ts title="tests/functional/posts/index.spec.ts"
import { test } from '@japa/runner'

test.group('Posts index', () => {
  test('reloads the posts prop', async ({ client }) => {
    const response = await client
      .get('/posts')
      .withInertiaPartialReload('posts/index', ['posts'])

    response.assertStatus(200)
    response.assertInertiaComponent('posts/index')
    response.assertInertiaPropsContains({
      posts: [],
    })
  })
})
```

## Cookies

You can set cookies on outgoing requests using the `withCookie()` method and its variants.

```ts
/**
 * Set a regular cookie
 */
const response = await client
  .visit('checkout.store')
  .withCookie('affiliateId', '1')

/**
 * Set an encrypted cookie (uses AdonisJS encryption)
 */
const response = await client
  .visit('checkout.store')
  .withEncryptedCookie('affiliateId', '1')

/**
 * Set a plain cookie (no signing or encryption)
 */
const response = await client
  .visit('checkout.store')
  .withPlainCookie('affiliateId', '1')
```

## Sessions

The `withSession()` method populates the session store before making a request. This is useful for testing flows that depend on existing session state.

```ts
const response = await client
  .visit('checkout.store')
  .withSession({ cartId: 1 })
```

## Authentication

### Session authentication

The `loginAs()` method authenticates a user for the request using your default auth guard. You must create the user before making the authenticated request.

```ts
test('create a post', async ({ client }) => {
  const user = await User.create({
    fullName: 'John',
    email: 'john@example.com',
    password: 'secret',
  })

  const response = await client.visit('posts.store').loginAs(user)
  response.assertStatus(200)
})
```

### Token authentication

When using access tokens or a different auth guard, chain the `withGuard()` method before `loginAs()` to specify which guard to use.

```ts
test('create a post via API', async ({ client }) => {
  const user = await User.create({
    fullName: 'John',
    email: 'john@example.com',
    password: 'secret',
  })

  /**
   * Use the 'api' guard for token-based authentication
   */
  const response = await client
    .visit('posts.store')
    .withGuard('api')
    .loginAs(user)

  response.assertStatus(200)
})
```

Make sure your route middleware allows authentication using the specified guard.

```ts title="start/routes.ts"
router
  .group(() => {
    router.post('posts', [controllers.Posts, 'store'])
  })
  .use(middleware.auth({ guards: ['web', 'api'] }))
```

## Debugging

### Dumping requests

Chain the `dump()` method when building a request to log the request details before it's sent.

```ts
const response = await client
  .visit('posts.store')
  .dump()
  .json({ title: 'Hello World' })
```

### Dumping responses

The response object provides methods to inspect what was returned.

```ts
const response = await client.visit('posts.index')

/**
 * Dump the entire response (status, headers, body)
 */
response.dump()

/**
 * Dump only the response body
 */
response.dumpBody()

/**
 * Dump only the response headers
 */
response.dumpHeaders()
```

### Checking for server errors

Use `hasFatalError()` to check if the server returned a 500-level error.

```ts
const response = await client.visit('posts.store').json(data)

if (response.hasFatalError()) {
  response.dump()
}
```

## Assertions reference

The response object provides assertion methods for validating status codes, body content, headers, cookies, and session data.

### Status and body assertions

| Method | Description |
|--------|-------------|
| `assertStatus(status)` | Assert the response status matches the expected value |
| `assertBody(body)` | Assert the response body exactly matches the expected value |
| `assertBodyContains(subset)` | Assert the response body contains the expected subset |
| `assertBodyNotContains(subset)` | Assert the response body does not contain the subset |
| `assertTextIncludes(text)` | Assert the response text includes the substring |

### Header assertions

| Method | Description |
|--------|-------------|
| `assertHeader(name, value?)` | Assert a header exists, optionally checking its value |
| `assertHeaderMissing(name)` | Assert a header does not exist |

### Cookie assertions

| Method | Description |
|--------|-------------|
| `assertCookie(name, value?)` | Assert a cookie exists, optionally checking its value |
| `assertCookieMissing(name)` | Assert a cookie does not exist |

### Redirect assertions

| Method | Description |
|--------|-------------|
| `assertRedirectsTo(pathname)` | Assert the response redirects to the given pathname |

### Session assertions

| Method | Description |
|--------|-------------|
| `assertSession(key, value?)` | Assert a session key exists, optionally checking its value |
| `assertSessionMissing(key)` | Assert a key is missing from the session store |
| `assertFlashMessage(key, value?)` | Assert a flash message exists, optionally checking its value |
| `assertFlashMissing(key)` | Assert a key is missing from flash messages |

### Validation error assertions

| Method | Description |
|--------|-------------|
| `assertHasValidationError(field)` | Assert flash messages contain validation errors for the field |
| `assertDoesNotHaveValidationError(field)` | Assert flash messages do not contain validation errors for the field |
| `assertValidationError(field, message)` | Assert a specific error message for a field |
| `assertValidationErrors(field, messages)` | Assert all error messages for a field |

### OpenAPI assertions

| Method | Description |
|--------|-------------|
| `assertAgainstApiSpec()` | Assert the response body is valid according to your OpenAPI specification |

See also: [Japa API Client documentation](https://japa.dev/docs/plugins/api-client)
