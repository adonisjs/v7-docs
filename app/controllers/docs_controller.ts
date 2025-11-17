import type { HttpContext } from '@adonisjs/core/http'
import { docs } from '#collections/docs'

export default class DocsController {
  async handle({ view }: HttpContext) {
    return view.render('pages/doc', {
      docs: await docs.load(),
    })
  }
}
