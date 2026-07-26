import cytoscape from "../../assets/js/cytoscape.esm.mjs";
import cytoscapeDagre from "../../assets/js/cytoscape-dagre.min.mjs";

const CATEGORY_LABELS = {
  1: 'Composition',
  2: 'Sortie',
  3: 'Exercise',
  4: 'Expedition',
  5: 'Supply',
  6: 'Arsenal',
  7: 'Modernization',
  8: 'Sortie',
  9: 'Sortie',
  10: 'Sortie',
  11: 'Arsenal',
};

const CATEGORY_COLORS = {
  1: '#33A459',
  2: '#D75048',
  3: '#98E75F',
  4: '#AACCEE',
  5: '#EDD286',
  6: '#996600',
  7: '#AE76FA',
  8: '#D75048',
  9: '#D75048',
  10: '#D75048',
  11: '#996600',
};

const REPEATABLE_QUEST_IDS = {
  daily: [201, 216, 210, 211, 218, 212, 226, 230, 303, 304, 402, 403, 503, 504, 605, 606, 607, 608, 609, 619, 673, 674, 702, 1166],
  weekly: [214, 220, 213, 221, 228, 229, 241, 242, 243, 261, 302, 404, 410, 411, 613, 638, 676, 677, 703, 1167],
  monthly: [249, 256, 257, 259, 265, 264, 266, 280, 311, 318, 424, 626, 628, 645],
  quarterly: [284, 330, 337, 339, 342, 426, 428, 637, 643, 653, 663, 675, 678, 680, 686, 688, 822, 845, 854, 861, 862, 872, 873, 875, 888, 893, 894, 903],
  yearlyJan: [681, 1005, 1123],
  yearlyFeb: [348, 434, 442, 716, 717, 904, 905],
  yearlyMar: [350, 436, 444, 912, 914],
  yearlyApr: [362, 371, 1045],
  yearlyMay: [356, 437, 973, 975, 1012],
  yearlyJun: [353, 357, 372, 944, 945, 946, 947, 948, 1103, 1104, 1138],
  yearlyJul: [354, 368, 373, 1105],
  yearlyAug: [438],
  yearlySep: [375, 439, 440, 657, 928, 1018, 1107],
  yearlyOct: [345, 346, 355, 377, 654],
  yearlyNov: [655, 714, 715],
  yearlyDec: [1120],
};

// flip it into id -> type for O(1) lookup per quest
function buildRepeatTypeLookup(repeatableIds) {
  const lookup = {};
  for (const [typeName, ids] of Object.entries(repeatableIds)) {
    ids.forEach(id => { lookup[id] = typeName; });
  }
  return lookup;
}

const REPEAT_TYPE_LOOKUP = buildRepeatTypeLookup(REPEATABLE_QUEST_IDS);

// (async () => {
  cytoscape.use(cytoscapeDagre);

  const allElements = await buildCytoscapeElements();
  const { mainElements, isolatedNodes } = splitConnected(allElements);

  const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: mainElements,
    autoungrabify: true,
    wheelSensitivity: 5,
    style: [
  {
    selector: "node",
    style: {
      label: "data(id)",
      width: "3em",
      height: "1.5em",
      shape: "roundrectangle",
      "font-size": "10pt",
      "font-weight": "bold",
      "background-color": "data(color)",
      "border-width": "1.5pt",
      "border-color": "#999999", // default/neutral border for unseen quests
      "text-valign": "center",
      "text-halign": "center",
      padding: "0pt"
    }
  },
  // status 2 = Selected/Active -> green border
  {
    selector: "node[status = 2]",
    style: {
      "border-color": "#33A459",
      "border-width": "2.5pt"
    }
  },
  // status 1 = Open/Available -> black border
  {
    selector: "node[status = 1]",
    style: {
      "border-color": "#000000",
      "border-width": "1.5pt"
    }
  },
  // status 3 = Completed (confirmed) -> transparent
  {
    selector: "node[status = 3]",
    style: {
      "opacity": 0.35
    }
  },
  // backtracked/inferred completion -> same transparency, but dashed
  // border so you can still tell "confirmed" apart from "inferred"
  {
    selector: "node[?inferredCompleted]",
    style: {
      "opacity": 0.35,
      "border-style": "dashed"
    }
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "curve-style": "bezier",
      "line-color": "#ccc",
      "target-arrow-shape": "triangle",
      "target-arrow-color": "#ccc",
      "arrow-scale": 0.7
    }
  }
],
    layout: {
      name: "dagre",
      rankDir: "LR",
      nodeSep: 5,
      rankSep: 30,
      edgeSep: 3,
      ranker: "network-simplex",
      spacingFactor: 1,
      nodeDimensionsIncludeLabels: true
    }
  });

  if (isolatedNodes.length > 0) {
    const bb = cy.nodes().boundingBox();
    const startX = bb.x1;
    const colGap = 70;
    const rowGap = 35;
    const cols = Math.max(1, Math.floor((bb.w || 800) / colGap));
    const totalRows = Math.ceil(isolatedNodes.length / cols);
    const startY = bb.y1 - 80 - (totalRows - 1) * rowGap;

    isolatedNodes.forEach((el, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      cy.add({
        ...el,
        classes: "orphan",
        position: {
          x: startX + col * colGap,
          y: startY + row * rowGap
        }
      });
    });
  }

  cy.on('tap', 'node', (evt) => {
    const node = evt.target;
    const d = node.data();

    const panel = document.getElementById('quest-info');
    panel.innerHTML = `
    <h3>${d.name || d.id}</h3>
    <p>${d.desc || ''}</p>
    <p>${d.memo || ''}</p>
  `;
  });

  // optional: clear panel when clicking empty canvas
  cy.on('tap', (evt) => {
    if (evt.target === cy) {
      document.getElementById('quest-info').innerHTML = '';
    }
  });
  cy.fit(cy.nodes(), 30);
