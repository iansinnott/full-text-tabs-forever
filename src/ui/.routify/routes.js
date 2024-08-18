
/**
 * @roxi/routify 2.18.17
 * File generated Sun Aug 18 2024 14:03:02 GMT+0800 (Taipei Standard Time)
 */

export const __version = "2.18.17"
export const __timestamp = "2024-08-18T06:03:02.110Z"

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
      "isFile": false,
      "isDir": true,
      "file": "index.html",
      "filepath": "/index.html",
      "name": "index.html",
      "ext": "",
      "badExt": false,
      "absolutePath": "/Users/ian/dev/full-text-tabs-forever/src/ui/pages/index.html",
      "children": [
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
      "isLayout": false,
      "isReset": false,
      "isIndex": false,
      "isFallback": false,
      "isPage": false,
      "ownMeta": {},
      "meta": {
        "recursive": true,
        "preload": false,
        "prerender": true
      },
      "path": "/index.html"
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

