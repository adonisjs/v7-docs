/// <reference types="vite/client" />

import 'unpoly'
import Alpine from 'alpinejs'
import posthog from 'posthog-js'
import '@pagefind/component-ui'
import '@pagefind/component-ui/css'
import '@github/tab-container-element'
import collapse from '@alpinejs/collapse'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import '../css/app.css'

const posthogKey = import.meta.env.VITE_POSTHOG_API_KEY
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    person_profiles: 'always',
    capture_pageview: true,
    capture_pageleave: true,
    capture_exceptions: true,
  })
}

up.compiler('[data-tippy-content]', function (element) {
  const instance = tippy(element)
  return () => instance.destroy()
})

// import.meta.glob('../../content/**/*.(png|jpg|jpeg)')
// import.meta.glob('../assets/**/*.(svg|jpg|png|jpeg)')

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
  if (posthogKey) {
    posthog.capture('$pageleave')
    posthog.capture('$pageview')
  }
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

const initialCurrentColorMode = (() => {
  try {
    const stored = window.localStorage.getItem('theme')
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch (e) {
    return 'system'
  }
})()

Alpine.store('colorMode', {
  effective: initialEffectiveColorMode,
  current: initialCurrentColorMode,
})

Alpine.data('themeSwitcher', function () {
  return {
    init() {
      if (Alpine.store('colorMode').current !== 'system') {
        this.applyExplicitTheme(Alpine.store('colorMode').current)
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
      Alpine.store('colorMode').current = 'system'
      window.localStorage.removeItem('theme')
      this.applySystemTheme()
    },

    setLight() {
      Alpine.store('colorMode').current = 'light'
      window.localStorage.setItem('theme', 'light')
      this.applyExplicitTheme('light')
    },

    setDark() {
      Alpine.store('colorMode').current = 'dark'
      window.localStorage.setItem('theme', 'dark')
      this.applyExplicitTheme('dark')
    },

    buttonClass(name) {
      return this.$store.colorMode.current === name
        ? 'bg-gray-300 dark:bg-woodsmoke-800 text-gray-900 dark:text-woodsmoke-50! shadow-sm'
        : ''
    },
  }
})

document.addEventListener('keydown', function (e) {
  if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
      document.documentElement.classList.remove('dark')
      window.localStorage.setItem('theme', 'light')
      Alpine.store('colorMode').effective = 'light'
      Alpine.store('colorMode').current = 'light'
    } else {
      document.documentElement.classList.add('dark')
      window.localStorage.setItem('theme', 'dark')
      Alpine.store('colorMode').effective = 'dark'
      Alpine.store('colorMode').current = 'dark'
    }
  }
})

Alpine.plugin(collapse)
Alpine.start()
