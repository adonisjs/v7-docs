---
description: Learn how to use Lucid ORM, the official SQL ORM for AdonisJS, including models, query builder, migrations, and relationships.
---

# Lucid - SQL ORM

This guide covers Lucid ORM, the official database ORM for AdonisJS. You will learn how to:

- Configure database connections
- Use the query builder and models
- Create migrations and define relationships
- Work with transactions and hooks
- Serialize models and generate test data

## Overview

Lucid ORM is an Active Record ORM built on top of Knex and deeply integrated within the AdonisJS ecosystem. Unlike standalone ORMs that require extensive configuration, Lucid works seamlessly with AdonisJS features like the validator, authentication layer, caching, rate-limiting, and queues without any additional setup.

Lucid simplifies database interactions by encapsulating common operations using language-specific objects and classes. It's built on top of Knex, which means you can express complex SQL queries using a JavaScript API when needed. Lucid supports multiple databases including MySQL, PostgreSQL, Turso, SQLite, and MSSQL. The class-based model system makes your code intuitive and type-safe, while built-in support for relationships lets you model complex data structures. The migration system provides version control for your database schema, and seeders and factories help you populate databases with test data.

This guide provides a high-level overview of Lucid's features to help you understand what's available and how the pieces fit together. For detailed API references, advanced patterns, and comprehensive documentation on specific features, refer to the [official Lucid documentation](https://lucid.adonisjs.com).

## Configuration

Lucid's configuration lives in the `config/database.ts` file at the root of your AdonisJS project. This file defines your database connections, migration paths, and other ORM settings.

```typescript title="config/database.ts"
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: env.get('DB_CONNECTION'),
  connections: {
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

The configuration specifies which database connection to use by default (typically set via environment variables), and defines the connection details for each database. Each connection includes the client library (like `pg` for PostgreSQL or `mysql2` for MySQL), connection credentials, and paths to migration files.

You can explore all available configuration options, connection pooling settings, and advanced features like read-write replicas in the [Lucid configuration documentation](https://lucid.adonisjs.com/docs/installation#configuration).

## Using the query builder directly

Before diving into models, you can use Lucid's query builder directly for database operations. The query builder provides a fluent JavaScript API for constructing SQL queries, which is particularly useful for complex queries or when you don't need the full Active Record pattern.

The query builder is available through the `db` service and works identically to Knex, since Lucid is built on top of it.

```typescript title="app/controllers/posts_controller.ts"
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    /**
     * Select all published posts ordered by creation date.
     * This returns an array of plain objects.
     */
    const posts = await db
      .from('posts')
      .select('*')
      .where('status', 'published')
      .orderBy('created_at', 'desc')

    return response.json(posts)
  }

  async store({ request, response }: HttpContext) {
    const { title, content } = request.only(['title', 'content'])

    /**
     * Insert a new post and return the generated ID.
     * Insert queries return an array of IDs.
     */
    const [id] = await db
      .insertQuery()
      .table('posts')
      .insert({
        title,
        content,
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date(),
      })

    return response.created({ id })
  }
}
```

The query builder handles parameterized queries automatically, protecting against SQL injection. You can use it for selects, inserts, updates, deletes, joins, aggregations, and any other SQL operation. When you need raw SQL for complex operations, you can use `db.rawQuery()`.

For the complete query builder API including joins, subqueries, aggregations, and advanced where clauses, see the [Lucid query builder documentation](https://lucid.adonisjs.com/docs/select-query-builder).

## Working with models

Models provide an object-oriented way to interact with database tables. Each model class represents a table, and each model instance represents a row. Lucid uses a migrations-first approach where you define your schema in migrations, and Lucid automatically generates TypeScript schema classes that your models extend.

### Creating your first migration

Migrations are the foundation of Lucid's schema management. They provide version control for your database schema, allowing you to evolve your schema incrementally over time. Each migration is a TypeScript file with `up` and `down` methods that define how to move the schema forward and how to roll it back.

Create a migration for a posts table:

```bash
node ace make:migration posts
```

This generates a timestamped migration file in `database/migrations/`. The timestamp ensures migrations run in the correct order.

```typescript title="database/migrations/1705234567890_create_posts_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    /**
     * The up method creates the table structure.
     * Use the schema builder to define columns and constraints.
     */
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.text('content').notNullable()
      table.string('status').defaultTo('draft')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    /**
     * The down method reverses the up method's changes.
     * This enables rolling back migrations if needed.
     */
    this.schema.dropTable(this.tableName)
  }
}
```

Run the migration to create the table:

```bash
node ace migration:run
```

Lucid executes the migration, creates the `posts` table in your database, and automatically generates a schema class at `database/schema.ts` that contains type-safe column definitions.

:::tip
Migrations run inside transactions by default. If a migration fails, all changes are rolled back automatically, keeping your database in a consistent state.
:::

For more migration operations like altering tables, adding indexes, and working with foreign keys, see the [Lucid migrations documentation](https://lucid.adonisjs.com/docs/migrations).

### Auto-generated schema classes

After running migrations, Lucid scans your database and generates TypeScript schema classes that contain all column definitions with proper types. This migrations-first approach keeps your models clean and ensures your TypeScript types always match your actual database schema.

The generated schema class lives at `database/schema.ts`.

```typescript title="database/schema.ts"
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export class PostsSchema extends BaseModel {
  static table = 'posts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare content: string

  @column()
  declare status: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
```

Lucid automatically converts database types to appropriate TypeScript types, snake_case column names to camelCase properties, and timestamp columns to Luxon DateTime objects. The `autoCreate` option means Lucid sets the timestamp when creating a record, and `autoUpdate` means it updates the timestamp on every save.

### Schema generation rules

The default schema generation can be steered by configuring schema generation rules. Make sure your database config enables generation and points to the `database/schema_rules.ts` file:

```typescript title="database/schema_rules.ts"
import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator';

export default {
  types: {
    /**
     * Customize all JSON columns globally to use a type-safe JSON wrapper
     * instead of the default 'any' type.
     */
    jsonb: {
      decorator: '@column()',
      tsType: 'JSON<any>',
      imports: [{ source: '#types/db', typeImports: ['JSON'] }],
    },
  },
  tables: {
    /**
     * Customize the users table to make the user_role column
     * a strict union type instead of a generic string.
     */
    users: {
      columns: {
        user_role: {
          decorators: [{ name: '@column' }],
          tsType: `'admin' | 'editor'`,
        },
      },
    },
  },
} satisfies SchemaRules;
```

### Creating a model

Now create a model that extends the generated schema class:

```bash
node ace make:model Post
```

```typescript title="app/models/post.ts"
import { PostsSchema } from '#database/schema'

export default class Post extends PostsSchema {
  // Your model is ready to use with all columns inherited from the schema
}
```

The model inherits all column definitions from the schema class. You'll add relationships, hooks, and custom methods here, while the schema class handles column definitions.

:::warning
Never modify the generated schema classes in `database/schema.ts` directly. These files are regenerated after every migration. Instead, override columns or add custom logic in your model classes, which extend the schema classes and persist your changes.

If you need to change column types or add columns, create a new migration. The schema classes will automatically update after running the migration.
:::

To learn more about customizing type mappings and schema generation rules, see the [Lucid schema classes documentation](https://lucid.adonisjs.com/docs/schema-classes).

### Basic CRUD operations

With your model ready, you can perform create, read, update, and delete operations using an intuitive API.

**Creating records:**

```typescript title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ request, response }: HttpContext) {
    /**
     * Create a new post using the create method.
     * Lucid automatically sets created_at and updated_at.
     */
    const post = await Post.create({
      title: request.input('title'),
      content: request.input('content'),
      status: 'draft',
    })

    return response.created(post)
  }
}
```

**Reading records:**

```typescript title="app/controllers/posts_controller.ts"
export default class PostsController {
  async index({ response }: HttpContext) {
    /**
     * Fetch all posts ordered by creation date.
     * Returns an array of Post model instances.
     */
    const posts = await Post.query().orderBy('created_at', 'desc')
    return response.json(posts)
  }

