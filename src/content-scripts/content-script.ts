import { greetings } from "../common/const";
import { log } from "../common/logs";
import { Readability } from "@mozilla/readability";

const detectDate = () => {
  let date: string | null = null;
  try {
    const el = document.querySelector<HTMLMetaElement>(
      'meta[property="article:published_time"],meta[property="og:pubdate"],meta[property="og:publish_date"],meta[name="citation_online_date"],meta[name="dc.Date"]',
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
    console.warn("could not detect date", err);
  }

  return date;
};

const main = async () => {
  log("Ping...");

  const res = await chrome.runtime.sendMessage([
    "getPageStatus",
    {
      url: window.location.href,
    },
  ]);

  log("...Pong", res);

  // @todo Check if we actually need to index the page before continuing. What
  // comes next is likely expensive to run on every page load all the time. May
  // also consider moving it to web worker.
  if (!res) {
    log("Skipping due to server response", res);
    return;
  }

  // parse() will mutate the dom, so we need to clone in order not to spoil the normal reading of the site
  const domClone = document.cloneNode(true) as Document;
  const article = new Readability(domClone).parse();

  if (!article) {
    log("No article found");
    return;
  }

  const date = detectDate();
  const { content, textContent, ...rest } = article;

  console.log("article:", textContent, {
    ...rest,
    date,
  });

  // @todo This is just a standin
  await chrome.runtime.sendMessage(["indexPage", { ...rest, date }]);
};

// Plumbing
(async () => {
  // check if dom content has already been loaded
  if (document.readyState !== "complete") {
    console.log("%cwait for ready", "color:yellow;font-size:12px;", document.readyState);

    // @note This can take _a while_, but is in place to account for apps that
    // may not have built the dom yet
    await new Promise((resolve) => {
      document.onreadystatechange = () => {
        if (document.readyState === "complete") {
          resolve(null);
        }
      };
    });
    console.log("%cready.", "color:green;font-size:12px;", document.readyState);
  }

  await main();
})();
