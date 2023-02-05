const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

try {
  const manifestV3 = JSON.parse(
    readFileSync(path.resolve(__dirname, "../dist/manifest.json"), "utf8")
  );

  manifestV3.manifest_version = 2;
  manifestV3.background = {
    page: "index.html",
    persistent: true,
  };
  manifestV3.browser_action = manifestV3.action;
  delete manifestV3["action"];
  delete manifestV3["background"]["service_worker"];
  delete manifestV3["$schema"];
  delete manifestV3["host_permissions"];

  writeFileSync(
    path.resolve(__dirname, "../dist/manifest.json"),
    JSON.stringify(manifestV3, null, 2)
  );

  console.log("Manifest converted v3 -> v2");
} catch (err) {
  console.error("Could not build manifest", err);
}
