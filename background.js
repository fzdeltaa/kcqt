/**
 * background.js
 * Persistent background script.
 *
 * Receives KCQT_QUESTLIST messages from content scripts,
 * merges/replaces stored quest data, and opens the tracker page on demand.
 */
;(() => {
  'use strict'

  const STORAGE_KEY         = 'kcqt_quests'
  const STORAGE_UPDATED_KEY = 'kcqt_lastUpdated'
  const TRACKER_PAGE        = 'tracker/tracker.html'

  // ── Message handler ──────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    if (!msg || msg.type !== 'KCQT_QUESTLIST') return

    const { tabId, quests: incoming } = msg

    if (tabId === 0) {
      // Tab 0 = "All quests" — authoritative full snapshot; replace entirely
      chrome.storage.local.set({
        [STORAGE_KEY]:         incoming,
        [STORAGE_UPDATED_KEY]: Date.now(),
      })
    } else {
      // Partial tab — merge into existing
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const merged = Object.assign({}, result[STORAGE_KEY] || {}, incoming)
        chrome.storage.local.set({
          [STORAGE_KEY]:         merged,
          [STORAGE_UPDATED_KEY]: Date.now(),
        })
      })
    }
  })

  // ── Tracker page ─────────────────────────────────────────────────

  // Open or focus the tracker page when the browser action is clicked
  // (popup.html handles this via chrome.tabs, but this is a fallback)
  chrome.browserAction.onClicked.addListener(() => {
    openOrFocusTracker()
  })

  function openOrFocusTracker() {
    window.open(chrome.runtime.getURL(TRACKER_PAGE), '_blank')
  }

  // Expose for popup.js to call
  window.kcqtOpenTracker = openOrFocusTracker
})()
