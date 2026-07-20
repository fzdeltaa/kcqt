/**
 * inject/page.js
 * Runs in the PAGE's JS context (not isolated world).
 * Listed in web_accessible_resources so content.js can inject it via <script src>.
 *
 * Monkey-patches XMLHttpRequest to intercept /kcsapi/api_get_member/questlist
 * responses, then postMessages the parsed quest list back to content.js.
 */
;(() => {
  'use strict'

  const TARGET_API = '/kcsapi/api_get_member/questlist'

  const origOpen = XMLHttpRequest.prototype.open
  const origSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__kcqt_url = typeof url === 'string' ? url : ''
    return origOpen.apply(this, [method, url, ...rest])
  }

  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__kcqt_url && this.__kcqt_url.includes(TARGET_API)) {
      this.addEventListener('load', function () {
        try {
          // Game responses are prefixed with "svdata=" before the JSON
          const json = JSON.parse(this.responseText.replace(/^[^{]*/, ''))
          if (json.api_result !== 1) return

          const list = json.api_data?.api_list
          if (!Array.isArray(list)) return

          // Read tab_id from the original request URL query/post data if possible;
          // fall back to null (treated as partial/merge in background)
          let tabId = null
          try {
            const qs = new URL(this.__kcqt_url, location.href).searchParams
            const t = qs.get('api_tab_id')
            if (t !== null) tabId = parseInt(t, 10)
          } catch (_) {}

          /** @type {Record<number, object>} */
          const quests = {}
          list.forEach((q) => {
            if (q === -1) return // empty slot
            quests[q.api_no] = {
              id:       q.api_no,
              state:    q.api_state,          // 1=open 2=active 3=completed(unclaimed)
              progress: q.api_progress_flag,  // 0=0% 1≈50% 2≈80% 3=100%
              title:    q.api_title,
              detail:   q.api_detail,
              category: q.api_category,       // 1-6
              type:     q.api_type,           // 1=once 2=daily 3=weekly 4=monthly 5=yearly
            }
          })

          // postMessage to content.js (isolated world)
          window.postMessage({
            __kcqt:  true,
            type:    'KCQT_QUESTLIST',
            tabId,
            quests,
          }, '*')
        } catch (e) {
          // Silently ignore parse errors — not every XHR is a questlist
        }
      })
    }

    return origSend.apply(this, args)
  }
})()
