"use client";

export function downloadRecruitingWorkspace(json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `applicant-tracker-local-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
