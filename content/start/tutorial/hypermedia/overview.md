---
summary: Build a fully functional community showcase website with AdonisJS and learn how to create hypermedia-driven web applications.
---

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

Each controller method receives an HTTP context object as its first parameter. The context contains everything about the current request: the request data, response object, auth state, view renderer, and more. We destructure just the properties we need (`view` for rendering templates, `request` for form data, `response` for redirects, and `auth` for authentication).

The `create` method simply shows the signup form. The `store` method does the heavy lifting. It validates data, creates the user, logs them in, and redirects home. **This pattern of bringing together validators, models, and auth is what you'll see throughout the tutorial**.

You might notice the controller references a `User` model and a `signupValidator`. The starter kit already includes these. We'll explore how models work in Chapter 3 and validators in Chapter 5.

### How views work

When a controller calls `view.render('pages/auth/signup')`, AdonisJS looks for a template file and renders it as HTML. Let's see what that signup view looks like.

```edge title="resources/views/pages/auth/signup.edge"
@layout()
  <div class="form-container">
    <div>
      <h1> Signup </h1>
      <p>
        Enter your details below to create your account
      </p>
    </div>

    <div>
      @form({ route: 'new_account.store', method: 'POST' })
        <div>
          @field.root({ name: 'fullName' })
            @!field.label({ text: 'Full name' })
            @!input.control()
            @!field.error()
          @end
        </div>

        <div>
          @field.root({ name: 'email' })
            @!field.label({ text: 'Email' })
            @!input.control({ type: 'email', autocomplete: 'email' })
            @!field.error()
          @end
        </div>

        <div>
          @field.root({ name: 'password' })
            @!field.label({ text: 'Password' })
            @!input.control({ type: 'password', autocomplete: 'new-password' })
            @!field.error()
          @end
        </div>

        <div>
          @field.root({ name: 'passwordConfirmation' })
            @!field.label({ text: 'Confirm password' })
            @!input.control({ type: 'password', autocomplete: 'new-password' })
            @!field.error()
          @end
        </div>

        <div>
          @!button({ text: 'Sign up', type: 'submit' })
        </div>
      @end
    </div>
  </div>
@end
```

Views live in the `resources/views` directory. AdonisJS uses Edge as its templating engine. Edge templates look similar to HTML but with special tags that start with `@`. 

The `@layout()` tag wraps the page content with a common layout (header, footer, CSS). The `@form()` and `@field.root()` tags are components that come with the starter kit. They render standard HTML form elements with built-in features like CSRF protection and validation error display.

When you visit `/signup`, the route calls the controller's `create` method, which renders this view, and Edge converts it to HTML that your browser displays.

## Try creating an account
Before we move forward, start your development server with `node ace serve --hmr` and try creating an account. Get comfortable with how the starter kit works. We'll be building on this foundation.
