---
description: Learn how to tag sessions with a user ID to list a user's active sessions and log them out from other devices.
---

# Session tagging

This guide covers session tagging in AdonisJS. You will learn how to:

- Tag a session with the ID of the logged-in user
- List the active sessions of a user
- Log a user out from their other devices
- Understand how each store saves the tags

## Overview

A session is identified by a random ID stored in a cookie. By default, nothing links a session to the user who owns it, so you cannot answer questions like "on which devices is this user logged in?" or "log this user out everywhere else".

Session tagging adds this link. You tag a session with a user ID when the user logs in, and later you can query all the sessions tagged with that ID and destroy any of them. The typical use case is to log a user out from their other devices after they change their password, or to show a list of active sessions on their account page.

Tagging is available since `@adonisjs/session` 8.0 and works through two APIs:

- The `session.tag()` and `session.untag()` methods on the session of the current HTTP request.
- The `SessionCollection` class, which reads, tags, and destroys any session by its ID, outside of the current request.

## Supported stores

Only the `memory`, `redis`, and `database` stores support tagging. The `cookie`, `file`, and `dynamodb` stores cannot query sessions by user, and every tagging method throws the `E_SESSION_TAGGING_NOT_SUPPORTED` exception when you use one of them.

The `database` store saves the tag in the `user_id` column of the sessions table. The migration created by the `node ace make:session-table` command already defines this column.

```ts title="database/migrations/TIMESTAMP_create_sessions_table.ts"
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.string('user_id').nullable().index() // [!code highlight]
      table.timestamp('expires_at').notNullable().index()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

If your application switches stores per environment (for example, `cookie` in development and `redis` in production), use `supportsTagging()` to skip tagging when the configured store does not support it.

```ts title="app/controllers/session_controller.ts"
if (session.supportsTagging()) {
  await session.tag(String(user.id))
}
```

## Tagging a session at login

Tag the session right after logging the user in. The session guard regenerates the session ID during `login()` to prevent session fixation, so a tag applied before `login()` would be attached to the old ID, which is destroyed at the end of the request.

Tags are strings, so convert numeric user IDs with `String()`. The same conversion must be used when you query the sessions later.

```ts title="app/controllers/session_controller.ts"
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async store({ request, auth, session, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])
    const user = await User.verifyCredentials(email, password)

    await auth.use('web').login(user)

    /**
     * Tag the new session ID created by login()
     */
    await session.tag(String(user.id))

    /**
     * Optional: store details to display in the list
     * of active sessions
     */
    session.put('device', {
      userAgent: request.header('user-agent'),
      ip: request.ip(),
      loggedInAt: new Date().toISOString(),
    })

    return response.redirect('/dashboard')
  }
}
```

With the `database` and `memory` stores, a session holds one tag at a time, and tagging it again with another user ID replaces the previous tag. The `redis` store adds the session to the new user's sessions without removing it from the previous user's, so call `session.untag()` with the previous user ID before tagging the session for another user.

### Untagging a session at logout

The session guard's `logout()` method removes the user from the session but keeps the session ID and the rest of its data. Call `session.untag()` so the session no longer appears in the user's active sessions.

```ts title="app/controllers/session_controller.ts"
import type { HttpContext } from '@adonisjs/core/http'

export default class SessionController {
  async destroy({ auth, session, response }: HttpContext) {
    const user = auth.getUserOrFail()

    await session.untag(String(user.id))
    await auth.use('web').logout()

    return response.redirect('/login')
  }
}
```

### Sessions restored by remember me tokens

When a session expires and the user has a [remember me token](../auth/session_guard.md#remember-me), the session guard creates a new session without going through your login controller. This new session is not tagged. Tag it from a listener of the `session_auth:authentication_succeeded` event, which receives the token when the user was authenticated with it.

Listeners live in the `start/events.ts` preload file. If your application does not have it yet, create it with the following command, which also registers it in `adonisrc.ts`. See the [emitter guide](../digging_deeper/emitter.md) for more details.

```sh
node ace make:preload events --register
```

```ts title="start/events.ts"
import emitter from '@adonisjs/core/services/emitter'

