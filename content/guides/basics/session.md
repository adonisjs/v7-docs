---
description: Learn how to use sessions to persist state across HTTP requests in AdonisJS applications.
---

# Sessions

This guide covers working with HTTP sessions in AdonisJS applications. You will learn about:
- Installing and configuring the session package
- Storing and retrieving session data
- Working with flash messages
- Choosing the right storage driver
- Implementing custom session stores

## Overview

HTTP is a stateless protocol, meaning each request is independent and the server doesn't retain information between requests. Sessions solve this by providing a way to persist state across multiple HTTP requests and associate that state with a unique session identifier.

In AdonisJS, sessions are primarily used in Hypermedia and Inertia applications to maintain user authentication state and pass temporary data (flash messages) between requests. For example, after a user logs in, their authentication state is stored in the session so they remain logged in across subsequent requests. Similarly, when you redirect after a form submission, flash messages stored in the session can display success or error notifications on the next page.


:::note
If you're new to the concept of sessions, we recommend reading this [introduction to HTTP sessions](https://developer.mozilla.org/en-US/docs/Web/HTTP/Session) before continuing.
:::

## Installation

Install and configure the sessions package by running the following Ace command:
```sh
node ace add @adonisjs/session
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/session` package using the detected package manager.
2. Registers the `@adonisjs/session/session_provider` service provider inside the `adonisrc.ts` file.
3. Creates the `config/session.ts` configuration file.
4. Defines the `SESSION_DRIVER` environment variable.
5. Registers the `@adonisjs/session/session_middleware` middleware inside the `start/kernel.ts` file.
:::

## Choosing a storage driver

The session driver determines where your session data is stored. Each driver has different characteristics that make it suitable for specific use cases:

:::note
Cookie-based sessions silently truncate data exceeding 4KB. Switch to Redis for production apps with larger session data.
:::

| Driver | Description | Best For
|--------|-------------|----------|
| `cookie` | Stores data in an encrypted cookie (max ~4KB) | Simple apps, small data, no backend storage |
| `file` | Stores data in local filesystem | Development, single-server deployments |
| `redis` | Stores data in Redis database | Production, multiple servers, larger data |
| `dynamodb` | Stores data in AWS DynamoDB | AWS infrastructure, serverless apps |
| `database` | Stores data in SQL databases | Production apps using SQL, existing database infrastructure |
| `memory` | Stores data in memory (lost on restart) | Testing only

## Configuration

Session configuration is stored in `config/session.ts`, which is created during installation. Here's the default configuration:

```ts title="config/session.ts"
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'

export default defineConfig({
  age: '2 hours',
  clearWithBrowser: true,
  cookieName: 'adonis-session',

  cookie: {
    domain: '',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  },
  
  store: env.get('SESSION_DRIVER'),
  
  stores: {
    cookie: stores.cookie(),
    
    file: stores.file({
      location: app.tmpPath('sessions')
    }),
    
    redis: stores.redis({
      connection: 'main'
    }),
    
    database: stores.database({
      connection: 'postgres',
      tableName: 'sessions',
    }),
    
    dynamodb: stores.dynamodb({
      region: env.get('AWS_REGION'),
      endpoint: env.get('AWS_ENDPOINT'),
      tableName: 'sessions',
    }),
  }
})
```

::::options

:::option{name="age" type="string | number"}

Session lifetime before expiration. Accepts a string duration like `'2 hours'` or `'7 days'`, or a number in milliseconds. After this period, the session expires and data is deleted.
```ts
age: '2 hours'
// or
age: 7200000 // 2 hours in milliseconds
```

:::

:::option{name="clearWithBrowser" dataType="boolean"}

Controls session expiration behavior. When `true`, the session expiration resets on every request, keeping users logged in as long as they're active. When `false`, sessions expire at the exact age regardless of activity (absolute expiration).

For example, with `age: '2 hours'` and `clearWithBrowser: true`, a user browsing your site will stay logged in indefinitely as long as they make a request within 2 hours of their last activity.
```ts
clearWithBrowser: true
```

:::

:::option{name="cookieName" dataType="string"}

The name of the cookie that stores the session ID. Only change this if it conflicts with other cookies in your application.
```ts
cookieName: 'adonis-session'
```

