/**
 * content.js
 * Runs as a content script (isolated world) on the game page.
 *
 * Intercepts quest list API calls and merges with chrome.storage.local using
 * KC3Kai's authoritative quest status rules.
 */
;(() => {
  'use strict'

  const STORAGE_KEY = 'kcqt_quests'
  const STORAGE_UPDATED_KEY = 'kcqt_lastUpdated'

  // Inject page.js into the page's own JS context via a <script> tag.
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('library/injections/page.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)

  // Receive quest data from page.js via postMessage and save directly to storage
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.__kcqt !== true) return

    const { tabId, quests: incoming } = event.data
    if (!incoming || typeof incoming !== 'object') return

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const existing = result[STORAGE_KEY] || {}
      const merged = { ...existing }
      const incomingIds = new Set(Object.keys(incoming))

      // 1. Update/merge all quests incoming from the game API
      for (const [id, inc] of Object.entries(incoming)) {
        const ext = existing[id]
        const extState = ext?.state || 0
        const incState = inc?.state || 0

        // Retain highest state (Completed = 3 > Active = 2 > Available = 1 > Locked = 0)
        const finalState = Math.max(extState, incState)

        merged[id] = {
          ...ext,
          ...inc,
          state: finalState,
        }
      }

      // 2. If tabId === 0 (authoritative "All Quests" list from the game):
      // Following KC3Kai's logic (QuestManager.js line 446): Any quest previously tracked as
      // open/active (state 1 or 2) that is NO LONGER present in tab 0's list has been turned in/completed!
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
