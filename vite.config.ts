import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    tailwindcss(),
    adonisjs({
      /**
       * Entrypoints of your application. Each entrypoint will
       * result in a separate bundle.
       */
      entrypoints: ['resources/js/app.js'],
      assets: {
        chunks: ['resources/assets/**/*.(svg|jpg|png|jpeg)', 'content/**/**/*.(png|jpg|jpeg)'],
        assets: ['resources/assets/icons/icons_manifest.json'],
      },

      /**
       * Paths to watch and reload the browser on file change
       */
      reload: ['resources/views/**/*.edge'],
    }),
  ],
})
