import Link from "next/link";
import styles from "@/app/(main)/training/training-theme.module.css";

import type { TrainingGuide } from "./types";

export function TrainingGuideList({ guides }: { guides: TrainingGuide[] }) {
  return (
    <section aria-label="Written guides">
      <div className={styles.secKick}>Read at your own pace</div>
      <h2 className={styles.secH}>Written guides</h2>
      <div className={styles.grid}>
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/training/guides/${guide.slug}`}
            className={styles.card}
          >
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
