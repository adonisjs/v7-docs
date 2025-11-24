---
summary: Learn how to use sessions to persist state across HTTP requests in AdonisJS applications
---

# Sessions

This guide covers installing and configuring the session package, storing and retrieving session data, working with flash messages, choosing the right storage driver for your application, and implementing custom session stores.

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

<details>
<summary>See steps performed by the add command</summary>

1. Installs the `@adonisjs/session` package using the detected package manager.

2. Registers the following service provider inside the `adonisrc.ts` file:
```ts
{
  providers: [
    // ...other providers
    () => import('@adonisjs/session/session_provider')
  ]
}
```

3. Creates the `config/session.ts` configuration file.

4. Defines the following environment variables and their validations:
```dotenv
SESSION_DRIVER=cookie
```

5. Registers the following middleware inside the `start/kernel.ts` file:
```ts
router.use([
  () => import('@adonisjs/session/session_middleware')
])
```

</details>

### Choosing a storage driver

The session driver determines where your session data is stored. Configure it using the `SESSION_DRIVER` environment variable in your `.env` file.

:::tip
Cookie-based sessions silently truncate data exceeding 4KB. Switch to Redis for production apps with larger session data.
:::

| Driver | Description | Best For |
|--------|-------------|----------|
| `cookie` | Stores data in an encrypted cookie (max ~4KB) | Simple apps, small data, no backend storage |
| `file` | Stores data in local filesystem | Development, single-server deployments |
| `redis` | Stores data in Redis database | Production, multiple servers, larger data |
| `dynamodb` | Stores data in AWS DynamoDB | AWS infrastructure, serverless apps |
| `memory` | Stores data in memory (lost on restart) | Testing only |


### Installing driver dependencies

Some drivers require additional packages:

**For Redis:**
```sh
node ace add @adonisjs/redis
```
See the [Redis guide](../database/redis.md) for setup details.

**For DynamoDB:**

```sh
npm install @aws-sdk/client-dynamodb
```

The cookie, file, and memory drivers have no additional dependencies.

### Configuration

Session configuration is stored in `config/session.ts`, which is created during installation. The file contains options for session lifetime, cookie settings, and driver-specific configuration.

You can explore these options directly in the configuration file or refer to the [session config reference](../references/session.md) for detailed documentation.

## Basic usage

Once installed, you can access the session from the HTTP context using the `session` property. The session store provides a simple key-value API for reading and writing data.

Let's build a simple shopping cart example that demonstrates the core session methods:

```ts
// title: start/routes.ts
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

You can check if a value exists in the session before trying to retrieve it:

```ts
// title: start/routes.ts
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

Sometimes you need to get a value and immediately remove it from the session. The `pull()` method combines both operations:

```ts
// title: start/routes.ts
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

Sessions provide convenient methods for incrementing and decrementing numeric values, useful for counters or tracking numeric state:

```ts
// title: start/routes.ts
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

You can retrieve all session data as an object using the `all()` method:

```ts
// title: start/routes.ts
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

To remove all data from the session store, use the `clear()` method:

```ts
// title: start/routes.ts
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

AdonisJS provides convenience methods for common notification types. Let's extend our shopping cart example to show success messages:

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import Product from '#models/product'

router.post('/cart', async ({ request, session, response }) => {
  const productId = request.input('product_id')
  const product = await Product.findOrFail(productId)
  
  const cartItems = session.get('cart', [])
  cartItems.push({ 
    id: product.id, 
    name: product.name, 
    quantity: 1 
  })
  
  session.put('cart', cartItems)
  
  /**
   * Flash a success message for the next request.
   * Available as flashMessages.get('success') in templates.
   */
  session.flashSuccess('Item added to the cart')
  
  response.redirect().back()
})
```

You can use different message types depending on the context:

```ts
// title: app/controllers/orders_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class OrdersController {
  async store({ session, response }: HttpContext) {
    // Process order...
    
    /**
     * Flash different message types based on the outcome.
     * Each type is stored under a different key.
     */
    session.flashSuccess('Order placed successfully!')
    // session.flashError('Payment failed. Please try again.')
    // session.flashWarning('Some items are out of stock.')
    // session.flashInfo('Your order will be processed within 24 hours.')
    
    return response.redirect('/orders')
  }
}
```

### Displaying flash messages

To display flash messages in your Edge templates, use the global `flashMessages` helper:

```edge
// title: resources/views/layouts/main.edge
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

@if(flashMessages.has('warning'))
  <div class="alert alert-warning">
    {{ flashMessages.get('warning') }}
  </div>
