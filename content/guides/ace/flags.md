---
description: Learn how to define and process command flags in Ace commands.
---

# Command flags

This guide covers defining command flags within custom commands. You will learn about the following topics:

- Defining boolean, string, number, and array flags
- Customizing flag names and descriptions
- Creating flag aliases for shorthand usage
- Making flags required
- Setting default values for flags
- Transforming and validating flag values
- Accessing all provided flags

## Overview

Flags provide a way to accept optional or named parameters without requiring a specific order. They are specified with either two hyphens (`--`) for full names or a single hyphen (`-`) for aliases. 

In the following command, both `--resource` and `--singular` are flags.

```sh
node ace make:controller users --resource --singular
```

Unlike positional arguments, flags can appear anywhere in the command and can be omitted entirely if they're optional. This makes flags ideal for options that customize command behavior, such as enabling features, specifying output formats, or providing configuration values.

Ace supports multiple flag types including boolean flags for on/off options, string flags for text values, number flags for numeric input, and array flags for multiple values.

## Defining boolean flags

Boolean flags represent on/off or yes/no options. They are the simplest flag type and don't require a value - simply mentioning the flag sets it to `true`.

Use the `@flags.boolean` decorator to define a boolean flag.

```ts title="commands/make_controller.ts"
import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class MakeControllerCommand extends BaseCommand {
  static commandName = 'make:controller'
  
  /**
   * Enable resource controller generation
   */
  @flags.boolean()
  declare resource: boolean

  /**
   * Create a singular resource controller
   */
  @flags.boolean()
  declare singular: boolean
  
  async run() {
    if (this.resource) {
      this.logger.info('Creating a resource controller')
    }
  }
}
```

When users mention the flag, its value becomes `true`. If they omit the flag, its value is `undefined`.

```sh
node ace make:controller users --resource
# this.resource === true

node ace make:controller users
# this.resource === undefined
```

### Negating boolean flags

Boolean flags support negation using the `--no-` prefix, allowing users to explicitly set a flag to `false`. This is useful when a flag has a default value of `true` and users need to disable it.

```sh
node ace make:controller users --no-resource
# this.resource === false
```

By default, the negated variant is not shown in help screens to keep output concise. You can display it using the `showNegatedVariantInHelp` option.

```ts title="commands/make_controller.ts"
@flags.boolean({
  showNegatedVariantInHelp: true,
})
declare resource: boolean
```

## Defining string flags

String flags accept text values that users provide after the flag name. Use the `@flags.string` decorator to define string flags.

```ts title="commands/make_controller.ts"
import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class MakeControllerCommand extends BaseCommand {
  static commandName = 'make:controller'
  
  /**
   * The model name to associate with the controller
   */
  @flags.string()
  declare model: string
  
  async run() {
    if (this.model) {
      this.logger.info(`Creating controller for ${this.model} model`)
    }
  }
}
```

Users provide the value after the flag name, separated by a space or equals sign.

```sh
node ace make:controller users --model user
# this.model = 'user'

node ace make:controller users --model=user
# this.model = 'user'
```

If the flag value contains spaces or special characters, users must wrap it in quotes.

```sh
node ace make:controller posts --model blog user
# this.model = 'blog'
# (only takes the first word)

node ace make:controller posts --model "blog user"
# this.model = 'blog user'
# (captures the full phrase)
```

Ace will display an error if users mention the flag but don't provide a value, even when the flag is optional.

```sh
node ace make:controller users
# Works - optional flag is not mentioned

node ace make:controller users --model
# Error: Missing value for option "model"
```

If an empty value is meaningful for your command, set the `allowEmptyValue` option to accept it. This option is available for string and array flags.

```ts title="commands/make_controller.ts"
@flags.string({
  allowEmptyValue: true,
})
declare model: string
```

## Defining number flags

Number flags are similar to string flags but Ace validates that the provided value is a valid number. This ensures your command receives numeric input rather than arbitrary text.

Use the `@flags.number` decorator to define number flags.

```ts title="commands/create_user.ts"
import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class CreateUserCommand extends BaseCommand {
  static commandName = 'create:user'
  
  /**
   * Initial score for the new user
   */
  @flags.number()
  declare score: number
  
  async run() {
    this.logger.info(`Creating user with score: ${this.score}`)
  }
}
```

Users must provide a valid numeric value.

```sh
node ace create:user --score 100
# this.score = 100

node ace create:user --score abc
# Error: Invalid value. The "score" flag accepts a "numeric" value
```

## Defining array flags

Array flags allow users to specify the same flag multiple times, collecting all values into an array. This is useful when a command needs to accept multiple items of the same type, such as file paths, tags, or permission groups.

Use the `@flags.array` decorator to define array flags.

```ts title="commands/create_user.ts"
import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class CreateUserCommand extends BaseCommand {
  static commandName = 'create:user'
  
  /**
   * Groups to assign to the user
   */
  @flags.array()
  declare groups: string[]
  
  async run() {
    this.logger.info(`Assigning user to groups: ${this.groups.join(', ')}`)
  }
}
```

