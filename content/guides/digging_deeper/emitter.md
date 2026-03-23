---
description: Learn how to use the AdonisJS event emitter to build event-driven applications with type-safe events and listeners.
---

# Event Emitter

This guide covers the event emitter in AdonisJS applications. You will learn how to:

- Define and emit type-safe events
- Register listeners using callbacks or classes
- Handle errors and fake events during tests

## Overview

The event emitter enables event-driven architecture in AdonisJS applications. When you emit an event, all registered listeners execute asynchronously without blocking the code that triggered the event. This pattern is useful for decoupling side effects from your main application logic.

A common example is user registration: after creating a user account, you might need to send a verification email, provision resources with a payment provider, and log the signup for analytics. Rather than executing all these tasks sequentially in your controller, you can emit a single `user:registered` event and let separate listeners handle each concern independently.

AdonisJS provides two approaches for defining events. String-based events use TypeScript module augmentation for type-safety, while class-based events encapsulate the event identifier and data in a single class.

:::note
If you're looking for a list of events emitted by AdonisJS and its official packages, see the [events reference guide](../../reference/events.md).
:::

## Defining events and event data

An event consists of two parts: an identifier and associated data. The identifier is typically a string like `user:registered`, and the data is whatever payload you want to pass to listeners (for example, an instance of the `User` model).

Class-based events encapsulate both the identifier and the data within a single class. The class itself serves as the identifier, and instances of the class hold the event data. This approach provides built-in type-safety without additional configuration.

## String-based events

String-based events use a string identifier like `user:registered` or `order:shipped`. To make these events type-safe, you define the event names and their payload types using TypeScript module augmentation.

::::steps

:::step{title="Define event types"}

Create a `types/events.ts` file and augment the `EventsList` interface to declare your events and their payload types.

```ts title="types/events.ts"
import User from '#models/user'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'user:registered': User
  }
}
```

The `EventsList` interface maps event names to their payload types. In this example, the `user:registered` event carries a `User` model instance as its payload. TypeScript will enforce this contract when you emit events or register listeners.

:::

:::step{title="Listen for the event"}

Create a preload file to register your event listeners. Run the following command to generate the file.

```sh
node ace make:preload events
```

This creates `start/events.ts`, which is loaded automatically when your application boots. Register listeners using the `emitter.on` method.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'

emitter.on('user:registered', function (user) {
  console.log(user.email)
})
```

The listener callback receives the event payload as its argument. Because you defined the payload type in `EventsList`, TypeScript knows that `user` is an instance of the `User` model.

:::

:::step{title="Emit the event"}

Emit events from anywhere in your application using `emitter.emit`. The first argument is the event name, and the second is the payload.

```ts title="app/controllers/users_controller.ts"
import emitter from '@adonisjs/core/services/emitter'
import User from '#models/user'

export default class UsersController {
  async store({ request }: HttpContext) {
    const data = request.only(['email', 'password'])
    const user = await User.create(data)

    // [!code highlight]
    emitter.emit('user:registered', user)
    return user
  }
}
```

The `emitter.emit` method is type-safe. TypeScript will error if you pass an incorrect payload type or use an event name that isn't defined in `EventsList`.

:::

::::

## Class-based events

Class-based events provide type-safety without module augmentation. The event class acts as both the identifier and a container for the event data.

::::steps

:::step{title="Create an event class"}

Generate an event class using the `make:event` command.

```sh
node ace make:event UserRegistered
```

This creates an event class that extends `BaseEvent`. Accept event data through the constructor and expose it as instance properties.

```ts title="app/events/user_registered.ts"
import { BaseEvent } from '@adonisjs/core/events'
import User from '#models/user'

export default class UserRegistered extends BaseEvent {
  constructor(public user: User) {
    super()
  }
}
```

The event class has no behavior. It's purely a data container where the constructor parameters define what data the event carries.

:::

:::step{title="Listen for the event"}

Import the event class from the `#generated/events` [barrel file](../concepts/barrel_files.md) and use it as the first argument to `emitter.on`.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'

