---
description: Learn how dependency injection works in AdonisJS and how to use the IoC container to manage class dependencies automatically.
---

# Dependency injection and the IoC container

This guide covers dependency injection and the IoC container in AdonisJS. You will learn:

- How to use the `@inject` decorator for automatic dependency resolution
- The difference between constructor and method injection
- When and how to use the IoC container manually
- How to register bindings and singletons for complex dependencies
- How to select bindings at resolution time using conditional bindings
- How to implement the adapter pattern using abstract classes
- How to swap dependencies during testing

## Overview

Dependency injection is a design pattern that eliminates the need to manually create and manage class dependencies. Instead of creating dependencies inside a class, you declare them as constructor parameters or method parameters, and the IoC container resolves them automatically.

AdonisJS includes a powerful IoC (Inversion of Control) container that handles dependency injection throughout your application. When you type-hint a class as a dependency, the container automatically creates an instance of that class and injects it where needed.

The IoC container is already integrated into core parts of AdonisJS including [controllers](../basics/controllers.md), [middleware](../basics/middleware.md), [event listeners](../digging_deeper/emitter.md), and [Ace commands](../ace/introduction.md). This means you can type-hint dependencies in these classes and they'll be resolved automatically when the framework constructs them.

:::note
AdonisJS uses TypeScript's `experimentalDecorators` and `emitDecoratorMetadata` compiler options to enable dependency injection. These are pre-configured in the `tsconfig.json` file of new AdonisJS projects.
:::

## Your first dependency injection

Let's start with a practical example. We'll create an `AvatarService` that generates Gravatar URLs for users, then inject it into a controller.

::::steps

:::step{title="Create the service"}

First, create a service class that will be injected. This service generates Gravatar avatar URLs based on user email addresses.

```ts title="app/services/avatar_service.ts"
import User from '#models/user'
import { createHash } from 'node:crypto'

export class AvatarService {
  protected getGravatarAvatar(user: User) {
    const emailHash = createHash('md5').update(user.email).digest('hex')
    const url = new URL(emailHash, 'https://gravatar.com/avatar/')

    url.searchParams.set('size', '200')
    return url.toString()
  }

  getAvatarFor(user: User) {
    return this.getGravatarAvatar(user)
  }
}
```

:::

:::step{title="Inject the service into a controller"}

Next, create a controller that uses the `AvatarService`. The `@inject()` decorator tells the container to automatically resolve and inject the service.
```ts title="app/controllers/users_controller.ts"
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { AvatarService } from '#services/avatar_service'
import User from '#models/user'

// [!code highlight]
@inject()
export default class UsersController {
  /**
   * The AvatarService is automatically injected by the container
   * when this controller is constructed
   */
  // [!code highlight]
  constructor(protected avatarService: AvatarService) {}

  async store({ request }: HttpContext) {
    /**
     * Create a new user (simplified for demonstration)
     */
    const user = await User.create(request.only(['email', 'username']))
    
    /**
     * Use the injected service to generate and save the avatar URL
     */
    // [!code highlight]
    const avatarUrl = this.avatarService.getAvatarFor(user)
    user.avatarUrl = avatarUrl
    await user.save()
    
    return user
  }
}
```

:::

:::step{title="Register the route"}

Finally, connect your controller to a route. When you visit this endpoint, AdonisJS automatically constructs the controller using the container.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.post('/users', [controllers.Users, 'store'])
```

The `@inject()` decorator is required on the controller class. Without it, the container won't know to resolve dependencies. The decorator uses TypeScript's reflection capabilities to detect constructor dependencies at runtime.

:::
::::

## Method injection

Method injection works similarly to constructor injection, but instead of resolving dependencies for the entire class, the container resolves dependencies for a specific method. This is useful when only one method needs a particular dependency, or when you want to keep the class constructor simple.

The `@inject()` decorator must be placed before the method when using method injection.
```ts title="app/controllers/users_controller.ts"
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { AvatarService } from '#services/avatar_service'
import User from '#models/user'

