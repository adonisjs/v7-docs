---
description: Learn how to encrypt and decrypt sensitive data in your AdonisJS applications.
---

# Encryption

This guide covers encryption and decryption in AdonisJS applications. You will learn how to:

- Encrypt and decrypt sensitive data
- Choose and configure encryption algorithms
- Use purpose-bound encryption for added security
- Set expiration times on encrypted values
- Sign data without encrypting using the message verifier
- Implement key rotation for seamless secret updates

## Overview

Encryption transforms readable data into ciphertext that can only be decrypted with the correct secret key. Unlike hashing, encryption is a reversible process. You encrypt data to protect it during storage or transmission, then decrypt it when you need to read the original value.

AdonisJS provides an encryption service with built-in support for three industry-standard algorithms: ChaCha20-Poly1305, AES-256-GCM, and AES-256-CBC. All three are authenticated encryption algorithms, meaning they not only protect confidentiality but also detect tampering. If someone modifies the encrypted data, decryption will fail rather than return corrupted data.

The encryption service produces output in a structured format that includes the driver identifier, ciphertext, initialization vector, and authentication tag. This self-describing format allows you to switch algorithms or rotate keys while maintaining the ability to decrypt older values.

## Basic usage

The encryption service provides two primary methods: `encryption.encrypt` for encrypting values and `encryption.decrypt` for retrieving the original data.

### Encrypting values

The `encryption.encrypt` method accepts any serializable value and returns an encrypted string.

```ts title="app/services/api_token_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class ApiTokenService {
  createToken(userId: number, permissions: string[]) {
    /**
     * Encrypt the token payload. The service handles
     * serialization, so you can pass objects directly.
     */
    const token = encryption.encrypt({
      userId,
      permissions,
      createdAt: new Date(),
    })

    // token looks like:
    // cbc.base64Ciphertext.base64IV.base64Tag

    return token
  }
}
```

The encryption service supports encrypting strings, numbers, booleans, arrays, objects, and dates. Complex nested structures are automatically serialized before encryption.

### Decrypting values

The `encryption.decrypt` method takes an encrypted string and returns the original value, or `null` if decryption fails.

```ts title="app/services/api_token_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class ApiTokenService {
  verifyToken(token: string) {
    /**
     * Attempt to decrypt the token. Returns null if the token
     * is invalid, tampered with, or encrypted with a different key.
     */
    const payload = encryption.decrypt(token)

    if (!payload) {
      return null
    }

    return payload as { userId: number; permissions: string[] }
  }
}
```

The decryption method returns `null` rather than throwing exceptions when decryption fails. This design prevents timing attacks and simplifies error handling. You should always check for `null` before using the decrypted value.

## Purpose-bound encryption

Purpose-bound encryption ensures that encrypted values can only be decrypted when the same purpose is provided. This prevents token reuse across different contexts in your application.

```ts title="app/services/token_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class TokenService {
  createPasswordResetToken(userId: number) {
    /**
     * The purpose option specifies the encryption purpose.
     * This token can only be decrypted with the same purpose.
     */
    return encryption.encrypt(
      { userId },
      { purpose: 'password-reset' } // [!code highlight]
    )
  }

  createEmailVerificationToken(userId: number) {
    return encryption.encrypt(
      { userId },
      { purpose: 'email-verification' } // [!code highlight]
    )
  }

  verifyPasswordResetToken(token: string) {
    /**
     * Must provide the same purpose to decrypt.
     * A token created for email verification won't work here.
     */
    return encryption.decrypt(token, 'password-reset')
  }
}
```

Without purpose binding, an attacker who obtains a password reset token could potentially reuse it as an email verification token if both contain the same data structure. Purpose-bound encryption prevents this attack by cryptographically binding the purpose to the encrypted value.

```ts title="app/services/token_service.ts"
const token = encryption.encrypt(
  { userId: 1 },
  { purpose: 'password-reset' }
)

encryption.decrypt(token, 'password-reset')     // => { userId: 1 }

/**
 * Attempting to decrypt with the wrong purpose returns null.
 */
encryption.decrypt(token, 'email-verification') // => null
encryption.decrypt(token)                       // => null
```

## Expiring encrypted values

You can set a time-to-live on encrypted values. After the specified duration, the decryption method returns `null` even if the encrypted data is valid.

