import { greetings } from "../common/const";
import { log } from "../common/logs";

const main = async () => {
  log("Ping...");

  const res = await chrome.runtime.sendMessage([
    "getPageStatus",
    {
      url: window.location.href,
    },
  ]);

  log("...Pong", res);
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
