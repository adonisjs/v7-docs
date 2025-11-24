---
summary: Learn how to handle and report exceptions during HTTP requests in AdonisJS applications.
---

# Exception Handling

This guide covers exception handling in AdonisJS applications. You will learn how to use the global exception handler to convert errors into HTTP responses, customize error handling for specific error types, report errors to logging services, create custom exception classes with self-contained handling logic, and configure debug mode and status pages for different environments.

## Overview

Exception handling in AdonisJS provides a centralized system for managing errors that occur during HTTP requests. Instead of wrapping every route handler and middleware in try/catch blocks, you can let errors bubble up naturally to a global exception handler.

The global exception handler is defined in `app/exceptions/handler.ts` and extends the `ExceptionHandler` class from `@adonisjs/core/http`. All unhandled exceptions during an HTTP request are automatically forwarded to this handler, keeping your code clean while ensuring consistent error responses across your application.

### The global exception handler

When you create a new AdonisJS project, the global exception handler is automatically set up for you. The handler class extends the base `ExceptionHandler` and provides two primary methods: `handle` for converting errors into HTTP responses, and `report` for logging errors or sending them to external monitoring services.

Here's what the default exception handler looks like:
```ts
// title: app/exceptions/handler.ts
import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML page for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code ranges and callbacks
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { view }) => {
      return view.render('pages/errors/not_found', { error })
    },
    '500..599': (error, { view }) => {
      return view.render('pages/errors/server_error', { error })
    },
  }

  /**
   * The method is used for handling errors and returning
   * a response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
```

The handler includes several configuration properties that control its behavior. The `debug` property determines whether errors are displayed with full stack traces using Youch, while `renderStatusPages` controls whether custom HTML error pages are rendered. The `statusPages` property maps HTTP status codes to view templates for custom error pages.

### How errors flow through the handler

When an error occurs during an HTTP request, AdonisJS automatically catches it and forwards it to the global exception handler. Let's see this in action with a simple example:
```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import { Exception } from '@adonisjs/core/exceptions'

router.get('fatal', () => {
  /**
   * Throwing an exception with a 500 status code
   * and a custom error code for identification
   */
  throw new Exception('Something went wrong', { 
    status: 500, 
    code: 'E_RUNTIME_EXCEPTION' 
  })
})
```

When you visit this route in development mode (with `debug` enabled), you'll see a beautifully formatted error page powered by Youch. The page displays the error message, the full stack trace, and helpful context about the request. This detailed error information is invaluable during development, as it helps you quickly identify and fix issues.

However, in production mode (with `debug` disabled), the same error will result in a simple JSON or plain text response containing just the error message, without exposing your application's internal structure.

### Handling specific error types

The global exception handler's `handle` method receives all unhandled errors. You can inspect the error type and provide custom handling for specific exceptions while letting others fall through to the default behavior.

Here's an example of handling validation errors with a custom response format:
```ts
// title: app/exceptions/handler.ts
import { errors as vineErrors } from '@vinejs/vine'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction
  protected renderStatusPages = app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Check if the error is a VineJS validation error
     * using instanceof to safely identify the error type
     */
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      /**
       * Return validation messages directly as JSON
       * with a 422 Unprocessable Entity status
       */
      ctx.response.status(422).send(error.messages)
      return
    }

    /**
     * For all other errors, delegate to the parent class
     * which handles the default error conversion logic
     */
    return super.handle(error, ctx)
  }
}
```

This pattern of checking error types using `instanceof` and providing custom handling is powerful and flexible. You can add as many conditional branches as needed for different error types in your application.

Here's how you might use this custom validation error handling in a route:
```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import { createPostValidator } from '#validators/post'

router.post('posts', async ({ request }) => {
  /**
   * If validation fails, VineJS throws E_VALIDATION_ERROR
   * which is caught by our custom handler and returns
   * the validation messages with a 422 status code
   */
  await request.validateUsing(createPostValidator)
})
```

### Debug mode and Youch

The `debug` property controls whether errors are displayed using Youch, an error visualization tool that creates beautiful, interactive error pages. When debug mode is enabled, Youch displays the error message, complete stack trace, request details, and even shows the exact code where the error occurred with syntax highlighting.

