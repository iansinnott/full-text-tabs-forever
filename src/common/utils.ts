import type { Article, ArticleRow } from "@/background/backend";

export const formatDebuggablePayload = (payload: {
  [key: string]: any;
}) => {
  const maxTrim = 600;
  const { title, textContent, siteName } = payload;
  let trimmedBody = textContent
    .trim()
    .slice(0, maxTrim / 2)
    .trim();

  if (textContent.length > maxTrim / 2) {
    trimmedBody += `\n\n... ${((textContent.length - maxTrim) / 1000).toFixed(
      2,
    )}kb trimmed ...\n\n`;
    trimmedBody += textContent
      .trim()
      .slice(-maxTrim / 2)
      .trim();
  }

  return `
---
title: ${title}
siteName: ${siteName}
---
  
${trimmedBody}
`.trim();
};


export const shasum = async (text: string) => {
  const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

export const getArticleFragments = (textContent: string): string[] => {
  return textContent?.trim()?.split(/\n+/)?.map((x) => x.replace(/\s+/g, " ").trim()) || [];
}

export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};
