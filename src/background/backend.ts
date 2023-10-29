import { Runtime } from "webextension-polyfill";
import type { Readability } from '@mozilla/readability'

export type SendResponse = (response?: any) => void;

export type RemoteProcWithSender<T = any, Ret = any> = (payload: T, sender: Runtime.MessageSender) => Promise<Ret>;
export type RemoteProc<T = any, Ret = any> = (payload: T) => Promise<Ret>;

type ReadabilityArticle = Omit<NonNullable<ReturnType<Readability['parse']>>, 'content'>
export type Article = ReadabilityArticle & {
  extractor: string;
  htmlContent: string;
  date?: string;
  _extractionTime: number;
}

export type ArticleRow = Omit<Article, 'htmlContent' | 'textContent'> & {
  id: number;
  mdContentHash?: string;
  mdContent?: string;
  url: string;
  hostname: string;
  searchWords?: string[];
  lastVisit?: number; // Timestamp
  lastVisitDate?: string;
  updatedAt: number;
  createdAt: number; // Timestamp
  publicationDate?: number;
}

/** @deprecated don't use urls directly for now. use documents which have URLs */
export type UrlRow = {
  url: string;
  urlHash: string;
  title?: string;
  lastVisit?: number; // Timestamp
  hostname: string;
  textContentHash?: string;
  searchWords?: string[];
}

export type ResultRow = {
  rowid: number;
  id: number;
  entityId: number;
  attribute: string;
  snippet?: string;
  url: string;
  hostname: string;
  title?: string;
  excerpt?: string;
  lastVisit?: number; // Timestamp
  lastVisitDate?: string;
  mdContentHash?: string;
  updatedAt: number;
  createdAt: number; // Timestamp
}

export type DetailRow = ResultRow & {
  mdContent?: string;
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
  search: RemoteProc<{ query: string, limit?: number, offset?: number }, { ok: boolean, results: ResultRow[], count?: number, perfMs: number }>;
  findOne(query: { where:{ url: string } }): Promise<DetailRow | null>;
}