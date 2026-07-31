import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  BotMessageSquare,
  Compass,
  GraduationCap,
  Handshake,
  HardHat,
  MonitorCog,
  Route,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HubModuleTileLink {
  label: string;
  href: string;
}

export interface HubModuleTileProps {
  tag: string;
  title: string;
  description: string;
  primaryLink?: HubModuleTileLink;
  secondaryLink?: HubModuleTileLink;
  className?: string;
}

function TileLink({
  link,
  variant,
}: {
  link: HubModuleTileLink;
  variant: "default" | "outline";
}) {
  if (!/^\/training(?:\/|#|$)/.test(link.href)) {
    throw new Error(
      `Training hub destination '${link.href}' must stay inside /training.`,
    );
  }

  return (
    <Button asChild size="sm" variant={variant} className="w-full sm:w-auto">
      <Link href={link.href}>
        {link.label}
        {variant === "default" ? <ArrowUpRight aria-hidden="true" /> : null}
      </Link>
    </Button>
  );
}

function getTileIcon(title: string) {
  if (title.includes("Method")) return Compass;
  if (title.includes("Wheel")) return Route;
  if (title.includes("Managers")) return Handshake;
  if (title.includes("AI") || title.includes("Library")) return BotMessageSquare;
  if (title.includes("PM / PE")) return BookOpenText;
  if (title.includes("Superintendent")) return HardHat;
  if (title.includes("Software")) return MonitorCog;
  return GraduationCap;
}

export function HubModuleTile({
  tag,
  title,
  description,
  primaryLink,
  secondaryLink,
  className,
}: HubModuleTileProps) {
  const isComingSoon = !primaryLink;
  const Icon = getTileIcon(title);

  return (
    <article
      className={cn(
        "group flex h-full min-h-72 flex-col border-t border-border pt-5 transition-colors duration-300 hover:border-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-medium tracking-[0.01em] text-muted-foreground">
          {tag.replace(/^MODULE\s+\d+$/i, "Learning path")}
        </span>
        <Icon
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-colors duration-300 group-hover:text-foreground"
          strokeWidth={1.5}
        />
      </div>
      <h2
        className={cn(
          "mt-8 text-xl font-semibold tracking-[-0.02em] text-balance",
          isComingSoon ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {primaryLink || secondaryLink ? (
          <>
            {primaryLink ? <TileLink link={primaryLink} variant="default" /> : null}
            {secondaryLink ? <TileLink link={secondaryLink} variant="outline" /> : null}
          </>
        ) : (
          <span className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground sm:min-h-8">
            Coming soon
          </span>
        )}
      </div>
    </article>
  );
}
