---
description: Learn how to configure the body parser to handle JSON, form data, and file uploads in AdonisJS applications.
---

# Body Parser

This guide covers the body parser configuration in AdonisJS. You will learn how to:

- Configure parsers for different content types (JSON, form data, multipart)
- Set global parsing options like empty string conversion and whitespace trimming
- Adjust file upload limits and request size restrictions
- Control automatic file processing for specific routes
- Handle custom content types using the raw parser

## Overview

The body parser is responsible for parsing incoming request bodies before they reach your route handlers. It automatically detects the content type of each request and applies the appropriate parser to convert the raw request data into a usable format.

AdonisJS includes three built-in parsers: the **JSON parser** handles JSON-encoded data, the **form parser** handles URL-encoded form submissions, and the **multipart parser** handles file uploads and multipart form data. Each parser can be configured independently through the `config/bodyparser.ts` file.

You don't interact with the body parser directly in your application code. Instead, you access the parsed data through the Request class using methods like `request.all()`, `request.body()`, or `request.file()`. The body parser runs as middleware and processes request bodies automatically before your route handlers execute.

See also: [Request class documentation](./request.md) for accessing parsed request data.

## Configuration

The body parser is configured in the `config/bodyparser.ts` file. The configuration file is created automatically when you create a new AdonisJS application.

```ts title="config/bodyparser.ts"
import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  form: {
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
    types: ['application/x-www-form-urlencoded'],
  },

  json: {
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  multipart: {
    autoProcess: true,
    convertEmptyStringsToNull: true,
    trimWhitespaces: true,
    processManually: [],
    limit: '20mb',
    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig
```

:::option{name="allowedMethods"}

The `allowedMethods` array defines which HTTP methods should have their request bodies parsed. By default, only `POST`, `PUT`, `PATCH`, and `DELETE` requests are processed. GET requests are excluded because they typically don't include request bodies. Add `QUERY` to the list to parse the body of [QUERY requests](./routing.md#the-query-method).

:::

## Global parsing options

Two global options are available across all parsers: `convertEmptyStringsToNull` and `trimWhitespaces`. These options help normalize incoming data before it reaches your application logic.

:::option{name="convertEmptyStringsToNull"}

The `convertEmptyStringsToNull` option converts all empty strings in the request body to `null` values. This option solves a common problem with HTML forms.

When an HTML form input field has no value, browsers send an empty string in the request body rather than omitting the field entirely. This behavior creates challenges for database normalization, especially with nullable columns.

Consider a user registration form with an optional "country" field. Your database has a nullable `country` column, and you want to store `null` when the user doesn't select a country. However, the HTML form sends an empty string, which means you would insert an empty string into the database instead of leaving the column as `null`.

Enabling `convertEmptyStringsToNull` handles this inconsistency automatically. The body parser converts all empty strings to `null` before your validation or database logic runs.

```ts title="config/bodyparser.ts"
json: {
  convertEmptyStringsToNull: true,
}
```

:::

:::option{name="trimWhitespaces"}

The `trimWhitespaces` option removes leading and trailing whitespace from all string values in the request body. This helps eliminate accidental whitespace that users might include when submitting forms.

Instead of manually trimming values in your controllers or validators, you can enable this option and let the body parser handle whitespace removal globally.

```ts title="config/bodyparser.ts"
form: {
  trimWhitespaces: true,
}
```

:::

## JSON parser

The JSON parser handles requests with JSON-encoded bodies. It processes several content types by default, including `application/json`, `application/json-patch+json`, `application/vnd.api+json`, and `application/csp-report`.

:::option{name="encoding"}

