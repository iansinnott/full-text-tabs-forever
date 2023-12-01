// @note This is here to allow importing the lib from cdn if desired. Not sure if it is actually better to import from CDN. Tradeoffs:
// - when visiting pages you've been to before it should be fater with CDN, bc/ page doesn't have to eval all that JS
// - adds a network dependency though, and more tooling complexity (this file is a case in point)
// To use: const { Readability } = await import("https://cdn.jsdelivr.net/npm/@mozilla/readability/+esm");
declare module "https://cdn.jsdelivr.net/npm/@mozilla/readability/+esm" {
  export * from "@mozilla/readability";
}