In production, debug mode should always be disabled to prevent exposing sensitive information. When disabled, errors are converted to simple responses using content negotiation—JSON for API requests, plain text for others—containing only the error message without implementation details.

The default configuration `protected debug = !app.inProduction` automatically handles this for you, enabling debug mode in development and disabling it in production.

:::warning

**Why this matters**: Debug mode exposes your application's source code structure and file paths through error stack traces, which can be valuable to attackers.

**The solution**: Verify that your production environment has `NODE_ENV=production` configured. The default `protected debug = !app.inProduction` setting will automatically disable debug mode when this is set correctly.

:::

### Status pages

Status pages allow you to display custom HTML pages for specific HTTP status codes. This feature is particularly useful for user-facing applications where you want to provide a branded, helpful error experience rather than a generic error message.

The `statusPages` property is a key-value map where keys are HTTP status codes or ranges, and values are callback functions that render and return HTML content. The callback receives the error object and the HTTP context, giving you full access to view rendering and error details:
```ts
protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
  /**
   * Handle 404 Not Found errors with a custom template
   */
  '404': (error, { view }) => {
    return view.render('pages/errors/not_found', { error })
  },
  /**
   * Handle all 5xx server errors with a single template
   * using a range notation
   */
  '500..599': (error, { view }) => {
    return view.render('pages/errors/server_error', { error })
  },
}
```

Status pages are only rendered when the `renderStatusPages` property is set to `true`. The default configuration enables them in production (`app.inProduction`) where custom error pages provide a better user experience, while keeping them disabled in development where detailed Youch error pages are more useful for debugging.

## Reporting errors

The `report` method serves a different purpose from the `handle` method. While `handle` is responsible for converting errors into HTTP responses for the client, `report` is responsible for logging errors or sending them to external monitoring services. These are two distinct concerns that should never be mixed.

The base `ExceptionHandler` class provides a default implementation of `report` that logs errors using AdonisJS's logger. You can override this method to add custom reporting logic, such as integrating with error monitoring services:
```ts
// title: app/exceptions/handler.ts
export default class HttpExceptionHandler extends ExceptionHandler {
  async report(error: unknown, ctx: HttpContext) {
    /**
     * First call the parent report method to ensure
     * the error is logged using the default behavior
     */
    await super.report(error, ctx)

    /**
     * Add custom reporting logic here, such as
     * sending to Sentry, Bugsnag, or other services
     */
  }
}
```

The `report` method should never attempt to send HTTP responses. Its sole purpose is to record or transmit error information for monitoring and debugging purposes.

### Adding context to error reports

The `context` method allows you to define additional data that should be included with every error report. This contextual information helps you understand the circumstances under which an error occurred, making debugging much easier.

By default, the context includes the request ID (`x-request-id` header). You can override this method to include any additional information relevant to your application:
```ts
// title: app/exceptions/handler.ts
export default class HttpExceptionHandler extends ExceptionHandler {
  protected context(ctx: HttpContext) {
    return {
      /**
       * Include the unique request ID for tracking
       * this specific request across logs
       */
      requestId: ctx.requestId,
      
      /**
       * Add the authenticated user's ID if available
       * to identify which user encountered the error
       */
      userId: ctx.auth.user?.id,
      
      /**
       * Include the IP address for security monitoring
       * and identifying patterns in errors
       */
      ip: ctx.request.ip(),
    }
  }
}
```

This context data is automatically included whenever an error is reported, giving you rich information about each error's circumstances without manually adding this data to every report call.

### Ignoring errors from reports

Not all errors need to be reported. Some errors, like validation failures or unauthorized access attempts, are expected parts of normal application flow and don't require logging or monitoring. You can configure which errors to exclude from reporting using the `ignoreStatuses` and `ignoreCodes` properties:
```ts
// title: app/exceptions/handler.ts
export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * HTTP status codes that should not be reported.
   * These are typically client errors that don't indicate
   * problems with your application.
   */
  protected ignoreStatuses = [400, 401, 403, 404, 422]

  /**
   * Error codes that should not be reported.
   * These are application-specific error codes for
   * expected error conditions.
   */
  protected ignoreCodes = ['E_VALIDATION_ERROR', 'E_UNAUTHORIZED_ACCESS']
}
```