export default class UsersController {
  /**
   * The @inject decorator on the method tells the container
   * to resolve the avatarService parameter automatically
   */
  // [!code highlight:2]
  @inject()
  async store({ request }: HttpContext, avatarService: AvatarService) {
    const user = await User.create(request.only(['email', 'username']))
    
    /**
     * Use the injected service directly as a method parameter
     */
    // [!code highlight]
    const avatarUrl = avatarService.getAvatarFor(user)
    user.avatarUrl = avatarUrl
    await user.save()
    
    return user
  }
}
```

Notice that `HttpContext` is always the first parameter for controller methods, followed by any dependencies you want to inject. The container automatically distinguishes between the HTTP context and injectable dependencies.

## What can be injected?

You can type-hint and inject only classes inside other classes. Since TypeScript types and interfaces are removed at compile time and are not visible to the runtime code, there is no way for the container to resolve them.

If a class has other dependencies like configuration objects that cannot be auto-resolved, you must register the class as a binding within the container. We'll cover bindings [later in this guide](#bindings).

### The import type pitfall

A common issue that causes dependency injection to fail silently is when classes are accidentally imported using TypeScript's `import type` syntax. This happens frequently because code editors with auto-import features often default to importing classes as types.

When you use `import type`, TypeScript strips the import entirely during compilation. The container has no class constructor to resolve at runtime, so your dependency becomes `undefined`.

```ts title="❌ Wrong: Imported as a type"
import { inject } from '@adonisjs/core'
// [!code highlight]
import type { AvatarService } from '#services/avatar_service'

@inject()
export default class UsersController {
  constructor(protected avatarService: AvatarService) {}
}
```

```ts title="✅ Correct: Imported as a value"
import { inject } from '@adonisjs/core'
// [!code highlight]
import { AvatarService } from '#services/avatar_service'

@inject()
export default class UsersController {
  constructor(protected avatarService: AvatarService) {}
}
```

## Which classes support dependency injection

The following classes are automatically constructed by the container, allowing you to use constructor injection and, in some cases, method injection.

| Class Type | Constructor Injection | Method Injection |
|---|---|---|
| Controllers | ✅ | ✅ |
| Middleware | ✅ | ❌ |
| Event listeners | ✅ | ✅ (only `handle` method) |
| Bouncer policies | ✅ | ❌ |
| Transformers | ❌ | ✅ |
| Ace commands | ❌ | ✅ (only lifecycle methods) |

For any other classes you create, you'll need to use the container manually to construct them, which we'll cover in the next section.

## Using the container manually

While AdonisJS automatically constructs controllers, middleware, and other framework classes using the container, you may need to manually construct your own classes in certain scenarios. For example, if you're implementing a queue system and want each job class to benefit from dependency injection, you'll need to use the container's API directly.

### Constructing classes with container.make

The `container.make` method accepts a class constructor and returns an instance of it, automatically resolving all constructor dependencies marked with `@inject()`.

Let's demonstrate this with a queue job scenario. We'll create two services:

- A `LoggerService` for logging and a `UserService` that depends on it.
- Then we'll use the container manually within a queue job to construct the `UserService`, which will automatically resolve its `LoggerService` dependency.

The container instance is available throughout your AdonisJS application via the `app` service.

::::tabs

:::tab{title="Services"}
```ts
import { inject } from '@adonisjs/core'

class LoggerService {
  log(message: string) {
    console.log(message)
  }
}

@inject()
export class UserService {
  constructor(protected logger: LoggerService) {}
  
  createUser(data: any) {
    this.logger.log('Creating user...')
  }
}
```
:::

:::tab{title="Queue job"}
```ts
import app from '@adonisjs/core/services/app'
import { UserService } from '#services/user_service'

export default class ProcessUserJob {
  async handle(userData: any) {
    /**
     * Manually construct UserService using the container.
     * Its LoggerService dependency is automatically resolved.
     */
    const userService = await app.container.make(UserService)    
    await userService.createUser(userData)
  }
}
```

:::
::::

The container recursively resolves the entire dependency tree. If `UserService` had dependencies, and those dependencies had their own dependencies, the container would resolve them all automatically.

### Calling methods with container.call

You can perform method injection on any class method using the `container.call` method. This is useful when you want dependencies injected into a specific method rather than the entire class.

The `container.call` method accepts the class instance, the method name, and an array of runtime values. Runtime values are passed as the initial parameters, followed by any auto-resolved dependencies.

::::tabs

:::tab{title="Services"}
```ts
import { inject } from '@adonisjs/core'

class EmailService {
  send(to: string, message: string) {
    console.log(`Sending email to ${to}`)
  }
}

