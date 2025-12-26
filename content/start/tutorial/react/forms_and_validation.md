# Forms and Validation

In this chapter, you'll first add the ability for authenticated users to create new posts. Then, you'll apply the same pattern to let users leave comments on existing posts. Along the way, you'll be introduced to AdonisJS's validation layer and learn how to organize your code using separate controllers for different resources.

:::note
This tutorial covers basic form handling and validation. For advanced topics like custom validation rules, conditional validation, error message customization, and file uploads, see the [Validation guide](../../../guides/basics/validation.md) and [VineJS documentation](https://vinejs.dev).
:::

## Overview

So far in the DevShow tutorial, you've built an application that displays posts from your database. But what about creating new posts? That's where forms come in.

Handling forms involves three main steps:

1. Displaying a form to collect user input.
2. Validating that input on the server to ensure it meets your requirements.
3. Finally saving the validated data to your database.

AdonisJS provides [VineJS](https://vinejs.dev/docs/introduction) for defining validation rules, and Inertia's `Form` component handles form submissions with automatic error handling.

## Adding post creation

Let's start by adding the ability for users to create new posts. We'll need a controller method to display the form, routes to wire everything up, and a React component for the form itself.

::::steps
:::step{title="Add controller methods"}

First, let's add a `create` method to your `PostsController` that will render the form for creating a new post. We'll also stub out a `store` method that we'll implement later to handle the form submission.
```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  // ... existing methods (index, show)

  // [!code ++:13]
  /**
   * Display the form for creating a new post
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('posts/create')
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

:::warning
The `/posts/create` route must be defined before the `/posts/:id` route.
:::
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

:::step{title="Create the form component"}

Create the React component for the form using the Ace CLI.
```bash
node ace make:inertia posts/create
```

This creates `inertia/pages/posts/create.tsx`. Open it and add the following form:
```tsx title="inertia/pages/posts/create.tsx"
import { Form } from '@adonisjs/inertia/react'

export default function PostsCreate() {
  return (
    <div className="form-container">
      <div>
        <h1>Share your creation</h1>
        <p>Share the URL and a short summary of your creation</p>
      </div>

      <div>
        <Form route="posts.store">
          {({ errors }) => (
            <>
              <div>
                <label htmlFor="title">Post title</label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  placeholder="Title of your creation"
                  data-invalid={errors.title ? 'true' : undefined}
                />
                {errors.title && <div>{errors.title}</div>}
              </div>

              <div>
                <label htmlFor="url">URL</label>
                <input
                  type="url"
                  name="url"
                  id="url"
                  placeholder="https://example.com/my-creation"
                  data-invalid={errors.url ? 'true' : undefined}
                />
                {errors.url && <div>{errors.url}</div>}
              </div>

              <div>
                <label htmlFor="summary">Short summary</label>
                <textarea
                  name="summary"
                  id="summary"
                  rows={4}
                  placeholder="Briefly describe what you are sharing"
                  data-invalid={errors.summary ? 'true' : undefined}
                />
                {errors.summary && <div>{errors.summary}</div>}
              </div>

              <div>
                <button type="submit" className="button">
                  Publish
                </button>
              </div>
            </>
          )}
        </Form>
      </div>
    </div>
  )
}
```

The `Form` component from `@adonisjs/inertia/react` handles form submissions. It accepts a `route` prop (the named route to submit to) and provides an `errors` object through a render prop pattern. When you submit the form, Inertia sends the request to your backend and automatically handles the response, including displaying validation errors.

:::

:::step{title="Create a validator"}

Before handling form submissions, we need to define validation rules. AdonisJS uses [VineJS for validation](https://vinejs.dev), a schema-based validation library that lets you define rules for your data. 

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
export const createPostValidator = vine.create({
  title: vine.string().minLength(3).maxLength(255),
  url: vine.string().url(),
  summary: vine.string().minLength(80).maxLength(500),
})
```

The `vine.create()` method creates a pre-compiled validator from a schema. Inside, we define each field with its type and rules.

- The `title` field must be string between 3-255 characters.
- The `url` field must be a string and formatted as a URL.
- The `summary` field must be between 80-500 characters.

:::

:::step{title="Implement the store method"}

Now let's implement the `store` method to validate the data, create the post, and redirect the user.
```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostTransformer from '#transformers/post_transformer'
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

When the form is submitted, `request.validateUsing()` validates the data. If validation fails, the user is automatically redirected back with errors that appear next to the relevant fields. If validation succeeds, we create the post and associate it with the logged-in user using `auth.user!.id` (available via the HTTP context), then redirect to the posts index.

Now visit [`/posts/create`](http://localhost:3333/posts/create), fill out the form, and submit it. Your new post should appear on the posts page! Try submitting invalid data (like a short summary or invalid URL) to see the validation errors in action.

:::

::::

## Adding comments to posts

Now that you can create posts, let's add the ability for users to leave comments. We'll create a separate controller for comments. Having one controller per resource is the recommended approach in AdonisJS.

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
export const createCommentValidator = vine.create({
  content: vine.string().trim().minLength(1),
})
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

We're using `params.id` to get the post ID from the route parameter and use it to associate the comment with the post via `postId`. The `response.redirect().back()` sends the user back to the post page.

:::

:::step{title="Register the comment route"}

Add a route for creating comments, also protected by the auth middleware.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.on('/').renderInertia('home')
router.get('/posts', [controllers.Posts, 'index'])
router.get('/posts/create', [controllers.Posts, 'create']).use(middleware.auth())
router.post('/posts', [controllers.Posts, 'store']).use(middleware.auth())
router.get('/posts/:id', [controllers.Posts, 'show'])

// [!code ++:1]
router.post('/posts/:id/comments', [controllers.Comments, 'store']).use(middleware.auth())
```

:::

:::step{title="Add the comment form"}

Open your `inertia/pages/posts/show.tsx` component and add the comment form.
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
// [!code ++]
import { Form } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function PostsShow(props: PageProps) {
  const { post } = props

  return (
    <div className="container">
      <div>
        <h1>{post.title}</h1>
      </div>

      <div className="post">
        <div className="post-meta">
          <div>By {post.author.fullName}</div>

          <span>.</span>
          <div>
            <a href={post.url} target="_blank" rel="noreferrer">
              {post.url}
            </a>
          </div>
        </div>

        <div className="post-summary">{post.summary}</div>

        <div className="post-comments">
          <h2>Comments</h2>

          // [!code ++:23]
          <div className="post-comment-form">
            <Form route="comments.store" routeParams={{ id: post.id }}>
              {({ errors }) => (
                <>
                  <div>
                    <textarea
                      name="content"
                      rows={3}
                      placeholder="Share your thoughts..."
                      data-invalid={errors.content ? 'true' : undefined}
                    />
                    {errors.content && <div>{errors.content}</div>}
                  </div>

                  <div>
                    <button type="submit" className="button">
                      Post comment
                    </button>
                  </div>
                </>
              )}
            </Form>
          </div>

          {post.comments && post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <p>{comment.content}</p>
                <div className="comment-meta">
                  By {comment.author.fullName} on{' '}
                  {new Date(comment.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            ))
          ) : (
            <p>No comments yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

The `Form` component accepts `routeParams` to pass the post ID to the route. The route `comments.store` corresponds to our `CommentsController.store` method, and we're passing `{ id: post.id }` to fill in the `:id` parameter in the route `/posts/:id/comments`.

Now visit any post page while logged in and try leaving a comment. After submitting, you'll be redirected back to see your comment in the list.

:::

::::

## What you learned

You've now added full form handling and validation to your DevShow application. Here's what you accomplished:

- Created forms using the `Form` component from `@adonisjs/inertia/react`
- Defined validation rules using VineJS validators
- Validated form submissions in your controllers using `request.validateUsing()`
- Protected routes with the `auth()` middleware to ensure only logged-in users can create content
- Associated posts and comments with users using `auth.user!.id`
- Organized your code by creating separate controllers for different resources (PostsController and CommentsController)
- Handled form errors automatically through the `Form` component's render prop pattern
