;(() => {
  'use strict'

  const STORAGE_KEY = 'kcqt_quests'
  const STORAGE_UPDATED_KEY = 'kcqt_lastUpdated'

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'KCQT_QUESTLIST') return

    const { tabId, quests: incoming } = msg

    if (tabId === 0) {
      // Tab 0 = "All quests" — authoritative full snapshot; replace entirely
      chrome.storage.local.set({
        [STORAGE_KEY]: incoming,
        [STORAGE_UPDATED_KEY]: Date.now(),
      })
    } else {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const merged = Object.assign({}, result[STORAGE_KEY] || {}, incoming)
        chrome.storage.local.set({
          [STORAGE_KEY]: merged,
          [STORAGE_UPDATED_KEY]: Date.now(),
        })
      })
    }
  })
})()