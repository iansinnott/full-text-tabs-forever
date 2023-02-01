import browser, { omnibox, Runtime } from "webextension-polyfill";
import { Backend, SendResponse } from "./background/backend";
// import { DebugBackend } from "./background/backend-debug";
// import { IndexedDbBackend } from "./background/backend-indexeddb";
import { WebSQLBackend } from "./background/backend-websql";
import { log } from "./common/logs";

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

if (adapter.onInstalled) {
  browser.runtime.onInstalled.addListener((...args) => adapter.onInstalled(...args));
}

if (adapter.onMessage) {
  // @ts-expect-error sendMessage types are wrong
  browser.runtime.onMessage.addListener((...args) => adapter.onMessage(...args));
}