The base `ExceptionHandler` class checks these properties in its `shouldReport` method before reporting an error. If you implement custom reporting logic, you must respect this check:
```ts
// title: app/exceptions/handler.ts
export default class HttpExceptionHandler extends ExceptionHandler {
  async report(error: unknown, ctx: HttpContext) {
    /**
     * Convert the error to a standardized HTTP error
     * format that includes status code and error code
     */
    const httpError = this.toHttpError(error)
    
    /**
     * Only report the error if it passes the shouldReport check,
     * which verifies it's not in ignoreStatuses or ignoreCodes
     */
    if (this.shouldReport(httpError)) {
      // Your custom reporting logic here
      // For example: send to external monitoring service
    }
  }
}
```

This approach ensures consistent error filtering across your application, preventing your logs and monitoring services from being overwhelmed with expected errors.

## Custom exceptions

Custom exceptions allow you to create specialized error classes for specific error conditions in your application's business logic. Unlike handling errors in the global exception handler, custom exceptions encapsulate both the error condition and its handling logic, making your error handling more organized and maintainable.

A custom exception extends the base `Exception` class and can implement its own `handle` and `report` methods. This self-contained approach is particularly useful when specific error types require unique handling or reporting logic.

### Creating a custom exception

You can create a custom exception using the `make:exception` command:
```sh
node ace make:exception PaymentFailed
```
```
CREATE: app/exceptions/payment_failed_exception.ts
```

This generates a new exception class in the `app/exceptions` directory. Here's what a complete custom exception looks like with both handling and reporting logic:
```ts
// title: app/exceptions/payment_failed_exception.ts
import { Exception } from '@adonisjs/core/exceptions'
import { HttpContext } from '@adonisjs/core/http'

export default class PaymentFailedException extends Exception {
  /**
   * The HTTP status code for this exception.
   * Set as a static property so it can be accessed
   * without instantiating the exception.
   */
  static status = 400

  /**
   * Handle the exception by converting it to an HTTP response.
   * This method is called automatically when this exception
   * is thrown and not caught.
   */
  handle(error: this, { response }: HttpContext) {
    return response
      .status(error.constructor.status)
      .send('Unable to process the payment. Please try again')
  }

  /**
   * Report the exception for logging and monitoring.
   * This method is called before handle() to record
   * the error occurrence.
   */
  report(error: this, { logger, auth }: HttpContext) {
    logger.error(
      { user: auth.user }, 
      'Payment failed for user %s', 
      auth.user?.id
    )
  }
}
```

When you throw this custom exception anywhere in your application, AdonisJS automatically calls its `handle` method to generate the HTTP response and its `report` method to log the error. The global exception handler is bypassed entirely for custom exceptions that implement these methods.

### When to use custom exceptions

Custom exceptions are ideal when you need to throw meaningful, business-logic-specific errors throughout your application. They're particularly useful for error conditions that require specialized handling or reporting.

The global exception handler, on the other hand, is meant to change the default behavior for how exceptions are handled application-wide. It's the right place for cross-cutting concerns like formatting all API errors consistently or integrating with monitoring services.

Use custom exceptions when the error is specific to your domain and requires unique handling. Use the global exception handler when you need to modify how a category of errors is processed across your entire application.

## Configuration reference

The exception handler class provides several configuration options that control error handling behavior:

| Property | Type | Description |
|----------|------|-------------|
| `debug` | `boolean` | When `true`, displays detailed error pages with stack traces using Youch. Should be `false` in production. Default: `!app.inProduction` |
| `renderStatusPages` | `boolean` | When `true`, renders custom HTML pages for configured status codes. Default: `app.inProduction` |
| `statusPages` | `Record<StatusPageRange, StatusPageRenderer>` | Maps HTTP status codes or ranges to view rendering callbacks for custom error pages. |
| `ignoreStatuses` | `number[]` | Array of HTTP status codes that should not be reported via the `report` method. |
| `ignoreCodes` | `string[]` | Array of error codes that should not be reported via the `report` method. |

## See also

- [ExceptionHandler source code](https://github.com/adonisjs/http-server/blob/8.x/src/exception_handler.ts) - Complete implementation details of the base exception handler class
- [Make exception command](../references/commands.md#makeexception) - CLI reference for generating custom exception classes