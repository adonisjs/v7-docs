---
description: Learn how to use test doubles in AdonisJS, including built-in fakes for Mail, Hash, Emitter, and Drive, container swaps for dependency injection, and time utilities for testing time-sensitive code.
---

# Test doubles

This guide covers test doubles in AdonisJS applications. You will learn how to:

- Use built-in fakes for Mail, Hash, Emitter, and Drive services
- Swap container bindings to fake dependencies using `swap` and `useFake`
- Freeze and travel through time when testing time-sensitive code
- Integrate Sinon.js for additional stubbing and mocking needs

## Overview

Test doubles replace real implementations with controlled alternatives during testing. They allow you to isolate code under test, avoid side effects like sending real emails, and verify that your code interacts correctly with its dependencies.

AdonisJS takes a pragmatic approach to test doubles. For internal operations like database queries, we recommend hitting the real database rather than mocking query methods. Real database interactions catch issues that mocks would miss, such as constraint violations, incorrect query syntax, or migration problems. However, for external services like email providers, payment gateways, or third-party APIs, fakes prevent unwanted side effects and make tests faster and more reliable.

The framework provides built-in fakes for common services that interact with external systems, along with container swaps for replacing your own dependencies. For edge cases not covered by these tools, you can integrate libraries like Sinon.js.

## Built-in fakes

AdonisJS provides fake implementations for services that typically interact with external systems. Each fake intercepts calls to the real service and captures them for assertions.

### Emitter fake

The emitter fake prevents event listeners from executing while capturing emitted events for assertions. This is useful when testing code that emits events without triggering side effects like sending notifications or updating external systems.

```ts title="tests/functional/users/register.spec.ts"
import { test } from '@japa/runner'
import emitter from '@adonisjs/core/services/emitter'
import { events } from '#generated/events'

test.group('User registration', () => {
  test('emits registration event on signup', async ({ client, cleanup }) => {
    /**
     * Fake the emitter to capture events without
     * executing listeners
     */
    const fakeEmitter = emitter.fake()
    cleanup(() => emitter.restore())

    await client.post('/signup').form({
      email: 'jane@example.com',
      password: 'secret123',
    })

    /**
     * Assert the event was emitted
     */
    fakeEmitter.assertEmitted(events.UserRegistered)
  })
})
```

You can fake specific events while allowing others to execute normally by passing event names or classes to the `fake` method.

```ts
// Fake only these events, let others execute normally
emitter.fake([events.UserRegistered, events.OrderUpdated])
```

The `EventBuffer` returned by `emitter.fake()` provides several assertion methods.

| Method                             | Description                                            |
| ---------------------------------- | ------------------------------------------------------ |
| `assertEmitted(event)`             | Assert an event was emitted                            |
| `assertNotEmitted(event)`          | Assert an event was not emitted                        |
| `assertEmittedCount(event, count)` | Assert an event was emitted a specific number of times |
| `assertNoneEmitted()`              | Assert no events were emitted                          |

For conditional assertions, pass a callback to `assertEmitted` that receives the event data and returns `true` if the event matches your criteria.

```ts title="tests/functional/orders/update.spec.ts"
fakeEmitter.assertEmitted(events.OrderUpdated, ({ data }) => {
  return data.order.id === orderId
})
```

See also: [Events](../digging_deeper/emitter.md)

### Hash fake

The hash fake replaces the real hashing implementation with a fast alternative that performs no actual hashing. Password hashing algorithms like bcrypt and argon2 are intentionally slow for security, but this can significantly slow down test suites that create many users.

```ts title="tests/functional/users/list.spec.ts"
import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import { UserFactory } from '#database/factories/user_factory'

test.group('Users list', (group) => {
  group.each.setup(() => {
    /**
     * Fake the hash service to make user creation instant.
     * Without this, creating 50 users with bcrypt takes ~5 seconds.
     */
    hash.fake()

    return () => hash.restore()
  })

  test('paginates users correctly', async ({ client }) => {
    await UserFactory.createMany(50)

    const response = await client.get('/users')
    response.assertStatus(200)
  })
})
```

The fake stores plain text and compares strings directly. It should only be used in tests where password hashing is not the focus of what you're testing.

See also: [Hashing](../security/hashing.md)

### Mail fake

The mail fake intercepts all emails and captures them for assertions. This prevents your tests from sending real emails while allowing you to verify that the correct emails would be sent.

```ts title="tests/functional/users/register.spec.ts"
import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import VerifyEmailNotification from '#mails/verify_email'

test.group('User registration', (group) => {
  group.each.setup(() => {
    return () => mail.restore()
  })

  test('sends verification email on signup', async ({ client }) => {
    const { mails } = mail.fake()

    await client.post('/register').form({ email: 'user@example.com', password: 'secret123' })

    /**
     * Assert the email was sent with correct recipient and subject
     */
    mails.assertSent(VerifyEmailNotification, ({ message }) => {
      return message.hasTo('user@example.com').hasSubject('Please verify your email address')
    })
  })

  test('does not send reset email for unknown user', async ({ client }) => {
    const { mails } = mail.fake()

    await client.post('/forgot-password').form({ email: 'unknown@example.com' })

    mails.assertNotSent(PasswordResetNotification)
  })
})
```