emitter.on('session_auth:authentication_succeeded', async ({ ctx, user, rememberMeToken }) => {
  /**
   * Only sessions recreated from a remember me token
   * need a new tag
   */
  if (rememberMeToken) {
    await ctx.session.tag(String(user.id))
  }
})
```

## Managing sessions with the SessionCollection

The `SessionCollection` class manages sessions by their ID, without an HTTP request for them. It is registered as a singleton in the container, so you can inject it into controllers and services, or resolve it with `app.container.make(SessionCollection)` in commands and jobs.

::::options

:::option{name="tagged(userId)" dataType="Promise<TaggedSession[]>"}

Returns the sessions tagged with the user ID. Each item has the session `id` and its `data`. Expired sessions are not returned.

:::

:::option{name="get(sessionId)" dataType="Promise<SessionData | null>"}

Returns the data of a session, or `null` when the session does not exist.

:::

:::option{name="destroy(sessionId)" dataType="Promise<void>"}

Deletes a session from the store. The next request made with this session ID starts a new, empty session.

:::

:::option{name="tag(sessionId, userId)" dataType="Promise<void>"}

Tags an existing session with a user ID. A session that has no data in the store is never returned by `tagged()`, so use `session.tag()` during the request that creates the session instead.

:::

:::option{name="supportsTagging()" dataType="boolean"}

Returns `true` when the configured store supports tagging. `tag()` and `tagged()` throw the `E_SESSION_TAGGING_NOT_SUPPORTED` exception otherwise. `get()` and `destroy()` work with every store except `cookie`, whose data lives in the browser and can only be read during the request that sends it.

:::

::::

### Listing active sessions

The following controller lists the sessions of the logged-in user and marks the session of the current request. It returns the details stored at login instead of the session IDs, since a session ID gives access to the session and should not be sent to the browser.

```ts title="app/controllers/active_sessions_controller.ts"
import { inject } from '@adonisjs/core'
import { SessionCollection } from '@adonisjs/session'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class ActiveSessionsController {
  constructor(protected sessionCollection: SessionCollection) {}

  async index({ auth, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const sessions = await this.sessionCollection.tagged(String(user.id))

    return sessions.map((taggedSession) => ({
      device: taggedSession.data.device,
      isCurrent: taggedSession.id === session.sessionId,
    }))
  }
}
```

### Logging out from other devices

After a password change, destroy every session of the user except the current one, so a stolen session cannot be used anymore. A destroyed session loses the authenticated user, and the next request from that device is treated as a guest.

If your application uses [remember me tokens](../auth/session_guard.md#remember-me), they can log the user back in on those devices, so delete them as well. This also deletes the token of the current device, which keeps its session but has to log in again once that session expires. Skip this step otherwise, since `User.rememberMeTokens` only exists once you [configure the token provider](../auth/session_guard.md#configuring-the-token-provider).

```ts title="app/controllers/password_controller.ts"
import User from '#models/user'
import { inject } from '@adonisjs/core'
import { SessionCollection } from '@adonisjs/session'
import type { HttpContext } from '@adonisjs/core/http'
import { updatePasswordValidator } from '#validators/password'

@inject()
export default class PasswordController {
  constructor(protected sessionCollection: SessionCollection) {}

  async update({ auth, request, session, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { password } = await request.validateUsing(updatePasswordValidator)

    user.password = password
    await user.save()

    /**
     * Destroy all the sessions of the user, except
     * the one making this request
     */
    const sessions = await this.sessionCollection.tagged(String(user.id))
    for (const taggedSession of sessions) {
      if (taggedSession.id !== session.sessionId) {
        await this.sessionCollection.destroy(taggedSession.id)
      }
    }

    /**
     * Prevent remember me tokens from creating new sessions.
     * Only needed when remember me tokens are enabled.
     */
    const tokens = await User.rememberMeTokens.all(user)
    for (const token of tokens) {
      await User.rememberMeTokens.delete(user, token.identifier)
    }

    session.flash('success', 'Password updated. Your other devices have been logged out.')
    return response.redirect().back()
  }
}
```

## How tags are stored

This section is useful when you inspect the store directly or write a custom store.

The `redis` store keeps a set named `session_tag:<userId>` that holds the IDs of the user's sessions. The `tagged()` method removes the IDs of expired or deleted sessions from this set when it reads it. The `database` store saves the user ID in the `user_id` column of the session row. The `memory` store keeps the tags in memory and is meant for tests.

When `session.tag()` is called during the request that creates the session, the session has no data in the store yet. The store remembers the tag, and writing the session at the end of the request also saves the tag:

- With `redis`, the session data and the set entry are written in the same transaction. On Redis Cluster, a transaction cannot span keys from different slots, so the session ID is added to the set right after the data is written. A concurrent `tagged()` call can read the set before the data exists and remove the session ID after it was added. The session then stays out of the user's sessions until it is tagged again.
- With `database`, the `user_id` column is written in the same query as the session data. `tag()` does not create a row for a session that has no data.

:::note
This behavior is available since `@adonisjs/session` 8.2. Earlier versions added the session to the user's sessions as soon as `tag()` was called, and the `database` store created a row for a session without data.
:::

### Supporting tags in a custom store

A [custom session store](./session.md#creating-custom-session-stores) supports tagging when it implements the `SessionStoreWithTaggingContract` interface from `@adonisjs/session/types`. This interface adds three methods to the base store contract:

- `tag(sessionId, userId)` associates the session with the user ID.
- `untag(sessionId, userId)` removes this association.
- `tagged(userId)` returns the sessions associated with the user ID, as an array of `{ id, data }` objects. It must only return sessions that have not expired.

The [memory](https://github.com/adonisjs/session/blob/8.x/src/stores/memory.ts), [redis](https://github.com/adonisjs/session/blob/8.x/src/stores/redis.ts), and [database](https://github.com/adonisjs/session/blob/8.x/src/stores/database.ts) stores are complete implementations you can use as a reference.
