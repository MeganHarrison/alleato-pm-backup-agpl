"use client";

import dynamic from "next/dynamic";

// Client boundary that lazy-loads the calendar (and its heavy `@fullcalendar/*`
// dependency graph) so it is not pulled into the /calendar route's First Load
// JS until it renders. ssr:false because FullCalendar is browser-only. Kept in
// its own client module so the /calendar page can stay a server component.
const CalendarDynamic = dynamic(() => import("./components-apps-calendar"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/40 border-t-foreground" />
    </div>
  ),
});

export default CalendarDynamic;
