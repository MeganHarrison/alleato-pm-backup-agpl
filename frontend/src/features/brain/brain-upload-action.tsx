"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KnowledgeUploadDialog } from "@/features/knowledge/knowledge-upload-dialog";

export function BrainUploadAction({
  businessAreaId,
  businessAreaName,
}: {
  businessAreaId: number;
  businessAreaName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload />
        Upload source
      </Button>
      <KnowledgeUploadDialog
        open={open}
        onOpenChange={setOpen}
        businessAreaId={businessAreaId}
        businessAreaName={businessAreaName}
        onUploaded={() => router.refresh()}
      />
    </>
  );
}
