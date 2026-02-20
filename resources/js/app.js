/// <reference types="vite/client" />

import 'unpoly'
import Alpine from 'alpinejs'
import '@github/tab-container-element'
import collapse from '@alpinejs/collapse'
import '@pagefind/component-ui'
import '@pagefind/component-ui/css'
import '../css/app.css'

import.meta.glob('../../content/**/*.(png|jpg|jpeg)')
import.meta.glob('../assets/**/*.(svg|jpg|png|jpeg)')

Alpine.data('ctc', function () {
  return {
    state: 'idle',
    copy() {
      this.state = 'copied'
      const code = this.$root.querySelector('pre code').textContent
      navigator.clipboard.writeText(code)

      setTimeout(() => {
        this.state = 'idle'
      }, 1500)
    },
  }
})

up.viewport.config.revealPadding = 55
up.on('up:location:changed', function () {
  window.dispatchEvent(new CustomEvent('hide-mobile-nav'))
})

/**
 * Tracks the scrolling of windows and activates the
 * hash link next to it.
 */
Alpine.data('trackScroll', function () {
  return {
    scrollListener: null,

    setActiveTableOfContents(scrollContainerIntoView) {
      const links = Array.from(this.$el.querySelectorAll('a'))

      let lastVisible =
        links
          .slice()
          .reverse()
          .find((link) => {
            if (!link.hash) {
              console.log(link)
            }
            const el = document.querySelector(decodeURIComponent(link.hash))
            if (el) {
              return el.getBoundingClientRect().top <= 200
            }
          }) ?? links[0]

      links.forEach((link) => {
        if (link === lastVisible) {
          link.classList.add('up-current')
          if (scrollContainerIntoView) {
            link.scrollIntoView({
              block: 'center',
              behavior: 'smooth',
            })
          }
        } else {
          link.classList.remove('up-current')
        }
      })
    },

    init() {
      this.scrollListener = function () {
        this.setActiveTableOfContents(false)
      }.bind(this)

      this.$nextTick(() => {
        this.setActiveTableOfContents(true)
        window.addEventListener('scroll', this.scrollListener, { passive: true })
      })
    },

    destroy() {
      window.removeEventListener('scroll', this.scrollListener)
    },
  }
})

Alpine.plugin(collapse)
Alpine.start()
