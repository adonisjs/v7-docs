---
description: Learn how to manage user-uploaded files using AdonisJS Drive, a unified API for local filesystem and cloud storage services like S3, GCS, R2, and more.
---

# Drive

This guide covers file storage management in AdonisJS using Drive. You will learn how to:

- Install and configure Drive for your application
- Upload files to local or cloud storage using `moveToDisk`
- Display files using public URLs and signed URLs
- Configure multiple storage services (S3, GCS, R2, DigitalOcean Spaces, Supabase)
- Implement direct uploads from the browser to cloud storage
- Test file uploads using the Drive fakes API

## Overview

AdonisJS Drive is a wrapper on top of [FlyDrive](https://flydrive.dev) (created and maintained by the AdonisJS core team). It provides a unified API for managing user-uploaded files across multiple storage providers, including the local filesystem, Amazon S3, Google Cloud Storage, Cloudflare R2, DigitalOcean Spaces, and Supabase Storage.

The key benefit of Drive is that you can switch between storage services without changing your application code. During development, you might store files on the local filesystem for convenience. In production, you switch to a cloud provider by changing an environment variable. Your controllers, services, and templates remain unchanged.

:::note
Drive handles file storage operations like reading, writing, and deleting files. It does not handle HTTP multipart parsing. You should read the [file uploads guide](../basics/file_uploads.md) first to understand how AdonisJS processes uploaded files from HTTP requests.
:::

## Installation

Install and configure the `@adonisjs/drive` package using the following command:

```sh
node ace add @adonisjs/drive
```

The command prompts you to select one or more storage services.

:::disclosure{title="Steps performed by the add command"}

1. Installs the `@adonisjs/drive` package and any required peer dependencies for your selected services.
2. Registers the Drive service provider in `adonisrc.ts`.
3. Creates the `config/drive.ts` configuration file with your selected services.
4. Adds environment variables for your selected services to `.env` and `start/env.ts`.

:::

:::tip{title="Non-interactive installation"}
The `node ace add` command requires interactive service selection. If you need to install Drive non-interactively (for example, in CI scripts), you can perform the steps manually:

1. Install the package: `npm install @adonisjs/drive`
2. Install peer dependencies for your storage service (e.g., `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` for S3)
3. Register the provider in `adonisrc.ts`: add `() => import('@adonisjs/drive/drive_provider')` to the `providers` array
4. Create `config/drive.ts` with your service configuration (see the [Configuration](#configuration) section below)
5. Add the required environment variables to `.env` and `start/env.ts`
:::

## Configuration

The configuration for Drive is stored in `config/drive.ts`. The file contents depend on which services you selected during installation.

The `default` property in the config file determines which service is used when you don't explicitly specify one. The `DRIVE_DISK` environment variable controls this, allowing you to use `fs` locally and switch to `s3` in production.

```ts title="config/drive.ts"
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  services: {
    // Service configurations go here
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
```

### Local filesystem

The local filesystem driver stores files on your server's disk and can serve them via the AdonisJS HTTP server.

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=fs
```

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    fs: services.fs({
      /**
       * The directory where files are stored. Use app.makePath
       * to create an absolute path from your application root.
       */
      location: app.makePath('storage'),

      /**
       * When true, Drive registers a route to serve files
       * from the local filesystem via your AdonisJS server.
       */
      serveFiles: true,

      /**
       * The URL path prefix for serving files. A file stored
       * as "avatars/1.jpg" becomes accessible at "/uploads/avatars/1.jpg".
       */
      routeBasePath: '/uploads',

      /**
       * The default visibility for files. Public files are
       * accessible via URL. Private files require signed URLs.
       */
      visibility: 'public',
    }),
  }
}
```

:::

:::tip
When `serveFiles` is enabled, you can verify the route is registered by running `node ace list:routes`. You should see a route like `/uploads/*` with the handler `drive.fs.serve`.
:::

### Amazon S3

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET=your_bucket_name
```

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
      },
      region: env.get('AWS_REGION'),
      bucket: env.get('S3_BUCKET'),
      visibility: 'public',
    }),
  }
}
```

:::

### Google Cloud Storage

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=gcs
GCS_KEY=file://gcs_key.json
GCS_BUCKET=your_bucket_name
```

The `GCS_KEY` variable points to a JSON key file for your Google Cloud service account. The `file://` prefix indicates the path is relative to your application root.

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    gcs: services.gcs({
      credentials: env.get('GCS_KEY'),
      bucket: env.get('GCS_BUCKET'),
      visibility: 'public',
    }),
  }
}
```

:::

### Cloudflare R2

Cloudflare R2 uses the S3-compatible API. The `region` must be set to `'auto'`.

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=r2
R2_KEY=your_access_key
R2_SECRET=your_secret_key
R2_BUCKET=your_bucket_name
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
```

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    r2: services.s3({
      credentials: {
        accessKeyId: env.get('R2_KEY'),
        secretAccessKey: env.get('R2_SECRET'),
      },
      region: 'auto',
      bucket: env.get('R2_BUCKET'),
      endpoint: env.get('R2_ENDPOINT'),
      visibility: 'public',
    }),
  }
}
```

:::

### DigitalOcean Spaces

DigitalOcean Spaces uses the S3-compatible API with a custom endpoint.

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=spaces
SPACES_KEY=your_access_key
SPACES_SECRET=your_secret_key
SPACES_REGION=nyc3
SPACES_BUCKET=your_bucket_name
SPACES_ENDPOINT=https://${SPACES_REGION}.digitaloceanspaces.com
```

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    spaces: services.s3({
      credentials: {
        accessKeyId: env.get('SPACES_KEY'),
        secretAccessKey: env.get('SPACES_SECRET'),
      },
      region: env.get('SPACES_REGION'),
      bucket: env.get('SPACES_BUCKET'),
      endpoint: env.get('SPACES_ENDPOINT'),
      visibility: 'public',
    }),
  }
}
```

:::

### Supabase Storage

Supabase Storage uses the S3-compatible API.

:::disclosure{title="Environment variables"}

```dotenv title=".env"
DRIVE_DISK=supabase
SUPABASE_STORAGE_KEY=your_access_key
SUPABASE_STORAGE_SECRET=your_secret_key
SUPABASE_STORAGE_REGION=your_region
SUPABASE_STORAGE_BUCKET=your_bucket_name
SUPABASE_ENDPOINT=https://your_project.supabase.co/storage/v1/s3
```

:::

:::disclosure{title="Configuration"}

```ts title="config/drive.ts"
{
  services: {
    supabase: services.s3({
      credentials: {
        accessKeyId: env.get('SUPABASE_STORAGE_KEY'),
        secretAccessKey: env.get('SUPABASE_STORAGE_SECRET'),
      },
      region: env.get('SUPABASE_STORAGE_REGION'),
      bucket: env.get('SUPABASE_STORAGE_BUCKET'),
      endpoint: env.get('SUPABASE_ENDPOINT'),
      visibility: 'public',
    }),
  }
}
```

:::

## Basic usage

Drive extends the AdonisJS `MultipartFile` class and adds the `moveToDisk` method. This method moves an uploaded file from its temporary location to your configured storage service.

The following example shows a complete flow for uploading and displaying a user avatar.

::::steps

:::step{title="Define routes"}

Create routes for displaying the profile page and handling avatar uploads.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('profile', [controllers.Profile, 'show'])
router.post('profile/avatar', [controllers.Profile, 'updateAvatar'])
```

