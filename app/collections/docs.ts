import vine from '@vinejs/vine'
import { dirname, resolve } from 'node:path'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { type Infer } from '@vinejs/vine/types'
import vite from '@adonisjs/vite/services/main'
import { loaders } from '@adonisjs/content/loaders'

const noSnakeCase = vine.createRule((value, _, field) => {
  if ((value as string).includes('_')) {
    field.report(
      `The value for (${field.parent.title}) cannot be in snakecase`,
      'no_snake_case',
      field
    )
  }
})
const noDashCase = vine.createRule((value, _, field) => {
  if ((value as string).includes('-')) {
    field.report('The field value cannot be in dashcase', 'no_dash_case', field)
  }
})

export const singleDoc = vine.object({
  title: vine.string(),
  permalink: vine.string().use(noSnakeCase()).optional().requiredIfMissing('variations'),
  variations: vine
    .array(
      vine.object({
        name: vine.string(),
        permalink: vine.string().use(noSnakeCase()),
        contentPath: vine.string().use(noDashCase()).toAbsolutePath(),
      })
    )
    .optional()
    .requiredIfMissing('permalink'),
  oldUrls: vine.array(vine.string()).optional(),
  contentPath: vine
    .string()
    .use(noDashCase())
    .toAbsolutePath()
    .optional()
    .requiredIfMissing('variations'),
})

export const categoryDocs = vine.object({
  category: vine.string(),
  children: vine.array(singleDoc.clone()),
})

export const menuSchema = vine.array(categoryDocs)

const sectionsNames: ['guides', 'start', 'reference'] = ['guides', 'start', 'reference']
export const docsSections = Collection.multi(sectionsNames, (section) => {
  return Collection.create({
    schema: menuSchema.clone(),
    cache: app.inProduction,
    loader: loaders.jsonLoader(app.makePath('content', section, 'db.json')),
    views: {
      menu(data: Infer<typeof menuSchema>, variation?: string) {
        return data.map((node) => {
          return {
            category: node.category,
            isChild(permalink: string): boolean {
              return !!node.children.find((child) => child.permalink === permalink)
            },
            children: node.children.map((child) => {
              if (child.permalink) {
                return child
              }
              const matchingVariant =
                child.variations!.find((variant) => variant.name === variation) ??
                child.variations?.[0]

              return {
                ...child,
                permalink: matchingVariant?.permalink,
                contentPath: matchingVariant?.contentPath,
              }
            }),
          }
        })
      },
      permalinksTree(data: Infer<typeof menuSchema>) {
        return data.reduce<Record<string, Infer<typeof singleDoc>>>((result, node) => {
          node.children.forEach((doc) => {
            if (doc.permalink) {
              result[doc.permalink] = doc
            }
            doc.variations?.forEach((variation) => {
              result[variation.permalink] = {
                ...doc,
                permalink: variation.permalink,
                contentPath: variation.contentPath,
              }
            })
          })
          return result
        }, {})
      },
      contentPathsTree(data: Infer<typeof menuSchema>) {
        return data.reduce<Record<string, Infer<typeof singleDoc>>>((result, node) => {
          node.children.forEach((doc) => {
            if (doc.contentPath) {
              result[doc.contentPath] = doc
            }
            doc.variations?.forEach((variation) => {
              result[variation.contentPath] = {
                ...doc,
                permalink: variation.permalink,
                contentPath: variation.contentPath,
              }
            })
          })
          return result
        }, {})
      },
      findByPermalink(data: Infer<typeof menuSchema>, permalink: string) {
        return this.permalinksTree(data)[permalink] ?? this.permalinksTree(data)[`/${permalink}`]
      },
      has(data: Infer<typeof menuSchema>, permalink: string) {
        return !!this.findByPermalink(data, permalink)
      },
      findByContentPath(data: Infer<typeof menuSchema>, contentPath: string) {
        return this.contentPathsTree(data)[contentPath]
      },
    },
  })
})

export async function findDoc(permalink: string) {
  const sections = await docsSections.load()

  for (const sectionName of sectionsNames) {
    const section = sections[sectionName]
    const doc = section.findByPermalink(permalink)
    if (doc) {
      return {
        doc,
        section,
        sections,
      }
    }
  }

  return null
}

export async function resolveLink(fromFile: string, toFile: string) {
  const contentFilePath = app.makePath(resolve(dirname(fromFile), toFile))
  const sections = await docsSections.load()

  for (const sectionName of sectionsNames) {
    const section = sections[sectionName]
    const doc = section.findByContentPath(contentFilePath)
    if (doc) {
      return `/${doc.permalink}`
    }
  }
  return null
}

export function resolveAsset(fromFile: string, toFile: string) {
  const assetAbsolutePath = app.relativePath(resolve(dirname(fromFile), toFile))
  return vite.assetPath(assetAbsolutePath)
}
