import { BaseCommand, flags } from '@adonisjs/core/ace'
import { readFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'

export default class GenerateOgImages extends BaseCommand {
  static commandName = 'generate:og'
  static description = 'Generate OG images for docs'

  @flags.boolean({ description: 'Regenerate all images even if they already exist' })
  declare force: boolean

  /**
   * Collect all doc entries from a db.json file. Each entry
   * is normalized to { title, permalink, contentPath }.
   *
   * Handles both simple entries (with a top-level permalink)
   * and variation entries (tutorials with multiple variants).
   */
  #collectEntries(
    db: { category: string; children: any[] }[],
    baseDir: string
  ): { title: string; permalink: string; contentPath: string }[] {
    const entries: { title: string; permalink: string; contentPath: string }[] = []

    for (const group of db) {
      for (const child of group.children) {
        if (child.permalink) {
          entries.push({
            title: child.title,
            permalink: child.permalink,
            contentPath: join(baseDir, child.contentPath),
          })
        } else if (child.variations) {
          for (const variation of child.variations) {
            entries.push({
              title: `${child.title} (${variation.name})`,
              permalink: variation.permalink,
              contentPath: join(baseDir, variation.contentPath),
            })
          }
        }
      }
    }

    return entries
  }

  /**
   * Extract the description from a markdown file's frontmatter.
   */
  async #getDescription(filePath: string): Promise<string> {
    const content = await readFile(filePath, 'utf-8')
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (match) {
      const descMatch = match[1].match(/^description:\s*(.+)$/m)
      if (descMatch) {
        return descMatch[1].replace(/^['"]|['"]$/g, '').trim()
      }
    }
    return ''
  }

  async run() {
    const { default: satori } = await import('satori')
    const { Resvg } = await import('@resvg/resvg-js')
    const { default: sharp } = await import('sharp')

    const dbFiles = ['content/start/db.json', 'content/guides/db.json', 'content/reference/db.json']

    const entries: { title: string; permalink: string; contentPath: string }[] = []
    for (const dbFile of dbFiles) {
      const fullPath = this.app.makePath(dbFile)
      const baseDir = join(fullPath, '..')
      const db = JSON.parse(await readFile(fullPath, 'utf-8'))
      entries.push(...this.#collectEntries(db, baseDir))
    }

    const displayFont = await readFile(
      this.app.makePath('resources/fonts/LibreCaslon-Regular.woff')
    )
    const sansFont = await readFile(
      this.app.makePath('resources/fonts/InstrumentSans-Regular.woff')
    )

    const templatePath = this.app.makePath('resources/assets/og/template.jpg')
    const outputDir = this.app.makePath('resources/assets/og/docs')
    await mkdir(outputDir, { recursive: true })

    const WIDTH = 2400
    const HEIGHT = 1260

    let generated = 0

    for (const entry of entries) {
      const slug = entry.permalink.replace(/\//g, '-')
      const outputPath = join(outputDir, `${slug}.jpg`)

      if (!this.force) {
        const exists = await access(outputPath).then(
          () => true,
          () => false
        )
        if (exists) {
          this.logger.info(`Skipped (exists): ${this.app.relativePath(outputPath)}`)
          continue
        }
      }

      const description = await this.#getDescription(entry.contentPath)

      const svg = await satori(
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: 2400,
              height: 1260,
              paddingTop: 600,
              paddingLeft: 260,
              paddingRight: 130,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Display',
                    fontSize: '80px',
                    color: 'white',
                    lineHeight: 1.3,
                    maxWidth: 1800,
                  },
                  children: entry.title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Instrument Sans',
                    fontSize: '40px',
                    color: '#72728C',
                    lineHeight: 1.7,
                    marginTop: '30px',
                    maxWidth: 1800,
                  },
                  children: description,
                },
              },
            ],
          },
        },
        {
          width: WIDTH,
          height: HEIGHT,
          fonts: [
            {
              name: 'Display',
              data: displayFont,
              weight: 400,
              style: 'normal',
            },
            {
              name: 'Instrument Sans',
              data: sansFont,
              weight: 400,
              style: 'normal',
            },
          ],
        }
      )

      const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: WIDTH },
      })
      const textPng = resvg.render().asPng()

      await sharp(templatePath)
        .composite([{ input: textPng, top: 0, left: 0 }])
        .jpeg({ quality: 85 })
        .toFile(outputPath)

      generated++
      this.logger.success(`Generated: ${this.app.relativePath(outputPath)}`)
    }

    this.logger.success(
      `\nGenerated ${generated} OG image(s), ${entries.length - generated} skipped`
    )
  }
}
