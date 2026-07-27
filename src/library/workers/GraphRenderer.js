import cytoscape from "../../assets/js/cytoscape.esm.mjs";
import cytoscapeDagre from "../../assets/js/cytoscape-dagre.min.mjs";

cytoscape.use(cytoscapeDagre);

const STYLE = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      width: "3em", height: "1.5em", shape: "roundrectangle",
      "font-size": "10pt", "font-weight": "bold",
      "background-color": "data(color)",
      "border-width": "1.5pt", "border-color": "#999999",
      "text-valign": "center", "text-halign": "center", padding: "0pt"
    }
  },
  { selector: "node[status = 2]", style: { "border-color": "#33A459", "border-width": "2.5pt" } },
  { selector: "node[status = 1]", style: { "border-color": "#000000", "border-width": "1.5pt" } },
  { selector: "node[status = 3]", style: { "opacity": 0.35 } },
  { selector: "node[?inferredCompleted]", style: { "opacity": 0.35, "border-style": "dashed" } },
  { selector: "node:selected", style: { "border-color": "#1e90ff", "border-width": "4pt", "z-index": 999 } },
  {
    selector: "edge",
    style: {
      width: 1, "curve-style": "bezier", "line-color": "#ccc",
      "target-arrow-shape": "triangle", "target-arrow-color": "#ccc", "arrow-scale": 0.7
    }
  }
];

const LAYOUT_CONFIG = {
  name: "dagre", rankDir: "LR", nodeSep: 5, rankSep: 30, edgeSep: 3,
  ranker: "network-simplex", spacingFactor: 1, nodeDimensionsIncludeLabels: true,
};

class GraphRendererWorker {
  constructor() {
    this.cy = null;
    this.onNodeTap = null;
    this.onBackgroundTap = null;
  }

  init(containerEl) {
    this.cy = cytoscape({
      container: containerEl,
      elements: [],
      autoungrabify: true,
      wheelSensitivity: 5,
      style: STYLE,
    });

    this.cy.on('tap', 'node', (evt) => this.onNodeTap?.(evt.target));
    this.cy.on('tap', (evt) => { if (evt.target === this.cy) this.onBackgroundTap?.(); });

    return this.cy;
  }

  splitConnected(elements) {
    const connected = new Set();
    elements.forEach(e => {
      if (e.data.source) { connected.add(e.data.source); connected.add(e.data.target); }
    });
    return {
      mainElements: elements.filter(e => e.data.source || connected.has(e.data.id)),
      isolatedNodes: elements.filter(e => !e.data.source && !connected.has(e.data.id)),
    };
  }

  async render(elements) {
    const { mainElements, isolatedNodes } = this.splitConnected(elements);

    this.cy.batch(() => { this.cy.elements().remove(); this.cy.add(mainElements); });

    await new Promise((resolve) => {
      const layout = this.cy.layout(LAYOUT_CONFIG);
      layout.one('layoutstop', resolve);
      layout.run();
    });

    if (isolatedNodes.length > 0) this._placeOrphans(isolatedNodes);
    this.cy.fit(this.cy.nodes(), 30);
  }

  _placeOrphans(isolatedNodes) {
    const bb = this.cy.nodes().boundingBox();
    const startX = bb.x1, colGap = 70, rowGap = 35;
    const cols = Math.max(1, Math.floor((bb.w || 800) / colGap));
    const totalRows = Math.ceil(isolatedNodes.length / cols);
    const startY = bb.y1 - 80 - (totalRows - 1) * rowGap;

    isolatedNodes.forEach((el, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      this.cy.add({
        ...el, classes: "orphan",
        position: { x: startX + col * colGap, y: startY + row * rowGap }
      });
    });
  }

  selectNode(id) {
    const node = this.cy.getElementById(id);
    if (node.length === 0) return null;
    node.select();
    return node;
  }
}

export const GraphRenderer = new GraphRendererWorker();