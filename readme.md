Available in the [Chrome Web Store](https://chrome.google.com/webstore/detail/full-text-tabs-forever/gfmbnlbnapjmffgcnbopfgmflmlfghel).

# Testing

This project uses `bun` as a unit testing framework, but not (currently) as a bundler. You will need to install `bun`, then:

`bun test`

Or, `pnpm run test` if you prefer.

# Submitting a new version manually

> How could this be automated?

- Make sure to bump the version in the manifest file
- Run `n build`
- Go to: https://chrome.google.com/webstore/devconsole/bc898ad5-018e-4774-b9ab-c4bef7b7f92b/gfmbnlbnapjmffgcnbopfgmflmlfghel/edit/package
- Upload the `fttf.zip` file

# TODO

- [ ] Firefox
      This should not be too difficult since this project was started with web extension polyfills. However, there is currently some chrome specific code.
- [ ] Backup and sync
      As with all my wasm-sqlite projects I don't want data locked in IndexedDB. VLCN has great sync support so this could be relatively low-hanging fruit.
- [ ] Integrate with [browser-gopher](https://github.com/iansinnott/browser-gopher)
      Browser gopher and [BrowserParrot](https://www.browserparrot.com/) were the initial impetus to create a better way to ingest full text web pages, without triggering a Cloudflare captcha party on your home connection.

# Contributing

PRs welcome!
