# Routes, Controllers and Views

In the previous chapter, we created the Post and Comment models with their database tables and relationships. Now we'll bring those models to life by building pages where users can actually see posts.

:::note
This tutorial covers basic routing, controllers, and views. For advanced topics like route groups, middleware, route parameters validation, and custom Inertia components, see the [Routing guide](../../../guides/basics/routing.md), [Controllers guide](../../../guides/basics/controllers.md), and [Inertia documentation](https://inertiajs.com).
:::

## Overview

Right now, your posts and comments exist only in the database. Let's build two pages: one that lists all posts, and another that shows a single post with its comments. 

This is where you'll see the complete flow in action — **models handle data**, **transformers serialize it for the frontend**, **controllers coordinate logic**, and **React components display everything to users**.

Before we begin, make sure your development server is running.

```bash
node ace serve --hmr
```

## Displaying the posts list

Let's build the complete feature for displaying a list of posts. We'll create a transformer to serialize post data, add a controller method to fetch posts, register a route, and create the React component.

::::steps
:::step{title="Creating the transformer"}

Transformers convert your Lucid models into plain JSON objects that can be safely sent to your React frontend. They explicitly control what data gets serialized and generate TypeScript types for your components.

Create a transformer for posts:
```bash
node ace make:transformer post
```

This creates `app/transformers/post_transformer.ts`. Open it and define what data to serialize:
```ts title="app/transformers/post_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Post from '#models/post'
import UserTransformer from '#transformers/user_transformer'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'url', 'summary', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
    }
  }
}
```

We're using `this.pick()` to select specific fields from the Post model, and transforming the related `user` with `UserTransformer`. The starter kit already includes `UserTransformer`, which serializes user data (id, fullName, email).

:::

:::step{title="Creating the controller"}

Now create a controller to handle post-related requests.
```bash
node ace make:controller posts
```

This creates `app/controllers/posts_controller.ts`. Add a method to list all posts:
```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.query()
      .preload('user')
      .orderBy('createdAt', 'desc')

    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts),
    })
  }
}
```

A few things to note here:
- We're preloading the `user` relationship so we can display the author's name without extra queries
- We're ordering posts by creation date with newest first
- We're using `PostTransformer.transform()` to serialize the posts

:::

:::step{title="Defining the route"}

Open your routes file and register a route.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.on('/').renderInertia('home').as('home')
// [!code ++]
router.get('/posts', [controllers.Posts, 'index'])
```

The route connects the `/posts` URL to your controller's `index` method. When someone visits `/posts`, AdonisJS calls `PostsController.index()` and Inertia renders the React component with the posts data.

:::

:::step{title="Creating the React component"}

Time to create the React component that will display the posts.
```bash
node ace make:inertia posts/index
```

This creates `inertia/pages/posts/index.tsx`. Open it and add the following code:

```tsx title="inertia/pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'

type PageProps = InertiaProps<{
  posts: Data.Post[]
}>

export default function PostsIndex(props: PageProps) {
  const { posts } = props

  return (
    <div className="container">
      <div className="posts-list-title">
        <h1>Posts</h1>
      </div>

      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h2>{post.title}</h2>

          <div className="post-meta">
            <div>By {post.author.fullName}</div>

            <span>.</span>
            <div>
              <a href={post.url} target="_blank" rel="noreferrer">
                {post.url}
              </a>
            </div>

            <span>.</span>
            <div>
              <a href={`/posts/${post.id}`}>View comments</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

Let's break down what's happening:

- **TypeScript props**: We're using `InertiaProps` combined with the generated `Data.Post` type to get full type safety. The `Data.Post` type is automatically generated from our `PostTransformer`.
- **Mapping posts**: We loop through the posts array and display each post's title, author, and URL.
- **Type safety**: Your editor will autocomplete `post.title`, `post.author.fullName`, etc., and TypeScript will catch any typos.

:::
::::

Visit [`/posts`](http://localhost:3333/posts) and you should see a list of all your posts!

## Displaying a single post

Now let's add the ability to view an individual post with its details. We'll implement the controller method, register the route with a dynamic parameter, and create the React component.

::::steps
:::step{title="Implementing the controller method"}

Add the `show` method to your controller:

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.query()
      .preload('user')
      .orderBy('createdAt', 'desc')

    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts),
    })
  }

  // [!code ++:10]
  async show({ inertia, params }: HttpContext) {
    const post = await Post.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    return inertia.render('posts/show', {
      post: PostTransformer.transform(post),
    })
  }
}
```

We're using `firstOrFail()` which will automatically throw a 404 error if no post exists with that ID. The pattern is the same as `index`: fetch data, transform it, and pass it as props.

:::

:::step{title="Registering the route"}

Register the route for this controller method:
```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
// [!code ++]
router.get('/posts/:id', [controllers.Posts, 'show'])
```

The `:id` part is a route parameter. When someone visits `/posts/5`, AdonisJS captures that `5` and makes it available in your controller as `params.id`.

:::

:::step{title="Creating the React component"}

Create the component for displaying a single post:
```bash
node ace make:inertia posts/show
```

This creates `inertia/pages/posts/show.tsx`. Open it and add the following code:
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'

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
      </div>
    </div>
  )
}
```

