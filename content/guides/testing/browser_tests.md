---
description: Learn how to write end-to-end browser tests for hypermedia and Inertia applications using Playwright.
---

# Browser tests

This guide covers end-to-end browser testing for hypermedia and Inertia applications. You will learn how to:

- Configure browser testing plugins in your test suite
- Control test execution via CLI options (browsers, headed mode, traces, slow motion)
- Write basic page visit tests with assertions
- Reset database state between tests
- Fill and submit forms using Playwright selectors
- Use recording mode to generate test code quickly
- Authenticate users before visiting protected pages

## Overview

Browser tests verify your application from the outside-in, navigating it exactly as a real user would. Unlike unit tests that examine isolated pieces of code, browser tests exercise the entire stack: routes, controllers, views, database queries, and client-side interactions all working together.

For hypermedia and Inertia applications, browser tests should form the majority of your test suite. These applications are inherently about user interactions with rendered pages, and browser tests capture this reality directly. When a browser test passes, you have high confidence that the feature actually works for users. When it fails, you've caught a bug that users would have encountered.

This approach may feel different if you're accustomed to the "testing pyramid" where unit tests dominate. For server-rendered applications, inverting this pyramid makes sense: browser tests provide more value per test because they verify complete user flows rather than implementation details.

## Setup

Browser testing requires three plugins configured in your `tests/bootstrap.ts` file. These are already installed and configured with the official Hypermedia and Inertia starter kits.

```ts title="tests/bootstrap.ts"
import { assert } from '@japa/assert'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
// [!code highlight:3]
import { browserClient } from '@japa/browser-client'
import { authBrowserClient } from '@adonisjs/auth/plugins/browser_client'
import { sessionBrowserClient } from '@adonisjs/session/plugins/browser_client'

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),

  // [!code highlight:17]
  /**
   * Configures Playwright and creates a fresh browser
   * context before every test.
   */
  browserClient({ runInSuites: ['browser'] }),

  /**
   * Allows reading and writing session data
   * via the browser context.
   */
  sessionBrowserClient(app),

  /**
   * Enables the loginAs method for authenticating
   * users during tests.
   */
  authBrowserClient(app),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
```

## CLI options

Playwright behavior is controlled through command-line flags when running tests. The following options help with debugging and cross-browser verification.

::::options

:::option{name="--browser"}
Run tests in a specific browser. Supported values are `chromium`, `firefox`, and `webkit`.

```bash
node ace test --browser=firefox
```
:::

:::option{name="--headed"}
Show the browser window during test execution. By default, tests run in headless mode.

```bash
node ace test --headed
```
:::

:::option{name="--devtools"}
Open browser devtools automatically when the browser launches.

```bash
node ace test --devtools
```
:::

:::option{name="--slow"}
Slow down test actions by the specified number of milliseconds. Useful for visually following what the test is doing.

```bash
node ace test --slow=500
```
:::

:::option{name="--trace"}
Record traces for debugging. Use `onError` to record only when tests fail, or `onTest` to record every test.

```bash
node ace test --trace=onError
```
:::

::::

### Recording traces

Traces capture a complete timeline of your test execution, including screenshots, network requests, and DOM snapshots. Generate traces only when tests fail or for every test.

```bash
# Record traces only when a test fails
node ace test --trace=onError

# Record traces for every test
node ace test --trace=onTest
```

Traces are stored in the `browsers` directory. Replay them using Playwright's trace viewer.

```bash
npx playwright show-trace browsers/path-to-trace.zip
```

### Running specific tests

Run all browser tests or target specific files and folders.

```bash
# Run all browser tests
node ace test browser

# Run tests from a specific folder
node ace test --files="posts/*"
```

## Basic page visits

A browser test visits a page and makes assertions about its content. The `visit` helper opens a URL, and the returned page object provides assertion methods.

