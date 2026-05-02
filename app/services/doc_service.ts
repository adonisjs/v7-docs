import { type Edge } from 'edge.js'
import { errors } from '@adonisjs/core'
import { findDoc, resolveAsset, resolveLink } from '#collections/docs'
import { adonisJsReleases } from '#collections/releases'
import { ossStats } from '#collections/oss_stats'
import env from '#start/env'

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
        carbonAdUrl: env.get('CARBON_AD_URL'),
        releaseBlocks: releases.groupedByMonth(),
        ossStats: await ossStats.load(),
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
