# Forms and Validation

In this chapter, you'll first add the ability for authenticated users to create new posts. Then, you'll apply the same pattern to let users leave comments on existing posts. Along the way, you'll be introduced to AdonisJS's validation layer and learn how to organize your code using separate controllers for different resources.

## Overview
So far in the DevShow tutorial, you've built an application that displays posts from your database. But what about creating new posts? That's where forms come in.

Handling forms involves three main steps:

1. Displaying a form to collect user input.
2. Validating that input on the server to ensure it meets your requirements.
3. Finally saving the validated data to your database.

AdonisJS provides Edge form components that render standard HTML form elements with automatic CSRF protection, and [VineJS](https://vinejs.dev/docs/introduction) for defining validation rules.

## Adding post creation

Let's start by adding the ability for users to create new posts. We'll need a controller method to display the form, routes to wire everything up, and a template for the form itself.

::::steps
:::step{title="Add controller methods"}

First, let's add a `create` method to your `PostsController` that will render the form for creating a new post. We'll also stub out a `store` method that we'll implement later to handle the form submission.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'

export default class PostsController {
  // ... existing methods (index, show)

  // [!code ++:13]
  /**
   * Display the form for creating a new post
   */
  async create({ view }: HttpContext) {
    return view.render('posts/create')
  }

  /**
   * Handle the form submission for creating a new post
   */
  async store({}: HttpContext) {
    // We'll implement this later
  }
}
```

:::

:::step{title="Register the routes"}

Now let's wire up the routes. We need two: one to display the form and another to handle submissions. Both should only be accessible to logged-in users.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])

// [!code ++:2]
router.get('/posts/create', [controllers.Posts, 'create']).use(middleware.auth())
router.post('/posts', [controllers.Posts, 'store']).use(middleware.auth())

router.get('/posts/:id', [controllers.Posts, 'show'])
```

The `auth()` middleware ensures only logged-in users can access these routes. Unauthenticated visitors will be redirected to the login page.

:::

:::step{title="Create the form template"}

Create the template for the form using the Ace CLI.

```bash
node ace make:view posts/create
```

This creates `resources/views/posts/create.edge`. Open it and add the following form.

```edge title="resources/views/posts/create.edge"
@layout()
  <div class="form-container">
    <div>
      <h1>
        Create a new post
      </h1>
    </div>

    <div>
      @form({ route: 'posts.store', method: 'POST' })
        <div>
          @field.root({ name: 'title' })
            @!field.label({ text: 'Post title' })
            @!input.control({ placeholder: 'Enter an interesting title' })
            @!field.error()
          @end
        </div>
        
        <div>
          @field.root({ name: 'url' })
            @!field.label({ text: 'URL' })
            @!input.control({ type: 'url', placeholder: 'https://example.com/article' })
            @!field.error()
          @end
        </div>
        
        <div>
          @field.root({ name: 'summary' })
            @!field.label({ text: 'Short summary' })
            @!textarea.control({ rows: 4, placeholder: 'Describe what this post is about' })
            @!field.error()
          @end
        </div>
        
        <div>
          @!button({ text: 'Create Post', type: 'submit' })
        </div>
      @end
    </div>
  </div>
@end
```

These Edge form components are part of the starter kit. They render standard HTML elements with helpful features like automatic CSRF protection (via `@form`) and validation error display (via `@!field.error()`).

:::

:::step{title="Create a validator"}

Before handling form submissions, we need to define validation rules. AdonisJS uses [VineJS for validation](https://vinejs.dev) — a schema-based validation library that lets you define rules for your data. 

Create a validator using the Ace CLI.

```bash
node ace make:validator post
```

This creates `app/validators/post.ts`. Add a `createPostValidator` to validate post creation.
```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

/**
 * Validates the post's creation form
 */
export const createPostValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(3).maxLength(255),
    url: vine.string().url(),
    summary: vine.string().minLength(80).maxLength(500),
  })
)
```

The `vine.compile()` creates a reusable validator from a schema. Inside, we define each field with its type and rules.

- The `title` field must be string between 3-255 characters.
- The `url` field must be a string and formatted as a URL.
- The `summary` field must be between 80-500 characters.

:::

:::step{title="Implement the store method"}

Now let's implement the `store` method to validate the data, create the post, and redirect the user.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
// [!code ++:1]
import { createPostValidator } from '#validators/post'

export default class PostsController {
  // ... existing methods

  // [!code ++:9]
  async store({ request, auth, response }: HttpContext) {
    const payload = await request.validateUsing(createPostValidator)

    await Post.create({
      ...payload,
      userId: auth.user!.id,
    })

    return response.redirect().toRoute('posts.index')
  }
}
```

When the form is submitted, `request.validateUsing()` validates the data. If validation fails, the user is automatically redirected back with errors that appear next to the relevant fields. If validation succeeds, we create the post and redirect to the posts index.

Now visit [`/posts/create`](http://localhost:3333/posts/create), fill out the form, and submit it. Your new post should appear on the posts page! Try submitting invalid data (like a short summary or invalid URL) to see the validation errors in action.

:::

::::

## Adding comments to posts

Now that you can create posts, let's add the ability for users to leave comments. We'll create a separate controller for comments—having one controller per resource is the recommended approach in AdonisJS.

::::steps

:::step{title="Create the comment validator"}

Let's start by defining validation rules for comments.
```bash
node ace make:validator comment
```

Since comments only have a content field, the validation is simple.

```ts title="app/validators/comment.ts"
import vine from '@vinejs/vine'

/**
 * Validates the comment's creation form
 */
export const createCommentValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1),
  })
)
```

:::

:::step{title="Create the CommentsController"}

Generate a new controller using the Ace CLI.

```bash
node ace make:controller comments
```

This creates `app/controllers/comments_controller.ts`. Add a `store` method to handle comment submissions.

```ts title="app/controllers/comments_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Comment from '#models/comment'
import { createCommentValidator } from '#validators/comment'

