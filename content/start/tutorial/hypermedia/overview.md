---
description: Build a fully functional community showcase website with AdonisJS and learn how to create hypermedia-driven web applications.
---

:variantSelector{}

# Building DevShow - A Community showcase website

In this tutorial, you will build DevShow. **DevShow is a small community showcase website where users can share what they've built.** Every user can create an account, publish a "showcase entry" (a project, tool, experiment, or anything they're proud of), and browse entries created by others.

## Overview

We're taking a hands-on approach in this tutorial by building a real application from start to finish. Instead of learning about features in isolation, you will see how everything in AdonisJS works together: **routing, controllers, models, validation, authentication, and templating all coming together to create a functioning web application**.

By the end of this tutorial, you'll have built:

- **Post listing and detail pages** - Display all posts and individual post details with comments
- **Post creation and editing** - Forms to create and update posts with validation
- **Comment system** - Allow users to comment on posts
- **Authorization** - Ensure users can only edit/delete their own posts and comments
- **Navigation and styling** - Polished UI with proper navigation between pages

The authentication system (signup, login, logout) is already included in your starter kit and fully functional.

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
 * Dashboard and logout routes - only accessible to authenticated users
 */
router
  .group(() => {
    router.on('/dashboard').render('pages/dashboard').as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
```

The starter kit gives us user signup, login, and logout routes, plus an empty dashboard page where users land after logging in. Notice how `middleware.guest()` ensures only logged-out users can access signup/login, while `middleware.auth()` protects the dashboard and logout routes.

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
    const { fullName, email, password } = await request.validateUsing(signupValidator)

    /**
     * Create the new user in the database
     */
    const user = await User.create({ fullName, email, password })

    /**
     * Log them in automatically
     */
    await auth.use('web').login(user)
    
    /**
     * Redirect to the dashboard
     */
    response.redirect().toRoute('dashboard')
  }
}
```

Each controller method receives an HTTP context object as its first parameter. The context contains everything about the current request: the request data, response object, auth state, view renderer, and more. We destructure just the properties we need (`view` for rendering templates, `request` for form data, `response` for redirects, and `auth` for authentication).

The `create` method simply shows the signup form. The `store` method does the heavy lifting. It validates data, creates the user, logs them in, and redirects to the dashboard. **This pattern of bringing together validators, models, and auth is what you'll see throughout the tutorial**.

You might notice the controller references a `User` model and a `signupValidator`. The starter kit already includes these. We'll explore how models work in the [Database and Models](./database_and_models.md) chapter and validators in the [Forms and Validation](./forms_and_validation.md) chapter.

### How views work

When a controller calls `view.render('pages/auth/signup')`, AdonisJS looks for a template file and renders it as HTML. Let's see what that signup view looks like.

```edge title="resources/views/pages/auth/signup.edge"
@layouts.auth()
  <h1 class="auth__title">Create your account</h1>
  <p class="auth__sub">Start building with the starter kit.</p>
  @form({
    route: 'new_account.store',
    method: 'POST',
    class: 'auth__form',
    'x-data': '{ submitting: false }',
    'x-on:submit': 'submitting = true',
  })
    @field.root({ name: 'fullName' })
      @!field.label({ text: 'Full name' })
      @!input.control({ autocomplete: 'name', placeholder: 'Ada Lovelace' })
      @!field.error()
    @end
    @field.root({ name: 'email' })
      @!field.label({ text: 'Email' })
      @!input.control({
        type: 'email',
        autocomplete: 'email',
        placeholder: 'you@example.com',
      })
      @!field.error()
    @end
    @field.root({ name: 'password' })
      @!field.label({ text: 'Password' })
      @!input.control({
        type: 'password',
        autocomplete: 'new-password',
        placeholder: '••••••••',
      })
      @!field.error()
    @end
    @field.root({ name: 'passwordConfirmation' })
      @!field.label({ text: 'Confirm password' })
      @!input.control({
        type: 'password',
        autocomplete: 'new-password',
        placeholder: '••••••••',
      })
      @!field.error()
    @end
    @!button({
      text: 'Create account',
      type: 'submit',
      block: true,
      style: 'margin-top: 4px;',
      'x-bind:disabled': 'submitting',
      'x-text': "submitting ? 'One moment…' : 'Create account'",
    })
  @end

  <p class="auth__foot">
    Already have an account?
    @link({ route: 'session.create', class: 'il' })
      Sign in
    @end
  </p>
@end
```

Views live in the `resources/views` directory. AdonisJS uses Edge as its templating engine. Edge templates look similar to HTML but with special tags that start with `@`. 

The `@layouts.auth()` tag wraps the page content with the authentication layout (HTML document, CSS, and the centered auth card). The `@form()` and `@field.root()` tags are components that come with the starter kit. They render standard HTML form elements with built-in features like CSRF protection and validation error display. The `x-data` and `x-on:submit` attributes are [Alpine.js](https://alpinejs.dev) directives that disable the submit button while the form is being submitted.

When you visit `/signup`, the route calls the controller's `create` method, which renders this view, and Edge converts it to HTML that your browser displays.

## Try creating an account
Before we move forward, start your development server with `node ace serve --hmr` and try creating an account. Get comfortable with how the starter kit works. We'll be building on this foundation.
