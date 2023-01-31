import { Runtime } from "webextension-polyfill";
import type { Readability } from '@mozilla/readability'

export type SendResponse = (response?: any) => Promise<void>;

export type RemoteProc<T = any> = (payload: T, sender: Runtime.MessageSender) => Promise<any>;

type ReadabilityArticle = Omit<NonNullable<ReturnType<Readability['parse']>>, 'content'>
export type Article = ReadabilityArticle & {
  extractor: string;
  htmlContent: string;
  date?: string;
  _extractionTime: number;
}

type FirstArg<T> = T extends (arg: infer U, ...args: any[]) => any ? U : never;

export type RpcMessage =
  [method: "getPageStatus", payload: FirstArg<Backend["getPageStatus"]>]
  | [method: "indexPage", payload: FirstArg<Backend["indexPage"]>]
  | [method: "nothingToIndex"]
  | [method: string, payload: any];

export interface Backend {
  getPageStatus: RemoteProc;
  indexPage: RemoteProc<Article>;
  nothingToIndex: RemoteProc;
}