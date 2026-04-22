---
description: Learn how to use Edge templates in AdonisJS applications to render HTML on the server-side.
---

# Edge Templates

This guide covers using Edge templates in AdonisJS applications. You will learn how to render templates from controllers, pass data to templates, work with layouts and components, use the pre-built components from the Hypermedia starter kit, and debug template issues.

## Overview

Edge is a server-side templating engine for Node.js that allows you to compose HTML markup on the server and send the final static HTML to the browser. Since templates execute entirely on the server-side, they can tap into core framework features like authentication, authorization checks, and the translations system.

When you create a Hypermedia application in AdonisJS, Edge comes pre-configured and ready to use. Templates are stored in the `resources/views` directory with the `.edge` file extension, and you render them from your route handlers or controllers using the `view` property from the HTTP context.

Edge has comprehensive documentation at [edgejs.dev](https://edgejs.dev), which covers the template syntax, components system, and all available features in detail. This guide focuses specifically on using Edge within AdonisJS applications and introduces the pre-built components included in the Hypermedia starter kit.

## Your first template

Let's create a simple page that displays a list of blog posts. This example demonstrates the fundamental workflow of rendering templates in AdonisJS.

::::steps

:::step{title="Create the template file"}

Generate a new template using the Ace command.

```bash
node ace make:view pages/posts/index
# CREATE: resources/views/pages/posts/index.edge
```
:::

:::step{title="Add the template content"}

Open `resources/views/pages/posts/index.edge` and add the following content.

```edge title="resources/views/pages/posts/index.edge"
@layout()
  @each(post in posts)
    <div>
      <h2>
        {{ post.title }}
      </h2>
      <div>
        <p>{{{ excerpt(post.content, 280) }}}</p>
      </div>
    </div>
  @end
@end
```

A few important things to understand about this template:

- The `@layout()` component wraps your content with a complete HTML document structure (including `<html>`, `<head>`, and `<body>` tags). We'll explore layouts in detail later in this guide.

- The `@each` tag loops over the `posts` array and renders the content for each post. Edge provides several tags like `@if`, `@else`, and `@elseif` for writing logic in templates. You can learn about all available tags in the [Edge syntax reference](#).

- The double curly braces `{{ }}` evaluate and output a JavaScript expression. The triple curly braces `{{{ }}}` do the same but don't escape HTML, which is useful for rendering rich content.

:::

:::step{title="Define the route"}

Create a route to handle requests to the posts page.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('posts', [controllers.PostsController, 'index'])
```

:::

:::step{title="Create the controller"}

Create a controller that renders the template with post data.

```ts title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ view }: HttpContext) {
    /**
     * Render the template located at resources/views/pages/posts/index.edge
     * The first parameter is the template path (relative to resources/views)
     * The second parameter is the template state (data to share with the template)
     */
    return view.render('pages/posts/index', {
      posts: await Post.all(),
    })
  }
}
```

:::

:::step{title="View the result"}
Visit `http://localhost:3333/posts` in your browser to see the rendered page.
:::

::::

You can also render templates directly from routes without using a controller.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'

/**
 * The router.on().render() shorthand renders a template directly.
 * The first parameter is the template path.
 */
router.on('/').render('pages/home')
```

## Understanding template state

The data object you pass to `view.render()` is called the **template state**. All properties in this object become available as variables in your template.

In addition to the data you explicitly pass, AdonisJS automatically shares certain globals with every template:

- The `request` object for accessing request data
- The `auth` object for checking authentication status
- Edge helpers like `excerpt()`, `truncate()`, and route helpers

You can view all available helpers and global properties in the [Edge reference guide](/reference/edge).

## Template syntax refresher

Edge uses a combination of curly braces and tags to add dynamic behavior to your templates. Here's a quick refresher of the most common syntax patterns:

**Outputting variables:**
```edge
{{ post.title }}
```

**Outputting unescaped HTML:**
```edge
{{{ post.content }}}
```

**Conditionals:**
```edge
@if(user)
  <p>Welcome back, {{ user.name }}</p>
@else
  <p>Please log in</p>
@end
```

**Loops:**
```edge
@each(post in posts)
  <h2>{{ post.title }}</h2>