export class NotificationService {
  @inject()
  notify(userId: string, message: string, emailService: EmailService) {
    emailService.send(`user-${userId}@example.com`, message)
  }
}
```
:::

:::tab{title="Usage"}
```ts
import app from '@adonisjs/core/services/app'
import { NotificationService } from '#services/notification_service'

/**
 * Create the service instance
 */
const notificationService = await app.container.make(NotificationService)

/**
 * Call the method using the container.
 *
 * The EmailService is automatically resolved and injected.
 * The first two arguments are runtime values we provide.
 */
await app.container.call(
  notificationService,
  'notify',
  ['user-123', 'Welcome to our platform!']
)
```

:::
::::

## Bindings

Bindings are the mechanism you use when classes require dependencies that cannot be auto-resolved with the `@inject()` decorator. For example, when a class needs a configuration object or a primitive value alongside its class dependencies.

When a binding exists for a class, the container disables its auto-resolution logic and uses your factory function to create instances instead.

### Creating a binding

Bindings must be registered in the `register` method of a [Service Provider](./service_providers.md). You can create a new provider using the `node ace make:provider` command.

::::steps

:::step{title="Define the class that needs custom construction"}

Let's create a `Cache` class that requires both a `RedisConnection` and a configuration object. Since we're registering this class as a binding, there's no need to use the `@inject` decorator. The container will use our factory function instead.
```ts title="app/services/cache.ts"
import type { RedisConnection } from '@adonisjs/redis'

export type CacheConfig = {
  ttl: string | number
  grace: boolean
}

export class Cache {
  constructor(
    public store: RedisConnection,
    public config: CacheConfig
  ) {}
  
  async get(key: string) {
    // Cache implementation
  }
  
  async set(key: string, value: any) {
    // Cache implementation
  }
}
```
:::

:::step{title="Register the binding in a provider"}

Create a provider and register the binding in its `register` method. The factory function receives a resolver that can create instances of other classes.
```ts title="providers/cache_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import redis from '@adonisjs/redis/services/main'
import { Cache } from '#services/cache'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}
  
  register() {
    this.app.container.bind(Cache, async (resolver) => {
      /**
       * Resolve redis dependency from the container
       */
      const redis = await resolver.make('redis')
      const store = redis.connection()
      
      /**
       * Get configuration from the app config
       */
      const config = this.app.config.get<CacheConfig>('cache')

      /**
       * Manually construct and return the Cache instance
       * with all its dependencies
       */
      return new Cache(store, config)
    })
  }
}
```
:::

:::step{title="Use the binding"}

The container uses your factory function from the binding instead of trying to auto-resolve dependencies.
```ts
import app from '@adonisjs/core/services/app'
import { Cache } from '#services/cache'

const cache = await app.container.make(Cache)

await cache.set('user:1', { name: 'Virk' })
const user = await cache.get('user:1')
```
:::

::::

Bindings give you complete control over how a class is constructed. The factory function receives a resolver that you can use to create other dependencies, allowing you to build complex dependency trees with custom logic.

### Singletons

Singletons are bindings that are constructed only once and then cached. Multiple calls to `container.make` for a singleton will return the same instance. This is useful for services that should be shared across your application, like database connections or caching layers.
```ts title="providers/cache_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import redis from '@adonisjs/redis/services/main'
import { Cache } from '#services/cache'

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}
  
  register() {
    /**
     * Use singleton instead of bind.
     * The Cache instance will be created once and reused.
     */
    this.app.container.singleton(Cache, async (resolver) => {
      const redis = await resolver.make('redis')
      const store = redis.connection()
      const config = this.app.config.get<CacheConfig>('cache')
      return new Cache(store, config)
    })
  }
}
```

Now every call to `app.container.make(Cache)` returns the exact same `Cache` instance, making it efficient and ensuring shared state when needed.

### Aliases

Aliases provide alternate string-based names for bindings, allowing you to request dependencies using descriptive names instead of class constructors.

To create an alias, register it using `container.alias()` and update the `ContainerBindings` interface using TypeScript module augmentation for type safety.

```ts title="providers/cache_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import redis from '@adonisjs/redis/services/main'
import { Cache } from '#services/cache'

/**
 * Declare the alias type for TypeScript
 */
declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    cache: Cache
  }
}

export default class CacheProvider {
  constructor(protected app: ApplicationService) {}
  
