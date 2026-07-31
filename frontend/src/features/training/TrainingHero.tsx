import Link from "next/link";
import styles from "@/app/(main)/training/training-theme.module.css";

export function TrainingHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroKick}>ALLEATO TRAINING LIBRARY</div>
      <h1 className={styles.heroH1}>OWN YOUR GROWTH</h1>
      <p className={styles.heroP}>
        A learning system built to last — master your craft one precise rep
        at a time. Read it, listen to it, quiz yourself, and chat with it.
        Your growth, your pace, your ownership.
      </p>
      <div className={styles.heroCta}>
        <Link href="/training/growth" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`}>
          Take the Assessment →
        </Link>
      </div>
      <div className={styles.heroTag}>Your partner from the ground up.</div>
    </header>
  );
}