:::

:::option{name="store" dataType="string"}

Determines which session driver to use. Set this using the `SESSION_DRIVER` environment variable in your `.env` file. The value must match one of the keys defined in the `stores` object.
```dotenv title=".env"
SESSION_DRIVER=cookie
```

:::

:::option{name="cookie" type="object"}

Cookie configuration object that controls how the session cookie behaves. This includes settings for domain, path, and security options. See the [Cookie configuration](#cookie-configuration) section for detailed options.

:::

:::option{name="stores" type="object"}

An object defining all available session stores. Each key represents a driver name, and the value is the store configuration. The driver specified in the `store` property must exist in this object.

:::

::::

### Cookie configuration

Sessions use cookies to store the session ID (or the entire session data for the cookie driver). Configure cookie behavior with these options:

::::options

:::option{name="cookie.domain" dataType="string"}

The domain where the cookie is valid. Leave empty to default to the current domain. Set to `'.example.com'` (with leading dot) to share cookies across subdomains like `app.example.com` and `api.example.com`.
```ts
cookie: {
  domain: '' // Current domain only
  // or
  domain: '.example.com' // All subdomains
}
```

:::

:::option{name="cookie.path" dataType="string"}

The URL path where the cookie is valid. Setting this to `'/'` makes the cookie available across your entire application.
```ts
cookie: {
  path: '/'
}
```

:::

:::option{name="cookie.httpOnly" dataType="boolean"}

When `true`, prevents JavaScript from accessing the cookie through `document.cookie`, protecting against XSS attacks where malicious scripts try to steal session IDs. Keep this `true` for security.
```ts
cookie: {
  httpOnly: true
}
```

:::

:::option{name="cookie.secure" dataType="boolean"}

When `true`, ensures cookies are only sent over HTTPS connections, preventing session hijacking on unsecured networks. Automatically enabled in production. Should be `false` in local development.
```ts
cookie: {
  secure: true // Production
  // secure: false // Development
}
```

:::

:::option{name="cookie.sameSite" dataType="'lax' | 'strict' | 'none'"}

Controls when browsers send cookies with cross-site requests, protecting against CSRF attacks.

- `'lax'`: Cookies sent on top-level navigation (clicking links). Default and recommended for most applications.
- `'strict'`: Cookies never sent on cross-site requests. Most secure but may break legitimate flows.
- `'none'`: Cookies always sent. Requires `secure: true` and rarely needed.
```ts
cookie: {
  sameSite: 'lax'
}
```

:::

::::

### Redis driver

The Redis driver stores session data in a Redis database, making it ideal for production applications with multiple servers or larger session data.

You may add the redis package using the following command. See the [Redis guide](../database/redis.md) for complete setup instructions.
```sh
node ace add @adonisjs/redis
```

::::options

:::option{name="stores.redis.connection" dataType="string"}

The name of the Redis connection to use for session storage. This connection must be configured in your `config/redis.ts` file.
```ts
stores: {
  redis: stores.redis({
    connection: 'main'
  })
}
```

:::

::::

### Database driver

The Database driver stores session data in SQL databases, ideal for production applications already using a SQL database infrastructure.

::::options

:::option{name="stores.database.connection" dataType="string"}

The name of the database connection to use for session storage. This connection must be configured in your `config/database.ts` file.
```ts
stores: {
  database: stores.database({
    connection: 'postgres'
  })
}
```

:::

:::option{name="stores.database.tableName" dataType="string"}

The name of the database table where session data will be stored. Defaults to `'sessions'`. Make sure to create the migration for the session table using the `node ace make:session-table` command.
```ts
stores: {
  database: stores.database({
    tableName: 'sessions'
  })
}
```

:::

::::

### DynamoDB driver

The DynamoDB driver stores session data in AWS DynamoDB, ideal for serverless applications and AWS infrastructure.

**Installation**: Install the AWS SDK first:
```sh
npm install @aws-sdk/client-dynamodb
```

::::options

:::option{name="stores.dynamodb.region" dataType="string"}

The AWS region where your DynamoDB table is located.
```ts
stores: {
  dynamodb: stores.dynamodb({
    region: env.get('AWS_REGION')
  })
}
```

:::

:::option{name="stores.dynamodb.endpoint" dataType="string"}

Optional custom endpoint URL for DynamoDB. Useful for local development with DynamoDB Local or when using custom endpoints.
```ts
stores: {
  dynamodb: stores.dynamodb({
    endpoint: env.get('AWS_ENDPOINT')
  })
}
```

:::

:::option{name="stores.dynamodb.tableName" dataType="string"}

The name of the DynamoDB table where session data will be stored.
```ts
stores: {
  dynamodb: stores.dynamodb({
    tableName: 'sessions'
  })
}
```

:::

::::

### File driver

The File driver stores session data in the local filesystem, suitable for development and single-server deployments.

::::options

:::option{name="stores.file.location" dataType="string"}

The directory path where session files will be stored. Defaults to `tmp/sessions` within your application root.
```ts
stores: {
  file: stores.file({
    location: app.tmpPath('sessions')
  })
}
```

:::

::::

## Basic usage

Once installed, you can access the session from the HTTP context using the `session` property. The session store provides a simple key-value API for reading and writing data.

Let's build a simple shopping cart example that demonstrates the core session methods:
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import Product from '#models/product'

/**
 * Display items in the cart.
 * Uses get() with a default value of empty array.
 */
router.get('/cart', ({ session }) => {
  const cartItems = session.get('cart', [])
  return { items: cartItems, total: cartItems.length }
})

/**
 * Add a product to the cart.
 * Demonstrates put() to store updated cart data.
 */
router.post('/cart', async ({ request, session }) => {
  const productId = request.input('product_id')
  const product = await Product.findOrFail(productId)
  
  const cartItems = session.get('cart', [])
  cartItems.push({ 
    id: product.id, 
    name: product.name, 
    quantity: 1 
  })
  
  session.put('cart', cartItems)
  return { message: 'Item added', totalItems: cartItems.length }
})

/**
 * Remove a specific item from the cart.
 * Shows how to update and store modified data.
 */
router.delete('/cart/:productId', ({ params, session }) => {
  const cartItems = session.get('cart', [])
  const updatedCart = cartItems.filter(item => item.id !== params.productId)
  
  session.put('cart', updatedCart)
  return { message: 'Item removed' }
})

/**
 * Clear the entire cart.
 * Uses forget() to remove a specific key.
 */
router.delete('/cart', ({ session }) => {
  session.forget('cart')
  return { message: 'Cart cleared' }
})
```

### Checking for values

You can check if a value exists in the session before trying to retrieve it.
```ts title="start/routes.ts"
router.get('/checkout', ({ session, response }) => {
  /**
   * Check if cart exists and has items before proceeding.
   * The has() method returns true if the key exists.
   */
  if (!session.has('cart')) {
    return response.redirect('/cart')
  }
  
  const cartItems = session.get('cart')
  return { items: cartItems }
})
```

### Retrieving and removing values

Sometimes you need to get a value and immediately remove it from the session. The `pull()` method combines both operations.
```ts title="start/routes.ts"
router.post('/process-payment', ({ session }) => {
  /**
   * Get the cart data and remove it in one operation.
   * This is useful when processing one-time data.
   */
  const cartItems = session.pull('cart', [])
  
  // Process payment with cartItems
  // Cart is now automatically removed from session
  
  return { processed: cartItems.length }
})
```

### Working with numeric values

Sessions provide convenient methods for incrementing and decrementing numeric values, useful for counters or tracking numeric state.
```ts title="start/routes.ts"
router.post('/visit', ({ session }) => {
  /**
   * Increment visit counter by 1.
   * If 'visits' doesn't exist, it's initialized to 1.
   */
  session.increment('visits')
  
  const totalVisits = session.get('visits')
  return { visits: totalVisits }
})

router.post('/undo', ({ session }) => {
  /**
   * Decrement a counter.
   * If 'actions' doesn't exist, it's initialized to -1.
   */
  session.decrement('actions')
  
  return { actionsRemaining: session.get('actions', 0) }
})
```

### Retrieving all session data

You can retrieve all session data as an object using the `all()` method.
```ts title="start/routes.ts"
router.get('/debug/session', ({ session }) => {
  /**
   * Returns all session data as an object.
   * Useful for debugging or displaying session state.
   */
  const allData = session.all()
  return allData
})
```

### Clearing the entire session

To remove all data from the session store, use the `clear()` method.
```ts title="start/routes.ts"
router.post('/logout', ({ session, auth, response }) => {
  // Clear authentication
  await auth.logout()
  
  /**
   * Remove all session data.
   * This is useful during logout to clean up all user state.
   */
  session.clear()
  
  return response.redirect('/login')
})
```

## Flash messages

Flash messages are temporary data stored in the session and available only for the next HTTP request. They're automatically deleted after being accessed once, making them perfect for displaying one-time notifications after redirects.

### Basic flash messages

Use the `flashMessages.flash()` method to store a message for the next request. The first parameter is the message type (a convention for categorizing messages), and the second is the message content.
```ts title="start/routes.ts"
router.post('/cart', async ({ session, response }) => {
  // Add item to cart...
  
  /**
   * Flash a success message for the next request.
   * Available via flashMessages.get('success') in templates.
   */
  session.flashMessages.flash('success', 'Item added to the cart')
  
  return response.redirect().back()
})
```

AdonisJS uses `success` and `error` as standard message type conventions. While you can use any string as a message type, these conventions help organize different kinds of notifications.
```ts title="app/controllers/orders_controller.ts"
export default class OrdersController {
  async store({ session, response }: HttpContext) {
    try {
      // Process order...
      session.flashMessages.flash('success', 'Order placed successfully!')
      return response.redirect('/orders')
    } catch (error) {
      session.flashMessages.flash('error', 'Payment failed. Please try again.')
      return response.redirect().back()
    }
  }
}
```

### Displaying flash messages

If you're using the Hypermedia or Inertia starter kits, flash messages are already displayed automatically in the layout files. The starter kits check for `success` and `error` messages and render them with appropriate styling.

For custom layouts or applications, display flash messages in your Edge templates using the global `flashMessages` helper.
```edge title="resources/views/layouts/main.edge"
@if(flashMessages.has('success'))
  <div class="alert alert-success">
    {{ flashMessages.get('success') }}
  </div>
@end

@if(flashMessages.has('error'))
  <div class="alert alert-error">
    {{ flashMessages.get('error') }}
  </div>
@end
```

### Custom flash messages

Beyond the standard message types, you can create custom message types for specific use cases.
```ts title="start/routes.ts"
router.post('/newsletter/subscribe', ({ session, response }) => {
  // Subscribe user...
  
  session.flashMessages.flash('newsletter', 'Check your email to confirm subscription')
  return response.redirect().back()
})
```

Display custom messages in your templates.
```edge
@if(flashMessages.has('newsletter'))
  <div class="alert alert-newsletter">
    {{ flashMessages.get('newsletter') }}
  </div>
@end
```

### Flashing form data

When an error occurs during form processing and you need to redirect the user back to the form, you can flash the submitted form data to pre-fill the form fields.
```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async store({ request, session, response }: HttpContext) {
    try {
      // Attempt to create post...
      throw new Error('Unable to publish post')
    } catch (error) {
      /**
       * Flash form data to repopulate the form.
       * Users won't have to re-enter their data.
       */
      session.flashAll()
      session.flashMessages.flash('error', 'Failed to create post. Please try again.')
      
      return response.redirect().back()
    }
  }
}
```

You can also flash only specific fields or exclude sensitive fields.
```ts
// Flash only specific fields
session.flashOnly(['title', 'content', 'category'])

