import browser from "webextension-polyfill";
import { Readability } from "@mozilla/readability";
import type { RpcMessage } from "../background/backend";

const rpc = async (message: RpcMessage) => {
  return browser.runtime.sendMessage(message);
};

const log = (...args: any[]) => {
  console.debug(...args);
};

const detectDate = () => {
  let date: string | null = null;
  try {
    const el = document.querySelector<HTMLMetaElement>(
      'meta[property="article:published_time"],meta[property="og:pubdate"],meta[property="og:publish_date"],meta[name="citation_online_date"],meta[name="dc.Date"]'
    );
    if (el) {
      date = new Date(el.content).toISOString();
    } else {
      const el = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
      if (el) {
        const j = JSON.parse(el.textContent || "{}");
        if (j && j.datePublished) {
          date = new Date(j.datePublished).toISOString();
        }
      }
    }
  } catch (err) {
    log("could not detect date", err);
  }

  return date;
};

// Function to extract YouTube transcript if available
const extractYouTubeTranscript = async (): Promise<string | null> => {
  // Only run on YouTube watch pages
  if (!location.hostname.includes("youtube.com") || !location.pathname.startsWith("/watch")) {
    return null;
  }

  try {
    // Access YouTube's global variable for captions
    const playerResponse = (window as any).ytInitialPlayerResponse;

    if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
      log("fttf :: no captions available");
      return null;
    }

    const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

    // Try to find English captions first
    const chosenTrack =
      captionTracks.find((track: any) => track.languageCode === "en") || captionTracks[0];

    if (!chosenTrack?.baseUrl) {
      return null;
    }

    // Fetch the caption data
    const response = await fetch(chosenTrack.baseUrl);
    const captionData = await response.text();

    // Parse the TTML data
    const textLines: string[] = [];

    // Try DOMParser first
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(captionData, "application/xml");

      // Check for parser errors
      const parserErrors = xmlDoc.getElementsByTagName("parsererror");
      if (parserErrors.length > 0) {
        throw new Error("DOMParser parsererror encountered");
      }

      // Extract text content
      const textNodes = xmlDoc.getElementsByTagName("text");
      for (let i = 0; i < textNodes.length; i++) {
        const textContent = textNodes[i].textContent?.trim();
        if (textContent) {
          textLines.push(textContent);
        }
      }
    } catch (err) {
      // Fallback to regex parsing if DOMParser fails
      log("fttf :: falling back to regex parsing for transcript");
      const textTagRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
      let match;
      while ((match = textTagRegex.exec(captionData)) !== null) {
        const raw = match[1].trim();
        if (raw) {
          textLines.push(raw);
        }
      }
    }

    if (textLines.length === 0) {
      return null;
    }

    return textLines.join("\n");
  } catch (err) {
    log("fttf :: error extracting transcript", err);
    return null;
  }
};

const main = async () => {
  const res = await rpc(["getPageStatus"]);

  // @todo Check if we actually need to index the page before continuing. What
  // comes next is likely expensive to run on every page load all the time. May
  // also consider moving it to web worker.
  if (!res?.shouldIndex) {
    const debugUrls = localStorage.getItem("@fttf/debugUrls")?.split(",") || [];
    if (!debugUrls.includes(location.hostname)) {
      log("fttf :: skip :: due to server response", res);
      return;
    }
  }

  if (res?.indexLevel === "url_only") {
    const date = detectDate();
    const result = await rpc([
      "indexPage",
      {
        title: document.title,
        date,
      },
    ]);

    log("fttf :: result", result);
    return;
  }

  // Wait for the dom to be ready. Yeah, crude. What's the best move here?
  await new Promise((resolve) => {
    // Wait for dom to stop changing for at least 1 second
    let len = document.body?.innerText?.length || 0;
    let timeout: Timer;
    let timeout2: Timer;

    const fn = () => {
      const newLen = document.body?.innerText?.length || 0;
      if (newLen === len) {
        clearTimeout(timeout2);
        resolve(null);
      } else {
        log("fttf :: wait :: still waiting for dom to stop changing");
        len = newLen;
        timeout = setTimeout(fn, 1000);
      }
    };

    // kick it off
    timeout = setTimeout(fn, 1000);

    // Resolve regardless if too much time ellapses
    timeout2 = setTimeout(() => {
      clearTimeout(timeout);
      resolve(null);
    }, 10000);
  });

  // Wait for an idle moment so that we don't cause any dropped frames (hopefully)
  await new Promise((resolve) => requestIdleCallback(resolve));

  // Extract YouTube transcript if available
  const transcript = await extractYouTubeTranscript();

  // parse() will mutate the dom, so we need to clone in order not to spoil the normal reading of the site
  const domClone = document.cloneNode(true) as Document;
  let startTime: number;
  let endTime: number;

  // time how long the next line takes
  startTime = performance.now();
  const readabilityArticle = new Readability(domClone, {
    // charThreshold: 50,
    // nbTopCandidates: 10,
  }).parse();
  endTime = performance.now();

  if (!readabilityArticle) {
    await rpc(["nothingToIndex"]);
    return;
  }

  const date = detectDate();
  const { content, textContent, ...rest } = readabilityArticle;

  console.debug("fttf :: readabilityArticle", rest);

  // Lazy load the turndown lib
  const TurndownService = (await import("turndown")).default;

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    hr: "---",
  });

  log("fttf :: markdown");
  // @todo Would be nice to not have to turndown for every page. This used to be
  // in the background script but threw for dom reasons. Would need to modify
  // turndown. NOTE: It supports running in node, but the internal env check
  // thinks its in a browser
  const mdContent = turndown.turndown(content);

  // If we have a transcript, append it to the markdown content
  const finalMdContent = transcript ? `${mdContent}\n\n## Transcript\n\n${transcript}` : mdContent;

  log("article:", textContent, {
    ...rest,
    date,
  });

  const result = await rpc([
    "indexPage",
    {
      ...rest,
      _extraction_time: endTime - startTime,
      extractor: "readability",
      text_content: textContent,
      md_content: finalMdContent,
      date,
    },
  ]);

  log("fttf :: result", result);
};

const mainWrapper = async () => {
  // check if dom content has already been loaded
  if (document.readyState !== "complete") {
    // @note This can take _a while_, but is in place to account for apps that
    // may not have built the dom yet
    await new Promise((resolve) => {
      document.onreadystatechange = () => {
        if (document.readyState === "complete") {
          resolve(null);
        }
      };
    });

    log("%cready.", "color:green;font-size:12px;", document.readyState);
  }

  await main();
};

// Plumbing
(async () => {
  // listen for browser push state updates and hash changes
  window.addEventListener("popstate", () => {
    log("%cpopstate", "color:orange;font-size:18px;", location.toString());
    mainWrapper();
  });

  await mainWrapper();
})();
