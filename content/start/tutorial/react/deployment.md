# Deploying to Production

In the previous chapter, we added authorization to DevShow so users can only edit and delete their own content. We've now built a complete application with authentication, posts, comments, and proper permissions. Let's deploy it to production so the world can use it.

## Overview

Throughout this tutorial, we've been using SQLite as our database. SQLite works great for local development because it's simple and requires no setup. But for production, we need a database that can handle multiple connections and isn't tied to the filesystem of a single server.

In this chapter, we'll switch to PostgreSQL, create a production build of our application, and deploy everything to Cloud Galaxy. Cloud Galaxy is a PAAS (Platform as a Service) that handles the infrastructure for us, so we can focus on our application instead of managing servers.

:::note{title="Cloud Galaxy sponsors AdonisJS"}
We're using Cloud Galaxy for this tutorial, but AdonisJS works with any platform that supports the Node.js runtime. The same concepts apply whether you deploy to Heroku, DigitalOcean, AWS, or any other hosting provider.
:::

## Switching to PostgreSQL

Before we deploy, we need to switch from SQLite to PostgreSQL. Don't worry - this is easier than it sounds. Our models, migrations, and queries will work exactly the same because Lucid (AdonisJS's ORM) abstracts away the database-specific details.

::::steps
:::step{title="Install the PostgreSQL package"}

First, let's install the PostgreSQL driver for Lucid and remove the `better-sqlite3` package.
```bash
npm install pg
npm uninstall better-sqlite3
```

:::

:::step{title="Update database configuration"}

Open your database configuration file and update the default connection to use PostgreSQL.
```ts title="config/database.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    // [!code --:10]
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: app.tmpPath('db.sqlite3'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
    // [!code ++:14]
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
```

We've changed the default connection from `sqlite` to `postgres` and configured it to read connection details from environment variables. This means we can use different databases for development and production without changing any code.

:::

:::step{title="Update environment variables"}

Now let's add PostgreSQL connection details to our environment variables file.
```dotenv title=".env"
TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=your-app-key-here
NODE_ENV=development
SESSION_DRIVER=cookie

// [!code ++:5]
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=devshow
```

These are typical local PostgreSQL settings. If you have PostgreSQL installed locally with different credentials, update these values to match your setup.

:::

:::step{title="Validate environment variables"}

Update your environment validation file to include the new database variables.
```ts title="start/env.ts"
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  // [!code ++:5]
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
})
```

This ensures AdonisJS validates your database environment variables on startup and gives you helpful errors if something is missing or incorrectly formatted.

:::

:::step{title="Create the PostgreSQL database"}

Before running migrations, you need to create the database. If you have PostgreSQL installed locally, open a terminal and run:
```bash
createdb devshow
```

Or connect to PostgreSQL and create it manually:
```bash
psql postgres
CREATE DATABASE devshow;
\q
```

If you don't have PostgreSQL installed locally, that's fine. We'll set it up in production through Cloud Galaxy, and you can continue with local development using SQLite by temporarily switching back to the SQLite connection in your config file.

:::

:::step{title="Run migrations"}

Now let's create all our tables in the PostgreSQL database.
```bash
node ace migration:run
```

You should see all your migrations execute successfully:
```bash
❯ migrated database/migrations/1758943358073_create_users_table
❯ migrated database/migrations/1766383750528_create_posts_table
❯ migrated database/migrations/1766384692875_create_comments_table
❯ migrated database/migrations/1766384816152_create_add_foreign_keys_to_posts_and_comments_table
```

Your PostgreSQL database now has the same structure as your SQLite database!

:::

:::step{title="Seed the database"}

Let's populate the new database with some test data.
```bash
node ace db:seed
```

