
/**
 * @roxi/routify 2.18.17
 * File generated Sun Aug 18 2024 20:45:14 GMT+0800 (Taipei Standard Time)
 */

export const __version = "2.18.17"
export const __timestamp = "2024-08-18T12:45:14.085Z"

//buildRoutes
import { buildClientTree } from "@roxi/routify/runtime/buildRoutes.js"

//imports


//options
export const options = {}

//tree
export const _tree = {
  "name": "root",
  "filepath": "/",
  "root": true,
  "ownMeta": {},
  "absolutePath": "src/ui/pages",
  "children": [
    {
      "isFile": true,
      "isDir": false,
      "file": "index.svelte",
      "filepath": "/index.svelte",
      "name": "index",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/ian/dev/full-text-tabs-forever/src/ui/pages/index.svelte",
      "importPath": "../pages/index.svelte",
      "isLayout": false,
      "isReset": false,
      "isIndex": true,
      "isFallback": false,
      "isPage": true,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/index",
      "id": "_index",
      "component": () => import('../pages/index.svelte').then(m => m.default)
    },
    {
      "isFile": true,
      "isDir": true,
      "file": "_layout.svelte",
      "filepath": "/index.html/_layout.svelte",
      "name": "_layout",
      "ext": "svelte",
      "badExt": false,
      "absolutePath": "/Users/ian/dev/full-text-tabs-forever/src/ui/pages/index.html/_layout.svelte",
      "children": [
        {
          "isFile": true,
          "isDir": false,
          "file": "database-repl.svelte",
          "filepath": "/index.html/database-repl.svelte",
          "name": "database-repl",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/ian/dev/full-text-tabs-forever/src/ui/pages/index.html/database-repl.svelte",
          "importPath": "../pages/index.html/database-repl.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": false,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/index.html/database-repl",
          "id": "_index_html_databaseRepl",
          "component": () => import('../pages/index.html/database-repl.svelte').then(m => m.default)
        },
        {
          "isFile": true,
          "isDir": false,
          "file": "index.svelte",
          "filepath": "/index.html/index.svelte",
          "name": "index",
          "ext": "svelte",
          "badExt": false,
          "absolutePath": "/Users/ian/dev/full-text-tabs-forever/src/ui/pages/index.html/index.svelte",
          "importPath": "../pages/index.html/index.svelte",
          "isLayout": false,
          "isReset": false,
          "isIndex": true,
          "isFallback": false,
          "isPage": true,
          "ownMeta": {},
          "meta": {
            "recursive": true,
            "preload": false,
            "prerender": true
          },
          "path": "/index.html/index",
          "id": "_index_html_index",
          "component": () => import('../pages/index.html/index.svelte').then(m => m.default)
        }
      ],
      "isLayout": true,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "importPath": "../pages/index.html/_layout.svelte",
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/index.html",
      "id": "_index_html__layout",
      "component": () => import('../pages/index.html/_layout.svelte').then(m => m.default)
    }
  ],
  "isLayout": false,
  "isReset": false,
  "isIndex": false,
  "isFallback": false,
  "meta": {
    "recursive": true,
    "preload": false,
    "prerender": true
  },
  "path": "/"
}


export const {tree, routes} = buildClientTree(_tree)