:::

:::step{title="Create the controller"}

The controller handles the file upload using `moveToDisk`. Generate a unique filename using a UUID to avoid collisions when multiple users upload files with the same name.

```ts title="app/controllers/profile_controller.ts"
import string from '@adonisjs/core/helpers/string'
import type { HttpContext } from '@adonisjs/core/http'
import { updateAvatarValidator } from '#validators/user'

export default class ProfileController {
  async show({ view, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return view.render('pages/profile/show', { user })
  }

  async updateAvatar({ request, auth, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { avatar } = await request.validateUsing(updateAvatarValidator)

    /**
     * Generate a unique filename using a UUID to avoid
     * collisions when multiple users upload files with
     * the same name.
     */
    const key = `${string.uuid()}.${avatar.extname ?? 'txt'}`

    /**
     * Move the uploaded file to the default disk.
     * The file is moved from its temporary location
     * to your configured storage service.
     */
    await avatar.moveToDisk(key)

    /**
     * Store only the key in the database, not the full URL.
     * This allows you to switch storage services without
     * updating database records.
     */
    user.avatar = key
    await user.save()

    session.flash('success', 'Avatar updated successfully!')
    return response.redirect().back()
  }
}
```

:::

:::step{title="Create the template"}

The template displays the current avatar using the `driveUrl` helper and provides a form for uploading a new one.