Again, we're using `InertiaProps` with the generated `Data.Post` type to get automatic type safety for the `post` prop.

Try clicking on a post from your [list page](http://localhost:3333/posts). You should now see the full post with its title, author, and content.

:::
::::

## Using client-side navigation

Right now, clicking between pages causes full page reloads. Inertia provides a `Link` component that enables client-side navigation — clicking a link fetches only the new page data via AJAX and swaps the component, making your app feel instant.

Let's update the posts list to use the `Link` component:
```tsx title="inertia/pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'
// [!code ++]
import { Link } from '@adonisjs/inertia/react'

type PageProps = InertiaProps<{
  posts: Data.Post[]
}>

export default function PostsIndex(props: PageProps) {
  const { posts } = props

  return (
    <div className="container">
      <div className="posts-list-title">
        <h1>Posts</h1>
      </div>

      {posts.map((post) => (
        <div key={post.id} className="post-item">
          <h2>{post.title}</h2>

          <div className="post-meta">
            <div>By {post.author.fullName}</div>

            <span>.</span>
            <div>
              <a href={post.url} target="_blank" rel="noreferrer">
                {post.url}
              </a>
            </div>

            <span>.</span>
            <div>
              // [!code --]
              <a href={`/posts/${post.id}`}>View comments</a>
              // [!code ++]
              <Link route="posts.show" routeParams={{ id: post.id }}>
                View comments
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

The `Link` component accepts two important props:

- **`route`**: The name of the route to navigate to. In this case, `posts.show` refers to our `PostsController.show` method.
- **`routeParams`**: An object containing parameters for the route. Here, we're passing the post's ID to fill in the `:id` parameter.

### About named routes

You might be wondering where `posts.show` comes from. When you define a route with a controller, AdonisJS automatically generates a route name based on the controller and method names. For example, `[controllers.Posts, 'show']` automatically gets the name `posts.show`.

This is much better than hardcoding URLs like `href={/posts/${post.id}}` because:

- **Maintainability**: If you change the URL pattern from `/posts/:id` to `/showcase/:id` in your routes file, all your links automatically work with the new pattern. No find-and-replace needed.
- **Type safety**: The `route` prop expects valid route names, so TypeScript will catch typos.
- **Centralized routing**: All URL patterns are defined in one place (your routes file), making your application easier to understand and modify.

Now when you click "View comments", Inertia handles the navigation without a full page reload. The browser's back button still works, and the URL updates properly — but it feels much faster.

## Adding comments to the post view

Finally, let's display the comments for each post. First, we need to create a transformer for comments, update the Post transformer to include them, preload them in the controller, and finally display them in the React component.

::::steps
:::step{title="Create the Comment transformer"}

Create a transformer for comments:
```bash
node ace make:transformer comment
```

Open it and define what data to serialize:
```ts title="app/transformers/comment_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Comment from '#models/comment'
import UserTransformer from '#transformers/user_transformer'

export default class CommentTransformer extends BaseTransformer<Comment> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'content', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
    }
  }
}
```

:::

:::step{title="Update the Post transformer"}

Now update `PostTransformer` to include comments:
```ts title="app/transformers/post_transformer.ts"
import { BaseTransformer } from '@adonisjs/core/transformers'
import type Post from '#models/post'
import UserTransformer from '#transformers/user_transformer'
// [!code ++]
import CommentTransformer from '#transformers/comment_transformer'

export default class PostTransformer extends BaseTransformer<Post> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'url', 'summary', 'createdAt']),
      author: UserTransformer.transform(this.resource.user),
      // [!code ++]
      comments: CommentTransformer.transform(this.whenLoaded(this.resource.comments)),
    }
  }
}
```

We're using `this.whenLoaded()` to guard against undefined relationships. This means the `comments` field will only be included if we preloaded the relationship in the controller.

:::

:::step{title="Preload comments in the controller"}

Update the `show` method to preload comments and their authors:
```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.query()
      .preload('user')
      .orderBy('createdAt', 'desc')

    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts),
    })
  }

  async show({ inertia, params }: HttpContext) {
    const post = await Post.query()
      .where('id', params.id)
      .preload('user')
      // [!code ++:3]
      .preload('comments', (query) => {
        query.preload('user').orderBy('createdAt', 'asc')
      })
      .firstOrFail()

    return inertia.render('posts/show', {
      post: PostTransformer.transform(post),
    })
  }
}
```

We're preloading comments along with each comment's user (the author), and ordering them by creation date with oldest first.

:::

:::step{title="Display comments in the React component"}

Update the component to display the comments:
```tsx title="inertia/pages/posts/show.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'

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

        // [!code ++:21]
        <div className="post-comments">
          <h2>Comments</h2>

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

Notice how TypeScript knows that `post.comments` exists and what shape each comment has. This is all thanks to the generated `Data.Post` type from our transformers.

:::
::::

Refresh your post detail page and you'll now see all the comments listed below the post content!

## What you've built

You've just completed the full data flow in an AdonisJS + Inertia app:

- **Routes** that map URLs to controller actions
- **Controllers** that fetch data from your models
- **Transformers** that serialize models into type-safe JSON for your frontend
- **React components** that receive and display data with full TypeScript support
- **Relationships** that let you eager load related data efficiently
- **Client-side navigation** with Inertia's `Link` component for a SPA-like experience
