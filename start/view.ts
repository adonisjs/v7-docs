import edge from 'edge.js'
import { edgeMarkdown } from 'edge-markdown'

edge.use(edgeMarkdown, {
  prefix: 'markdown',
  highlight: true,
  allowHTML: true,
  toc: {
    enabled: true,
    maxDepth: 2,
  },
})
