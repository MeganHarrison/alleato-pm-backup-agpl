import type { ReactNode } from "react";
import styles from "./guide-viewer.module.css";
import type { TrainingGuide } from "./types";

interface GuideViewerProps {
  guide: TrainingGuide;
  /** Pre-rendered guide body supplied by the canonical guide route. */
  content: ReactNode;
  showHeader?: boolean;
}

export function GuideViewer({
  guide,
  content,
  showHeader = true,
}: GuideViewerProps) {
  return (
    <article className={styles.reader} data-testid="training-guide-reader">
      {showHeader ? (
        <header className={styles.header}>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
        </header>
      ) : null}
      <div className={styles.content} data-testid="training-guide-content">
        {content}
      </div>
    </article>
  );
}
