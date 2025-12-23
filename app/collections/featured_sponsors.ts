import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { loaders } from '@adonisjs/content/loaders'

export const featuredSponsors = Collection.create({
  cache: app.inProduction,
  loader: loaders.jsonLoader(app.makePath('content/featured_sponsors/db.json')),
  schema: vine.array(
    vine.object({
      logo: vine.string().toAbsolutePath().toContents(),
      name: vine.string(),
      url: vine.string(),
    })
  ),
})