  async show({ params, response }: HttpContext) {
    /**
     * Find a specific post by ID.
     * Throws a 404 exception if not found.
     */
    const post = await Post.findOrFail(params.id)
    return response.json(post)
  }
}
```

**Updating records:**

```typescript title="app/controllers/posts_controller.ts"
export default class PostsController {
  async update({ params, request, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    /**
     * Merge updates and save to database.
     * The updated_at timestamp updates automatically.
     */
    await post.merge({
      title: request.input('title'),
      content: request.input('content'),
    }).save()

    return response.json(post)
  }
}
```

**Deleting records:**

```typescript title="app/controllers/posts_controller.ts"
export default class PostsController {
  async destroy({ params, response }: HttpContext) {
    const post = await Post.findOrFail(params.id)

    /**
     * Delete the post from the database.
     * This triggers any delete hooks defined on the model.
     */
    await post.delete()

    return response.noContent()
  }
}
```

For idempotent operations like `firstOrCreate`, `updateOrCreate`, and bulk operations like `createMany`, see the [Lucid CRUD operations documentation](https://lucid.adonisjs.com/docs/crud-operations).

### Accessing the query builder from models

While basic CRUD methods handle common scenarios, you'll often need more complex queries. Every model provides access to the query builder through the `query()` method, giving you full SQL flexibility while still working with model instances.

```typescript title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async published({ response }: HttpContext) {
    /**
     * Build a complex query using the query builder.
     * Results are still Post model instances.
     */
    const posts = await Post.query()
      .where('status', 'published')
      .whereNotNull('published_at')
      .where('created_at', '>', new Date('2024-01-01'))
      .orderBy('published_at', 'desc')
      .limit(10)

    return response.json(posts)
  }

