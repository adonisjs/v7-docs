import edge from 'edge.js'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { DateTime } from 'luxon'
import { tv } from 'tailwind-variants'
import { toText } from 'hast-util-to-text'
import { edgeMarkdown } from 'edge-markdown'
import { icons as uiwIcons } from '@iconify-json/uiw'
import app from '@adonisjs/core/services/app'
import { addCollection, edgeIconify } from 'edge-iconify'
import { icons as mynauiIcons } from '@iconify-json/mynaui'
import { icons as tablerIcons } from '@iconify-json/tabler'
import vite from '@adonisjs/vite/services/main'
import { appUrl } from '#config/app'

edge.use(edgeIconify)
edge.use(edgeMarkdown, {
  prefix: 'markdown',
  highlight: {
    enabled: true,
    langs: [
      'typescript',
      'json',
      'edge',
      'html',
      'sql',
      'bash',
      'dotenv',
      'tsx',
      'handlebars',
      'vue',
      'dockerfile',
      'diff',
    ],
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false,
  },
  allowHTML: true,
})

addCollection(mynauiIcons)
addCollection(uiwIcons)
addCollection(tablerIcons)

/**
 * Inline brand logos from "resources/assets/icons/providers" at render
 * time through the "providerLogo(name)" helper. Reading on demand means
 * an edited SVG shows up without restarting the dev server (the results
 * are cached only in production). The SVGs use "currentColor", so their
 * color is controlled by the surrounding element (e.g. white on a
 * brand-colored tile).
 */
const providerLogosDir = app.makePath('resources/assets/icons/providers')
const providerLogoCache = new Map<string, string>()

edge.global('providerLogo', function (name: string) {
  if (app.inProduction && providerLogoCache.has(name)) {
    return providerLogoCache.get(name)
  }

  const filePath = join(providerLogosDir, `${name}.svg`)
  const svg = existsSync(filePath) ? readFileSync(filePath, 'utf-8').trim() : ''

  if (app.inProduction) {
    providerLogoCache.set(name, svg)
  }

  return svg
})

edge.global('tv', tv)
edge.global('hastToText', toText)
edge.global('DateTime', DateTime)
edge.global('appUrl', appUrl)
edge.global('ogImageAsset', function (ogImage: string | boolean | undefined, requestUrl: string) {
  if (!ogImage) {
    return null
  }

  const pageIdentifier = requestUrl === '/' ? '/index' : requestUrl
  const defaultOgImage = 'resources/assets/og/template.jpg'
  const ogImagePath = ogImage === true ? `resources/assets/og${pageIdentifier}.jpg` : ogImage
  const resolvedOgImagePath = existsSync(app.makePath(ogImagePath)) ? ogImagePath : defaultOgImage

  try {
    return vite.assetPath(resolvedOgImagePath)
  } catch {
    try {
      return vite.assetPath(defaultOgImage)
    } catch {
      return null
    }
  }
})
edge.global('parseCodeblockTitle', function (title: string) {
  if (title.startsWith('❌')) {
    return {
      icon: 'mynaui:x',
      classes: 'size-5 text-red-600 dark:text-red-400',
      title: title.split('❌')[1],
    }
  }

  if (title.startsWith('✅')) {
    return {
      icon: 'mynaui:check',
      classes: 'size-5 text-green-600 dark:text-green-400',
      title: title.split('✅')[1],
    }
  }

  return {
    title,
  }
})

import { type TagContract } from 'edge.js/types'

/**
 * Defining a tag
 */
const rawTag: TagContract = {
  block: true,
  seekable: false,
  tagName: 'raw',
  compile(_, buffer, token) {
    token.children.forEach((child) => {
      switch (child.type) {
        case 'raw':
          buffer.outputRaw(child.value)
          break
        case 'newline':
          buffer.outputRaw('\n')
          break
        case 'comment':
          buffer.outputRaw(child.value)
          break
        case 's__mustache':
          buffer.outputRaw(`{{{${child.properties.jsArg}}}}`)
          break
        case 'mustache':
          buffer.outputRaw(`{{${child.properties.jsArg}}}`)
          break
      }
    })
  },
}

/**
 * Registering it with Edge
 */
edge.registerTag(rawTag)
