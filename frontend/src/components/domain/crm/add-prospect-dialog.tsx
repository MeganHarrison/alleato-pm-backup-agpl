"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";

export interface AddProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (companyId: string) => void;
}

export function AddProspectDialog({ open, onOpenChange, onCreated }: AddProspectDialogProps): ReactElement {
  const [name, setName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const reset = () => {
    setName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setCity("");
    setState("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    setIsSaving(true);
    try {
      const payload = await apiFetch<{ data: { id: string } }>("/api/directory/prospects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
        }),
      });
      toast.success("Prospect added");
      reset();
      onOpenChange(false);
      onCreated(payload.data.id);
    } catch (submitError) {
      handleFormError(submitError, { entity: "prospect", action: "create" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Add prospect</ModalTitle>
          <ModalDescription>
            Creates a company with lifecycle stage “prospect”. It stays out of vendor
            dropdowns and the verified directory until it is qualified and verified.
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="prospect-name">Company name</Label>
            <Input
              id="prospect-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Company name"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="prospect-contact">Contact name</Label>
              <Input
                id="prospect-contact"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prospect-phone">Phone</Label>
              <Input
                id="prospect-phone"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prospect-email">Email</Label>
            <Input
              id="prospect-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="prospect-city">City</Label>
              <Input
                id="prospect-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prospect-state">State</Label>
              <Input
                id="prospect-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
              />
            </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Adding…" : "Add prospect"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
