import type { RpcMessage } from "@/background/backend";
import type { FTTF } from "@/background";

export type BrowserFTTF = FTTF & {
  rpc: (message: RpcMessage) => Promise<any>;
};

/**
 * NOTE: when the backend wants to send an error the frontend will know about it
 * passes the error prop. We re-throw it to match async/await error expectations.
 */
export const rpc = async (message: RpcMessage) => {
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

      // @ts-expect-error Unknown prop, but i'm not yet committed to this API
      [`pg.loadDataDir`]: async (file: File) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            if (event.target?.result) {
              const base64 = event.target.result as string;
              const response = await chrome.runtime.sendMessage(["pg.loadDataDir", base64]);
              resolve(response);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(file);
        });
      },
    },
  },
};
