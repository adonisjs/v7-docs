/// <reference types="vite/client" />

import 'unpoly'
import Alpine from 'alpinejs'
import '@pagefind/component-ui'
import '@pagefind/component-ui/css'
import '@github/tab-container-element'
import collapse from '@alpinejs/collapse'
import '../css/app.css'

import.meta.glob('../../content/**/*.(png|jpg|jpeg)')
import.meta.glob('../assets/**/*.(svg|jpg|png|jpeg)')

function closeSearchModal() {
  const modal = document.querySelector('pagefind-modal')
  if (modal && modal.isOpen) {
    modal.close()
    scrollToActiveDoc()
  }
}

function scrollToActiveDoc() {
  const activeSidebarItem = document.querySelector('[up-section-sidebar] a.up-current')
  if (activeSidebarItem) {
    activeSidebarItem.scrollIntoView({
      block: 'center',
    })
  }
}
scrollToActiveDoc()

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

Alpine.data('copyDocToClipboard', function (docPath) {
  return {
    state: 'idle',
    docPath: docPath,
    async copy() {
      try {
        const response = await fetch(this.docPath)
        const markdown = await response.text()
        await navigator.clipboard.writeText(markdown)
        this.state = 'copied'
        setTimeout(() => {
          this.state = 'idle'
        }, 1500)
      } catch {
        this.state = 'idle'
      }
    },
  }
})

Alpine.data('openInAI', function (aiBaseUrl, docPath) {
  return {
    open() {
      const docUrl = `${window.location.origin}/${docPath}`
      const message = `Read from ${docUrl} and let me know when you are ready for questions.`
      const url = new URL(aiBaseUrl)
      url.searchParams.append('q', message)
      window.open(url.toString(), '_blank')
    },
  }
})

up.viewport.config.revealPadding = 55
up.on('up:location:changed', function () {
  window.dispatchEvent(new CustomEvent('hide-mobile-nav'))
  closeSearchModal()
})
up.on('up:fragment:offline', function (event) {
  window.location.reload()
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

/**
 * Theme toggle: persists light/dark preference in localStorage.
 * The `.dark` class on <html> is set by the anti-FOUC inline script
 * in layout.edge; here we keep Alpine state in sync and handle toggling.
 */
Alpine.data('theme', function () {
  return {
    isDark: true,
    init() {
      // Sync with the class already applied by the anti-FOUC script
      this.isDark = document.documentElement.classList.contains('dark')
    },
    toggle() {
      this.isDark = !this.isDark
      document.documentElement.classList.toggle('dark', this.isDark)
      localStorage.setItem('theme', this.isDark ? 'dark' : 'light')
      // Keep pagefind search modal in sync
      document.querySelectorAll('[data-pf-theme]').forEach((el) => {
        el.setAttribute('data-pf-theme', this.isDark ? 'dark' : 'light')
      })
    },
  }
})

Alpine.start()
