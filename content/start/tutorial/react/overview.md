---
description: Build a fully functional community showcase website with AdonisJS, Inertia, and React, and learn how to create modern full-stack web applications.
---

:variantSelector{}

# Building DevShow - A Community showcase website

In this tutorial, you will build DevShow. **DevShow is a small community showcase website where users can share what they've built.** Every user can create an account, publish a "showcase entry" (a project, tool, experiment, or anything they're proud of), and browse entries created by others.

## Overview

We're taking a hands-on approach in this tutorial by building a real application from start to finish. Instead of learning about features in isolation, you will see how everything in AdonisJS and React works together: **routing, controllers, models, validation, authentication, transformers, and React components all coming together to create a functioning web application**.

By the end of this tutorial, you'll have built:

- **Post listing and detail pages** - Display all posts and individual post details with comments
- **Post creation and editing** - Forms to create and update posts with validation
- **Comment system** - Allow users to comment on posts
- **Authorization** - Ensure users can only edit/delete their own posts and comments
- **Navigation and styling** - Polished UI with proper navigation between pages

The authentication system (signup, login, logout) is already included in your starter kit and fully functional.

## Understanding the starter kit

We're starting with the AdonisJS Inertia + React starter kit, which already has authentication built in. Let's see what we have to work with by opening the routes file.
```ts title="start/routes.ts"
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').renderInertia('home', {}).as('home')

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
    router.on('/dashboard').renderInertia('dashboard', {}).as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
```

The starter kit gives us user signup, login, and logout routes, plus an empty dashboard page where users land after logging in. Notice how `middleware.guest()` ensures only logged-out users can access signup/login, while `middleware.auth()` protects the dashboard and logout routes.

:::note
We'll use the `auth` middleware throughout the tutorial to protect routes that require authentication.
:::

### How controllers work with Inertia

Let's look at the signup controller to see how requests flow through the application with Inertia.
```ts title="app/controllers/new_account_controller.ts"
import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup')
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

Each controller method receives an HTTP context object as its first parameter. The context contains everything about the current request: the request data, response object, auth state, Inertia renderer, and more. We destructure just the properties we need (`inertia` for rendering React components, `request` for form data, `response` for redirects, and `auth` for authentication).

The `create` method renders the signup form using `inertia.render()`. Instead of returning HTML like traditional server-rendered apps, Inertia sends a JSON response containing the component name and any props. Your React frontend receives this and renders the corresponding component.

The `store` method does the heavy lifting. It validates data, creates the user, logs them in, and redirects to the dashboard. **This pattern of bringing together validators, models, and auth is what you'll see throughout the tutorial**.

You might notice the controller references a `User` model and a `signupValidator`. The starter kit already includes these. We'll explore how models work in the [Database and Models](./database_and_models.md) chapter and validators in the [Forms and Validation](./forms_and_validation.md) chapter.

### About Inertia and React

If you've worked with meta-frameworks like Next.js or Remix, this starter kit might look unusual. **Most of our code lives in AdonisJS (the backend), and React is only used to render views.** There's no frontend routing, no isomorphic code running on both server and client, and no complex state management libraries.

This is intentional. Inertia's philosophy is simple: **keep your backend and frontend separate, but make them work together seamlessly.** 

- Your **backend** (AdonisJS) handles routing, authentication, database queries, validation, and business logic
- Your **frontend** (React) handles rendering and user interactions
- **Inertia** acts as the glue, sending JSON responses from your controllers to your React components

If you're hearing about Inertia for the first time, you might want to visit [inertiajs.com](https://inertiajs.com) to learn more about its philosophy. Or just power through this tutorial and see for yourself how simple it is compared to the complexity cocktail offered by meta-frameworks.

**Here's how a request flows in an AdonisJS + Inertia app:**
```
Browser Request
    ↓
AdonisJS Router
    ↓
Controller (validates, queries database, etc.)
    ↓
inertia.render('component-name', props)
    ↓
React Component (rendered via Vite)
    ↓
Browser Response
```

### How the signup form works

When a controller calls `inertia.render('auth/signup')`, Inertia looks for a React component at `inertia/pages/auth/signup.tsx` and renders it. Let's look at that component.
```tsx title="inertia/pages/auth/signup.tsx"
import AuthLayout from '~/layouts/auth'
import { Form, Link } from '@adonisjs/inertia/react'

export default function Signup() {
  return (
    <>
      <h1 className="auth__title">Create your account</h1>
      <p className="auth__sub">Start building with the starter kit.</p>

      <Form route="new_account.store">
        {({ errors, processing }) => (
          <div className="auth__form">
            <div className="field">
              <label className="field__label" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="field__input"
                autoComplete="name"
                placeholder="Ada Lovelace"
                aria-invalid={errors.fullName ? 'true' : 'false'}
              />
              {errors.fullName && <span className="field__error">{errors.fullName}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field__input"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : 'false'}
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="field__input"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="passwordConfirmation">
                Confirm password
              </label>
              <input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                className="field__input"
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={errors.passwordConfirmation ? 'true' : 'false'}
              />
              {errors.passwordConfirmation && (
                <span className="field__error">{errors.passwordConfirmation}</span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={processing}
              style={{ marginTop: 4 }}
            >
              {processing ? 'One moment…' : 'Create account'}
            </button>
          </div>
        )}
      </Form>

      <p className="auth__foot">
        Already have an account?{' '}
        <Link route="session.create" className="il">
          Sign in
        </Link>
      </p>
    </>
  )
}

Signup.layout = [AuthLayout]
```

Page components live in the `inertia/pages` directory. The `Form` component from `@adonisjs/inertia/react` handles form submissions. It accepts a `route` prop (the named route to submit to) and provides an `errors` object and a `processing` flag through a render prop pattern. When you submit the form, Inertia sends the request to your backend and automatically handles the response, including displaying validation errors. Assigning `Signup.layout` wraps the page with the `AuthLayout` from `inertia/layouts/auth.tsx`. The starter kit also ships `marketing`, `app`, and `settings` layouts in the same directory.

## Try creating an account
Before we move forward, start your development server with `node ace serve --hmr` and try creating an account. Get comfortable with how the starter kit works. We'll be building on this foundation.
