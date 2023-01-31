import { Article, Backend, RemoteProc } from "./backend";

export class WebSQLBackend implements Backend {
  getPageStatus: Backend['getPageStatus'] = async (payload, sender) => {
    const { tab } = sender;
    let shouldIndex = tab?.url?.startsWith("http"); // ignore chrome extensions, about:blank, etc

    try {
      const url = new URL(tab?.url || "");
      if (url.hostname === "localhost") shouldIndex = false;
      if (url.hostname.endsWith(".local")) shouldIndex = false;
    } catch (err) {
      // should not happen
      throw err
    }

    console.log(`%c${"getPageStatus"}`, "color:lime;", { shouldIndex, url: tab?.url }, payload);

    return {
      shouldIndex,
    };
  };

  indexPage: Backend['indexPage'] = async (payload, sender) => {
    const { tab } = sender;

    // remove adjacent whitespace since it serves no purpose. The html or
    // markdown content stores formatting.
    const plainText = payload.textContent.replace(/[ \t]+/g, " ").replace(/\n+/g, "\n");

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload({ ...payload, textContent: plainText }))
    return {
      "@todo": "actually index page",
    };
  };

  nothingToIndex: Backend['nothingToIndex'] = async (payload, sender) => {
    const { tab } = sender;
    console.log(`%c${"nothingToIndex"}`, "color:beige;", tab?.url);
    return {
      ok: true,
    };
  }
}


const formatDebuggablePayload = (payload: Article) => {
  const maxTrim = 600;
  const { title, textContent, htmlContent, date } = payload;
  let trimmedBody = textContent.trim().slice(0, maxTrim / 2).trim()

  if (textContent.length > (maxTrim / 2)) {
    trimmedBody += `\n\n... ${((textContent.length - maxTrim) / 1000).toFixed(2)}kb trimmed ...\n\n`
    trimmedBody += textContent.trim().slice(-maxTrim / 2).trim()
  }

  return `
---
extractor: ${payload.extractor}
title: ${title}
siteName: ${payload.siteName}
date: ${date}
_extractionTime: ${payload._extractionTime}
---
  
${trimmedBody}
`.trim();
}
