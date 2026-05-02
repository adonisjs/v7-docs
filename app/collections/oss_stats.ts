import env from '#start/env'
import vine from '@vinejs/vine'
import app from '@adonisjs/core/services/app'
import { Collection } from '@adonisjs/content'
import { loaders } from '@adonisjs/content/loaders'

const ossStatsSchema = vine
  .object({
    coreStars: vine.number(),
  })
  .allowUnknownProperties()

export const ossStats = Collection.create({
  cache: app.inProduction,
  loader: loaders.ossStats({
    outputPath: app.makePath('content/oss_stats/db.json'),
    refresh: 'weekly',
    sources: [
      async () => {
        const headers: Record<string, string> = {
          accept: 'application/vnd.github+json',
          'user-agent': 'adonisjs-docs',
        }
        const ghToken = env.get('GH_TOKEN')
        if (ghToken) {
          headers.authorization = `Bearer ${ghToken}`
        }
        const response = await fetch('https://api.github.com/repos/adonisjs/core', { headers })
        const body = (await response.json()) as { stargazers_count: number }
        return {
          key: 'coreStars',
          count: body.stargazers_count,
        }
      },
    ],
  }),
  schema: ossStatsSchema,
  views: {
    formatted(data) {
      const numberFormatter = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
      })
      return Object.keys(data).reduce<Record<string, string>>((result, key) => {
        result[key] = numberFormatter.format(data[key] as number)
        return result
      }, {})
    },
  },
})
