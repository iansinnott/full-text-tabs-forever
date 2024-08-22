export const defaultBlacklistRules: Array<[string, "url_only" | "no_index"]> = [
  ["https://%1password.com%", "no_index"],
  ["https://%lastpass.com%", "no_index"],
  ["https://%dashlane.com%", "no_index"],
  ["https://%bitwarden.com%", "no_index"],
  ["https://www.google.com/search%", "url_only"],
  ["https://kagi.com/search%", "url_only"],
  ["https://www.bing.com/search%", "url_only"],
  ["https://search.yahoo.com/search%", "url_only"],
  ["https://www.duckduckgo.com/?q=%", "url_only"],
  ["https://www.ask.com/web?q=%", "url_only"],
  ["https://www.reddit.com/search%", "url_only"],
  ["https://www.baidu.com/s?%", "url_only"],
  ["https://yandex.com/search/?%", "url_only"],
  ["https://www.qwant.com/?q=%", "url_only"],
  ["https://news.ycombinator.com", "url_only"],
  ["https://news.ycombinator.com/news", "url_only"],
  ["https://news.ycombinator.com/new", "url_only"],
  ["https://news.ycombinator.com/best", "url_only"],
  ["https://www.nytimes.com", "url_only"],
  ["https://www.bbc.com", "url_only"],
  ["https://www.cnn.com", "url_only"],
  ["https://www.foxnews.com", "url_only"],
  ["https://www.theguardian.com", "url_only"],
  ["https://www.washingtonpost.com", "url_only"],
  ["https://www.reuters.com", "url_only"],
  ["http://localhost%", "no_index"],
  ["https://localhost%", "no_index"],
  ["https://www.bankofamerica.com%", "url_only"],
  ["https://www.chase.com%", "url_only"],
  ["https://www.wellsfargo.com%", "url_only"],
  ["https://www.citibank.com%", "url_only"],
  ["https://www.capitalone.com%", "url_only"],
  ["https://www.usbank.com%", "url_only"],
  ["https://www.pnc.com%", "url_only"],
  ["https://www.tdbank.com%", "url_only"],
  ["https://app.mercury.com%", "url_only"],
  ["https://www.schwab.com%", "url_only"],
  ["https://www.fidelity.com%", "url_only"],
  ["https://www.vanguard.com%", "url_only"],
  ["https://www.etrade.com%", "url_only"],
  ["https://www.tdameritrade.com%", "url_only"],
  ["https://www.robinhood.com%", "url_only"],
  ["https://www.paypal.com%", "url_only"],
  ["https://www.venmo.com%", "url_only"],
  ["https://www.facebook.com", "url_only"],
  ["https://twitter.com", "url_only"],
  ["https://twitter.com/home", "url_only"],
  ["https://x.com", "url_only"],
  ["https://x.com/home", "url_only"],
  ["https://www.linkedin.com", "url_only"],
  ["https://www.tiktok.com", "url_only"],
  ["https://mail.google.com", "no_index"],
  ["https://outlook.live.com%", "no_index"],
  ["https://docs.google.com%", "url_only"],
  ["https://www.office.com%", "url_only"],
  ["https://slack.com", "url_only"],
  ["https://zoom.us%", "url_only"],
  ["https://www.amazon.com%", "url_only"],
  ["https://www.ebay.com%", "url_only"],
  ["https://www.dropbox.com", "url_only"],
  ["https://drive.google.com%", "url_only"],
  ["https://www.coinbase.com%", "url_only"],
  ["https://www.webmd.com", "url_only"],
  ["https://%.local", "no_index"],
  ["https://%.internal", "no_index"],
];
