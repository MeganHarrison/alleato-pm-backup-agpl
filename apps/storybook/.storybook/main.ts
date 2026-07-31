import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { StorybookConfig } from "@storybook/react-vite";

const here = dirname(fileURLToPath(import.meta.url));
// The design system lives in the main app for now (Phase 1). We alias into it
// instead of moving files, so this Storybook is a standalone app with its own
// dependency tree while the 1,100+ app import sites stay untouched.
const frontendSrc = resolve(here, "../../../frontend/src");
const frontendRoot = resolve(here, "../../../frontend");

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(base) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(base, {
      plugins: [react(), tailwindcss()],
      // Some app-layer modules (e.g. lib/utils.ts) read process.env at module
      // top-level. Vite has no Node process in the browser, so shim it. When the
      // design system becomes its own package (Phase 2), cn() moves out of that
      // app-coupled file and this shim goes away.
      define: {
        "process.env": JSON.stringify({ NODE_ENV: "development" }),
      },
      resolve: {
        alias: {
          // Design-system source of truth (Phase 1: aliased, not yet extracted).
          "@": frontendSrc,
          // Force a single React copy — the aliased component files would
          // otherwise resolve React from frontend/node_modules and duplicate it.
          react: resolve(frontendRoot, "node_modules/react"),
          "react-dom": resolve(frontendRoot, "node_modules/react-dom"),
        },
        dedupe: ["react", "react-dom"],
      },
    });
  },
};

export default config;
