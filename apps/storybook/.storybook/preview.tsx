import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

// Load the design system's single source of truth for tokens + Tailwind.
// The relative @config / @import / @source paths inside globals.css resolve
// from its own location, so the app's Tailwind pipeline stays intact.
import "@/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
    }),
    (Story) => (
      <div className="bg-background text-foreground p-6">
        <Story />
      </div>
    ),
  ],
};

export default preview;
