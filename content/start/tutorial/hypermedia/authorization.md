# Authorization

In the previous chapter, we improved DevShow's navigation and styling. Now let's add the ability for users to edit and delete their own posts and comments. Right now, any logged-in user could modify anyone's content if we added those features—we need to add authorization checks to prevent this.

## Overview

To handle permissions properly, we'll use AdonisJS's Bouncer package. Bouncer lets you organize authorization logic into **policies**—classes where each method represents a permission check. For example, a `PostPolicy` can have an `edit` method that checks if a user can edit a specific post.

Instead of scattering permission checks throughout your controllers, you define the rules once in a policy and use them everywhere. In this chapter, we'll install Bouncer, create policies for posts and comments, and implement edit and delete features with proper authorization.

## Installing Bouncer

Let's install the Bouncer package:

```bash
npm install @adonisjs/bouncer
```

Now configure it:

```bash
node ace configure @adonisjs/bouncer
```

This configuration command does a few things for you:

- Creates an `app/abilities/main.ts` file where you can define authorization abilities (we won't need this file for now, so don't worry about it)
- Registers a middleware that initializes Bouncer for every HTTP request
- Makes the `bouncer` object available on the `HttpContext`, so you can use it in your controllers

You're all set! Now let's create our first policy.

## Creating the PostPolicy

Policies are classes where each method represents a permission check. Let's create a policy for posts:

```bash
node ace make:policy post
```

Open the generated file and add permission checks for editing and deleting posts.

```ts title="app/policies/post_policy.ts"
import User from '#models/user'
import Post from '#models/post'
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

Now create a policy for comments:

```bash
node ace make:policy comment
```

Add the delete permission check.

```ts title="app/policies/comment_policy.ts"
import User from '#models/user'
import Comment from '#models/comment'
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

We'll add a validator for updating posts. Since we already have a `validators/post.ts` file for creating posts, we'll add the update validator there too. A single validator file can export multiple validators—this keeps related validation logic organized together.

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

// [!code ++:11]
/**
 * Same validation rules as creating a post
 */
export const updatePostValidator = vine.compile(
  vine.object({
    title: vine.string().minLength(3).maxLength(255),
    url: vine.string().url(),
    summary: vine.string().minLength(80).maxLength(500),
  })
)
```

We're using the same validation rules for both creating and updating posts. In many applications, you might want different rules—for example, allowing updates without certain required fields—but for DevShow, the requirements are the same.

:::

:::step{title="Add controller methods"}

We'll add two controller methods: `edit` to show the edit form, and `update` to handle the form submission. Both methods will use Bouncer to check if the current user is allowed to modify the post before performing any action.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
// [!code ++:2]
import { createPostValidator, updatePostValidator } from '#validators/post'
import PostPolicy from '#policies/post_policy'

export default class PostsController {
  // ... existing methods (index, create, store, show)

  // [!code ++:28]
  /**
   * Show the edit form
   */
  async edit({ bouncer, params, view }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // Check if the current user can edit this post
    await bouncer.with(PostPolicy).authorize('edit', post)

    return view.render('posts/edit', { post })
  }

  /**
   * Update the post
   */
  async update({ bouncer, params, request, response, session }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    // Check authorization again—someone could send a PUT request directly
    await bouncer.with(PostPolicy).authorize('edit', post)

    // Validate and update the post
    const data = await request.validateUsing(updatePostValidator)
    await post.merge(data).save()

    session.flash('notification', 'Post updated successfully')
    return response.redirect().toRoute('posts.show', { id: post.id })
  }
}
```

The key part here is `bouncer.with(PostPolicy).authorize('edit', post)`. This line:

- Calls the `edit` method in our `PostPolicy`
- Passes the the post to the policy method
- If the policy returns `false`, Bouncer automatically throws a 403 Forbidden error
- If the policy returns `true`, the code continues executing

Notice we check authorization in both methods. Even though `edit` checks permissions, someone could bypass the form and send a PUT request directly to the `update` route. Always verify permissions before performing sensitive actions.

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

We need two routes—one to show the edit form and another to handle the form submission. Both require authentication.

:::

:::step{title="Create the edit form template"}

Create the edit form template:

```bash
node ace make:view posts/edit
```

Now add the form markup.

```edge title="resources/views/posts/edit.edge"
@layout()
  <div class="form-container">
    @!link({
      route: 'posts.show',
      routeParams: post,
      text: '&lsaquo; Back to post'
    })

    <h1>Edit Post</h1>

    @form({ route: 'posts.update', routeParams: post, method: 'PUT' })
      <div>
        @field.root({ name: 'title' })
          @!field.label({ text: 'Post title' })
          @!input.control({ value: post.title })
          @!field.error()
        @end
      </div>
      
      <div>
        @field.root({ name: 'url' })
          @!field.label({ text: 'URL' })
          @!input.control({ type: 'url', value: post.url })
          @!field.error()
        @end
      </div>
      
      <div>
        @field.root({ name: 'summary' })
          @!field.label({ text: 'Short summary' })
          @!textarea.control({ rows: 4, value: post.summary })
          @!field.error()
        @end
      </div>
      
      <div>
        @!button({ text: 'Update Post', type: 'submit' })
      </div>
    @end
  </div>
@end
```

This form is similar to the create form, with a few key differences:

- **HTTP method**: Uses `method: 'PUT'` to indicate this is an update request, not a POST for creating new data
- **Pre-filled values**: Each field shows the current post data (`value: post.title`, `value: post.url`, `text: post.summary`) so users can see what they're editing
- **Route**: Submits to the `posts.update` route with the post ID included in the URL

:::

:::step{title="Add edit button to post detail page"}

