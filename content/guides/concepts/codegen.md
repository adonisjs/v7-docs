---
description: Learn why AdonisJS generates code for your application, what it writes to the .adonisjs directory, and why those files belong in your Git history.
---

# Codegen

This guide explains how code generation works in AdonisJS. You will learn how to:

- Understand why AdonisJS generates code instead of relying only on type inference
- Identify the files written to the `.adonisjs` directory and how your application uses them
- Understand when codegen runs and why it warms up your application
- Keep generated code in sync and resolve merge conflicts

## Overview

**Code generation**, or **codegen**, is the process AdonisJS uses to create source files and type declarations based on your application. The generated files live inside the `.adonisjs` directory and allow the framework to provide type-safe APIs without requiring you to maintain lists of files by hand.

TypeScript can infer types from the files you import, but it cannot create and maintain a list of every controller, transformer, event, or Inertia page in a directory. AdonisJS performs that discovery and writes the result as TypeScript code.

The generated `data.d.ts` file is a good example. For every transformer in your application, codegen adds an import and a corresponding type to the `Data` namespace.

```ts title=".adonisjs/client/data.d.ts"
import type { InferData } from '@adonisjs/core/types/transformers'
import type UserTransformer from '#transformers/user_transformer'

export namespace Data {
  export type User = InferData<UserTransformer>
}
```

TypeScript still performs the type inference. In this example, `InferData<UserTransformer>` reads the output type from your `UserTransformer`. Codegen only discovers the transformer and adds it to the generated file. That means adding or removing a transformer does not require you to update a central list.

Routes require a different approach. You register routes by executing calls such as `router.get()`, and those calls can appear in `start/routes.ts`, a service provider, an installed package, or even a loop. Scanning source files cannot reliably determine the final route table. AdonisJS must assemble your application and let the route registration code run before it can generate accurate route types.

## What gets generated

Generated output falls into two groups. AdonisJS can produce file-based output by scanning your project directories. It produces route-based output after warming up your application and reading the registered routes.

The exact files depend on the packages you have installed and the codegen hooks in your `adonisrc.ts` file. The following files are common in AdonisJS applications.

### File-based output

AdonisJS creates this output without running your application.

::::options

:::option{name=".adonisjs/server/controllers.ts"}
A [barrel file](./barrel_files.md) containing lazy imports for your controllers. Your application imports it through `#generated/controllers`. AdonisJS creates similar barrel files for events, listeners, and Bouncer policies.
:::

:::option{name=".adonisjs/server/pages.d.ts"}
A type declaration containing your Inertia page components. It ensures `inertia.render()` only accepts pages that exist in your application.
:::

:::option{name=".adonisjs/client/data.d.ts"}
The `Data` namespace containing the payload types of your [transformers](../frontend/transformers.md), along with your Inertia shared props and flash messages.
:::

:::option{name=".adonisjs/client/manifest.d.ts"}
References to your configuration files. These references allow frontend code to use the types exported by the configuration files you expose.
:::

::::

### Route-based output

AdonisJS creates route-based output after your route declarations have run.

::::options

:::option{name=".adonisjs/server/routes.d.ts"}
The `RoutesList` interface containing every registered route, including its name and parameters. It provides type safety for `router.makeUrl()`, `response.redirect().toRoute()`, and the client-side URL builder.
:::

::::

Packages can extend the same process. For example, Tuyau uses the generated route information to create a typed API client that knows your endpoints, parameters, and response types.

## How codegen runs

Codegen creates file-based output before it warms up your application. This order is required because your application can import generated files while it boots. For example, `start/routes.ts` can import `#generated/controllers`, so `.adonisjs/server/controllers.ts` must exist before AdonisJS imports your routes.

The complete process follows this order:

1. Scan the configured project directories.
2. Write the barrel files and type declarations derived from those directories.
3. Warm up the application so that providers and preload files register routes.
4. Read the completed route table and write the route types.

Because file-based output is generated first, it does not depend on your routes. Adding a controller updates `controllers.ts` even when no route references that controller. A broken route declaration can prevent route types from being refreshed, but it does not prevent AdonisJS from updating the file-based output first.

