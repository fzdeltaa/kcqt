export const CATEGORY_LABELS = {
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

export const CATEGORY_COLORS = {
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

function buildRepeatTypeLookup(repeatableIds) {
  const lookup = {};
  for (const [typeName, ids] of Object.entries(repeatableIds)) {
    ids.forEach(id => { lookup[id] = typeName; });
  }
  return lookup;
}

const REPEAT_TYPE_LOOKUP = buildRepeatTypeLookup(REPEATABLE_QUEST_IDS);

export class Quest {
  constructor({ id, code, name, desc, memo }) {
    this.id = String(id);
    this.numericId = Number(this.id);
    this.code = code || this.id;
    this.name = name || '';
    this.desc = desc || '';
    this.memo = memo || '';

    this.status = 0;
    this.inferredCompleted = false;
  }

  getCategory(id) {
    return Math.floor((this.numericId || 0) / 100);
  }

  getCategoryLabel() {
    return CATEGORY_LABELS[this.getCategory()] || 'Unknown';
  }

  getColor() {
    return CATEGORY_COLORS[this.getCategory()] || '#555555';
  }

  getRepeatType() {
    return REPEAT_TYPE_LOOKUP[this.numericId] || 'once';
  }

  isCompleted() {
    return this.status === 3 || this.inferredCompleted;
  }

  applyStatus(status) {
    this.status = status || 0;
  }

  markInferredCompleted() {
    if (this.status !== 3) this.inferredCompleted = true;
  }

  resetInferred() {
    this.inferredCompleted = false;
  }

  toCytoscapeData() {
    return {
      id: this.id,
      label: this.code,
      name: this.name,
      desc: this.desc,
      memo: this.memo,
      category: this.getCategory(),
      categoryLabel: this.getCategoryLabel(),
      color: this.getColor(),
      repeatType: this.getRepeatType(),
      status: this.status,
      completed: this.isCompleted(),
      inferredCompleted: this.inferredCompleted,
    };
  }
}