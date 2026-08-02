const ACCOUNTABILITY_RANGES = [30, 90] as const;

type PersonAccount = {
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  person_type: string;
};

type AccountProfile = {
  id: string;
  is_admin: boolean | null;
};

type UsageSession = {
  user_id: string;
  last_seen_at: string;
  entry_surface: string;
};

export interface AccountabilityAnalytics {
  rangeDays: number;
  accountCounts: {
    employees: number;
    subcontractors: number;
    admins: number;
    unclassified: number;
  };
  activeEmployees: number;
  activeEmployeeDelta: number;
  weeklyActivity: Array<{ weekStart: string; activeEmployees: number }>;
  recentActivity: Array<{
    userId: string;
    fullName: string;
    entrySurface: string;
    lastSeenAt: string;
  }>;
  isComplete: boolean;
}

function normalizePersonType(personType: string): string {
  return personType.trim().toLowerCase();
}

function fullName(person: PersonAccount): string {
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim() || "Unnamed employee";
}

function startOfUtcWeek(value: Date): Date {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function accountabilityRangeFor(request: Request): number {
  const requested = Number(new URL(request.url).searchParams.get("range"));
  return ACCOUNTABILITY_RANGES.includes(requested as (typeof ACCOUNTABILITY_RANGES)[number])
    ? requested
    : 30;
}

export function accountabilityWindowStart(now: Date, rangeDays: number): Date {
  return addDays(now, -(rangeDays * 2));
}

/**
 * Derives the accountability dashboard from persisted account classifications and
 * authenticated application sessions. It deliberately does not infer a role from
 * a company or a legacy `user`/`contact` person type.
 */
export function buildAccountabilityAnalytics({
  people,
  profiles,
  sessions,
  rangeDays,
  now = new Date(),
  isComplete,
}: {
  people: PersonAccount[];
  profiles: AccountProfile[];
  sessions: UsageSession[];
  rangeDays: number;
  now?: Date;
  isComplete: boolean;
}): AccountabilityAnalytics {
  const accountPeople = people.filter((person) => Boolean(person.auth_user_id));
  const employees = accountPeople.filter((person) => normalizePersonType(person.person_type) === "employee");
  const subcontractors = accountPeople.filter((person) => normalizePersonType(person.person_type) === "subcontractor");
  const employeeByAuthUserId = new Map(
    employees.flatMap((person) => person.auth_user_id ? [[person.auth_user_id, person] as const] : []),
  );
  const windowStart = addDays(now, -rangeDays);
  const previousWindowStart = addDays(windowStart, -rangeDays);
  const currentEmployeeSessions = sessions.filter((session) => {
    const lastSeenAt = new Date(session.last_seen_at);
    return employeeByAuthUserId.has(session.user_id) && lastSeenAt >= windowStart && lastSeenAt <= now;
  });
  const previousActiveEmployees = new Set(
    sessions
      .filter((session) => {
        const lastSeenAt = new Date(session.last_seen_at);
        return employeeByAuthUserId.has(session.user_id) && lastSeenAt >= previousWindowStart && lastSeenAt < windowStart;
      })
      .map((session) => session.user_id),
  );
  const activeEmployees = new Set(currentEmployeeSessions.map((session) => session.user_id));
  const currentWeekStart = startOfUtcWeek(windowStart);
  const finalWeekStart = startOfUtcWeek(now);
  const weeklyUserIds = new Map<string, Set<string>>();
  for (let weekStart = currentWeekStart; weekStart <= finalWeekStart; weekStart = addDays(weekStart, 7)) {
    weeklyUserIds.set(weekStart.toISOString(), new Set());
  }
  for (const session of currentEmployeeSessions) {
    const weekStart = startOfUtcWeek(new Date(session.last_seen_at)).toISOString();
    weeklyUserIds.get(weekStart)?.add(session.user_id);
  }
  const latestSessionByEmployee = new Map<string, UsageSession>();
  for (const session of currentEmployeeSessions) {
    if (!latestSessionByEmployee.has(session.user_id)) latestSessionByEmployee.set(session.user_id, session);
  }

  return {
    rangeDays,
    accountCounts: {
      employees: employees.length,
      subcontractors: subcontractors.length,
      admins: profiles.filter((profile) => profile.is_admin).length,
      unclassified: accountPeople.length - employees.length - subcontractors.length,
    },
    activeEmployees: activeEmployees.size,
    activeEmployeeDelta: activeEmployees.size - previousActiveEmployees.size,
    weeklyActivity: [...weeklyUserIds.entries()].map(([weekStart, userIds]) => ({
      weekStart,
      activeEmployees: userIds.size,
    })),
    recentActivity: [...latestSessionByEmployee.values()].slice(0, 3).map((session) => ({
      userId: session.user_id,
      fullName: fullName(employeeByAuthUserId.get(session.user_id)!),
      entrySurface: session.entry_surface,
      lastSeenAt: session.last_seen_at,
    })),
    isComplete,
  };
}
