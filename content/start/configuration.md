---
description: Learn how to manage configuration and environment variables in AdonisJS applications with type-safe validation.
---

# Configuration & Environment

This guide covers configuration in AdonisJS applications. You will learn about:

- Config files in the `config` directory
- Environment variables and the `.env` file
- Validating environment variables with type safety
- Variable interpolation within `.env` files
- Environment-specific `.env` files for development, testing, and production
- Accessing configuration in Edge templates
- The `adonisrc.ts` file for framework configuration

## Overview

Configuration in AdonisJS is organized into three distinct systems, each serving a specific purpose.

- **Config files** contain your application settings. These files live in the `config` directory and define things like database connections, mail settings, and session configuration.

- **Environment variables** stored in the `.env` file hold runtime secrets and values that change between environments. API keys, database passwords, and environment-specific URLs belong here. AdonisJS supports multiple `.env` files for different environments and provides type-safe validation to catch missing variables at startup.

- **The adonisrc.ts file** configures the framework itself. It tells AdonisJS how your workspace is organized, which providers to load, and which commands are available.

## Configuration files

Configuration files live in the `config` directory at the root of your project. Each file exports a configuration object for a specific part of your application (database connections, mail settings, authentication, session handling, and so on).

A typical AdonisJS project includes several config files out of the box. The `config/database.ts` file configures database connections, `config/mail.ts` handles email delivery, and `config/auth.ts` defines authentication settings.

Here's what a database configuration file looks like.

```ts title="config/database.ts"
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'sqlite',
  prettyPrintDebugQueries: true,
  connections: {
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: app.tmpPath('db.sqlite3'),
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: app.inDev,
    },
  },
})

export default dbConfig
```

Mail configuration follows a similar pattern.
```ts title="config/mail.ts"
import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  mailers: {
    resend: transports.resend({
      key: env.get('RESEND_API_KEY'),
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
```

Notice how this config file references environment variables through `env.get()`. This is the correct way to use environment-specific values in your configuration. The config file defines the structure and defaults, while the `.env` file provides the actual values.

### When config files are loaded

Configuration files are loaded during the application boot cycle, before your routes and controllers are ready. This means you should keep config files simple and avoid importing application-level code like models, services, or controllers. 

Config files should only import framework utilities, define configuration objects, and reference environment variables. **Importing application code creates circular dependencies and will cause your app to fail during startup**.

### Accessing config in Edge templates

Edge templates have access to your application's configuration through the `config` global. This allows you to reference configuration values directly in your views without passing them explicitly from controllers.
```edge title="resources/views/layouts/main.edge"
<!DOCTYPE html>
<html>
<head>
  <title>{{ config('app.appName') }}</title>
</head>
<body>
  <footer>
    <p>Running in {{ config('app.nodeEnv') }} mode</p>
  </footer>
</body>
</html>
```

The `config()` helper accepts a dot-notation path to any configuration value. The path corresponds to the config file name and the property within it. For example, `config('database.connection')` reads the `connection` property from `config/database.ts`.

You can also provide a default value as the second argument.
```edge
<p>{{ config('app.timezone', 'UTC') }}</p>
```

## Environment variables

Environment variables store secrets and configuration that varies between environments. During development, you define these variables in the `.env` file. In production, you must define them through your hosting provider's UI or configuration interface.

A typical `.env` file looks like this.
```bash title=".env"
HOST=0.0.0.0
PORT=3333
APP_KEY=your-secret-app-key-here
MAIL_MAILER=resend
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME=My App
RESEND_API_KEY=re_your_api_key_here
```

The `.env` file is already listed in `.gitignore` in AdonisJS starter kits, so you won't accidentally commit secrets to your repository.

### The APP_KEY

The `APP_KEY` is a special environment variable that AdonisJS uses for encrypting cookies, signing sessions, and other cryptographic operations. Every AdonisJS application requires an APP_KEY to function securely.

Run the `generate:key` command to create your APP_KEY.
```bash
node ace generate:key
```

This creates a cryptographically secure random key and adds it to your `.env` file automatically.

The APP_KEY must remain secret. Anyone with access to this key can decrypt your application's encrypted data and forge session tokens. When you deploy to production, use a different APP_KEY for each environment (development, staging, production). Never reuse keys across environments.

If your APP_KEY is compromised, generate a new one immediately. This will invalidate all existing user sessions and encrypted data.

### Using environment variables in config files

Config files access environment variables through the `env` service, which provides type-safe access to your `.env` file values. You import the env service and call `env.get()` with the variable name.
```ts
import env from '#start/env'

const apiKey = env.get('RESEND_API_KEY')
```

This pattern keeps your configuration organized and validated. The env service ensures required variables are present and throws clear errors if they're missing.

You should never access environment variables directly in your controllers, services, or other application code. Always access them through config files. This creates a single source of truth for configuration.

### Variable interpolation

The `.env` file supports variable interpolation, allowing you to reference other environment variables within a value. Use the `$VAR` or `${VAR}` syntax to interpolate variables.
```bash title=".env"
HOST=localhost
PORT=3333
APP_URL=http://$HOST:$PORT
```

In this example, `APP_URL` resolves to `http://localhost:3333`. This is useful when you need to compose values from other variables without repeating yourself.

You can also use curly braces for clarity or when the variable name is adjacent to other characters.
```bash title=".env"
S3_BUCKET=my-app-uploads
S3_REGION=us-east-1
S3_URL=https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com
```

To include a literal dollar sign in a value, escape it with a backslash.
```bash title=".env"
PRICE=\$99.99
```

### Environment-specific .env files

AdonisJS supports multiple `.env` files for different environments and use cases. The framework loads these files in a specific order, with later files overriding earlier ones.

