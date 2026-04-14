---
description: Learn how to send emails from your AdonisJS application using the @adonisjs/mail package.
---

# Mail

This guide covers sending emails from your AdonisJS application. You will learn how to:

- Configure mail transports for services like SMTP, Resend, Mailgun, and SES
- Send emails using the fluent Message API
- Queue emails for background delivery
- Organize emails into reusable mail classes
- Add attachments, embed images, and include calendar invites
- Test email functionality with the fake mailer

## Overview

The `@adonisjs/mail` package provides a unified API for sending emails through various providers. Built on top of [Nodemailer](https://nodemailer.com/), it adds a fluent configuration API, support for organizing emails as classes, an extensive testing API, and background email delivery through messengers.

The package introduces two key concepts. A **transport** is the underlying delivery mechanism (SMTP server, API service like Resend or Mailgun). A **mailer** is a configured instance of a transport that you use to send emails. You can configure multiple mailers in your application, each using different transports or the same transport with different settings, and switch between them at runtime.

## Installation

Install and configure the package using the following command:

```sh
node ace add @adonisjs/mail
```

You can pre-select transports during installation:

```sh
node ace add @adonisjs/mail --transports=resend --transports=smtp
```

:::disclosure{title="See steps performed by the add command"}

1. Installs the `@adonisjs/mail` package using the detected package manager.
2. Registers the following service provider and command inside the `adonisrc.ts` file.

    ```ts title="adonisrc.ts"
    {
      commands: [
        // ...other commands
        () => import('@adonisjs/mail/commands')
      ],
      providers: [
        // ...other providers
        () => import('@adonisjs/mail/mail_provider')
      ]
    }
    ```

3. Creates the `config/mail.ts` file.
4. Defines the environment variables and their validations for the selected mail services.

:::

## Configuration

The mail configuration lives in `config/mail.ts`. This file defines your mailers, default sender addresses, and transport settings.

See also: [Config stub](https://github.com/adonisjs/mail/blob/-/stubs/config/mail.stub)

```ts title="config/mail.ts"
import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  /**
   * The mailer to use when none is specified
   */
  default: 'smtp',

  /**
   * Global "from" address used when not set on individual emails
   */
  from: {
    address: 'hello@example.com',
    name: 'My App',
  },

  /**
   * Global "reply-to" address used when not set on individual emails
   */
  replyTo: {
    address: 'support@example.com',
    name: 'My App Support',
  },

  /**
   * Configure one or more mailers. Each mailer uses a transport
   * and can have its own settings.
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
    }),

    resend: transports.resend({
      key: env.get('RESEND_API_KEY'),
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig
```

| Option | Description |
|--------|-------------|
| `default` | The mailer to use when you call `mail.send()` without specifying one. |
| `from` | Global sender address. Used unless overridden on individual emails. |
| `replyTo` | Global reply-to address. Used unless overridden on individual emails. |
| `mailers` | An object containing your configured mailers. Each key is a mailer name, each value is a transport configuration. |

## Transport configuration

Each transport accepts provider-specific options. The following sections document the available transports and their configuration.

See also: [TypeScript types for config object](https://github.com/adonisjs/mail/blob/10.x/src/types.ts#L243)

:::disclosure{title="SMTP"}

SMTP configuration options are forwarded directly to Nodemailer.

See also: [Nodemailer SMTP documentation](https://nodemailer.com/smtp)

```ts title="config/mail.ts"
{
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
      secure: false,

      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME'),
        pass: env.get('SMTP_PASSWORD')
      },

      tls: {},
      ignoreTLS: false,
      requireTLS: false,
      pool: false,
      maxConnections: 5,
      maxMessages: 100,
    })
  }
}
```

:::

:::disclosure{title="Resend"}

Configuration options are sent to Resend's [`/emails`](https://resend.com/docs/api-reference/emails/send-email) API endpoint.

```ts title="config/mail.ts"
{
  mailers: {
    resend: transports.resend({
      baseUrl: 'https://api.resend.com',
      key: env.get('RESEND_API_KEY'),

      /**
       * Optional: Can be overridden at runtime
       */
      tags: [
        {
          name: 'category',
          value: 'confirm_email'
        }
      ]
    })
  }
}
```

:::

:::disclosure{title="Mailgun"}

Configuration options are sent to Mailgun's [`/messages.mime`](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages/post-v3--domain-name--messages-mime) API endpoint.

```ts title="config/mail.ts"
{
  mailers: {
    mailgun: transports.mailgun({
      baseUrl: 'https://api.mailgun.net/v3',
      key: env.get('MAILGUN_API_KEY'),
      domain: env.get('MAILGUN_DOMAIN'),

      /**
       * Optional: Can be overridden at runtime
       */
      oDkim: true,
      oTags: ['transactional', 'adonisjs_app'],
      oDeliverytime: new Date(2024, 8, 18),
      oTestMode: false,
      oTracking: false,
      oTrackingClick: false,
      oTrackingOpens: false,
      headers: {},
      variables: {
        appId: '',
        userId: '',
      }
    })
  }
}
```

:::

:::disclosure{title="SparkPost"}

Configuration options are sent to SparkPost's [`/transmissions`](https://developers.sparkpost.com/api/transmissions/#header-request-body) API endpoint.

```ts title="config/mail.ts"
{
  mailers: {
    sparkpost: transports.sparkpost({
      baseUrl: 'https://api.sparkpost.com/api/v1',
      key: env.get('SPARKPOST_API_KEY'),

      /**
       * Optional: Can be overridden at runtime
       */
      startTime: new Date(),
      openTracking: false,
      clickTracking: false,
      initialOpen: false,
      transactional: true,
      sandbox: false,
      skipSuppression: false,
      ipPool: '',
    })
  }
}
```

:::

:::disclosure{title="Amazon SES"}

SES configuration options are forwarded to Nodemailer. You must install the AWS SDK separately.

```sh
npm i @aws-sdk/client-sesv2
```

See also: [Nodemailer SES documentation](https://nodemailer.com/transports/ses)

```ts title="config/mail.ts"
{
  mailers: {
    ses: transports.ses({
      /**
       * AWS SDK configuration
       */
      apiVersion: '2010-12-01',
      region: 'us-east-1',
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },

      /**
       * Nodemailer-specific options
       */
      sendingRate: 10,
      maxConnections: 5,
    })
  }
}
```

:::

## Sending your first email

Import the mail service and call the `send` method. The callback receives a `Message` instance for configuring the email.

```ts title="app/controllers/users_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import User from '#models/user'

export default class UsersController {
  async store({ request }: HttpContext) {
    const user = await User.create(request.all())

    /**
     * Send a welcome email after creating the user.
     * The callback configures the message properties.
     */
    await mail.send((message) => {
      message
        .to(user.email)
        .from('welcome@example.com')
        .subject('Welcome to our app!')
        .htmlView('emails/welcome', { user })
    })

    return user
  }
}
```

The `mail.send` method delivers the email immediately using the default mailer. For production applications with high traffic, you should queue emails for background delivery instead.

## Configuring the message

The `Message` class provides a fluent API for building emails. You receive an instance in the callback passed to `mail.send` or `mail.sendLater`.

### Subject and sender

```ts title="app/controllers/orders_controller.ts"
await mail.send((message) => {
  message
    .subject('Your order has shipped')
    .from('orders@example.com')
})
```

The `from` method accepts either a string or an object with address and name:

```ts title="app/controllers/orders_controller.ts"
await mail.send((message) => {
  message.from({
    address: 'orders@example.com',
    name: 'Acme Store'
  })
})
```

### Recipients

Use `to`, `cc`, and `bcc` to set recipients. Each method accepts a string, an object, or an array.

```ts title="app/controllers/reports_controller.ts"
await mail.send((message) => {
  message
    .to(user.email)
    .cc(user.manager.email)
    .bcc('audit@example.com')
})
```

```ts title="app/controllers/reports_controller.ts"
await mail.send((message) => {
  message
    .to({
      address: user.email,
      name: user.fullName,
    })
    .cc([
      { address: 'team-lead@example.com', name: 'Team Lead' },
      { address: 'pm@example.com', name: 'Project Manager' }
    ])
})
```

Set the reply-to address using the `replyTo` method:

```ts title="app/controllers/support_controller.ts"
await mail.send((message) => {
  message
    .from('noreply@example.com')
    .replyTo('support@example.com')
})
```

### Email contents

Define HTML and plain text content using `html` and `text` methods for inline content, or `htmlView` and `textView` to render Edge templates.

```ts title="app/controllers/auth_controller.ts"
await mail.send((message) => {
  /**
   * Inline content works for simple emails
   */
  message.html(`
    <h1>Reset your password</h1>
    <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
  `)

  message.text(`
    Reset your password
    Visit ${resetUrl} to reset your password.
  `)
})
```

For most emails, Edge templates provide better organization:

```sh
node ace make:view emails/password_reset_html
node ace make:view emails/password_reset_text
```

```ts title="app/controllers/auth_controller.ts"
await mail.send((message) => {
  /**
   * Render Edge templates, passing data as the second argument
   */
  message.htmlView('emails/password_reset_html', { user, resetUrl })
  message.textView('emails/password_reset_text', { user, resetUrl })
})
```

See also: [Configuring Edge](../frontend/edgejs.md)

### Using MJML for responsive emails

[MJML](https://mjml.io/) is a markup language that compiles to responsive HTML email markup. Install the package and use the `@mjml` Edge tag.

```sh
npm i mjml
```

```edge title="resources/views/emails/welcome_html.edge"
@mjml()
  <mjml>
    <mj-body>
      <mj-section>
        <mj-column>
          <mj-text font-size="20px" color="#333">
            Welcome, {{ user.name }}!
          </mj-text>
          <mj-button href="{{ verifyUrl }}">
            Verify Email
          </mj-button>
        </mj-column>
      </mj-section>
    </mj-body>
  </mjml>
@end
```

Pass [MJML options](https://documentation.mjml.io/#inside-node-js) as props to the tag:

```edge title="resources/views/emails/welcome_html.edge"
@mjml({
  keepComments: false,
  fonts: {
    Lato: 'https://fonts.googleapis.com/css?family=Lato:400,500,700'
  }
})
  {{-- MJML content --}}
@end
```

## Queueing emails

Sending emails synchronously blocks request processing while waiting for the mail provider's response. For better performance, queue emails for background delivery using `mail.sendLater`.

```ts title="app/controllers/users_controller.ts"
import mail from '@adonisjs/mail/services/main'

export default class UsersController {
  async store({ request }: HttpContext) {
    const user = await User.create(request.all())

    /**
     * Queue the email instead of sending immediately.
     * The request completes without waiting for delivery.
     */
    await mail.sendLater((message) => {
      message
        .to(user.email)
        .from('welcome@example.com')
        .subject('Welcome!')
        .htmlView('emails/welcome', { user })
    })

    return user
  }
}
```

By default, the mail messenger uses an in-memory queue. This means queued emails are lost if your process terminates before sending them.

:::warning
The in-memory messenger is suitable for development but not recommended for production. If your application crashes or restarts with pending emails in the queue, those emails will never be sent. Use a persistent queue like BullMQ for production deployments.
:::

### Using BullMQ for persistent queuing

For production applications, configure a persistent queue using BullMQ and Redis. This ensures emails survive process restarts.

```sh
npm i bullmq
```

Create a custom messenger that stores email jobs in Redis:

```ts title="start/mail.ts"
import { Queue } from 'bullmq'
import mail from '@adonisjs/mail/services/main'

const emailsQueue = new Queue('emails')

mail.setMessenger((mailer) => {
  return {
    async queue(mailMessage, config) {
      /**
       * Store the compiled message, config, and mailer name.
       * A worker process will pick this up and send it.
       */
      await emailsQueue.add('send_email', {
        mailMessage,
        config,
        mailerName: mailer.name,
      })
    }
  }
})
```

Create a worker to process the queue. Run this in a separate process:

```ts title="workers/mail_worker.ts"
import { Worker } from 'bullmq'
import mail from '@adonisjs/mail/services/main'

new Worker('emails', async (job) => {
  if (job.name === 'send_email') {
    const { mailMessage, config, mailerName } = job.data

    /**
     * Send the pre-compiled message using the specified mailer
     */
    await mail.use(mailerName).sendCompiled(mailMessage, config)
  }
})
```

## Switching between mailers

Use `mail.use()` to send emails through a specific mailer instead of the default.

```ts title="app/controllers/notifications_controller.ts"
import mail from '@adonisjs/mail/services/main'

/**
 * Send transactional emails through the default mailer
 */
await mail.send((message) => {
  message.subject('Order confirmed')
})

/**
 * Send marketing emails through Mailgun
 */
await mail.use('mailgun').send((message) => {
  message.subject('Weekly newsletter')
})

/**
 * Queue emails through a specific mailer
 */
await mail.use('resend').sendLater((message) => {
  message.subject('Your report is ready')
})
```

Mailer instances are cached for the process lifetime. To close a connection and remove it from the cache, use `mail.close()`:

```ts title="app/services/mail_service.ts"
import mail from '@adonisjs/mail/services/main'

/**
 * Close the mailgun connection and remove from cache
 */
await mail.close('mailgun')

/**
 * Next call creates a fresh instance
 */
mail.use('mailgun')
```

## Attachments

### File attachments

Attach files using the `attach` method with an absolute file path:

```ts title="app/controllers/invoices_controller.ts"
import app from '@adonisjs/core/services/app'

await mail.send((message) => {
  message.attach(app.makePath('storage/invoices/inv-001.pdf'))
})
```

Customize the attachment filename and other options:

```ts title="app/controllers/invoices_controller.ts"
await mail.send((message) => {
  message.attach(app.makePath('storage/invoices/inv-001.pdf'), {
    filename: 'invoice-october-2024.pdf',
    contentType: 'application/pdf',
  })
})
```

| Option | Description |
|--------|-------------|
| `filename` | Display name for the attachment. Defaults to the file's basename. |
| `contentType` | MIME type. Inferred from extension if not set. |
| `contentDisposition` | Either `attachment` (default) or `inline`. |
| `headers` | Custom headers as key-value pairs. |

### Attachments from streams and buffers

Use `attachData` for dynamic content from streams or buffers:

```ts title="app/controllers/reports_controller.ts"
import fs from 'node:fs'

await mail.send((message) => {
  /**
   * Attach from a readable stream
   */
  message.attachData(fs.createReadStream('./report.pdf'), {
    filename: 'report.pdf'
  })

  /**
   * Attach from a buffer
   */
  message.attachData(Buffer.from('Hello world'), {
    filename: 'greeting.txt',
    encoding: 'utf-8',
  })
})
```

:::warning
Do not use `attachData` with `mail.sendLater`. Queued emails are serialized to JSON, so streams cannot be stored and buffers significantly increase storage size. Attempting to queue an email with a stream attachment will fail. Instead, save the file to disk first and use `attach` with the file path.
:::

### Embedding images

Embed images directly in HTML content using the `embedImage` helper in your Edge template. This uses CID (Content-ID) attachments, which display reliably across email clients.

```edge title="resources/views/emails/newsletter.edge"
<img src="{{ embedImage(app.makePath('assets/logo.png')) }}" alt="Logo" />
```

The helper returns a `cid:` URL and automatically adds the image as an attachment.

For dynamic image data, use `embedImageData`:

```edge title="resources/views/emails/report.edge"
<img src="{{ embedImageData(chartBuffer, { filename: 'chart.png' }) }}" />
```

## Calendar invites

Attach calendar events using the `icalEvent` method. You can provide raw iCalendar content or use the fluent API.

```ts title="app/controllers/meetings_controller.ts"
import { DateTime } from 'luxon'

await mail.send((message) => {
  message.icalEvent((calendar) => {
    calendar.createEvent({
      summary: 'Project kickoff meeting',
      start: DateTime.now().plus({ days: 1 }).set({ hour: 10 }),
      end: DateTime.now().plus({ days: 1 }).set({ hour: 11 }),
      location: 'Conference Room A',
    })
  }, {
    method: 'REQUEST',
    filename: 'meeting.ics',
  })
})
```

The calendar object is an instance of [ical-generator](https://www.npmjs.com/package/ical-generator).

Load invite content from a file or URL:

```ts title="app/controllers/meetings_controller.ts"
import app from '@adonisjs/core/services/app'

await mail.send((message) => {
  /**
   * From a local file
   */
  message.icalEventFromFile(
    app.resourcesPath('invites/standup.ics'),
    { method: 'REQUEST', filename: 'standup.ics' }
  )

  /**
   * From a URL
   */
  message.icalEventFromUrl(
    'https://example.com/calendar/event-123.ics',
    { method: 'REQUEST', filename: 'event.ics' }
  )
})
```

## Custom headers

Add custom headers using the `header` method:

```ts title="app/controllers/notifications_controller.ts"
await mail.send((message) => {
  message.header('X-Entity-Ref', 'order-12345')
  message.header('X-Priority', '1')
})
```

For headers that should not be encoded or folded, use `preparedHeader`:

```ts title="app/controllers/notifications_controller.ts"
await mail.send((message) => {
  message.preparedHeader(
    'X-Custom-Data',
    'value with special chars or very long content'
  )
})
```

### List headers

Helper methods simplify common List-* headers for mailing list functionality:

```ts title="app/controllers/newsletters_controller.ts"
await mail.send((message) => {
  message.listUnsubscribe({
    url: 'https://example.com/unsubscribe?token=abc',
    comment: 'Unsubscribe from this list'
  })

  message.listHelp('support@example.com?subject=help')

  /**
   * For other List-* headers
   */
  message.addListHeader('post', 'https://example.com/list/post')
})
```

See also: [Nodemailer list headers documentation](https://nodemailer.com/message/list-headers)

## Class-based emails

For complex applications, organize emails into dedicated classes instead of inline callbacks. This improves testability and keeps controllers focused on request handling.

```sh
node ace make:mail verify_email
```

```ts title="app/mails/verify_email.ts"
import User from '#models/user'
import router from '@adonisjs/core/services/router'
import { BaseMail } from '@adonisjs/mail'

export default class VerifyEmailNotification extends BaseMail {
  /**
   * Set class properties for common message options
   */
  from = 'noreply@example.com'
  subject = 'Please verify your email address'

  constructor(private user: User) {
    super()
  }

  /**
   * Configure the message in the prepare method.
   * Called automatically before sending.
   */
  prepare() {
    const verifyUrl = router.makeUrl('email.verify', {
      token: this.user.verificationToken
    })

    this.message
      .to(this.user.email)
      .htmlView('emails/verify_email', {
        user: this.user,
        verifyUrl,
      })
  }
}
```

Send the email by passing an instance to `mail.send` or `mail.sendLater`:

```ts title="app/controllers/auth_controller.ts"
import mail from '@adonisjs/mail/services/main'
import VerifyEmailNotification from '#mails/verify_email'

export default class AuthController {
  async register({ request }: HttpContext) {
    const user = await User.create(request.all())

    await mail.sendLater(new VerifyEmailNotification(user))

    return { message: 'Check your email to verify your account' }
  }
}
```

| Property/Method | Description |
|-----------------|-------------|
| `from` | Default sender address. Override with `message.from()` in `prepare`. |
| `subject` | Default subject line. Override with `message.subject()` in `prepare`. |
| `replyTo` | Default reply-to address. |
| `prepare()` | Configure the message. Called automatically before sending. |
| `build()` | Inherited from `BaseMail`. Calls `prepare` and compiles the message. |

See also: [Make mail command](../../reference/commands.md#makemail)

## Testing

The mail package provides a fake mailer for testing email functionality without actually sending emails.

### Using the fake mailer

Call `mail.fake()` to intercept all emails. The returned object contains a `mails` property for assertions.

```ts title="tests/functional/users/register.spec.ts"
import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import VerifyEmailNotification from '#mails/verify_email'

test.group('Users | register', () => {
  test('sends verification email on registration', async ({ client }) => {
    /**
     * Fake the mailer. The `using` keyword automatically
     * restores the real mailer when the test ends.
     */
    // [!code highlight]
    using fake = mail.fake()

    await client
      .post('/register')
      .form({ email: 'user@example.com', password: 'secret123' })

    /**
     * Assert the email was sent
     */
    fake.mails.assertSent(VerifyEmailNotification, ({ message }) => {
      return message
        .hasTo('user@example.com')
        .hasSubject('Please verify your email address')
    })
  })

  test('does not send password reset when user not found', async ({ client }) => {
    // [!code highlight]
    using fake = mail.fake()

    await client
      .post('/forgot-password')
      .form({ email: 'unknown@example.com' })

    fake.mails.assertNotSent(PasswordResetNotification)
  })
})
```

You can also call `mail.restore()` manually if you need more control over when the real mailer is restored.

### Assertion methods

The `mails` object provides these assertion methods:

| Method | Description |
|--------|-------------|
| `assertSent(Mail, finder?)` | Assert an email class was sent. Optional finder callback for additional checks. |
| `assertNotSent(Mail, finder?)` | Assert an email class was not sent. |
| `assertSentCount(count)` | Assert total number of emails sent. |
| `assertSentCount(Mail, count)` | Assert number of emails sent for a specific class. |
| `assertNoneSent()` | Assert no emails were sent. |
| `assertQueued(Mail, finder?)` | Assert an email was queued via `sendLater`. |
| `assertNotQueued(Mail, finder?)` | Assert an email was not queued. |
| `assertQueuedCount(count)` | Assert total number of queued emails. |
| `assertQueuedCount(Mail, count)` | Assert number of queued emails for a specific class. |
| `assertNoneQueued()` | Assert no emails were queued. |

### Testing mail classes directly

Test mail classes in isolation by building them without sending:

```ts title="tests/unit/mails/verify_email.spec.ts"
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import VerifyEmailNotification from '#mails/verify_email'

test.group('VerifyEmailNotification', () => {
  test('builds correct message', async () => {
    const user = await UserFactory.create()
    const email = new VerifyEmailNotification(user)

    /**
     * Build the message and render templates
     */
    await email.buildWithContents()

    /**
     * Assert message properties
     */
    email.message.assertTo(user.email)
    email.message.assertFrom('noreply@example.com')
    email.message.assertSubject('Please verify your email address')

    /**
     * Assert rendered content
     */
    email.message.assertHtmlIncludes(`Hello ${user.name}`)
    email.message.assertHtmlIncludes('/verify/')
  })
})
```

### Accessing sent emails

Retrieve the list of sent or queued emails for custom assertions:

```ts title="tests/functional/notifications.spec.ts"
using fake = mail.fake()

/**
 * Get all sent emails
 */
const sentEmails = fake.mails.sent()

/**
 * Get all queued emails
 */
const queuedEmails = fake.mails.queued()

/**
 * Find a specific email
 */
const verifyEmail = sentEmails.find((email) => {
  return email instanceof VerifyEmailNotification
})

if (verifyEmail) {
  verifyEmail.message.assertHtmlIncludes('Verify your email')
}
```

## Custom transports

Create custom transports to integrate mail providers not included in the package. A transport wraps a Nodemailer transport and normalizes its response.

```ts title="app/mail/transports/postmark.ts"
import nodemailer from 'nodemailer'
import postmarkTransport from 'nodemailer-postmark-transport'
import { MailResponse } from '@adonisjs/mail'
import type { NodeMailerMessage, MailTransportContract } from '@adonisjs/mail/types'

export type PostmarkConfig = {
  auth: {
    apiKey: string
  }
}

export class PostmarkTransport implements MailTransportContract {
  #config: PostmarkConfig

  constructor(config: PostmarkConfig) {
    this.#config = config
  }

  async send(
    message: NodeMailerMessage,
    config?: PostmarkConfig
  ): Promise<MailResponse> {
    /**
     * Create nodemailer transport with merged config
     */
    const transporter = nodemailer.createTransport(
      postmarkTransport({ ...this.#config, ...config })
    )

    const response = await transporter.sendMail(message)

    /**
     * Return normalized response
     */
    return new MailResponse(response.messageId, response.envelope, response)
  }
}
```

Create a factory function for use in the config file:

```ts title="app/mail/transports/postmark.ts"
import type { MailManagerTransportFactory } from '@adonisjs/mail/types'

export function postmarkTransport(
  config: PostmarkConfig
): MailManagerTransportFactory {
  return () => new PostmarkTransport(config)
}
```

Register the transport in your config:

```ts title="config/mail.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/mail'
import { postmarkTransport } from '#app/mail/transports/postmark'

const mailConfig = defineConfig({
  mailers: {
    postmark: postmarkTransport({
      auth: {
        apiKey: env.get('POSTMARK_API_KEY'),
      },
    }),
  },
})
```

## Custom template engine

By default, the mail package uses Edge for rendering email templates. To use a different template engine, override the static `templateEngine` property on the `Message` class.

```ts title="start/mail.ts"
import { Message } from '@adonisjs/mail'

Message.templateEngine = {
  async render(templatePath, data) {
    /**
     * Use your preferred template engine
     */
    return myTemplateEngine.render(templatePath, data)
  }
}
```

## Events

The mail package emits events during the email lifecycle.

See also: [Events reference](../../reference/events.md#mailsending)
