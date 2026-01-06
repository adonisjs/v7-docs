---
summary: Learn how to securely hash and verify passwords using the AdonisJS hash service.
---

# Hashing

This guide covers password hashing in AdonisJS applications. You will learn how to:

- Hash and verify passwords
- Choose and configure hashing algorithms
- Detect and perform rehashing after configuration changes
- Speed up tests by faking the hash service
- Create custom hash drivers

## Overview

Password hashing converts plain text passwords into irreversible strings that can be safely stored in your database. Unlike encryption, hashing is a one-way process. You cannot convert a hash back to the original password. Instead, you verify passwords by hashing the input and comparing it to the stored hash.

AdonisJS provides a hash service with built-in support for three industry-standard algorithms: Argon2, Bcrypt, and Scrypt. The service stores hashes in [PHC string format](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md), a standardized encoding that embeds the algorithm parameters directly in the hash output.

:::note
If you're using the `@adonisjs/auth` module with Lucid models, password hashing and verification are handled automatically by the `AuthFinder` mixin. This guide focuses on direct usage of the hash service for cases where you need more control or aren't using the authentication module.
:::

## Installation

The hash service is included with `@adonisjs/core` and requires no additional installation for the default Scrypt driver. Scrypt uses Node.js's built-in `crypto` module, making it available immediately without external dependencies.

For Argon2 or Bcrypt, you must install their respective npm packages.

```sh
# For Argon2 (recommended for new applications)
npm i argon2

# For Bcrypt
npm i bcrypt
```

After installing a package, update your hash configuration to use the new driver.

## Basic usage

The hash service provides two primary methods: `hash.make` for creating hashes and `hash.verify` for validating passwords against existing hashes.

### Creating hashes

The `hash.make` method accepts a plain text string and returns a hash in PHC format.

```ts title="app/services/user_service.ts"
import hash from '@adonisjs/core/services/hash'

export default class UserService {
  async createUser(email: string, password: string) {
    /**
     * Hash the password before storing. The output includes
     * the algorithm, parameters, salt, and hash in one string.
     */
    const hashedPassword = await hash.make(password)
    
    // hashedPassword looks like:
    // $scrypt$n=16384,r=8,p=1$randomsalt$hashoutput...
    
    return User.create({ email, password: hashedPassword })
  }
}
```

### Verifying passwords

The `hash.verify` method compares a plain text password against a stored hash. It returns `true` if they match, `false` otherwise.

```ts title="app/services/auth_service.ts"
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'

export default class AuthService {
  async validateCredentials(email: string, password: string) {
    const user = await User.findBy('email', email)
    if (!user) {
      return null
    }

    /**
     * Compare the plain text password against the stored hash.
     * The verify method extracts algorithm parameters from the
     * hash itself, so it works even if you've changed your config.
     */
    const isValid = await hash.verify(user.password, password)
    
    return isValid ? user : null
  }
}
```

## Choosing an algorithm

Each hashing algorithm offers different tradeoffs between security, performance, and compatibility. The right choice depends on your application's requirements.

### When to choose Argon2

Argon2 is the recommended choice for new applications. It won the 2015 Password Hashing Competition and provides configurable memory hardness, making it resistant to both GPU-based attacks and specialized hardware. The `id` variant (the default) combines protection against GPU attacks and side-channel attacks.

### When to choose Bcrypt

Bcrypt remains a solid choice when you need compatibility with existing systems or other platforms. Its security properties are well-understood after decades of analysis. However, be aware that Bcrypt truncates passwords at 72 bytes, so longer passwords are effectively shortened before hashing.

:::warning
Bcrypt silently truncates passwords longer than 72 bytes. If your application accepts very long passwords or passphrases, users may be able to authenticate with only the first 72 bytes of their password. Consider using Argon2 or Scrypt if this is a concern.
:::

### When to choose Scrypt

Scrypt is the default driver because it requires no additional npm packages. It uses Node.js's built-in `crypto` module, making it ideal for applications where minimizing dependencies matters. With proper configuration, Scrypt provides security comparable to Argon2.

## Configuration

The hash configuration lives in `config/hash.ts`. You define available drivers in the `list` object and specify which one to use by default.

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'