  register() {
    /**
     * Register the Cache binding as a singleton
     */
    this.app.container.singleton(Cache, async (resolver) => {
      const store = redis.connection()
      const config = this.app.config.get<CacheConfig>('cache')
      return new Cache(store, config)
    })
    
    /**
     * Create an alias so we can reference Cache by the string 'cache'
     */
    this.app.container.alias('cache', Cache)
  }
}
```

Now you can request the cache using the string alias. TypeScript will know that `app.container.make('cache')` returns a `Cache` instance, giving you full autocomplete and type checking.

```ts
import app from '@adonisjs/core/services/app'

/**
 * Request the cache using the string alias instead of the class
 */
const cache = await app.container.make('cache')
```

### Binding existing values

Sometimes you already have an instance and want to register it directly with the container rather than providing a factory function. The `bindValue` method binds an existing value to a class constructor or alias, and the container returns that exact value whenever it's requested.

```ts title="providers/app_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import { Config } from '#services/config'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    /**
     * Create the instance ourselves with specific configuration
     */
    const config = new Config({
      environment: 'production',
      debug: false,
    })

    /**
     * Bind the existing instance directly.
     * Every request for Config returns this exact object.
     */
    this.app.container.bindValue(Config, config)
  }
}
```

Unlike `bind` or `singleton` which accept factory functions, `bindValue` accepts the instance itself. This is useful when you need to register objects that were created outside the container, such as configuration objects parsed at startup or instances received from external libraries.

The `bindValue` method is also available on the request-scoped resolver, which is how request-specific instances like `HttpContext` and `Logger` are registered during HTTP requests. See [Dependency injection during HTTP requests](#dependency-injection-during-http-requests) for an example.

## Dependency injection during HTTP requests

The `HttpContext` object receives an isolated container resolver for each HTTP request. This allows you to register singleton instances that exist only for the duration of that specific request, which is useful for request-scoped services like loggers or user sessions.

These request-scoped bindings should be registered in the `app/middleware/container_bindings_middleware.ts` file, which is pre-created and automatically registered in new AdonisJS applications.
```ts title="app/middleware/container_bindings_middleware.ts"
import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { Logger } from '@adonisjs/core/logger'

export default class ContainerBindingsMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    /**
     * Register the HttpContext itself as a binding.
     * Any class that type-hints HttpContext will receive
     * this exact context instance for the current request.
     */
    ctx.containerResolver.bindValue(HttpContext, ctx)
    
    /**
     * Register the request-specific logger.
     * All classes resolved during this request that depend
     * on Logger will receive this logger instance.
     */
    ctx.containerResolver.bindValue(Logger, ctx.logger)
    
    return next()
  }
}
```

Throughout the current HTTP request, any classes that type-hint `HttpContext` or `Logger` as dependencies will receive the exact instances registered here. This ensures consistency and proper scoping for request-specific data.

## Abstract classes as interfaces

Since TypeScript interfaces are removed at runtime, you cannot use them for type-hinting dependencies. However, you can use abstract classes to achieve the same polymorphic behavior. This enables you to implement the Adapter design pattern, where multiple implementations conform to a common contract.

Let's build a payment system that can work with different payment providers while keeping your business logic provider-agnostic.

### Defining the contract

First, create an abstract class that defines the contract all payment providers must implement. This acts as your interface but remains available at runtime for the container to use as an injection token.
```ts title="app/services/payment_service.ts"
/**
 * Abstract class acts as the interface.
 * Different payment providers will implement this.
 */
export default abstract class PaymentService {
  abstract charge(amount: number): Promise<void>
  abstract refund(amount: number): Promise<void>
}
```

### Creating concrete implementations

Now create concrete implementations for different payment providers. Each provider implements the abstract class's methods with their specific logic, but they all conform to the same contract.

:::codegroup
```ts title="app/services/stripe_provider.ts"
import PaymentService from './payment_service.js'

export default class StripeProvider implements PaymentService {
  async charge(amount: number) {
    console.log(`Charging ${amount} via Stripe`)
  }

  async refund(amount: number) {
    console.log(`Refunding ${amount} via Stripe`)
  }
}
```
```ts title="app/services/paypal_provider.ts"
import PaymentService from './payment_service.js'

export default class PaypalProvider implements PaymentService {
  async charge(amount: number) {
    console.log(`Charging ${amount} via PayPal`)
  }