```edge title="resources/views/pages/profile/show.edge"
@layout()
  <div class="form-container">
    <div>
      @if(user.avatar)
        // [!code highlight:5]
        <img
          src="{{ await driveUrl(user.avatar) }}"
          alt="User avatar"
          style="max-width: 200px; border-radius: 8px;"
        />
      @end

      @form({ route: 'profile.update_avatar', method: 'POST', enctype: 'multipart/form-data' })
        <div>
          @field.root({ name: 'avatar' })
            @!input.control({ type: 'file' })
            @!field.error()
          @end
        </div>
        <div>
          @!button({ type: 'submit', text: 'Update avatar' })
        </div>
      @end
    </div>
  </div>
@end
```

The `driveUrl` Edge helper generates the public URL for a file. For the local filesystem, this returns a path like `/uploads/abc-123.jpg`. For cloud providers, it returns the full URL to the file.

:::

::::

### Specifying a disk

By default, `moveToDisk` uses the disk specified in the `DRIVE_DISK` environment variable. You can explicitly specify a different disk as the second argument:

```ts title="app/controllers/profile_controller.ts"
// Move to the default disk
await avatar.moveToDisk(key)

// Move to a specific disk
await avatar.moveToDisk(key, 's3')
await avatar.moveToDisk(key, 'gcs')
await avatar.moveToDisk(key, 'r2')
```

:::warning
The `moveToDisk` method is different from the `move` method. The `move` method moves files within the local filesystem only. The `moveToDisk` method moves files to your configured Drive storage service, which could be local or cloud-based.
:::

## Using the Drive service

For operations beyond file uploads, you can use the Drive service directly. Import it from `@adonisjs/drive/services/main` to read files, write files, delete files, and more.

```ts title="app/services/file_service.ts"
import drive from '@adonisjs/drive/services/main'

export class FileService {
  /**
   * Get the default disk instance
   */
  async readFile(key: string) {
    const disk = drive.use()
    return disk.get(key)
  }

  /**
   * Get a specific disk instance
   */
  async readFromS3(key: string) {
    const disk = drive.use('s3')
    return disk.get(key)
  }

  /**
   * Write content directly to storage
   */
  async writeReport(content: string) {
    const disk = drive.use()
    await disk.put('reports/monthly.txt', content)
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string) {
    const disk = drive.use()
    await disk.delete(key)
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string) {
    const disk = drive.use()
    return disk.exists(key)
  }
}
```

