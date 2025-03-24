import type { RpcMessage } from "@/background/backend";
import type { FTTF } from "@/background";

export type BrowserFTTF = FTTF & {
  rpc: (message: RpcMessage) => Promise<any>;
};

/**
 * NOTE: when the backend wants to send an error the frontend will know about it
 * passes the error prop. We re-throw it to match async/await error expectations.
 */
export const rpc = async <T = any>(message: RpcMessage): Promise<T> => {
  const response = await chrome.runtime.sendMessage(message);
  if (response && response.error) {
    throw new Error(response.error);
  }
  return response;
};

export const fttf: BrowserFTTF = {
  rpc,
  adapter: {
    onInstalled: async () => {},
    onMessage: () => true,
    openIndexPage() {
      return chrome.runtime.sendMessage(["openIndexPage"]);
    },
    // @ts-expect-error fixing these types is an exercise for another day...
    backend: {
      getStatus() {
        return chrome.runtime.sendMessage(["getStatus"]);
      },
      search: async (query) => {
        return chrome.runtime.sendMessage(["search", query]);
      },
      getPageStatus: async (url) => {
        return chrome.runtime.sendMessage(["getPageStatus", url]);
      },
      indexPage: async (url) => {
        return chrome.runtime.sendMessage(["indexPage", url]);
      },
      nothingToIndex: async (url) => {
        return chrome.runtime.sendMessage(["nothingToIndex", url]);
      },
      findOne: async (url) => {
        return chrome.runtime.sendMessage(["findOne", url]);
      },
    },
  },
};