```ts title="app/services/invitation_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class InvitationService {
  createInvitationLink(email: string, teamId: number) {
    const token = encryption.encrypt({ email, teamId }, {
      expiresIn: '24h' // [!code highlight]
    })
    return `https://app.example.com/invitations/${token}`
  }

  acceptInvitation(token: string) {
    /**
     * Returns null if the token has expired,
     * even if the encrypted data is still valid.
     */
    const payload = encryption.decrypt(token)
    if (!payload) {
      return { error: 'Invalid or expired invitation' }
    }

    return payload as { email: string; teamId: number }
  }
}
```

Supported duration formats include:

| Format  | Example | Description           |
|---------|---------|-----------------------|
| Minutes | `'30m'` | Expires in 30 minutes |
| Hours   | `'1h'`  | Expires in 1 hour     |
| Days    | `'7d'`  | Expires in 7 days     |

You can combine purpose binding with expiration for maximum security.

```ts title="app/services/token_service.ts"
/**
 * Create a password reset token that expires in 1 hour
 * and can only be used for password reset operations.
 */
const token = encryption.encrypt(
  { userId: 1 },
  { expiresIn: '1h', purpose: 'password-reset' }
)

/**
 * Must provide the correct purpose to decrypt.
 * Returns null if expired or purpose doesn't match.
 */
const payload = encryption.decrypt(token, 'password-reset')
```

## Encrypting database columns

Encrypt sensitive data before storing it in your database.

```ts title="app/models/user.ts"
import { UserSchema } from '#database/schema'
import { beforeSave } from '@adonisjs/lucid/orm'
import encryption from '@adonisjs/core/services/encryption'

export default class User extends UserSchema {
  @beforeSave()
  static encryptSensitiveData(user: User) {
    if (user.$dirty.ssn && user.ssn) {
      user.ssn = encryption.encrypt(user.ssn)
    }
  }

  decryptSsn(): string | null {
    if (!this.ssn) {
      return null
    }
    return encryption.decrypt(this.ssn)
  }
}
```

## Choosing an algorithm

Each encryption algorithm offers different tradeoffs between security, performance, and compatibility. The right choice depends on your application's requirements.

### When to choose ChaCha20-Poly1305

ChaCha20-Poly1305 is the recommended choice for new applications. It provides consistent high performance across all platforms, including those without hardware AES acceleration. It's widely deployed in modern protocols including TLS 1.3 and WireGuard.

### When to choose AES-256-GCM

AES-256-GCM is an excellent choice when you need compatibility with systems that specifically require AES or when running on hardware with AES-NI acceleration. It's the default cipher in many ecosystems, which simplifies interoperability even without explicit AES requirements.

### When to choose AES-256-CBC

AES-256-CBC is provided primarily for legacy compatibility, mainly to decrypt existing data from older systems. Unlike AEAD ciphers, CBC requires separate HMAC authentication using the Encrypt-then-MAC pattern. For new encryption needs, prefer ChaCha20-Poly1305 or AES-256-GCM.

:::warning
CBC mode has a history of implementation pitfalls, including padding oracle attacks. AdonisJS handles these concerns internally, but if you're implementing CBC elsewhere, ensure you use Encrypt-then-MAC and constant-time comparison for the authentication tag.
:::

### When to choose Legacy

The legacy driver is designed for migrating from AdonisJS v6 to v7. It can only decrypt data that was encrypted with the v6 encryption service. Use this driver when you have existing encrypted data in your database from a v6 application that needs to be migrated.

The recommended migration strategy is:

1. Configure the legacy driver alongside a modern driver
2. Read encrypted data using the legacy driver
3. Re-encrypt the data using a modern driver (ChaCha20-Poly1305 or AES-256-GCM)
4. Once all data has been migrated, remove the legacy driver

```ts title="app/services/migration_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class MigrationService {
  async migrateEncryptedField(encryptedValue: string) {
    /**
     * Decrypt using the legacy driver (v6 format)
     */
    const decrypted = encryption.use('legacy').decrypt(encryptedValue)

    if (!decrypted) {
      return null
    }

    /**
     * Re-encrypt using the modern driver
     */
    return encryption.encrypt(decrypted)
  }
}
```

## Configuration

The encryption configuration lives in `config/encryption.ts`. You define available drivers in the `list` object and specify which one to use by default.

```ts title="config/encryption.ts"
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

export default defineConfig({
  /**
   * The default driver used by encryption.encrypt() and
   * encryption.decrypt() when no driver is explicitly specified.
   */
  default: 'chacha',

  list: {
    chacha: drivers.chacha20({
      id: 'chacha',
      keys: [env.get('APP_KEY')],
    }),

    /**
     * AES-256-GCM: Industry-standard authenticated encryption.
     */
    // gcm: drivers.aes256gcm({
    //   id: 'gcm',
    //   keys: [env.get('APP_KEY')],
    // }),

    /**
     * AES-256-CBC: Legacy support with HMAC authentication.
     */
    // cbc: drivers.aes256cbc({
    //   id: 'cbc',
    //   keys: [env.get('APP_KEY')],
    // }),

    /**
     * Legacy: Decrypt data encrypted with AdonisJS v6.
     * Use this driver to migrate encrypted data from v6 to v7.
     */
    // legacy: drivers.legacy({
    //   keys: [env.get('APP_KEY')],
    // }),
  },
})
```

### Driver configuration options

All drivers accept the same configuration options.

::::options
:::option{name="id" dataType="string"}
A unique identifier for this driver configuration. This ID is embedded in the encrypted output, allowing the decryption process to identify which driver was used.
:::

:::option{name="keys" dataType="string[]"}
An array of secret keys. The first key is used for encryption, while all keys are tried during decryption. This enables seamless key rotation.
:::
::::

## Key rotation

The encryption service supports multiple keys for seamless key rotation. The first key in the array is used for encrypting new values, while all keys are tried during decryption. This allows you to rotate keys without invalidating existing encrypted data.

```ts title="config/encryption.ts"
import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

