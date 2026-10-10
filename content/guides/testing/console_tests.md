---
description: Learn how to test custom Ace commands in AdonisJS applications.
---

# Console tests

This guide covers testing Ace commands in AdonisJS applications. You will learn how to:

- Write tests for custom Ace commands
- Capture and assert logger output using raw mode
- Test table rendering in command output
- Trap and respond to CLI prompts programmatically
- Validate prompt input within tests
- Use built-in assertion methods for command results

## Overview

Console tests allow you to verify that your custom Ace commands behave correctly without manual interaction. Since commands often produce terminal output and prompt users for input, testing them requires special techniques to capture output and simulate user responses.

AdonisJS provides a dedicated testing API through the `ace` service that lets you create command instances, execute them in isolation, and make assertions about their behavior. The API includes tools for capturing log output, intercepting prompts, and verifying exit codes.

Testing commands is particularly valuable when your commands perform critical operations like database migrations, file generation, or deployment tasks. A failing command in production can have serious consequences, so automated tests help catch issues before they reach users.

## Basic example

Let's walk through testing a simple command from start to finish. First, create a new command using the `make:command` generator.

```sh
node ace make:command greet

# DONE:    create app/commands/greet.ts
```

The generated command includes a `run` method where you define the command's behavior. Update it to greet the user.

```ts title="app/commands/greet.ts"
import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class Greet extends BaseCommand {
  static commandName = 'greet'
  static description = 'Greet a user by name'

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "Greet"')
  }
}
```

Next, create a test file for the command. If you haven't already defined a unit test suite, see the [testing introduction](./introduction.md#understanding-suites) for setup instructions.

```sh
node ace make:test commands/greet --suite=unit

# DONE:    create tests/unit/commands/greet.spec.ts
```

The test uses the `ace` service to create a command instance, execute it, and verify it completed successfully. The `ace.create` method accepts the command class and an array of arguments (empty in this case since the command takes no arguments).

```ts title="tests/unit/commands/greet.spec.ts"
import { test } from '@japa/runner'
import Greet from '#commands/greet'
import ace from '@adonisjs/core/services/ace'

test.group('Commands greet', () => {
  test('should greet and exit with code 0', async () => {
    /**
     * Create an instance of the command. The second argument
     * is an array of CLI arguments to pass to the command.
     */
    const command = await ace.create(Greet, [])

    /**
     * Execute the command. This runs the `run` method.
     */
    await command.exec()

    /**
     * Assert the command exited successfully (exit code 0).
     */
    command.assertSucceeded()
  })
})
```

Run the test using the following command.

```sh
node ace test --files=commands/greet
```

## Testing logger output

The `Greet` command writes a log message to the terminal using `this.logger.info()`. By default, this output goes directly to stdout, which makes it difficult to capture and assert against in tests.

To solve this, you can switch the ace UI library into **raw mode**. In raw mode, ace stores all output in memory instead of writing to the terminal. This allows you to inspect and assert against the exact messages your command produces.

:::tip
Raw mode captures all output from `this.logger`, `this.ui.table()`, and other UI methods. Always switch back to normal mode after your test to avoid affecting other tests.
:::

Use a Japa `group.each.setup` hook to switch modes automatically before and after each test.

```ts title="tests/unit/commands/greet.spec.ts"
import { test } from '@japa/runner'
import Greet from '#commands/greet'
import ace from '@adonisjs/core/services/ace'

test.group('Commands greet', (group) => {
  /**
   * Switch to raw mode before each test. The returned function
   * runs after each test to restore normal mode.
   */
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should log greeting message', async () => {
    const command = await ace.create(Greet, [])
    await command.exec()

    command.assertSucceeded()

    /**
     * Assert the exact log message. In raw mode, colors are
     * represented as function names like `blue()`.
     */
    command.assertLog('[ blue(info) ] Hello world from "Greet"')
  })
})
```

