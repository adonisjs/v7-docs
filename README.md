# AdonisJS v7 Documentation

Source code for the [AdonisJS v7 documentation website](https://docs.adonisjs.com). The site is built with AdonisJS and compiled to static HTML during deployment.

## Local setup

Clone the repo and install dependencies.

```sh
git clone https://github.com/adonisjs/v7-docs.git
cd v7-docs
npm install
```

Copy `.env.example` to `.env` and fill in the values.

```sh
cp .env.example .env
```

Generate an `APP_KEY` using the following command.

```sh
node ace generate:key
```

Copy the output and set it as the `APP_KEY` value in your `.env` file.

Before starting the development server for the first time, you need to run the build process.

```sh
npm run build
```

Start the development server.

```sh
npm run dev
```

The site will be available at `http://localhost:3333`.

## Project structure

```
content/           Documentation markdown files
  start/           Getting started guides and tutorials
  guides/          In-depth feature guides
  reference/       API and configuration reference
resources/
  views/           Edge templates
  js/              Frontend JavaScript (Alpine.js, Unpoly)
  css/             Stylesheets (Tailwind CSS)
  assets/          Images, icons, and fonts
app/
  collections/     Content collection definitions (docs, releases, sponsors)
  controllers/     HTTP controllers (home and docs pages)
  services/        Doc rendering service
commands/          Ace commands (static build, OG image generation)
config/            Application configuration
start/             Routes, middleware, and view setup
```

## Writing documentation

All documentation lives in the `content/` directory as markdown files. Each section (`start`, `guides`, `reference`) has a `db.json` that defines the navigation structure.

### Adding a new page

1. Create a markdown file in the appropriate `content/` subdirectory.
2. Add frontmatter with `title` and `description`.

```md
---
title: 'Your page title'
description: 'A brief description for SEO and social sharing.'
---

# Your page title

Content goes here.
```

3. Register the page in the section's `db.json` file.

```json
{
  "title": "Your page title",
  "permalink": "guides/category/your-page",
  "contentPath": "./category/your_page.md"
}
```

The `permalink` determines the URL. The `contentPath` points to the markdown file relative to the section directory.

### Editing an existing page

Find the markdown file in `content/` and edit it directly. The dev server picks up changes automatically.

### Code blocks

Use fenced code blocks with a language and file path.

````md
```ts title="app/controllers/posts_controller.ts"
export default class PostsController {
  async index() {
    return 'Hello world'
  }
}
```
````

Highlight additions and removals with `// [!code ++]` and `// [!code --]`.

### Admonitions

Use `:::note`, `:::tip`, and `:::warning` for callouts.

```md
:::warning
Always validate user input before passing it to database queries.
:::
```

## Writing with Claude Code

This repo includes a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill for writing documentation. If you use Claude Code, run the `/adonisjs-docs-writer` skill when creating or editing documentation pages.

The skill enforces the AdonisJS writing style. Here is what to expect.

- **For new pages**, Claude will walk you through an interview (asking about the topic, audience, code examples, common mistakes, and related pages) before writing the documentation.
- **For edits**, Claude will follow the style rules automatically: feature summary before overview, complete runnable code examples with file paths, no sandwich pattern (explaining code both before and after), warnings that always include solutions, and confident direct language.

The full writing guidelines are in `.claude/skills/adonisjs-docs-writer/`.

## Building for production

The full build compiles TypeScript, renders all pages to static HTML, and generates the search index.

```sh
npm run build
```

The output goes to `build/public/`. This runs three steps in sequence.

1. `node ace build` compiles TypeScript and bundles frontend assets with Vite.
2. `node ace build:static` renders every documentation page to static HTML.
3. `pagefind --site build/public` generates the search index.

## Other commands

Generate Open Graph images for all documentation pages.

```sh
node ace generate:og
```

Lint and format the codebase.

```sh
npm run lint
npm run format
```

Type-check without emitting.

```sh
npm run typecheck
```

## Contributing

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run typecheck` to verify nothing is broken.
4. Submit a pull request.

For documentation changes, focus on the `content/` directory. For site functionality changes, the relevant code is in `app/`, `resources/`, and `start/`.
