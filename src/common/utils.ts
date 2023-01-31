import type { Article } from "@/background/backend";

export const formatDebuggablePayload = (payload: Article) => {
  const maxTrim = 600;
  const { title, textContent, htmlContent, date } = payload;
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
