// import browser, { omnibox, Runtime } from "webextension-polyfill";

import { PgLiteBackend } from "./background/backend-pglite";
import { log } from "./common/logs";
import { debounce } from "./common/utils";
import { BackendAdapter } from "./background/backend-adapter";

// Although there were initially multiple adapters there is no mainly one.
const adapter = new BackendAdapter({
  backend: new PgLiteBackend(),
});

/**
 * Expose for debugging
 * @example await fttf.backend._db.execO(`select * from sqlite_master;`)
 */
globalThis.fttf = adapter;

export type FTTF = {
  adapter: BackendAdapter;
};

if (adapter.onMessage) {
  chrome.runtime.onMessage.addListener((...args) => adapter.onMessage(...args));
}

// @note We do not support spas currently. URL changes trigger here, but we do
// not then instruct the frontend to send the full text.
const updateHandler = debounce(
  async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    console.debug("%ctab update", "color:gray;", "no action performed", tab.url);
    // browser.tabs.sendMessage(tabId, ["onTabUpdated", { tabId, changeInfo }]);
  },
  200
);

// Listen for tab updates, because the content script normally only runs on load. This is for SPA apps
chrome.tabs.onUpdated.addListener((...args) => updateHandler(...args));

// When the extension button is clicked, log a message
chrome.action.onClicked.addListener(async () => {
  await adapter.openIndexPage();
});
