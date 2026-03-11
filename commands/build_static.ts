import edge from 'edge.js'
import { Socket } from 'node:net'
import { dirname } from 'node:path'
import { inject } from '@adonisjs/core'
import { Router } from '@adonisjs/core/http'
import { IncomingMessage } from 'node:http'
import { type Infer } from '@vinejs/vine/types'
import { BaseCommand } from '@adonisjs/core/ace'
import { type singleDoc } from '#collections/docs'
import { appUrl } from '#config/app'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { RequestFactory } from '@adonisjs/core/factories/http'

export default class BuildStatic extends BaseCommand {
  static commandName = 'build:static'
  static description = 'Converts the entire website to a static build'

  static options: CommandOptions = {
    startApp: true,
  }

  #createView(url: string) {
    const req = new IncomingMessage(new Socket())
    req.url = url

    const request = new RequestFactory()
      .merge({
        req,
      })
      .create()
    return edge.share({ request })
  }

  async #writeOutput(uri: string, html: string, extension: 'html' | 'md') {
    const outputPath = this.app.makePath('build/public', `${uri}.${extension}`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
  }

  async #compileDoc(doc: Infer<typeof singleDoc> & { variant?: string }) {
    const { DocService } = await import('#services/doc_service')
    const docsService = await this.app.container.make(DocService)
    if (doc.permalink) {
      const html = await docsService.renderDoc(doc.permalink, this.#createView(`/${doc.permalink}`))
      await this.#writeOutput(doc.permalink, html, 'html')

      const mdPath = await docsService.retrieveLlmPath(doc.permalink)
      await this.#writeOutput(doc.permalink, await readFile(mdPath, 'utf-8'), 'md')
    } else {
      await Promise.all(
        doc.variations!.map((variation) => {
          return this.#compileDoc({
            ...doc,
            permalink: variation.permalink,
            contentPath: variation.contentPath,
            variant: variation.name,
          })
        })
      )
    }
  }

  async #createHomePage() {
    const { sponsors } = await import('#collections/sponsors')
    const { featuredSponsors } = await import('#collections/featured_sponsors')

    await this.#writeOutput(
      'index',
      await this.#createView('/').render('pages/home', {
        featuredSponsors: await featuredSponsors.load(),
        sponsors: await sponsors.load(),
      }),
      'html'
    )
  }

  @inject()
  async prepare(router: Router) {
    router.commit()
  }

  async run() {
    const { docsSections } = await import('#collections/docs')
    const guides = await docsSections.guides.load()
    const start = await docsSections.start.load()
    const reference = await docsSections.reference.load()

    await this.#createHomePage()

    const allGroups = [...guides.all(), ...start.all(), ...reference.all()]

    for (const group of allGroups) {
      for (const doc of group.children) {
        const action = doc.permalink
          ? this.logger.action(`Compiling ${doc.permalink}`)
          : this.logger.action(`Compiling (${doc.variations?.map(({ permalink }) => permalink)})`)

        try {
          await this.#compileDoc(doc)
          action.succeeded()
        } catch (error) {
          action.failed(error.message)
        }
      }
    }

    await this.#createRedirects(allGroups)
    await this.#createSitemap(allGroups)
  }

  async #createSitemap(
    groups: Array<{ children: Array<Infer<typeof singleDoc> & { variant?: string }> }>
  ) {
    const urls: string[] = []

    urls.push(`  <url>\n    <loc>${appUrl}/</loc>\n  </url>`)

    for (const group of groups) {
      for (const doc of group.children) {
        if (doc.permalink) {
          urls.push(`  <url>\n    <loc>${appUrl}/${doc.permalink}</loc>\n  </url>`)
        }
        if (doc.variations) {
          for (const variation of doc.variations) {
            urls.push(`  <url>\n    <loc>${appUrl}/${variation.permalink}</loc>\n  </url>`)
          }
        }
      }
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

    const outputPath = this.app.makePath('build/public/sitemap.xml')
    const action = this.logger.action('Generating sitemap.xml')
    await writeFile(outputPath, sitemap)
    action.succeeded()
  }

  async #createRedirects(
    groups: Array<{ children: Array<Infer<typeof singleDoc> & { variant?: string }> }>
  ) {
    const redirects: string[] = []

    for (const group of groups) {
      for (const doc of group.children) {
        if (doc.oldUrls && doc.permalink) {
          for (const oldUrl of doc.oldUrls) {
            redirects.push(`/${oldUrl} /${doc.permalink} 301`)
          }
        }
      }
    }

    const outputPath = this.app.makePath('build/public/_redirects')
    const action = this.logger.action('Generating _redirects file')
    await writeFile(outputPath, redirects.join('\n') + '\n')
    action.succeeded()
  }
}
