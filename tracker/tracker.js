/* tracker.js — KC Quest Tracker standalone page logic */
;(() => {
  'use strict'

  // ── Constants ──────────────────────────────────────────────────

  const STATE_LABELS = {
    1: { text: 'Available', cls: 'badge-available' },
    2: { text: 'Active',    cls: 'badge-active' },
    3: { text: 'Completed', cls: 'badge-completed' },
  }

  const PROGRESS_LABELS = {
    0: { pct: '0%',   width: '0%'   },
    1: { pct: '50%+', width: '55%'  },
    2: { pct: '80%+', width: '82%'  },
    3: { pct: '100%', width: '100%' },
  }

  const CATEGORY_LABELS = {
    1: 'Composition',
    2: 'Sortie',
    3: 'Exercise',
    4: 'Expedition',
    5: 'Supply',
    6: 'Arsenal',
    7: 'Modernization',
    8: 'Sortie(B)',
    9: 'Sortie(C)',
    10: 'Sortie(D)',
    11: 'Arsenal(B)',
  }

  const TYPE_LABELS = {
    1: 'Daily',
    2: 'Weekly',
    3: 'Monthly',
    4: 'One-time',
    5: 'Other',
  }

  // ── DOM refs ───────────────────────────────────────────────────

  const $lastUpdated   = document.getElementById('last-updated')
  const $summary       = document.getElementById('summary')
  const $emptyState    = document.getElementById('empty-state')
  const $questTable    = document.getElementById('quest-table')
  const $tbody         = document.getElementById('quest-tbody')
  const $filterState   = document.getElementById('filter-state')
  const $filterCat     = document.getElementById('filter-category')
  const $filterType    = document.getElementById('filter-type')
  const $btnImport     = document.getElementById('btn-import')
  const $kc3Import     = document.getElementById('kc3-import')
  const $btnClear      = document.getElementById('btn-clear')
  const $countAvail    = document.getElementById('count-available')
  const $countActive   = document.getElementById('count-active')
  const $countComplete = document.getElementById('count-completed')
  const $countTotal    = document.getElementById('count-total')

  // ── State ──────────────────────────────────────────────────────

  let allQuests   = {}
  let lastUpdated = null
  let questTranslations = {}
  let questMeta = {}
  let preReqTree = {}

  // ── Rendering ──────────────────────────────────────────────────

  function renderAll() {
    const quests = Object.values(allQuests)

    const byState = quests.reduce((acc, q) => {
      acc[q.state] = (acc[q.state] || 0) + 1
      return acc
    }, {})

    $countAvail.textContent    = byState[1] || 0
    $countActive.textContent   = byState[2] || 0
    $countComplete.textContent = byState[3] || 0
    $countTotal.textContent    = quests.length

    if (lastUpdated) {
      $lastUpdated.textContent = `Last updated: ${new Date(lastUpdated).toLocaleTimeString()}`
    }

    const hasData = quests.length > 0
    $emptyState.classList.toggle('hidden', hasData)
    $summary.classList.toggle('hidden', !hasData)
    $questTable.classList.toggle('hidden', !hasData)

    if (!hasData) return

    const stateFilter = $filterState.value
    const catFilter   = $filterCat.value
    const typeFilter  = $filterType.value

    const filtered = quests.filter((q) => {
      if (stateFilter !== 'all' && q.state    !== parseInt(stateFilter)) return false
      if (catFilter   !== 'all' && q.category !== parseInt(catFilter))   return false
      if (typeFilter  !== 'all' && q.type     !== parseInt(typeFilter))  return false
      return true
    })

    // Sort: completed first (3→2→1), then by ID
    filtered.sort((a, b) => b.state - a.state || a.id - b.id)

    $tbody.innerHTML = ''
    filtered.forEach((q) => $tbody.appendChild(buildRow(q)))
  }

  function buildRow(q) {
    const category = Math.floor(q.id / 100)
    
    const tr       = document.createElement('tr')
    const state    = STATE_LABELS[q.state]       || { text: `?${q.state}`, cls: '' }
    const progress = PROGRESS_LABELS[q.progress] || PROGRESS_LABELS[0]
    const catLabel = CATEGORY_LABELS[category]   || `Cat ${category}`
    const typeLabel = TYPE_LABELS[q.type]        || `Type ${q.type}`
    const isFull   = q.progress === 3 || q.state === 3

    const t     = questTranslations[q.id] || {}
    const code  = t.code || q.id
    const title = t.name || q.title || '—'
    const desc  = String(t.desc || q.detail || '').replace(/<br\s*\/?>/gi, '\n')
    
    const meta    = questMeta[q.id] || {}
    const preReqs = preReqTree[q.id] || []
    const unlocks = meta.unlock || []

    const formatIds = (ids) => ids.map(id => (questTranslations[id] && questTranslations[id].code) ? questTranslations[id].code : id).join(', ')
    const preReqStr = formatIds(preReqs) || '—'
    const unlockStr = formatIds(unlocks) || '—'

    tr.innerHTML = `
      <td class="col-id"><span class="badge" style="background:var(--row-hover);color:var(--text);border:1px solid var(--border)">${code}</span></td>
      <td class="col-state">
        <span class="badge ${state.cls}">${state.text}</span>
      </td>
      <td class="col-progress">
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill ${isFull ? 'full' : ''}" style="width:${progress.width}"></div>
          </div>
          <span class="progress-pct">${progress.pct}</span>
        </div>
      </td>
      <td class="col-category">
        <span class="cat-dot cat-${category}">${catLabel}</span>
      </td>
      <td class="col-type">
        <span class="type-label">${typeLabel}</span>
      </td>
      <td class="col-prereq" title="${escHtml(preReqStr)}">${escHtml(preReqStr)}</td>
      <td class="col-unlock" title="${escHtml(unlockStr)}">${escHtml(unlockStr)}</td>
      <td class="col-title" title="${escHtml(desc)}">${escHtml(title)}</td>
    `
    return tr
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ── Storage ────────────────────────────────────────────────────

  function loadFromStorage() {
    chrome.storage.local.get(['kcqt_quests', 'kcqt_lastUpdated'], (result) => {
      allQuests   = result.kcqt_quests      || {}
      lastUpdated = result.kcqt_lastUpdated || null
      renderAll()
    })
  }

  // Live update when background writes new data
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes.kcqt_quests)      allQuests   = changes.kcqt_quests.newValue      || {}
    if (changes.kcqt_lastUpdated) lastUpdated = changes.kcqt_lastUpdated.newValue || null
    renderAll()
  })

  // ── Events ─────────────────────────────────────────────────────

  $filterState.addEventListener('change', renderAll)
  $filterCat.addEventListener('change', renderAll)
  $filterType.addEventListener('change', renderAll)

  $btnImport.addEventListener('click', () => {
    $kc3Import.click()
  })

  $kc3Import.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result)
        if (!json.quests) throw new Error('No quests found in this file (must be KC3 export)')
        
        const imported = {}
        let count = 0
        for (const [key, q] of Object.entries(json.quests)) {
          if (!q.id) continue
          imported[q.id] = {
            id: q.id,
            state: q.status, 
            progress: q.progress || 0,
            title: `Quest ${q.id}`, // KC3 .kc3 doesn't store titles, API interception will fill these in later
            detail: 'Imported from KC3',
            category: q.label,
            type: q.type
          }
          count++
        }
        
        chrome.storage.local.get(['kcqt_quests'], (result) => {
          const merged = Object.assign({}, imported, result.kcqt_quests || {})
          chrome.storage.local.set({
            kcqt_quests: merged,
            kcqt_lastUpdated: Date.now()
          }, () => {
            alert(`Imported ${count} quests from KC3 profile!`)
            $kc3Import.value = ''
          })
        })
      } catch (err) {
        alert('Failed to parse KC3 export: ' + err.message)
      }
    }
    reader.readAsText(file)
  })

  $btnClear.addEventListener('click', () => {
    if (!confirm('Clear all stored quest data?')) return
    chrome.storage.local.remove(['kcqt_quests', 'kcqt_lastUpdated'], () => {
      allQuests   = {}
      lastUpdated = null
      $lastUpdated.textContent = 'No data yet — open the quest page in-game'
      renderAll()
    })
  })

  // ── Init ───────────────────────────────────────────────────────

  function loadTranslations() {
    chrome.storage.local.get(['kcqt_translations', 'kcqt_meta'], (result) => {
      // 1. Translations
      if (result.kcqt_translations) {
        questTranslations = result.kcqt_translations
      } else {
        fetch('quests.json').then(r => r.json()).then(data => { questTranslations = data; renderAll() }).catch(e => {})
      }
      
      // 2. Meta
      if (result.kcqt_meta) {
        processMeta(result.kcqt_meta)
      } else {
        fetch('quests_meta.json').then(r => r.json()).then(data => processMeta(data)).catch(e => {})
      }
      
      renderAll()

      // 3. Try live updates
      fetch('https://raw.githubusercontent.com/KC3Kai/kc3-translations/master/data/en/quests.json')
        .then(r => r.json())
        .then(data => {
          chrome.storage.local.set({ kcqt_translations: data })
          questTranslations = data
          renderAll()
        }).catch(e => {})

      fetch('https://raw.githubusercontent.com/KC3Kai/KC3Kai/master/src/data/quests_meta.json')
        .then(r => r.json())
        .then(data => {
          chrome.storage.local.set({ kcqt_meta: data })
          processMeta(data)
        }).catch(e => {})
    })
  }

  function processMeta(data) {
    questMeta = data
    preReqTree = {}
    for (const [qId, meta] of Object.entries(questMeta)) {
      if (meta.unlock) {
        meta.unlock.forEach(targetId => {
          if (!preReqTree[targetId]) preReqTree[targetId] = []
          preReqTree[targetId].push(qId)
        })
      }
    }
    renderAll()
  }

  loadTranslations()
  loadFromStorage()
})()