@end
```

**Evaluating JavaScript expressions:**
```edge
{{ post.createdAt.toFormat('dd LLL yyyy') }}
{{ posts.length > 0 ? 'Posts available' : 'No posts yet' }}
```

For complete coverage of Edge's template syntax, including advanced features like partials, slots, and custom tags, refer to the [Edge syntax reference](#).

## Working with layouts and components

The `@layout()` component you saw in the first example wraps your page content with a complete HTML document structure. This component is stored at `resources/views/components/layout.edge` and contains the standard HTML boilerplate:

```edge title="resources/views/components/layout.edge"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
</head>
<body>
  {{{ await $slots.main() }}}
</body>
</html>
```

The `$slots.main()` method call renders whatever content you place between the opening and closing `@layout()` tags in your page templates. This is Edge's slots feature, which allows components to accept content from their consumers.

### Creating components

Components in Edge are reusable template fragments stored in the `resources/views/components` directory. Any template file in this directory becomes available as an Edge tag.

For example, if you create a file at `resources/views/components/card.edge`:
```edge title="resources/views/components/card.edge"
<div class="card">
  {{{ await $slots.main() }}}
</div>
```

You can use it in your templates like this:
```edge
@card()
  <h2>Card title</h2>
  <p>Card content</p>
@end
```

Components can accept props (parameters) and have multiple named slots for more complex compositions. For a complete guide to building and using components, see the [Edge components guide](#).

## Starter kit components

The Hypermedia starter kit includes a collection of unstyled components for building forms and common UI patterns. Each component renders at most one HTML element and passes unknown props through as HTML attributes, allowing you to apply classes and other attributes directly.

### Layout

Renders the HTML document with head and body elements.

- **Props**: None
- **Slots**: `main` (default)

```edge
@layout()
  <main>Page content goes here</main>
@end
```

### Form

Renders an HTML form element with automatic CSRF token injection.

| Prop | Type | Description |
|------|------|-------------|
| `action` | `string` | The form action URL |
| `method` | `string` | HTTP method. Supports `PUT`, `PATCH`, and `DELETE` via method spoofing |
| `route` | `string` | Compute action URL from a named route |
| `routeParams` | `array` | Parameters for the named route |
| `routeOptions` | `object` | Additional options for URL generation (e.g., query strings) |

```edge
@form({ route: 'posts.store', method: 'POST' })
  {{-- Form fields --}}
@end

@form({ route: 'posts.update', method: 'PUT', routeParams: [post.id] })
  {{-- Form fields --}}
@end
```

### Field components

Form field components work together to create accessible form inputs with labels and validation error display.

#### field.root

Container that establishes context for child field components.

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Field name, used for error message lookup |
| `id` | `string` | Element ID, used to associate labels with inputs |

#### field.label

Renders a label element associated with the field.

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Label text (alternative to using the slot) |

#### field.error

Displays validation errors for the field. Automatically looks up errors by the field name.

```edge
@field.root({ name: 'email' })
  @!field.label({ text: 'Email address' })
  @!input.control({ type: 'email', autocomplete: 'email' })
  @!field.error()
@end
```

### Input control

Renders an input element. Must be a child of `@field.root`. It passes all props as HTML attributes to the input element.

```edge
@field.root({ name: 'username' })
  @!field.label({ text: 'Username' })
  @!input.control({ type: 'text', minlength: '3', maxlength: '20' })
  @!field.error()
@end
```

### Select control

Renders a select element with options. Must be a child of `@field.root`.

| Prop | Type | Description |
|------|------|-------------|
| `options` | `array` | Array of objects with `name` and `value` properties |

```edge
@field.root({ name: 'country' })
  @!field.label({ text: 'Country' })
  @!select.control({
    options: countries.map((country) => ({
      name: country.name,
      value: country.code
    }))
  })
  @!field.error()
@end
```

### Textarea control

Renders a textarea element. Must be a child of `@field.root`. It passes all props as HTML attributes to the textarea element.

```edge
@field.root({ name: 'bio' })
  @!field.label({ text: 'Biography' })
  @!textarea.control({ rows: '4' })
  @!field.error()
@end
```

### Checkbox components

Checkbox components create checkbox inputs with shared naming for form submission.

#### checkbox.group

Container that establishes the shared name for child checkboxes.

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Shared name for all checkboxes in the group |

#### checkbox.control

Renders a checkbox input. Must be nested within both `@checkbox.group` and `@field.root`. It passes all props as HTML attributes. Use `value` to set the checkbox value.

```edge
@checkbox.group({ name: 'services' })
  @field.root({ id: 'design' })
    @!checkbox.control({ value: 'design' })
    @!field.label({ text: 'Design' })
  @end

  @field.root({ id: 'development' })
    @!checkbox.control({ value: 'development' })
    @!field.label({ text: 'Development' })
  @end

  @field.root({ id: 'marketing' })
    @!checkbox.control({ value: 'marketing' })
    @!field.label({ text: 'Marketing' })
  @end
