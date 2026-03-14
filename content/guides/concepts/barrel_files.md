---
description: Understand what barrel files are, why AdonisJS uses them, and how they help reduce visual clutter in your codebase.
---

# Barrel Files

This guide covers barrel files in AdonisJS and how they reduce import clutter in your codebase. You will learn about:

- What barrel files are and where they're stored
- Why they exist (reducing import clutter)
- How auto-generation works
- How to disable them if needed

## Overview

A barrel file is an auto-generated collection of exports for a specific entity type in your application. AdonisJS creates barrel files for controllers, bouncer policies, events, and event listeners, storing them in the `.adonisjs/server` directory. 

Barrel files are completely optional. You can continue using direct imports if you prefer, and [disable barrel file generation](#disabling-barrel-files) entirely through configuration.

## The problem: Import clutter

As your application grows, files like `start/routes.ts` accumulate dozens of controller imports.

In the following example, with just four controllers, the imports already consume significant vertical space. In production applications with 20+ controllers, you spend more time scrolling past imports than working with routes.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

const NewAccountController = () => import('#controllers/new_account_controller')
const SessionController = () => import('#controllers/session_controller')
const PostsController = () => import('#controllers/posts_controller')
const PostCommentsController = () => import('#controllers/post_comments_controller')

router.get('signup', [NewAccountController, 'create'])
router.post('signup', [NewAccountController, 'store'])
router.get('login', [SessionController, 'create'])
router.post('login', [SessionController, 'store'])
router.get('posts', [PostsController, 'index'])
router.get('posts/:id', [PostsController, 'show'])
router.get('posts/:id/comments', [PostCommentsController, 'index'])
```

## The solution: Barrel files

Barrel files consolidate all those individual imports into a single import statement. Here's the same routes file using the controllers barrel file:

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('signup', [controllers.NewAccount, 'create'])
router.post('signup', [controllers.NewAccount, 'store'])
router.get('login', [controllers.Session, 'create'])
router.post('login', [controllers.Session, 'store'])
router.get('posts', [controllers.Posts, 'index'])
router.get('posts/:id', [controllers.Posts, 'show'])
router.get('posts/:id/comments', [controllers.PostComments, 'index'])
```

The difference is immediately visible. Four imports become one, and your routes are right at the top of the file where you need them. The only change to your route definitions is using the `controllers` namespace to access each controller.

## How barrel files work

The barrel file itself is remarkably simple. It's just a JavaScript object mapping controller names to lazy import functions. Here's what `.adonisjs/server/controllers.ts` looks like:

```ts title=".adonisjs/server/controllers.ts"
export const controllers = {
  NewAccount: () => import('#controllers/new_account_controller'),
  Session: () => import('#controllers/session_controller'),
  Posts: () => import('#controllers/posts_controller'),
  PostComments: () => import('#controllers/post_comments_controller')
}
```

The dev server generates this file automatically when you run `node ace serve`. As you create or delete controllers during development, the dev server's watcher updates the barrel file to stay in sync with your codebase.

### File locations and import aliases

Barrel files are organized in the `.adonisjs/server` directory with corresponding import aliases:

| Barrel File | Import Path | Purpose |
|-------------|-------------|---------|
| `controllers.ts` | `#generated/controllers` | Controller exports |
| `policies.ts` | `#generated/policies` | Bouncer policies exports |
| `events.ts` | `#generated/events` | Event exports |
| `listeners.ts` | `#generated/listeners` | Event listener exports |

The `.adonisjs/server` directory is registered as a subpath import alias in your `package.json`, allowing you to use the `#generated` prefix.

```ts
import { controllers } from '#generated/controllers'
import { events } from '#generated/events'
import { listeners } from '#generated/listeners'
```

:::note
The `.adonisjs` directory contains auto-generated files managed by the framework. You should not manually edit files in this directory, as your changes will be overwritten when the dev server regenerates them.
:::

:::tip
You should commit the `.adonisjs` directory to version control. These files are required for TypeScript to resolve imports like `#generated/controllers`, and without them your production builds and CI pipelines will fail.
:::

## Performance and lazy loading

You might wonder if importing all controllers at once hurts performance. The answer is no, because barrel files use **lazy imports**.

Each controller in the barrel file is wrapped in a function that returns a dynamic import.

```ts
{
  Posts: () => import('#controllers/posts_controller')
}
```

The `() => import()` function is only called when you actually use that controller in a route. Until then, the controller module is never loaded. This means barrel files have zero performance impact. Controllers are still loaded on-demand, exactly as they would be with direct imports.

## Disabling barrel files

If you prefer not to use barrel files, you can disable their generation through the `adonisrc.ts` configuration file. The generation is managed using the `init` assembler hook.

```ts title="adonisrc.ts"
import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  // ...other config
  
  hooks: {
    init: [
      // [!code highlight:11]
      indexEntities({
        controllers: {
          enabled: false,
        },
        events: {
          enabled: false,
        },
        listeners: {
          enabled: false,
        }
      })
    ]
  }
})
```

After disabling barrel file generation, existing barrel files will remain in the `.adonisjs/server` directory. You'll need to manually remove them and update any code that references them to use direct imports instead.
