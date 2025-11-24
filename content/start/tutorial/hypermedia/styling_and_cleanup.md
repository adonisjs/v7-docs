# Styling and Cleanup

In the previous chapter, we added forms to create posts and comments. We're not done building DevShow yet — there are more features to add — but we've built enough that it's worth pausing to improve the design and user experience. 

Right now, users can't easily navigate between pages, and the design looks bare. Let's fix both by adding proper navigation links and styling everything with CSS.

## Styling the application

Let's start by adding CSS to make DevShow look polished. The Hypermedia starter kit already includes a CSS file with some base styles. We'll add DevShow-specific styles to enhance the posts, comments, and overall layout.

Open your CSS file and add the following styles at the end.

```css title="resources/css/app.css"
/* Dev-show styles */
.container {
  max-width: 980px;
  margin: auto;
  padding: 40px 0;
}
.container h1 {
  font-size: 32px;
  letter-spacing: -0.5px;
  margin-bottom: 5px;
}

.post-item {
  padding: 18px 0;
  min-width: 680px;
  border-bottom: 1px solid var(--gray-4);
}

.post-meta {
  display: flex;
  align-items: center;
  margin-top: 8px;
  color: var(--gray-6);
  font-size: 14px;
  font-weight: 500;
  gap: 15px;
}

.post-meta a {
  text-decoration: underline;
}
.post-meta a:hover {
  color: var(--gray-12);
}

.post-item h2 {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 10px;
}

.post-subtext {
  font-size: 16px;
  line-height: 1;
}

.post {
  min-width: 680px;
  max-width: 800px;
  margin: auto;
}

.post-summary {
  padding: 15px 0;
  margin: 20px 0 40px 0;
  border-bottom: 1px solid var(--gray-4);
}

.post-comment-form {
  padding-bottom: 15px;
  margin: 10px 0 40px 0;
  border-bottom: 1px solid var(--gray-4);
}

.post-comment-form textarea {
  width: 100%;
}

.comment-item {
  padding: 18px 0;
  border-bottom: 1px solid var(--gray-4);
}

.comment-meta {
  color: var(--gray-6);
  font-size: 14px;
  font-weight: 500;
  margin-top: 5px;
}

.posts-list-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
```

These styles use CSS variables like `var(--gray-4)` and `var(--gray-6)` that are already defined in the starter kit's base styles. They provide consistent spacing, typography, and color throughout DevShow.

Refresh your browser and visit [`/posts`](http://localhost:3333/posts). You should immediately see improved styling with better spacing, cleaner borders, and more readable typography.

## Updating the homepage

Right now, the homepage doesn't tell users what DevShow is or how to get started. Let's replace it with a proper landing page that explains the site and links to the posts listing.

Replace the entire content of your homepage with this:

```edge title="resources/views/pages/home.edge"
@layout()
  <div class="hero">
    <h1>DevShow - Share what you have built</h1>
    <p>
      A small community showcase website to share your creations. Be it a project, tool, experiment, or anything they're proud of.
    </p>
    <div>
      @!link({
        text: 'Browse posts created by others',
        route: 'posts.index',
        class: 'button'
      })
    </div>
  </div>
@end
```

The `@!link()` component generates links using route names instead of hardcoded URLs. The `route` parameter uses named routes — AdonisJS automatically names routes when you use controllers. The `class: 'button'` applies styling from the starter kit's CSS.

Visit the homepage at [`/`](http://localhost:3333) and you'll see the new landing page with a clear call-to-action button that takes users to the posts listing.

## Adding a post creation link

Users who want to share their projects need an easy way to reach the creation form. Let's add a prominent button at the top of the posts listing.

Update your posts index template to add the button in the header.

```edge title="resources/views/posts/index.edge"
@layout()
  <div class="container">
    <div class="posts-list-title">
      <h1> Posts </h1>
      // [!code ++]
      @!link({ text: 'Create new post', route: 'posts.create', class: 'button' })
    </div>

    @each(post in posts)
      {{-- ... Existing code ... --}}
    @end
  </div>
@end
```

The `posts-list-title` class uses flexbox (from the CSS we added earlier) to position the heading and button on opposite sides of the header.

Visit [`/posts`](http://localhost:3333/posts) and you'll see the new "Create new post" button in the top-right corner, making it easy for users to share their projects.

## Adding navigation to the post creation page

When users are on the post creation form, they might want to go back to browsing posts. Let's add a back link at the top of the page.

Update your posts create template.

```edge title="resources/views/posts/create.edge"
@layout()
  <div class="form-container">
    <div>
      // [!code ++:4]
      @!link({
        route: 'posts.index',
        text: '&lsaquo; Go back to posts listing'
      })
      <h1>
        Create a new post
      </h1>
      <p>
        Share the URL and a short summary of your creation
      </p>
    </div>

    <div>
      @form({ route: 'posts.store', method: 'POST' })
        {{-- ... rest of the form ... --}}
      @end
    </div>
  </div>
@end
```

Visit [`/posts/create`](http://localhost:3333/posts/create) and you'll see the back link above the heading, making navigation intuitive.

## Adding navigation to the post detail page

Finally, let's add a back link on individual post pages so users can easily return to the full listing.

Update your posts show template.

```edge title="resources/views/posts/show.edge"
@layout()
  <div class="container">
    // [!code ++:4]
    @!link({
      route: 'posts.index',
      text: '&lsaquo; Go back to posts listing'
    })
    <h1>
      {{ post.title }}
    </h1>

    <div class="post">
      {{-- ... post details ... --}}
    </div>
  </div>
@end
```

Now visit any post detail page (click on a post from [`/posts`](http://localhost:3333/posts)) and you'll see the back link, completing the navigation flow throughout DevShow.

## What you built

You've transformed DevShow's user experience with styling and navigation. Here's what you accomplished:

- Added CSS to style posts, comments, and overall layout with consistent spacing and typography
- Updated the homepage with a hero section that explains DevShow and links to posts
- Added a "Create new post" button on the posts listing for easy access
- Added back navigation links on the post creation and detail pages
- Improved the overall navigation flow, making it easy for users to move through the app
