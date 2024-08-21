export const formatDebuggablePayload = (payload: { [key: string]: any }) => {
  const maxTrim = 600;
  const { title, text_content, siteName } = payload;
  let trimmedBody = text_content
    .trim()
    .slice(0, maxTrim / 2)
    .trim();

  if (text_content.length > maxTrim / 2) {
    trimmedBody += `\n\n... ${((text_content.length - maxTrim) / 1000).toFixed(
      2
    )}kb trimmed ...\n\n`;
    trimmedBody += text_content
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

const NON_LATIN_CHARS = /[^\u0000-\u007F]/g;

export const segment = (text: string) => {
  if (typeof Intl.Segmenter === "undefined" || !NON_LATIN_CHARS.test(text)) {
    return text;
  }

  const segmenter = new Intl.Segmenter(undefined, {
    granularity: "word",
  });

  const segments = segmenter.segment(text);
  return Array.from(segments)
    .map((segment) => segment.segment)
    .filter((segment) => segment.trim() !== "")
    .join(" ");
};

/**
 * Break down a large text document into smaller fragments, considering markdown
 * structure.
 */
export const getArticleFragments = (textContent: string): string[] => {
  const minFragmentLength = 100;
  const lines = textContent.trim().split("\n");
  const fragments: string[] = [];
  let currentFragment = "";

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      if (currentFragment.length >= minFragmentLength) {
        fragments.push(currentFragment.trim());
        currentFragment = "";
      }
      continue;
    }

    if (trimmedLine.startsWith("#")) {
      if (currentFragment) {
        fragments.push(currentFragment.trim());
      }
      currentFragment = trimmedLine;
    } else {
      currentFragment += (currentFragment ? " " : "") + trimmedLine;
    }

    if (currentFragment.length >= minFragmentLength * 2) {
      fragments.push(currentFragment.trim());
      currentFragment = "";
    }
  }

  if (currentFragment) {
    fragments.push(currentFragment.trim());
  }

  return fragments.filter((fragment) => fragment.length > 0).map(segment);
};

export const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  let timeout: Timer;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};
