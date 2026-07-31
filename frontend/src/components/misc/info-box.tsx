import {
  Calendar,
  User,
  FileText,
  ArrowRight,
  ArrowLeft,
  Clock,
  Tag,
  CheckCircle,
  AlertTriangle,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { SectionHeader } from "@/components/ds/section-header";
import { format } from "date-fns";
import type { ReactNode } from "react";

interface InfoBoxProps {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}

export function InfoBox({
  icon,
  title,
  children,
  className = "",
}: InfoBoxProps) {
  return (
    <div className={`border border-neutral-200 bg-background p-6 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        {icon}
        <SectionHeader title={title} />
      </div>
      <div className="text-base font-light text-neutral-900">{children}</div>
    </div>
  );
}

interface MeetingDateBoxProps {
  date: string | Date;
  className?: string;
}

export function MeetingDateBox({ date, className }: MeetingDateBoxProps) {
  return (
    <InfoBox
      icon={<Calendar className="h-4 w-4 text-brand" />}
      title="Date"
      className={className}
    >
      {format(new Date(date), "EEEE, MMMM d, yyyy")}
    </InfoBox>
  );
}

// Export icons for convenience
export {
  Calendar,
  User,
  FileText,
  ArrowRight,
  ArrowLeft,
  Clock,
  Tag,
  CheckCircle,
  AlertTriangle,
  ListTodo,
  Sparkles,
};
