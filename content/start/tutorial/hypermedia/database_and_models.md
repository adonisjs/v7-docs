# Database and Models

In this chapter, you will create models and migrations for the Post and Comment resources, establish relationships between them, generate dummy data using factories and seeders, and query your data using the REPL.

:::note
This chapter introduces several database concepts at once.  Don't worry if you don't fully understand everything - the goal is to learn by doing and get something working. Deeper understanding will come with practice.
:::

## Overview

This chapter introduces [Lucid, AdonisJS's SQL ORM](https://lucid.adonisjs.com). Instead of writing raw SQL queries, you'll work with JavaScript classes called **models** that represent your database tables. Throughout this chapter and the rest of the tutorial, you'll interact with your database exclusively through models.

**An important distinction**: models define how you interact with data, but they don't modify the database structure. That's the job of migrations, which create and alter tables. You'll use both as you build DevShow's database structure.

## Creating the Post model

Our app needs posts, so let's create a Post model and its corresponding database migration. In AdonisJS, you create one model per database table.

::::steps
:::step{title="Generate the model and migration"}

Run this command to create both the model and the migration together. The `-m` flag tells Ace to create a migration file alongside the model.

```bash
node ace make:model Post -m
```

```bash
DONE:    create app/models/post.ts
DONE:    create database/migrations/1763866156451_create_posts_table.ts
```

:::

:::step{title="Understanding the generated model"}

Let's look at what was generated in the model file.

```ts title="app/models/post.ts"
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Post extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

- The model extends `BaseModel` and uses decorators to define columns. 
- The `@column` decorator tells Lucid that a property maps to a database column. 

Also, notice it already includes `id`, `createdAt`, and `updatedAt` - these are common for most models and come pre-configured.

:::

:::step{title="Add fields to the Post model"}

Now let's add the `title`, `url` and `summary` columns our posts need. Make sure to use the `@column` decorator as it's needed to map a model property to a database column.

```ts title="app/models/post.ts"
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Post extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  // [!code ++:8]
  @column()
  declare title: string

  @column()
  declare url: string

  @column()
  declare summary: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

:::

:::step{title="Define the table structure in the migration"}

Since, models do not modify the database schema. We must use the migration file to create the `posts` table.

```ts title="database/migrations/1763866156451_create_posts_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'posts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // [!code ++:3]
      table.string('title').notNullable()
      table.string('url').notNullable()
      table.text('summary').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

A few important things about migrations:

- The `up` method runs when you execute the migration and creates the table.
- The `down` method runs when you roll back the migration and drops the table. 
- Notice that column names in the database use `snake_case` (like `created_at`), while your model properties use `camelCase` (like `createdAt`). Lucid handles this conversion automatically.

:::

::::

## Creating the Comment model

Let's create the Comment model following the same process we used for posts.

::::steps
:::step{title="Generate the model and migration"}

One more time, we will create the model and the migration together.

```bash
node ace make:model Comment -m
```

```bash
DONE:    create app/models/comment.ts
DONE:    create database/migrations/1763866347711_create_comments_table.ts
```

:::

:::step{title="Add fields to the Comment model"}

The generated Comment model needs a `content` field to store the comment text.

```ts title="app/models/comment.ts"
import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Comment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  // [!code ++:2]
  @column()
  declare content: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

:::

:::step{title="Define the table structure in the migration"}

Now update the migration to create the comments table with the content column.

```ts title="database/migrations/1763866347711_create_comments_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'comments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // [!code ++:1]
      table.text('content').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

:::
::::

## Running migrations

Now that we have both the migrations in place, we can go ahead and create the actual database tables by executing these migration. Run the following command for the that.

```bash
node ace migration:run
```

You'll see output showing which migrations were executed.

```bash
❯ migrated database/migrations/1763866156451_create_posts_table
❯ migrated database/migrations/1763866347711_create_comments_table
```

Your database now has `posts` and `comments` tables! Migrations are tracked in a special `adonis_schema` table in your database. Once a migration runs successfully, it won't run again even if you execute `node ace migration:run` multiple times.

## Adding relationships

Right now our posts and comments exist independently, but in our DevShow web-app, comments belong to posts and posts belong to users. We need to establish these connections in our database and models.

To create these relationships, we need foreign key columns in our tables. A foreign key is a column that references the primary key of another table. For example, a `post_id` column in the comments table will reference the `id` column in the posts table, linking each comment to its post.

Since our tables already exist, we'll create a new migration to add these foreign key columns.

::::steps

:::step{title="Create a migration for foreign keys"}

The following command will create a new migration file that will modify our existing tables.


```bash
node ace make:migration add_foreign_keys_to_posts_and_comments
```

:::

:::step{title="Add foreign key columns"}

Update the migration file to add the foreign key columns.

```ts title="database/migrations/1732089800000_add_foreign_keys_to_posts_and_comments.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    /**
     * Add user_id to posts table
     */
    this.schema.alterTable('posts', (table) => {
      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('users.id').onDelete('CASCADE')
    })

    /**
     * Add user_id and post_id to comments table
     */
    this.schema.alterTable('comments', (table) => {
      table.integer('user_id').unsigned().notNullable()
      table.foreign('user_id').references('users.id').onDelete('CASCADE')

      table.integer('post_id').unsigned().notNullable()
      table.foreign('post_id').references('posts.id').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.alterTable('posts', (table) => {
      table.dropForeign(['user_id'])
      table.dropColumn('user_id')
    })

    this.schema.alterTable('comments', (table) => {
      table.dropForeign(['user_id'])
      table.dropForeign(['post_id'])
      table.dropColumn('user_id')
      table.dropColumn('post_id')
    })
  }
}
```

A few things to understand about this migration:

- We're using `alterTable` instead of `createTable` because we're modifying existing tables.
- The foreign key constraints help maintain data integrity by ensuring that a `user_id` or `post_id` always references a valid record in the respective table.
- The `onDelete('CASCADE')` means if a user or post is deleted, their comments are automatically deleted too.

:::

:::step{title="Run migration"}

```bash
node ace migration:run
```

```bash
❯ migrated database/migrations/1732089800000_add_foreign_keys_to_posts_and_comments
```

:::

:::step{title="Define relationships in the Post model"}

Now that the database has the foreign key columns, let's update our models to define these relationships.

Lucid supports all standard relationships like **One to one**, **One to many**, and **Many to many** and provide several helper methods to read and persist related data.

```ts title="app/models/post.ts"
import { DateTime } from 'luxon'
// [!code ++:4]
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Comment from '#models/comment'
import User from '#models/user'

export default class Post extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare url: string

  @column()
  declare summary: string

  // [!code ++:2]
  @column()
  declare userId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // [!code ++:11]
  /**
   * A post has many comments
   */
  @hasMany(() => Comment)
  declare comments: HasMany<typeof Comment>

  /**
   * A post belongs to a user
   */
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

- The `@hasMany` decorator defines a one-to-many relationship between post and comments. 
- The `@belongsTo` decorator defines a one-to-one relationship between a post and a user.

:::

:::step{title="Define relationships in the Comment model"}

A comment has a one-to-one relationship with both the post and the user. Therefore, we will define those relationships using the `@belongsTo` decorator.

```ts title="app/models/comment.ts"
import { DateTime } from 'luxon'
// [!code ++:4]
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Post from '#models/post'
import User from '#models/user'

export default class Comment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare content: string

  // [!code ++:5]
  @column()
  declare userId: number

  @column()
  declare postId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // [!code ++:11]
  /**
   * A comment belongs to a post
   */
  @belongsTo(() => Post)
  declare post: BelongsTo<typeof Post>

  /**
   * A comment belongs to a user
   */
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

:::
::::

Perfect! Our models now understand their relationships. When you load a post, you can easily access its comments through `post.comments`, and when you load a comment, you can access its post through `comment.post` and its user through `comment.user`.

## Creating factories

Now that our models and database tables are ready, we need to populate them with dummy data for development and testing. Factories act as blueprints for creating model instances filled with realistic fake data. You define the blueprint once, then generate as many instances as you need with a single line of code.

AdonisJS factories use a library called [Faker](https://fakerjs.dev/) to generate realistic data like names, URLs, paragraphs of text, and more. This makes your dummy data look authentic rather than obvious test placeholders.

::::steps
:::step{title="Create the Post factory"}

Run the following command to create a new factory file where we'll define how to generate dummy Post data.

```bash
node ace make:factory Post
```
```bash
DONE:    create database/factories/post_factory.ts
```

:::

:::step{title="Define the Post factory data"}

Open the factory file and configure what data to generate for each Post.

```ts title="database/factories/post_factory.ts"
import factory from '@adonisjs/lucid/factories'
import Post from '#models/post'

export const PostFactory = factory
  .define(Post, async ({ faker }) => {
    return {
      title: faker.helpers.arrayElement([
        'My First iOS Weather App',
        'Personal Portfolio Website with Dark Mode',
        'Real-time Chat Application',
        'Expense Tracker Progressive Web App',
        'Markdown Blog Engine',
        'Recipe Finder with AI Recommendations',
        '2D Platformer Game in JavaScript',
        'Task Management Dashboard',
        'URL Shortener with Analytics',
        'Fitness Tracking Mobile App',
      ]),
      url: faker.internet.url(),
      summary: faker.lorem.paragraphs(3),
    }
  })
  .build()
```

- The callback provided to the `factory.define` method is executed everytime we ask the factory to create a new post for us.
- The `faker.helpers.arrayElement()` picks a random title from the array.
- The `faker.internet.url()` generates a realistic URL.
- The `faker.lorem.paragraphs(3)` creates three paragraphs of placeholder text.

:::

:::step{title="Create the Comment factory"}

Now let's create a factory for comments using the same process.

```bash
node ace make:factory Comment
```
```bash
DONE:    create database/factories/comment_factory.ts
```

:::

:::step{title="Define the Comment factory data"}

The Comment factory is simpler - it only needs to generate the `content` field using `faker.lorem.paragraph()`, which creates a single paragraph of text.

```ts title="database/factories/comment_factory.ts"
import factory from '@adonisjs/lucid/factories'
import Comment from '#models/comment'

export const CommentFactory = factory
  .define(Comment, async ({ faker }) => {
    return {
      content: faker.lorem.paragraph(),
    }
  })
  .build()
```

:::
::::

## Creating seeders

Factories define HOW to create fake data, but they don't actually create it automatically. That's where seeders come in - they're scripts that use factories to populate your database with actual data. 

Every time you reset your database or a teammate clones the project, running `node ace db:seed` populates the database with consistent, realistic data.

::::steps
:::step{title="Create the seeder"}

Let's create a seeder that will generate posts and comments.

```bash
node ace make:seeder PostSeeder
```
```bash
DONE:    create database/seeders/post_seeder.ts
```

:::


:::step{title="Implement the seeding logic"}

Now open the seeder file and add the logic to create posts with comments.

```ts title="database/seeders/post_seeder.ts"
import User from '#models/user'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { PostFactory } from '#database/factories/post_factory'
import { CommentFactory } from '#database/factories/comment_factory'

export default class extends BaseSeeder {
  async run() {
    const user = await User.findByOrFail('email', 'jane@example.com')

    /**
     * Creating 10 posts using the PostFactory
     */
    const posts = await PostFactory
      .merge({ userId: user.id })
      .createMany(10)

    /**
     * Looping over every post to create between 3-5 dummy
     * comments
     */
    for (const post of posts) {
      await CommentFactory
        .merge({ postId: post.id, userId: user.id })
        .createMany(Math.floor(Math.random() * 3) + 3)
    }
  }
}
```

Let's break down what this seeder does:

First, we fetch the user with email `jane@example.com`. This is the user we created in the previous chapter when exploring the CLI and REPL. If you followed along, this user should exist in your database. The `findByOrFail` method will throw an error if the user doesn't exist.

Next, we use the `PostFactory` to create 10 posts. The `merge()` method is important here - it merges additional data with the factory's generated values. We need this to set the `userId` foreign key on each post. Without it, the foreign key constraint would fail because `userId` would be undefined.

Then, for each post, we create between 3 to 5 comments using a similar approach. The formula `Math.floor(Math.random() * 3) + 3` generates a random number between 3 and 5.

:::

:::step{title="Run the seeder"}

Now execute the seeder to populate your database.

```bash
node ace db:seed
```
```bash
❯ running PostSeeder
```

Your database now has 10 posts, each with several comments!

:::
::::

## A quick recap

Before we move on to querying data, let's take a moment to understand what we've built. AdonisJS provides dedicated tools for working with databases, and each one has a specific purpose.

**Migrations** define your database structure. They create tables, add columns, and establish constraints. Think of them as instructions that transform your database schema. When you run `node ace migration:run`, these instructions execute and modify your database structure.

**Models** are your JavaScript interface to database tables. They provide a clean, type-safe API for querying and manipulating data without writing raw SQL. Models also define relationships between tables - like how posts relate to comments - making it easy to work with connected data.

**Factories** generate realistic dummy data for your models. Instead of manually creating test data over and over, you define a blueprint once, and the factory creates as many realistic instances as you need. This is invaluable during development and testing.

**Seeders** are scripts that populate your database with data. They typically use factories to generate data, but can also create specific records or import data from other sources. Running `node ace db:seed` executes all your seeders and gives you a consistent database state.

## Querying data with the REPL

Now that we have data in our database, let's explore it using AdonisJS's REPL (Read-Eval-Print Loop). The REPL is an interactive shell where you can run JavaScript code and interact with your models in real-time.

### Start the REPL and load models

First, start the REPL:
```bash
node ace repl
```

Once the REPL starts, load all your models. This makes all your models available under the `models` object.

```ts
await loadModels()

// models.post
// models.comment
```

### Fetch all posts

Let's fetch all posts from the database.

```ts
await models.post.all()
```

You'll see an array of all 10 posts with their data. Each post is a Post model instance, not a plain JavaScript object.

```ts
[
  Post {
    id: 1,
    title: 'My First iOS Weather App',
    url: 'https://example.com/fp',
    summary: 'Lorem ipsum dolor sit amet...',
    userId: 1,
    createdAt: DateTime { ... },
    updatedAt: DateTime { ... }
  },
  // ... 9 more posts
]
```

### Search posts by title

Let's search for posts containing "Task Management" in the title using the `query()` method.

```ts
await models.post.query().where('title', 'like', '%Task Management%')
```

The `query()` method returns a chainable query builder built on top of Knex, giving you powerful SQL query capabilities while staying in JavaScript. You'll see an array of matching posts, which might be just one or zero depending on what the factory generated.

### Fetch a post and load its comments

Now let's demonstrate how to work with relationships. First, fetch a specific post by its ID.

```ts
const post = await models.post.find(1)
```

The post is loaded, but its comments aren't loaded yet - relationships are lazy-loaded by default. To load the comments relationship, you must use the `load` method.

```ts
await post.load('comments')
```

Once the comments have been loaded, they will be set as a property on the `post` instance and you can access them as follows.

```ts
post.comments
```

### Load comments alongside the post

Instead of loading comments after fetching the post, you can fetch them together using the `preload` method on the query builder. 

```ts
const postWithComments = await models.post.query().preload('comments').first()
```

This fetches the first post and its comments in a single operation. The `preload` method is more efficient than loading relationships separately because it avoids the N+1 query problem - instead of making one query for the post and then one query per comment, it makes just two queries total.

### Exit the REPL

When you're done exploring, type `.exit` to leave the REPL and return to your terminal.

## What you learned

You now know how to:

- Create models and migrations using the Ace CLI
- Define column properties on models using decorators
- Create database tables and modify them with migrations
- Define relationships between models using `hasMany` and `belongsTo`
- Generate dummy data with factories and seeders
- Query data using the REPL and model methods
- Use the query builder for complex queries
- Load relationships with `load()` and `preload()`