  async refund(amount: number) {
    console.log(`Refunding ${amount} via PayPal`)
  }
}
```
:::

Notice that both implementations follow the exact same contract. Your application code can depend on `PaymentService` without knowing which specific provider is being used.

### Configuring which implementation to use

Register a binding that tells the container which concrete implementation to inject when someone requests the abstract `PaymentService`. This is where you decide whether your application uses Stripe, PayPal, or any other provider.

```ts title="providers/app_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import PaymentService from '#services/payment_service'
import StripeProvider from '#services/stripe_provider'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    /**
     * Bind the abstract PaymentService to the concrete StripeProvider.
     * Any class that type-hints PaymentService will receive StripeProvider.
     */
    this.app.container.bind(PaymentService, () => {
      return new StripeProvider()
    })
  }
}
```

### Using the abstraction in your code

Now your business logic can depend on the abstract `PaymentService` without being coupled to any specific provider.

```ts title="app/controllers/checkout_controller.ts"
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import PaymentService from '#services/payment_service'

export default class CheckoutController {
  /**
   * Type-hint the abstract PaymentService.
   * The container injects StripeProvider (based on our binding).
   */
  @inject()
  async store({ request }: HttpContext, paymentService: PaymentService) {
    const amount = request.input('amount')
    
    /**
     * We call methods on PaymentService, but the actual
     * implementation is StripeProvider. Our code doesn't
     * know or care which provider is used.
     */
    await paymentService.charge(amount)
    
    return { success: true }
  }
}
```

The power of this pattern is in its flexibility. To switch from Stripe to PayPal, you only need to change the binding in `AppProvider` from `new StripeProvider()` to `new PaypalProvider()`. Your controller and all other business logic remains completely unchanged. This separation makes your code more maintainable and testable.

## Contextual dependencies

Contextual dependencies allow you to inject different implementations of the same abstract class based on which class is requesting it. This is useful when different parts of your application need different configurations or implementations of the same service.

Building on the `PaymentService` example from the previous section, imagine you have different business requirements for different parts of your application. User subscriptions should process through Stripe (for recurring billing features), while one-time product purchases should go through PayPal (for broader payment method support).

### Setting up services with different needs

Let's create two services that both need a `PaymentService`, but they should use different payment providers based on their specific business requirements.

:::codegroup
```ts title="app/services/subscription_service.ts"
import { inject } from '@adonisjs/core'
import PaymentService from '#services/payment_service'

@inject()
export default class SubscriptionService {
  /**
   * SubscriptionService will receive a PaymentService instance
   * configured for Stripe (for recurring billing)
   */
  constructor(protected paymentService: PaymentService) {}
  
  async createSubscription(userId: number, plan: string) {
    await this.paymentService.charge(999)
  }
}
```
```ts title="app/services/order_service.ts"
import { inject } from '@adonisjs/core'
import PaymentService from '#services/payment_service'

@inject()
export default class OrderService {
  /**
   * OrderService will receive a PaymentService instance
   * configured for PayPal (for one-time purchases)
   */
  constructor(protected paymentService: PaymentService) {}
  
  async createOrder(userId: number, items: any[]) {
    await this.paymentService.charge(2499)
  }
}
```
:::

Both services type-hint `PaymentService`, but they need different implementations. Without contextual dependencies, you could only bind one provider globally, forcing both services to use the same implementation.

### Registering contextual bindings

Register contextual dependencies in a Service Provider using the `when().asksFor().provide()` API. This tells the container when a specific class asks for a dependency, provide a particular implementation.

```ts title="providers/app_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import PaymentService from '#services/payment_service'
import StripeProvider from '#services/stripe_provider'
import PaypalProvider from '#services/paypal_provider'
import SubscriptionService from '#services/subscription_service'
import OrderService from '#services/order_service'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    /**
     * When SubscriptionService asks for PaymentService,
     * provide the Stripe implementation (for recurring billing)
     */
    this.app.container
      .when(SubscriptionService)
      .asksFor(PaymentService)
      .provide(() => {
        return new StripeProvider()
      })

    /**
     * When OrderService asks for PaymentService,
     * provide the PayPal implementation (for one-time purchases)
     */
    this.app.container
      .when(OrderService)
      .asksFor(PaymentService)
      .provide(() => {
        return new PaypalProvider()
      })
  }
}
```

Now `SubscriptionService` automatically receives `StripeProvider` when it's constructed, while `OrderService` receives `PaypalProvider`, all through the same `PaymentService` type hint. This keeps your service code clean and focused on business logic while giving you fine-grained control over which dependencies are injected based on context.

The contextual binding pattern is particularly powerful when combined with the adapter pattern from the previous section. Each service remains completely agnostic about which payment provider it's using, yet each gets exactly the implementation it needs for its specific use case.

## Conditional bindings

Conditional bindings select an implementation at resolution time based on a condition you define. Unlike contextual bindings, which depend on the class asking for a dependency, conditional bindings apply to every resolution of a binding key. This makes them a good fit for feature flags, per-tenant implementations, or environment-specific services.

Register a conditional binding using the `container.if()` method, followed by `bind` or `singleton`. The condition can be synchronous or asynchronous, and it runs every time the binding is resolved. In the following example, users with the `new-payment` feature flag receive the `BetaPaymentProvider`, while everyone else falls back to the regular `StripeProvider` binding.

```ts title="providers/app_provider.ts"
import type { ApplicationService } from '@adonisjs/core/types'
import { HttpContext } from '@adonisjs/core/http'
import PaymentService from '#services/payment_service'
import StripeProvider from '#services/stripe_provider'
import BetaPaymentProvider from '#services/beta_payment_provider'

