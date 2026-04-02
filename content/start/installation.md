---
title: 'Installation'
description: 'Learn how to create a new AdonisJS application and start the development server.'
---

# Installation

This guide explains how to set up a new AdonisJS application from scratch. It covers the prerequisites, project creation, and starting the development server. You do not need prior experience with AdonisJS, but basic knowledge of Node.js is useful.

## Prerequisites

Before you begin, make sure you have the following tools installed.

- **Node.js ≥ 24.x**
- **npm ≥ 11.x**

You can verify your installed versions using the following commands.

```sh
node -v
npm -v
```

Check that your Node.js and npm versions meet these requirements before continuing. You can download the latest versions from the [Node.js website](https://nodejs.org/) or use a version manager like Volta/nvm.

## Creating a new application

AdonisJS provides the `create-adonisjs` initializer package to scaffold new applications. This package creates a new project directory with all necessary files, dependencies, and configuration based on your selections during the setup process.

Replace `[project-name]` with your desired project name. The initializer will create a new directory with that name and set up your AdonisJS application inside it.

```sh
npm create adonisjs@latest [project-name]
```

This command starts an interactive setup and asks you to select a starter kit, or you may pre-define a starter kit using the `--kit` CLI option.

```sh title="Create a new Hypermedia application"
npm create adonisjs@latest [project-name] -- --kit=hypermedia
```

```sh title="Create a new React application"
npm create adonisjs@latest [project-name] -- --kit=react
```

```sh title="Create a new Vue application"
npm create adonisjs@latest [project-name] -- --kit=vue
```

```sh title="Create a new API application"
npm create adonisjs@latest [project-name] -- --kit=api
```

### Official starter kits

AdonisJS offers four official starter kits. Each kit sets up a different type of application, depending on how you want to build your user interface and manage interactivity.

- [**Hypermedia Starter Kit**](https://github.com/adonisjs/starter-kits/tree/main/hypermedia). Uses Edge as the server-side templating engine and integrates Alpine.js to add lightweight, reactive behavior to your frontend. Ideal for applications that primarily render HTML on the server and only need minimal frontend logic.

- [**React Starter Kit**](https://github.com/adonisjs/starter-kits/tree/main/inertia-react). Uses Inertia.js alongside React to build a fullstack React application powered by the AdonisJS backend. It can operate as a server-rendered app or a Single Page Application (SPA), depending on your configuration.

- [**Vue Starter Kit**](https://github.com/adonisjs/starter-kits/tree/main/inertia-vue). Similar to the React setup, but with Vue as the frontend framework. It utilizes Inertia.js and provides the same full-stack capabilities, including backend-driven routing, shared state, and SPA support.

- [**API Starter Kit**](https://github.com/adonisjs/starter-kits/tree/main/api). A monorepo setup with two apps: an AdonisJS backend and an empty frontend project where you can configure any frontend framework of your choice (TanStack Start, Nuxt, Next.js, or others). End-to-end type-safety and shared transformer types are already configured between the backend and frontend.

All starter kits come pre-configured with sensible defaults, streamlined development workflows, and ready-to-use authentication features. For a detailed comparison and usage guidance, see the [Pick your path](./pick_your_path.md) guide.

### Community starter kits

In addition to the official kits, the AdonisJS community also maintains starter kits for specific use cases.

- [**Slim Starter Kit**](https://github.com/batosai/adonisjs-slim-starter-kit). A minimal AdonisJS v7 setup with the framework core and Japa test runner, designed for teams that want to start from a lightweight foundation.

- [**MCP Starter Kit**](https://github.com/batosai/adonisjs-mcp-starter-kit). A minimal AdonisJS v7 setup with built-in MCP support, useful when you want to expose MCP tools, resources, and prompts in your application.

## Project defaults

Every newly created AdonisJS application includes:

- Opinionated folder structure.
- [Lucid ORM](https://lucid.adonisjs.com) configured with **SQLite** as the default database.
- Built-in **authentication** flows for login and signup.
- **ESLint** and **Prettier** setup with pre-defined configuration.

These features help you get started quickly. You can customize, extend, or remove them as your project grows.

## Starting the development server

After creating your app, move into your project directory and start the development server.

::::tabs

:::tab{title="Hypermedia / Inertia kits"}

```bash
node ace serve --hmr
```

Once the server is running, open your browser and visit [http://localhost:3333](http://localhost:3333). You should see the AdonisJS welcome page confirming your installation was successful.

:::

:::tab{title="API kit"}

The API starter kit is a monorepo managed by [Turborepo](https://turbo.build/repo). Start all apps from the project root:

```bash
npm run dev
```

This starts both the backend (AdonisJS) and frontend dev servers. The backend runs at [http://localhost:3333](http://localhost:3333) and returns a JSON response:

```json
{ "hello": "world" }
```

:::

::::

## What you just installed

Your starter kit includes:

- **Pre-configured development environment**. TypeScript, ESLint, Prettier, and Vite are set up with sensible defaults.

- **Database setup**. Lucid ORM is configured with SQLite, ready for you to start building models and running migrations.

- **Organized project structure**. Routes are defined in `start/routes.ts`, models live in `app/models/`, controllers are in `app/controllers/`, and middleware resides in `app/middleware/`. This convention keeps your codebase organized as it grows.

- **Working authentication**. All starter kits include a fully functional authentication system with signup and login flows.

::::tabs

:::tab{title="Hypermedia / Inertia kits"}
Try creating an account at [http://localhost:3333/signup](http://localhost:3333/signup) and logging in at [http://localhost:3333/login](http://localhost:3333/login). The `users` table already exists in your SQLite database (`tmp/db.sqlite`).
:::

:::tab{title="API kit"}
The authentication endpoints are available at `POST /api/v1/auth/signup` and `POST /api/v1/auth/login`. You can test them with any HTTP client (curl, Postman, or your frontend app). The `users` table already exists in your SQLite database (`apps/backend/tmp/db.sqlite`).
:::

::::

### Dev-server modes

- **Hot Module Replacement (--hmr)**. This is the recommended approach for most development scenarios. HMR updates your application in the browser without requiring a full page reload, preserving your application's state while reflecting code changes instantly. This provides the fastest development feedback loop, especially when working on frontend components or styles.

- **File watching (--watch)**. This mode automatically restarts the entire server process when you make changes to your code. While this approach takes slightly longer than HMR since it requires a full restart, it ensures a clean application state with every change and can be useful when working on server-side logic or when HMR updates aren't sufficient.

## Exploring other commands

The `ace` command-line tool includes many commands for development and production workflows.

To see all available commands, run the following.

```bash
node ace
```

## Next steps

- **New to AdonisJS?** Follow the [Tutorial](./tutorial/hypermedia/overview.md) to build a complete application and learn how everything works together.
- **Want to understand the codebase first?** Read [Folder Structure](./folder_structure.md) to see how the project is organized.
