---
description: Reference guide for string helper functions available in AdonisJS for common string manipulation tasks.
---

# String helpers

## excerpt

Generate an excerpt from content up to a certain length. If the input contains HTML tags, they will be stripped from the output.

```ts
import string from '@adonisjs/core/helpers/string'

const html = `<p>AdonisJS is a Node.js framework, and hence it requires Node.js to be installed on your computer. To be precise, we need at least the latest release of <code>Node.js v14</code>.</p>`

console.log(string.excerpt(html, 70))
// AdonisJS is a Node.js framework, and hence it requires Node.js to be i...
```

#### OPTIONS

The following is the list of options you may provide as the 3rd parameter.

```ts
string.excerpt(html, 70, {
  completeWords: true,
  suffix: '<a href="">Read more</a>',
})
```

::::options

:::option{name="completeWords"}

When set to `true`, the truncation will occur only after complete words. This option might exceed the defined character limit.

:::

:::option{name="suffix"}

Value to append after the truncated string. Defaults to three dots `...`.

:::

::::

## truncate

Truncate a string value to a certain length. The method is the same as the `excerpt` method, but it does not remove any HTML tags.

```ts
import string from '@adonisjs/core/helpers/string'

const text = `AdonisJS is a Node.js framework, and hence it requires Node.js to be installed on your computer. To be precise, we need at least the latest release of Node.js 14.`

console.log(string.truncate(text, 70))
// AdonisJS is a Node.js framework, and hence it requires Node.js to be i...
```

#### OPTIONS

Following is the list of options you may provide as the 3rd parameter.

```ts
string.truncate(text, 70, {
  completeWords: true,
  suffix: '<a href="">Read more</a>',
})
```

::::options

:::option{name="completeWords"}

When set to `true`, the truncation will occur only after complete words. This option might exceed the defined character limit.

:::

:::option{name="suffix"}

Value to append after the truncated string. Defaults to three dots `...`.

:::

::::

## slug

Generate a slug for a value.

