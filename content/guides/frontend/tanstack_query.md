# TanStack Query Integration

This guide covers the TanStack Query integration for Tuyau. You will learn how to install and configure `@tuyau/react-query`, generate type-safe query and mutation options, implement infinite scrolling and manage cache invalidation.

## Overview

The `@tuyau/react-query` package provides seamless integration between Tuyau and [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview). Instead of creating custom hooks, Tuyau generates type-safe options objects that you pass directly to TanStack Query's standard hooks like `useQuery`, `useMutation`, and `useInfiniteQuery`.

This approach gives you complete control over TanStack Query's features while maintaining end-to-end type safety. Query keys are automatically generated based on your route names and parameters, and cache invalidation becomes straightforward and type-safe. The integration works exclusively with route names, ensuring that your API calls remain decoupled from URL structures.

## Prerequisites

Before using the TanStack Query integration, you must have Tuyau installed and configured in your application. Follow the [Tuyau installation guide](./tuyau.md) to set up your Tuyau client first.

You should be familiar with:
- [TanStack Query basics](https://tanstack.com/query/latest/docs/framework/react/overview) - Understanding queries, mutations, and cache management
- Tuyau route names and API calls

## Installation

Install the TanStack Query integration package in your frontend application:

```bash
npm install @tanstack/react-query @tuyau/react-query
```

## Setup

Create your Tuyau client with TanStack Query integration:

```ts title="src/lib/client.ts"
import { registry } from '~registry'
import { createTuyau } from '@tuyau/core/client'
import { QueryClient } from '@tanstack/react-query'
import { createTuyauReactQueryClient } from '@tuyau/react-query'

export const queryClient = new QueryClient()

export const client = createTuyau({ baseUrl: import.meta.env.VITE_API_URL, registry })
export const tuyau = createTuyauReactQueryClient({
  client,
  queryClient,
})
```

The `tuyau` object provides access to all your routes with type-safe query and mutation options. The `queryClient` is the standard TanStack Query client used for cache management and invalidation.

## Basic queries

Use `queryOptions()` to generate options for TanStack Query's `useQuery` hook. All queries use route names rather than URLs:

```tsx title="src/pages/posts.tsx"
import { useQuery } from '@tanstack/react-query'
import { tuyau } from '~/lib/client'

export default function PostsList() {
  /**
   * Call the 'posts.index' route using its route name.
   * The queryOptions() method generates the query function,
   * query key, and all type information automatically.
   */
  const postsQuery = useQuery(
    tuyau.posts.index.queryOptions()
  )

  if (postsQuery.isLoading) return <div>Loading...</div>
  if (postsQuery.isError) return <div>Error loading posts</div>

  return (
    <div>
      {postsQuery.data?.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  )
}
```

The response data is fully typed based on your backend controller's return value. TypeScript knows the exact shape of `postsQuery.data` without any manual type annotations.

## Queries with parameters

Pass route parameters and query parameters to `queryOptions()`. TanStack Query options go in the second argument:

```tsx
import { useQuery } from '@tanstack/react-query'
import { tuyau } from '~/lib/client'

export default function PostDetail({ postId }: { postId: string }) {
  const postQuery = useQuery(
    tuyau.posts.show.queryOptions(
      {
        params: { id: postId },
        query: { include: 'comments' }
      },
      {
        staleTime: 5000,
        refetchOnWindowFocus: false
      }
    )
  )

  return <div>{postQuery.data?.post.title}</div>
}
```

The first argument contains your API parameters (`params`, `query`), and the second argument accepts any standard TanStack Query options like `staleTime`, `enabled`, or `refetchInterval`.


## Mutations

Use `mutationOptions()` to generate options for TanStack Query's `useMutation` hook:

```tsx
import { useMutation } from '@tanstack/react-query'
import { tuyau, queryClient } from '~/lib/client'

export default function CreatePost() {
  const createPost = useMutation(
    tuyau.posts.store.mutationOptions({
      onSuccess: () => {
        /**
         * Invalidate the posts list query after creating a post.
         * This causes the list to refetch with the new post included.
         */
        queryClient.invalidateQueries({ 
          queryKey: tuyau.posts.list.pathKey() 
        })
      }
    })
  )

  const handleSubmit = (data: { title: string; content: string }) => {
    createPost.mutate({
      body: {
        title: data.title,
        content: data.content,
        authorId: 1
      }
    })
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit({ title: 'My Post', content: 'Content here' })
    }}>
      <input name="title" placeholder="Title" />
      <textarea name="content" placeholder="Content" />
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? 'Creating...' : 'Create Post'}
      </button>
      
      {createPost.isError && (
        <p>Error: {createPost.error.message}</p>
      )}
    </form>
  )
}
```

The `mutationOptions()` method accepts standard TanStack Query mutation options like `onSuccess`, `onError`, and `onSettled`. All mutation parameters (`params`, `body`) are fully typed based on your backend validator.

## Infinite queries

For pagination and infinite scrolling, use `infiniteQueryOptions()` with TanStack Query's `useInfiniteQuery`. This requires coordination between your frontend query configuration and backend validation.

### Frontend configuration

Configure the infinite query with pagination parameters:

```tsx title="src/pages/posts.tsx"
import { useInfiniteQuery } from '@tanstack/react-query'
import { tuyau } from '~/lib/client'

export default function InfinitePosts() {
  const postsQuery = useInfiniteQuery(
    tuyau.posts.list.infiniteQueryOptions(
      {
        query: { 
          limit: 10,
          search: 'typescript'
        }
      },
      {
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.meta.nextPage,
        pageParamKey: 'page',
      }
    )
  )

  /**
   * Flatten all pages into a single array of posts.
   * Each page contains a subset of posts based on the limit.
   */
  const allPosts = postsQuery.data?.pages.flatMap(page => page.posts) || []

  return (
    <div>
      {allPosts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
      
      {postsQuery.hasNextPage && (
        <button 
          onClick={() => postsQuery.fetchNextPage()}
          disabled={postsQuery.isFetchingNextPage}
        >
          {postsQuery.isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
```

The `pageParamKey` option is critical - it specifies which query parameter holds the page number. This must match the parameter name in your backend validator.

### Backend validation

Define a validator that includes the pagination parameter referenced by `pageParamKey`:

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const listPostsValidator = vine.compile(
  vine.object({
    page: vine.number().optional(),
    limit: vine.number().optional(),
    search: vine.string().optional(),
  })
)
```

The `page` parameter in the validator must match the `pageParamKey` value in your frontend configuration. Tuyau automatically handles passing the page parameter from TanStack Query's pagination system to your backend.

### Backend controller

Implement pagination in your controller using the validated parameters:

```ts title="app/controllers/posts_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'
import { listPostsValidator } from '#validators/post'

export default class PostsController {
  async list({ request, serialize }: HttpContext) {
    const { page = 1, limit = 10, search } = await request.validateUsing(listPostsValidator)
    
    const posts = await Post.query()
      .if(search, (query) => query.where('title', 'like', `%${search}%`))
      .paginate(page, limit)
    
    return {
      posts: await serialize(PostTransformer.transform(posts.all())),
      meta: {
        currentPage: posts.currentPage,
        lastPage: posts.lastPage,
        nextPage: posts.hasNextPage ? posts.currentPage + 1 : null
      }
    }
  }
}
```

The `getNextPageParam` function in your frontend checks `lastPage.meta.nextPage` to determine if more pages exist. Return `null` when there are no more pages to load.

### How infinite queries work

When the component mounts, TanStack Query calls your API with `page: 1` (the `initialPageParam`). The response includes both the data and metadata about pagination. The `getNextPageParam` function examines this metadata to determine what page to fetch next.

When the user clicks "Load More", TanStack Query automatically calls your API again with the next page number, appending the results to the existing data. Tuyau handles injecting the page parameter into your query string transparently.

## Cache invalidation

Tuyau provides multiple methods for cache invalidation with different levels of granularity:

### queryKey() - Exact match

Get the exact query key for a specific query with its parameters:

```tsx
import { useMutation } from '@tanstack/react-query'
import { tuyau, queryClient } from '~/lib/client'

const updatePost = useMutation(
  tuyau.posts.update.mutationOptions({
    onSuccess: (data, variables) => {
      /**
       * Invalidate only the specific post that was updated.
       * This is the most precise invalidation strategy.
       */
      queryClient.invalidateQueries({
        queryKey: tuyau.posts.show.queryKey({ 
          params: { id: variables.params.id } 
        })
      })
    }
  })
)
```

Use `queryKey()` when you know exactly which query needs to be invalidated and you have all its parameters available.

### pathKey() - Base path

Get the base path key without parameters:

```tsx
const deletePost = useMutation(
  tuyau.posts.delete.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate all queries for this exact path.
       * This invalidates posts.list but not posts.show.
       */
      queryClient.invalidateQueries({
        queryKey: tuyau.posts.list.pathKey()
      })
    }
  })
)
```

Use `pathKey()` when you want to invalidate a specific endpoint without parameters, such as list queries that don't depend on route parameters.

### pathFilter() - Subtree matching

Get a filter that matches all queries starting with a path:

```tsx
const createProduct = useMutation(
  tuyau.products.store.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate all product-related queries across any route.
       * This catches products.search, products.list, products.show,
       * products.byCategory, and any other product routes.
       */
      queryClient.invalidateQueries(
        tuyau.products.pathFilter()
      )
    }
  })
)
```

The `pathFilter()` method is particularly useful when a mutation might affect multiple related queries and you want to invalidate all of them at once.

### queryFilter() - Custom filtering

Use `queryFilter()` with a predicate function for fine-grained control over which queries to invalidate:

```tsx
import { useMutation } from '@tanstack/react-query'
import { tuyau, queryClient } from '~/lib/client'

const archivePost = useMutation(
  tuyau.posts.archive.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate only queries where the post is marked as active.
       * Use the predicate to inspect the cached data and decide
       * whether to invalidate based on custom logic.
       */
      const filter = tuyau.posts.pathFilter({
        predicate: (query) => {
          const data = query.state.data
          return data?.post?.status === 'active'
        },
      })
      
      queryClient.invalidateQueries(filter)
    }
  })
)
```

The predicate function receives the query state and can inspect cached data to make invalidation decisions. This is useful for complex invalidation logic that depends on the actual cached values.

## What you learned

You now know how to:
- Install and configure the TanStack Query integration
- Generate type-safe query options for `useQuery` using route names
- Implement infinite scrolling with proper frontend and backend coordination
- Create mutations with automatic type inference and cache invalidation
- Use `queryKey`, `pathKey`, `pathFilter`, and `queryFilter` for cache management

For more information about TanStack Query's capabilities, see the [TanStack Query documentation](https://tanstack.com/query/latest/docs/framework/react/overview).
