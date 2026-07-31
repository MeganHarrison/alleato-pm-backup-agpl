import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface SectionTitleContentProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function SectionTitleContent({
  eyebrow = "How the AI works",
  title,
  subtitle,
}: SectionTitleContentProps) {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Documentation
        </Link>
      </div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

interface SectionProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="space-y-5">
      <div>
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