```ts title="tests/browser/posts/index.spec.ts"
import { test } from '@japa/runner'

test.group('Posts index', () => {
  test('display list of posts', async ({ visit, route }) => {
    /**
     * Visit the posts index page using its named route.
     * The visit helper returns a Playwright page instance
     * extended with assertion methods.
     */
    const page = await visit(route('posts.index'))

    /**
     * Assert that the body contains specific text.
     * This will wait up to 5 seconds for the text to appear.
     */
    await page.assertTextContains('body', 'My first post')
  })
})
```

This test fails because no posts exist in the database. The failure message indicates the assertion timed out waiting for the expected content.

```sh title="❌ Output of failing test"
ℹ AssertionError: expected 'body' inner text to include 'My first post', timed out after 5000ms

 ⁃ (AssertionError [ERR_ASSERTION]: expected 'body' inner text to include 'My first post':undefined:undefined)
```

## Database state

Tests should start with a known database state. Use the `testUtils.db().truncate()` hook to clear tables after each test, then create the specific records your test needs.

See also: [Database testing utilities](./resetting_state_between_tests.md) for additional methods like migrations and seeders.

```ts title="tests/browser/posts/index.spec.ts"
import Post from '#models/post'
import User from '#models/user'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Posts index', (group) => {
  /**
   * Truncate database tables after each test.
   * This ensures tests don't affect each other.
   */
  group.each.setup(() => testUtils.db().truncate())

  test('display list of posts', async ({ visit, route }) => {
    /**
     * Create the data this test depends on.
     * Each test sets up its own state explicitly.
     */
    const user = await User.create({
      email: 'john@example.com',
      password: 'secret',
    })
    await Post.create({
      title: 'My first post',
      content: 'This is my first post',
      userId: user.id,
    })

    const page = await visit(route('posts.index'))
    await page.assertTextContains('body', 'My first post')
  })
})
```

## Form interactions

Forms are filled using Playwright's locator methods. Select inputs by their label text and use `fill` to enter values, then `click` to submit.

```ts title="tests/browser/session/create.spec.ts"
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('Session create', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('display error when invalid credentials are used', async ({ visit, route }) => {
    const page = await visit(route('session.create'))

    /**
     * Locate inputs by their associated label text.
     * This mirrors how users identify form fields.
     */
    await page.getByLabel('Email').fill('john@example.com')
    await page.getByLabel('Password').fill('secret')

    /**
     * Click the submit button. getByRole finds elements
     * by their ARIA role, making tests resilient to
     * markup changes.
     */
    await page.getByRole('button').click()
  })
})
```

### Recording mode

Writing locators manually requires switching between your browser and test file repeatedly. Recording mode launches a browser where your interactions are converted to test code automatically.

Create a new test file and call the `record` method instead of `visit`. When you run the test, a browser opens where you can interact with your application. Close the browser when finished, and copy the generated code into your test file.

```ts title="tests/browser/posts/create.spec.ts"
import { test } from '@japa/runner'

test.group('Posts create', () => {
  test('create a new post', async ({ record, route }) => {
    /**
     * Opens the browser in recording mode.
     * Test timeout is disabled while recording.
     * Interact with the page, then close the browser
     * to see the generated test code.
     */
    await record(route('posts.create'))
  })
})
```

After recording, replace the `record` call with `visit` and paste the generated locators and actions.

## Authenticating users

Protected pages require an authenticated user. The `browserContext.loginAs` method authenticates a user for all subsequent page visits within that test.

:::warning
The `sessionBrowserClient` plugin writes the test session to the store configured by `SESSION_DRIVER`. The cookie store is the exception: the plugin falls back to the memory store, so authentication fails unless you set `SESSION_DRIVER=memory` in your `.env.test` file. The memory driver is also the fastest option, since it has no file or database overhead.
:::

