import "./global.css";
import App from "./App.svelte";

// Connect to the background page to signal the extension is open
// This is used to trigger automatic migration if needed
const port = chrome.runtime.connect({ name: "extension-page" });

const app = new App({
  target: document.getElementById("app")!,
});

export default app;
