/**
 * content.js
 * Runs as a content script (isolated world) on the game page.
 *
 * Intercepts quest list API calls and merges with chrome.storage.local using
 */
; (() => {
  'use strict'

  const STORAGE_KEY = 'kcqt_quests'
  const STORAGE_UPDATED_KEY = 'kcqt_lastUpdated'

  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('library/injections/page.js')
  script.onload = () => script.remove()
    ; (document.head || document.documentElement).appendChild(script)

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.__kcqt !== true) return

    chrome.storage.local.get(['enabled', STORAGE_KEY], (result) => {
      const isEnabled = typeof result.enabled === 'boolean' ? result.enabled : true
      if (!isEnabled) {
        return
      }

      const { tabId, quests: incoming } = event.data
      if (!incoming || typeof incoming !== 'object') return

      const existing = result[STORAGE_KEY] || {}
      const merged = { ...existing }
      const incomingIds = new Set(Object.keys(incoming))

      for (const [id, inc] of Object.entries(incoming)) {
        const ext = existing[id]
        const extState = ext?.state || 0
        const incState = inc?.state || 0

        const finalState = Math.max(extState, incState)

        merged[id] = {
          ...ext,
          ...inc,
          state: finalState,
        }
      }

      if (tabId === 0) {
        for (const [id, ext] of Object.entries(existing)) {
          if (!incomingIds.has(id)) {
            merged[id] = {
              ...ext,
              state: Math.max(ext.state || 0, 3),
            }
          }
        }
      }

      chrome.storage.local.set({
        [STORAGE_KEY]: merged,
        [STORAGE_UPDATED_KEY]: Date.now(),
      })
    })
  })
})()