// Flash everything except sensitive fields
session.flashExcept(['password', 'credit_card'])
```

Access flashed form data in templates using the `old()` helper.
```edge title="resources/views/posts/create.edge"
<input type="text" name="title" value="{{ old('title') }}" />
<textarea name="content">{{ old('content') }}</textarea>
```

:::note
When using AdonisJS validators, validation errors and form data are automatically flashed on validation failure. You don't need to manually flash them.
:::

### Re-flashing messages

Sometimes you need to keep flash messages for an additional request. Use `reflash()` to preserve all messages from the previous request for one more cycle.

```ts title="app/middleware/check_subscription_middleware.ts"
export default class CheckSubscriptionMiddleware {
  async handle({ auth, session, response }: HttpContext, next: NextFn) {
    const user = auth.getUserOrFail()
    
    if (!user.hasActiveSubscription) {
      /**
       * Keep all flash messages for one more request.
       */
      session.reflash()
      session.flashMessages.flash('error', 'Please subscribe to continue')
      
      return response.redirect('/subscribe')
    }
    
    await next()
  }
}
```

You can also selectively re-flash only specific message types.
```ts
// Re-flash only error messages
session.reflashOnly(['error'])

// Re-flash all messages except success
session.reflashExcept(['success'])
```

## Session regeneration

Session regeneration creates a new session ID while preserving all existing session data. This is a critical security measure to prevent [session fixation attacks](https://owasp.org/www-community/attacks/Session_fixation), where an attacker tricks a user into using a session ID controlled by the attacker.

When a user logs in, their authentication state changes from unauthenticated to authenticated. If the same session ID is kept, an attacker who knew the session ID before login could hijack the authenticated session. Regenerating the session ID after login prevents this attack.

AdonisJS automatically handles session regeneration when using the official Auth package. However, if you're implementing custom authentication, you must manually call `session.regenerate()` after successful login.
```ts title="app/controllers/auth_controller.ts"
export default class AuthController {
  async login({ request, session, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    
    // Verify credentials...
    const user = await User.verifyCredentials(email, password)
    
    /**
     * Generate a new session ID while preserving data.
     * This prevents session fixation attacks.
     */
    await session.regenerate()
    
    // Store user info in the new session
    session.put('user_id', user.id)
    
    return response.redirect('/dashboard')
  }
}
```

## Creating custom session stores

If none of the built-in drivers meet your needs, you can create a custom session store by implementing the `SessionStoreContract` interface. This is useful for integrating databases like MongoDB or custom storage solutions.

### Implementing the store contract

Create a class that implements the four required methods.
```ts title="app/session_stores/mongodb_store.ts"
import {
  SessionData,
  SessionStoreFactory,
  SessionStoreContract,
} from '@adonisjs/session/types'

/**
 * The config you want to accept
 */
export type MongoDBConfig = {
  collection: string;
  database: string
}

/**
 * The MongoDbStore class handles the actual storage operations.
 * It implements the four required methods: read, write, destroy, and touch.
 */
export class MongoDbStore implements SessionStoreContract {
  constructor(protected config: MongoDBConfig) {}