:::warning
Log assertions in raw mode include color function names. The message `this.logger.info('Hello')` becomes `[ blue(info) ] Hello` in raw mode. If your assertion fails, check that you've included the color formatting in your expected string.
:::

## Testing table output

Commands often display tabular data using `this.ui.table()`. You can test table output the same way as log output by switching to raw mode first.

Consider a command that displays a table of team members.

```ts title="app/commands/list_team.ts"
import { BaseCommand } from '@adonisjs/core/ace'

export default class ListTeam extends BaseCommand {
  static commandName = 'list:team'
  static description = 'List all team members'

  async run() {
    const table = this.ui.table()
    table.head(['Name', 'Email'])

    table.row(['Harminder Virk', 'virk@adonisjs.com'])
    table.row(['Romain Lanz', 'romain@adonisjs.com'])
    table.row(['Julien-R44', 'julien@adonisjs.com'])

    table.render()
  }
}
```

Use `assertTableRows` to verify the table contents. Pass a two-dimensional array where each inner array represents a row's cells.

```ts title="tests/unit/commands/list_team.spec.ts"
import { test } from '@japa/runner'
import ListTeam from '#commands/list_team'
import ace from '@adonisjs/core/services/ace'

test.group('Commands list:team', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should display team members table', async () => {
    const command = await ace.create(ListTeam, [])
    await command.exec()

    /**
     * Assert table rows match expected data. Each inner array
     * represents one row with its column values.
     */
    command.assertTableRows([
      ['Harminder Virk', 'virk@adonisjs.com'],
      ['Romain Lanz', 'romain@adonisjs.com'],
      ['Julien-R44', 'julien@adonisjs.com'],
    ])
  })
})
```

## Trapping prompts

[Prompts](../ace/prompts.md) pause command execution and wait for user input, which blocks automated tests. To handle this, you must **trap** prompts before executing the command. A trap intercepts a specific prompt and provides a programmatic response.

Traps are created using `command.prompt.trap()`, which accepts the prompt title as its argument. The title must match exactly, including case.

:::warning
Prompt titles are case-sensitive. If your prompt asks `"What is your name?"` but you trap `"what is your name?"`, the trap won't match and your test will hang waiting for input. Always copy the exact prompt title from your command.
:::

### Replying to text prompts

Use `replyWith` to provide a text response to prompts created with `this.prompt.ask()`.

```ts title="tests/unit/commands/greet.spec.ts"
import { test } from '@japa/runner'
import Greet from '#commands/greet'
import ace from '@adonisjs/core/services/ace'

test.group('Commands greet', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should greet user by name', async () => {
    const command = await ace.create(Greet, [])

    /**
     * Trap the prompt and provide a response. This must be
     * set up before calling exec().
     */
    command.prompt.trap('What is your name?').replyWith('Virk')

    await command.exec()
    command.assertSucceeded()
  })
})
```

:::tip
Traps are consumed when triggered and automatically removed afterward. If a test completes without triggering a trapped prompt, Japa throws an error to alert you that the expected prompt never appeared.
:::

### Choosing options from select prompts

For prompts created with `this.prompt.choice()` or `this.prompt.multiple()`, use `chooseOption` or `chooseOptions` with zero-based indices.

```ts title="tests/unit/commands/setup.spec.ts"
import { test } from '@japa/runner'
import Setup from '#commands/setup'
import ace from '@adonisjs/core/services/ace'

test.group('Commands setup', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should configure with npm', async () => {
    const command = await ace.create(Setup, [])

    /**
     * Choose the first option (index 0) from a select prompt.
     */
    command.prompt.trap('Select package manager').chooseOption(0)

    await command.exec()
    command.assertSucceeded()
  })

  test('should select multiple databases', async () => {
    const command = await ace.create(Setup, [])

    /**
     * Choose multiple options by passing an array of indices.
     */
    command.prompt.trap('Select databases to configure').chooseOptions([0, 2])

    await command.exec()
    command.assertSucceeded()
  })
})
```

