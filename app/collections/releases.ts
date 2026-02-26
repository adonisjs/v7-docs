import env from '#start/env'
import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { loaders } from '@adonisjs/content/loaders'

const releases = vine.array(
  vine.object({
    repo: vine.string(),
    name: vine.string(),
    tagName: vine.string(),
    publishedAt: vine.string(),
    url: vine.string(),
  })
)

export const adonisJsReleases = Collection.create({
  cache: false,
  loader: loaders.ghReleases({
    ghToken: env.get('GH_TOKEN'),
    outputPath: app.makePath('content/releases.json'),
    org: 'adonisjs',
    refresh: 'weekly',
    filters: {
      nameDoesntInclude: ['Update dependencies', 'Tag as latest'],
    },
  }),
  schema: releases,
  views: {
    groupedByMonth(data) {
      const grouped = new Map<
        string,
        { year: number; month: number; date: Date; releases: typeof data }
      >()

      for (const release of data) {
        const date = new Date(release.publishedAt)
        const year = date.getFullYear()
        const month = date.getMonth() + 1 // 1-based month
        const key = `${year}-${month.toString().padStart(2, '0')}`

        if (!grouped.has(key)) {
          grouped.set(key, { year, month, date, releases: [] })
        }

        grouped.get(key)!.releases.push(release)
      }

      return Array.from(grouped.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
    },
  },
})
