---
description: Learn how to integrate TanStack Query with Tuyau for type-safe API calls, infinite scrolling, and cache management in AdonisJS applications.
---

# TanStack Query Integration

This guide covers the TanStack Query integration for Tuyau. You will learn how to:

- Install and configure `@tuyau/react-query` or `@tuyau/vue-query`
- Generate type-safe query and mutation options
- Implement infinite scrolling with pagination
- Manage cache invalidation at different levels of granularity
- Handle errors from failed API calls

## Overview

The `@tuyau/react-query` and `@tuyau/vue-query` packages provide seamless integration between Tuyau and [TanStack Query](https://tanstack.com/query). Instead of creating custom hooks or composables, Tuyau generates type-safe options objects that you pass directly to TanStack Query's standard primitives like `useQuery`, `useMutation`, and `useInfiniteQuery`.

This approach gives you complete control over TanStack Query's features while maintaining end-to-end type safety. Query keys are automatically generated based on your route names and parameters, and cache invalidation becomes straightforward and type-safe. The integration works exclusively with route names, ensuring that your API calls remain decoupled from URL structures.

Both adapters share the same API surface. The only differences are framework-specific imports and component syntax.

## Prerequisites

Before using the TanStack Query integration, you must have Tuyau installed and configured in your application. Follow the [Tuyau installation guide](./api_client.md) to set up your Tuyau client first.

You should be familiar with:
- [TanStack Query basics](https://tanstack.com/query/latest/docs/framework/react/overview) (understanding queries, mutations, and cache management)
- Tuyau route names and API calls

## Installation

Install the TanStack Query integration package in your frontend application.

::::tabs

:::tab{title="React"}
```bash
npm install @tanstack/react-query @tuyau/react-query
```
:::

:::tab{title="Vue"}
```bash
npm install @tanstack/vue-query @tuyau/vue-query
```
:::

::::

:::note
Make sure `@tuyau/react-query` (or `@tuyau/vue-query`) and `@tuyau/core` are on compatible versions. If you see type errors after installing, check that both packages share the same major and prerelease tag (e.g., both on `1.x` or both on `next`).
:::

## Setup

Create your Tuyau client with TanStack Query integration. The `api` object provides access to all your routes with type-safe query and mutation options. The `client` object is the core Tuyau client, and `queryClient` is the standard TanStack Query client used for cache management and invalidation.

::::tabs

:::tab{title="React"}
```ts title="src/lib/client.ts"
import { registry } from '~registry'
import { createTuyau } from '@tuyau/core/client'
import { QueryClient } from '@tanstack/react-query'
import { createTuyauReactQueryClient } from '@tuyau/react-query'

export const queryClient = new QueryClient()

export const client = createTuyau({ baseUrl: import.meta.env.VITE_API_URL, registry })
export const api = createTuyauReactQueryClient({ client })
```
:::

:::tab{title="Vue"}
```ts title="src/lib/client.ts"
import { registry } from '~registry'
import { createTuyau } from '@tuyau/core/client'
import { QueryClient } from '@tanstack/vue-query'
import { createTuyauVueQueryClient } from '@tuyau/vue-query'

export const queryClient = new QueryClient()

export const client = createTuyau({ baseUrl: import.meta.env.VITE_API_URL, registry })
export const api = createTuyauVueQueryClient({ client })
```
:::

::::

### Retry behavior

Tuyau is built on [Ky](https://github.com/sindresorhus/ky), which has automatic retry enabled by default for failed requests. When using the TanStack Query integration, Ky's retry mechanism is automatically disabled to let TanStack Query handle retries instead, since it also has built-in retry functionality.

This prevents double retries (Ky retrying, then TanStack Query retrying on top) and gives you full control over retry behavior through TanStack Query's configuration.

```ts
const postsQuery = useQuery(
  api.posts.index.queryOptions(
    {},
    {
      retry: 3, // TanStack Query handles retries
    }
  )
)
```

## Basic queries

Use `queryOptions()` to generate options for TanStack Query's `useQuery` hook. All queries use route names rather than URLs. The response data is fully typed based on your backend controller's return value, so TypeScript knows the exact shape of the data without any manual type annotations.

::::tabs

:::tab{title="React"}
```tsx title="src/pages/posts.tsx"
import { useQuery } from '@tanstack/react-query'
import { api } from '~/lib/client'

export default function PostsList() {
  const postsQuery = useQuery(
    api.posts.index.queryOptions()
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
:::

:::tab{title="Vue"}
```vue title="src/pages/PostsList.vue"
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { api } from '~/lib/client'

const { data, isLoading, isError } = useQuery(
  api.posts.index.queryOptions()
)
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isError">Error loading posts</div>
  <div v-else>
    <article v-for="post in data?.posts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>{{ post.content }}</p>
    </article>
  </div>
</template>
```
:::

::::

## Queries with parameters

Pass route parameters and query parameters to `queryOptions()` as the first argument. The second argument accepts any standard TanStack Query options like `staleTime`, `enabled`, or `refetchInterval`.

::::tabs

:::tab{title="React"}
```tsx title="src/pages/post.tsx"
import { useQuery } from '@tanstack/react-query'
import { api } from '~/lib/client'

export default function PostDetail({ postId }: { postId: string }) {
  const postQuery = useQuery(
    api.posts.show.queryOptions(
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
:::

:::tab{title="Vue"}
```vue title="src/pages/PostDetail.vue"
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { api } from '~/lib/client'

const props = defineProps<{ postId: string }>()

const { data } = useQuery(
  api.posts.show.queryOptions(
    {
      params: { id: props.postId },
      query: { include: 'comments' }
    },
    {
      staleTime: 5000,
      refetchOnWindowFocus: false
    }
  )
)
</script>

<template>
  <div>{{ data?.post.title }}</div>
</template>
```
:::

::::

## Conditional queries with skipToken

Use `skipToken` to conditionally disable a query while preserving type safety. This is cleaner than using the `enabled` option for conditional fetching because the query function signature stays the same whether or not the query is active. When `skipToken` is passed, TanStack Query skips the query entirely. Once the value becomes truthy, the query fetches automatically.

::::tabs

:::tab{title="React"}
```tsx title="src/pages/user.tsx"
import { useQuery, skipToken } from '@tanstack/react-query'
import { api } from '~/lib/client'

export default function UserProfile({ userId }: { userId: string | null }) {
  const userQuery = useQuery(
    api.users.show.queryOptions(
      userId ? { params: { id: userId } } : skipToken
    )
  )

  return <div>{userQuery.data?.user.name}</div>
}
```
:::

:::tab{title="Vue"}
```vue title="src/pages/UserProfile.vue"
<script setup lang="ts">
import { useQuery, skipToken } from '@tanstack/vue-query'
import { api } from '~/lib/client'

const props = defineProps<{ userId: string | null }>()

const { data } = useQuery(
  api.users.show.queryOptions(
    props.userId ? { params: { id: props.userId } } : skipToken
  )
)
</script>

<template>
  <div>{{ data?.user.name }}</div>
</template>
```
:::

::::

## Mutations

Use `mutationOptions()` to generate options for TanStack Query's `useMutation` hook. The method accepts standard TanStack Query mutation options like `onSuccess`, `onError`, and `onSettled`. All mutation parameters (`params`, `body`) are fully typed based on your backend validator.

::::tabs

:::tab{title="React"}
```tsx title="src/pages/posts/create.tsx"
import { useMutation } from '@tanstack/react-query'
import { api, queryClient } from '~/lib/client'

export default function CreatePost() {
  const createPost = useMutation(
    api.posts.store.mutationOptions({
      onSuccess: () => {
        /**
         * Invalidate the posts list query after creating a post.
         * This causes the list to refetch with the new post included.
         */
        queryClient.invalidateQueries({
          queryKey: api.posts.list.pathKey()
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
:::

:::tab{title="Vue"}
```vue title="src/pages/posts/CreatePost.vue"
<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'
import { api, queryClient } from '~/lib/client'

const createPost = useMutation(
  api.posts.store.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate the posts list query after creating a post.
       * This causes the list to refetch with the new post included.
       */
      queryClient.invalidateQueries({
        queryKey: api.posts.list.pathKey()
      })
    }
  })
)

function handleSubmit(data: { title: string; content: string }) {
  createPost.mutate({
    body: {
      title: data.title,
      content: data.content,
      authorId: 1
    }
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit({ title: 'My Post', content: 'Content here' })">
    <input name="title" placeholder="Title" />
    <textarea name="content" placeholder="Content" />
    <button type="submit" :disabled="createPost.isPending">
      {{ createPost.isPending ? 'Creating...' : 'Create Post' }}
    </button>

    <p v-if="createPost.isError">
      Error: {{ createPost.error?.message }}
    </p>
  </form>
</template>
```
:::

::::

## Infinite queries

For pagination and infinite scrolling, use `infiniteQueryOptions()` with TanStack Query's `useInfiniteQuery`. This requires coordination between your frontend query configuration and backend validation.

### Frontend configuration

The `pageParamKey` option specifies which query parameter holds the page number. This must match the parameter name in your backend validator.

::::tabs

:::tab{title="React"}
```tsx title="src/pages/posts.tsx"
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '~/lib/client'

export default function InfinitePosts() {
  const postsQuery = useInfiniteQuery(
    api.posts.list.infiniteQueryOptions(
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
:::

:::tab{title="Vue"}
```vue title="src/pages/InfinitePosts.vue"
<script setup lang="ts">
import { computed } from 'vue'
import { useInfiniteQuery } from '@tanstack/vue-query'
import { api } from '~/lib/client'

const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery(
  api.posts.list.infiniteQueryOptions(
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

const allPosts = computed(() => data.value?.pages.flatMap(page => page.posts) || [])
</script>

<template>
  <div>
    <article v-for="post in allPosts" :key="post.id">
      <h2>{{ post.title }}</h2>
      <p>{{ post.content }}</p>
    </article>

    <button
      v-if="hasNextPage"
      :disabled="isFetchingNextPage"
      @click="fetchNextPage()"
    >
      {{ isFetchingNextPage ? 'Loading...' : 'Load More' }}
    </button>
  </div>
</template>
```
:::

::::

### Backend validation

Define a validator that includes the pagination parameter referenced by `pageParamKey`. The `page` parameter in the validator must match the `pageParamKey` value in your frontend configuration. Tuyau automatically handles passing the page parameter from TanStack Query's pagination system to your backend.

```ts title="app/validators/post.ts"
import vine from '@vinejs/vine'

export const listPostsValidator = vine.create({
  page: vine.number().optional(),
  limit: vine.number().optional(),
  search: vine.string().optional(),
})
```

### Backend controller

Implement pagination in your controller using the validated parameters. The `getNextPageParam` function in your frontend checks `lastPage.meta.nextPage` to determine if more pages exist. Return `null` when there are no more pages to load.

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

### How infinite queries work

When the component mounts, TanStack Query calls your API with `page: 1` (the `initialPageParam`). The response includes both the data and metadata about pagination. The `getNextPageParam` function examines this metadata to determine what page to fetch next.

When the user clicks "Load More", TanStack Query automatically calls your API again with the next page number, appending the results to the existing data. Tuyau handles injecting the page parameter into your query string transparently.

## Reactive queries (Vue)

In Vue, you often need queries to re-fetch when reactive state changes. Wrap your `queryOptions()` call in a getter function so TanStack Query automatically tracks dependencies and re-evaluates when they change.

This works because Vue Query's `useQuery` accepts a `MaybeRefOrGetter<Options>`. When you pass a getter function, TanStack Query calls it inside a `computed`, which tracks all reactive dependencies accessed during evaluation. When `search.value` changes, the computed re-evaluates, producing new query options with an updated query key and query function.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { api } from '~/lib/client'

const search = ref('')

const { data } = useQuery(
  () => api.posts.index.queryOptions({ query: { search: search.value } })
)
</script>

<template>
  <input v-model="search" placeholder="Search posts..." />
  <article v-for="post in data?.posts" :key="post.id">
    <h2>{{ post.title }}</h2>
  </article>
</template>
```

:::note
This pattern is not needed in React, where component re-renders naturally cause `queryOptions()` to be called again with fresh values.
:::

## Cache invalidation

Tuyau provides multiple methods for cache invalidation with different levels of granularity. These methods work identically in React and Vue.

### queryKey() - Exact match

Use `queryKey()` when you know exactly which query needs to be invalidated and you have all its parameters available.

```ts
const updatePost = useMutation(
  api.posts.update.mutationOptions({
    onSuccess: (data, variables) => {
      /**
       * Invalidate only the specific post that was updated.
       * This is the most precise invalidation strategy.
       */
      queryClient.invalidateQueries({
        queryKey: api.posts.show.queryKey({
          params: { id: variables.params.id }
        })
      })
    }
  })
)
```

### pathKey() - Base path

Use `pathKey()` when you want to invalidate a specific endpoint without parameters, such as list queries that don't depend on route parameters.

```ts
const deletePost = useMutation(
  api.posts.delete.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate all queries for this exact path.
       * This invalidates posts.list but not posts.show.
       */
      queryClient.invalidateQueries({
        queryKey: api.posts.list.pathKey()
      })
    }
  })
)
```

### pathFilter() - Subtree matching

The `pathFilter()` method is particularly useful when a mutation might affect multiple related queries and you want to invalidate all of them at once.

```ts
const createProduct = useMutation(
  api.products.store.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate all product-related queries across any route.
       * This catches products.search, products.list, products.show,
       * products.byCategory, and any other product routes.
       */
      queryClient.invalidateQueries(
        api.products.pathFilter()
      )
    }
  })
)
```

### queryFilter() - Custom filtering

Use `queryFilter()` with a predicate function for fine-grained control over which queries to invalidate. The predicate function receives the query state and can inspect cached data to make invalidation decisions.

```ts
const archivePost = useMutation(
  api.posts.archive.mutationOptions({
    onSuccess: () => {
      /**
       * Invalidate only queries where the post is marked as active.
       * Use the predicate to inspect the cached data and decide
       * whether to invalidate based on custom logic.
       */
      const filter = api.posts.pathFilter({
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

## Error handling

When an API call fails, Tuyau throws an `HTTPError` (from [Ky](https://github.com/sindresorhus/ky)) that TanStack Query captures and exposes through its standard error state.

### Accessing errors in queries and mutations

TanStack Query surfaces errors through `isError` and `error` on the result object.

```tsx
const postsQuery = useQuery(api.posts.index.queryOptions())

if (postsQuery.isError) {
  console.log(postsQuery.error.message)
}
```

### Inspecting HTTP status codes

The `error` object is a Ky `HTTPError` with a `response` property. Use it to inspect the status code.

```ts
import { HTTPError } from 'ky'

const postsQuery = useQuery(api.posts.index.queryOptions())

if (postsQuery.isError && postsQuery.error instanceof HTTPError) {
  const status = postsQuery.error.response.status

  if (status === 401) {
    window.location.href = '/login'
  }
}
```

### Global error handler

Rather than checking status codes in every component, configure a global handler using the `queryClient` default options. This prevents retrying unauthorized requests and lets you handle 401s consistently across your application.

```ts title="src/lib/client.ts"
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof HTTPError && error.response.status === 401) {
          return false // Don't retry on 401
        }
        return failureCount < 3
      },
    },
  },
})
```
