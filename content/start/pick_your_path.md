---
description: Understand AdonisJS's approach to frontend development and choose between Hypermedia, Inertia, and API-only stacks for your application.
---

# Pick your path

This guide introduces AdonisJS's approach to frontend development and the three primary stacks you can choose from. You will learn:

- Why AdonisJS is backend-first but frontend-flexible.
- Understand the difference between Hypermedia, Inertia, and API-only approaches.
- See how the View layer works in each stack. 
- Learn about the starter kits that provide opinionated setups for each approach.

## Overview

AdonisJS is deeply opinionated about the backend, providing built-in authentication, authorization, validation, database tooling, and more, **but deliberately flexible about the frontend**. This backend-first philosophy means you get a robust foundation for building your server-side logic while choosing how you build your user interface.

You can create traditional server-rendered applications, modern single-page applications, or anything in between, all using the same backend framework. A marketing website has different requirements than an admin dashboard, which differs from a mobile app's API backend. Rather than forcing you into a single approach, AdonisJS lets you choose the frontend stack that fits your needs.

## The three approaches

AdonisJS supports three primary approaches to building your frontend. Each approach represents a different way of thinking about the View layer in your application's architecture.

### Hypermedia

Hypermedia applications generate complete HTML pages on the server and send them to the browser. You build your interface using a template engine (AdonisJS provides [Edge](https://edgejs.dev)) and add interactivity using lightweight JavaScript libraries like Alpine.js or HTMX/Unpoly when needed.

:::note{title="What is Hypermedia"}
The term "Hypermedia" refers to HTML as a medium for building interactive applications, where the server drives the application state and the client (browser) displays it. If you're new to this concept, the HTMX project has an excellent essay explaining [Hypermedia-driven applications](https://htmx.org/essays/hypermedia-driven-applications/) in depth.
:::

In a Hypermedia application:

- The server is responsible for rendering your views.
- Your controllers return HTML instead of JSON.
- Navigation between pages happens through traditional page loads or progressively enhanced requests.

This approach embraces the web's native capabilities and keeps most of your application's logic on the server where you have full control.

Choose this approach when you want to build applications with the server in control, or you want to minimize the amount of JavaScript your users download. Hypermedia applications can be highly interactive using libraries like Alpine.js and HTMX while keeping your frontend codebase lean and your deployment simple.

### Inertia (React or Vue)

Inertia.js provides a middle ground between server-rendered templates and SPAs. You use React or Vue components as your views while keeping server-side routing and controllers. AdonisJS officially supports building applications with React or Vue through Inertia, giving you the component-based development experience of modern frontend frameworks without the complexity of maintaining a separate single-page application.

With Inertia:

- Your backend routes map directly to frontend components, eliminating the complexity of dual routing systems.
- Your controllers return data to Inertia components instead of rendering templates or returning JSON.
- Navigation feels like a single-page application with smooth transitions, but your routing logic stays on the server where it's easier to protect and maintain.

Inertia also simplifies form submissions and data fetching while keeping your application a monolithic deployment. You get a modern, reactive user experience without building and maintaining a separate API layer.

Choose this approach when you want to use React or Vue but prefer server-side routing, you want to avoid the complexity of separate frontend and backend deployments, or you want a tightly integrated full-stack development experience. Visit [inertiajs.com](https://inertiajs.com) to learn more about how Inertia bridges the gap between server-side and client-side frameworks.

### API-only

You can build a JSON API backend with AdonisJS while your frontend lives in a completely separate codebase. This approach creates a clear separation where AdonisJS handles all backend logic and exposes data through API endpoints, while your frontend application (built with any framework) consumes these endpoints.

In an API-only setup:

- Your controllers return JSON responses.
- Your frontend and backend are separate deployments with their own build processes, repositories (or monorepo), and deployment pipelines.
- The two communicate exclusively through HTTP requests to your API endpoints.

:::note
In monorepos, you can use a [type-safe API client](../guides/frontend/api_client.md) for true end-to-end typing across backend and frontend. [Transformers](../guides/frontend/transformers.md) also produce reusable, independent response types, so your UI can rely directly on the serialized API contract.
:::

This approach covers a wide variety of applications: APIs for mobile apps (iOS, Android), web applications built with any frontend framework, desktop applications, or even multiple frontends (web and mobile) consuming the same API. The separation provides flexibility in how you deploy and scale each layer independently.

Choose this approach when you're building an API that serves multiple client applications, your team prefers working with separate frontend and backend repositories, you need independent deployment and scaling of frontend and backend, or you're building a public API that external developers will consume.

## The same controller, three different returns

In the following example, you can see us using the same route, same controller, same data fetching logic. Only the return statement changes.

::::tabs
:::tab{title="Hypermedia"}

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('posts', [controllers.Posts, 'index'])
```

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ view }: HttpContext) {
    const posts = await Post.all()
    return view.render('posts/index', { posts }) // [!code highlight]
  }
}
```

```edge title="views/pages/posts/index.edge"
@each(post in posts)
  <div>
    <h2>{{ post.title }}</h2>
  <div>
@end
```

:::

:::tab{title="Inertia"}

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('posts', [controllers.Posts, 'index'])
```

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { HttpContext } from '@adonisjs/core/http'
 // [!code highlight]
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ inertia }: HttpContext) {
    const posts = await Post.all()
    // [!code highlight:3]
    return inertia.render('posts/index', {
      posts: PostTransformer.transform(posts)
    })
  }
}
```

```tsx title="pages/posts/index.tsx"
import { InertiaProps } from '~/types'
import { Data } from '~/generated/data'

type PageProps = InertiaProps<{ posts: Data.Post[] }>

export default function PostsIndex({ posts }: PageProps) {
  return <>
    {
      posts.map((post) => (
        <div key={ post.id }>
          <h2>{ post.title }</h2>
        </div>
      ))
    }
  </>
}
```

:::

:::tab{title="API-only"}

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('posts', [controllers.Posts, 'index'])
```

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import { HttpContext } from '@adonisjs/core/http'
 // [!code highlight]
import PostTransformer from '#transformers/post_transformer'

export default class PostsController {
  async index({ serialize }: HttpContext) {
    const posts = await Post.all()
     // [!code highlight]
    return serialize(PostTransformer.transform(posts))
  }
}
```

```json title="JSON response"
{
  "data": [
    {
      "id": 1,
      "title": "AdonisJS In 30",
      "description": "In this series, we'll ...",
    }
  ]
}
```

:::

::::

## What NOT to expect

If you're coming from meta-frameworks, there are some patterns you won't find in AdonisJS. These differences are intentional and provide clarity about how your application works.

:::note
AdonisJS is designed to be the backend that powers your frontend applications, not a replacement for meta-frameworks. You can use AdonisJS alongside frameworks like TanStack Start, Nuxt, Next.js, or others, with clear boundaries and well-defined API contracts between the two.
:::

**No file-based routing**: AdonisJS uses explicit route definitions in your route files. Routes are declared using the router API, giving you full control and visibility over your application's URL structure. This makes it easy to see all your routes in one place and apply middleware or constraints as needed.

**No compiler magic with "use" directives**: You won't find magical statements like "use server" or "use client" that blur the boundaries between where code executes. AdonisJS maintains a clear separation between your backend code (which runs on the server) and your frontend code (which runs in the browser).

**No mixing of server and client code**: Your backend logic lives in controllers, models, and services. Your frontend code lives in templates, components, or a separate frontend application. There's no ambiguity about where code runs, which makes debugging straightforward and helps teams work with well-defined boundaries.

This separation provides clarity about where code executes, makes debugging predictable, and allows teams to work with clear contracts between frontend and backend. When your frontend needs data from your backend, you work with explicit API calls or template data passing, not magical boundaries that blur at compile time.

## Starter kits

AdonisJS provides starter kits for each approach that come with opinionated configurations and best practices already in place. You don't have to configure everything from scratch.

These starter kits include properly **configured build tools**, **authentication scaffolding**, and all the **necessary integrations set up correctly**. When you create a new AdonisJS application, you can choose which starter kit to use based on the approach you've decided on.

This gives you a **"flexible but not on your own"** experience. You get to choose your stack, but once you've chosen, you get a fully configured setup that works out of the box.

- [Hypermedia starter kit](https://github.com/adonisjs/starter-kits/tree/main/hypermedia)
- [React starter kit](https://github.com/adonisjs/starter-kits/tree/main/inertia-react)
- [Vue starter kit](https://github.com/adonisjs/starter-kits/tree/main/inertia-vue)
- [API-only](https://github.com/adonisjs/starter-kits/tree/main/api)
- [API monorepo](https://github.com/adonisjs/starter-kits/tree/main/api-monorepo)

## Next steps

Now that you understand all different approaches AdonisJS supports, you're ready to create your first application. The [installation guide](./installation.md) will walk you through using the starter kits to set up a new project with your chosen stack.
