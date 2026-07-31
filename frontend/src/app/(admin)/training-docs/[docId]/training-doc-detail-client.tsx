"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { useTrainingDocs } from "@/hooks/use-training-docs";

import { TrainingDocEditor } from "../training-doc-editor";

export function TrainingDocDetailClient({ docId }: { docId: string }) {
  const router = useRouter();
  const { data: docs = [], isLoading } = useTrainingDocs();
  const doc = docs.find((item) => item.id === docId);

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading training doc...
      </div>
    );
  }

  if (!doc) {
    return (
      <EmptyState
        icon={<BookOpen className="h-5 w-5" />}
        title="Training doc not found"
        description="Return to the table and choose an existing SOP."
        action={
          <Button onClick={() => router.push("/training-docs")}>
            Back to Training Docs
          </Button>
        }
      />
    );
  }

  return (
    <TrainingDocEditor
      doc={doc}
      onDeleted={() => router.push("/training-docs")}
    />
  );
}
