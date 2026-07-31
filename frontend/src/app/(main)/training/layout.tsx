import { Lato, Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import styles from "./training-theme.module.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-work-sans",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});

export default function TrainingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${workSans.variable} ${lato.variable} ${styles.root}`}>
      {children}
    </div>
  );
}