  async search({ request, response }: HttpContext) {
    const searchTerm = request.input('q')

    /**
     * Use where clauses with operators and multiple conditions.
     * The orWhere method adds OR conditions to the query.
     */
    const posts = await Post.query()
      .where('title', 'ilike', `%${searchTerm}%`)
      .orWhere('content', 'ilike', `%${searchTerm}%`)
      .where('status', 'published')

    return response.json(posts)
  }
}
```

The query builder methods return model instances instead of plain objects, which means you get all model functionality like relationships, serialization, and hooks. You can chain any Knex query builder method, including joins, subqueries, grouping, and aggregations.

For the complete query builder API, see the [Lucid query builder documentation](https://lucid.adonisjs.com/docs/select-query-builder).

## Pretty printing queries during development

Understanding what SQL queries your application generates helps with debugging and optimization. Lucid provides built-in query debugging that pretty-prints SQL statements to your console during development.

Pretty printing is enabled by default in development mode. You'll see formatted SQL queries in your terminal:

```sql
select * from "posts" where "status" = 'published' order by "created_at" desc
```

The feature is configured in your database config:

```typescript title="config/database.ts"
const dbConfig = defineConfig({
  prettyPrintDebugQueries: true,
  connections: {
    postgres: {
      client: 'pg',
      connection: {},
      /**
       * Enable debug mode to log all queries for this connection.
       * Set to false in production to avoid performance overhead.
       */
      debug: true,
    },
  },
})
```

You can also enable debugging on a per-query basis:

```typescript
const posts = await Post
  .query()
  .debug(true)
  .where('status', 'published')
