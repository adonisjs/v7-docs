---
description: Learn how to handle file uploads in AdonisJS, from basic single file uploads to advanced direct uploads with cloud storage providers.
---

# File Uploads

This guide covers file uploads in AdonisJS, from basic single file uploads to advanced direct uploads with cloud storage providers. You will learn how to:

- Accept and validate file uploads in your application
- Store files permanently using FlyDrive
- Handle multiple file uploads and direct cloud uploads
- Secure your file upload endpoints

## Overview

File uploads allow users to send files from their browsers to your AdonisJS application. Unlike many Node.js frameworks that require additional packages for this functionality, AdonisJS has built-in support for parsing multipart requests and processing file uploads through its bodyparser.

When a file is uploaded, AdonisJS automatically saves it to the server's `tmp` directory. From there, you can validate the file in your controllers and then move it to permanent storage. 

For permanent storage, AdonisJS integrates with [FlyDrive](https://flydrive.dev/docs/introduction), which provides a unified API for working with local file systems as well as cloud storage solutions like Amazon S3, Cloudflare R2, and Google Cloud Storage.

## Uploading your first file

We'll build a feature that allows users to update their profile avatar. This is a common requirement and demonstrates all the essential concepts.

::::steps

:::step{title="Create the upload form"}

First, create a form that accepts file uploads. The critical part is setting the form encoding to `multipart/form-data`. Without this, the browser won't send files correctly.

::::tabs

:::tab{title="Edge (Hypermedia)"}
```edge title="resources/views/pages/profile.edge"
@form({ route: 'profile_avatar.update', enctype: 'multipart/form-data' })
  @field.root({ name: 'avatar' })
    @!input.control({ type: 'file' })
    @!field.label({ text: 'Upload new avatar' })
    @!field.error()
  @end

  @!button({ type: 'Submit', text: 'Update Avatar' })
@end
```
:::

:::tab{title="React (Inertia)"}
```tsx title="inertia/pages/profile.tsx"
import { Form } from '@adonisjs/inertia/react'

export default function Profile() {
  return (
    <Form route="profile_avatar.update" encType="multipart/form-data">
      {({ errors }) => (
        <>
          <div>
            <label htmlFor="avatar">Upload new avatar</label>
            <input type="file" name="avatar" id="avatar" />
            {errors.avatar && <div>{errors.avatar}</div>}
          </div>
          <button type="submit">Update Avatar</button>
        </>
      )}
    </Form>
  )
}
```
:::

::::

:::

:::step{title="Register the route"}

Next, register a route to handle the file upload.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.put('/profile/avatar', [controllers.profileAvatar, 'update'])
```

:::

:::step{title="Create the controller"}

Now create a controller that accepts the uploaded file. The `request.file()` method gives you access to the uploaded file by its field name.

```ts title="app/controllers/profile_avatar_controller.ts"
import { HttpContext } from '@adonisjs/core/http'

export default class ProfileAvatarController {
  async update({ request, response }: HttpContext) {
    const avatar = request.file('avatar')
    
    if (!avatar) {
      return response.badRequest('Please upload an avatar image')
    }
    
    console.log(avatar)
    
    return 'Avatar uploaded successfully'
  }
}
```

At this point, your application can receive file uploads. The file is already saved in the tmp directory when you access it. The file object contains useful properties:

- `tmpPath` - Where the file is currently stored on your server
- `clientName` - The original filename from the user's computer
- `size` - File size in bytes
- `extname` - File extension (e.g., 'jpg', 'png')
- `type` - MIME type (e.g., 'image/jpeg')

:::

::::

## Validating uploaded files

Accepting any file without validation is dangerous. Users might upload files that are too large, have incorrect formats, or could even be malicious. AdonisJS provides two approaches for validation.

### Inline validation

You can validate files directly in the `request.file()` call by passing validation options as the second argument.

```ts title="app/controllers/profile_avatar_controller.ts"
import { HttpContext } from '@adonisjs/core/http'

export default class ProfileAvatarController {
  async update({ request, response }: HttpContext) {
    const avatar = request.file('avatar', {
      size: '2mb',
      extnames: ['jpg', 'png', 'jpeg']
    })

    if (!avatar) {
      return response.badRequest('Please upload an avatar image')
    }
    
    if (avatar.hasErrors) {
      return response.badRequest(avatar.errors)
    }
    
    return 'Avatar uploaded and validated successfully'
  }
}
```

The validation happens as soon as you call `request.file()`. If the file is too large or has an invalid extension, the `avatar.hasErrors` property will be `true` and the `avatar.errors` array will contain error messages.

### VineJS validation

While inline validation works, using VineJS validators is the recommended approach because it provides better error messages, consistent validation patterns, and easier testing.

First, create a validator file.

```ts title="app/validators/user.ts"
import vine from '@vinejs/vine'

export const updateAvatarValidator = vine.create({
  avatar: vine.file({
    size: '2mb',
    extnames: ['jpg', 'png', 'jpeg']
  })
})
```

Then use the validator in your controller.

```ts title="app/controllers/profile_avatar_controller.ts"
import { HttpContext } from '@adonisjs/core/http'
import { updateAvatarValidator } from '#validators/user'

export default class ProfileAvatarController {
  async update({ request }: HttpContext) {
    const payload = await request.validateUsing(updateAvatarValidator)    

    console.log(payload.avatar)    
    return 'Avatar uploaded and validated successfully'
  }
}
```

If validation fails, AdonisJS automatically returns a 422 response with detailed error messages. If validation succeeds, you get the validated data in the payload object. The avatar has passed size and extension checks at this point.

:::tip{title="Security feature"}
A key security feature of AdonisJS is that it uses [magic number detection](https://en.wikipedia.org/wiki/Magic_number_(programming)) to validate file types. This means even if someone renames a `.exe` file to `.jpg`, AdonisJS will detect the actual file type and reject it. This protects your application from users trying to bypass validation by simply changing file extensions.
:::

### Combining files with other fields

When your form includes both file uploads and regular fields, the validated payload contains both. Destructure the file field separately before passing the remaining data to your model — passing a multipart file object directly to `Model.create()` will cause an error:

```ts title="app/validators/task.ts"
import vine from '@vinejs/vine'

export const createTaskValidator = vine.create({
  title: vine.string(),
  description: vine.string().optional(),
  attachment: vine.file({ size: '5mb', extnames: ['pdf', 'jpg', 'png'] }).optional(),
})
```

```ts title="app/controllers/tasks_controller.ts"
import { HttpContext } from '@adonisjs/core/http'
import { createTaskValidator } from '#validators/task'

export default class TasksController {
  async store({ request }: HttpContext) {
    // [!code highlight:2]
    const { attachment, ...data } = await request.validateUsing(createTaskValidator)

    const task = await Task.create(data)

    if (attachment) {
      await attachment.moveToDisk(`tasks/${task.id}.${attachment.extname}`)
      task.attachmentFileName = `tasks/${task.id}.${attachment.extname}`
      await task.save()
    }

    return task
  }
}
```

The `{ attachment, ...data }` destructuring separates the file from the scalar fields so you can pass `data` directly to the model and handle the file separately.

## Storing and serving uploaded files

Files uploaded through forms are temporarily stored in the `tmp` directory. Most operating systems automatically clean up temporary files, so you cannot rely on them persisting. For permanent storage, you need to move files to a location where they will be preserved.

AdonisJS uses [FlyDrive](../digging_deeper/drive.md) for permanent file storage. FlyDrive provides a unified API that works with local file systems during development and cloud storage providers like S3 or R2 in production.

Install and configure FlyDrive by running the following command:

```bash
node ace add @adonisjs/drive
```

This command installs the `@adonisjs/drive` package and creates a `config/drive.ts` configuration file with local disk storage ready to use. For cloud storage configuration (S3, R2, GCS), see the [Drive documentation](../digging_deeper/drive.md).

### Moving files to permanent storage

Once FlyDrive is installed, you can move validated files from the `tmp` directory to permanent storage. The `@adonisjs/drive` package extends the file object with a `moveToDisk()` method that handles this automatically.

```ts title="app/controllers/profile_avatar_controller.ts"
import { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import { updateAvatarValidator } from '#validators/user'

export default class ProfileAvatarController {
  async update({ request, auth }: HttpContext) {
    const payload = await request.validateUsing(updateAvatarValidator)
    
    /**
     * Use a unique random name for storing the file
     */
    const fileName = `${string.uuid()}.${payload.avatar.extname}`
    
    /**
     * Move file using the pre-configured drive disk.
     */
    // [!code highlight]
    await payload.avatar.moveToDisk(fileName)
    
    /**
     * Update user row in the database to reflect the newly
     * updated avatar filename
     */
    const user = auth.getUserOrFail()
    user.avatarFileName = fileName
    await user.save()
    
    return 'Avatar uploaded and saved successfully'
  }
}
```

- We generate a unique filename using UUID to prevent collisions. Multiple users might upload files named "avatar.jpg", so unique names prevent overwriting.

- The `moveToDisk()` method handles the transfer from tmp to permanent storage. It uses the configured disk (local filesystem in development or cloud storage in production).

- Store the filename in your database after moving. You'll need it later to display the avatar or generate download links.

### Accessing your uploaded files

The `@adonisjs/drive` package includes a built-in file server that automatically serves uploaded files. The file server registers routes under `/uploads` followed by your directory structure.

For example, if you store a file as `avatars/123e4567.jpg`, it becomes accessible at:

```
http://localhost:3333/uploads/avatars/123e4567.jpg
```

Now, instead of hardcoding this path, use the appropriate method for your application type to generate the URL. This ensures the correct URL is returned whether you're using local storage or cloud providers like S3 or R2.

::::tabs

:::tab{title="Edge (Hypermedia)"}
Use the `driveUrl` Edge helper in your templates:

```edge
<img src="{{ await driveUrl(user.avatarFileName) }}" alt="User avatar">
```
:::

:::tab{title="API / Inertia"}
In controllers that return JSON or render Inertia pages, use the `drive` service to generate URLs:

```ts
import drive from '@adonisjs/drive/services/main'

// Inside a controller or transformer
const avatarUrl = await drive.use().getUrl(user.avatarFileName)
```

You can include this URL in your API response or Inertia props:

```ts
return inertia.render('profile', {
  user: {
    name: user.name,
    avatarUrl: await drive.use().getUrl(user.avatarFileName),
  }
})
```
:::

::::

## Uploading multiple files

Many applications need to accept multiple files in a single request. For example, allowing users to upload several documents for a project, or multiple product images at once.

### Accepting multiple files in the form

To accept multiple files, add the `multiple` attribute to your file input and use an array-style field name.

```edge title="resources/views/pages/project.edge"
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

Use `request.files()` (plural) instead of `request.file()` to access multiple uploaded files. This method returns an array of file objects, even if only one file was uploaded.

```ts title="app/controllers/project_documents_controller.ts"
import { HttpContext } from '@adonisjs/core/http'

export default class ProjectDocumentsController {
  async store({ request, response }: HttpContext) {
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

With VineJS, use `vine.array()` to validate an array of files. Each file in the array must meet the specified size and extension requirements.

```ts title="app/validators/project.ts"
import vine from '@vinejs/vine'

export const uploadDocumentsValidator = vine.create({
  documents: vine.array(
    vine.file({
      size: '5mb',
      extnames: ['pdf', 'doc', 'docx', 'txt'],
    })
  ),
})
```

### Processing multiple files

Loop through the validated files and move each one to permanent storage individually. Each file in the array has the same properties and methods as single files, including `moveToDisk()`.

```ts title="app/controllers/project_documents_controller.ts"
import { HttpContext } from '@adonisjs/core/http'
import string from '@adonisjs/core/helpers/string'
import { uploadDocumentsValidator } from '#validators/project'

export default class ProjectDocumentsController {
  async store({ request, params }: HttpContext) {
    const payload = await request.validateUsing(uploadDocumentsValidator)
    const fileNames: string[] = []
    
    for (const document of payload.documents) {
      const fileName = `${string.uuid()}.${document.extname}`
      await document.moveToDisk(fileName)
      fileNames.push(fileName)
    }
    
    return { message: 'Documents uploaded', count: fileNames.length }
  }
}
```

## Direct uploads

Direct uploads allow files to be uploaded directly from the browser to cloud storage providers like S3, R2, or Google Cloud Storage, completely bypassing your AdonisJS server. 

Instead of the standard flow where files travel from `browser → your server → cloud storage`, direct uploads go straight from `browser → cloud storage`. Your server only generates a short-lived signed URL that grants temporary permission to upload to a specific location.

This pattern is recommended when handling large file uploads, typically above 100MB. Building a fault-tolerant and resumable upload server for large files is complex work. By using direct uploads, you offload that responsibility to specialized services designed for this purpose. 

Additional benefits include reduced server bandwidth usage, better upload performance for users, and built-in resumable uploads from cloud providers.

### Implementing direct uploads

You'll need an account with a cloud storage provider like Amazon S3, Cloudflare R2, or Google Cloud Storage. Make sure FlyDrive is configured with your cloud provider credentials (refer to the Drive reference guide for configuration details).

Create an endpoint that generates signed upload URLs.

```ts title="start/routes.ts"
import router from '@adonisjs/core/services/router'
import drive from '@adonisjs/drive/services/main'

router.post('/signed-upload-url', async ({ request }) => {
  const fileName = request.input('file_name')
  
  const url = await drive.use('r2').getSignedUploadUrl(fileName, {
    expiresIn: '30 mins',
  })
  
  return { signedUrl: url }
})
```

The client provides the filename they want to upload. You should consider validating this and generating unique filenames to prevent collisions.

The signed URL expires after 30 minutes to prevent long-term unauthorized access. Replace 'r2' with your configured disk name (could be 's3', 'gcs', etc.).

### Client-side implementation

The client-side code is more complex than standard form uploads. You'll need a JavaScript library that handles the upload process, progress tracking, and error handling. Popular libraries include [Uppy.io](https://uppy.io/), [Filepond](https://pqina.nl/filepond/), or you can use native JavaScript with the Fetch API for custom implementations.

Here's a high-level example using the Fetch API.

```javascript
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

The first step requests a signed URL from your AdonisJS application. The second step uses that URL to upload the file directly to cloud storage.

For production applications, consider using a library like Uppy.io that provides additional features like upload progress tracking, automatic retries, resumable uploads, and user-friendly interfaces.

## Restricting file upload routes

Now that you understand how to implement file uploads, it's important to secure your application against potential abuse.

By default, AdonisJS processes multipart requests (file uploads) on all routes that use `POST`, `PUT`, and `PATCH` methods. This means any endpoint in your application can potentially receive and process file uploads, even if you didn't intend for it to handle files. This unrestricted access allows attackers to target any endpoint in your application to upload files, potentially straining your server's resources, filling up disk space, or using your application to distribute malicious content.

As a first security measure, you must allow multipart auto-processing only on specific routes that actually need to handle files. Configure this in your bodyparser settings.

```ts title="config/bodyparser.ts"
import { defineConfig } from '@adonisjs/core/bodyparser'

export default defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  
  multipart: {
    autoProcess: ['/profile/avatar', '/users/:id', '/projects/:id/files']
  },
})
```

This configuration ensures that only the specified routes will process multipart requests. All other routes will reject file uploads, preventing attackers from uploading files to random endpoints.

If you have public endpoints that accept file uploads (endpoints that don't require authentication), apply strict rate limiting to prevent abuse. See the [rate limiting guide](../../guides/security/rate_limiting.md) for implementation details.

For comprehensive bodyparser configuration options, refer to the [BodyParser guide](./body_parser.md).
