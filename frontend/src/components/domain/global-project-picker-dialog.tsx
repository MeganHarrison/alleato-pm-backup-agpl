"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { useProjects } from "@/hooks/use-projects";

interface GlobalProjectPickerDialogProps {
  open: boolean;
  onClose: () => void;
  toolPath: string;
  toolLabel: string;
}

export function GlobalProjectPickerDialog({
  open,
  onClose,
  toolPath,
  toolLabel,
}: GlobalProjectPickerDialogProps) {
  const router = useRouter();
  const { projects, isLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  useEffect(() => {
    if (!open) setSelectedProjectId("");
  }, [open]);

  const handleCreate = () => {
    if (!selectedProjectId) return;
    router.push(`/${selectedProjectId}/${toolPath}/new`);
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Select a Project</ModalTitle>
        </ModalHeader>
        <div className="py-2">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name ?? `Project ${project.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!selectedProjectId || isLoading}
          >
            Create {toolLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
