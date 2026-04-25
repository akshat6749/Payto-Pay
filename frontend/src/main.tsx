import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import "./index.css";

// ─── TanStack Query ───────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60 s stale time: avoids over-fetching on a financial dashboard where
      // the same data is likely revisited within a single session.
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

// ─── TanStack Router ──────────────────────────────────────────────────────────
const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: "intent",
});

// TypeScript module declaration — gives every route typed access to the router
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ─── Mount ────────────────────────────────────────────────────────────────────
const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
