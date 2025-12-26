import { inject } from '@adonisjs/core'
import { DocService } from '#services/doc_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DocsController {
  @inject()
  async handle({ view, params }: HttpContext, docService: DocService) {
    const permalink = params['*'].join('/')
    view.share({ docVariant: 'React' })
    return docService.renderDoc(permalink, view)
  }
}
