import { Quest } from '../objects/Quest.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

class QuestManagerWorker {
  constructor() {
    this.quests = new Map();   // id -> Quest
    this.edges = [];           // [{ source, target }]
    this.outgoing = {};
    this.incoming = {};
    this.loaded = false;
  }

  async load({ force = false } = {}) {
    const cached = await this._getCachedDefinitions();
    const isStale = !cached || (Date.now() - cached.updatedAt) > SEVEN_DAYS_MS;

    if (!force && cached && !isStale) {
      this._buildFromRaw(cached.quests, cached.metadataQuests);
      this.loaded = true;
      return;
    }

    const [quests, metadataQuests] = await Promise.all([
      fetch('https://raw.githubusercontent.com/KC3Kai/kc3-translations/master/data/en/quests.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/KC3Kai/KC3Kai/master/src/data/quests_meta.json').then(r => r.json()),
    ]);
    delete metadataQuests['EoF&RemarksOfDataFormat'];

    await storageSet({
      kcqt_questDefs: { quests, metadataQuests },
      kcqt_questDefsUpdated: Date.now(),
    });

    this._buildFromRaw(quests, metadataQuests);
    this.loaded = true;
  }

  async _getCachedDefinitions() {
    const { kcqt_questDefs, kcqt_questDefsUpdated } =
      await storageGet(['kcqt_questDefs', 'kcqt_questDefsUpdated']);
    if (!kcqt_questDefs || !kcqt_questDefsUpdated) return null;
    return { ...kcqt_questDefs, updatedAt: kcqt_questDefsUpdated };
  }

  _buildFromRaw(quests, metadataQuests) {
    this.quests.clear();
    for (const id of Object.keys(quests)) {
      const q = quests[id];
      this.quests.set(id, new Quest({ id, code: q.code, name: q.name, desc: q.desc, memo: q.memo }));
    }
    this.edges = [];
    for (const [id, meta] of Object.entries(metadataQuests)) {
      if (!Array.isArray(meta.unlock)) continue;
      for (const unlockedId of meta.unlock) {
        const targetId = String(unlockedId);
        if (this.quests.has(targetId)) this.edges.push({ source: id, target: targetId });
      }
    }
    this._buildAdjacency();
  }

  _buildAdjacency() {
    this.outgoing = {};
    this.incoming = {};
    this.edges.forEach(e => {
      (this.outgoing[e.source] ||= []).push(e.target);
      (this.incoming[e.target] ||= []).push(e.source);
    });
  }

  getQuest(id) {
    return this.quests.get(String(id));
  }

  findByCode(code) {
    const target = code.trim().toLowerCase();
    for (const q of this.quests.values()) {
      if (q.code.toLowerCase() === target) return q;
    }
    return null;
  }

  getAncestors(id) { return this._walk(id, this.incoming); }
  getDescendants(id) { return this._walk(id, this.outgoing); }

  _walk(startId, map) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
      const cur = queue.shift();
      (map[cur] || []).forEach(next => {
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      });
    }
    return visited;
  }

  async loadFromExtensionStorage() {
    const { kcqt_quests = {} } = await storageGet('kcqt_quests');
    const statusById = {};
    for (const [id, q] of Object.entries(kcqt_quests)) {
      statusById[id] = q.state;
    }
    this.applyStatusMap(statusById);
  }

  applyStatusMap(statusById) {
    for (const quest of this.quests.values()) {
      const existingStatus = quest.status || 0;
      const incomingStatus = statusById[quest.id] || 0;
      quest.applyStatus(Math.max(existingStatus, incomingStatus));
      quest.resetInferred();
    }
    this._backtrackCompletion();
  }

  async applySaveData(saveJson) {
    const { kcqt_quests: existingStorage = {} } = await storageGet('kcqt_quests');
    const statusById = {};
    const storageQuests = { ...existingStorage };

    // KC3Kai status codes map 1:1 to KCQT (1 = Available, 2 = Active, 3 = Completed)
    for (const key of Object.keys(saveJson.quests || {})) {
      const q = saveJson.quests[key];
      const qId = String(q.id);
      const existingState = existingStorage[qId]?.state || 0;
      const finalState = Math.max(existingState, q.status || 0);

      statusById[qId] = finalState;
      storageQuests[qId] = { id: q.id, state: finalState };
    }

    this.applyStatusMap(statusById);

    await storageSet({
      kcqt_quests: storageQuests,
      kcqt_lastUpdated: Date.now(),
    });
  }

  _backtrackCompletion() {
    const toInfer = new Set();
    for (const quest of this.quests.values()) {
      // Any quest that is Available (1), Active (2), or Completed (3) implies that all its prerequisite (ancestor) quests were completed
      if (quest.status >= 1) {
        this.getAncestors(quest.id).forEach(id => toInfer.add(id));
      }
    }
    toInfer.forEach(id => this.getQuest(id)?.markInferredCompleted());
  }

  async resetAll() {
    await storageRemove([
      'kcqt_quests', 'kcqt_lastUpdated', 'kcqt_questDefs', 'kcqt_questDefsUpdated'
    ]);
    for (const quest of this.quests.values()) {
      quest.applyStatus(0);
      quest.resetInferred();
    }
    this.applyStatusMap({});
  }

  // idFilter: optional Set of ids to include (used by search/focus)
  toCytoscapeElements(idFilter = null) {
    const elements = [];
    for (const quest of this.quests.values()) {
      if (idFilter && !idFilter.has(quest.id)) continue;
      elements.push({ data: quest.toCytoscapeData() });
    }
    for (const edge of this.edges) {
      if (idFilter && (!idFilter.has(edge.source) || !idFilter.has(edge.target))) continue;
      elements.push({ data: { source: edge.source, target: edge.target } });
    }
    return elements;
  }
}

export const QuestManager = new QuestManagerWorker();