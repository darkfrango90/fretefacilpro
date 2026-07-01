// Client-only entry point used by offline.html (PWA standalone fallback).
//
// The main SSR-hydration entry (TanStack Start's client-entry) expects a
// server-rendered DOM + injected dehydrated router state. The offline shell
// has neither, so trying to hydrate from it throws "Invariant failed".
//
// This entry creates a fresh router on the client and mounts it via
// RouterProvider into #app, exactly like a classic CSR React app. No SSR
// state required; the TanStack Router renders the matched route and the
// app reads from Dexie when offline.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";


const router = getRouter();
const container = document.getElementById("app");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
