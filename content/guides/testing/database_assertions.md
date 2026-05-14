---
description: Learn how to assert database state in your AdonisJS tests using Lucid's database assertions plugin.
---

# Database assertions

This guide covers asserting database state in your AdonisJS tests. You will learn how to:

- Configure the database assertions plugin
- Assert that rows exist or are missing in a table
- Check row counts and empty tables
- Verify model instances exist or have been deleted

## Overview

When testing features that modify the database, you often need to verify the resulting state: was the row created? Was it deleted? Are there exactly the right number of records? Lucid provides a Japa plugin that adds database assertion methods directly to the test context, so you can verify database state without writing raw queries.

The plugin exposes a `db` object on the test context with methods like `assertHas`, `assertMissing`, `assertCount`, and model-level assertions. Each method queries the database and throws an `AssertionError` with a clear message when the assertion fails.

## Setup

Register the `dbAssertions` plugin in your `tests/bootstrap.ts` file.

```ts title="tests/bootstrap.ts"
import app from '@adonisjs/core/services/app'
// [!code highlight]
import { dbAssertions } from '@adonisjs/lucid/plugins/db'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  apiClient(),
  // [!code highlight]
  dbAssertions(app),
]
```

Once registered, the `db` property is available on the test context. You access it by destructuring the callback argument in your tests.

```ts title="tests/functional/users.spec.ts"
import { test } from '@japa/runner'

test('creates a user', async ({ db }) => {
  // Use db.assertHas, db.assertMissing, etc.
})
```

## Asserting rows exist

The `assertHas` method checks that at least one row in a table matches the given data. Pass a table name and an object of column/value pairs to match against.

```ts title="tests/functional/users.spec.ts"
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Users', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('registers a new user', async ({ client, db }) => {
    await client.post('/register').json({
      email: 'jul@test.com',
      password: 'secret123',
    })

    // Passes if at least one row matches
    await db.assertHas('users', { email: 'jul@test.com' })
  })
})
```

You can pass an optional third argument to assert an exact number of matching rows.

```ts title="tests/functional/users.spec.ts"
test('promotes multiple users to admin', async ({ client, db }) => {
  await User.createMany([
    { email: 'a@test.com', password: 's', role: 'user' },
    { email: 'b@test.com', password: 's', role: 'user' },
  ])

  await client.post('/admin/promote-all')

  // Passes only if exactly 2 rows match
  await db.assertHas('users', { role: 'admin' }, 2)
})
```

## Asserting rows are missing

The `assertMissing` method is the inverse of `assertHas`. It verifies that no rows in the table match the given data.

```ts title="tests/functional/users.spec.ts"
test('deletes inactive users', async ({ client, db }) => {
  await User.create({ email: 'old@test.com', password: 's', active: false })

  await client.post('/admin/cleanup')

  await db.assertMissing('users', { active: false })
})
```

## Asserting row counts

The `assertCount` method checks the total number of rows in a table, regardless of their content.

```ts title="tests/functional/users.spec.ts"
test('seeds default users', async ({ client, db }) => {
  await client.post('/setup/seed')

  await db.assertCount('users', 5)
})
```

The `assertEmpty` method is a shorthand for `assertCount(table, 0)`. It verifies that a table has no rows at all.

```ts title="tests/functional/tokens.spec.ts"
test('clears all expired tokens', async ({ client, db }) => {
  await client.post('/admin/clear-tokens')

  await db.assertEmpty('auth_access_tokens')
})
```

## Asserting model existence

When working with Lucid models, you can assert directly on model instances instead of writing table-level queries. The `assertModelExists` method checks that the model's primary key still exists in the database.

```ts title="tests/functional/users.spec.ts"
import User from '#models/user'

test('creates a user record', async ({ client, db }) => {
  await client.post('/register').json({
    email: 'jul@test.com',
    password: 'secret123',
  })

  const user = await User.findByOrFail('email', 'jul@test.com')
  await db.assertModelExists(user)
})
```

The `assertModelMissing` method verifies that the model instance no longer exists in the database. This is useful for testing deletion operations.

```ts title="tests/functional/users.spec.ts"
test('deletes a user', async ({ client, db }) => {
  const user = await User.create({
    email: 'jul@test.com',
    password: 'secret123',
  })

  await client.delete(`/users/${user.id}`)

  await db.assertModelMissing(user)
})
```

## Assertions reference

| Method | Description |
|--------|-------------|
| `assertHas(table, data, count?)` | Verifies rows matching `data` exist. When `count` is provided, checks the exact number of matches. |
| `assertMissing(table, data)` | Verifies no rows match `data`. |
| `assertCount(table, count)` | Verifies the table has exactly `count` total rows. |
| `assertEmpty(table)` | Verifies the table has no rows. Shorthand for `assertCount(table, 0)`. |
| `assertModelExists(model)` | Verifies the model instance exists in the database by primary key. |
| `assertModelMissing(model)` | Verifies the model instance does not exist in the database. |
