import { greetings } from "./common/const";
import { log } from "./common/logs";

type VisitOpts = {
  type?: "created" | "updated" | "activated";
  previewImageBase64?: string;
};

const handleVisit = async (tab: chrome.tabs.Tab, opts: VisitOpts = {}) => {
  if (tab.url === undefined) return;
  if (tab.url.startsWith("moz-extension://")) return;
  if (tab.url.startsWith("about:")) return;
  if (tab.url.startsWith("data:")) return;
  if (tab.url.includes("localhost:")) return;

  let fancyUrl = "";
  try {
    fancyUrl = new URL(tab.url).hostname;
  } catch (err) {
    console.log("No URL to parse");
  }

  const { type } = opts;
  console.log(`%c${type}`, "color:salmon;", fancyUrl, tab.title);
};

chrome.runtime.onInstalled.addListener(async () => {
  log("background installed:", greetings);
});

// @note It is usually the case that a new tab displays about:blank as the URL
// before it is updated. Thus, see the on updated handler below.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url === undefined) return;
  if (tab.url.startsWith("moz-extension://")) return;
  if (tab.url.startsWith("about:")) return;

  await handleVisit(tab, {
    type: "created",
  });
});

// whenever a tab is updated, log the URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") return;

  // const previewImageOpts = {
  //   format: "jpeg" as const,
  //   quality: 40,
  // };
  // const previewImageBase64 = await chrome.tabs.captureVisibleTab(tab.windowId, previewImageOpts);
  // console.log("preview opts:", previewImageOpts);

  await handleVisit(tab, {
    type: "updated",
  });
});

// @note for switching between tabs. However, not currently needed
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  await handleVisit(tab, {
    type: "activated",
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    const { tab } = sender;
    const [type, payload] = request as [string, any];
    console.log(`%c${type}`, "color:lime;", { url: tab?.url, payload });
    if (sender.url !== tab?.url) {
      console.log(`%cinfo`, "color:yellow;", "sender URL and tab URL differ. probably iframe");
    }
    sendResponse({ jello: "yes" });
  } catch (err) {
    console.error("Could not parse message", request, sender, err);
    sendResponse({ error: err.message });
  }
});
