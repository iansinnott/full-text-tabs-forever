import { Runtime } from "webextension-polyfill";
import type { Readability } from '@mozilla/readability'

export type SendResponse = (response?: any) => Promise<void>;

export type RemoteProc<T = any> = (payload: T, sender: Runtime.MessageSender) => Promise<any>;

type ReadabilityArticle = Omit<NonNullable<ReturnType<Readability['parse']>>, 'content'>
export type Article = ReadabilityArticle & {
  htmlContent: string;
  date?: string;
}

type FirstArg<T> = T extends (arg: infer U, ...args: any[]) => any ? U : never;

export type RpcMessage =
  [method: "getPageStatus", payload: FirstArg<Backend["getPageStatus"]>]
  | [method: "indexPage", payload: FirstArg<Backend["indexPage"]>]
  | [method: "nothingToIndex"]
  | [method: string, payload: any];

export class Backend {
  getPageStatus: RemoteProc = async (payload, sender) => {
    const { tab } = sender;
    console.log(`%c${"getPageStatus"}`, "color:lime;", { url: tab?.url }, payload);
    return {
      shouldIndex: true,
    };
  };

  indexPage: RemoteProc<Article> = async (payload, sender) => {
    const { tab } = sender;

    console.log(`%c${"indexPage"}`, "color:lime;", tab?.url);
    console.log(formatDebuggablePayload(payload))
    return {
      "@todo": "actually index page",
    };
  };

  nothingToIndex: RemoteProc = async (payload, sender) => {
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
title: ${title}
siteName: ${payload.siteName}
date: ${date}
---
  
${trimmedBody}
`.trim();
}