emitter.on(events.UserRegistered, function (event) {
  console.log(event.user.email)
})
```

The listener receives an instance of the event class. Access the event data through the instance properties you defined in the constructor.

:::

:::step{title="Dispatch the event"}

Class-based events are dispatched using the static `dispatch` method instead of `emitter.emit`.

```ts title="app/controllers/users_controller.ts"
import User from '#models/user'
import { events } from '#generated/events'

export default class UsersController {
  async store({ request }: HttpContext) {
    const data = request.only(['email', 'password'])
    const user = await User.create(data)

    // [!code highlight]
    events.UserRegistered.dispatch(user)
    return user
  }
}
```

The `dispatch` method accepts the same arguments as the event class constructor. There's no need to define types in `EventsList` since the class itself provides complete type information.

:::

::::

## Listeners

Listeners can be defined as inline callbacks or as dedicated listener classes. Inline callbacks work well for simple logic, while listener classes are better for complex operations that benefit from dependency injection and testability.

### Inline callbacks

Pass a function directly to `emitter.on` for simple listeners.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'

emitter.on('user:registered', function (user) {
  console.log(`New user: ${user.email}`)
})
```

The same approach works with class-based events.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'

emitter.on(events.UserRegistered, function (event) {
  console.log(`New user: ${event.user.email}`)
})
```

### Listener classes

Create a listener class using the `make:listener` command.

```sh
node ace make:listener SendVerificationEmail
```

This generates a class with a `handle` method that executes when the event fires.

```ts title="app/listeners/send_verification_email.ts"
export default class SendVerificationEmail {
  async handle() {
    // Send email
  }
}
```

Update the `handle` method to accept the event payload. For class-based events, type the parameter as the event class.

```ts title="app/listeners/send_verification_email.ts"
import { events } from '#generated/events'

export default class SendVerificationEmail {
  async #sendEmail(to: string) {
  }

  async handle(event: events.UserRegistered) {
    await this.#sendEmail(event.user.email)
  }
}
```

Register the listener by importing it from the `#generated/listeners` [barrel file](../concepts/barrel_files.md).

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'
import { listeners } from '#generated/listeners'

emitter.on(events.UserRegistered, listeners.SendVerificationEmail)
```

### Dependency injection in listeners

Listener classes are instantiated through the IoC container, so you can inject dependencies via the constructor using the `@inject` decorator.

See also [dependency injection guide](../concepts/dependency_injection.md).

```ts title="app/listeners/send_verification_email.ts"
import { inject } from '@adonisjs/core'
import { events } from '#generated/events'
import TokensService from '#services/tokens_service'

@inject()
export default class SendVerificationEmail {
  constructor(protected tokensService: TokensService) {}

  async handle(event: events.UserRegistered) {
    const token = this.tokensService.generate(event.user.email)
  }
}
```

## Listening methods

The emitter provides several methods for registering listeners, each suited to different use cases.

### Persistent listeners with `on`

The `on` method registers a listener that fires every time the event is emitted throughout the application lifecycle.

```ts
emitter.on('user:registered', function (user) {
  // Runs every time the event fires
})
```

### One-time listeners with `once`

The `once` method registers a listener that fires only once, then automatically unsubscribes.

```ts
emitter.once('user:registered', function (user) {
  // Runs only the first time the event fires
})
```

### Multiple listeners with `listen`

The `listen` method registers multiple listeners for a single event in one call.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'
import { listeners } from '#generated/listeners'

emitter.listen(events.UserRegistered, [
  listeners.SendVerificationEmail,
  listeners.RegisterWithPaymentProvider,
  listeners.ProvisionAccount,
])
```

All listeners execute in parallel when the event fires.

### Wildcard listeners with `onAny`

The `onAny` method registers a listener that fires for every event emitted in the application.

```ts
emitter.onAny((name, event) => {
  console.log(`Event fired: ${name}`)
  console.log(event)
})
```

