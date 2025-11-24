---
summary: Learn how to handle file uploads in AdonisJS, from basic single file uploads to advanced direct uploads with cloud storage providers.
---

# File Uploads

This guide covers everything from basic single file uploads to advanced patterns like direct uploads, where files go straight from the browser to cloud storage without touching your server. Understanding file uploads is essential for building applications that need to handle user avatars, document attachments, product images, or any other user-submitted files.

{{TOC}}

## Overview

File uploads allow users to send files from their browsers to your AdonisJS application. Unlike many Node.js frameworks that require additional packages for this functionality, AdonisJS has built-in support for parsing multipart requests and processing file uploads through its bodyparser.

When a file is uploaded, AdonisJS automatically saves it to the server's `tmp` directory. From there, you can validate the file in your controllers and then move it to permanent storage. For permanent storage, AdonisJS integrates with FlyDrive, which provides a unified API for working with local file systems as well as cloud storage solutions like Amazon S3, Cloudflare R2, and Google Cloud Storage.

## Creating your first file upload

We'll build a feature that allows users to update their profile avatar. This is a common requirement and demonstrates all the essential concepts.

### Step 1: Create the upload form

First, create a form that accepts file uploads. The critical part is setting `enctype="multipart/form-data"` on the form element. Without this attribute, the browser won't send files correctly.

```edge
{{-- title: resources/views/pages/profile.edge --}}
@form({ route: 'profile_avatar.update', enctype: 'multipart/form-data' })
  @field.root({ name: 'avatar' })
    @!input.control({ type: 'file' })
    @!field.label({ text: 'Upload new avatar' })
    @!field.error()
  @end
  
  <button type="submit">Update Avatar</button>
@end
```

### Step 2: Register the route

Next, register a route to handle the file upload.

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.put('/profile/avatar', [controllers.ProfileAvatar, 'update']).as('profile_avatar.update')
```

### Step 3: Create the controller

Now create a controller that accepts the uploaded file. The `request.file()` method gives you access to the uploaded file by its field name.

```ts
// title: app/controllers/profile_avatar_controller.ts
import { HttpContext } from '@adonisjs/core/http'

export default class ProfileAvatarController {
  async update({ request, response }: HttpContext) {
    /**
     * Access the uploaded file by its field name.
     * The file is already saved in the tmp directory at this point.
     */
    const avatar = request.file('avatar')
    
    if (!avatar) {
      return response.badRequest('Please upload an avatar image')
    }
    
    /**
     * Log the file properties to see what information is available.
     * Common properties: tmpPath, clientName, size, extname, type
     */
    console.log(avatar)
    
    return 'Avatar uploaded successfully'
  }
}
```

At this point, your application can receive file uploads. The file object contains useful properties:

- `tmpPath` - Where the file is currently stored on your server
- `clientName` - The original filename from the user's computer
- `size` - File size in bytes
- `extname` - File extension (e.g., 'jpg', 'png')
- `type` - MIME type (e.g., 'image/jpeg')

## Validating uploaded files

Accepting any file without validation is dangerous. Users might upload files that are too large, have incorrect formats, or could even be malicious. AdonisJS provides two approaches for validation.

### Inline validation

You can validate files directly in the `request.file()` call by passing validation options as the second argument.

```ts
// title: app/controllers/profile_avatar_controller.ts
import { HttpContext } from '@adonisjs/core/http'

export default class ProfileAvatarController {
  async update({ request, response }: HttpContext) {
    /**
     * Validate the file inline by specifying size and allowed extensions.
     * If validation fails, the file.errors property will contain error messages.
     */
    const avatar = request.file('avatar', {
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg']
    })
    
    if (!avatar) {
      return response.badRequest('Please upload an avatar image')
    }
    
    /**
     * Check if validation failed.
     * The errors array will contain messages if the file is too large
     * or has an invalid extension.
     */
    if (avatar.hasErrors) {
      return response.badRequest(avatar.errors)
    }
    
    return 'Avatar uploaded and validated successfully'
  }
}
```

### VineJS validation (recommended)

While inline validation works, using VineJS validators is the recommended approach because it provides better error messages, consistent validation patterns, and easier testing.

First, create a validator file:

```ts
// title: app/validators/user.ts
import vine from '@vinejs/vine'

