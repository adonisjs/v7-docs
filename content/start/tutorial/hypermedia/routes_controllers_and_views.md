# Routes, Controllers and Views

In the previous chapter, we created the Post and Comment models with their database tables and relationships. Now we'll bring those models to life by building pages where users can actually see posts.

## Overview

Right now, your posts and comments exist only in the database. Let's build two pages: one that lists all posts, and another that shows a single post with its comments. 

This is where you'll see the complete MVC (Model-View-Controller) pattern in action — **models handle data**, **controllers coordinate logic**, and **views display everything to users**.

Before we begin, make sure your development server is running:

```bash
node ace serve --hmr
```

## Displaying the posts list

Let's build the complete feature for displaying a list of posts. We'll create a controller, add a method to fetch posts, register a route, and create the view template.

::::steps
:::step{title="Creating the controller"}

Start by creating a controller to handle posts-related requests. Run this command.

```bash
node ace make:controller posts
```

This creates a new file at `app/controllers/posts_controller.ts`. Open it up and you'll see a basic controller class. Let's add a method to list all posts.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { type HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  // [!code ++:8]
  async index({ view }: HttpContext) {
    const posts = await Post
      .query()
      .preload('user')
      .orderBy('createdAt', 'desc')

    return view.render('posts/index', { posts })
  }
}
```

A few things to note here: we're preloading the `user` relationship so we can display the author's name without extra queries, ordering posts by creation date with newest first, and passing the posts to a view template called `posts/index`.

:::

:::step{title="Defining the route"}

Open your routes file and register a route.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.on('/').render('pages/home').as('home')
// [!code ++]
router.get('/posts', [controllers.Posts, 'index'])
```

The route definition connects the `/posts` URL to your controller's `index` method. When someone visits `/posts`, AdonisJS will call `PostsController.index()` and return whatever that method returns.

:::

:::step{title="Creating the view template"}

Time to create the view template.

```bash
node ace make:view posts/index
```

This creates a new file at `resources/views/posts/index.edge`. Open it and add the following code inside it.

```edge title="resources/views/posts/index.edge"
@layout()
  <div class="container">
    <div class="posts-list-title">
      <h1> Posts </h1>
    </div>

    @each(post in posts)
      <div class="post-item">
        <h2> {{ post.title }} </h2>

        <div class="post-meta">
          <div>By {{ post.user.fullName }}</div>

          <span>.</span>
          <div><a href="{{ post.url }}" target="_blank">{{post.url}}</a></div>

          <span>.</span>
          <div><a href="/posts/{{ post.id }}"> View comments </a></div>
        </div>
      </div>
    @end
  </div>
@end
```

This template uses the existing `layout` component that came with your starter kit. The layout handles the basic HTML structure, and you provide the main content by wrapping it in `@layout` tag.

Inside, we loop through each post with `@each` and display its title, the author's name, and a link to view post comments. For now, we're hardcoding the link as `/posts/{{ post.id }}` — we'll improve this with named routes shortly.

:::
::::

Visit [`/posts`](http://localhost:3333/posts) and you should see a list of all your posts!

## Displaying a single post

Now let's add the ability to view an individual post with its details. We'll implement the controller method, register the route with a dynamic parameter, and create the view template.

::::steps
:::step{title="Implementing the controller method"}

Add the `show` method to your controller.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ view }: HttpContext) {
    const posts = await Post
      .query()
      .preload('user')
      .orderBy('createdAt', 'desc')

    return view.render('posts/index', { posts })
  }

  // [!code ++:9]
  async show({ params, view }: HttpContext) {
    const post = await Post
      .query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    return view.render('posts/show', { post })
  }
}
```

We're using `firstOrFail()` here, which will automatically throw a 404 error if no post exists with that ID. No need to manually check if the post exists—AdonisJS handles that for you.

:::

:::step{title="Registering the route"}

Now let's register the route for this controller method.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/posts', [controllers.Posts, 'index'])
// [!code ++]
router.get('/posts/:id', [controllers.Posts, 'show'])
```

- The `:id` part is a route parameter. 
- When someone visits `/posts/5`, AdonisJS captures that `5` and makes it available in your controller as `params.id`. 
- You can name the parameter anything you want, `:id`, `:postId`, `:slug` — just be consistent when accessing it.

:::

:::step{title="Creating the view template"}

Create the view template for displaying a single post.

```bash
node ace make:view posts/show
```

This creates `resources/views/posts/show.edge`. Open it and add the following code.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    <h1>
      {{ post.title }}
    </h1>

    <div class="post">
      <div class="post-meta">
        <div>By {{ post.user.fullName }}</div>

        <span>.</span>
        <div><a href="{{ post.url }}" target="_blank">{{post.url}}</a></div>
      </div>

      <div class="post-summary">
        {{ post.summary }}
      </div>
    </div>
  </div>
@end
```

Try clicking on a post from your [list page](http://localhost:3333/posts). You should now see the full post with its title, author, and content.

:::
::::

## Adding comments to the post view

Finally, let's display the comments for each post. First, we need to preload the comments and their authors in the controller.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ view }: HttpContext) {
    const posts = await Post.query().preload('user').orderBy('createdAt', 'desc')

    return view.render('posts/index', { posts })
  }

  async show({ params, view }: HttpContext) {
    const post = await Post.query()
      .where('id', params.id)
      .preload('user')
      // [!code ++:3]
      .preload('comments', (query) => {
        query.preload('user').orderBy('createdAt', 'asc')
      })
      .firstOrFail()

    return view.render('posts/show', { post })
  }
}
```

We're preloading comments along with each comment's user (the author), and ordering them by creation date with oldest first. Now update the view to display them.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    <h1>
      {{ post.title }}
    </h1>

    <div class="post">
      <div class="post-meta">
        <div>By {{ post.user.fullName }}</div>

        <span>.</span>
        <div><a href="{{ post.url }}" target="_blank">{{post.url}}</a></div>
      </div>

      <div class="post-summary">
        {{ post.summary }}
      </div>

      // [!code ++:20]
      <div class="post-comments">
        <h2>
          Comments
        </h2>

        @each(comment in post.comments)
          <div class="comment-item">
            <p> {{ comment.content }} </p>
            <div class="comment-meta">
              By {{ comment.user.fullName }} on {{ comment.createdAt.toFormat('MMM dd, yyyy') }}
            </div>
          </div>
        @else
          <p> No comments yet. </p>
        @end
      </div>
    </div>
  </div>
@end
```

Refresh your post detail page and you'll now see all the comments listed below the post content!

## What you've built

You've just completed the full MVC flow in AdonisJS:

- **Routes** that map URLs to controller actions
- **Controllers** that fetch data from your models and pass it to views
- **Views** that display data using Edge templates
- **Relationships** that let you eager load related data efficiently
