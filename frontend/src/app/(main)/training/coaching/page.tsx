export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import type {
  CoachingSession,
  CoachingStatus,
} from "@/features/training/coaching-session";
import { CapabilityLadder } from "@/features/training/CapabilityLadder";
import { createCoachingDataAccess } from "@/features/training/coaching-session-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import styles from "../training-theme.module.css";

const STATUS_LABEL: Record<CoachingStatus, string> = {
  draft: "Draft",
  awaiting_employee: "Awaiting confirmation",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_CLASS: Record<CoachingStatus, string> = {
  draft: styles.coachStatusDraft,
  awaiting_employee: styles.coachStatusAwaiting,
  active: styles.coachStatusActive,
  completed: styles.coachStatusActive,
  archived: styles.coachStatusDraft,
};

const CYCLE_LABEL: Record<string, string> = {
  new: "New cycle",
  "30-day": "30-day check-in",
  "60-day": "60-day check-in",
  "90-day": "90-day check-in",
};

function SessionCard({ session }: { session: CoachingSession }) {
  return (
    <Link className={styles.coachCard} href={`/training/coaching/${session.id}`}>
      <div>
        <div className={styles.coachCardName}>
          {CYCLE_LABEL[session.cycle] ?? "Coaching session"}
        </div>
        <div className={styles.coachCardSub}>
          {session.focusSkillIds.length > 0
            ? `${session.focusSkillIds.length} focus skill${session.focusSkillIds.length === 1 ? "" : "s"}`
            : "No focus skills selected yet"}
        </div>
      </div>
      <div className={styles.coachCardMeta}>
        <span className={`${styles.coachStatus} ${STATUS_CLASS[session.status]}`}>
          {STATUS_LABEL[session.status]}
        </span>
        {session.review30Date && (
          <div style={{ marginTop: 6 }}>Next review {session.review30Date}</div>
        )}
      </div>
    </Link>
  );
}

export default async function ManagerCoachingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const dal = createCoachingDataAccess(await createClient(), user.id);
  const [managing, coached] = await Promise.all([
    dal.listForManager(),
    dal.listForEmployee(),
  ]);
  const draft = managing.find((session) => session.status === "draft");

  return (
    <section className={styles.wrap} id="coaching">
      <div className={styles.secKick}>Training · Manager Coaching</div>
      <h1 className={styles.secH}>Manager Coaching</h1>
      <p className={styles.lead}>
        Prepare for and conduct a focused development conversation. Pull the
        report&rsquo;s latest Skill Wheel, calibrate the scores against evidence,
        agree two to four focus skills, and leave with precise 30/60/90-day reps.
      </p>

      <div className={styles.coachActions}>
        <Link
          className={`${styles.coachAction} ${styles.coachActionPrimary}`}
          href="/training/coaching/new"
        >
          Start coaching session
          <span className={styles.coachActionArrow}>&rarr;</span>
        </Link>
        {draft && (
          <Link
            className={styles.coachAction}
            href={`/training/coaching/${draft.id}`}
          >
            Continue draft
            <span className={styles.coachActionArrow}>&rarr;</span>
          </Link>
        )}
        <Link
          className={styles.coachAction}
          href="/training/guides/manager-coaching-guide"
        >
          Open coaching playbook
          <span className={styles.coachActionArrow}>&rarr;</span>
        </Link>
      </div>

      <div className={`${styles.secKick} ${styles.coachSection}`} id="your-sessions">
        Sessions you&rsquo;re running
      </div>
      {managing.length > 0 ? (
        <div className={styles.coachList}>
          {managing.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <p className={styles.coachNote}>
          No coaching sessions yet. Start one for a direct report to pull their
          Skill Wheel and build a plan.
        </p>
      )}

      {coached.length > 0 && (
        <>
          <div className={`${styles.secKick} ${styles.coachSection}`}>
            Coaching for you
          </div>
          <div className={styles.coachList}>
            {coached.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </>
      )}

      <div className={`${styles.secKick} ${styles.coachSection}`}>
        The capability scale
      </div>
      <p className={styles.coachNote}>
        Every score maps to a named level of independence. Calibrate against the
        evidence for each — a lower, accurate level is more useful than a higher
        one you can&rsquo;t support.
      </p>
      {/* No current/target here: on the launch screen this is the shared
          reference scale, not any one person's position. The markers appear in
          the session workspace, where a real score exists. */}
      <CapabilityLadder />
    </section>
  );
}
