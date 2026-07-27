; (() => {
  'use strict'

  const TARGET_API = '/kcsapi/api_get_member/questlist'

  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__kcqt_url = typeof url === 'string' ? url : ''
    return origOpen.apply(this, [method, url, ...rest])
  }

  XMLHttpRequest.prototype.send = function (body) {
    if (this.__kcqt_url && this.__kcqt_url.includes(TARGET_API)) {
      this.__kcqt_body = body
      this.addEventListener('load', function () {
        try {
          const json = JSON.parse(this.responseText.replace(/^[^{]*/, ''))
          if (json.api_result !== 1) return

          const list = json.api_data?.api_list
          if (!Array.isArray(list)) return

          const tabId = extractTabId(this.__kcqt_url, this.__kcqt_body)

          const quests = {}
          list.forEach((q) => {
            if (q === -1 || q == null) return
            quests[q.api_no] = {
              id: q.api_no,
              state: q.api_state,
              progress: q.api_progress_flag,
            }
          })

          // console.log('[KCQT] intercepted questlist API, quests:', Object.keys(quests).length)
          window.postMessage({ __kcqt: true, type: 'KCQT_QUESTLIST', tabId, quests }, '*')
        } catch (e) {
          // not every XHR to this path is a valid questlist response — ignore
        }
      })
    }
    return origSend.apply(this, arguments)
  }

  function extractTabId(url, body) {
    try {
      const qs = new URL(url, location.href).searchParams
      const fromQuery = qs.get('api_tab_id')
      if (fromQuery !== null) return parseInt(fromQuery, 10)
    } catch (_) { }

    if (typeof body === 'string') {
      const match = body.match(/api_tab_id=(\d+)/)
      if (match) return parseInt(match[1], 10)
    }

    return null
  }
})()