The `encoding` option specifies the character encoding to use when converting the request body Buffer to a string. The default is `utf-8`, which handles most use cases. You can use any encoding supported by the [iconv-lite](https://www.npmjs.com/package/iconv-lite) package.

```ts title="config/bodyparser.ts"
json: {
  encoding: 'utf-8',
}
```

:::

:::option{name="limit"}

The `limit` option sets the maximum size of request body data the parser will accept. Requests that exceed this limit will receive a `413 Payload Too Large` error response.

```ts title="config/bodyparser.ts"
json: {
  limit: '1mb',
}
```

:::

:::option{name="strict"}

The `strict` option controls whether the parser accepts only objects and arrays as top-level JSON values. When enabled, the parser rejects primitive values like strings, numbers, or booleans at the root level.

```ts title="config/bodyparser.ts"
json: {
  strict: true,
}
```

:::

:::option{name="types"}

The `types` array defines which content types the JSON parser should handle. You can add custom content types if your application receives JSON data with non-standard content type headers.

```ts title="config/bodyparser.ts"
json: {
  types: [
    'application/json',
    'application/json-patch+json',
    'application/vnd.api+json',
    'application/csp-report',
    // [!code highlight]
    'application/custom+json',
  ]
}
```

:::

## Form parser

The form parser handles URL-encoded form data, typically from HTML forms with `application/x-www-form-urlencoded` content type.

:::option{name="encoding"}

The `encoding` option specifies the character encoding to use when converting the request body Buffer to a string. The default is `utf-8`, which handles most use cases. You can use any encoding supported by the [iconv-lite](https://www.npmjs.com/package/iconv-lite) package.

```ts title="config/bodyparser.ts"
form: {
  encoding: 'utf-8',
}
```

:::

:::option{name="limit"}

The `limit` option sets the maximum size of request body data the parser will accept. Requests that exceed this limit will receive a `413 Payload Too Large` error response.

```ts title="config/bodyparser.ts"
form: {
  limit: '1mb',
}
```

:::

:::option{name="queryString"}

The `queryString` option allows you to configure how the URL-encoded string is parsed into an object. These options are passed directly to the [qs](https://www.npmjs.com/package/qs) package, which handles the parsing.

```ts title="config/bodyparser.ts"
form: {
  queryString: {
    depth: 5,
    parameterLimit: 1000,
  },
}
```

See also: [qs documentation](https://www.npmjs.com/package/qs) for all available options.

:::

:::option{name="types"}

The `types` array defines which content types the form parser should handle. By default, it processes `application/x-www-form-urlencoded` requests.

```ts title="config/bodyparser.ts"
form: {
  types: ['application/x-www-form-urlencoded'],
}
```

:::

## Multipart parser

The multipart parser handles file uploads and multipart form data. It processes requests with the `multipart/form-data` content type, which browsers use when submitting forms that include file inputs.

:::option{name="autoProcess"}

The `autoProcess` option controls whether uploaded files are automatically moved to your operating system's temporary directory. When enabled, the parser streams files to disk as the request is processed.

After automatic processing, you can access uploaded files in your controllers using `request.file()`, validate them, and move them to a permanent location or cloud storage service.

```ts title="config/bodyparser.ts"
multipart: {
  autoProcess: true,
}
```

You can specify an array of route patterns to enable automatic processing for specific routes only. The values must be route patterns, not URLs.

```ts title="config/bodyparser.ts"
multipart: {
  autoProcess: [
    '/uploads',
    '/posts/:id/images',
  ],
}
```


:::option{name="processManually"}

The `processManually` array lets you disable automatic file processing for selected routes while keeping it enabled globally. This is useful when you have a few routes that need custom file handling but want the convenience of automatic processing everywhere else.

The values must be route patterns, not URLs.

```ts title="config/bodyparser.ts"
multipart: {
  autoProcess: true,
  processManually: [
    '/file-manager',
    '/projects/:id/assets',
  ],
}
```

:::

:::option{name="encoding"}

The `encoding` option specifies the character encoding to use when converting text fields in the multipart request to strings. The default is `utf-8`, which handles most use cases. You can use any encoding supported by the [iconv-lite](https://www.npmjs.com/package/iconv-lite) package.

```ts title="config/bodyparser.ts"
multipart: {
  encoding: 'utf-8',
}
```

:::

:::option{name="limit"}

The `limit` option sets the maximum total size of all uploaded files in a single request. Requests that exceed this limit will receive a `413 Payload Too Large` error response.

```ts title="config/bodyparser.ts"
multipart: {
  limit: '20mb',
}
```

:::

:::option{name="fieldsLimit"}

The `fieldsLimit` option sets the maximum total size of all form fields (not files) in the multipart request. This prevents abuse through extremely large text field submissions. Requests that exceed this limit will receive a `413 Payload Too Large` error response.

```ts title="config/bodyparser.ts"
multipart: {
  fieldsLimit: '2mb',
}
```

:::

:::option{name="tmpFileName"}

The `tmpFileName` option accepts a function that generates custom names for temporary files. By default, the parser generates random file names.

```ts title="config/bodyparser.ts"
multipart: {
  tmpFileName: () => {
    return `upload_${Date.now()}_${Math.random().toString(36)}`
  },
}
```

:::

:::option{name="types"}

The `types` array defines which content types the multipart parser should handle. By default, it processes `multipart/form-data` requests.

```ts title="config/bodyparser.ts"
multipart: {
  types: ['multipart/form-data'],
}
```

:::

## Raw parser for custom content types

The body parser includes a raw parser that can handle content types not supported by the default parsers. The raw parser provides the request body as a string, which you can then process using custom middleware.

This is useful when your application receives data in formats like XML, YAML, or other specialized content types that don't have built-in parsers.

```ts title="config/bodyparser.ts"
const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  // [!code ++:5]
  raw: {
    types: ['application/xml', 'text/xml'],
    limit: '1mb',
    encoding: 'utf-8',
  },

  form: {
    // ... form config
  },

  json: {
    // ... json config
  },

  multipart: {
    // ... multipart config
  },
})

export default bodyParserConfig
```

After enabling the raw parser for specific content types, create custom middleware to parse the string data into a usable format.

See also: [Middleware documentation](./middleware.md)

```ts title="app/middleware/xml_parser_middleware.ts"
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import xml2js from 'xml2js'

export default class XmlParserMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    if (request.header('content-type')?.includes('xml')) {
      const rawBody = request.raw()
      const parser = new xml2js.Parser()
      const parsed = await parser.parseStringPromise(rawBody)
      request.updateBody(parsed)
    }

    await next()
  }
}
```

## Form Method Spoofing

HTML forms only support GET and POST methods. Method spoofing allows you to specify other HTTP methods (PUT, PATCH, DELETE) via a query parameter, enabling full RESTful routing with standard HTML forms.

```ts
// title: config/app.ts
import env from '#start/env'
import { defineConfig } from '@adonisjs/core/http'

export const http = defineConfig({
  /**
   * Enable method spoofing for HTML forms.
   * This allows forms to use PUT, PATCH, and DELETE methods
   * by adding ?_method=PUT to the form action.
   */
  allowMethodSpoofing: true
})
```

With method spoofing enabled, you can use the `_method` query parameter in your forms:

```html
<!-- Form will be processed as a PUT request -->
<form method="POST" action="/posts/1?_method=PUT">
  <input type="text" name="title" />
  <button type="submit">Update Post</button>
</form>

<!-- Form will be processed as a DELETE request -->
<form method="POST" action="/posts/1?_method=DELETE">
  <button type="submit">Delete Post</button>
</form>
```
