---
description: Learn how to build and deploy AdonisJS applications to production, including creating standalone builds and configuring production environments.
---

# Deployment

This guide covers deploying AdonisJS applications to production. You will learn how to:

- Understand the standalone build and why your source files are not needed in production
- Configure `NODE_ENV` correctly during build and runtime
- Create a production build using the `node ace build` command
- Configure static files to be copied to the build output
- Run your application in production
- Handle user-uploaded files with persistent storage
- Configure logging for production environments
- Run database migrations safely in production
- Create a Docker image using a multi-stage Dockerfile

## Overview

AdonisJS applications are written in TypeScript and must be compiled to JavaScript before running in production. The build process creates a **standalone build**, which means the compiled output contains everything needed to run your application without the original TypeScript source files.

Since AdonisJS apps run on the Node.js runtime, your deployment platform must support Node.js version 24 or later. The build process compiles your TypeScript code, bundles frontend assets (if using Vite), and copies necessary files to a `build` directory that you can deploy directly to your production server.

## Understanding the standalone build

The standalone build is the compiled output of your AdonisJS application. After creating the build, you only need to deploy the `build` directory to your production server. The original source files, development dependencies, and TypeScript configuration are not required in production.

This approach offers several benefits. The deployment size is significantly smaller since you are not shipping TypeScript source files or development tooling. The production environment only needs the JavaScript runtime, and you can treat the `build` folder as an independent, self-contained application.

## NODE_ENV during build and runtime

The `NODE_ENV` environment variable behaves differently during the build process versus runtime, and understanding this distinction is important for successful deployments.

During the build process, you need development dependencies installed because the build tooling (TypeScript compiler, Vite, and other build tools) are typically listed as `devDependencies` in your `package.json`. If you are creating the build in a CI environment or a sandbox where dependencies are not already installed, set `NODE_ENV=development` before running `npm install` to ensure all dependencies are available.

```sh
# In CI/CD or fresh environments
NODE_ENV=development npm install
npm run build
```

During runtime in production, `NODE_ENV` should be set to `production`. This enables production optimizations and disables development-only features like detailed error pages.

## Creating the production build

Run the build command from your project root.

```sh
npm run build
```

This executes `node ace build` under the hood. The build process performs the following steps in order:

1. Removes the existing `./build` folder if one exists
2. Rewrites the `ace.js` file to remove the TypeScript loader import
3. Compiles frontend assets using Vite (if configured)
4. Compiles TypeScript source code to JavaScript using `tsc`
5. Copies non-TypeScript files registered in the `metaFiles` array to `./build`
6. Copies `package.json` and your package manager lock file to `./build`

If there are TypeScript errors in your code, the build will fail. You must fix these errors before creating a production build. If you need to bypass TypeScript errors temporarily, use the `--ignore-ts-errors` flag.

```sh
npm run build -- --ignore-ts-errors
```

The `--package-manager` flag controls which lock file is copied to the build output. If not specified, the build command detects your package manager based on how you invoked the command (for example, `npm run build` versus `pnpm build`).

```sh
npm run build -- --package-manager=pnpm
```

## Build output contents

After a successful build, the `build` directory contains your compiled application. Here is what you will find inside:

- Compiled JavaScript files mirroring your source directory structure
- The `package.json` and lock file for installing production dependencies
- Static files and other assets configured in `metaFiles`
- Frontend assets in `build/public` (for Vite-powered applications)

Environment files (`.env`, `.env.example`) are intentionally excluded from the build output. Environment variables are not portable between environments, and you must configure them separately for each deployment target through your hosting platform's environment variable management.

## Static files

Static files that need to be included in the production build are configured using the `metaFiles` array in your `adonisrc.ts` file. These are non-TypeScript files that your application needs at runtime, such as Edge templates or public assets.

```ts title="adonisrc.ts"
{
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    },
    {
      pattern: 'public/**',
      reloadServer: false,
    },
  ],
}
```

The `pattern` property accepts glob patterns to match files. The `reloadServer` property controls whether file changes trigger a server restart during development and has no effect on the production build.

For Hypermedia and Inertia applications, Vite compiles frontend assets and places them in the `public` directory. These are then copied to `build/public` during the build process.

### Adjust `keepAliveTimeout` for reverse proxy and node balancers

Real-world apps are usually not accessed directly, but behind reverse proxy and node balancers, e.g. Nginx.

By default, Node.js closes idle connections after 5 seconds, but Nginx may try to keep them open for 60+ seconds. When Nginx tries to reuse an old connection it thinks is open, but Node.js has already silently closed it, Nginx throws `502 Bad Gateway` errors.

To avoid this issue, you need to change AdonisJS server's `keepAliveTimeout` to larger than Nginx's `proxy_read_timeout` (50s by default).

```ts title="config/app.ts"
{
  keepAliveTimeout: 55000,
}
```

### Serving static files in production

While AdonisJS includes a [static file server](../guides/basics/static_file_server.md), you should offload static file serving to a dedicated tool in production. Every static file request handled by your Node.js process is a request that cannot be spent on dynamic work. A reverse proxy or CDN is purpose-built for this job and will deliver files faster with less resource usage.

You have two main options depending on your infrastructure.

**Reverse proxy (Nginx, Caddy, Traefik, Apache)**

Configure your reverse proxy to serve the `build/public` directory directly for static file requests and forward everything else to your AdonisJS server. This way, static files never reach your Node.js process.

With Nginx, you can add a `location` block that tries to serve files from the `public` directory first and falls back to the AdonisJS server for dynamic routes.

