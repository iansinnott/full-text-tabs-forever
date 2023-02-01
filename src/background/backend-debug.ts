import { formatDebuggablePayload } from "../common/utils";
import { Article, Backend, RemoteProcWithSender } from "./backend";

export class DebugBackend implements Backend {
  getPageStatus: Backend["getPageStatus"] = async (payload, sender) => {
    const { tab } = sender;
    let shouldIndex = tab?.url?.startsWith("http"); // ignore chrome extensions, about:blank, etc

    try {
      const url = new URL(tab?.url || "");
      if (url.hostname === "localhost") shouldIndex = false;
      if (url.hostname.endsWith(".local")) shouldIndex = false;
    } catch (err) {
      // should not happen
      throw err;
    }

    console.log(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (payload, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.textContent.replace(/[ \t]+/g, " ").replace(/\n+/g, "\n");

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload({ ...payload, textContent: plainText }));
    return {
      message: "debug backend does not index pages",
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.log(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  };
}