Users can specify the flag multiple times to build up the array.

```sh
node ace create:user --groups=admin --groups=moderators --groups=creators
# this.groups = ['admin', 'moderators', 'creators']
```

## Customizing flag names and descriptions

By default, Ace converts your property name to dashed-case for the flag name. For example, a property named `startServer` becomes `--start-server`. You can customize this using the `flagName` option.

```ts title="commands/serve.ts"
@flags.boolean({
  flagName: 'server'
})
declare startServer: boolean
```

Adding a description helps users understand the flag's purpose. The description appears in help screens when users run your command with the `--help` flag.

```ts title="commands/serve.ts"
@flags.boolean({
  flagName: 'server',
  description: 'Start the application server after the build'
})
declare startServer: boolean
```

## Creating flag aliases

Flag aliases provide shorthand names for flags, making commands faster to type for frequently used options. Aliases use a single hyphen (`-`) and must be a single character.

```ts title="commands/make_controller.ts"
@flags.boolean({
  alias: 'r',
  description: 'Generate a resource controller'
})
declare resource: boolean

@flags.boolean({
  alias: 's',
  description: 'Create a singular resource controller'
})
declare singular: boolean
```

Users can use either the full flag name or the alias.

```sh
node ace make:controller users --resource --singular
# Same as
node ace make:controller users -r -s
```

Multiple single-character aliases can be combined after a single hyphen.

```sh
node ace make:controller users -rs
# Equivalent to --resource --singular
```

## Making flags required

Flags are optional by default. Set the `required` option to `true` when your command cannot run without a flag. Ace will display an error if the user does not mention the flag.

```ts title="commands/deploy.ts"
@flags.string({
  required: true,
  description: 'Deployment environment',
})
declare environment: string
```

```sh
node ace deploy
# Error: Missing required option "environment"

node ace deploy --environment=production
# this.environment = 'production'
```

## Setting default values

You can specify default values for flags using the `default` option. When users don't provide the flag, Ace uses the default value instead of `undefined`.

```ts title="commands/build.ts"
@flags.boolean({
  default: true,
  description: 'Start the application server after build'
})
declare startServer: boolean

@flags.string({
  default: 'sqlite',
  description: 'Database connection to use'
})
declare connection: string
```

Default values ensure your command always has a value to work with, even when users don't specify the flag.

```sh
node ace build
# this.startServer = true (default)
# this.connection = 'sqlite' (default)

node ace build --no-start-server --connection=mysql
# this.startServer = false (explicitly set)
# this.connection = 'mysql' (explicitly set)
```

## Transforming flag values

The `parse` method allows you to transform or validate flag values before they're assigned to your class property. This is useful for normalizing input, looking up configuration values, or performing validation.

The parse method receives the raw string value and must return the transformed value.

```ts title="commands/migrate.ts"
@flags.string({
  description: 'Database connection to use',
  parse(value) {
    /**
     * Map short names to full connection strings
     */
    const connections = {
      pg: 'postgresql://localhost/myapp',
      mysql: 'mysql://localhost/myapp',
      sqlite: 'sqlite://./database.sqlite'
    }
    
    return value ? connections[value] || value : value
  }
})
declare connection: string
```

Now users can provide short connection names that get expanded to full connection strings.

```sh
node ace migrate --connection=pg
# this.connection = 'postgresql://localhost/myapp'
```

You can also use the parse method to validate input and throw errors for invalid values.

```ts title="commands/deploy.ts"
@flags.string({
  description: 'Deployment environment',
  parse(value) {
    const validEnvironments = ['development', 'staging', 'production']
    
    if (value && !validEnvironments.includes(value)) {
      throw new Error(`Environment must be one of: ${validEnvironments.join(', ')}`)
    }
    
    return value
  }
})
declare environment: string
```

## Accessing all flags

You can access all flags provided by the user using the `this.parsed.flags` property. This returns an object containing all flag values as key-value pairs.

```ts title="commands/make_controller.ts"
import { BaseCommand, flags } from '@adonisjs/core/ace'

export default class MakeControllerCommand extends BaseCommand {
  static commandName = 'make:controller'
  
  @flags.boolean()
  declare resource: boolean

  @flags.boolean()
  declare singular: boolean
  
  async run() {
    /**
     * Access all mentioned flags. Flags the user did not
     * mention are left out of the object
     */
    console.log(this.parsed.flags)
    // node ace make:controller --resource
    // Output: { resource: true }
    
    /**
     * Access flags that were mentioned but not defined
     * (only available when allowUnknownFlags is true)
     */
    console.log(this.parsed.unknownFlags)
    // node ace make:controller --some-unknown-flag -x
    // Output: ['some-unknown-flag', 'x']
  }
}
```

The `unknownFlags` property is particularly useful when you've enabled `allowUnknownFlags` in your command options and need to process or pass through flags that your command doesn't explicitly define.
