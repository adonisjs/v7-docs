import { inject } from '@adonisjs/core'
import { DocService } from '#services/doc_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DocsController {
  @inject()
  async handle({ view, params, response }: HttpContext, docService: DocService) {
    const permalink = params['*'].join('/')
    if (permalink.endsWith('.md')) {
      const doc = await docService.retrieveLlmPath(permalink.replace(/\.md$/, ''))
      return response.download(doc)
    }
    return docService.renderDoc(permalink, view)
  }
}
