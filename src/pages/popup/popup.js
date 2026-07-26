/* popup.js */
;(() => {
  const TRACKER_PAGE = chrome.runtime.getURL('tracker/tracker.html')

  const $lastUpdated = document.getElementById('last-updated')
  const $statsWrap   = document.getElementById('stats-wrap')
  const $btnOpen     = document.getElementById('btn-open')

  function render(quests, lastUpdated) {
    const list = Object.values(quests || {})
    if (!list.length) return

    const byState = list.reduce((a, q) => { a[q.state] = (a[q.state] || 0) + 1; return a }, {})

    $statsWrap.innerHTML = `
      <div class="stats">
        <div class="stat">
          <span class="stat-num c-avail">${byState[1] || 0}</span>
          <span class="stat-lbl">Open</span>
        </div>
        <div class="stat">
          <span class="stat-num c-active">${byState[2] || 0}</span>
          <span class="stat-lbl">Active</span>
        </div>
        <div class="stat">
          <span class="stat-num c-complete">${byState[3] || 0}</span>
          <span class="stat-lbl">Done</span>
        </div>
      </div>
    `

    if (lastUpdated) {
      $lastUpdated.textContent = `Updated: ${new Date(lastUpdated).toLocaleTimeString()}`
    }
  }

  chrome.storage.local.get(['kcqt_quests', 'kcqt_lastUpdated'], (r) => {
    render(r.kcqt_quests, r.kcqt_lastUpdated)
  })

  $btnOpen.addEventListener('click', () => {
    window.open(TRACKER_PAGE, '_blank')
    window.close()
  })
})()