@end
```

### Radio components

Radio components create mutually exclusive options within a group.

#### radio.group

Container that establishes the shared name for child radio buttons.

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | Shared name for all radio buttons in the group |

#### radio.control

Renders a radio input. Must be nested within both `@radio.group` and `@field.root`. It passes all props as HTML attributes. Use `value` to set the radio value.

```edge
@radio.group({ name: 'payment_plan' })
  @field.root({ id: 'free' })
    @!radio.control({ value: 'free' })
    @!field.label({ text: 'Free' })
  @end

  @field.root({ id: 'pro' })
    @!radio.control({ value: 'pro' })
    @!field.label({ text: 'Pro $29/month' })
  @end

  @field.root({ id: 'enterprise' })
    @!radio.control({ value: 'enterprise' })
    @!field.label({ text: 'Custom pricing' })
  @end
@end
```

### Alert components

Alert components display notification messages with optional auto-dismiss behavior.

#### alert.root

Container that establishes context for alert title and description.

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `string` | Alert variant (e.g., `destructive`, `success`) |
| `autoDismiss` | `boolean` | Whether the alert should dismiss automatically |

#### alert.title

Renders the alert heading.

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Title text (alternative to using the slot) |

#### alert.description

Renders the alert body text.

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Description text (alternative to using the slot) |

```edge
@alert.root({ variant: 'destructive', autoDismiss: true })
  @!alert.title({ text: 'Unauthorized' })
  @!alert.description({ text: 'You are not allowed to access this page' })
@end
```

### Button

Renders a button element.

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Button text (alternative to using the slot) |

```edge
@!button({ text: 'Sign up', type: 'submit' })

@button({ type: 'button', class: 'btn-secondary' })
  <span>Cancel</span>
@end
```

### Link

Renders an anchor element with route-based URL generation.

| Prop | Type | Description |
|------|------|-------------|
| `text` | `string` | Link text (alternative to using the slot) |
| `route` | `string` | Compute href from a named route |
| `routeParams` | `array` | Parameters for the named route |
| `routeOptions` | `object` | Additional options for URL generation |
| `href` | `string` | Direct URL (use instead of route) |

```edge
@!link({ route: 'posts.show', routeParams: [post.id], text: 'View post' })

@link({ route: 'posts.edit', routeParams: [post.id] })
  <span>Edit</span>
  <svg>{{-- icon --}}</svg>
@end
```

### Avatar

Renders either an image or initials for user avatars.

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Avatar image URL (renders an `img` element) |
| `initials` | `string` | Fallback initials (renders a `span` element) |

```edge
{{-- With image --}}
@!avatar({ src: user.avatarUrl, alt: user.name })

{{-- With initials --}}
@!avatar({ initials: user.initials })
```

## Debugging templates

When working with templates, you may need to inspect the data available in your template or debug why certain values aren't displaying as expected. Edge provides the `@dump` tag for this purpose.

The `@dump` tag pretty-prints the value of a variable, making it easy to inspect data structures:

```edge
@dump(posts)
```

To view the entire template state (all variables available in your template), use:

```edge
@dump(state)
```

The output appears in your rendered HTML, showing the structure and values of your data. During development, templates automatically reload when you make changes, so you'll see updates immediately in your browser without restarting the server.

## Configuration

Edge comes pre-configured in Hypermedia applications and works out of the box. However, you can customize Edge by creating a preload file if you need to register custom helpers, tags, or plugins.

Create a preload file for Edge configuration:
```bash
node ace make:preload view
```

This creates a preload file where you can customize Edge before your application starts. Inside this file, you can register Edge globals, plugins, and custom tags.

If you need to customize the directory where templates are stored, you can modify the `directories` option in your `adonisrc.ts` file. See the [AdonisRC reference guide](#) for more details on configuration options.

## See also

- [Edge syntax reference](#) - Learn about all template syntax features, tags, and expressions
- [Edge components guide](#) - Deep dive into building and composing components
- [Edge reference guide](#) - View all available helpers and global properties in Edge templates
- [Edge documentation](https://edgejs.dev) - Complete Edge documentation with advanced features and patterns
