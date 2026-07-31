import Image from "next/image";
import Link from "next/link";
import styles from "@/app/(main)/training/training-theme.module.css";
import { TRAINING_NAV_TABS } from "./nav-tabs";

export function TrainingNav() {
  return (
    <nav className={styles.nav}>
      <Link href="/training" aria-label="Alleato Training Library home">
        <Image
          src="/Alleato-Group-Logo_Light.png"
          alt="Alleato Group"
          width={160}
          height={42}
          style={{ height: 42, width: "auto" }}
          priority
        />
      </Link>
      <div className={styles.navLinks}>
        {TRAINING_NAV_TABS.map((tab) => (
          <Link key={tab.href} href={tab.href}>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
