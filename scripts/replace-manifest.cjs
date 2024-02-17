/**
 * Because chrome is so sensitive about the manifest file this script serves to
 * modify it for distribution.
 */
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

const modifyManifest = (manifest) => {
  delete manifest["$schema"];
};

// const args = process.argv;
// let platform = "chrome";
// if (args.length > 1) {
//     console.error("More than 1 argument specified.");
// }

// if (args.length === 1) {
//   if (args[0] === "chrome") {
//     platform = "chrome";
//   } else {
//     platform = "firefox";
//   }
// }

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

  console.log("Manifest cleaned");
} catch (err) {
  console.error("Could not build manifest", err);
}
