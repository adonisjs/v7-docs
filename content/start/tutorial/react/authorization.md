# Authorization

In the previous chapter, we improved DevShow's navigation and styling. Now let's add the ability for users to edit and delete their own posts and comments. Right now, any logged-in user could modify anyone's content if we added those features. We need to add authorization checks to prevent this.

## Overview

To handle permissions properly, we'll use [AdonisJS's Bouncer package](../../../guides/auth/authorization.md). Bouncer lets you organize authorization logic into **policies** (classes where each method represents a permission check). For example, a `PostPolicy` can have an `edit` method that checks if a user can edit a specific post.

Instead of scattering permission checks throughout your controllers, you define the rules once in a policy and use them everywhere. In this chapter, we'll install Bouncer, create policies for posts and comments, and implement edit and delete features with proper authorization.

## Installing Bouncer

Let's install and configure the Bouncer package using the following command.
```bash
node ace add @adonisjs/bouncer
```

Running this command will first install the package and then performs the following actions.

- Creates an `app/abilities/main.ts` file where you can define authorization abilities (we won't need this file for now, so don't worry about it)
- Registers a middleware that initializes Bouncer for every HTTP request
- Makes the `bouncer` object available on the `HttpContext`, so you can use it in your controllers

You're all set! Now let's create our first policy.

## Creating the PostPolicy

Policies are classes where each method represents a permission check. Let's create a policy for posts.
```bash
node ace make:policy post
```

Open the generated file and add permission checks for editing and deleting posts.
```ts title="app/policies/post_policy.ts"
import type User from '#models/user'
import type Post from '#models/post'
import { BasePolicy } from '@adonisjs/bouncer'

export default class PostPolicy extends BasePolicy {
  /**
   * Only the post owner can edit their post
   */
  edit(user: User, post: Post) {
    return user.id === post.userId
  }

  /**
   * Only the post owner can delete their post
   */
  delete(user: User, post: Post) {
    return user.id === post.userId
  }
}
```

Each policy method receives the currently logged-in user as the first parameter, followed by the resource being checked (in this case, the `post`). The method returns `true` if the user is allowed to perform the action, or `false` if they're not. Here, we're simply checking if the user's ID matches the post's `userId`.

You might notice that `edit` and `delete` have identical logic right now. Even though they're the same, keeping them separate gives you flexibility. Later, you might decide that posts can't be edited after 24 hours, or that admins can delete any post but can't edit them. Having separate methods makes these kinds of changes easier.

## Creating the CommentPolicy

Now create a policy for comments.
```bash
node ace make:policy comment
```

Add the delete permission check.
```ts title="app/policies/comment_policy.ts"
import type User from '#models/user'
import type Comment from '#models/comment'
import { BasePolicy } from '@adonisjs/bouncer'

export default class CommentPolicy extends BasePolicy {
  /**
   * Only the comment owner can delete their comment
   */
  delete(user: User, comment: Comment) {
    return user.id === comment.userId
  }
}
```

Perfect! Now let's put these policies to work.

## Adding edit functionality

::::steps
:::step{title="Create the update validator"}

We'll add a validator for updating posts. Since we already have a `validators/post.ts` file for creating posts, we'll add the update validator there too. A single validator file can export multiple validators (this keeps related validation logic organized together).

Open your existing post validator file and add the update validator.
```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const createPostValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(3).maxLength(255),
    url: vine.string().url(),
    summary: vine.string().minLength(80).maxLength(500),
  })
)

// [!code ++:6]
/**
 * Same validation rules as creating a post
 */
export const updatePostValidator = vine.create(
  createPostValidator.schema.clone()
)
```

We're cloning the `createPostValidator` schema to reuse the same validation rules. This approach keeps our validation logic DRY (Don't Repeat Yourself). If you need to change a rule later, you only update it in one place. In many applications, you might want different rules for creating vs. updating, but for DevShow, the requirements are the same.

:::

:::step{title="Add controller methods"}