The `mails` object provides assertion methods for both sent and queued emails.

| Method                           | Description                                |
| -------------------------------- | ------------------------------------------ |
| `assertSent(Mail, finder?)`      | Assert an email class was sent             |
| `assertNotSent(Mail, finder?)`   | Assert an email class was not sent         |
| `assertSentCount(count)`         | Assert total number of emails sent         |
| `assertSentCount(Mail, count)`   | Assert count for a specific email class    |
| `assertNoneSent()`               | Assert no emails were sent                 |
| `assertQueued(Mail, finder?)`    | Assert an email was queued via `sendLater` |
| `assertNotQueued(Mail, finder?)` | Assert an email was not queued             |
| `assertQueuedCount(count)`       | Assert total number of queued emails       |
| `assertNoneQueued()`             | Assert no emails were queued               |

You can also test mail classes in isolation by building them without sending.

```ts title="tests/unit/mails/verify_email.spec.ts"
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import VerifyEmailNotification from '#mails/verify_email'

test.group('VerifyEmailNotification', () => {
  test('builds correct message', async () => {
    const user = await UserFactory.create()
    const email = new VerifyEmailNotification(user)

    /**
     * Build the message and render templates without sending
     */
    await email.buildWithContents()

    email.message.assertTo(user.email)
    email.message.assertFrom('noreply@example.com')
    email.message.assertSubject('Please verify your email address')
    email.message.assertHtmlIncludes(`Hello ${user.name}`)
  })
})
```

See also: [Mail](../digging_deeper/mail.md)

### Drive fake

The drive fake replaces a disk with a local filesystem implementation. Files are written to `./tmp/drive-fakes` and automatically deleted when you restore the fake.

```ts title="tests/functional/users/update.spec.ts"
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import fileGenerator from '@poppinss/file-generator'
import { UserFactory } from '#database/factories/user_factory'

test.group('User avatar upload', () => {
  test('uploads avatar to storage', async ({ client, cleanup }) => {
    /**
     * Fake the spaces disk to avoid uploading to real S3
     */
    const fakeDisk = drive.fake('spaces')
    cleanup(() => drive.restore('spaces'))

    const user = await UserFactory.create()

    /**
     * Generate a fake 1mb PNG file
     */
    const { contents, mime, name } = await fileGenerator.generatePng('1mb')

    await client
      .put('/me')
      .file('avatar', contents, { filename: name, contentType: mime })
      .loginAs(user)

    /**
     * Assert the file was stored
     */
    fakeDisk.assertExists(user.avatar)
  })
})
```

See also: [Drive](../digging_deeper/drive.md)

## Container swaps

When using dependency injection, you can swap container bindings to replace services with fake implementations. This is useful for faking your own services, such as a payment gateway or external API client.

The recommended approach is to create a dedicated fake implementation that extends or implements the same interface as the real service.

```ts title="app/services/payment_gateway.ts"
export default class PaymentGateway {
  async charge(amount: number, token: string): Promise<ChargeResult> {
    /**
     * Real implementation that calls Stripe, Braintree, etc.
     */
  }

  async refund(chargeId: string): Promise<RefundResult> {
    /**
     * Real implementation
     */
  }
}
```

```ts title="app/services/fake_payment_gateway.ts"
import PaymentGateway from './payment_gateway.js'

export default class FakePaymentGateway extends PaymentGateway {
  /**
   * Store charges for assertions
   */
  charges: Array<{ amount: number; token: string }> = []

  async charge(amount: number, token: string): Promise<ChargeResult> {
    this.charges.push({ amount, token })

    return {
      id: 'fake_charge_123',
      status: 'succeeded',
    }
  }

  async refund(chargeId: string): Promise<RefundResult> {
    return {
      id: 'fake_refund_123',
      status: 'succeeded',
    }
  }

  /**
   * Helper method to assert a charge was made
   */
  assertCharged(amount: number) {
    const charge = this.charges.find((c) => c.amount === amount)
    if (!charge) {
      throw new Error(`Expected charge of ${amount} but none found`)
    }
  }
}
```

### Swapping bindings in tests

The test context provides a `swap` method that replaces a container binding with a fake for the duration of the test. The original binding is automatically restored after the test completes, so you don't need to manage cleanup yourself.

```ts title="tests/functional/orders/checkout.spec.ts"
import { test } from '@japa/runner'
import PaymentGateway from '#services/payment_gateway'
import FakePaymentGateway from '#services/fake_payment_gateway'

test.group('Checkout', () => {
  test('charges the customer on checkout', async ({ client, swap }) => {
    /**
     * Swap the real payment gateway with the fake.
     * The original binding is restored when the test ends.
     */
    const fakePayment = swap(PaymentGateway, new FakePaymentGateway())

    await client.post('/checkout').json({ cartId: 'cart_123', paymentToken: 'tok_visa' })

    fakePayment.assertCharged(9999)
  })
})
```

The `swap` method accepts either a direct instance or a factory function. Use a factory function when you need a fresh instance each time the binding is resolved.

