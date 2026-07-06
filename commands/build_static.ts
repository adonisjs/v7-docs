import edge from 'edge.js'
import { Socket } from 'node:net'
import { dirname } from 'node:path'
import { appUrl } from '#config/app'
import { inject } from '@adonisjs/core'
import { Router } from '@adonisjs/core/http'
import { IncomingMessage } from 'node:http'
import { type Infer } from '@vinejs/vine/types'
import { parseFrontMatter } from 'remark-mdc'
import { BaseCommand } from '@adonisjs/core/ace'
import { type singleDoc, type categoryDocs } from '#collections/docs'
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
    const { ossStats } = await import('#collections/oss_stats')

    await this.#writeOutput(
      'index',
      await this.#createView('/').render('pages/home', {
        featuredSponsors: await featuredSponsors.load(),
        sponsors: await sponsors.load(),
        ossStats: await ossStats.load(),
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
        } catch (error: any) {
          action.failed(error.message)
        }
      }
    }

    await this.#createRedirects(allGroups)
    await this.#createSitemap(allGroups)
    await this.#createLlmsFiles([
      { label: 'Getting started', groups: start.all() },
      { label: 'Guides', groups: guides.all() },
      { label: 'Reference', groups: reference.all() },
    ])
  }

  /**
   * Reads a doc's source markdown and splits its frontmatter from the body
   * using the same parser as the markdown rendering pipeline. Used to build
   * the llms.txt files.
   */
  async #readDocSource(contentPath: string) {
    const raw = await readFile(contentPath, 'utf-8')
    const { content, data } = parseFrontMatter(raw)
    return {
      description: typeof data.description === 'string' ? data.description.trim() : undefined,
      body: content.trim(),
    }
  }

  /**
   * Generates the "/llms.txt" index (a curated list of Markdown links, one per
   * doc, following the https://llmstxt.org spec) and the "/llms-full.txt" file
   * (the entire documentation concatenated into a single Markdown file).
   */
  async #createLlmsFiles(
    sections: Array<{
      label: string
      groups: Array<Infer<typeof categoryDocs>>
    }>
  ) {
    const action = this.logger.action('Generating llms.txt and llms-full.txt')

    try {
      const index: string[] = [
        '# AdonisJS',
        '',
        '> AdonisJS is a TypeScript-first web framework for Node.js for creating full-stack web apps and API servers. It ships with a set of first-party packages for routing, validation, the Lucid ORM, authentication, testing, and more.',
        '',
        'This file indexes the official documentation as Markdown for LLMs. Every page is also available as raw Markdown by appending `.md` to its URL. A single file containing the entire documentation is available at ' +
          `${appUrl}/llms-full.txt.`,
        '',
      ]
      const full: string[] = []

      for (const section of sections) {
        for (const group of section.groups) {
          const heading = group.category === 'Root' ? section.label : group.category
          const entries: string[] = []

          for (const doc of group.children) {
            if (doc.draft) {
              continue
            }

            const variants = doc.permalink
              ? [{ permalink: doc.permalink, contentPath: doc.contentPath!, title: doc.title }]
              : doc.variations!.map((variation) => ({
                  permalink: variation.permalink,
                  contentPath: variation.contentPath,
                  title: `${doc.title} (${variation.name})`,
                }))

            for (const variant of variants) {
              const { description, body } = await this.#readDocSource(variant.contentPath)
              const note = description ? `: ${description}` : ''
              entries.push(`- [${variant.title}](${appUrl}/${variant.permalink}.md)${note}`)
              full.push(body)
            }
          }

          if (entries.length) {
            index.push(`## ${heading}`, '', ...entries, '')
          }
        }
      }

      await writeFile(this.app.makePath('build/public/llms.txt'), index.join('\n').trimEnd() + '\n')
      await writeFile(
        this.app.makePath('build/public/llms-full.txt'),
        full.join('\n\n---\n\n') + '\n'
      )
      action.succeeded()
    } catch (error: any) {
      action.failed(error.message)
    }
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