```ts title="tests/browser/posts/create.spec.ts"
import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('Posts create', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('display error when missing post title or content', async ({
    visit,
    browserContext,
    route,
  }) => {
    const user = await User.create({
      email: 'john@example.com',
      password: 'secret',
    })

    /**
     * Authenticate the user for this browser context.
     * All subsequent page visits will be authenticated.
     */
    await browserContext.loginAs(user)

    const page = await visit(route('posts.create'))
    await page.assertPath('/posts/create')
  })
})
```

## Cookies and sessions

The browser context provides methods to read and write cookies, sessions, and flash messages during tests. These are useful when your application behavior depends on stored state.

### Setting cookies

Three methods are available depending on how the cookie should be stored.

```ts title="tests/browser/preferences.spec.ts"
import { test } from '@japa/runner'

test.group('User preferences', () => {
  test('apply dark mode from cookie', async ({ visit, browserContext, route }) => {
    /**
     * Set an encrypted cookie (default cookie behavior in AdonisJS).
     */
    await browserContext.setCookie('theme', 'dark')

    /**
     * Set a plain cookie without encryption.
     * Useful for cookies that client-side JavaScript needs to read.
     */
    await browserContext.setPlainCookie('locale', 'en-us')

    /**
     * Set an encrypted cookie explicitly.
     * Equivalent to setCookie.
     */
    await browserContext.setEncryptedCookie('preferences', { sidebar: 'collapsed' })

    const page = await visit(route('dashboard'))
    await page.assertVisible('.dark-mode')
  })
})
```

### Reading cookies

Retrieve cookie values after page interactions to verify your application sets them correctly.

```ts title="tests/browser/preferences.spec.ts"
import { test } from '@japa/runner'

test.group('User preferences', () => {
  test('save theme preference to cookie', async ({ visit, browserContext, route }) => {
    const page = await visit(route('settings'))
    await page.getByLabel('Theme').selectOption('dark')
    await page.getByRole('button', { name: 'Save' }).click()

    /**
     * Read cookies after the page interaction.
     */
    const theme = await browserContext.getCookie('theme')
    const locale = await browserContext.getPlainCookie('locale')
    const prefs = await browserContext.getEncryptedCookie('preferences')
  })
})
```

### Setting session data

Pre-populate session data before visiting a page. This is useful when testing features that depend on session state without going through the UI to establish that state.

```ts title="tests/browser/onboarding.spec.ts"
import { test } from '@japa/runner'

test.group('Onboarding', () => {
  test('resume onboarding from step 3', async ({ visit, browserContext, route }) => {
    /**
     * Set session data before visiting the page.
     * The page will read this state and resume accordingly.
     */
    await browserContext.setSession({
      onboarding: { currentStep: 3, completedSteps: [1, 2] }
    })

    const page = await visit(route('onboarding'))
    await page.assertTextContains('h1', 'Step 3')
  })
})
```

### Setting flash messages

Flash messages are session data that persist only for the next request. Set them to test how your UI displays notifications or validation errors.

```ts title="tests/browser/notifications.spec.ts"
import { test } from '@japa/runner'

test.group('Notifications', () => {
  test('display success notification', async ({ visit, browserContext, route }) => {
    await browserContext.setFlashMessages({
      success: 'Your changes have been saved'
    })

    const page = await visit(route('dashboard'))
    await page.assertTextContains('.notification', 'Your changes have been saved')
  })
})
```

### Reading session and flash messages

Verify that your application writes the expected data to the session.

```ts title="tests/browser/cart.spec.ts"
import { test } from '@japa/runner'

test.group('Shopping cart', () => {
  test('add item to cart stored in session', async ({ visit, browserContext, route }) => {
    const page = await visit(route('products.show', { id: 1 }))
    await page.getByRole('button', { name: 'Add to cart' }).click()

    const session = await browserContext.getSession()
    const flashMessages = await browserContext.getFlashMessages()
  })
})
```

## See also

- [Japa browser client](https://japa.dev/docs/plugins/browser-client#switching-between-browsers) for the complete assertions API
- [Playwright locators](https://playwright.dev/docs/locators) for advanced element selection strategies
