import { JetBrains_Mono } from "next/font/google";

import { OwnYourGrowthLoader } from "./OwnYourGrowthLoader";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "Own Your Growth — Alleato Training Library",
  description:
    "A learning system built to last. Score your skill wheel, browse the training library, and copy AI prompt starters.",
};

export default function OwnYourGrowthPage() {
  return (
    <div className={jetbrainsMono.variable}>
      <OwnYourGrowthLoader />
    </div>
  );
}
