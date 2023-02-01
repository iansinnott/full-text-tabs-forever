const { writeFileSync } = require("fs");
const path = require("path");
const manifest = require(path.resolve(__dirname, "../dist/manifest.json"));

manifest.manifest_version = 2;
manifest.background = {
  scripts: [manifest.background.service_worker],
  persistent: true,
};
delete manifest["$schema"];
delete manifest["host_permissions"];

writeFileSync(path.resolve(__dirname, "../dist/manifest.json"), JSON.stringify(manifest, null, 2));

console.log("Manifest converted v3 -> v2");
