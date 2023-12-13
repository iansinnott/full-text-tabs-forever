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

# Contributing

PRs welcome!
