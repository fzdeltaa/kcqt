import fs from "node:fs";
import path from "node:path";

const vendors = [
  {
    package: "cytoscape",
    from: "dist/cytoscape.esm.mjs",
    to: "src/assets/js/cytoscape.esm.mjs",
  },
  {
    package: "cytoscape-dagre",
    from: "dist/cytoscape-dagre.min.mjs",
    to: "src/assets/js/cytoscape-dagre.min.mjs",
  }
];

for (const vendor of vendors) {
  const source = path.join(
    "node_modules",
    vendor.package,
    vendor.from
  );

  const destination = vendor.to;

  if (!fs.existsSync(source)) {
    continue;
  }

  fs.mkdirSync(path.dirname(destination), {
    recursive: true,
  });

  fs.copyFileSync(source, destination);

}