// })();

function getIdHigh(id) {
  return Math.floor((Number(id) || 0) / 100);
}

async function buildCytoscapeElements() {
  const { quests, metadataQuests } = await getQuests();
  const elements = [];

  for (const id of Object.keys(quests)) {
    const q = quests[id];
    const idHigh = getIdHigh(id);
    const numericId = Number(id);

    elements.push({
      data: {
        id,
        label: q.code || id,
        name: q.name,
        desc: q.desc || '',
        memo: q.memo || '',
        category: idHigh,
        categoryLabel: CATEGORY_LABELS[idHigh] || 'Unknown',
        color: CATEGORY_COLORS[idHigh] || '#555555',

        repeatType: REPEAT_TYPE_LOOKUP[numericId] || 'once',
        completed: false,       // will be driven by imported quest list later
        lastCompletedAt: null,  // timestamp, for repeatables
      }
    });
  }

  for (const [id, meta] of Object.entries(metadataQuests)) {
    if (!Array.isArray(meta.unlock)) continue;
    for (const unlockedId of meta.unlock) {
      const targetId = String(unlockedId);
      if (quests[targetId]) {
        elements.push({ data: { source: id, target: targetId } });
      }
    }
  }

  return elements;
}

function splitConnected(elements) {
  const connected = new Set();

  elements.forEach(e => {
    if (e.data.source) {
      connected.add(e.data.source);
      connected.add(e.data.target);
    }
  });

  const mainElements = elements.filter(e =>
    e.data.source || connected.has(e.data.id)
  );
  const isolatedNodes = elements.filter(e =>
    !e.data.source && !connected.has(e.data.id)
  );

  return { mainElements, isolatedNodes };
}

async function getQuests() {
  const quests = await fetch('https://raw.githubusercontent.com/KC3Kai/kc3-translations/master/data/en/quests.json').then(r => r.json());
  const metadataQuests = await fetch('https://raw.githubusercontent.com/KC3Kai/KC3Kai/master/src/data/quests_meta.json').then(r => r.json());

  delete metadataQuests['EoF&RemarksOfDataFormat'];

  return { quests, metadataQuests };
}

function parseQuestSave(saveJson) {
  const statusById = {};
  for (const key of Object.keys(saveJson.quests || {})) {
    const q = saveJson.quests[key];
    statusById[String(q.id)] = q.status; // normalize numeric id -> string, matching node.id()
  }
  return statusById;
}

function applyQuestStatus(cy, statusById) {
  cy.nodes().forEach(node => {
    const status = statusById[node.id()];
    node.data('status', status || 0); // 0 = not present in save / never seen
    node.data('completed', status === 3);
  });
}

function getAllAncestors(node) {
  const visited = new Set();
  const queue = [node];
  while (queue.length) {
    const current = queue.shift();
    const preds = current.incomers('edge').sources();
    preds.forEach(p => {
      if (!visited.has(p.id())) {
        visited.add(p.id());
        queue.push(p);
      }
    });
  }
  return visited;
}

function backtrackCompletion(cy) {
  const toInfer = new Set();

  cy.nodes().forEach(node => {
    const status = node.data('status');
    if (status === 1 || status === 2 || status === 3) {
      getAllAncestors(node).forEach(id => toInfer.add(id));
    }
  });

  toInfer.forEach(id => {
    const node = cy.getElementById(id);
    if (node.data('status') !== 3) {
      // don't overwrite confirmed completion, just fill the gap
      node.data('completed', true);
      node.data('inferredCompleted', true);
    }
  });
}

document.getElementById('save-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const saveJson = JSON.parse(text);

  const statusById = parseQuestSave(saveJson);
  applyQuestStatus(cy, statusById);
  backtrackCompletion(cy);
});