### Accepting or rejecting confirmation prompts

For boolean prompts created with `this.prompt.confirm()` or `this.prompt.toggle()`, use `accept` or `reject`.

```ts title="tests/unit/commands/cleanup.spec.ts"
import { test } from '@japa/runner'
import Cleanup from '#commands/cleanup'
import ace from '@adonisjs/core/services/ace'

test.group('Commands cleanup', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should delete files when confirmed', async () => {
    const command = await ace.create(Cleanup, [])

    command.prompt.trap('Want to delete all temporary files?').accept()

    await command.exec()
    command.assertSucceeded()
  })

  test('should abort when rejected', async () => {
    const command = await ace.create(Cleanup, [])

    command.prompt.trap('Want to delete all temporary files?').reject()

    await command.exec()
    command.assertLog('[ blue(info) ] Cleanup cancelled')
  })
})
```

## Intermediate: Testing prompt validation

Prompts can include [validation rules](../ace/prompts.md#understanding-prompt-options) that reject invalid input. You can test these validators directly using `assertPasses` and `assertFails` without fully executing the command.

The `assertFails` method accepts the input value and the expected error message. The `assertPasses` method accepts a value that should pass validation.

```ts title="tests/unit/commands/create_user.spec.ts"
import { test } from '@japa/runner'
import CreateUser from '#commands/create_user'
import ace from '@adonisjs/core/services/ace'

test.group('Commands create:user', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  test('should validate email format', async () => {
    const command = await ace.create(CreateUser, [])

    /**
     * Test validation without executing the full command.
     * Chain multiple assertions to test various inputs.
     */
    command.prompt
      .trap('Enter your email')
      .assertFails('', 'Email is required')
      .assertFails('invalid', 'Please enter a valid email')
      .assertPasses('user@example.com')
      .replyWith('admin@adonisjs.com')

    await command.exec()
    command.assertSucceeded()
  })
})
```

You can chain validation assertions with `replyWith` to both test the validator and provide a final response.

## Available assertions

The command instance provides several assertion methods to verify command behavior.

::::options

:::option{name="assertSucceeded"}
Assert the command exited with `exitCode=0`, indicating success.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()
command.assertSucceeded()
```

:::

:::option{name="assertFailed"}
Assert the command exited with a non-zero `exitCode`, indicating failure.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()
command.assertFailed()
```

:::

:::option{name="assertExitCode"}
Assert the command exited with a specific exit code. Useful when your command uses different exit codes to signal different error conditions.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()
command.assertExitCode(2)
```

:::

:::option{name="assertNotExitCode"}
Assert the command did not exit with a specific code.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()
command.assertNotExitCode(1)
```

:::

:::option{name="assertLog"}
Assert the command wrote a specific log message. Optionally specify the output stream as `stdout` or `stderr`. Requires raw mode.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()

command.assertLog('[ blue(info) ] Task completed')
command.assertLog('[ red(error) ] Something went wrong', 'stderr')
```

:::

:::option{name="assertLogMatches"}
Assert the command wrote a log message matching a regular expression. Useful when the exact message varies but follows a pattern. Requires raw mode.

```ts title="tests/unit/commands/greet.spec.ts"
await command.exec()

command.assertLogMatches(/Task completed in \d+ms/)
```

:::

:::option{name="assertTableRows"}
Assert the command printed a table with specific rows. Pass a two-dimensional array where each inner array represents a row's column values. Requires raw mode.

```ts title="tests/unit/commands/list_users.spec.ts"
await command.exec()

command.assertTableRows([
  ['1', 'Alice', 'alice@example.com'],
  ['2', 'Bob', 'bob@example.com'],
])
```

:::

::::

## See also

- [Ace prompts](../ace/prompts.md) for details on creating interactive prompts
- [Creating commands](../ace/creating_commands.md) for building custom Ace commands
- [Testing introduction](./introduction.md) for configuring test suites and runners
