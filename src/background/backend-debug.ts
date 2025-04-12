/**
 * This backend is used for debugging purposes. It does not index anything.
 */

import { formatDebuggablePayload } from "../common/utils";
import { Backend, DetailRow } from "./backend";

export class DebugBackend implements Backend {
  getStatus: Backend["getStatus"] = async () => {
    return {
      ok: true,
    };
  };

  search: Backend["search"] = async (search) => {
    console.debug(`backend#%c${"search"}`, "color:lime;", search);
    return {
      ok: true,
      results: [],
      count: 0,
      perfMs: 0,
      query: search.query,
    };
  };

  async findOne(query: { where: { url: string } }): Promise<DetailRow | null> {
    console.debug(`backend#%c${"findOne"}`, "color:lime;", query);
    return null;
  }

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

    console.debug(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend["indexPage"] = async (payload, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.text_content?.replace(/[ \t]+/g, " ").replace(/\n+/g, "\n");

    console.debug(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.debug(formatDebuggablePayload({ ...payload, textContent: plainText }));
    return {
      message: "debug backend does not index pages",
    };
  };

  nothingToIndex: Backend["nothingToIndex"] = async (payload, sender) => {
    const { tab } = sender;
    console.debug(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  };

  getRecent: Backend["getRecent"] = async (options) => {
    console.debug(`backend#%c${"getRecent"}`, "color:lime;", options);
    return {
      ok: true,
      results: [],
      count: 0,
      perfMs: 0,
    };
  };
}
