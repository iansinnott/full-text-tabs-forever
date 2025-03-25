<!-- display a screenshot -->
<div align="center">

<img src="src/assets/icon-1.png" alt="full text tabs forever (FTTF) logo" width=128><br>

# Full Text Tabs Forever

Search everything you read online. FTTF lets you search the full text of every web page you visit.

Available in the [Chrome Web Store](https://chrome.google.com/webstore/detail/full-text-tabs-forever/gfmbnlbnapjmffgcnbopfgmflmlfghel).

Available in the [Firefox Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/full-text-tabs-forever/).

> **IMPORTANT FOR v2.0 USERS:** If you're upgrading from v1.x, see the [Database Migration](#database-migration-v20) section for instructions on migrating your existing data.

_Firefox requires additional permissions. See [below](#firefox)._

</div>

**Doesn't the browser do that already? How is this different?**

Browsers do not let you search the text on pages you've visited, only the URLs and titles, and some delete your history after a number of months.

FTTF is different:

- **Full-Text Search Capabilities:** The full content of every page you've visited becomes searchable.
- **Permanent History:** Your digital footprints are yours to keep. Your data is yours, so it should not be removed without your approval. Nothing is deleted automatically.
- **Instant indexing:** FTTF creates a search index as you browse, so pages are immediately available for searching right after you land on a page.
- **For your eyes only:** Your browsing history is stored locally on your device, and not on any external servers. Beware that if you switch computers your FTTF history will not automatically come with you. It can be exported though.

<div align="center">

![](static/screenshot-1.png)

</div>

**Who is it for?**

Data hoarders like myself that never want to delete anything, and want everything to be searchable. More generally, if you've ever felt limited by the standard history search you should try this out.

**How it works:**

Browser extensions have access to the pages you visit, which lets FTTF make an index of the content on any page. When a page loads, its content is extracted and indexed.

Extracted? Yes, or "distilled" if you prefer. Full web pages are huge and have a lot of information that's not related to the content itself. FTTF will ignore all of that. It acts like "reader mode" to find relevant content on a page and only index that.

# Installation

Install in your browser via the [Chrome Web Store](https://chrome.google.com/webstore/detail/full-text-tabs-forever/gfmbnlbnapjmffgcnbopfgmflmlfghel) or the [Firefox Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/full-text-tabs-forever/).

# Testing

This project uses `bun` as a unit testing framework, but not (currently) as a bundler. You will need to install `bun`, then:

`bun test`

Or, `bun run test` if you prefer.

# Note to self: Submitting a new version manually

> How could this be automated?

- Manually bump the version in the manifest file
- Run the build
  - `bun run build:chrome`
  - `bun run build:firefox`
- Submit
  - Chrome
    - Go to: https://chrome.google.com/webstore/devconsole/bc898ad5-018e-4774-b9ab-c4bef7b7f92b/gfmbnlbnapjmffgcnbopfgmflmlfghel/edit/package
    - Upload the `fttf-chrome.zip` file
  - Firefox
    - Go to: https://addons.mozilla.org/en-US/developers/addon/full-text-tabs-forever/edit
    - Upload the `fttf-firefox.zip` file
    - Zip the original source code and upload that too: `zip -r src.zip src`

# Firefox

Install here: https://addons.mozilla.org/en-US/firefox/addon/full-text-tabs-forever/

Currently you have to manually enable additional permissions in Firefox like so:

![Firefox permissions](https://drive.zenture.cloud/s/d3mboA7GwPCXH8b/download).

See this comment for more details: https://github.com/iansinnott/full-text-tabs-forever/issues/3#issuecomment-1963238416

Support was added in: https://github.com/iansinnott/full-text-tabs-forever/pull/4.

# Database Migration (v2.0)

With version 2.0, Full Text Tabs Forever has migrated from SQLite (VLCN) to PostgreSQL (PgLite) as its database backend. This change brings several improvements:

- Better full-text search capabilities with PostgreSQL's advanced text search
- Support for vector embeddings for semantic search (coming soon)
- Improved performance for large databases
- More efficient storage of document fragments

## For Existing Users

If you're upgrading from a previous version (v1.x), your data will not be lost! The extension includes a migration system that will:

1. Detect your existing VLCN (SQLite) database
2. Provide a simple one-click migration option in the Settings page
3. Transfer all your saved pages to the new PostgreSQL database
4. Show real-time progress during migration
5. Preserve all your searchable content

To migrate your data:

1. After upgrading, open the extension
2. Go to the Settings page
3. Find the "Import VLCN Database (v1)" section
4. Click the "Import VLCN Database" button
5. Wait for the migration to complete - this may take several minutes depending on how many pages you've saved
6. Your data is now accessible in the new database system!

The migration happens entirely on your device, and no data is sent to external servers. Your privacy remains protected throughout the process.

# TODO

- [ ] Backfill history
      Currently only new pages you visit are indexed, but we could backfill by opening every page in the browser's history that hasn't yet been indexed. An optional feature, but a useful one.
- [ ] Backup and sync
      Improved export/import capabilities for moving data between devices.
- [ ] Semantic search
      Leverage vector embeddings in the new PostgreSQL backend for more intelligent searching.
- [ ] Integrate with [browser-gopher](https://github.com/iansinnott/browser-gopher)
      Browser gopher and [BrowserParrot](https://www.browserparrot.com/) were the initial impetus to create a better way to ingest full text web pages, without triggering a Cloudflare captcha party on your home connection.
- [x] Migrate to PostgreSQL
      Replace SQLite with a more powerful database backend using PgLite.
- [x] Improve discoverability of functionality.
      There is now a button to open the command palette. Still not much GUI, but enough to be discovered.
- [x] Firefox
      ~~This should not be too difficult since this project was started with web extension polyfills. However, there is currently some chrome specific code.~~
      It appears that the APIs do not have to be rewritten to work in Firefox. See this PR for details: https://github.com/iansinnott/full-text-tabs-forever/pull/4

# Contributing

PRs welcome!
