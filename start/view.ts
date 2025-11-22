import edge from 'edge.js'
import { tv } from 'tailwind-variants'
import { edgeMarkdown } from 'edge-markdown'
import { addCollection, edgeIconify } from 'edge-iconify'
import { icons as mynauiIcons } from '@iconify-json/mynaui'
import { icons as uiwIcons } from '@iconify-json/uiw'
import { icons as tablerIcons } from '@iconify-json/tabler'

edge.use(edgeIconify)
edge.use(edgeMarkdown, {
  prefix: 'markdown',
  highlight: {
    enabled: true,
    langs: ['typescript', 'json', 'edge', 'html', 'sql', 'bash', 'dotenv', 'tsx'],
    theme: 'github-dark',
  },
  allowHTML: true,
  toc: {
    enabled: true,
    maxDepth: 2,
  },
})

addCollection(mynauiIcons)
addCollection(uiwIcons)
addCollection(tablerIcons)
edge.global('tv', tv)
