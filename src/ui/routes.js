import { wrap } from "svelte-spa-router/wrap";

// Import layout component
import Layout from "./pages/index.html/_layout.svelte";
import LayoutWrapper from "./LayoutWrapper.svelte";

// Import page components
import Index from "./pages/index.html/index.svelte";
import DatabaseRepl from "./pages/index.html/database-repl.svelte";
import Settings from "./pages/index.html/settings.svelte";
import TaskQueue from "./pages/index.html/task-queue.svelte";
import DocView from "./pages/index.html/doc/[url].svelte";
import Dev from "./pages/index.html/dev.svelte";

// Route definitions with layout wrapper
export const routes = {
  // Home page
  "/": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: Index,
    },
  }),

  // Database REPL page
  "/database-repl": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: DatabaseRepl,
    },
  }),

  // Settings page
  "/settings": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: Settings,
    },
  }),

  // Task Queue page
  "/task-queue": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: TaskQueue,
    },
  }),

  // Document view page with URL parameter
  "/doc/:url": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: DocView,
    },
  }),

  // Development page (for dev use only)
  "/dev": wrap({
    component: LayoutWrapper,
    props: {
      layout: Layout,
      component: Dev,
    },
  }),
};

// Navigation routes for menu display
export const navigationRoutes = [
  { path: "/", name: "index", label: "Search" },
  { path: "/database-repl", name: "database-repl", label: "SQL" },
  { path: "/settings", name: "settings", label: "Settings" },
  { path: "/task-queue", name: "task-queue", label: "Task Queue" },
];
