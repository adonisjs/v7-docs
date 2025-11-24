---
summary: Build a fully functional community showcase website with AdonisJS and learn how to create hypermedia-driven web applications.
---

# Building DevShow - A Community showcase website

In this tutorial, you will build DevShow. **DevShow is a small community showcase website where users can share what they've built.** Every user can create an account, publish a "showcase entry" (a project, tool, experiment, or anything they're proud of), and browse entries created by others.

## Overview

We're taking a hands-on approach in this tutorial by building a real application from start to finish. Instead of learning about features in isolation, you will see how everything in AdonisJS works together — **routing, controllers, models, validation, authentication, and templating all coming together to create a functioning web application**.

By the end, you will have built a deployable DevShow web-app and gained a solid understanding of how AdonisJS features work together in practice.

## Understanding the starter kit

We're starting with the AdonisJS Hypermedia starter kit, which already has authentication built in. Let's see what we have to work with by opening the routes file.

```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')

/**
 * Signup and login routes - only accessible to guests
 */
router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

/**
 * Logout route - only accessible to authenticated users
 */
router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
```

The starter kit gives us user signup, login, and logout routes. Notice how `middleware.guest()` ensures only logged-out users can access signup/login, while `middleware.auth()` protects the logout route.

:::note
We'll use the `auth` middleware throughout the tutorial to protect routes that require authentication.
:::

### How controllers work

Let's look at the signup controller to see how requests flow through the application.

```ts title="app/controllers/new_account_controller.ts"
import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  async store({ request, response, auth }: HttpContext) {
    /**
     * Validate the submitted data
     */
    const payload = await request.validateUsing(signupValidator)
    
    /**
     * Create the new user in the database
     */
    const user = await User.create(payload)

    /**
     * Log them in automatically
     */
    await auth.use('web').login(user)
    
    /**
     * Redirect to home page
     */
    response.redirect().toRoute('home')
  }
}
```

The `create` method simply shows the signup form. The `store` method does the heavy lifting—validating data, creating the user, logging them in, and redirecting home. **This pattern of bringing together validators, models, and auth is what you'll see throughout the tutorial**.

Before we move forward, start your development server with `node ace serve --hmr` and try creating an account. Get comfortable with how the starter kit works—we'll be building on this foundation.