```ts title="tests/functional/orders/checkout.spec.ts"
// Pass a factory function instead of an instance
swap(PaymentGateway, () => new FakePaymentGateway())
```

### The `useFake` helper

The `useFake` helper provides the same functionality as `swap` but as a standalone function. This is useful when you want to extract swap logic into reusable test helpers outside of the test callback.

```ts title="tests/helpers/fakes.ts"
import { useFake } from '@japa/plugin-adonisjs/helpers'
import PaymentGateway from '#services/payment_gateway'
import FakePaymentGateway from '#services/fake_payment_gateway'

/**
 * Reusable helper that swaps the payment gateway
 * and returns the fake for assertions
 */
export function useFakePaymentGateway() {
  return useFake(PaymentGateway, new FakePaymentGateway())
}
```

```ts title="tests/functional/orders/checkout.spec.ts"
import { test } from '@japa/runner'
import { useFakePaymentGateway } from '#tests/helpers/fakes'

test.group('Checkout', () => {
  test('charges the customer on checkout', async ({ client }) => {
    const fakePayment = useFakePaymentGateway()

    await client.post('/checkout').json({ cartId: 'cart_123', paymentToken: 'tok_visa' })

    fakePayment.assertCharged(9999)
  })
})
```

Like `swap`, `useFake` automatically restores the original binding when the test completes. Both `swap` and `useFake` can only be called within a running Japa test.

### Manual swap with `container.swap`

You can also call `container.swap` and `container.restore` directly on the application container. This gives you full control over when the binding is restored, which can be useful in group-level setup hooks or when you need to restore a binding before the test ends.

```ts title="tests/functional/orders/checkout.spec.ts"
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import PaymentGateway from '#services/payment_gateway'
import FakePaymentGateway from '#services/fake_payment_gateway'

test.group('Checkout', () => {
  test('charges the customer on checkout', async ({ client, cleanup }) => {
    const fakePayment = new FakePaymentGateway()

    /**
     * Swap the binding and register cleanup manually
     */
    app.container.swap(PaymentGateway, () => fakePayment)
    cleanup(() => app.container.restore(PaymentGateway))

    await client.post('/checkout').json({ cartId: 'cart_123', paymentToken: 'tok_visa' })

    fakePayment.assertCharged(9999)
  })
})
```

See also: [Dependency injection](../concepts/dependency_injection.md)

## Time utilities

Japa provides utilities for controlling time during tests. Both `freezeTime` and `timeTravel` mock `new Date()` and `Date.now()`, and automatically restore the real implementations after the test completes.

### Freezing time

The `freezeTime` function locks time to a specific moment. This is useful when testing code that checks timestamps, such as token expiration.

```ts title="tests/functional/auth/token.spec.ts"
import { test } from '@japa/runner'
import { freezeTime } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'

test.group('Token expiration', () => {
  test('rejects expired tokens', async ({ client }) => {
    const user = await UserFactory.create()

    /**
     * Create a token at the current time
     */
    const token = await user.createToken()

    /**
     * Freeze time to 2 hours in the future, past the token's
     * 1-hour expiration window
     */
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000)
    freezeTime(futureDate)

    const response = await client.get('/protected').header('Authorization', `Bearer ${token.value}`)

    response.assertStatus(401)
  })
})
```

### Traveling through time

The `timeTravel` function moves time forward by a duration. You can pass a human-readable string expression or a `Date` object.

```ts title="tests/functional/subscriptions/expiry.spec.ts"
import { test } from '@japa/runner'
import { timeTravel } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'

test.group('Subscription expiry', () => {
  test('marks subscription as expired after 30 days', async ({ client }) => {
    const user = await UserFactory.with('subscription', 1, (s) =>
      s.merge({ startsAt: new Date() })
    ).create()

    /**
     * Travel 31 days into the future
     */
    timeTravel('31 days')

    const response = await client.get('/subscription').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ status: 'expired' })
  })
})
```

Both utilities only mock the `Date` object. They do not affect timers like `setTimeout` or `setInterval`.

## Sinon.js

For stubbing and mocking needs not covered by the built-in fakes, you can use [Sinon.js](https://sinonjs.org/). Install it as a development dependency.

```sh
npm install -D sinon @types/sinon
```

Sinon provides stubs, spies, and mocks for fine-grained control over function behavior. Always call `sinon.restore()` after tests to clean up.

```ts title="tests/functional/reports/generate.spec.ts"
import { test } from '@japa/runner'
import sinon from 'sinon'
import ReportService from '#services/report_service'

test.group('Report generation', (group) => {
  group.each.teardown(() => {
    sinon.restore()
  })

  test('retries on temporary failure', async ({ client }) => {
    const stub = sinon.stub(ReportService.prototype, 'generate')
    stub.onFirstCall().rejects(new Error('Temporary failure'))
    stub.onSecondCall().resolves({ id: 'report_123' })

    const response = await client.post('/reports')

    response.assertStatus(200)
    sinon.assert.calledTwice(stub)
  })
})
```

For comprehensive documentation on stubs, spies, mocks, and fake timers, see the [Sinon.js documentation](https://sinonjs.org/releases/latest/).
