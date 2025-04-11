/**
 * Formats a payload for debugging purposes, truncating large text content.
 */
export const formatDebuggablePayload = (payload: { [key: string]: any }) => {
  const maxTrim = 600;
  const { title, text_content, siteName } = payload;
  let trimmedBody = (text_content || "")
    .trim()
    .slice(0, maxTrim / 2)
    .trim();

  if (text_content?.length > maxTrim / 2) {
    trimmedBody += `\n\n... ${(((text_content?.length || 0) - maxTrim) / 1000).toFixed(
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

export const toLabel = (name: string) => {
  return name
    .replace(/-/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
};

/**
 * Gets the Google favicon URL for a given webpage URL
 */
export const getFaviconByUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}`;
  } catch (e) {
    console.error('Could not parse URL for favicon:', url, e);
    return '';
  }
};

/**
 * Cleans a URL by removing the protocol (http://, https://),
 * the www prefix, and any trailing slashes
 */
export const cleanUrl = (url: string): string => {
  return url.replace(/^(https?:\/\/(?:www\.)?)/, "").replace(/\/$/, "");
};

/**
 * Formats a timestamp into a relative time string (just now, Xm ago, Xh ago)
 */
export const getRelativeTime = (timestamp: number | undefined) => {
  if (!timestamp) return "";

  const now = new Date();
  const visitTime = new Date(timestamp);

  // Check if the visit was on the same day (in local time)
  const isToday =
    visitTime.getFullYear() === now.getFullYear() &&
    visitTime.getMonth() === now.getMonth() &&
    visitTime.getDate() === now.getDate();

  // If not today, return the time directly
  if (!isToday) {
    return visitTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // For today, use relative time
  const diffMs = now.getTime() - visitTime.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else {
    return `${diffHours}h ago`;
  }
};

/**
 * Formats a timestamp into a full local date-time string
 */
export const getFullLocalTime = (timestamp: number | undefined) => {
  if (!timestamp) return "";
  const visitTime = new Date(timestamp);
  return visitTime.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * Groups items by their visit date
 */
export const groupItemsByVisitDate = <T extends { last_visit?: number }>(items: T[]) => {
  // Group items by local date derived from last_visit timestamp
  return items.reduce(
    (acc, item) => {
      // Convert timestamp to local date string
      let date = "Unknown";

      if (item.last_visit) {
        const visitDate = new Date(item.last_visit);
        const today = new Date();

        if (
          visitDate.getFullYear() === today.getFullYear() &&
          visitDate.getMonth() === today.getMonth() &&
          visitDate.getDate() === today.getDate()
        ) {
          date = "Today";
        } else {
          date = visitDate.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
      }

      if (!acc[date]) {
        acc[date] = [];
      }

      acc[date].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
};
