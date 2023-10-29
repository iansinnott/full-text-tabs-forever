import browser, { omnibox, Runtime } from "webextension-polyfill";
import type { Backend, SendResponse } from "./background/backend";
// import { DebugBackend } from "./background/backend-debug";
// import { IndexedDbBackend } from "./background/backend-indexeddb";
import { WebSQLBackend } from "./background/backend-websql";
import { log } from "./common/logs";
import { debounce } from "./common/utils";

class BackendAdapter {
  backend: Backend;

  constructor({ backend }: { backend: Backend }) {
    this.backend = backend;
  }

  async onInstalled(details: browser.Runtime.OnInstalledDetailsType) {
    log("@todo Check if the backend is available");
  }

  onMessage(message: any, sender: browser.Runtime.MessageSender, sendResponse: SendResponse) {
    let waitForResponse = false;
    try {
      const { tab } = sender;
      const [method, payload] = message as [string, any];

      if (sender.url !== tab?.url) {
        console.log(`%cinfo`, "color:yellow;", "sender URL and tab URL differ. probably iframe");
      }

      // @ts-ignore This could be handled better. unimportant for now
      if (typeof this.backend[method] === "function") {
        waitForResponse = true;
        // @ts-ignore
        this.backend[method](payload, sender)
          .then((ret) => {
            sendResponse(ret);
          })
          .catch((err) => {
            console.error("Could not send response", err);
            sendResponse({ error: err.message });
          });
      } else {
        console.warn(`%c${method}`, "color:yellow;", "is not a valid method", payload);
        sendResponse({ error: `'${method}' is not a valid RPC` });
      }
    } catch (err) {
      console.error("Could not parse message", message, sender, err);
      sendResponse({ error: err.message });
    }

    return waitForResponse; // Keep channel open for async response. Yikes
  }
}

const adapter = new BackendAdapter({
  backend: new WebSQLBackend(),
  // backend: new DebugBackend(),
  // backend: new IndexedDbBackend(),
});

export type FTTF = {
  adapter: BackendAdapter;
};

declare global {
  interface Window {
    fttf: FTTF;
  }
}

if (typeof window !== "undefined") {
  window.fttf = { adapter };
}

browser.runtime.onInstalled.addListener((...args) => {
  if (adapter.onInstalled) {
    adapter.onInstalled(...args);
  }
});

if (adapter.onMessage) {
  // @ts-expect-error sendMessage types are wrong
  browser.runtime.onMessage.addListener((...args) => adapter.onMessage(...args));
}

// @note We do not support spas currently
const updateHandler = debounce(
  async (
    tabId: number,
    changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
    tab: browser.Tabs.Tab
  ) => {
    console.log("%ctab update", "color:gray;", "no action performed", tab.url);
    // browser.tabs.sendMessage(tabId, ["onTabUpdated", { tabId, changeInfo }]);
  },
  200
);

// Listen for tab updates, because the content script normally only runs on load. This is for SPA apps
browser.tabs.onUpdated.addListener(updateHandler);

// When the extension button is clicked, log a message
browser.browserAction.onClicked.addListener(async () => {
  const [existingTab] = await browser.tabs.query({
    url: browser.runtime.getURL("index.html"),
  });

  if (existingTab) {
    await browser.tabs.update(existingTab.id, {
      active: true,
    });
  } else {
    await browser.tabs.create({
      url: browser.runtime.getURL("index.html"),
    });
  }
});