export default defineConfig({
  default: 'chacha',

  list: {
    chacha: drivers.chacha20({
      id: 'chacha',
      // [!code highlight:4]
      keys: [
        env.get('APP_KEY'),     // New key: used for encryption
        env.get('OLD_APP_KEY'), // Old key: only used for decryption
      ],
    }),
  },
})
```

When rotating keys, follow this process:

1. Generate a new secret key
2. Add the new key as the first element in the `keys` array
3. Move the old key to the second position
4. Deploy your application
5. After sufficient time (when all old encrypted values have been re-encrypted or expired), remove the old key

```ts title="app/services/rotation_example.ts"
import encryption from '@adonisjs/core/services/encryption'

/**
 * New encryptions automatically use the first key.
 */
const newToken = encryption.encrypt({ userId: 1 })

/**
 * Decryption tries all keys, so old tokens still work.
 */
const oldPayload = encryption.decrypt(tokenEncryptedWithOldKey) // Works
const newPayload = encryption.decrypt(newToken)                 // Works
```

:::warning
Never remove an old key until you're certain all data encrypted with that key has either been re-encrypted with the new key or is no longer needed. Removing a key makes all data encrypted with it permanently unreadable.
:::

## Message verifier

When you need to ensure data integrity without hiding the content, use the message verifier. Unlike encryption, the message verifier doesn't encrypt data. It base64-encodes the payload and signs it with HMAC, allowing anyone to read the data while ensuring it hasn't been tampered with.

```ts title="app/services/state_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class StateService {
  createOAuthState(returnUrl: string, provider: string) {
    /**
     * Sign the state without encrypting it.
     * The data is readable but tamper-proof.
     */
    return encryption.verifier.sign({ returnUrl, provider })
  }

  verifyOAuthState(state: string) {
    /**
     * Verify the signature and return the payload.
     * Returns null if the signature is invalid.
     */
    return encryption.verifier.unsign(state)
  }
}
```

The message verifier is useful for scenarios where you want to detect tampering but don't need to hide the data, such as OAuth state parameters, CSRF tokens, or webhook signatures.

### Verifier with purpose and expiration

The message verifier supports the same purpose binding and expiration features as encryption.

```ts title="app/services/csrf_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class CsrfService {
  createToken(sessionId: string) {
    /**
     * Create a CSRF token that expires in 1 hour
     * and is bound to the 'csrf' purpose.
     */
    return encryption.verifier.sign({ sessionId }, '1h', 'csrf')
  }

  verifyToken(token: string, expectedSessionId: string) {
    const payload = encryption.verifier.unsign(token, 'csrf')

    if (!payload || payload.sessionId !== expectedSessionId) {
      return false
    }

    return true
  }
}
```

## Using multiple drivers

Some applications need to encrypt data with different algorithms for different purposes. The `encryption.use` method lets you explicitly select a driver.

```ts title="app/services/multi_driver_service.ts"
import encryption from '@adonisjs/core/services/encryption'

export default class MultiDriverService {
  /**
   * Use ChaCha20-Poly1305 for high-performance encryption.
   */
  encryptSessionData(data: object) {
    return encryption.use('chacha').encrypt(data)
  }

  /**
   * Use AES-256-GCM for compatibility with external systems.
   */
  encryptForExternalApi(data: object) {
    return encryption.use('gcm').encrypt(data)
  }
}
```

Each driver specified in `encryption.use()` must be configured in your `config/encryption.ts` file's `list` object.

## Generating the app key

The encryption service requires a cryptographically secure secret key stored in the `APP_KEY` environment variable. You can generate a new key using the Ace CLI.

```sh
node ace generate:key
```

This command generates a random 32-character key and writes it to your `.env` file. The key uses a cryptographically secure random number generator to ensure it cannot be predicted or guessed.

The `APP_KEY` is critical to your application's security. If this key is compromised, attackers can decrypt all your encrypted data and forge signed cookies. Store it securely, never commit it to version control, and use different keys for each environment.

If you change or lose your `APP_KEY`, all existing encrypted data becomes permanently unreadable. Cookies signed with the old key will be rejected, and encrypted database values cannot be recovered. Always back up your production keys securely.