export default class AppProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    /**
     * The fallback binding, used when no condition matches
     */
    this.app.container.bind(PaymentService, () => {
      return new StripeProvider()
    })

    this.app.container
      .if(async (resolver) => {
        /**
         * HttpContext only exists during HTTP requests. Return
         * false in Ace commands, queue jobs, and at boot time.
         */
        if (!resolver.hasBinding(HttpContext)) {
          return false
        }

        const ctx = await resolver.make(HttpContext)
        return ctx.auth.user?.featureFlags.includes('new-payment') === true
      })
      .bind(PaymentService, () => {
        return new BetaPaymentProvider()
      })
  }
}
```

The condition receives the resolver performing the resolution, so it can read request-scoped values like `HttpContext`. It also receives the runtime values passed to `container.make` and the parent class the binding is being injected into (or `null` when resolved directly using `container.make`).

```ts title="providers/app_provider.ts"
this.app.container
  .if((resolver, runtimeValues, parent) => parent === CheckoutController)
  .bind(PaymentService, () => new BetaPaymentProvider())
```

You can register multiple conditional bindings for the same key. The container evaluates them in registration order and uses the first one whose condition returns `true`. When none match, it falls back to the regular binding, or to auto-construction for classes.

### Conditional singletons

Use the `singleton` method to cache the factory result of a conditional binding. The condition is still evaluated on every resolution, but the factory function runs only once.

```ts title="providers/app_provider.ts"
import env from '#start/env'
import SearchService from '#services/search_service'
import TypesenseSearchService from '#services/typesense_search_service'

this.app.container
  .if(() => env.get('SEARCH_DRIVER') === 'typesense')
  .singleton(SearchService, (resolver) => {
    return resolver.make(TypesenseSearchService)
  })
```

:::warning
`container.hasBinding()` returns `true` for a key that only has conditional bindings, yet resolving it throws when none of the conditions match. Register a fallback using `container.bind()` when the key must always resolve.

```ts title="providers/app_provider.ts"
this.app.container.bind(PaymentService, () => new StripeProvider())
this.app.container
  .if(() => isBetaEnabled())
  .bind(PaymentService, () => new BetaPaymentProvider())
