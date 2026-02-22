import { type Edge } from 'edge.js'
import { errors } from '@adonisjs/core'
import { findDoc, resolveAsset, resolveLink } from '#collections/docs'
import { adonisJsReleases } from '#collections/releases'

export class DocService {
  async renderDoc(permalink: string, view: ReturnType<Edge['share']>) {
    const doc = await findDoc(permalink)
    const releases = await adonisJsReleases.load()
    if (!doc) {
      throw new errors.E_ROUTE_NOT_FOUND(['GET', permalink])
    }

    return view
      .share({
        resolveLink,
        resolveAsset,
        releaseBlocks: releases.groupedByMonth(),
        ...doc,
        permalink,
      })
      .render('pages/doc')
  }

  async retrieveLlmPath(permalink: string) {
    const doc = await findDoc(permalink)
    if (!doc) {
      throw new errors.E_ROUTE_NOT_FOUND(['GET', permalink])
    }
    return doc.doc.contentPath!
  }
}