export default defineConfig({
  /**
   * The default driver used by hash.make() and hash.verify()
   * when no driver is explicitly specified.
   */
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      saltSize: 16,
      maxMemory: 33554432,
      keyLength: 64,
    }),

    /**
     * Uncomment after installing: npm i argon2
     */
    // argon: drivers.argon2({
    //   version: 0x13,
    //   variant: 'id',
    //   iterations: 3,
    //   memory: 65536,
    //   parallelism: 4,
    //   saltSize: 16,
    //   hashLength: 32,
    // }),

    /**
     * Uncomment after installing: npm i bcrypt
     */
    // bcrypt: drivers.bcrypt({
    //   rounds: 10,
    //   saltSize: 16,
    //   version: '2b',
    // }),
  },
})
```

### Argon2 configuration

Argon2 provides fine-grained control over memory usage, iteration count, and parallelism. These parameters directly affect both security and performance.

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'

export default defineConfig({
  default: 'argon',

  list: {
    argon: drivers.argon2({
      version: 0x13,
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
    }),
  },
})
```

::::options
:::option{name="variant" dataType="string" defaultValue="id"}
Define the Argon2 variant.

- `'d'` resists GPU attacks (for cryptocurrency).
- `'i'` resists side-channel attacks (slower).
- `'id'` combines both protections (recommended for passwords).
:::

:::option{name="version" dataType="number" defaultValue="0x13"}
Algorithm version defined as hex. `0x10` (1.0) or `0x13` (1.3).
:::

:::option{name="iterations" dataType="number" defaultValue="3"}
Time cost. Higher values increase computation time and security.
:::

:::option{name="memory" dataType="number" defaultValue="65536"}
Memory cost in KiB. Each parallel thread uses this amount. Higher values resist GPU attacks.
:::

:::option{name="parallelism" dataType="number" defaultValue="4"}
Number of parallel threads for computing the hash.
:::

:::option{name="saltSize" dataType="number" defaultValue="16"}
Length of the random salt in bytes.
:::

:::option{name="hashLength" dataType="number" defaultValue="32"}
Length of the raw hash output in bytes. The final PHC string will be longer.
:::
::::

#### Using secrets with Argon2

Argon2 supports an optional secret (sometimes called a "pepper") that adds an additional layer of protection. Unlike the salt which is stored with the hash, the secret is kept separately, typically in environment variables. Even if an attacker obtains your database, they cannot crack the hashes without the secret.

:::warning
If you add a secret to an existing application, all previously hashed passwords become invalid because they were created without the secret and cannot be verified with it. You must either reset all passwords or implement a migration strategy that rehashes passwords on next login.
:::

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'
import env from '#start/env'

export default defineConfig({
  default: 'argon',

  list: {
    argon: drivers.argon2({
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      /**
       * The secret adds protection beyond what's stored in the database.
       * Store this in your environment variables, never in code.
       */
      secret: env.get('HASH_SECRET'),
    }),
  },
})
```

### Bcrypt configuration

Bcrypt configuration centers on the `rounds` parameter, which controls the computational cost through exponential scaling.

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'

export default defineConfig({
  default: 'bcrypt',

  list: {
    bcrypt: drivers.bcrypt({
      rounds: 10,
      saltSize: 16,
      version: '2b',
    }),
  },
})
```

::::options
:::option{name="rounds" dataType="number" defaultValue="10"}
Cost factor as a power of 2. A value of 10 means 2^10 (1024) iterations. Each increment doubles the computation time.
:::

:::option{name="saltSize" dataType="number" defaultValue="16"}
Length of the random salt in bytes.
:::

:::option{name="version" dataType="string" defaultValue="2b"}
Bcrypt version identifier. Use `'2b'` (current) unless you need compatibility with older `'2a'` hashes.
:::
::::

### Scrypt configuration

Scrypt uses memory-hard functions that make attacks expensive on both GPUs and specialized hardware.

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'

export default defineConfig({
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      saltSize: 16,
      maxMemory: 33554432,
      keyLength: 64,
    }),
  },
})
```

::::options
:::option{name="cost" dataType="number" defaultValue="16384"}
CPU/memory cost parameter (N). Must be a power of 2. Higher values increase security and resource usage.
:::

:::option{name="blockSize" dataType="number" defaultValue="8"}
Block size parameter (r). Increases memory usage linearly.
:::

:::option{name="parallelization" dataType="number" defaultValue="1"}
Parallelization parameter (p). Values above 1 allow parallel computation.
:::

:::option{name="saltSize" dataType="number" defaultValue="16"}
Length of the random salt in bytes.
:::

:::option{name="maxMemory" dataType="number" defaultValue="33554432"}
Maximum memory in bytes (32 MiB default). Node.js throws if computed memory exceeds this.
:::

:::option{name="keyLength" dataType="number" defaultValue="64"}
Length of the derived key in bytes.
:::
::::

## Rehashing

Security best practices evolve over time, and you may need to strengthen your hashing parameters by increasing iterations, memory usage, or switching algorithms entirely. The PHC format makes this straightforward because each hash contains the parameters used to create it.

The `hash.needsReHash` method checks whether a stored hash was created with parameters that differ from your current configuration.

```ts title="app/services/auth_service.ts"
import hash from '@adonisjs/core/services/hash'
import User from '#models/user'