## Warmup and service providers

Codegen uses the [warmup phase](./application_lifecycle.md#warmup-phase) to assemble your application without starting it. During warmup, AdonisJS executes the `start` method of every service provider and then imports your preload files. This allows all route declarations to run. However, the application never reaches the ready state, so `ready` hooks do not run and the HTTP server does not begin accepting traffic.

Code inside provider `start` methods still runs during codegen. Therefore, a `start` method must not unconditionally send emails, start workers, create timers, or connect to services that codegen does not need. Use the [application mode](./application_lifecycle.md#application-modes) to guard that work.

:::warning
Do not use the application mode to decide which routes, bindings, or event listeners to register. Doing so makes the warmed-up application different from the application that runs, and the generated types will not describe your real application.

Always perform framework registration first. Then guard operational side effects that should run only in `run` mode.
:::

Creating a [recurring job schedule](../digging_deeper/queues.md#scheduled-jobs) writes to the configured queue backend, so it should happen only when the application will run. The following provider uses the application mode to prevent codegen from creating or updating the schedule while it inspects your application.

```ts title="providers/scheduler_provider.ts"
import CleanupExpiredSessions from '#jobs/cleanup_expired_sessions'
import type { ApplicationService } from '@adonisjs/core/types'

export default class SchedulerProvider {
  constructor(protected app: ApplicationService) {}

  async start() {
    if (this.app.getMode() !== 'run') {
      return
    }

    await CleanupExpiredSessions.schedule({ retentionDays: 30 })
      .id('cleanup-expired-sessions')
      .cron('0 0 * * *')
      .timezone('UTC')
      .run()
  }
}
```

## Committing generated code

The `.adonisjs` directory is generated, but it is not a disposable build artifact. You must commit it to Git. Whether a file was generated is less important than how your application uses it.

Generated modules such as `#generated/controllers` are part of your application's module graph. TypeScript and the production build read these files as inputs, just as they read the files you write in `app` and `start`. The `build` directory is different because it contains the output produced from those inputs.

Other frameworks make the same distinction. [TanStack Router recommends committing its generated `routeTree.gen.ts` file](https://tanstack.com/router/latest/docs/faq) because the file is part of the application's runtime source and is required to build its routes. Rails also [recommends committing `db/schema.rb` or `db/structure.sql`](https://guides.rubyonrails.org/active_record_migrations.html#schema-dumps-and-source-control) because the generated schema snapshot is used to create new databases.

The `.adonisjs` directory serves a similar purpose. It captures information derived from your application in a form that TypeScript, the framework, and other tools can consume directly. Generated code belongs in Git when it is an input to building, running, or setting up the application.

If you clone a project without its `.adonisjs` directory, TypeScript cannot resolve generated imports and the application will not compile until you regenerate the missing files. Committing the directory ensures a fresh checkout can be installed, typechecked, and built without requiring an undocumented setup step.

## Regenerating code

Run the `codegen` command to refresh both file-based and route-based output.

```sh title="terminal"
node ace codegen
```

The development server also performs both stages and keeps file-based output in sync as you add and remove files. The test runner and production bundler run the initialization stage that refreshes file-based output, but they do not refresh route-based output.

Run `node ace codegen` when the development server is not running, especially after switching branches, completing a rebase, or before typechecking in CI.

## Resolving merge conflicts

Generated files can conflict when separate branches add files to the same index. For example, two branches that each add a controller will both modify `.adonisjs/server/controllers.ts`.

Do not edit the generated entries by hand. Finish resolving conflicts in your source files, and then regenerate the `.adonisjs` directory from the files on disk.

```sh title="terminal"
node ace codegen
```

The regenerated output represents the final state of your source tree. Add the regenerated files to Git to mark their conflicts as resolved.

## See also

- [Barrel files](./barrel_files.md) explains why AdonisJS uses barrels and how to configure them
- [Assembler hooks](./assembler_hooks.md) explains how to add codegen using the `init` hook
- [Application lifecycle](./application_lifecycle.md) explains the warmup phase and application modes
- [Commands reference](../../reference/commands.md#codegen) documents the `codegen` command
