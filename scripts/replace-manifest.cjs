/**
 * Because chrome is so sensitive about the manifest file this script serves to
 * modify it for distribution.
 */
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

const modifyManifest = (manifest) => {
  delete manifest["$schema"];
};

try {
  const manifestV3 = JSON.parse(
    readFileSync(path.resolve(__dirname, "../dist/manifest.json"), "utf8")
  );

  // Mutate the manifest object
  modifyManifest(manifestV3);

  writeFileSync(
    path.resolve(__dirname, "../dist/manifest.json"),
    JSON.stringify(manifestV3, null, 2)
  );

  console.log("Manifest converted v3 -> v2");
} catch (err) {
  console.error("Could not build manifest", err);
}
