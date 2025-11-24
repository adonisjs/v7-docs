import vine from '@vinejs/vine'
import { dirname, relative, resolve } from 'node:path'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { type Infer } from '@vinejs/vine/types'
import { loaders } from '@adonisjs/content/loaders'
import vite from '@adonisjs/vite/services/main'

const singleDoc = vine.object({
  title: vine.string(),
  permalink: vine.string(),
  contentPath: vine.string().toAbsolutePath(),
})

const categoryDocs = vine.object({
  category: vine.string(),
  children: vine.array(singleDoc.clone()),
})

const menuSchema = vine.array(categoryDocs)
const ZONES = ['guides', 'start'] as const

export const docsZones = ZONES.reduce(
  (collections, zone) => {
    const ZONE_DB_FILE = app.makePath('content', zone, 'db.json')

    collections[zone] = Collection.create({
      schema: menuSchema.clone(),
      cache: app.inProduction,
      loader: loaders.jsonLoader(ZONE_DB_FILE),
      views: {
        permalinksTree(data) {
          return data.reduce<Record<string, Infer<typeof singleDoc>>>((result, node) => {
            node.children.forEach((doc) => {
              result[doc.permalink] = doc
            })
            return result
          }, {})
        },
        contentPathsTree(data) {
          return data.reduce<Record<string, Infer<typeof singleDoc>>>((result, node) => {
            node.children.forEach((doc) => {
              result[doc.contentPath] = doc
            })
            return result
          }, {})
        },
        findByPermalink(data, permalink) {
          return this.permalinksTree(data)[permalink] ?? this.permalinksTree(data)[`/${permalink}`]
        },
        findByContentPath(data, contentPath) {
          return this.contentPathsTree(data)[contentPath]
        },
      },
    })

    return collections
  },
  {} as {
    [K in 'guides' | 'start']: Collection<
      typeof menuSchema,
      {
        permalinksTree(data: Infer<typeof menuSchema>): Record<string, Infer<typeof singleDoc>>
        contentPathsTree(data: Infer<typeof menuSchema>): Record<string, Infer<typeof singleDoc>>
        findByPermalink(
          data: Infer<typeof menuSchema>,
          permalink: string
        ): Infer<typeof singleDoc> | undefined
        findByContentPath(
          data: Infer<typeof menuSchema>,
          contentPath: string
        ): Infer<typeof singleDoc> | undefined
      }
    >
  }
)

const start = await docsZones.start.load()
const guides = await docsZones.guides.load()

export function findDoc(permalink: string) {
  let doc = start.findByPermalink(permalink)
  if (doc) {
    return {
      doc,
      zone: start,
    }
  }

  doc = guides.findByPermalink(permalink)
  if (doc) {
    return {
      doc,
      zone: guides,
    }
  }

  return null
}

export function resolveLink(fromFile: string, toFile: string) {
  const contentFilePath = app.makePath(resolve(dirname(fromFile), toFile))
  let doc = start.findByContentPath(contentFilePath)
  if (!doc) {
    doc = guides.findByContentPath(contentFilePath)
  }

  if (doc) {
    return doc.permalink
  }

  return null
}

export function resolveAsset(fromFile: string, toFile: string) {
  const assetAbsolutePath = app.relativePath(resolve(dirname(fromFile), toFile))
  return vite.assetPath(assetAbsolutePath)
}
