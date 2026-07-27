import { Quest } from '../objects/Quest.js';

class QuestManagerWorker {
  constructor() {
    this.quests = new Map();   // id -> Quest
    this.edges = [];           // [{ source, target }]
    this.outgoing = {};
    this.incoming = {};
    this.loaded = false;
  }

  async load() {
    const [quests, metadataQuests] = await Promise.all([
      fetch('https://raw.githubusercontent.com/KC3Kai/kc3-translations/master/data/en/quests.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/KC3Kai/KC3Kai/master/src/data/quests_meta.json').then(r => r.json()),
    ]);
    delete metadataQuests['EoF&RemarksOfDataFormat'];

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
        if (this.quests.has(targetId)) {
          this.edges.push({ source: id, target: targetId });
        }
      }
    }

    this._buildAdjacency();
    this.loaded = true;
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

  applySaveData(saveJson) {
    const statusById = {};
    for (const key of Object.keys(saveJson.quests || {})) {
      const q = saveJson.quests[key];
      statusById[String(q.id)] = q.status;
    }
    for (const quest of this.quests.values()) {
      quest.applyStatus(statusById[quest.id] || 0);
      quest.resetInferred();
    }
    this._backtrackCompletion();
  }

  _backtrackCompletion() {
    const toInfer = new Set();
    for (const quest of this.quests.values()) {
      if (quest.status >= 1) this.getAncestors(quest.id).forEach(id => toInfer.add(id));
    }
    toInfer.forEach(id => this.getQuest(id)?.markInferredCompleted());
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