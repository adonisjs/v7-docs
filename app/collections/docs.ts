import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { type Infer } from '@vinejs/vine/types'
import { loaders } from '@adonisjs/content/loaders'

const docSchema = vine.object({
  title: vine.string(),
  permalink: vine.string(),
  contentPath: vine.string().toAbsolutePath(),
})

const docsSchema = vine.object({
  category: vine.string(),
  children: vine.array(docSchema.clone()),
})

export const docs = Collection.create({
  schema: vine.array(docsSchema),
  cache: app.inProduction,
  loader: loaders.jsonLoader(app.makePath('content/docs/v7/db.json')),
  views: {
    tree(data) {
      return data.reduce<Record<string, Infer<typeof docSchema>>>((result, node) => {
        node.children.forEach((doc) => {
          result[doc.permalink] = doc
        })
        return result
      }, {})
    },
    findByPermalink(data, permalink: string): Infer<typeof docSchema> | undefined {
      return this.tree(data)[permalink] ?? this.tree(data)[`/${permalink}`]
    },
  },
})
