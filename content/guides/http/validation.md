---
summary: Learn how to validate user input in AdonisJS using VineJS validators at the controller level.
---

# Validation

This guide will show you how to create validators, use them in controllers, handle validation errors, customize error messages, and work with different data sources beyond the request body.

## Overview

Validation in AdonisJS happens at the controller level, allowing you to validate and abort requests early if the provided data is invalid. This approach lets you model validations around forms or expected request data rather than coupling validations to your models layer.

Once data passes validation, you can trust it completely and pass it to other layers of your application—whether services, data models, or business logic—without additional checks. This creates a clear trust boundary in your application architecture.

## VineJS - The validation library

AdonisJS comes pre-bundled with [VineJS](https://vinejs.dev), a superfast validation library. While you can use a different validation library and uninstall VineJS, VineJS provides additional validation rules specifically designed for AdonisJS, such as checking for uniqueness within the database or validating multipart file uploads.

## Creating your first validator

Validators in AdonisJS are stored in the `app/validators` directory, with one file per resource containing all validators for that resource's actions. Let's create a validator for blog posts.

### Step 1: Generate the validator file

Run the following command to create a new validator:

```bash
node ace make:validator post
```

This creates an empty validator file at `app/validators/post.ts` with the VineJS import:

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'
```

### Step 2: Define your validation schema

Add a validator for creating posts. We'll validate the `title`, `body`, and `publishedAt` fields:

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

/**
 * Validator for creating a new post.
 * The vine.compile() method compiles your schema into an optimized validator.
 * The vine.object() defines the structure of expected data.
 */
export const createPostValidator = vine.compile(
  vine.object({
    title: vine.string(),
    body: vine.string(),
    publishedAt: vine.date()
  })
)
```

### Step 3: Use the validator in your controller

Import the validator into your controller and use the `request.validateUsing()` method to validate the request body:

```ts title="app/controllers/posts_controller.ts"
import { createPostValidator } from '#validators/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ request }: HttpContext) {
    /**
     * Validate the request body against the createPostValidator.
     * The request.validateUsing() method automatically validates the request body.
     * You don't need to explicitly pass the body - the request object has access to it.
     * If validation fails, an exception is thrown and handled automatically.
     * The validated payload is returned and safe to use.
     */
    const payload = await request.validateUsing(createPostValidator)
    
    // Now you can trust and use the payload
    // Create post, save to database, etc.
  }
}
```

### What you learned

You now know how to:
- ✅ Generate a validator file using `node ace make:validator`
- ✅ Define a validation schema using VineJS
- ✅ Compile a schema into a validator with `vine.compile()`
- ✅ Use the validator in a controller with `request.validateUsing()`

## Understanding error handling

When validation fails, the `validateUsing()` method throws an exception. You don't need to manually handle this exception—AdonisJS's global exception handler automatically converts it into an appropriate response based on the request type using content negotiation.

### How content negotiation works

AdonisJS detects what kind of response the client expects and formats validation errors accordingly:

**For hypermedia applications (traditional server-rendered apps):**
- The user is redirected back to the form
- Error messages are flashed to the session using AdonisJS's session flash store
- You can display these errors in your template

**For Inertia applications:**
- The user is redirected back to the form
- Error messages are shared via Inertia's shared state
- Errors are automatically available in your frontend components

**For API requests (clients expecting JSON):**
- A JSON response is returned with status code 422
- The response contains an `errors` array with all validation error messages
- Each error includes the field name, rule that failed, and error message

```json
{
  "errors": [
    {
      "field": "title",
      "rule": "required",
      "message": "The title field is required"
    },
    {
      "field": "publishedAt",
      "rule": "date",
      "message": "The publishedAt field must be a valid date"
    }
  ]
}
```

This automatic handling means you write validation logic once, and it works correctly for all application types without additional code.

See also: [Flash messages guide](./flash_messages.md), [Exception handling guide](./exception_handling.md)


:::tip
**Common confusion**: You don't need to wrap `validateUsing()` in try/catch blocks. The global exception handler already converts validation exceptions into proper responses. Only use try/catch if you need custom error handling logic that differs from the default behavior.
:::


## Customizing error messages

By default, VineJS provides generic error messages. You can customize these messages globally in two ways: using a custom messages provider or using the i18n package for localized messages.

### Using a custom messages provider

Create a `start/validator.ts` file to configure global custom messages. First, generate the preload file:

```bash
node ace make:preload validator
```

Then define your custom messages using the `SimpleMessagesProvider`:

```ts title="start/validator.ts"
import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Configure custom validation error messages.
 * The {{ field }} placeholder is automatically replaced with the actual field name.
 * Field-specific messages (like username.required) take precedence over global messages.
 */
vine.messagesProvider = new SimpleMessagesProvider({
  // Global messages applicable to all fields
  'required': 'The {{ field }} field is required',
  'string': 'The value of {{ field }} field must be a string',
  'email': 'The value is not a valid email address',
  
  // Field-specific messages override global messages
  'username.required': 'Please choose a username for your account',
})
```

### Using i18n for localized messages

For applications that need multiple languages, use the `@adonisjs/i18n` package to define validation messages in translation files. This allows you to provide validation errors in different languages based on the user's locale.

First, install and configure the i18n package (see the [i18n guide](./i18n.md) for full setup instructions). Then define your messages in language-specific JSON files:

```json title="resources/lang/en/validator.json"
{
  "shared": {
    "fields": {
      "first_name": "first name",
      "email": "email address"
    },
    "messages": {
      "required": "Enter {field}",
      "username.required": "Choose a username for your account",
      "email": "The email must be valid"
    }
  }
}
```

The `fields` object defines human-readable names for your form fields, while the `messages` object defines the error messages. This separation allows you to reuse field names across different messages.

See also: [i18n guide](./i18n.md), [VineJS error messages documentation](https://vinejs.dev/docs/error_messages)

## Validating different data sources

While the request body is the most common data source to validate, you often need to validate other parts of the HTTP request, such as query strings, route parameters, headers, or cookies.

### Validating query strings, params, headers, and cookies

Define nested objects in your schema for each data source you want to validate:

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'

export const showUserValidator = vine.compile(
  vine.object({
    // Validate fields from the request body
    username: vine.string(),
    password: vine.string(),
    
    // Validate route parameters
    params: vine.object({
      id: vine.number()
    }),
    
    // Validate query string parameters
    qs: vine.object({
      page: vine.number().optional(),
      limit: vine.number().optional()
    }),
    
    // Validate cookies
    cookies: vine.object({
      sessionId: vine.string()
    }),
    
    // Validate headers
    headers: vine.object({
      'x-api-key': vine.string()
    })
  })
)
```

The validator automatically extracts data from the correct location based on these property names (`params`, `qs`, `cookies`, `headers`).

When you call `request.validateUsing()`, all these sources are validated simultaneously:

```ts title="app/controllers/users_controller.ts"
import { showUserValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async show({ request }: HttpContext) {
    /**
     * Validates body, params, query string, cookies, and headers
     * all in a single call.
     */
    const payload = await request.validateUsing(showUserValidator)
    
    // Access validated data
    console.log(payload.params.id)
    console.log(payload.qs?.page)
    console.log(payload.cookies.sessionId)
  }
}
```

This approach allows you to validate all incoming request data in one place, creating a complete trust boundary for your controller logic.

## Passing metadata to validators

Sometimes validators need access to request-specific information that isn't part of the data being validated. A common example is validating email uniqueness while allowing the current user to keep their existing email.

### Defining metadata in the validator

Use the `withMetaData()` method to define what metadata your validator expects:

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'
import { uniqueRule } from '@vinejs/vine/database'

/**
 * Validator for updating user profile.
 * The withMetaData() method defines what metadata this validator expects.
 * It accepts a TypeScript type defining the shape of metadata.
 * Inside validation rules, access metadata via field.meta
 */
export const updateUserValidator = vine
  .withMetaData<{ userId: number }>()
  .compile(
    vine.object({
      email: vine.string().email().use(
        uniqueRule({
          table: 'users',
          column: 'email',
          /**
           * Filter callback excludes the current user's row
           * when checking for uniqueness.
           */
          filter: (db, value, field) => {
            db.whereNot('id', field.meta.userId)
          }
        })
      )
    })
  )
```

### Passing metadata during validation

Provide the metadata when calling `validateUsing()`:

```ts title="app/controllers/users_controller.ts"
import { updateUserValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async update({ request, auth }: HttpContext) {
    /**
     * Pass the current user's ID as metadata.
     * The validator uses this to exclude the user's own record
     * from the uniqueness check.
     */
    const payload = await request.validateUsing(updateUserValidator, {
      meta: {
        userId: auth.user!.id
      }
    })
    
    // Update user with validated data
  }
}
```

This pattern is useful whenever validation logic needs information from the current request context, such as the authenticated user, tenant ID, or other request-specific values.

## Using validators outside HTTP requests

Validators aren't limited to HTTP requests. You can use them anywhere you need to validate data, such as in background jobs, console commands, or service classes.

### Validating data directly

Call the `validate()` method directly on your compiled validator:

```ts title="app/jobs/import_posts_job.ts"
import { createPostValidator } from '#validators/post'

export default class ImportPostsJob {
  async handle(data: unknown[]) {
    for (const item of data) {
      try {
        /**
         * Validate each item using the validator directly.
         * The validate() method returns the validated payload if successful,
         * or throws an exception if validation fails.
         */
        const validPost = await createPostValidator.validate(item)
        
        // Process valid post data
        await Post.create(validPost)
      } catch (error) {
        // Handle validation errors for this item
        console.error('Invalid post data:', error.messages)
      }
    }
  }
}
```

Unlike `request.validateUsing()`, you'll typically want to handle these exceptions yourself in non-HTTP contexts, as there's no automatic error response.

This approach ensures consistent validation logic across your entire application, whether handling HTTP requests, processing background jobs, or validating data in any other context.

## Next steps

Now that you understand validation in AdonisJS, you can:
- Explore the [VineJS documentation](https://vinejs.dev) to discover all available schema types and validation rules
- Learn about [flash messages](./flash_messages.md) to display validation errors in your templates
- Read the [exception handling guide](./exception_handling.md) to understand how AdonisJS processes validation errors
- Check out the [i18n guide](./i18n.md) for localizing validation messages in multiple languages