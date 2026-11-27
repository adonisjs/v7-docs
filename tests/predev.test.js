import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))

function project(t) {
  const directory = mkdtempSync(join(tmpdir(), 'v7-docs-predev-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'scripts'))
  copyFileSync(join(root, 'scripts/predev.js'), join(directory, 'scripts/predev.js'))
  copyFileSync(join(root, 'package.json'), join(directory, 'package.json'))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  return directory
}

function predev(directory) {
  return spawnSync('npm run predev', { cwd: directory, shell: true, encoding: 'utf8' })
}

test('predev lets the dev server start without a build and explains how to enable search', (t) => {
  const directory = project(t)
  const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  pkg.scripts.dev = 'node -e "console.log(\'dev server started\')"'
  writeFileSync(join(directory, 'package.json'), JSON.stringify(pkg))

  const result = spawnSync('npm run dev', { cwd: directory, shell: true, encoding: 'utf8' })

  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /Search in development needs `npm run build` first/)
  assert.match(result.stdout, /dev server started/)
})

test('predev generates the search index from built HTML in public/pagefind', (t) => {
  const directory = project(t)
  mkdirSync(join(directory, 'build/public'), { recursive: true })
  writeFileSync(
    join(directory, 'build/public/index.html'),
    '<html lang="en"><head><title>AdonisJS</title></head><body><main data-pagefind-body>AdonisJS documentation</main></body></html>'
  )

  const result = predev(directory)

  assert.equal(result.status, 0, result.stdout + result.stderr)
  const entry = JSON.parse(
    readFileSync(join(directory, 'public/pagefind/pagefind-entry.json'), 'utf8')
  )
  assert.equal(entry.languages.en.page_count, 1)
})

test('predev still fails when Pagefind cannot index an existing build directory', (t) => {
  const directory = project(t)
  mkdirSync(join(directory, 'build/public'), { recursive: true })

  const result = predev(directory)

  assert.notEqual(result.status, 0)
  assert.match(result.stdout + result.stderr, /Pagefind was not able to build an index/)
})