```nginx title="nginx.conf"
server {
    listen 80;
    server_name example.com;

    root /path/to/your/app/build/public;

    location / {
        try_files $uri @adonis;
    }

    location @adonis {
        proxy_pass http://localhost:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**CDN**

For the best performance, upload your compiled assets to a CDN. This requires updating the `assetsUrl` option in your Vite configuration so that generated asset URLs point to your CDN instead of your application server.

```ts title="config/vite.ts"
{
  assetsUrl: 'https://cdn.example.com/assets',
}
```

After each build, deploy the contents of `build/public` to your CDN. Your CI/CD pipeline can automate this step.

:::tip
You can combine both approaches. Use a reverse proxy to serve files like `favicon.ico` and `robots.txt` from the `public` directory, and a CDN for Vite-compiled assets (JavaScript, CSS, images) that benefit from global distribution.
:::

## Running the production build

To run your application in production, treat the `build` directory as the root of your application. Change into the build directory, install production dependencies, and start the server.

```sh
cd build
npm ci --omit=dev
node bin/server.js
```

Using `npm ci --omit=dev` instead of `npm install` ensures a clean, reproducible installation using only the lock file and skips development dependencies. You must also provide all required environment variables before starting the server. Your hosting platform should have a mechanism for configuring environment variables. You can reference your `env.ts` file or `.env.example` to see which variables your application requires.

## User-uploaded files

User-uploaded files require persistent storage that survives deployments. When you deploy a new version of your application, the previous build directory is typically replaced, which means any files stored locally within that directory are lost.

For production deployments, use a cloud storage provider such as Amazon S3, Cloudflare R2, or Google Cloud Storage. These services provide durable, persistent storage that is independent of your application deployments.

If you must store files locally on your server, configure a directory outside of your application's build folder and ensure this directory persists across deployments. The specific approach depends on your hosting platform and deployment strategy.

## Logging

AdonisJS uses Pino for logging, which outputs structured logs in NDJSON format to stdout. This format is well-suited for production environments because most logging services and log aggregators can parse NDJSON directly.

Configure your hosting platform to capture stdout from your application process. Most platforms provide built-in integrations with logging services like Datadog, Logtail, or Papertrail. Alternatively, you can pipe your application's output to a log shipping agent.

Pino's structured JSON output includes timestamps, log levels, and any additional context you attach to log messages, making it straightforward to search and filter logs in your logging service.

## Database migrations

Run migrations in production using the `migration:run` command with the `--force` flag.

```sh
node ace migration:run --force
```

The `--force` flag is required because running migrations is disabled by default in production environments. This is a safety measure to prevent accidental schema changes.

AdonisJS migrations are idempotent and use exclusive locking. If multiple processes attempt to run migrations simultaneously (for example, during a rolling deployment), only one process will execute the migrations while others wait. This prevents race conditions and duplicate migration attempts.

If your deployment platform supports lifecycle hooks or has a dedicated mechanism for running database migrations, use that instead of running migrations as part of your application startup. This separation ensures migrations complete successfully before any application instances start serving traffic.

Rolling back migrations in production is disabled by default and is not recommended. Instead of rolling back, create a new migration that reverses the changes you need to undo. This approach maintains a clear history of all schema changes and avoids the risks associated with rollbacks in production.

## Dockerfile

The following Dockerfile creates an optimized production image using multi-stage builds. The first stage installs all dependencies and creates the build, while the final stage contains only the production runtime.

```dockerfile title="Dockerfile"
FROM node:lts-bookworm-slim AS base

# ----------------------------
# Stage 1: Install all dependencies
# ----------------------------
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ----------------------------
# Stage 2: Build the application
# ----------------------------
FROM deps AS build
WORKDIR /app
COPY . .
RUN node ace build

# ----------------------------
# Stage 3: Production runtime
# ----------------------------
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./
RUN npm ci --omit=dev

EXPOSE 3333
CMD ["node", "bin/server.js"]
```

This Dockerfile follows a multi-stage pattern where each stage has a specific purpose. The `deps` stage installs all dependencies needed for the build. The `build` stage compiles the TypeScript application. The `production` stage creates a minimal image with only production dependencies.

To build and run the Docker image:

```sh
docker build -t my-adonis-app .
docker run -p 3333:3333 --env-file .env my-adonis-app
```

Pass environment variables using the `--env-file` flag or individual `-e` flags. The container exposes port 3333 by default, which you can map to any host port.

### Running migrations with Docker

For containerized deployments, you have two options for running migrations. You can run them as a separate command before starting your application containers:

```sh
docker run --rm --env-file .env my-adonis-app node ace migration:run --force
```

Alternatively, you can create an entrypoint script that runs migrations before starting the server. Create this file in your project root:

```js title="docker-entrypoint.js"
import { execSync } from 'node:child_process'

/**
 * Run migrations before starting the server
 * when the MIGRATE environment variable is set.
 */
if (process.env.MIGRATE === 'true') {
  console.log('Running migrations...')
  execSync('node ace migration:run --force', { stdio: 'inherit' })
}

/**
 * Start the server
 */
console.log('Starting server...')
await import('./bin/server.js')
```

Update your Dockerfile to use this entrypoint:

```dockerfile title="Dockerfile"
FROM node:lts-bookworm-slim AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN node ace build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build ./
RUN npm ci --omit=dev

# [!code ++:2]
# Copy the entrypoint script
COPY docker-entrypoint.js ./

EXPOSE 3333
# [!code --]
CMD ["node", "bin/server.js"]
# [!code ++]
CMD ["node", "docker-entrypoint.js"]
```

With this setup, setting `MIGRATE=true` as an environment variable will run migrations before starting the server. For horizontal scaling where multiple containers start simultaneously, the migration locking ensures only one container runs migrations while others wait.