The Drive service provides many more methods for file operations. See the [FlyDrive Disk API documentation](https://flydrive.dev/docs/disk_api) for the complete list of available methods.

## Generating URLs

Drive provides two methods for generating file URLs: `getUrl` for public files and `getSignedUrl` for private files.

### Public URLs

Use `getUrl` to generate URLs for files with `public` visibility. Anyone with the URL can access these files.

```ts title="app/controllers/files_controller.ts"
import drive from '@adonisjs/drive/services/main'

export default class FilesController {
  async show({ params }: HttpContext) {
    const disk = drive.use()
    const url = await disk.getUrl(params.key)

    return { url }
  }
}
```

In Edge templates, use the `driveUrl` helper:

```edge title="resources/views/files/show.edge"
<img src="{{ await driveUrl(file.key) }}" alt="File" />

{{-- Specify a disk --}}
<img src="{{ await driveUrl(file.key, 's3') }}" alt="File" />
```

### Signed URLs

Use `getSignedUrl` to generate temporary URLs for files with `private` visibility. These URLs expire after a specified duration.

Signed URLs are useful when you want to control access to files. For example, you might store invoices with private visibility and generate a signed URL only when an authorized user requests to download one.

```ts title="app/controllers/invoices_controller.ts"
import drive from '@adonisjs/drive/services/main'

export default class InvoicesController {
  async download({ params, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const invoice = await Invoice.query()
      .where('id', params.id)
      .where('userId', user.id)
      .firstOrFail()

    const disk = drive.use()

    /**
     * Generate a signed URL that expires in 30 minutes.
     * The user can only download the file while the URL is valid.
     */
    const url = await disk.getSignedUrl(invoice.fileKey, {
      expiresIn: '30 mins',
    })

    return { url }
  }
}
```

In Edge templates, use the `driveSignedUrl` helper:

```edge title="resources/views/invoices/show.edge"
<a href="{{ await driveSignedUrl(invoice.fileKey) }}">
  Download Invoice
</a>

{{-- With expiration --}}
<a href="{{ await driveSignedUrl(invoice.fileKey, { expiresIn: '1 hour' }) }}">
  Download Invoice
</a>

{{-- Specify a disk --}}
<a href="{{ await driveSignedUrl(invoice.fileKey, 's3', { expiresIn: '1 hour' }) }}">
  Download Invoice
</a>
```

## Direct uploads

Direct uploads allow the browser to upload files directly to your cloud storage provider, bypassing your AdonisJS server. This is useful for large files because the data doesn't flow through your server, reducing memory usage and bandwidth costs.

The flow works as follows:

1. The browser requests a signed upload URL from your server.
2. Your server generates a signed URL using Drive and returns it.
3. The browser uploads the file directly to the cloud provider using the signed URL.
4. The browser notifies your server that the upload is complete.

::::steps

:::step{title="Define routes"}

Create routes for generating signed upload URLs and handling upload completion.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.post('uploads/presign', [controllers.Uploads, 'presign'])
router.post('uploads/complete', [controllers.Uploads, 'complete'])
```

:::

:::step{title="Create the controller"}

The controller generates signed upload URLs using `getSignedUploadUrl` and handles upload completion notifications.

```ts title="app/controllers/uploads_controller.ts"
import string from '@adonisjs/core/helpers/string'
import drive from '@adonisjs/drive/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class UploadsController {
  /**
   * Generate a signed URL for direct upload
   */
  async presign({ request, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { filename, contentType } = request.only(['filename', 'contentType'])

    /**
     * Generate a unique key for the file
     */
    const key = `uploads/${user.id}/${string.uuid()}-${filename}`

    const disk = drive.use('s3')

    /**
     * Generate a signed URL that allows the browser
     * to upload directly to S3
     */
    const signedUrl = await disk.getSignedUploadUrl(key, {
      expiresIn: '15 mins',
      contentType,
    })

    return {
      key,
      url: signedUrl,
    }
  }

  /**
   * Handle upload completion notification
   */
  async complete({ request, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const { key } = request.only(['key'])

    /**
     * Verify the file exists
     */
    const disk = drive.use('s3')
    const exists = await disk.exists(key)

    if (!exists) {
      return { error: 'File not found' }
    }

    /**
     * Save the file reference to your database
     */
    await user.related('files').create({ key })

    return { success: true }
  }
}
```

:::

:::step{title="Implement client-side upload"}

On the frontend, request a signed URL and then upload the file directly to the cloud provider.

```ts title="resources/js/upload.ts"
async function uploadFile(file: File) {
  /**
   * Step 1: Request a signed upload URL from your server
   */
  const presignResponse = await fetch('/uploads/presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
    }),
  })

  const { key, url } = await presignResponse.json()

  /**
   * Step 2: Upload the file directly to cloud storage
   * using the signed URL
   */
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error('Upload failed')
  }

  /**
   * Step 3: Notify your server that the upload is complete
   */
  await fetch('/uploads/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key }),
  })

  return key
}
```

:::

::::

## Testing

Drive provides a fakes API for testing file uploads without interacting with real storage. When you fake a disk, all operations are redirected to a temporary local directory instead of the configured storage service.

```ts title="tests/functional/profile/update_avatar.spec.ts"
import { test } from '@japa/runner'
import { fileGenerator } from '@poppinss/file-generator'
import drive from '@adonisjs/drive/services/main'
import { UserFactory } from '#database/factories/user_factory'

