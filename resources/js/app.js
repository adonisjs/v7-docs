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

up.compiler('[up-carbon-ad]', function (element) {
  const src = element.getAttribute('up-carbon-ad')
  const existing = document.getElementById('_carbonads_js')
  if (existing) {
    existing.remove()
  }

  const script = document.createElement('script')
  script.async = true
  script.type = 'text/javascript'
  script.src = src
  script.id = '_carbonads_js'
  element.appendChild(script)
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

const initialEffectiveColorMode = (() => {
  try {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  } catch (e) {
    return 'light'
  }
})()

Alpine.store('colorMode', { effective: initialEffectiveColorMode })

Alpine.data('themeSwitcher', function () {
  const storedTheme = (() => {
    try {
      return window.localStorage.getItem('theme')
    } catch (e) {
      return null
    }
  })()

  const initialCurrent =
    storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system'

  return {
    current: initialCurrent,

    init() {
      if (storedTheme === 'light' || storedTheme === 'dark') {
        this.applyExplicitTheme(storedTheme)
      } else {
        this.applySystemTheme()
      }
    },

    applyExplicitTheme(theme) {
      const root = document.documentElement

      if (theme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }

      Alpine.store('colorMode').effective = theme
    },

    applySystemTheme() {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const root = document.documentElement

      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }

      Alpine.store('colorMode').effective = prefersDark ? 'dark' : 'light'
    },

    setSystem() {
      this.current = 'system'
      window.localStorage.removeItem('theme')
      this.applySystemTheme()
    },

    setLight() {
      this.current = 'light'
      window.localStorage.setItem('theme', 'light')
      this.applyExplicitTheme('light')
    },

    setDark() {
      this.current = 'dark'
      window.localStorage.setItem('theme', 'dark')
      this.applyExplicitTheme('dark')
    },

    buttonClass(name) {
      return this.current === name
        ? 'bg-gray-300 dark:bg-woodsmoke-800 text-gray-900 dark:text-woodsmoke-50! shadow-sm'
        : ''
    },
  }
})

Alpine.plugin(collapse)
Alpine.start()