We'll add two controller methods: `edit` to show the edit form, and `update` to handle the form submission. Both methods will use Bouncer to check if the current user is allowed to modify the post before performing any action.
```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostTransformer from '#transformers/post_transformer'
// [!code ++:2]
import { createPostValidator, updatePostValidator } from '#validators/post'
import PostPolicy from '#policies/post_policy'

export default class PostsController {
  // ... existing methods (index, create, store, show)

  // [!code ++:28]
  /**
   * Show the edit form
   */
  async edit({ bouncer, params, inertia }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // Check if the current user can edit this post
    await bouncer.with(PostPolicy).authorize('edit', post)

    return inertia.render('posts/edit', {
      post: PostTransformer.transform(post),
    })
  }

  /**
   * Update the post
   */
  async update({ bouncer, params, request, response, session }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // Check authorization again. Someone could send a PUT request directly
    await bouncer.with(PostPolicy).authorize('edit', post)

    // Validate and update the post
    const data = await request.validateUsing(updatePostValidator)
    await post.merge(data).save()

    session.flash('success', 'Post updated successfully')
    return response.redirect().toRoute('posts.show', { id: post.id })
  }
}
```

The key part here is `bouncer.with(PostPolicy).authorize('edit', post)`. This line:

- Calls the `edit` method in our `PostPolicy`
- Passes the post to the policy method
- If the policy returns `false`, Bouncer automatically throws a 403 Forbidden error
- If the policy returns `true`, the code continues executing

We check authorization in both methods. Even though `edit` checks permissions, someone could bypass the form and send a PUT request directly to the `update` route. Always verify permissions before performing sensitive actions.

You'll also notice `session.flash('success', 'Post updated successfully')` in the `update` method. [Flash messages](../../../guides/basics/session.md#flash-messages) are temporary messages stored in the session that are available on the next request and then automatically removed. This is perfect for showing success or error messages after form submissions.

:::

:::step{title="Update the Post transformer to include authorization"}

Now that we understand how to use policies in controllers, let's also use them in transformers to send authorization flags to the frontend.

Here's an important consideration: **Bouncer policies run in the backend environment, so they cannot be imported or used directly in your React code.** Your React components have no access to the backend's authorization logic.

The solution is to **pre-compute user permissions within transformers and send them as flags** to the frontend. Transformers run on the backend where they have access to policies, and can include permission checks in the serialized data.

We'll use a **transformer variant** for this. Variants allow you to define multiple output shapes for the same resource. For example, you might want minimal data for list views but detailed data (including permissions) for detail views. Learn more about variants in the [Transformers documentation](../../../guides/basics/transformers.md#variants).

Let's add a `forDetailedView` variant to the `PostTransformer`:
```ts title="app/transformers/post_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Post from '#models/post'
import UserTransformer from '#transformers/user_transformer'
import CommentTransformer from '#transformers/comment_transformer'
// [!code ++:3]
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import PostPolicy from '#policies/post_policy'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'url', 'summary', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments)),
    }
  }

  // [!code ++:15]
  /**
   * Include authorization data for the post detail view
   */
  @inject()
  async forDetailedView({ bouncer }: HttpContext) {
    return {
      ...this.toObject(),
      can: {
        edit: await bouncer.with(PostPolicy).allows('edit', this.resource),
        delete: await bouncer.with(PostPolicy).allows('delete', this.resource),
      },
    }
  }
}
```

Notice we're using the same `bouncer.with(PostPolicy)` pattern we used in the controller, but instead of `.authorize()` (which throws errors), we use `.allows()` (which returns boolean). The `@inject()` decorator allows us to access the HTTP context in our transformer.

When your React component receives this data, it has simple boolean flags (`post.can.edit`, `post.can.delete`) it can use for conditional rendering—without needing to know anything about the authorization logic itself.

