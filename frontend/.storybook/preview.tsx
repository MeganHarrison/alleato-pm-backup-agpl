import type { Preview } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initialize as initMsw, mswLoader } from "msw-storybook-addon";
import { ThemeProvider } from "next-themes";

import { handlers } from "./msw-handlers";
import { ProjectProvider } from "./mocks/project-context";
import "../src/app/globals.css";

// Polyfill `process` for Storybook/Vite — browser has no process global.
// Supabase and other libs reference process.env at module init time.
if (typeof globalThis.process === "undefined") {
  // @ts-expect-error – intentional browser polyfill
  globalThis.process = { env: { NODE_ENV: "development" } };
}

// Initialize MSW with the default handlers
initMsw({ onUnhandledRequest: "bypass" });

// Shared QueryClient for all stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: false, refetchOnWindowFocus: false },
  },
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "hsl(0 0% 98%)" },
        { name: "dark", value: "hsl(222 47% 11%)" },
      ],
    },

    nextjs: {
      appDirectory: true,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },

    msw: {
      handlers,
    },
  },

  loaders: [mswLoader],

  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <ProjectProvider>
            <div className="bg-background text-foreground min-h-screen p-6">
              <Story />
            </div>
          </ProjectProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
