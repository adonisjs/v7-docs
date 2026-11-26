import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (!existsSync('build/public')) {
  console.log('Search in development needs `npm run build` first. Skipping search indexing.')
} else {
  const result = spawnSync('npm run dev:search:index', { shell: true, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
}