```
:::

## Resolution priority

When the container resolves a dependency, it checks multiple sources in a specific order. Understanding this priority helps you predict which implementation will be injected and debug unexpected behavior.

The container resolves dependencies in this order, stopping at the first match:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Swaps | Test overrides registered with `container.swap()` |
| 2 | Contextual bindings | Bindings registered with `when().asksFor().provide()` |
| 3 | Resolver values | Values bound to a scoped resolver (e.g., request-scoped bindings) |
| 4 | Container values | Values registered with `container.bindValue()` |
| 5 | Conditional bindings | Bindings registered with `container.if().bind()` or `container.if().singleton()` |
| 6 | Container bindings | Factory functions registered with `container.bind()` or `container.singleton()` |
| 7 | Auto-construction | The container constructs the class itself using `@inject()` |

Swaps have the highest priority because they're designed for testing. When you swap a dependency, you want the fake implementation to be used regardless of any other bindings. This ensures your tests remain isolated and predictable.

Contextual bindings come next because they represent intentional, context-specific overrides. When you explicitly say "when ClassA asks for ServiceB, provide this specific implementation," that intent should override general bindings.

If no swap or contextual binding matches, the container checks for values bound to the current resolver scope. During HTTP requests, the `HttpContext` and request-scoped `Logger` are bound this way, ensuring each request gets its own instances.

Container-level values are checked next, followed by conditional bindings and then regular bindings. These are your application-wide values, singletons, and factories registered in service providers. Since swaps and values come first, a conditional binding never overrides a swapped class in tests or a value registered with `bindValue`.

Finally, if no binding exists at all, the container attempts auto-construction. It uses TypeScript's reflection metadata to identify constructor dependencies marked with `@inject()` and recursively resolves them.

This priority order means you can layer your dependency configuration: define general bindings in providers, override them contextually for specific classes, and swap them entirely during tests—all without modifying the original code.

## Swapping dependencies during testing

The container provides a straightforward API for swapping dependencies with fake implementations during tests. This allows you to test your code in isolation without hitting real external services.

The `container.swap` method replaces a binding with a temporary implementation, and `container.restore` reverts it back to the original. During the swap, any part of your codebase that type-hints the swapped class will receive the fake implementation instead.
```ts title="tests/functional/users/list.spec.ts"
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import UserService from '#services/user_service'

test('get all users', async ({ client, cleanup }) => {
  /**
   * Create a fake implementation that extends the real service
   */
  class FakeUserService extends UserService {
    /**
     * Override the all() method to return fake data
     * instead of querying the database
     */
    all() {
      return [
        { id: 1, username: 'virk', email: 'virk@adonisjs.com' },
        { id: 2, username: 'romain', email: 'romain@adonisjs.com' }
      ]
    }
  }
  
  /**
   * Swap UserService with our fake implementation.
   * Any code that resolves UserService during this test
   * will receive FakeUserService instead.
   */
  app.container.swap(UserService, () => {
    return new FakeUserService()
  })
  
  /**
   * Restore the original binding after the test completes.
   * The cleanup hook ensures this runs even if the test fails.
   */
  cleanup(() => app.container.restore(UserService))
  
  /**
   * Make the HTTP request. The controller will receive
   * FakeUserService, which returns our fake data.
   */
  const response = await client.get('/users')
  
  response.assertStatus(200)
  response.assertBodyContains({ 
    users: [
      { username: 'virk' },
      { username: 'romain' }
    ]
  })
})
```

Swapping is particularly valuable when testing code that depends on external APIs, payment gateways, email services, or any other resource you don't want to interact with during automated tests. The fake implementation can simulate various scenarios (success, failure, edge cases) without requiring real infrastructure.

## Container events

The container emits events when it resolves bindings, allowing you to observe and react to dependency resolution. This can be useful for debugging, monitoring, or implementing cross-cutting concerns.

The container emits a single event type: `container_binding:resolved`. This event is triggered every time the container successfully resolves a class instance, whether through auto-resolution, bindings, or singletons.

You can listen to this event using the application's event emitter.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'

emitter.on('container_binding:resolved', (event) => {
  /**
   * event.binding contains the class constructor or string alias
   * that was resolved
   */
  console.log('Resolved binding:', event.binding)
  
  /**
   * event.value contains the actual instance that was created
   */
  console.log('Instance:', event.value)
})
```

The event object provides two properties. First, `event.binding` contains the binding key (either a class constructor or string alias) that was resolved. Second, `event.value` contains the actual instance that the container created and returned.

This event is fired for every resolution, including nested dependencies. For example, if the container resolves `UserService`, which depends on `LoggerService`, you'll receive two events: one for `LoggerService` and one for `UserService`.

## See also

- [Service Providers](./service_providers.md) - Learn how to register bindings and organize application bootstrapping
- [The IoC Container README](https://github.com/adonisjs/fold/blob/11.x/README.md) - Comprehensive API documentation in a framework-agnostic context
- [Why Do You Need an IoC Container?](https://github.com/thetutlage/meta/discussions/4) - The framework creator's reasoning for using dependency injection
- [TypeScript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html) - Understanding the decorator syntax used by `@inject()`
- [Container API docs](https://api.adonisjs.com/modules/_adonisjs_fold.index) - To get a full view of available classes, methods and properties.
