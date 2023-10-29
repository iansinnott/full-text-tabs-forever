import browser from "webextension-polyfill";
import { Readability } from "@mozilla/readability";
import { RpcMessage } from "../background/backend";

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

const main = async () => {
  const res = await rpc(["getPageStatus"]);

  // @todo Check if we actually need to index the page before continuing. What
  // comes next is likely expensive to run on every page load all the time. May
  // also consider moving it to web worker.
  if (!res?.shouldIndex) {
    const debugUrls = localStorage.getItem("@fttf/debugUrls")?.split(",") || [];
    if (!debugUrls.includes(location.hostname)) {
      log("Skipping due to server response", res);
      return;
    }
  }

  // Wait for the dom to be ready. Yeah, crude. What's the best move here?
  await new Promise((resolve) => {
    // Wait for dom to stop changing for at least 1 second
    let len = document.body?.innerText?.length || 0;
    let timeout: NodeJS.Timeout;
    let timeout2: NodeJS.Timeout;

    const fn = () => {
      const newLen = document.body?.innerText?.length || 0;
      if (newLen === len) {
        clearTimeout(timeout2);
        resolve(null);
      } else {
        console.debug("Still waiting for dom to stop changing");
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

  log("article:", textContent, {
    ...rest,
    date,
  });

  // @todo This is just a standin
  const result = await rpc([
    "indexPage",
    {
      ...rest,
      _extractionTime: endTime - startTime,
      extractor: "readability",
      htmlContent: content,
      textContent,
      date,
    },
  ]);

  log("result", result);
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
    console.log("%cpopstate", "color:orange;font-size:18px;", location.toString());
    mainWrapper();
  });

  await mainWrapper();

  // Devtools cannot be exposed on window directly
  {
    const query = localStorage.getItem("@fttf/query");
    if (query) {
      console.log(`%cquery('${query}')`, "color:pink;", " -> ", await rpc(["search", { query }]));
    }
  }
})();
