import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AskAlleatoPanel } from "./AskAlleatoPanel";
import { AskAlleatoPill } from "./AskAlleatoPill";

const meta: Meta<typeof AskAlleatoPanel> = {
  title: "AI/AskAlleato",
  component: AskAlleatoPanel,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof AskAlleatoPanel>;

export const AskAI: Story = {
  args: {
    open: true,
    activeTab: "ai",
    pagePath: "/760/home",
    onOpenChange: () => undefined,
    onActiveTabChange: () => undefined,
  },
};

export const SendFeedback: Story = {
  args: {
    open: true,
    activeTab: "feedback",
    pagePath: "/760/home",
    onOpenChange: () => undefined,
    onActiveTabChange: () => undefined,
  },
};

export const Pill = {
  render: () => <AskAlleatoPill onClick={() => undefined} />,
};