@end

@if(flashMessages.has('info'))
  <div class="alert alert-info">
    {{ flashMessages.get('info') }}
  </div>
@end
```

### Custom flash messages

For custom message types beyond the standard success/error/warning/info, use the generic `flash()` method:

```ts
// title: start/routes.ts
router.post('/newsletter/subscribe', ({ session, response }) => {
  // Subscribe user to newsletter...
  
  /**
   * Flash a custom message type.
   * Access it via flashMessages.get('newsletter') in templates.
   */
  session.flash('newsletter', 'Check your email to confirm subscription')
  
  return response.redirect().back()
})
```

### Flashing form data

When validation fails or errors occur, you can flash form data back to repopulate the form:
```ts
// title: app/controllers/posts_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ session, response }: HttpContext) {
    try {
      // Validate and save post...
    } catch (error) {
      /**
       * Flash all form data, only specific fields, or exclude sensitive fields.
       */
      session.flashAll() // All request data
      // session.flashOnly(['title', 'content']) // Only specific fields
      // session.flashExcept(['password']) // Exclude sensitive fields
      
      session.flashError('Failed to create post')
      return response.redirect().back()
    }
  }
}
```

Access flashed form data in templates using the `old()` helper:

```edge
// title: resources/views/posts/create.edge
<input type="text" name="title" value="{{ old('title') }}" />
```

:::note
Validation errors are automatically flashed when using the request validator, so you don't need to manually flash them.
:::

### Re-flashing messages

Sometimes you need to keep flash messages for an additional request. Use `reflash()` to preserve messages from the previous request:

```ts
// title: app/middleware/check_subscription_middleware.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class CheckSubscriptionMiddleware {
  async handle({ auth, session, response }: HttpContext, next: NextFn) {
    const user = auth.getUserOrFail()
    
    if (!user.hasActiveSubscription) {
      /**
       * Keep flash messages from the previous request
       * for one more request cycle.
       */
      session.reflash()
      session.flashWarning('Please subscribe to continue')
      return response.redirect('/subscribe')
    }
    
    await next()
  }
}
```

## Security considerations

### Session regeneration

:::warning
If implementing custom authentication without the Auth package, call `session.regenerate()` after login to prevent session fixation attacks.
:::

AdonisJS automatically handles session regeneration when using the official Auth package. Cookie security settings (httpOnly, secure, sameSite) and CSRF protection are also configured automatically.

```ts
// title: app/controllers/auth_controller.ts
export default class AuthController {
  async login({ session, response }: HttpContext) {
    // Verify credentials...
    
    /**
     * Generate a new session ID while preserving data.
     * Only needed if NOT using the official Auth package.
     */
    await session.regenerate()
    
    return response.redirect('/dashboard')
  }
}
```

Learn more about [session fixation attacks](https://owasp.org/www-community/attacks/Session_fixation).

## Advanced: Creating custom session stores

If none of the built-in drivers meet your needs, you can create a custom session store by implementing the `SessionStoreContract` interface. This is useful for integrating databases like MongoDB or custom storage solutions.

```ts
// title: app/session_stores/mongodb_store.ts
import { SessionStoreContract } from '@adonisjs/session/types'

export class MongoDbStore implements SessionStoreContract {
  /**
   * Read session data for a given session ID.
   * Return null if the session doesn't exist.
   */
  async read(sessionId: string): Promise<Record<string, any> | null> {
    // Implementation: Query MongoDB for session data
  }

  /**
   * Write session data for a given session ID.
   * Create a new session if it doesn't exist.
   */
  async write(sessionId: string, data: Record<string, any>): Promise<void> {
    // Implementation: Store session data in MongoDB
  }

  /**
   * Delete session data for a given session ID.
   */
  async destroy(sessionId: string): Promise<void> {
    // Implementation: Remove session from MongoDB
  }

  /**
   * Update the session's expiration time without changing data.
   */
  async touch(sessionId: string): Promise<void> {
    // Implementation: Update timestamp in MongoDB
  }
}
```

For complete implementation examples, see the [built-in session stores on GitHub](https://github.com/adonisjs/session/tree/main/src/stores). Register your custom store in `config/session.ts` - see the [session config reference](../references/session.md) for details.

## See also

- [Session config reference](../references/session.md) - Complete configuration options
- [Session API documentation](https://api.adonisjs.com/modules/_adonisjs_session) - Detailed method signatures and types
- [Redis guide](../database/redis.md) - Setting up Redis for session storage
- [Auth package](../authentication/introduction.md) - Official authentication with automatic session management