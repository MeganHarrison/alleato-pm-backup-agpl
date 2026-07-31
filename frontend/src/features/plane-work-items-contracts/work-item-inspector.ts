/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Derived from Plane's side-peek work-item interaction contract at
 * makeplane/plane v1.3.1. See LICENSES/NOTICE-PLANE.md and /source.
 */

export type PlaneInspectorPresentation = "side-peek" | "mobile-sheet";

export interface PlaneWorkItemInspectorContract {
  workItemId: string;
  presentation: PlaneInspectorPresentation;
  width: string;
  modal: boolean;
  focusTrap: boolean;
  closeOnEscape: true;
  closeOnBackdrop: true;
}

export function getPlaneWorkItemInspectorContract(
  workItemId: string | null,
  viewportWidth: number,
): PlaneWorkItemInspectorContract | null {
  if (!workItemId?.trim()) return null;
  const mobile = viewportWidth < 768;
  return {
    workItemId: workItemId.trim(),
    presentation: mobile ? "mobile-sheet" : "side-peek",
    width: mobile ? "100vw" : "min(560px, 46vw)",
    modal: mobile,
    focusTrap: mobile,
    closeOnEscape: true,
    closeOnBackdrop: true,
  };
}

export type PlaneWorkItemsRecoveryKind =
  | "missing"
  | "unauthenticated"
  | "denied"
  | "unavailable";

export interface PlaneWorkItemsRecovery {
  kind: PlaneWorkItemsRecoveryKind;
  title: string;
  message: string;
  action: "clear-peek" | "sign-in" | "go-back" | "retry";
}

export function getPlaneWorkItemsRecovery(
  status: number | null,
  context: "collection" | "inspector",
): PlaneWorkItemsRecovery {
  if (status === 401) {
    return {
      kind: "unauthenticated",
      title: "Sign in to view work items",
      message:
        "Your session has expired. Sign in again to return to this project work-item view.",
      action: "sign-in",
    };
  }
  if (status === 403) {
    return {
      kind: "denied",
      title: "You do not have access to these work items",
      message:
        "Your project permissions do not allow this work-item view. Return to a project you can access.",
      action: "go-back",
    };
  }
  if (status === 404 && context === "inspector") {
    return {
      kind: "missing",
      title: "Work item not found",
      message:
        "This work item may have been deleted or moved. Close the inspector to continue.",
      action: "clear-peek",
    };
  }
  if (status === 404) {
    return {
      kind: "missing",
      title: "Project work items not found",
      message:
        "The project may have been removed or is no longer available. Return to the project list.",
      action: "go-back",
    };
  }
  return {
    kind: "unavailable",
    title: "Work items could not be loaded",
    message:
      "The request failed before the work-item view was ready. Try loading it again.",
    action: "retry",
  };
}