/**
 * Validator for avatar uploads.
 * Using VineJS allows you to validate files alongside other form fields
 * and provides consistent error handling across your application.
 */
export const updateAvatarValidator = vine.compile(
  vine.object({
    avatar: vine.file({
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg']
    })
  })
)
```

Then use the validator in your controller:

```ts
// title: app/controllers/profile_avatar_controller.ts
import { HttpContext } from '@adonisjs/core/http'
import { updateAvatarValidator } from '#validators/user'

export default class ProfileAvatarController {
  async update({ request }: HttpContext) {
    /**
     * Validate using VineJS validator.
     * If validation fails, AdonisJS automatically returns a 422 response
     * with detailed error messages. If validation succeeds, you get the
     * validated data in the payload object.
     */
    const payload = await request.validateUsing(updateAvatarValidator)
    
    /**
     * The avatar is now validated and safe to use.
     * It has passed size and extension checks.
     */
    console.log(payload.avatar)
    
    return 'Avatar validated successfully'
  }
}
```

A key security feature of AdonisJS is that it uses magic number detection to validate file types. This means even if someone renames a `.exe` file to `.jpg`, AdonisJS will detect the actual file type and reject it. This protects your application from users trying to bypass validation by simply changing file extensions.

## Setting up FlyDrive for permanent storage

Files uploaded through forms are temporarily stored in the `tmp` directory. Most operating systems automatically clean up temporary files, so you cannot rely on them persisting. For permanent storage, you need to move files to a location where they will be preserved.

AdonisJS uses FlyDrive for permanent file storage. FlyDrive provides a unified API that works with local file systems during development and cloud storage providers like S3 or R2 in production.

### Installing FlyDrive

Run the following command to install and configure FlyDrive:

```bash
node ace add @adonisjs/drive
```

This command installs the `@adonisjs/drive` package and creates a `config/drive.ts` configuration file. The `@adonisjs/drive` package is a thin wrapper over FlyDrive that integrates seamlessly with AdonisJS. For detailed configuration options, refer to the [FlyDrive documentation](https://flydrive.dev) and the Drive reference guide.

After installation, FlyDrive is ready to use with a local disk configuration for development.

### Moving files to permanent storage

Once FlyDrive is installed, you can move validated files from the `tmp` directory to permanent storage. The `@adonisjs/drive` package extends the file object with a `moveToDisk()` method that handles this automatically.

```ts
// title: app/controllers/profile_avatar_controller.ts
import { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import { updateAvatarValidator } from '#validators/user'

export default class ProfileAvatarController {
  async update({ request, auth }: HttpContext) {
    const payload = await request.validateUsing(updateAvatarValidator)
    
    /**
     * Generate a unique filename using UUID to prevent collisions.
     * Multiple users might upload files named "avatar.jpg", so we need
     * unique names to prevent overwriting.
     */
    const fileName = `${string.uuid()}.${payload.avatar.extname}`
    
    /**
     * Move the file from tmp to permanent storage.
     * The moveToDisk method uses the configured disk (local filesystem
     * in development, or cloud storage in production).
     */
    await payload.avatar.moveToDisk(fileName)
    
    /**
     * Store the filename in the database so you can retrieve it later.
     * You'll need this to display the avatar or allow users to download it.
     */
    const user = auth.getUserOrFail()
    user.avatarFileName = fileName
    await user.save()
    
    return 'Avatar uploaded and saved successfully'
  }
}
```

After moving the file, it's available on the file object through two new properties:

- `fileName` - The name you specified when moving the file
- `filePath` - The full path where the file was stored

By default, FlyDrive stores files in the `storage` directory when using the local disk. The `@adonisjs/drive` package includes a built-in file server that automatically serves uploaded files. The file server registers a route at `/uploads` followed by your directory structure, making files accessible without additional configuration.

For example, if you store a file as `avatars/123e4567.jpg`, it will be accessible at `/uploads/avatars/123e4567.jpg`.


:::note {title=“What you learned so far“}

- ✓ Create forms with the correct `enctype` for file uploads
- ✓ Access uploaded files using `request.file()`
- ✓ Validate files using VineJS validators
- ✓ Install and configure FlyDrive
- ✓ Move files from temporary to permanent storage
- ✓ Generate unique filenames to prevent collisions
- ✓ Store file references in your database

:::

## Intermediate: Uploading multiple files

Many applications need to accept multiple files in a single request. For example, allowing users to upload several documents for a project, or multiple product images at once.

### Accepting multiple files in the form

To accept multiple files, add the `multiple` attribute to your file input and use an array-style field name.

```edge
{{-- title: resources/views/pages/project.edge --}}
@form({ route: 'projects.documents.store', enctype: 'multipart/form-data' })
  @field.root({ name: 'documents[]' })
    @!input.control({ type: 'file', multiple: true })
    @!field.label({ text: 'Upload project documents' })
    @!field.error()
  @end
  
  <button type="submit">Upload Documents</button>
@end
```

### Accessing multiple files

Use `request.files()` (plural) instead of `request.file()` to access multiple uploaded files. This method returns an array of file objects.

```ts
// title: app/controllers/project_documents_controller.ts
import { HttpContext } from '@adonisjs/core/http'

export default class ProjectDocumentsController {
  async store({ request, response }: HttpContext) {
    /**
     * Access multiple files using the plural method.
     * This returns an array of file objects, even if only one file was uploaded.
     */
    const documents = request.files('documents')
    
    if (documents.length === 0) {
      return response.badRequest('Please upload at least one document')
    }
    
    console.log(`Received ${documents.length} documents`)
    
    return 'Documents uploaded successfully'
  }
}
```

### Validating multiple files

With VineJS, use `vine.array()` to validate an array of files.

```ts
// title: app/validators/project.ts
import vine from '@vinejs/vine'

export const uploadDocumentsValidator = vine.compile(
  vine.object({
    /**
     * Validate an array of file uploads.
     * Each file must meet the specified size and extension requirements.
     */
    documents: vine.array(
      vine.file({
        size: '5mb',
        extnames: ['pdf', 'doc', 'docx', 'txt']
      })
    )
  })
)
```

### Processing multiple files

Loop through the validated files and move each one to permanent storage individually.

```ts
// title: app/controllers/project_documents_controller.ts
import { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import { uploadDocumentsValidator } from '#validators/project'

export default class ProjectDocumentsController {
  async store({ request, params }: HttpContext) {
    const payload = await request.validateUsing(uploadDocumentsValidator)
    const fileNames: string[] = []
    
    /**
     * Process each file individually.
     * Generate a unique name and move it to permanent storage.
     */
    for (const document of payload.documents) {
      const fileName = `${string.uuid()}.${document.extname}`
      await document.moveToDisk(fileName)
      fileNames.push(fileName)
    }
    
    /**
     * Store the array of filenames in your database.
     * You might store this as JSON or create separate records
     * in a documents table.
     */
    // await Project.find(params.id).related('documents').createMany(...)
    
    return { message: 'Documents uploaded', count: fileNames.length }
  }
}
```

The process for multiple files is similar to single files, but you work with arrays instead of individual objects. Each file in the array has the same properties and methods as single files, including `moveToDisk()`.

## Advanced: Direct uploads

Direct uploads allow files to be uploaded directly from the browser to cloud storage providers like S3, R2, or Google Cloud Storage, completely bypassing your AdonisJS server. 

Instead of the standard flow where files travel from `browser → your server → cloud storage`, direct uploads go straight from `browser → cloud storage`. Your server only generates a short-lived signed URL that grants temporary permission to upload to a specific location.

This pattern is recommended when handling large file uploads, typically above 100MB. Building a fault-tolerant and resumable upload server for large files is complex work. By using direct uploads, you offload that responsibility to specialized services designed for this purpose. 

Additional benefits include reduced server bandwidth usage, better upload performance for users, and built-in resumable uploads from cloud providers.

### Implementing direct uploads

You'll need an account with a cloud storage provider like Amazon S3, Cloudflare R2, or Google Cloud Storage. Make sure FlyDrive is configured with your cloud provider credentials (refer to the Drive reference guide for configuration details).

Create an endpoint that generates signed upload URLs:

```ts
// title: start/routes.ts
import router from '@adonisjs/core/services/router'
import drive from '@adonisjs/drive/services/main'

router.post('/signed-upload-url', async ({ request }) => {
  /**
   * The client provides the filename they want to upload.
   * Consider validating this and generating unique filenames
   * to prevent collisions.
   */
  const fileName = request.input('file_name')
  
  /**
   * Generate a signed URL with a 30-minute expiration.
   * Replace 'r2' with your configured disk name (could be 's3', 'gcs', etc.)
   */
  const url = await drive.use('r2').getSignedUploadUrl(fileName, {
    expiresIn: '30 mins',
  })
  
  return { signedUrl: url }
})
```

### Client-side implementation

The client-side code is more complex than standard form uploads. You'll need a JavaScript library that handles the upload process, progress tracking, and error handling. Popular libraries include [Uppy.io](https://uppy.io/), [Filepond](https://pqina.nl/filepond/), or you can use native JavaScript with the Fetch API for custom implementations.

Here's a high-level example using the Fetch API:

```javascript
// Client-side JavaScript example
async function uploadFile(file) {
  // Step 1: Request a signed URL from your server
  const response = await fetch('/signed-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name })
  })
  
  const { signedUrl } = await response.json()
  
  // Step 2: Upload directly to cloud storage using the signed URL
  await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  })
  
  console.log('File uploaded successfully!')
}
```

For production applications, consider using a library like Uppy.io that provides additional features like upload progress tracking, automatic retries, resumable uploads, and user-friendly interfaces.

## Security: Restricting file upload routes

Now that you understand how to implement file uploads, it's important to secure your application against potential abuse.

By default, AdonisJS processes multipart requests (file uploads) on all routes that use `POST`, `PUT`, and `PATCH` methods. This means any endpoint in your application can potentially receive and process file uploads, even if you didn't intend for it to handle files. This unrestricted access allows attackers to target any endpoint in your application to upload files, potentially straining your server's resources, filling up disk space, or using your application to distribute malicious content.

As a first security measure, you must enable file uploads only on specific routes that actually need to handle files. Configure this in your bodyparser settings:

```ts
// title: config/bodyparser.ts
import { defineConfig } from '@adonisjs/core/bodyparser'

export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  
  multipart: {
    /**
     * Only enable multipart processing on routes that handle file uploads.
     * This prevents attackers from uploading files to random endpoints.
     */
    enabled: ['/profile/avatar', '/users/:id', '/projects/:id/files']
  },
})
```

If you have public endpoints that accept file uploads (endpoints that don't require authentication), apply strict rate limiting to prevent abuse. See the rate limiting guide for implementation details.

For comprehensive bodyparser configuration options, refer to the BodyParser reference guide.

## See also

- [VineJS Validation Documentation](https://vinejs.dev) - Complete guide to validation including file validation
- [FlyDrive Documentation](https://flydrive.dev) - Comprehensive documentation for the underlying storage library
- Drive Reference Guide - Detailed configuration options for `@adonisjs/drive`
- BodyParser Reference Guide - Complete bodyparser configuration reference including multipart options
- Rate Limiting Guide - Protect file upload endpoints from abuse