| File | Purpose | Git status |
|------|---------|------------|
| `.env` | Base environment variables for all environments | Ignored |
| `.env.local` | Local overrides, loaded in all environments except test | Ignored |
| `.env.development` | Development-specific variables | Ignored |
| `.env.staging` | Staging-specific variables | Ignored |
| `.env.production` | Production-specific variables | Ignored |
| `.env.test` | Test-specific variables, loaded when `NODE_ENV=test` | Ignored |
| `.env.example` | Template showing required variables with placeholder values | Committed |

The loading order depends on your `NODE_ENV` value. For `NODE_ENV=development`, AdonisJS loads files in this order:

1. `.env` (base variables)
2. `.env.development` (environment-specific)
3. `.env.local` (local overrides)

For `NODE_ENV=test`, the order is:

1. `.env` (base variables)
2. `.env.test` (test-specific)

Note that `.env.local` is not loaded during tests. This prevents local development settings from interfering with test runs.

The `.env.example` file serves as documentation for your team. It lists all required environment variables with placeholder values, helping new developers set up their local environment. Unlike other `.env` files, you should commit `.env.example` to version control.
```bash title=".env.example"
HOST=0.0.0.0
PORT=3333
APP_KEY=<generate-with-node-ace-generate:key>
DATABASE_URL=postgresql://user:password@localhost:5432/myapp
RESEND_API_KEY=<your-resend-api-key>
```

### Validating environment variables

AdonisJS validates environment variables at startup through the `start/env.ts` file. This validation ensures your application won't start with missing or invalid configuration, catching errors early rather than at runtime when they're harder to debug.

The `start/env.ts` file uses schema based validation to define which environment variables your application expects, their types, and any constraints.

```ts title="start/env.ts"
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  /**
   * Variables for configuring the HTTP server
   */
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number(),
  
  /**
   * App-specific variables
   */
  APP_KEY: Env.schema.secret(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  
  /**
   * Database configuration
   */
  DATABASE_URL: Env.schema.string(),
  
  /**
   * Optional variables with defaults
   */
  LOG_LEVEL: Env.schema.enum(['debug', 'info', 'warn', 'error'] as const).optional(),
  CACHE_DRIVER: Env.schema.string.optional(),
})
```

When your application starts, AdonisJS reads the `.env` file and validates each variable against this schema. If a required variable is missing or has an invalid value, the application throws a descriptive error and refuses to start.

The schema provides several validation methods.

:::option{name="Env.schema.string"}
Validates the value is a non-empty string. You can validate the string format by speficying one of the following formats.

```ts
// Validates the value is a valid hostname or IP
Env.schema.string({ format: 'host' })

// Validates the value is a valid URL
Env.schema.string({ format: 'url' })

// Validates the value is a valid URL without tld
Env.schema.string({ format: 'url', tld: false })

// Validates the value is a valid URL without protocol
Env.schema.string({ format: 'url', protocol: false })

// Validates the value is a valid email address
Env.schema.string({ format: 'email' })
``` 
:::

:::option{name="Env.schema.secret"}
Validates the value is a non-empty string and wraps it in a [Secret](../reference/helpers.md#secret) instance. Use this type for sensitive values such as API tokens and encryption keys. The inferred type is `Secret<string>`, and logging or serializing the value outputs `[redacted]`.

```ts title="start/env.ts"
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  APP_KEY: Env.schema.secret(),
  API_TOKEN: Env.schema.secret.optional(),
})
```

Call `.release()` when you need the plain string, for example when passing the value to a library that expects a string. For optional secrets, use optional chaining because the value is `undefined` when unset or empty.

```ts
import env from '#start/env'

console.log(env.get('APP_KEY')) // [redacted]

const appKey = env.get('APP_KEY').release()
const apiToken = env.get('API_TOKEN')?.release()
```

Once released, the plain string is no longer protected from appearing in logs or serialized output.
:::

:::option{name="Env.schema.number"}
Validates and casts the value to a number
:::

:::option{name="Env.schema.boolean"}
Validates and casts the value to a boolean
:::

:::option{name="Env.schema.enum"}
Validates the value is one of the allowed options
:::

:::option{name="Optional chaining"}
Any schema method can be made optional by chaining `.optional()`. Optional variables return `undefined` if not set.

```ts title="start/env.ts"
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  SENTRY_DSN: Env.schema.string.optional(),
  CACHE_DRIVER: Env.schema.string.optional()
})
```
:::

After validation, the `env` service provides full TypeScript type inference. When you call `env.get('NODE_ENV')`, TypeScript knows the return type is `'development' | 'production' | 'test'` based on your schema definition.

## The adonisrc.ts file

The `adonisrc.ts` file configures the framework itself, not your application. While config files define your app's behavior and `.env` stores secrets, `adonisrc.ts` tells AdonisJS how your workspace is structured and which framework features to load.

You rarely need to modify this file directly. Most operations that require changes to `adonisrc.ts` are handled automatically by Ace commands. When you run `node ace make:provider` or `node ace make:command`, those commands register the new provider or command in your `adonisrc.ts` file for you.

Here's what a basic `adonisrc.ts` file contains.
```ts title="adonisrc.ts"
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
  ],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel')
  ],

  hooks: {
    buildStarting: [
      () => import('@adonisjs/vite/build_hook')
    ],
  },
})
```

The `providers` array lists all service providers that AdonisJS should load when your application starts. Providers set up framework features like database access, authentication, and session handling.

The `commands` array registers Ace commands from packages. Your application's commands in the `commands` directory are automatically discovered, so you only list package commands here.

The `hooks` object defines functions that run during specific lifecycle events. The `buildStarting` hook runs when you build your application for production.

You can learn more about the available properties in the [AdonisRC file reference guide](../reference/adonisrc_file.md)