Now add an Edit button to the post detail page. Open your `posts/show.edge` template.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    <div class="post-header">
      @!link({
        route: 'posts.index',
        text: '&lsaquo; Go back to posts listing'
      })

      // [!code ++:9]
      {{-- Show edit button only to the post owner --}}
      @can('PostPolicy.edit', post)
        <span>.</span>
        @!link({
          route: 'posts.edit',
          routeParams: post,
          text: 'Edit',
        })
      @end
    </div>

    <h1>{{ post.title }}</h1>

    <div class="post">
      {{-- ... existing post info ... --}}
    </div>
  </div>
@end
```

The `@can` tag checks the policy method in your template, similar to how `bouncer.authorize()` works in controllers:

- **First parameter** (`'PostPolicy.edit'`) - Specifies which policy and method to use
- **Second parameter** (`post`) - The resource being checked, passed to the policy method
- **When check fails** - Everything between `@can` and `@end` is hidden from the HTML output

Non-owners won't even see the Edit button in the page source. If someone tries to visit the edit URL directly, they still get a 403 error from the controller's authorization check.

:::

::::

Visit a post you created and you'll see the Edit button. Click it and try updating your post!

## Adding delete functionality

::::steps
:::step{title="Add controller method"}

Deleting a post is simpler than editing because there's no form to show—just a button that submits a DELETE request. Let's add the controller method to handle deletions.

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
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

    session.flash('notification', 'Post deleted successfully')
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

Add a delete button next to the edit button in your post detail template.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    <div class="post-header">
      @!link({
        route: 'posts.index',
        text: '&lsaquo; Go back to posts listing'
      })

      {{-- Show edit button only to the post owner --}}
      @can('PostPolicy.edit', post)
        <span>.</span>
        @!link({
          route: 'posts.edit',
          routeParams: post,
          text: 'Edit',
        })
      @end

      // [!code ++:7]
      {{-- Show delete button only to the post owner --}}
      @can('PostPolicy.delete', post)
        <span>.</span>
        @form({ route: 'posts.destroy', routeParams: post, method: 'DELETE' })
          @!button({ text: 'Delete', class: 'destructive' })
        @end
      @end
    </div>

    {{-- ... rest of the template ... --}}
  </div>
@end
```

A few important things about this delete button:

- **Form wrapper** - We need a form with `method: 'DELETE'` because HTML forms only support GET and POST natively
- **DELETE simulation** - AdonisJS uses a POST request with a special field to simulate the DELETE method
- **Authorization check** - The `@can('PostPolicy.delete', post)` tag ensures only the post owner sees the button

Try it out! Visit a post you created and you'll see both Edit and Delete buttons. Visit a post created by someone else—no buttons appear.

:::

::::

## Adding comment deletion

::::steps
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

    session.flash('notification', 'Comment deleted successfully')
    return response.redirect().toRoute('posts.show', { id: comment.post.id })
  }
}
```

Here's what this method does:

- **Finds the comment** using the ID from the route parameter
- **Loads the post relationship** so we have access to `comment.post.id` for redirecting after deletion
- **Checks authorization** with `CommentPolicy`—if the user doesn't own the comment, they get a 403 error
- **Deletes the comment** from the database
- **Redirects back** to the post detail page where the comment was displayed

:::

:::step{title="Register the route"}

Now register the delete route for comments.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'

// ... existing routes

// [!code ++:3]
router
  .delete('/comments/:id', [controllers.Comments, 'destroy'])
  .use(middleware.auth())
```

:::

:::step{title="Add delete buttons to comments"}

Finally, add delete buttons to the comments list in your post detail template.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    {{-- ... post content ... --}}

    <div class="posts-comments">
      <h2>Comments</h2>

      <div class="post-comment-form">
        {{-- ... comment form ... --}}
      </div>

      @each(comment in post.comments)
        <div class="comment-item">
          // [!code ++:16]
          <div class="comment-header">
            <div class="comment-content">
              <p>{{ comment.content }}</p>
              <p class="comment-meta">
                By {{ comment.user.fullName }} on {{ comment.createdAt.toFormat('MMM dd, yyyy') }}
              </p>
            </div>

            {{-- Show delete button only to the comment owner --}}
            @can('CommentPolicy.delete', comment)
              @form({ route: 'comments.destroy', routeParams: [comment.id], method: 'DELETE' })
                @!button({ type: 'submit', text: 'Delete', size: 'sm' })
              @end
            @end
          </div>
        </div>
      @else
        <p>No comments yet.</p>
      @end
    </div>
  </div>
@end
```

How the comment delete button works:

- **Policy check** - The `@can` tag checks `CommentPolicy` to determine if the current user can delete each comment
- **Visibility** - Only the comment's author will see the delete button
- **Action** - The button submits a DELETE request to the `comments.destroy` route

Visit a post with comments you created and you'll see delete buttons next to your comments. Try viewing comments from other users—no delete buttons will appear.

:::

::::

## What you built

You've successfully added authorization to DevShow using Bouncer's policy system. Here's what you accomplished:

- Created `PostPolicy` and `CommentPolicy` to centralize all permission logic in one place
- Used `bouncer.with(Policy).authorize()` in controllers to enforce permissions before allowing actions
- Implemented the complete edit post feature with form, validation, and authorization
- Added delete functionality for both posts and comments with proper permission checks
- Used the `@can` tag in templates to conditionally show action buttons only to authorized users

The key benefit of this approach is that your authorization logic is reusable and maintainable. When you need to change a permission rule, you update it in one place (the policy), and it automatically applies everywhere you use that policy—in controllers, templates, and anywhere else in your application.