```

For more control over query debugging and logging, including listening to query events, see the [Lucid debugging documentation](https://lucid.adonisjs.com/docs/debugging).

## Pagination

Pagination prevents performance issues when working with large datasets by loading records in manageable chunks. Lucid provides offset-based pagination that integrates seamlessly with both the query builder and models.

```typescript title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = 20

    /**
     * Paginate posts with 20 records per page.
     * Always use orderBy to ensure consistent pagination.
     */
    const posts = await Post
      .query()
      .where('status', 'published')
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    /**
     * Set the base URL for pagination links.
     * This enables generating correct page URLs.
     */
    posts.baseUrl('/posts')

    return response.json(posts)
  }
}
```

The paginator provides metadata about the current page:

```json
{
  "meta": {
    "total": 245,
    "perPage": 20,
    "currentPage": 1,
    "lastPage": 13,
    "firstPage": 1,
    "firstPageUrl": "/posts?page=1",
    "lastPageUrl": "/posts?page=13",
    "nextPageUrl": "/posts?page=2",
    "previousPageUrl": null
  },
  "data": [
    // Post objects
  ]
}
```

You can use this metadata to build pagination UI in your templates:

```edge
@each(anchor in posts.getUrlsForRange(1, posts.lastPage))
  <a href="{{ anchor.url }}" class="{{ anchor.isActive ? 'active' : '' }}">
    {{ anchor.page }}
  </a>
@endeach
```

:::tip
Always include an `orderBy` clause when paginating. Without explicit ordering, database engines may return records in random order, causing items to appear on multiple pages or be skipped entirely as users navigate.
:::

For cursor-based pagination and customizing the JSON response format, see the [Lucid pagination documentation](https://lucid.adonisjs.com/docs/pagination).

## Transactions

Database transactions ensure data integrity by grouping multiple operations into an atomic unit. If any operation fails, the entire transaction rolls back, preventing partial updates that could leave your database in an inconsistent state.

Lucid provides managed transactions that automatically commit on success and rollback on exceptions:

```typescript title="app/controllers/posts_controller.ts"
import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async store({ request, auth, response }: HttpContext) {
    /**
     * Wrap operations in a transaction.
     * If any operation throws, all changes roll back automatically.
     */
    const post = await db.transaction(async (trx) => {
      const user = auth.getUserOrFail()

      /**
       * Create the post using the transaction.
       * All model operations within this callback use the same transaction.
       */
      const post = new Post()
      post.title = request.input('title')
      post.content = request.input('content')
      post.useTransaction(trx)
      await post.save()

      /**
       * Update user's post count.
       * This shares the same transaction, ensuring both operations
       * succeed together or fail together.
       */
      user.useTransaction(trx)
      user.postCount = user.postCount + 1
      await user.save()

      return post
    })

    return response.created(post)
  }
}
```

For manual transaction control, isolation levels, and savepoints, see the [Lucid transactions documentation](https://lucid.adonisjs.com/docs/transactions).

## Model hooks

Hooks allow you to execute code at specific points in a model's lifecycle. You can use hooks to hash passwords before saving, validate data, update related records, or perform any logic that should happen automatically during model operations.

```typescript title="app/models/user.ts"
import { UsersSchema } from '#database/schema'
import { beforeSave } from '@adonisjs/lucid/orm'
import hash from '@adonisjs/core/services/hash'

export default class User extends UsersSchema {
  /**
   * Hash the password before saving to the database.
   * The hook runs before both inserts and updates.
   */
  @beforeSave()
  static async hashPassword(user: User) {
    /**
     * Only hash if the password was modified.
     * The $dirty object tracks which attributes changed.
     */
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }
}
```

Lucid provides hooks for different lifecycle events. Before hooks (`@beforeSave`, `@beforeCreate`, `@beforeUpdate`, `@beforeDelete`) run before database operations and can modify data or cancel operations. After hooks (`@afterSave`, `@afterCreate`, `@afterUpdate`, `@afterDelete`) run after database operations and are useful for side effects like sending notifications. Query hooks (`@beforeFind`, `@afterFind`, `@beforeFetch`, `@afterFetch`) run during fetch operations and can automatically filter results.

```typescript title="app/models/post.ts"
import { PostsSchema } from '#database/schema'
import { beforeFind, afterCreate } from '@adonisjs/lucid/orm'

