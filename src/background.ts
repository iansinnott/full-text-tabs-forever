import { greetings } from "./common/const";
import { log } from "./common/logs";

type VisitOpts = {
  type?: "created" | "updated" | "activated";
  previewImageBase64?: string;
};

const handleVisit = async (url?: string, title?: string, opts: VisitOpts = {}) => {
  const { type } = opts;
  console.log(type, url, title);
};

chrome.runtime.onInstalled.addListener(async () => {
  log("background", greetings);
});

// @note It is usually the case that a new tab displays about:blank as the URL
// before it is updated. Thus, see the on updated handler below.
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url === undefined) return;
  if (tab.url.startsWith("moz-extension://")) return;
  if (tab.url.startsWith("about:")) return;

  handleVisit(tab.url, tab.title, {
    type: "created",
  });
});

// whenever a tab is updated, log the URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tab.url === undefined) return;
  if (tab.url.startsWith("moz-extension://")) return;
  if (tab.url.startsWith("about:")) return;
  if (tab.url.startsWith("data:")) return;
  if (tab.url.includes("localhost:")) return;
  if (changeInfo.status === "loading") return;
  // const previewImageOpts = {
  //   format: "jpeg" as const,
  //   quality: 40,
  // };
  // const previewImageBase64 = await chrome.tabs.captureVisibleTab(tab.windowId, previewImageOpts);
  // console.log("preview opts:", previewImageOpts);

  handleVisit(tab.url, tab.title, {
    type: "updated",
  });
});

// @note for switching between tabs. However, not currently needed
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  handleVisit(tab.url, tab.title, {
    type: "activated",
  });
});
