import styles from "@/app/(main)/training/training-theme.module.css";
import {
  METHOD_INTRO,
  METHOD_PRINCIPLES,
  METHOD_STEPS,
  PROFICIENCY_INTRO,
  PROFICIENCY_ITEMS,
  RUBRIC_INTRO,
  RUBRIC_ROWS,
  TOOLKIT_ITEMS,
} from "./method-content";

export function MethodContent() {
  return (
    <>
      <p className={styles.lead}>{METHOD_INTRO}</p>
      <div className={styles.principles}>
        {METHOD_PRINCIPLES.map((principle) => (
          <div key={principle.name} className={styles.principle}>
            <h4>{principle.name}</h4>
            <p>{principle.text}</p>
          </div>
        ))}
      </div>
      <ol className={styles.steps}>
        {METHOD_STEPS.map((step) => (
          <li key={step.n}>
            <span className={styles.stepn}>{step.n}</span>
            <div>
              <b>{step.name}</b>
              <span>{step.text}</span>
            </div>
          </li>
        ))}
      </ol>

      <section className={styles.wrapAlt} style={{ marginTop: 40 }}>
        <div className={styles.wrap}>
          <div className={styles.secKick}>Score honestly</div>
          <h2 className={styles.secH}>What each score really means</h2>
          <p className={styles.lead}>{RUBRIC_INTRO}</p>
          <div className={styles.rubric}>
            {RUBRIC_ROWS.map((row) => (
              <div key={row.label} className={styles.rubrow}>
                <span className={styles.band}>{row.band}</span>
                <span className={styles.rubtext}>
                  <b>{row.label}</b>
                  {row.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ marginTop: 40 }}>
        <div className={styles.secKick}>Sharpen your habits</div>
        <h2 className={styles.secH}>Quick toolkit</h2>
        <div className={styles.grid}>
          {TOOLKIT_ITEMS.map((item) => (
            <div key={item.name} className={`${styles.card} ${styles.cardTool}`}>
              <h3>{item.name}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        <div className={styles.prof}>
          <div className={styles.secKick}>Proficiency before promotion</div>
          <h3 className={styles.hd}>What &ldquo;ready&rdquo; looks like</h3>
          <p className={styles.lead}>{PROFICIENCY_INTRO}</p>
          <ul className={styles.checklist}>
            {PROFICIENCY_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
