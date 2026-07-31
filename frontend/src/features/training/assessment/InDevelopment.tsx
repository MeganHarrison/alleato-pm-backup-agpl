import styles from "./assessment.module.css";

export interface InDevelopmentProps {
  /** What this step will do once it is built. */
  what: string;
  /** Where the equivalent capability lives today, if anywhere. */
  today?: string;
}

/**
 * Placeholder shown where an assessment step exists in the flow but has not
 * been built yet. It is deliberately loud: an unfinished step must never read
 * as a finished one during a walkthrough.
 */
export function InDevelopment({ what, today }: InDevelopmentProps) {
  return (
    <div className={styles.wip} role="status">
      <span className={styles.wipKicker}>Development in progress</span>
      <h3>This step is not built yet.</h3>
      <p>{what}</p>
      {today ? (
        <p style={{ marginTop: 10 }}>
          <b>Available today:</b> {today}
        </p>
      ) : null}
    </div>
  );
}
