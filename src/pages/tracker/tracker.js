import { QuestManager } from '../../library/workers/QuestManager.js';
import { GraphRenderer } from '../../library/workers/GraphRenderer.js';

function showQuestInfo(node) {
  const d = node.data();
  document.getElementById('quest-info').innerHTML = `
    <h3>${d.name || d.id}</h3>
    <p>${d.desc || ''}</p>
    <p>${d.memo || ''}</p>
  `;
}

function clearQuestInfo() {
  document.getElementById('quest-info').innerHTML = '';
}

async function focusOnQuest(code) {
  const trimmed = code.trim();
  if (!trimmed) return;

  const quest = QuestManager.findByCode(trimmed);
  if (!quest) { alert(`No quest found with code "${code}"`); return; }

  const keepIds = new Set([
    quest.id,
    ...QuestManager.getAncestors(quest.id),
    ...QuestManager.getDescendants(quest.id),
  ]);

  await GraphRenderer.render(QuestManager.toCytoscapeElements(keepIds));

  const node = GraphRenderer.selectNode(quest.id);
  if (node) showQuestInfo(node);
}

async function showAll() {
  clearQuestInfo();
  await GraphRenderer.render(QuestManager.toCytoscapeElements());
}

(async () => {
  GraphRenderer.init(document.getElementById('cy'));
  GraphRenderer.onNodeTap = showQuestInfo;
  GraphRenderer.onBackgroundTap = clearQuestInfo;

  document.getElementById('save-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const saveJson = JSON.parse(await file.text());
    QuestManager.applySaveData(saveJson);
    await GraphRenderer.render(QuestManager.toCytoscapeElements());
  });

  document.getElementById('quest-search-btn').addEventListener('click', () => {
    focusOnQuest(document.getElementById('quest-search-input').value);
  });
  document.getElementById('quest-search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') focusOnQuest(e.target.value);
  });
  document.getElementById('quest-search-clear').addEventListener('click', showAll);

  try {
    await QuestManager.load();
    await GraphRenderer.render(QuestManager.toCytoscapeElements());
  } catch (err) {
    alert('Failed to load quest data');
  }
})();