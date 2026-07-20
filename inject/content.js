/**
 * inject/content.js
 * Runs as a content script (isolated world) on the game page.
 *
 * Its only job:
 *   1. Inject page.js into the PAGE's JS context (so it can access XHR)
 *   2. Listen for postMessage from page.js and forward to background
 */
;(() => {
  'use strict'

  // Inject page.js into the page's own JS context via a <script> tag.
  // Content scripts run in an isolated world and cannot access window.XMLHttpRequest
  // directly; this is the same technique KC3 uses for kcs2_injectable.js.
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('inject/page.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)

  // Receive quest data from page.js via postMessage and relay to background
  window.addEventListener('message', (event) => {
    // Only accept messages from the same frame
    if (event.source !== window) return
    if (!event.data || event.data.__kcqt !== true) return

    chrome.runtime.sendMessage(event.data)
  })
})()