export default class Post extends PostsSchema {
  /**
   * Automatically exclude soft-deleted posts from queries.
   * This hook modifies every find query to filter deleted records.
   */
  @beforeFind()
  static ignoreDeleted(query) {
    query.where('isDeleted', false)
  }

  /**
   * Send notification after creating a post.
   * After hooks receive the saved model instance.
   */
  @afterCreate()
  static async notifyFollowers(post: Post) {
    // Send notifications to followers
  }
}
```

:::warning
Direct query builder updates bypass hooks entirely. When you use `await Post.query().where('id', 1).update({ title: 'New' })`, no hooks execute and timestamps don't update automatically.

This behavior exists for performance reasons when updating many records. If you need hooks to run, fetch the model instance first, modify it, and call `save()`.
:::

For complete hook lifecycle information and advanced patterns, see the [Lucid hooks documentation](https://lucid.adonisjs.com/docs/model-hooks).

## Model relationships

Relationships define how your models connect to each other, making it easy to work with related data. Lucid supports one-to-one, one-to-many, and many-to-many relationships with both lazy loading and eager loading.

### Defining relationships

A user has many posts:

```typescript title="app/models/user.ts"
import { UsersSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import Post from '#models/post'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class User extends UsersSchema {
  /**
   * Define a one-to-many relationship.
   * A user can have multiple posts.
   */
  @hasMany(() => Post)
  declare posts: HasMany<typeof Post>
}
```

A post belongs to a user:

```typescript title="app/models/post.ts"
import { PostsSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import User from '#models/user'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Post extends PostsSchema {
  /**
   * Define the inverse relationship.
   * Each post belongs to one user.
   */
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

### Eager loading relationships

Eager loading fetches relationships upfront, avoiding the N+1 query problem where you execute one query per related record:

```typescript title="app/controllers/posts_controller.ts"
import Post from '#models/post'
import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async index({ response }: HttpContext) {
    /**
     * Preload the user relationship for all posts.
     * This executes two queries total: one for posts, one for all users.
     */
    const posts = await Post.query().preload('user')

    /**
     * Access the related user without additional queries.
     * Each post now has a user property with the loaded data.
     */
    posts.forEach(post => {
      console.log(post.user.email)
    })

    return response.json(posts)
  }
}
```

You can preload multiple relationships and nest them:

```typescript
/**
 * Load user and their profile, plus all comments with their authors.
 * Nested preloads work for any depth of relationships.
 */
const posts = await Post.query()
  .preload('user', (query) => {
    query.preload('profile')
  })
  .preload('comments', (query) => {
    query.preload('author')
  })
```

### Many-to-many relationships

For many-to-many relationships like users belonging to multiple teams:

```typescript title="app/models/user.ts"
import { UsersSchema } from '#database/schema'
import { manyToMany } from '@adonisjs/lucid/orm'
import Team from '#models/team'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

export default class User extends UsersSchema {
  /**
   * Define a many-to-many relationship through a pivot table.
   * Lucid expects a team_user table with user_id and team_id columns.
   */
  @manyToMany(() => Team, {
    pivotColumns: ['role', 'joined_at'],
  })
  declare teams: ManyToMany<typeof Team>
}
```

Attach and detach related records:

```typescript
const user = await User.findOrFail(1)

/**
 * Attach teams with additional pivot data.
 * The pivot table stores the relationship plus extra columns.
 */
await user.related('teams').attach({
  1: { role: 'admin' },
  2: { role: 'member' },
})

/**
 * Sync keeps only specified teams, detaching others.
 * Useful for "save all" style operations.
 */
await user.related('teams').sync([1, 2, 3])
```

For has-one relationships, relationship queries, and advanced patterns like polymorphic relationships, see the [Lucid relationships documentation](https://lucid.adonisjs.com/docs/relationships).

## Serializing models

When returning models from HTTP endpoints, you need to convert them to plain JavaScript objects. Lucid provides powerful serialization that controls which fields appear in the output, transforms data, and handles relationships.

```typescript title="app/controllers/users_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  async show({ params, response }: HttpContext) {
    const user = await User.query()
      .where('id', params.id)
      .preload('posts')
      .firstOrFail()

    /**
     * Serialize the model to a plain object.
     * This automatically excludes sensitive fields and formats dates.
     */
    return response.json(user.serialize({
      fields: {
        omit: ['password', 'rememberMeToken'],
      },
      relations: {
        posts: {
          fields: {
            pick: ['id', 'title', 'createdAt'],
          },
        },
      },
    }))
  }
}
```

Control serialization at the model level using column options:

```typescript title="app/models/user.ts"
import { UsersSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

export default class User extends UsersSchema {
  /**
   * Override password column to exclude from all serialization.
   * Setting serializeAs to null prevents this field from appearing in JSON.
   */
  @column({ serializeAs: null })
  declare password: string

  /**
   * Override firstName column to rename in JSON output.
   * The database column is snake_case but JSON uses camelCase.
   */
  @column({ serializeAs: 'firstName' })
  declare firstName: string
}
```

For custom serialization logic, computed properties, and working with transformers, see the [Lucid serialization documentation](https://lucid.adonisjs.com/docs/serializing-models) and [AdonisJS transformers documentation](https://docs.adonisjs.com/guides/frontend/transformers).

## Model factories

Factories generate fake data for testing and database seeding. Instead of manually creating test records, you define a factory once and generate realistic data on demand.

Create a factory for your model:

```bash
node ace make:factory Post
```

```typescript title="database/factories/post_factory.ts"
import Post from '#models/post'
import Factory from '@adonisjs/lucid/factories'

export const PostFactory = Factory.define(Post, ({ faker }) => {
  /**
   * Define how to generate fake data for each column.
   * Faker provides methods for realistic fake data.
   */
  return {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    status: 'draft',
  }
}).build()
```

Use factories in tests or seeders:

```typescript
import { PostFactory } from '#database/factories/post_factory'

/**
 * Create a single post with fake data.
 * The factory generates random values for each field.
 */
const post = await PostFactory.create()

/**
 * Create multiple posts at once.
 * This generates 10 posts with unique fake data.
 */
const posts = await PostFactory.createMany(10)

/**
 * Override specific attributes while using fake data for others.
 * Useful when you need specific values for testing.
 */
const publishedPost = await PostFactory
  .merge({ status: 'published' })
  .create()
```

Factories support states for common variations:

```typescript title="database/factories/post_factory.ts"
export const PostFactory = Factory.define(Post, ({ faker }) => {
  return {
    title: faker.lorem.sentence(),
    content: faker.lorem.paragraphs(3),
    status: 'draft',
  }
})
  .state('published', (post) => {
    post.status = 'published'
    post.publishedAt = new Date()
  })
  .build()
```

```typescript
/**
 * Create published posts using the state.
 * States provide reusable variations of your factory.
 */
const publishedPosts = await PostFactory
  .apply('published')
  .createMany(5)
```

For relationship factories, stubbing database calls in tests, and advanced factory patterns, see the [Lucid factories documentation](https://lucid.adonisjs.com/docs/model-factories).

## Next steps

This guide covered the essential features of Lucid ORM to help you understand how the pieces fit together. You've learned how to configure database connections, create migrations, define models with auto-generated schemas, perform CRUD operations, work with relationships, and generate test data with factories.

For deeper knowledge on any topic, refer to the comprehensive [Lucid documentation](https://lucid.adonisjs.com), which covers advanced query builder methods, relationship customization, query scopes, soft deletes, custom naming strategies, and much more.

You might also want to explore:
- [Database validation rules](https://lucid.adonisjs.com/docs/validation) for validating unique and existing values
- [Query scopes](https://lucid.adonisjs.com/docs/model-query-scopes) for reusable query constraints
- [Custom column types](https://lucid.adonisjs.com/docs/schema-classes#customizing-types-with-schema-rules) for handling special data formats
- [Redis integration](https://docs.adonisjs.com/guides/database/redis) for caching model queries
