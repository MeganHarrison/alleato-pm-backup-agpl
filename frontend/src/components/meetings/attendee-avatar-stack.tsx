"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePeople } from "@/hooks/use-people";
import { cn } from "@/lib/utils";

interface AttendeeAvatarStackProps {
  participants: string[];
  maxVisible?: number;
}

function formatParticipantName(email: string): string {
  const localPart = email.split("@")[0];
  if (!localPart) return email;
  const parts = localPart.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    const firstName =
      parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const lastName =
      parts[parts.length - 1].charAt(0).toUpperCase() +
      parts[parts.length - 1].slice(1).toLowerCase();
    return `${firstName} ${lastName}`;
  }
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
}

function getEmailInitials(email: string): string {
  const localPart = email.split("@")[0];
  if (!localPart) return "?";
  const parts = localPart.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return localPart.slice(0, 2).toUpperCase();
}

export function AttendeeAvatarStack({
  participants,
  maxVisible = 6,
}: AttendeeAvatarStackProps) {
  const { people } = usePeople();
  const [expanded, setExpanded] = useState(false);
  const emailToContactId = Object.fromEntries(
    people.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p.id])
  );

  const visibleParticipants = participants.slice(0, maxVisible);
  const hiddenParticipants = participants.slice(maxVisible);

  return (
    <TooltipProvider>
      <div className="group/attendees space-y-3">
        {/* The whole avatar row is a tap target so touch devices can expand
            the full attendee list (hover-only reveal never fires on touch). */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide attendee list" : "Show all attendees"}
          className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
        <AvatarGroup className="justify-start">
          {visibleParticipants.map((participant) => (
            <Tooltip key={participant}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-default transition-transform group-hover/attendees:translate-x-0 hover:z-10">
                  <AvatarFallback className="text-[11px] font-semibold">
                    {getEmailInitials(participant)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">{formatParticipantName(participant)}</p>
                  <p className="text-[11px] text-background/80">{participant}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          {hiddenParticipants.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <AvatarGroupCount className="h-8 w-8 text-[11px] font-semibold">
                  +{hiddenParticipants.length}
                </AvatarGroupCount>
              </TooltipTrigger>
              <TooltipContent side="top" className="px-3 py-2">
                <p className="text-xs font-medium">
                  +{hiddenParticipants.length} more attendees
                </p>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </AvatarGroup>
        </button>

        <div
          className={cn(
            "overflow-y-hidden transition-all duration-200",
            expanded
              ? "max-h-80 overflow-y-auto opacity-100"
              : "max-h-0 opacity-0 group-hover/attendees:max-h-80 group-hover/attendees:overflow-y-auto group-hover/attendees:opacity-100 group-focus-within/attendees:max-h-80 group-focus-within/attendees:overflow-y-auto group-focus-within/attendees:opacity-100",
          )}
        >
          <ul className="space-y-2 pt-1">
            {participants.map((participant) => {
              const contactId = emailToContactId[participant.toLowerCase()];
              const inner = (
                <>
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {getEmailInitials(participant)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {formatParticipantName(participant)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{participant}</p>
                  </div>
                </>
              );
              return (
                <li key={`details-${participant}`} className="flex items-center gap-2">
                  {contactId ? (
                    <Link
                      href={`/directory/contacts/${contactId}`}
                      className="flex items-center gap-2 min-w-0 rounded hover:bg-muted/50 transition-colors -mx-1 px-1"
                    >
                      {inner}
                    </Link>
                  ) : inner}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </TooltipProvider>
  );
}