export default class AuthService {
  async login(email: string, password: string) {
    const user = await User.findBy('email', email)
    if (!user) {
      return null
    }

    const isValid = await hash.verify(user.password, password)
    if (!isValid) {
      return null
    }

    if (hash.needsReHash(user.password)) {
      user.password = await hash.make(password)
      await user.save()
    }

    return user
  }
}
```

Rehashing during login is the standard approach because it's the only time you have access to the plain text password. Over time, as users log in, their passwords gradually migrate to your updated configuration.

### Migrating between algorithms

Switching from one algorithm to another follows the same pattern as parameter updates. When you change the default driver, `needsReHash` returns `true` for any hash created with a different algorithm.

:::warning
Keep your old driver configured until all users have logged in and their passwords have been rehashed. Removing the old driver before migration completes will prevent users with old hashes from authenticating. Monitor your database to track migration progress before removing the old configuration.
:::

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'

export default defineConfig({
  /**
   * Changed from 'scrypt' to 'argon'. Existing scrypt hashes
   * will return true from needsReHash().
   */
  default: 'argon',

  list: {
    /**
     * Keep the old driver configured so existing hashes
     * can still be verified during the migration period.
     */
    scrypt: drivers.scrypt(),
    argon: drivers.argon2({
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
    }),
  },
})
```

## Using multiple drivers

Some applications need to verify hashes created by different systems or support multiple hashing strategies simultaneously. The `hash.use` method lets you explicitly select a driver.

```ts title="app/services/migration_service.ts"
import hash from '@adonisjs/core/services/hash'

export default class MigrationService {
  /**
   * Verify a password that might have been hashed by
   * a legacy system using bcrypt.
   */
  async verifyLegacyPassword(password: string, storedHash: string) {
    return hash.use('bcrypt').verify(storedHash, password)
  }

  /**
   * Create a new hash with Argon2 regardless of the default driver.
   */
  async hashWithArgon(password: string) {
    return hash.use('argon').make(password)
  }
}
```

Each driver specified in `hash.use()` must be configured in your `config/hash.ts` file's `list` object.

## Hashing with model hooks

If you're not using the `@adonisjs/auth` module's `AuthFinder` mixin, you can hash passwords automatically using Lucid model hooks. The `$dirty` check ensures the password is only hashed when the field has actually changed, preventing rehashing on every save.

```ts title="app/models/user.ts"
import { BaseModel, beforeSave, column } from '@adonisjs/lucid/orm'
import hash from '@adonisjs/core/services/hash'

export default class User extends BaseModel {
  @column()
  declare email: string

  @column()
  declare password: string

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }
}
```

## Testing with fakes

Password hashing is intentionally slow, as that's what makes it secure. However, this can significantly slow down your test suite, especially when creating many users through factories. The `hash.fake` method replaces the real implementation with a fast, insecure version suitable only for testing.

```ts title="tests/functional/users.spec.ts"
import { test } from '@japa/runner'
import hash from '@adonisjs/core/services/hash'
import { UserFactory } from '#database/factories/user_factory'

test.group('Users list', (group) => {
  group.each.setup(() => {
    /**
     * Replace the hash service with a fake that performs
     * no actual hashing. This makes user creation instant.
     */
    hash.fake()

    /**
     * Return a cleanup function that restores the real
     * implementation after each test.
     */
    return () => hash.restore()
  })

  test('lists all users', async ({ client }) => {
    /**
     * Without faking, creating 50 users with bcrypt (10 rounds)
     * takes ~5 seconds. With faking, it's nearly instant.
     */
    await UserFactory.createMany(50)

    const response = await client.get('/users')
    response.assertStatus(200)
  })
})
```

The fake implementation stores plain text and compares strings directly. Always call `hash.restore()` to prevent the fake from leaking into other tests.

## Understanding PHC format

The [PHC (Password Hashing Competition)](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md) string format is a standardized way to encode hashes that embeds all the information needed to verify them. A PHC string looks like this:

```
$scrypt$n=16384,r=8,p=1$c2FsdHZhbHVl$aGFzaG91dHB1dC4uLg==
```

The format breaks down into sections separated by `$`:

1. **Algorithm identifier**: `scrypt`, `argon2id`, `bcrypt`, etc.
2. **Parameters**: Algorithm-specific settings like cost, memory, iterations
3. **Salt**: Base64-encoded random salt
4. **Hash**: Base64-encoded hash output

This self-describing format provides several benefits. The verification process can read parameters directly from the hash, allowing you to verify old hashes even after changing your configuration. The `needsReHash` method compares embedded parameters against current settings to detect when hashes need updating. You can also switch algorithms without losing the ability to verify existing passwords.

## Creating a custom driver

For specialized requirements, you can create custom hash drivers. A driver must implement the `HashDriverContract` interface with four methods: `make`, `verify`, `isValidHash`, and `needsReHash`.

```ts title="app/hash_drivers/pbkdf2.ts"
import crypto from 'node:crypto'
import {
  HashDriverContract,
  ManagerDriverFactory,
} from '@adonisjs/core/types/hash'

/**
 * Configuration options accepted by the driver.
 */
export type Pbkdf2Config = {
  iterations: number
  keyLength: number
  digest: 'sha256' | 'sha512'
  saltSize: number
}

/**
 * Driver implementation using Node's PBKDF2.
 * This is for illustration. Prefer Argon2/Bcrypt/Scrypt in production.
 */
export class Pbkdf2Driver implements HashDriverContract {
  constructor(private config: Pbkdf2Config) {}

  /**
   * Check if a string looks like a hash from this driver.
   * Used to determine which driver should verify a hash.
   */
  isValidHash(value: string): boolean {
    return value.startsWith('$pbkdf2$')
  }

  /**
   * Hash a plain text value and return a PHC-formatted string.
   */
  async make(value: string): Promise<string> {
    const salt = crypto.randomBytes(this.config.saltSize)
    const hash = crypto.pbkdf2Sync(
      value,
      salt,
      this.config.iterations,
      this.config.keyLength,
      this.config.digest
    )

    /**
     * Encode in PHC format with all parameters needed for verification.
     */
    const params = `i=${this.config.iterations},l=${this.config.keyLength},d=${this.config.digest}`
    return `$pbkdf2$${params}$${salt.toString('base64')}$${hash.toString('base64')}`
  }

  /**
   * Verify a plain text value against a stored hash.
   */
  async verify(hashedValue: string, plainValue: string): Promise<boolean> {
    const parts = hashedValue.split('$')
    const params = this.#parseParams(parts[2])
    const salt = Buffer.from(parts[3], 'base64')
    const storedHash = Buffer.from(parts[4], 'base64')

    const computedHash = crypto.pbkdf2Sync(
      plainValue,
      salt,
      params.iterations,
      params.keyLength,
      params.digest
    )

    /**
     * Use timing-safe comparison to prevent timing attacks.
     */
    return crypto.timingSafeEqual(storedHash, computedHash)
  }

  /**
   * Check if a hash needs to be regenerated because
   * the configuration has changed.
   */
  needsReHash(value: string): boolean {
    const parts = value.split('$')
    const params = this.#parseParams(parts[2])

    return (
      params.iterations !== this.config.iterations ||
      params.keyLength !== this.config.keyLength ||
      params.digest !== this.config.digest
    )
  }

  #parseParams(paramString: string) {
    const params: Record<string, string> = {}
    for (const pair of paramString.split(',')) {
      const [key, val] = pair.split('=')
      params[key] = val
    }
    return {
      iterations: parseInt(params.i, 10),
      keyLength: parseInt(params.l, 10),
      digest: params.d as 'sha256' | 'sha512',
    }
  }
}

/**
 * Factory function for referencing the driver in config.
 * Returns a closure that creates driver instances lazily.
 */
export function pbkdf2Driver(config: Pbkdf2Config): ManagerDriverFactory {
  return () => new Pbkdf2Driver(config)
}
```

Register your custom driver in the hash configuration.

```ts title="config/hash.ts"
import { defineConfig, drivers } from '@adonisjs/core/hash'
import { pbkdf2Driver } from '#app/hash_drivers/pbkdf2'

export default defineConfig({
  default: 'pbkdf2',

  list: {
    pbkdf2: pbkdf2Driver({
      iterations: 100000,
      keyLength: 64,
      digest: 'sha512',
      saltSize: 16,
    }),
  },
})
```