test.group('Profile | update avatar', () => {
  test('user can upload an avatar', async ({ client }) => {
    /**
     * Fake the default disk. All file operations will now
     * use a temporary local directory instead of the
     * configured storage service. The `using` keyword
     * automatically restores the real disk when the test ends.
     */
    // [!code highlight]
    using fakeDisk = drive.fake()

    const user = await UserFactory.create()

    /**
     * Generate a buffer with valid PNG magic bytes.
     * AdonisJS uses magic byte detection to determine file types,
     * so plain Buffer.from('fake-image') will be rejected.
     */
    const pngFile = await fileGenerator.generatePng(1)

    await client
      .post('/profile/avatar')
      .file('avatar', pngFile.contents, {
        filename: pngFile.name,
        contentType: pngFile.mime,
      })
      .loginAs(user)
      .assertStatus(200)

    /**
     * Assert the file was stored
     */
    fakeDisk.assertExists(`${user.id}.png`)
  })

  test('rejects invalid file types', async ({ client }) => {
    // [!code highlight]
    using fakeDisk = drive.fake()

    const user = await UserFactory.create()

    const pdfFile = await fileGenerator.generatePdf(1)

    await client
      .post('/profile/avatar')
      .file('avatar', pdfFile.contents, {
        filename: pdfFile.name,
        contentType: pdfFile.mime,
      })
      .loginAs(user)
      .assertStatus(422)

    /**
     * Assert no file was stored
     */
    fakeDisk.assertMissing(`${user.id}.pdf`)
  })
})
```

:::note
AdonisJS uses [magic byte detection](https://en.wikipedia.org/wiki/Magic_number_(programming)) to determine file types, not the filename or content type you pass. A plain `Buffer.from('fake-image')` has no valid magic bytes, so VineJS file validation will reject it with `"Invalid file extension undefined"`. Use the `@poppinss/file-generator` package (included in AdonisJS projects) to generate buffers with correct magic bytes for your tests.
:::

You can also fake a specific disk:

```ts title="tests/functional/uploads.spec.ts"
// Fake a specific disk
using fakeDisk = drive.fake('s3')

// Fake multiple disks
using _s3 = drive.fake('s3')
using _gcs = drive.fake('gcs')
```

You can also call `drive.restore()` manually if you need more control over when the real disk is restored.

## Troubleshooting

### Files are corrupted after upload

Some cloud storage providers have issues with streaming uploads. If your files are corrupted after upload, try using the `moveAs: 'buffer'` option to read the file into memory before uploading:

```ts title="app/controllers/uploads_controller.ts"
await file.moveToDisk(key, 's3', {
  moveAs: 'buffer',
})
```

This reads the entire file into memory before sending it to the storage provider, which can resolve compatibility issues with certain providers.

### Understanding file visibility

Drive supports two visibility levels:

- **public**: Files are accessible via URL by anyone. Use `getUrl` to generate URLs.
- **private**: Files are not publicly accessible. Use `getSignedUrl` to generate temporary URLs with an expiration time.

The visibility is set at the disk level in your configuration. All files uploaded to that disk inherit the visibility setting unless overridden.

```ts title="config/drive.ts"
{
  services: {
    // All files on this disk are public
    publicFiles: services.s3({
      // ...credentials
      visibility: 'public',
    }),

    // All files on this disk are private
    privateFiles: services.s3({
      // ...credentials
      visibility: 'private',
    }),
  }
}
```

## See also

- [File uploads guide](../basics/file_uploads.md) for handling multipart HTTP requests
- [FlyDrive documentation](https://flydrive.dev/docs/introduction) for the complete Disk API reference