export default class CommentsController {
  /**
   * Handle the form submission for creating a new comment
   */
  async store({ request, auth, params, response }: HttpContext) {
    // Validate the comment content
    const payload = await request.validateUsing(createCommentValidator)

    // Create the comment and associate it with the post and user
    await Comment.create({
      ...payload,
      postId: params.id,
      userId: auth.user!.id,
    })

    // Redirect back to the post page
    return response.redirect().back()
  }
}
```

We're using `params.id` to get the post ID from the route parameter, and `response.redirect().back()` to send the user back to the post page.

:::

:::step{title="Register the comment route"}

Add a route for creating comments, also protected by the auth middleware.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.on('/').render('pages/home').as('home')
router.get('/posts', [controllers.Posts, 'index'])
router.get('/posts/create', [controllers.Posts, 'create']).use(middleware.auth())
router.post('/posts', [controllers.Posts, 'store']).use(middleware.auth())
router.get('/posts/:id', [controllers.Posts, 'show'])

// [!code ++:1]
router.post('/posts/:id/comments', [controllers.Comments, 'store']).use(middleware.auth())
```

The `:id` parameter captures the post ID, which we access as `params.id` in the controller.

:::

:::step{title="Add the comment form"}

Open your `resources/views/posts/show.edge` template and add the comment form.
```edge title="resources/views/posts/show.edge"
@layout()
  {{-- ... existing post display code ... --}}

    <div class="posts-comments">
      <h2>Comments</h2>

      // [!code ++:13]
      <div class="post-comment-form">
        @form({ route: 'comments.store', routeParams: post, method: 'POST' })
          <div>
            @field.root({ name: 'content' })
              @!textarea.control({ rows: 3, placeholder: 'Share your thoughts...' })
              @!field.error()
            @end
          </div>

          <div>
            @!button({ text: 'Post comment', type: 'submit' })
          </div>
        @end
      </div>

      {{-- ... existing comments list ... --}}
    </div>
@end
```

The `routeParams: post` passes the post object to the route helper, generating the correct URL like `/posts/1/comments`.

Now visit any post page while logged in and try leaving a comment. After submitting, you'll be redirected back to see your comment in the list.

:::

::::

## What you learned

You've now added full form handling and validation to your DevShow application. Here's what you accomplished:

- Created forms using Edge form components (`@form`, `@field.root`, `@input.control`, etc.)
- Defined validation rules using VineJS validators
- Validated form submissions in your controllers using `request.validateUsing()`
- Protected routes with the `auth()` middleware to ensure only logged-in users can create content
- Associated posts and comments with users using `auth.user!.id`
- Organized your code by creating separate controllers for different resources (PostsController and CommentsController)
- Handled form errors automatically with the `@!field.error()` component
