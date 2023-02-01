import type { Article, ArticleRow } from "@/background/backend";

export const formatDebuggablePayload = (payload: ArticleRow) => {
  const maxTrim = 600;
  const { title, textContent, date } = payload;
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
extractor: ${payload.extractor}
title: ${title}
siteName: ${payload.siteName}
date: ${date}
_extractionTime: ${payload._extractionTime}
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
