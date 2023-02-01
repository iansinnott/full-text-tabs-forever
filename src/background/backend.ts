import { Runtime } from "webextension-polyfill";
import type { Readability } from '@mozilla/readability'

export type SendResponse = (response?: any) => Promise<void>;

export type RemoteProcWithSender<T = any, Ret = any> = (payload: T, sender: Runtime.MessageSender) => Promise<Ret>;
export type RemoteProc<T = any, Ret = any> = (payload: T) => Promise<Ret>;

type ReadabilityArticle = Omit<NonNullable<ReturnType<Readability['parse']>>, 'content'>
export type Article = ReadabilityArticle & {
  extractor: string;
  htmlContent: string;
  mdContent?: string;
  date?: string;
  _extractionTime: number;
}

export type ArticleRow = Article & {
  textContentHash: string;
  searchWords?: string[];
}

export type UrlRow = {
  url: string;
  urlHash: string;
  title?: string;
  lastVisit?: number; // Timestamp
  textContentHash?: string;
  searchWords?: string[];
}

export type ResultRow = {
  url: string;
  urlHash: string;
  title?: string;
  lastVisit?: number; // Timestamp
  textContentHash?: string;
  snippet?: string;
}

type FirstArg<T> = T extends (arg: infer U, ...args: any[]) => any ? U : never;

export type RpcMessage =
  [method: "getPageStatus"]
  | [method: "indexPage", payload: FirstArg<Backend["indexPage"]>]
  | [method: "nothingToIndex"]
  | [method: "getStats"]
  | [method: "search", payload: FirstArg<Backend["search"]>]
  | [method: string, payload: any];

export interface Backend {
  getPageStatus: RemoteProcWithSender;
  indexPage: RemoteProcWithSender<Article>;
  nothingToIndex: RemoteProcWithSender;
  search: RemoteProc<{ query: string }, { ok: boolean, results: ResultRow[] }>;
}