The method is exported directly from the [slugify](https://www.npmjs.com/package/slugify) package. Therefore, please check the package documentation for [available options](https://www.npmjs.com/package/slugify#options).

```ts
import string from '@adonisjs/core/helpers/string'

console.log(string.slug('hello ♥ world'))
// hello-love-world
```

You can define custom replacements for Unicode values as follows.

```ts
import string from '@adonisjs/core/helpers/string'

string.slug.extend({ '☢': 'radioactive' })
console.log(string.slug('unicode ♥ is ☢'))
// unicode-love-is-radioactive
```

## interpolate

Interpolate variables specified inside double curly braces (`{{}}`).

```ts
import string from '@adonisjs/core/helpers/string'

string.interpolate('hello {{ user.username }}', {
  user: { username: 'virk' },
})

// hello virk
```

You may replace array values using the array index.

```ts
import string from '@adonisjs/core/helpers/string'

string.interpolate('hello {{ users.0 }}', { users: ['virk'] })

// hello virk
```

Curly braces can be escaped from interpolation using two backslashes ('\\').

```ts
import string from '@adonisjs/core/helpers/string'

string.interpolate('hello \\{{ users.0 }}', {})

// hello {{ users.0 }}
```

## plural

Convert a word to its plural form. The method is exported directly from the [pluralize](https://www.npmjs.com/package/pluralize) package.

```ts
import string from '@adonisjs/core/helpers/string'

string.plural('test')
// tests
```

## singular

Convert a word to its singular form. The method is exported directly from the [pluralize](https://www.npmjs.com/package/pluralize) package.

```ts
import string from '@adonisjs/core/helpers/string'

string.singular('tests')
// test
```

## pluralize

Convert value to its `plural` or `singular` form based on the count.

```ts
import string from '@adonisjs/core/helpers/string'

let errorsCount = 10
const message = `There ${string.pluralize('is', errorsCount)} ${errorsCount} ${string.pluralize('error', errorsCount)}`
// There are 10 errors

errorsCount = 1
// There is 1 error
```

```ts
// title: More examples
string.pluralize('box', 1) // box
string.pluralize('box', 2) // boxes
string.pluralize('box', 0) // boxes

string.pluralize('boxes', 1) // box
string.pluralize('boxes', 2) // boxes
string.pluralize('boxes', 0) // boxes
```

The `addPluralRule`, `addSingularRule`, `addIrregularRule`, and `addUncountableRule` methods exposed by the pluralize package can be used as follows.

```ts
string.pluralize.addUncountableRule('paper')
string.pluralize.addSingularRule(/singles$/i, 'singular')
```

## isPlural

Find if a word is already in plural form. The method is exported directly from the [pluralize](https://www.npmjs.com/package/pluralize) package.

```ts
import string from '@adonisjs/core/helpers/string'

string.isPlural('tests') // true
```

## isSingular

Find if a word is already in a singular form. The method is exported directly from the [pluralize](https://www.npmjs.com/package/pluralize) package.

```ts
import string from '@adonisjs/core/helpers/string'

string.isSingular('test') // true
```

## camelCase

Convert value to camel case.

```ts
import string from '@adonisjs/core/helpers/string'

string.camelCase('user_name') // userName
```

#### EXAMPLES

| Input            | Output        |
| ---------------- | ------------- |
| 'test'           | 'test'        |
| 'test string'    | 'testString'  |
| 'Test String'    | 'testString'  |
| 'TestV2'         | 'testV2'      |
| '_foo_bar_'      | 'fooBar'      |
| 'version 1.2.10' | 'version1210' |
| 'version 1.21.0' | 'version1210' |

## capitalCase

Convert value to capital case.

```ts
import string from '@adonisjs/core/helpers/string'

string.capitalCase('helloWorld') // Hello World
```

#### EXAMPLES

| Input            | Output           |
| ---------------- | ---------------- |
| 'test'           | 'Test'           |
| 'test string'    | 'Test String'    |
| 'Test String'    | 'Test String'    |
| 'TestV2'         | 'Test V 2'       |
| 'version 1.2.10' | 'Version 1.2.10' |
| 'version 1.21.0' | 'Version 1.21.0' |

## dashCase

Convert value to dash case.

```ts
import string from '@adonisjs/core/helpers/string'

string.dashCase('helloWorld') // hello-world
```

Optionally, you can capitalize the first letter of each word.

```ts
import string from '@adonisjs/core/helpers/string'

string.dashCase('helloWorld', { capitalize: true }) // Hello-World
```

#### EXAMPLES

| Input            | Output         |
| ---------------- | -------------- |
| 'test'           | 'test'         |
| 'test string'    | 'test-string'  |
| 'Test String'    | 'test-string'  |
| 'Test V2'        | 'test-v2'      |
| 'TestV2'         | 'test-v-2'     |
| 'version 1.2.10' | 'version-1210' |
| 'version 1.21.0' | 'version-1210' |

## dotCase

Convert value to dot case.

```ts
import string from '@adonisjs/core/helpers/string'

string.dotCase('helloWorld') // hello.World
```

Optionally, you can also convert the first letter of all the words to lowercase.

```ts
import string from '@adonisjs/core/helpers/string'

string.dotCase('helloWorld', { lowerCase: true }) // hello.world
```

#### EXAMPLES

| Input            | Output         |
| ---------------- | -------------- |
| 'test'           | 'test'         |
| 'test string'    | 'test.string'  |
| 'Test String'    | 'Test.String'  |
| 'dot.case'       | 'dot.case'     |
| 'path/case'      | 'path.case'    |
| 'TestV2'         | 'Test.V.2'     |
| 'version 1.2.10' | 'version.1210' |
| 'version 1.21.0' | 'version.1210' |

## noCase

Remove all sorts of casing from a string value.

```ts
import string from '@adonisjs/core/helpers/string'

string.noCase('helloWorld') // hello world
```

#### EXAMPLES

| Input                  | Output                 |
| ---------------------- | ---------------------- |
| 'test'                 | 'test'                 |
| 'TEST'                 | 'test'                 |
| 'testString'           | 'test string'          |
| 'testString123'        | 'test string123'       |
| 'testString_1_2_3'     | 'test string 1 2 3'    |
| 'ID123String'          | 'id123 string'         |
| 'foo bar123'           | 'foo bar123'           |
| 'a1bStar'              | 'a1b star'             |
| 'CONSTANT_CASE '       | 'constant case'        |
| 'CONST123_FOO'         | 'const123 foo'         |
| 'FOO_bar'              | 'foo bar'              |
| 'XMLHttpRequest'       | 'xml http request'     |
| 'IQueryAArgs'          | 'i query a args'       |
| 'dot.case'             | 'dot case'             |
| 'path/case'            | 'path case'            |
| 'snake_case'           | 'snake case'           |
| 'snake_case123'        | 'snake case123'        |
| 'snake_case_123'       | 'snake case 123'       |
| '"quotes"'             | 'quotes'               |
| 'version 0.45.0'       | 'version 0 45 0'       |
| 'version 0..78..9'     | 'version 0 78 9'       |
| 'version 4_99/4'       | 'version 4 99 4'       |
| ' test '               | 'test'                 |
| 'something_2014_other' | 'something 2014 other' |
| 'amazon s3 data'       | 'amazon s3 data'       |
| 'foo_13_bar'           | 'foo 13 bar'           |

## pascalCase

Convert value to pascal case.

```ts
import string from '@adonisjs/core/helpers/string'

string.pascalCase('user team') // UserTeam
```

#### EXAMPLES

| Input            | Output        |
| ---------------- | ------------- |
| 'test'           | 'Test'        |
| 'test string'    | 'TestString'  |
| 'Test String'    | 'TestString'  |
| 'TestV2'         | 'TestV2'      |
| 'version 1.2.10' | 'Version1210' |
| 'version 1.21.0' | 'Version1210' |

## sentenceCase

Convert value to a sentence.

```ts
import string from '@adonisjs/core/helpers/string'

string.sentenceCase('getting-started-with-adonisjs')
// Getting started with adonisjs
```

#### EXAMPLES

| Input            | Output           |
| ---------------- | ---------------- |
| 'test'           | 'Test'           |
| 'test string'    | 'Test string'    |
| 'Test String'    | 'Test string'    |
| 'TestV2'         | 'Test v2'        |
| 'version 1.2.10' | 'Version 1 2 10' |
| 'version 1.21.0' | 'Version 1 21 0' |

## snakeCase

Convert value to snake case.

```ts
import string from '@adonisjs/core/helpers/string'

string.snakeCase('user team') // user_team
```

#### EXAMPLES

| Input            | Output         |
| ---------------- | -------------- |
| '\_id'           | 'id'           |
| 'test'           | 'test'         |
| 'test string'    | 'test_string'  |
| 'Test String'    | 'test_string'  |
| 'Test V2'        | 'test_v2'      |
| 'TestV2'         | 'test_v_2'     |
| 'version 1.2.10' | 'version_1210' |
| 'version 1.21.0' | 'version_1210' |

## titleCase

Convert value to title case.

```ts
import string from '@adonisjs/core/helpers/string'

string.titleCase('small word ends on')
// Small Word Ends On
```

#### EXAMPLES

| Input                              | Output                             |
| ---------------------------------- | ---------------------------------- |
| 'one. two.'                        | 'One. Two.'                        |
| 'a small word starts'              | 'A Small Word Starts'              |
| 'small word ends on'               | 'Small Word Ends On'               |
| 'we keep NASA capitalized'         | 'We Keep NASA Capitalized'         |
| 'pass camelCase through'           | 'Pass camelCase Through'           |
| 'follow step-by-step instructions' | 'Follow Step-by-Step Instructions' |
| 'this vs. that'                    | 'This vs. That'                    |
| 'this vs that'                     | 'This vs That'                     |
| 'newcastle upon tyne'              | 'Newcastle upon Tyne'              |
| 'newcastle \*upon\* tyne'          | 'Newcastle \*upon\* Tyne'          |

## wordWrap

Wrap words in a sentence after a specific character count. The sentence is always split after a word finishes. Therefore, some lines may exceed or stay smaller than the provided length.

```ts
import string from '@adonisjs/core/helpers/string'

const sentence = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.

It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged.

It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`

const output = string.wordWrap(sentence, { width: 40 })

/**
Lorem Ipsum is simply dummy text of the
printing and typesetting industry. Lorem
Ipsum has been the industry's standard
dummy text ever since the 1500s, when an
unknown printer took a galley of type
and scrambled it to make a type specimen
book.

It has survived not only five centuries,
but also the leap into electronic
typesetting, remaining essentially
unchanged.

It was popularised in the 1960s with the
release of Letraset sheets containing
Lorem Ipsum passages, and more recently
with desktop publishing software like
Aldus PageMaker including versions of
Lorem Ipsum.
*/
```

You may also indent preceding lines with a given character. In the following example, we indent lines with 2 spaces.

```ts
const output = string.wordWrap(sentence, {
  width: 40,
  indent: '  ',
})

/**
Lorem Ipsum is simply dummy text of the
  printing and typesetting industry. Lorem
  Ipsum has been the industry's standard
  dummy text ever since the 1500s, when an
  unknown printer took a galley of type
  and scrambled it to make a type specimen
  book.

  It has survived not only five centuries,
  but also the leap into electronic
  typesetting, remaining essentially
  unchanged.

  It was popularised in the 1960s with the
  release of Letraset sheets containing
  Lorem Ipsum passages, and more recently
  with desktop publishing software like
  Aldus PageMaker including versions of
  Lorem Ipsum.
*/
```

#### OPTIONS

The following options can be specified as the 2nd parameter.

::::options

:::option{name="indent"}

Character(s) to use for indenting text after the first line

:::

:::option{name="width"}

Number of characters after which to split the line

:::

:::option{name="newLine"}

Specify the new line character to use for splitting lines. `default=\n`

:::

:::option{name="escape"}

Specify a function to escape the contents. The method will be once for each line.

:::

::::

## htmlEscape

Escape special characters in a string value, such that it can be used in HTML content. The `"`, `'`, `&`, `<`, and `>` characters are escaped.

```ts
import string from '@adonisjs/core/helpers/string'

string.htmlEscape('&foo <> bar "fizz" l\'a')
// Output: &amp;foo &lt;&gt; bar &quot;fizz&quot; l&#39;a
```

#### EXAMPLES

| Input                                | Output                               |
| ------------------------------------ | ------------------------------------ |
| `htmlEscape('&<>"\'')`               | `'&amp;&lt;&gt;&quot;&#39;'`         |
| `htmlEscape('🦄 & 🐐')`              | `'🦄 &amp; 🐐'`                      |
| `htmlEscape('Hello <em>World</em>')` | `'Hello &lt;em&gt;World&lt;/em&gt;'` |
| `htmlEscape('no escape')`            | `'no escape'`                        |
| `htmlEscape('foo&bar')`              | `'foo&amp;bar'`                      |
| `htmlEscape('<tag>')`                | `'&lt;tag&gt;'`                      |
| `htmlEscape("test=\'foo\'")`         | `'test=&#39;foo&#39;'`               |
| `htmlEscape('test="foo"')`           | `'test=&quot;foo&quot;'`             |
| `htmlEscape('<ta\'&g">')`            | `'&lt;ta&#39;&amp;g&quot;&gt;'`      |
| `htmlEscape('foo<<bar')`             | `'foo&lt;&lt;bar'`                   |

## justify

Justify the text of multiple columns as per the defined max-width. Columns smaller than the provided max width will be padded with empty spaces or the provided `indent` char.

```ts
import string from '@adonisjs/core/helpers/string'

const output = string.justify(['help', 'serve', 'make:controller'], {
  width: 20,
})

/**
[
  'help                ',
  'serve               ',
  'make:controller     ',
]
*/
```

By default, the columns are left-aligned. However, they can also be right-aligned using the `align` option.

```ts
const output = string.justify(['help', 'serve', 'make:controller'], {
  width: 20,
  align: 'right',
})

/**
[
  '                help',
  '               serve',
  '     make:controller',
]
*/
```

If the columns contain ANSI escape sequences, you must specify a custom `getLength` method to compute the column length without counting the ANSI escape sequences.

```ts
import stringWidth from 'string-width'

const output = string.justify(['help', 'serve', 'make:controller'], {
  width: 20,
  align: 'right',
  /**
   * The `string-width` package returns the length of the string
   * without accounting for ANSI escape sequences
   */
  getLength: (chunk) => stringWidth(chunk),
})
```

## random

Generate a cryptographically secure random string of a given length. The output value is a URL-safe base64-encoded string.

```ts
import string from '@adonisjs/core/helpers/string'

string.random(32)
// 8mejfWWbXbry8Rh7u8MW3o-6dxd80Thk
```

You can replace the random generator using the `random.use` method and restore the original implementation using the `random.restore` method.

```ts
// Custom generator
string.random.use((size) => {
  return 'a'.repeat(size)
})

string.random(10) // aaaaaaaaaa

// Restore original implementation
string.random.restore()
```

## uuid

Generate a UUID v4 value. The `uuid` method uses the [crypto.randomUUID](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions) under the hood. However, it does allow you to replace the original implementation with a custom method.

```ts
import string from '@adonisjs/core/helpers/string'

string.uuid()
// 1a7989bf-a176-42fb-97ef-1368f2466027
```

```ts
// Custom generator
string.uuid.use(() => {
  return 'xxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
})

string.uuid() // 'xxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

// Restore original implementation
string.uuid.restore()
```

## toSentence

Convert an array of words to a comma-separated sentence.

```ts
import string from '@adonisjs/core/helpers/string'

string.toSentence(['routes', 'controllers', 'middleware'])
// routes, controllers, and middleware
```

You can replace the `and` with an `or` by specifying the `options.lastSeparator` property.

```ts
import string from '@adonisjs/core/helpers/string'

string.toSentence(['routes', 'controllers', 'middleware'], {
  lastSeparator: ', or ',
})
```

In the following example, the two words are combined using the `and` separator, not the comma. However, you can use a custom separator for a pair of words.

```ts
import string from '@adonisjs/core/helpers/string'

string.toSentence(['routes', 'controllers'])
// routes and controllers

string.toSentence(['routes', 'controllers'], {
  pairSeparator: ', and ',
})
// routes, and controllers
```

## condenseWhitespace

Replace multiple whitespaces in a string with a single whitespace.

```ts
import string from '@adonisjs/core/helpers/string'

string.condenseWhitespace('hello  world')
// hello world

string.condenseWhitespace('  hello  world  ')
// hello world
```

## ordinal

Get the ordinal letter for a given number.

```ts
import string from '@adonisjs/core/helpers/string'

string.ordinal(1) // 1st
string.ordinal(2) // '2nd'
string.ordinal(3) // '3rd'
string.ordinal(4) // '4th'

string.ordinal(23) // '23rd'
string.ordinal(24) // '24th'
```

## seconds.parse

Parse a human-readable time expression to seconds. If the unit value is a number, it will be returned as it is. Otherwise, the string expression will be converted to a number representing seconds. An `Error` is thrown when the input cannot be parsed.

```ts
import string from '@adonisjs/core/helpers/string'

string.seconds.parse('10h') // 36000
string.seconds.parse('1 day') // 86400

string.seconds.parse(180) // 180
```

You can enforce strict time expression using the `PrettyTime` type.

```ts
import string from '@adonisjs/core/helpers/string'
import { PrettyTime } from '@poppinss/string/types'

function toSeconds(value: PrettyTime) {
  return string.seconds.parse(value)!
}

toSeconds('1 hour') // works
toSeconds('1hr') // works
toSeconds('1 heure') // type error
```

## seconds.format

Formats seconds to a human-readable string value.

```ts
import string from '@adonisjs/core/helpers/string'

string.seconds.format(36000) // 10h
string.seconds.format(36000, true) // 10 hours
```

## milliseconds.parse

Parse a human-readable time expression to milliseconds. If the unit value is a number, it will be returned as it is. Otherwise, the string expression will be converted to a number representing milliseconds. An `Error` is thrown when the input cannot be parsed.

```ts
import string from '@adonisjs/core/helpers/string'

string.milliseconds.parse('1 h') // 3.6e6
string.milliseconds.parse('1 day') // 8.64e7

string.milliseconds.parse(180) // 180
```

## milliseconds.format

Formats milliseconds to a human-readable string value.

```ts
import string from '@adonisjs/core/helpers/string'

string.milliseconds.format(3.6e6) // 1h
string.milliseconds.format(3.6e6, true) // 1 hour
```

## bytes.parse

Parse a human-readable string expression to bytes. If the unit value is a number, it will be returned as it is. Otherwise, the string expression will be converted to a number representing bytes. A `null` value is returned when the input cannot be parsed.

Supported units and abbreviations are as follows and are case-insensitive:

- `b` for bytes
- `kb` for kilobytes
- `mb` for megabytes
- `gb` for gigabytes
- `tb` for terabytes
- `pb` for petabytes

```ts
import string from '@adonisjs/core/helpers/string'

string.bytes.parse('1KB') // 1024
string.bytes.parse('1MB') // 1048576
```

You can enforce strict bytes expression using the `PrettyBytes` type.

```ts
import string from '@adonisjs/core/helpers/string'
import { PrettyBytes } from '@poppinss/string/types'

function toBytes(value: PrettyBytes) {
  return string.bytes.parse(value)!
}

toBytes('1 KB') // works
toBytes('1 kilobytes') // type error
```

## bytes.format

Formats bytes to a human-readable string value. When input cannot be formatted, the `null` value is returned.

```ts
import string from '@adonisjs/core/helpers/string'

string.bytes.format(1048576) // 1MB
string.bytes.format(1024 _ 1024 _ 1000) // 1000MB
string.bytes.format(1024 _ 1024 _ 1000, { thousandsSeparator: ',' }) // 1,000MB

string.bytes.format(1048576, { unitSeparator: ' ' }) // 1 MB
string.bytes.format(1048576, { unit: 'KB' }) // 1024KB
```

#### OPTIONS

::::options

:::option{name="decimalPlaces"}

A maximum number of decimal places to include in the output. `default=2`.

:::

:::option{name="fixedDecimals"}

Whether to always display the maximum number of decimal places. `default=false`.

:::

:::option{name="thousandsSeparator"}

Specify the separator for thousands. `default=''`.

:::

:::option{name="unit"}

The unit in which the result will be returned. It could be `B/KB/MB/GB/TB`. The default behavior is to auto-detect based on the input.

:::

:::option{name="unitSeparator"}

The separator between the value and the `unit`. `default=''`.

:::

::::

## String builder

The string builder offers a fluent API for applying a set of transforms on a string value. You can create an instance of the string builder as follows.

```ts
import string from '@adonisjs/core/helpers/string'

const value = string
  .create('userController')
  .removeSuffix('controller') // user
  .plural() // users
  .snakeCase() // users
  .suffix('_controller') // users_controller
  .ext('ts') // users_controller.ts
  .toString()

assert(value === 'users_controller.ts')
```