This is useful for logging, debugging, or implementing cross-cutting concerns that apply to all events.

## Unsubscribing from events

You can remove listeners when they're no longer needed.

### Using the unsubscribe function

The `on` and `once` methods return an unsubscribe function. Call it to remove the listener.

```ts
import emitter from '@adonisjs/core/services/emitter'

const unsubscribe = emitter.on('user:registered', () => {
})

// [!code highlight]
unsubscribe()
```

### Using the `off` method

The `off` method removes a specific listener. You need a reference to the exact function or class that was registered.

```ts
import emitter from '@adonisjs/core/services/emitter'

function sendEmail() {
}

emitter.on('user:registered', sendEmail)
// [!code highlight]
emitter.off('user:registered', sendEmail)
```

This works with listener classes too.

```ts
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'
import { listeners } from '#generated/listeners'

emitter.on(events.UserRegistered, listeners.SendVerificationEmail)
emitter.off(events.UserRegistered, listeners.SendVerificationEmail)
```

### Clearing listeners

Remove all listeners for a specific event with `clearListeners`.

```ts
emitter.clearListeners('user:registered')
emitter.clearListeners(events.UserRegistered)
```

Remove all listeners for all events with `clearAllListeners`.

```ts
emitter.clearAllListeners()
```

## Error handling

When a listener throws an error, it doesn't affect other listeners since they run in parallel. However, unhandled errors will trigger Node.js [unhandledRejection](https://nodejs.org/api/process.html#event-unhandledrejection) events, which can crash your application or cause unexpected behavior.

Define a global error handler to catch and process errors from all listeners.

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'

emitter.onError((event, error, eventData) => {
  console.error(`Error in listener for ${event}:`, error)
  // Report to error tracking service
})
```

The error handler receives three arguments: the event name (or class), the error that was thrown, and the event data that was passed to the listener.

## Faking events during tests

When testing code that emits events, you often want to verify the event was emitted without actually running the listeners. For example, when testing user registration, you might want to confirm the `user:registered` event fires without sending real emails.

The `emitter.fake` method prevents listeners from running and returns an `EventBuffer` that captures emitted events for assertions.

```ts
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'

test.group('User signup', () => {
  test('create a user account', async ({ client }) => {
    // [!code highlight:2]
    using fakeEmitter = emitter.fake()

    await client
      .post('signup')
      .form({
        email: 'foo@bar.com',
        password: 'secret',
      })

    // [!code highlight]
    fakeEmitter.assertEmitted(events.UserRegistered)
  })
})
```

The `using` keyword automatically restores the emitter when the variable goes out of scope (at the end of the test function). You can also call `emitter.restore()` manually if you need more control over when restoration happens.

### Faking specific events

Pass event names or classes to `fake` to only fake specific events. Other events will continue to trigger their listeners normally.

```ts
emitter.fake('user:registered')
emitter.fake([events.UserRegistered, events.OrderUpdated])
```

### Assertions

The `EventBuffer` returned by `fake` provides several assertion methods.

```ts
const fakeEmitter = emitter.fake()

// Assert an event was emitted
fakeEmitter.assertEmitted('user:registered')
fakeEmitter.assertEmitted(events.UserRegistered)

// Assert an event was not emitted
fakeEmitter.assertNotEmitted(events.OrderUpdated)

// Assert an event was emitted a specific number of times
fakeEmitter.assertEmittedCount(events.OrderUpdated, 1)

// Assert no events were emitted at all
fakeEmitter.assertNoneEmitted()
```

### Conditional assertions

Pass a callback to `assertEmitted` to assert that an event was emitted with specific data.

```ts
fakeEmitter.assertEmitted(events.OrderUpdated, ({ data }) => {
  /**
   * Only consider the event as emitted if
   * the orderId matches
   */
  return data.order.id === orderId
})
```

The callback receives the event data and should return `true` if the event matches your criteria.
