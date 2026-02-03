import edge from 'edge.js'
import { Socket } from 'node:net'
import { dirname } from 'node:path'
import { inject } from '@adonisjs/core'
import { Router } from '@adonisjs/core/http'
import { IncomingMessage } from 'node:http'
import { type Infer } from '@vinejs/vine/types'
import { BaseCommand } from '@adonisjs/core/ace'
import { type singleDoc } from '#collections/docs'
import { mkdir, writeFile } from 'node:fs/promises'
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

  async #writeOutput(uri: string, html: string) {
    const outputPath = this.app.makePath('build/public', `${uri}.html`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
  }

  async #compileDoc(doc: Infer<typeof singleDoc> & { variant?: string }) {
    const { DocService } = await import('#services/doc_service')
    const docsService = await this.app.container.make(DocService)
    if (doc.permalink) {
      const html = await docsService.renderDoc(doc.permalink, this.#createView(`/${doc.permalink}`))
      await this.#writeOutput(doc.permalink, html)
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
      })
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
    action.succeeded(`${redirects.length} redirects written`)
  }
}