  /**
   * Read session data for a given session ID.
   * Return null if the session doesn't exist.
   */
  async read(sessionId: string): Promise<SessionData | null> {
    // Query your storage and return session data
  }

  /**
   * Write session data for a given session ID.
   */
  async write(
    sessionId: string,
    data: SessionData,
    expiresAt: Date
  ): Promise<void> {
    // Save session data to your storage
  }

  /**
   * Delete session data for a given session ID.
   */
  async destroy(sessionId: string): Promise<void> {
    // Remove session from your storage
  }

  /**
   * Update the session's expiration time without changing data.
   */
  async touch(sessionId: string, expiresAt: Date): Promise<void> {
    // Update expiration timestamp in your storage
  }
}

/**
 * The factory function accepts configuration and returns a driver
 * function. The driver function creates a new instance of the store
 * class when called by the session manager.
 */
export function mongoDbStore(config: MongoDbConfig): SessionStoreFactory {
  return (ctx, sessionConfig) => {
    return new MongoDBStore(config)
  }
}
```

### Registering your custom store

Register your custom store in `config/session.ts` using the factory function.
```ts title="config/session.ts"
import { defineConfig } from '@adonisjs/session'
import { mongoDbStore } from '#session_stores/mongodb_store'

export default defineConfig({
  store: env.get('SESSION_DRIVER'),
  
  stores: {
    mongodb: mongoDbStore({
      collection: 'sessions',
      database: 'myapp'
    })
  }
})
```

Set your environment variable to use the custom store.

```dotenv title=".env"
SESSION_DRIVER=mongodb
```

For complete implementation examples, see the [built-in session stores on GitHub](https://github.com/adonisjs/session/tree/8.x/src/stores).
