import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export const TRAINING_MASTHEAD_LINKS = [
  { label: "Training Library", href: "/training/library" },
  { label: "The Method", href: "/training/method" },
  { label: "Start Here", href: "/training#start-here" },
  { label: "AI Prompts", href: "/training/prompts" },
  { label: "My Growth", href: "/training/growth" },
  { label: "Ask the Library", href: "/training/ask" },
] as const;

interface TrainingMastheadProps {
  eyebrow: string;
  title: string;
  description: string;
  variant?: "hero" | "section";
  action?: ReactNode;
  backLink?: {
    href: string;
    label: string;
  };
}

export function TrainingMasthead({
  eyebrow,
  title,
  description,
  variant = "hero",
  action,
  backLink,
}: TrainingMastheadProps) {
  const isHero = variant === "hero";

  return (
    <section className="overflow-hidden bg-foreground text-background">
      <div className="mx-auto w-full max-w-full px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-end">
          {!isHero ? (
            <p className="text-sm italic text-primary sm:mr-auto">
              Your partner from the ground up.
            </p>
          ) : null}
          {isHero ? (
            <nav
              aria-label="Training sections"
              className="flex flex-wrap items-center gap-x-4 sm:justify-end sm:gap-x-6"
            >
              {TRAINING_MASTHEAD_LINKS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-background/75 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div
          className={cn(
            isHero
              ? "pb-12 pt-5 sm:pb-16 lg:pb-20"
              : "pb-8 pt-3 sm:pb-10 sm:pt-4",
          )}
        >
          {backLink ? (
            <Link
              href={backLink.href}
              className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-background/75 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground sm:min-h-9"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {backLink.label}
            </Link>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
          <h1
            className={cn(
              "mt-3 max-w-4xl font-sans font-semibold uppercase text-background",
              isHero
                ? "text-4xl tracking-normal sm:text-5xl lg:text-6xl"
                : "text-3xl tracking-tight sm:text-4xl",
            )}
          >
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-background/75">
            {description}
          </p>
          {action ? <div className="mt-6">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
