---
description: Complete reference for configuring the BodyParser middleware, including parser options, data normalization, and request body limits.
---

# Body parser configuration

This reference guide covers the BodyParser middleware configuration, including: allowed HTTP methods for parsing, automatic data normalization (empty strings to null, whitespace trimming), and individual parser settings for JSON, HTML forms, multipart file uploads, and raw request bodies.

## Overview

The BodyParser middleware automatically parses incoming request bodies based on their Content-Type header, converting raw request data into structured objects your application can work with. Without bodyparser, you would need to manually read and parse request streams for every endpoint that accepts data.

The middleware is registered in `start/kernel.ts` and configured via the `config/bodyparser.ts` file. The configuration allows you to control which HTTP methods trigger parsing, enable data normalization features, set security limits on request body size, and customize behavior for each parser type (JSON, forms, multipart, raw).

See also: [Reading request body](../../guides/basics/request.md#reading-request-body-and-files)  
See also: [File uploads](../../guides/basics/file_uploads.md)

## Configuration structure

The configuration file exports a configuration object using the `defineConfig` method. Here's the complete structure:
```ts
// title: config/bodyparser.ts
import { defineConfig } from '@adonisjs/core/bodyparser'

export default defineConfig({
  /**
   * The HTTP methods for which to parse the request body
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Settings for parsing HTML forms
   */
  form: {},

  /**
   * Settings for parsing JSON request body
   */
  json: {},

  /**
   * Settings for multipart requests with file uploads
   */
  multipart: {},

  /**
   * Settings for parsing raw text payloads
   */
  raw: {},
})
```

## Allowed methods

The `allowedMethods` property defines which HTTP methods should trigger request body parsing. The bodyparser middleware will only attempt to parse request bodies for the methods listed in this array.
```ts
{
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
}
```

By default, the configuration includes methods that typically send request bodies. However, you can modify this array to add or remove methods based on your application's needs. For example, if your API accepts `PATCH` requests without bodies, you might remove it from this list.

## Data normalization features

The bodyparser provides two data normalization features that apply across multiple parsers: converting empty strings to null and trimming whitespace from string values.

### Converting empty strings to null

HTML forms send an empty string in the request body when an input field has no value. This behavior makes data normalization at the database layer more difficult.

For example, if you have a database column `country` set to nullable, you would want to store `null` as a value when the user does not select a country. However, with HTML forms, the backend receives an empty string, and you might insert an empty string into the database instead of leaving the column as `null`.

The BodyParser middleware handles this inconsistency by converting all empty string values to `null` when the `convertEmptyStringsToNull` flag is enabled. This works at all nesting levels within the parsed data structure.
```ts
{
  form: {
    convertEmptyStringsToNull: true
  },
  json: {
    convertEmptyStringsToNull: true
  },
  multipart: {
    convertEmptyStringsToNull: true
  }
}
```

**Example transformation:**
```ts
// Request body (before parsing)
{
  "name": "John",
  "country": "",
  "preferences": {
    "newsletter": "",
    "notifications": "email"
  }
}

// Parsed result (with convertEmptyStringsToNull: true)
{
  "name": "John",
  "country": null,
  "preferences": {
    "newsletter": null,
    "notifications": "email"
  }
}
```

### Trimming whitespace

The `trimWhitespaces` option removes leading and trailing whitespace from all string values in the parsed request body. This is particularly useful when processing form inputs where users might accidentally include extra spaces.

The whitespace trimming works at all nesting levels and only affects string values, leaving other data types unchanged.
```ts
{
  form: {
    trimWhitespaces: true
  },
  json: {
    trimWhitespaces: true
  },
  multipart: {
    trimWhitespaces: true
  }
}
```

**Example transformation:**
```ts
// Request body (before parsing)
{
  "username": "  john_doe  ",
  "profile": {
    "bio": "  Software developer  "
  }
}

// Parsed result (with trimWhitespaces: true)
{
  "username": "john_doe",
  "profile": {
    "bio": "Software developer"
  }
}
```

## JSON parser

Use the JSON parser when your API accepts structured data from JavaScript clients, mobile apps, or other services sending JSON-encoded payloads. The parser handles requests with a `Content-type` header matching one of the configured types.

### Configuration options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `encoding` | `string` | Character encoding for converting the request body Buffer to string. Supports any encoding from [iconv-lite](https://www.npmjs.com/package/iconv-lite#readme). | `'utf-8'` |
| `limit` | `string \| number` | Maximum size of the request body. Returns a `413` error if exceeded. | `'1mb'` |
| `strict` | `boolean` | When enabled, only allows objects and arrays at the top level of JSON. Rejects primitive values like strings or numbers as the root element. | `true` |
| `types` | `string[]` | Array of Content-Type header values that should be parsed using the JSON parser. | See below |
| `convertEmptyStringsToNull` | `boolean` | Converts empty strings to `null` at all nesting levels. | `true` |
| `trimWhitespaces` | `boolean` | Removes leading and trailing whitespace from all string values. | `true` |

### Default configuration
```ts
{
  json: {
    encoding: 'utf-8',
    limit: '1mb',
    strict: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
  }
}
```

### Adding custom content types

You can extend the `types` array to handle custom JSON-based content types your application needs to support. Parameters like `charset` are ignored during matching, so you only list the media type itself.
```ts
{
  json: {
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
      // insert-start
      'application/custom+json',
      // insert-end
    ],
  }
}
```

## Form parser

Use the form parser for HTML form submissions with URL-encoded data. This is the standard encoding for forms submitted via `<form>` elements without file uploads. The parser handles requests with the `Content-type` header set to `application/x-www-form-urlencoded`.

### Configuration options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `encoding` | `string` | Character encoding for converting the request body Buffer to string. Supports any encoding from [iconv-lite](https://www.npmjs.com/package/iconv-lite#readme). | `'utf-8'` |
| `limit` | `string \| number` | Maximum size of the request body. Returns a `413` error if exceeded. | `'1mb'` |
| `queryString` | `object` | Configuration options for the [qs package](https://www.npmjs.com/package/qs) used to parse URL-encoded data. | `{}` |
| `types` | `string[]` | Array of Content-Type header values that should be parsed using the form parser. | `['application/x-www-form-urlencoded']` |
| `convertEmptyStringsToNull` | `boolean` | Converts empty strings to `null` at all nesting levels. | `true` |
| `trimWhitespaces` | `boolean` | Removes leading and trailing whitespace from all string values. | `true` |

### Default configuration
```ts
{
  form: {
    encoding: 'utf-8',
    limit: '1mb',
    queryString: {},
    types: ['application/x-www-form-urlencoded'],
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
  }
}
```

### Query string options

The form parser uses the [qs package](https://www.npmjs.com/package/qs) internally. You can customize its behavior using the `queryString` property:
```ts
{
  form: {
    queryString: {
      allowDots: true,      // Parse dot notation (user.name)
      allowSparse: true,    // Allow sparse arrays
      depth: 10,            // Maximum depth of nested objects
    },
  }
}
```

See also: [qs package documentation](https://www.npmjs.com/package/qs) for all available options.

## Multipart parser

Use the multipart parser for HTML forms that include file uploads. The parser handles requests with the `Content-type` header set to `multipart/form-data`, automatically processing uploaded files and form fields.

See also: [File uploads guide](../../guides/basics/file_uploads.md)

### Configuration options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `autoProcess` | `boolean \| string[]` | Controls automatic file processing. When `true`, processes files for all routes. When an array, only processes files for matching route patterns. When `false`, requires manual stream processing. | `true` |
| `processManually` | `string[]` | Array of route patterns where auto-processing should be disabled, even when `autoProcess` is `true`. | `[]` |
| `fieldsLimit` | `string \| number` | Maximum combined size of all form fields (non-file data). Returns a `413` error if exceeded. When omitted, the underlying multipart parser applies a `2mb` limit. | `undefined` |
| `maxFields` | `number` | Maximum number of form fields (non-file data) accepted in a single request. Returns a `413` error if exceeded. | `1000` |
| `limit` | `string \| number` | Maximum total size of the multipart request, including all uploaded files. Returns a `413` error if exceeded. Individual file limits can be set using `request.file()`. | `'20mb'` |
| `tmpFileName` | `() => string` | Function returning the name of the temporary file created for each upload in the `tmp` directory. | Random UUID |
| `types` | `string[]` | Array of Content-Type header values that should be parsed using the multipart parser. | `['multipart/form-data']` |
| `convertEmptyStringsToNull` | `boolean` | Converts empty strings to `null` at all nesting levels for form fields. | `true` |
| `trimWhitespaces` | `boolean` | Removes leading and trailing whitespace from all string field values. | `true` |

### Default configuration
```ts
{
  multipart: {
    autoProcess: true,
    processManually: [],
    maxFields: 1000,
    limit: '20mb',
    types: ['multipart/form-data'],
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
  }
}
```

### Controlling auto-processing

By default, the bodyparser automatically moves all uploaded files to the `tmp` directory of your operating system when `autoProcess` is `true`. You can then validate the files in your controller and move them to a persistent location or cloud storage.

**Selective auto-processing:**

You can limit auto-processing to specific routes by providing an array of route patterns. The patterns must match exactly with route definitions from `start/routes.ts` (the check is `request.route.pattern === mentionedPattern`).
```ts
{
  multipart: {
    autoProcess: [
      '/uploads',
      '/posts/:id/attachments'
    ],
  }
}
```

**Disabling auto-processing for specific routes:**

Use `processManually` to disable auto-processing for specific routes while keeping it enabled globally. This is useful when you need to handle file streams directly for certain endpoints.
```ts
{
  multipart: {
    autoProcess: true,
    processManually: [
      '/file_manager',
      '/projects/:id/assets'
    ],
  }
}
```

:::warning

**Route pattern matching**: The `autoProcess` and `processManually` options require exact route pattern matches. The pattern must be identical to how you defined it in `start/routes.ts`.

**Example:**
```ts
// title: start/routes.ts
router.post('/posts/:id/upload', handler)

// title: config/bodyparser.ts
autoProcess: ['/posts/:id/upload'] // ✅ Exact match
autoProcess: ['/posts/*/upload']   // ❌ Won't match
```

:::

See also: [Self-processing multipart streams](../../guides/basics/file_uploads.md#self-processing-multipart-streams)

## Raw parser

Use the raw parser when your application needs to handle request bodies with content types not covered by the other parsers. This is useful for formats like XML, CSV, or custom text-based protocols. The raw parser stores the request body as a string, which you can then parse manually in your controller using `request.raw()`.

### Configuration options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `encoding` | `string` | Character encoding for converting the request body Buffer to string. Supports any encoding from [iconv-lite](https://www.npmjs.com/package/iconv-lite#readme). | `'utf-8'` |
| `limit` | `string \| number` | Maximum size of the request body. Returns a `413` error if exceeded. | `'1mb'` |
| `types` | `string[]` | Array of Content-Type header values that should be captured as raw text. | `['text/*']` |

### Default configuration
```ts
{
  raw: {
    encoding: 'utf-8',
    limit: '1mb',
    types: ['text/*'],
  }
}
```

### Example: Handling XML requests
```ts
// title: config/bodyparser.ts
{
  raw: {
    encoding: 'utf-8',
    limit: '1mb',
    types: [
      'text/*',
      // insert-start
      'application/xml',
      'text/xml',
      // insert-end
    ],
  }
}
```
```ts
// title: app/controllers/webhooks_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import { parseXML } from 'some-xml-parser'

export default class WebhooksController {
  async handle({ request }: HttpContext) {
    /**
     * Access the raw request body as a string
     */
    const rawBody = request.raw()
    
    /**
     * Parse it using your preferred XML parser
     */
    const data = parseXML(rawBody)
    
    // Process the parsed data
  }
}
```

See also: [Raw parser for custom content types](../../guides/basics/body_parser.md#raw-parser-for-custom-content-types)