Start your dev server with `npm run dev` and visit [`/posts`](http://localhost:3333/posts). Everything should work exactly as before, but now you're running on PostgreSQL instead of SQLite.

:::
::::

## Creating a production build

Now that we're using PostgreSQL, let's prepare our application for production by creating an optimized build. During development, AdonisJS compiles TypeScript on the fly, which is convenient but adds overhead. For production, we create a pre-compiled JavaScript build that runs faster and doesn't require TypeScript as a dependency.

::::steps
:::step{title="Create the build"}

Run the build command to create a production-ready version of your application.
```bash
node ace build
```

You'll see output showing the build process:
```bash
[ info ] loading hooks...
[ info ] generating indexes...
[ info ] created .adonisjs/server/events.ts (1.08 ms)
[ info ] created .adonisjs/server/listeners.ts (266 μs)
[ info ] created .adonisjs/server/controllers.ts (1.11 ms)
[ info ] created .adonisjs/server/policies.ts (383 μs)
[ info ] cleaning up output directory (build)
[ info ] building assets with vite

[ info ] compiling typescript source (tsc)
[ info ] created ace file (build/ace.js)
[ info ] copying meta files to the output directory
[ success ] build completed
```

This creates a new `build` directory in your project containing the compiled JavaScript version of your application. Notice the "building assets with vite" step—this compiles your React components and creates optimized JavaScript bundles for the frontend.

:::

:::step{title="Understanding the build directory"}

Let's look at what gets generated in the `build` directory:
```
build/
├── app/                    # Your compiled application code
├── config/                 # Configuration files
├── database/              # Migrations and seeders
├── public/                # Static assets and compiled React bundles
├── resources/             # Any non-compiled resources
├── start/                 # Application bootstrap files
├── ace.js                 # Ace command-line tool
├── bin/                   # Server and console entry points
│   ├── server.js          # HTTP server
│   └── console.js         # Console commands
├── package.json           # Dependencies for production
└── package-lock.json      # Locked dependency versions
```

The most important file is `bin/server.js` - this is what you'll run in production to start your application. Notice how the TypeScript files (`*.ts`, `*.tsx`) have been compiled to JavaScript (`*.js`), and your React components are bundled in the `public` directory. Type definitions are gone since JavaScript doesn't need them.

:::

:::step{title="Test the production build locally"}

Before deploying, let's verify the build works locally. Navigate into the build directory and install production dependencies.
```bash
cd build
npm ci --omit=dev
```

The `npm ci` command installs dependencies exactly as specified in `package-lock.json`, and `--omit=dev` skips development dependencies like TypeScript since we don't need them in production.

Now copy your `.env` file into the build directory (you need environment variables to run the app):
```bash
cp ../.env .env
```

Start the production server:
```bash
node bin/server.js
```

Visit [`http://localhost:3333`](http://localhost:3333) and you should see your application running from the compiled build! When you're done testing, stop the server with `Ctrl+C` and navigate back to your project root:
```bash
cd ..
```

:::
::::

## Deploying to Cloud Galaxy

Now we're ready to deploy DevShow to production using Cloud Galaxy. Cloud Galaxy is designed specifically for AdonisJS applications and handles everything from HTTPS certificates to database management.

::::steps
:::step{title="Create a Cloud Galaxy account"}

Visit [cloud.adonisjs.com](https://cloud.adonisjs.com) and create an account. After signing up, you'll land on your dashboard where you can create and manage applications.

:::

:::step{title="Create a new application"}

Click the "New Application" button and fill in the details:

- **Application name**: `devshow` (or any name you prefer)
- **Region**: Choose the region closest to your users
- **Plan**: Select the plan that fits your needs (the starter plan works great for this tutorial)

Click "Create Application" and Galaxy will provision your application environment.

:::

:::step{title="Connect your Git repository"}

Cloud Galaxy deploys directly from your Git repository. If you haven't already, push your code to GitHub, GitLab, or Bitbucket:
```bash
git add .
git commit -m "Ready for production deployment"
git push origin main
```

Back in Galaxy, go to your application's "Settings" tab and connect your Git repository. Follow the prompts to authorize Galaxy to access your repository.

:::

:::step{title="Create a PostgreSQL database"}

In your Galaxy application dashboard, navigate to the "Databases" tab and click "Create Database". Choose PostgreSQL and select a plan. Galaxy will provision a managed PostgreSQL database for you.

Once created, you'll see connection details. Keep this tab open - we'll need these details in the next step.

:::

:::step{title="Configure environment variables"}

Go to the "Environment" tab in your Galaxy application dashboard. Here, you'll add all the environment variables your application needs:
```
NODE_ENV=production
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
APP_KEY=your-production-app-key-here

DB_HOST=<from-galaxy-database-details>
DB_PORT=<from-galaxy-database-details>
DB_USER=<from-galaxy-database-details>
DB_PASSWORD=<from-galaxy-database-details>
DB_DATABASE=<from-galaxy-database-details>
```

:::warning
Generate a new `APP_KEY` for production - never use your development key in production. Run `node ace generate:key` to create a new one.
:::

Important notes about these variables:

- **HOST must be `0.0.0.0`** in production - this tells the server to accept connections from any network interface, which is necessary for cloud platforms
- **Database credentials** should come from the Galaxy database details page
- **APP_KEY** should be a new, secure key generated specifically for production

:::

:::step{title="Deploy your application"}

Now we're ready to deploy! In the "Deployments" tab, click "Deploy Now". Galaxy will:

1. Clone your Git repository
2. Run `node ace build` to create the production build (including compiling React components)
3. Install production dependencies
4. Start your application

Watch the deployment logs to see the progress. The first deployment usually takes a few minutes.

:::

:::step{title="Run migrations in production"}

Once your application is deployed, you need to run migrations to create the database tables. In the Galaxy dashboard, go to the "Console" tab and run:
```bash
node ace migration:run --force
```

The `--force` flag is required when running migrations in production - it's a safety check to ensure you don't accidentally run migrations on the wrong database.

You'll see your migrations execute:
```bash
❯ migrated database/migrations/1763866156451_create_posts_table
❯ migrated database/migrations/1763866347711_create_comments_table
❯ migrated database/migrations/1732089800000_add_foreign_keys_to_posts_and_comments
```

:::

:::step{title="Visit your production application"}

Galaxy provides a URL for your application (usually something like `devshow-abc123.galaxycloud.app`). Visit this URL and you should see DevShow running in production!

Try creating an account, posting content, and adding comments. Everything should work exactly as it did locally, but now it's running on production infrastructure with a managed PostgreSQL database.

:::
::::

## What you built

Congratulations! You've successfully deployed DevShow to production. Throughout this tutorial, you've built a complete web application from scratch, learning how to:

- Create models and migrations to manage your database structure
- Build controllers to handle HTTP requests and business logic
- Use transformers to serialize data for your React frontend with type safety
- Render dynamic React components with Inertia
- Implement authentication and authorization
- Validate user input with forms
- Deploy to production with proper configuration

These are the fundamental skills you'll use in every AdonisJS + Inertia + React application you build. Ready to keep learning? Check out the [guides](../../../guides/basics/routing.md) to dive deeper into advanced topics.