Now update the `show` method to use this variant:
```ts title="app/controllers/posts_controller.ts"
async show({ inertia, params }: HttpContext) {
  const post = await Post.query()
    .where('id', params.id)
    .preload('user')
    .preload('comments', (query) => {
      query.preload('user').orderBy('createdAt', 'asc')
    })
    .firstOrFail()

  // [!code --:3]
  return inertia.render('posts/show', {
    post: PostTransformer.transform(post),
  })
  // [!code ++:3]
  return inertia.render('posts/show', {
    post: PostTransformer.transform(post).useVariant('forDetailedView'),
  })
}
```

:::

:::step{title="Register the routes"}

Now let's register the routes for editing posts. Open your routes file.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
router.get('/posts/create', [controllers.Posts, 'create']).use(middleware.auth())
router.post('/posts', [controllers.Posts, 'store']).use(middleware.auth())
router.get('/posts/:id', [controllers.Posts, 'show'])

// [!code ++:2]
router.get('/posts/:id/edit', [controllers.Posts, 'edit']).use(middleware.auth())
router.put('/posts/:id', [controllers.Posts, 'update']).use(middleware.auth())

router.post('/posts/:id/comments', [controllers.Comments, 'store']).use(middleware.auth())
```

We need two routes (one to show the edit form and another to handle the form submission). Both require authentication.

:::

:::step{title="Create the edit form component"}

Create the edit form component.
```bash
node ace make:inertia posts/edit
```

Now add the form markup.
```tsx title="inertia/pages/posts/edit.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function PostsEdit(props: PageProps) {
  const { post } = props

  return (
    <div className="form-container">
      <Link route="posts.show" routeParams={{ id: post.id }}>
        &lsaquo; Back to post
      </Link>

      <h1>Edit Post</h1>

      <Form route="posts.update" routeParams={{ id: post.id }} method="put">
        {({ errors }) => (
          <>
            <div>
              <label htmlFor="title">Post title</label>
              <input
                type="text"
                name="title"
                id="title"
                defaultValue={post.title}
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
                defaultValue={post.url}
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
                defaultValue={post.summary}
                data-invalid={errors.summary ? 'true' : undefined}
              />
              {errors.summary && <div>{errors.summary}</div>}
            </div>

            <div>
              <button type="submit" className="button">
                Update Post
              </button>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
```

This form is similar to the create form, with a few key differences:

- **HTTP method**: Uses `method="put"` to indicate this is an update request, not a POST for creating new data
- **Pre-filled values**: Each field shows the current post data (`defaultValue={post.title}`, etc.) so users can see what they're editing
- **Route**: Submits to the `posts.update` route with the post ID included via `routeParams`

:::

:::step{title="Add edit button to post detail page"}

Now add an Edit button to the post detail page. Open your `posts/show.tsx` component.
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function PostsShow(props: PageProps) {
  const { post } = props

  return (
    <div className="container">
      <Link route="posts.index">&lsaquo; Go back to posts listing</Link>
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

        // [!code ++:9]
        <div className="post-actions">
          {post.can?.edit && (
            <Link route="posts.edit" routeParams={{ id: post.id }}>
              Edit post
            </Link>
          )}
        </div>

        <div className="post-comments">
          {/* ... comments ... */}
        </div>
      </div>
    </div>
  )
}
```

We're using conditional rendering with `post.can?.edit` to show the Edit button only to the post owner. The `can` object comes from our transformer's `forDetailedView` variant, which used the same `PostPolicy` we saw in the controller.

Non-owners won't even see the Edit button in the component. If someone tries to visit the edit URL directly, they still get a 403 error from the controller's authorization check.

:::

::::

Visit a post you created and you'll see the Edit button. Click it and try updating your post!

## Adding delete functionality

::::steps
:::step{title="Add controller method"}

Deleting a post is simpler than editing because there's no form to show (just a button that submits a DELETE request). Let's add the controller method to handle deletions.
```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import PostTransformer from '#transformers/post_transformer'
import { createPostValidator, updatePostValidator } from '#validators/post'
import PostPolicy from '#policies/post_policy'

export default class PostsController {
  // ... existing methods

  // [!code ++:14]
  /**
   * Delete a post
   */
  async destroy({ bouncer, params, response, session }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // Check if the user can delete this post
    await bouncer.with(PostPolicy).authorize('delete', post)

    await post.delete()

    session.flash('success', 'Post deleted successfully')
    return response.redirect().toRoute('posts.index')
  }
}
```

The pattern is familiar by now: find the post, authorize the action using the policy, perform the deletion, flash a success message, and redirect. After deleting a post, we redirect to the posts index page since the post detail page no longer exists.

:::

:::step{title="Register the route"}

Now register the delete route.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.put('/posts/:id', [controllers.Posts, 'update']).use(middleware.auth())
// [!code ++:1]
router.delete('/posts/:id', [controllers.Posts, 'destroy']).use(middleware.auth())
router.post('/posts/:id/comments', [controllers.Comments, 'store']).use(middleware.auth())
```

:::

:::step{title="Add delete button to post detail page"}

Add a delete button next to the edit button in your post detail component.
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function PostsShow(props: PageProps) {
  const { post } = props

  return (
    <div className="container">
      <Link route="posts.index">&lsaquo; Go back to posts listing</Link>
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

        <div className="post-actions">
          {post.can?.edit && (
            <Link route="posts.edit" routeParams={{ id: post.id }}>
              Edit post
            </Link>
          )}

          // [!code ++:10]
          {post.can?.delete && (
            <>
              <span>.</span>
              <Form route="posts.destroy" routeParams={{ id: post.id }} method="delete">
                {() => (
                  <button type="submit" className="destructive">
                    Delete
                  </button>
                )}
              </Form>
            </>
          )}
        </div>

        <div className="post-comments">
          {/* ... comments ... */}
        </div>
      </div>
    </div>
  )
}
```

A few important things about this delete button:

- **DELETE method** - We're using `method="delete"` in the form. Inertia handles method spoofing automatically
- **Authorization check** - The `post.can?.delete` check ensures only the post owner sees the button
- **Form component** - Even for a simple delete action, we use the `Form` component to properly handle the request

Try it out! Visit a post you created and you'll see both Edit and Delete buttons. Visit a post created by someone else and no buttons appear.

:::

::::

## Adding comment deletion

::::steps
:::step{title="Update the Comment transformer to include authorization"}

Similar to posts, we need to add authorization data to comments. We'll use the same policy pattern we learned earlier. Create a variant in the `CommentTransformer`:
```ts title="app/transformers/comment_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Comment from '#models/comment'
import UserTransformer from '#transformers/user_transformer'
// [!code ++:3]
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import CommentPolicy from '#policies/comment_policy'

export default class CommentTransformer extends BaseTransformer<Comment> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'content', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
    }
  }

  // [!code ++:13]
  /**
   * Include authorization data for comments
   */
  @inject()
  async withAuthorization({ bouncer }: HttpContext) {
    return {
      ...this.toObject(),
      can: {
        delete: await bouncer.with(CommentPolicy).allows('delete', this.resource),
      },
    }
  }
}
```

:::

:::step{title="Update Post transformer to use comment authorization variant"}

Now update the `PostTransformer` to use the comment authorization variant:
```ts title="app/transformers/post_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Post from '#models/post'
import UserTransformer from '#transformers/user_transformer'
import CommentTransformer from '#transformers/comment_transformer'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import PostPolicy from '#policies/post_policy'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'url', 'summary', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments)),
    }
  }

  @inject()
  async forDetailedView({ bouncer }: HttpContext) {
    return {
      ...this.toObject(),
      // [!code --:1]
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments)),
      // [!code ++:3]
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments)).useVariant(
        'withAuthorization'
      ),
      can: {
        edit: await bouncer.with(PostPolicy).allows('edit', this.resource),
        delete: await bouncer.with(PostPolicy).allows('delete', this.resource),
      },
    }
  }
}
```

:::

:::step{title="Add controller method"}

Let's add the controller method for deleting comments.
```ts title="app/controllers/comments_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Comment from '#models/comment'
import { createCommentValidator } from '#validators/comment'
// [!code ++:1]
import CommentPolicy from '#policies/comment_policy'

export default class CommentsController {
  // ... existing store method

  // [!code ++:17]
  /**
   * Delete a comment
   */
  async destroy({ bouncer, params, response, session }: HttpContext) {
    const comment = await Comment.findOrFail(params.id)

    // Load the post so we can redirect back to it
    await comment.load('post')

    // Check if the user can delete this comment
    await bouncer.with(CommentPolicy).authorize('delete', comment)

    await comment.delete()

    session.flash('success', 'Comment deleted successfully')
    return response.redirect().toRoute('posts.show', { id: comment.post.id })
  }
}
```

Here's what this method does:

- **Finds the comment** using the ID from the route parameter
- **Loads the post relationship** so we have access to `comment.post.id` for redirecting after deletion
- **Checks authorization** with `CommentPolicy`. If the user doesn't own the comment, they get a 403 error
- **Deletes the comment** from the database
- **Redirects back** to the post detail page where the comment was displayed

:::

:::step{title="Register the route"}

Now register the delete route for comments.
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

router.get('/posts/:id/edit', [controllers.Posts, 'edit']).use(middleware.auth())
router.put('/posts/:id', [controllers.Posts, 'update']).use(middleware.auth())
router.delete('/posts/:id', [controllers.Posts, 'destroy']).use(middleware.auth())
router.post('/posts/:id/comments', [controllers.Comments, 'store']).use(middleware.auth())

// [!code ++:3]
router
  .delete('/comments/:id', [controllers.Comments, 'destroy'])
  .use(middleware.auth())
```

:::

:::step{title="Add delete button to comments"}

Finally, add delete buttons to the comments list in your post detail component.
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
import { Form, Link } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  post: Data.Post
}>

export default function PostsShow(props: PageProps) {
  const { post } = props

  return (
    <div className="container">
      <Link route="posts.index">&lsaquo; Go back to posts listing</Link>
      <div>
        <h1>{post.title}</h1>
      </div>

      <div className="post">
        <div className="post-meta">{/* ... */}</div>
        <div className="post-summary">{post.summary}</div>
        <div className="post-actions">{/* ... */}</div>

        <div className="post-comments">
          <h2>Comments</h2>

          <div className="post-comment-form">{/* ... */}</div>

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
                // [!code ++:10]
                <div className="comment-actions">
                  {comment.can?.delete && (
                    <Form route="comments.destroy" routeParams={{ id: comment.id }} method="delete">
                      {() => (
                        <button type="submit" className="destructive">
                          Delete
                        </button>
                      )}
                    </Form>
                  )}
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

How the comment delete button works:

- **Policy check** - The `comment.can?.delete` checks if the current user can delete each comment
- **Visibility** - Only the comment's author will see the delete button
- **Action** - The button submits a DELETE request to the `comments.destroy` route

Visit a post with comments you created and you'll see delete buttons next to your comments. Try viewing comments from other users and no delete buttons will appear.

:::

::::

## What you built

You've successfully added authorization to DevShow using Bouncer's policy system. Here's what you accomplished:

- Created `PostPolicy` and `CommentPolicy` to centralize all permission logic in one place
- Used `bouncer.with(Policy).authorize()` in controllers to enforce permissions before allowing actions
- Learned about **transformer variants** - multiple output shapes for the same resource depending on context
- Used the `@inject()` decorator to access the HTTP context in transformer variants
- Pre-computed user permissions in transformers using policies and sent them as `can` flags to the frontend
- Implemented the complete edit post feature with form, validation, and authorization
- Added delete functionality for both posts and comments with proper permission checks
- Used conditional rendering in React components to show action buttons only to authorized users

The key benefit of this approach is that your authorization logic lives entirely on the backend where it can't be bypassed. Bouncer policies run in a secure environment, and transformers send pre-computed permission flags to React components for UI decisions. This keeps your frontend simple while maintaining security.
