import edge from 'edge.js'
import { dirname } from 'node:path'
import { inject } from '@adonisjs/core'
import { Router } from '@adonisjs/core/http'
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
    const request = new RequestFactory().create()
    request.request.url = url
    return edge.share({ request })
  }

  async #writeOutput(uri: string, html: string) {
    const outputPath = this.app.makePath('build/public', `${uri}.html`)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, html)
  }

  async #compileDoc(doc: Infer<typeof singleDoc>) {
    const { DocService } = await import('#services/doc_service')
    const docsService = await this.app.container.make(DocService)
    const html = await docsService.renderDoc(doc.permalink, this.#createView(`/${doc.permalink}`))
    await this.#writeOutput(doc.permalink, html)
  }

  async #createHomePage() {
    await this.#writeOutput('index', await this.#createView('/').render('pages/home'))
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

    for (const group of [...guides.all(), ...start.all(), ...reference.all()]) {
      for (const doc of group.children) {
        const action = this.logger.action(`Compiling ${doc.permalink}`)
        try {
          await this.#compileDoc(doc)
          action.succeeded()
        } catch (error) {
          action.failed(error.message)
        }
      }
    }
  }
}
