import { StatusBadge } from "@/components/ds";

export function ReadinessBadge({
  readyForBuild,
  label,
}: {
  readyForBuild: boolean;
  label: string;
}) {
  return (
    <StatusBadge
      status={label}
      variant={readyForBuild ? "success" : label === "Almost ready" ? "warning" : "neutral"}
    />
  );
}
