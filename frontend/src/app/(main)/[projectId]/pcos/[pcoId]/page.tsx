"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mail, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ds/text";
import { EmptyState, ErrorState } from "@/components/ds";
import { PageShell, PageTabs, DetailLayout } from "@/components/layout";
import { usePCO, useSubmitPCO } from "@/hooks/use-pcos";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import { PCORecordHeader } from "@/components/domain/pcos/PCORecordHeader";
import { StageProgressBar } from "@/components/domain/pcos/StageProgressBar";
import { PCOTimeline } from "@/components/domain/pcos/PCOTimeline";
import { PCOSidebar } from "@/components/domain/pcos/PCOSidebar";
import { apiFetch } from "@/lib/api-client";

interface ConvertPcoResponse {
  id?: string;
  pcco_number?: string;
  commitmentChangeOrders?: unknown[];
  commitmentErrors?: unknown[];
}

export default function PCODetailPage() {
  const router = useRouter();
  const params = useParams()!;
  const projectId = params.projectId as string;
  const pcoId = params.pcoId as string;

  const [activeTab, setActiveTab] = useState("detail");
  const [activeVersionTab, setActiveVersionTab] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const { data: pco, isLoading, error } = usePCO(projectId, pcoId);
  const submitMutation = useSubmitPCO(projectId, pcoId);

  useProjectTitle(
    pco ? `PCO #${pco.number} - ${pco.title}` : "Loading..."
  );

  const handleBack = () => {
    router.push(`/${projectId}/pcos`);
  };

  const handleEdit = () => {
    router.push(`/${projectId}/pcos/${pcoId}/edit`);
  };

  const handleSubmit = () => {
    submitMutation.mutate();
  };

  const handleConvert = () => {
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    setIsConverting(true);
    try {
      const data = await apiFetch<ConvertPcoResponse>(
        `/api/projects/${projectId}/pcos/${pcoId}/convert-to-co`,
        { method: "POST" },
      );
      const pccoNumber = data.pcco_number ?? data.id;
      const commitmentCount =
        data.commitmentChangeOrders?.length ?? 0;

      toast.success(
        `Change Order #${pccoNumber} created` +
          (commitmentCount > 0
            ? ` with ${commitmentCount} commitment CO${commitmentCount > 1 ? "s" : ""}`
            : "")
      );

      if (data.commitmentErrors?.length) {
        toast.warning(
          `${data.commitmentErrors.length} commitment CO(s) could not be created — check the Change Orders list for details`
        );
      }

      // Navigate to the change orders list
      router.push(`/${projectId}/change-orders`);
    } catch (err) {
      toast.error("Failed to convert PCO");
    } finally {
      setIsConverting(false);
      setConvertDialogOpen(false);
    }
  };

  /* Loading */
  if (isLoading) {
    return (
      <PageShell variant="detail" title="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-6 w-full" />
          <DetailLayout
            sidebar={
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            }
          >
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
          </DetailLayout>
        </div>
      </PageShell>
    );
  }

  /* Error */
  if (error || !pco) {
    return (
      <PageShell variant="detail" title="Error" onBack={handleBack}>
        <ErrorState
          error={error instanceof Error ? error.message : "PCO not found"}
          onRetry={handleBack}
        />
      </PageShell>
    );
  }

  /* Version tabs */
  const versions = pco.versions ?? [];
  const hasVersions = versions.length > 1;
  const selectedVersionTab = activeVersionTab ?? `v${pco.current_version}`;

  return (
    <PageShell
      variant="detail"
      title={`PCO #${pco.number}: ${pco.title}`}
      onBack={handleBack}
    >
      {/* Record header — status badges + action buttons */}
      <PCORecordHeader
        pco={pco}
        onEdit={handleEdit}
        onSubmit={handleSubmit}
        onConvert={handleConvert}
        converting={isConverting}
      />

      {/* Stage progress */}
      <StageProgressBar pco={pco} />

      <PageTabs
        variant="inline"
        tabs={[
          { label: "Detail", href: "detail", isActive: activeTab === "detail" },
          {
            label: "Attachments",
            href: "attachments",
            isActive: activeTab === "attachments",
          },
          { label: "Emails", href: "emails", isActive: activeTab === "emails" },
        ]}
        onTabClick={(href) => setActiveTab(href)}
      />

      <div className="pt-4">
        {activeTab === "detail" && (
          <>
            {hasVersions && (
              <>
                <PageTabs
                  variant="inline"
                  tabs={versions
                    .sort((a, b) => a.version - b.version)
                    .map((ver) => {
                      const date = new Date(
                        ver.submitted_at
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                      const isCurrent = ver.version === pco.current_version;
                      const label = isCurrent
                        ? `v${ver.version} - ${date} (Current)`
                        : `v${ver.version} - ${date} (${ver.client_decision === "revision_requested" ? "Revised" : "Submitted"})`;
                      const href = `v${ver.version}`;
                      return {
                        label,
                        href,
                        isActive: selectedVersionTab === href,
                      };
                    })}
                  onTabClick={(href) => setActiveVersionTab(href)}
                />
                <div className="pt-4">
                  {versions.map((ver) =>
                    selectedVersionTab === `v${ver.version}` ? (
                      <div key={ver.id}>
                        {ver.version === pco.current_version ? (
                          <MainContent pco={pco} projectId={projectId} />
                        ) : (
                          <div className="rounded-lg bg-muted/50 p-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              Snapshot of version {ver.version} submitted on{" "}
                              {new Date(ver.submitted_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </p>
                            {ver.client_decision_note && (
                              <p className="mt-2 text-sm italic text-muted-foreground">
                                Client note: &ldquo;{ver.client_decision_note}
                                &rdquo;
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </>
            )}

            {!hasVersions && <MainContent pco={pco} projectId={projectId} />}
          </>
        )}

        {activeTab === "attachments" && (
          <EmptyState
            icon={<Paperclip />}
            title="No attachments"
            description="Attachments related to this potential change order will appear here."
          />
        )}

        {activeTab === "emails" && (
          <EmptyState
            icon={<Mail />}
            title="No emails"
            description="Emails related to this potential change order will appear here."
          />
        )}
      </div>

      {/* Convert to Change Order confirmation */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Change Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will create official Change Orders for the prime contract and
              any linked commitments. The PCO status will be set to
              &ldquo;Converted&rdquo; and can no longer be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConverting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConvert}
              disabled={isConverting}
            >
              {isConverting ? "Converting\u2026" : "Convert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

/* Two-column layout for main content */
function MainContent({
  pco,
  projectId,
}: {
  pco: NonNullable<ReturnType<typeof usePCO>["data"]>;
  projectId: string;
}) {
  return (
    <DetailLayout sidebar={<PCOSidebar pco={pco} />}>
      <PCOTimeline pco={pco} projectId={projectId} />
    </DetailLayout>
  );
}
