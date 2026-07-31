import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CollaborationRuntimeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Turns on the heavy Velt collaboration runtime only after the user explicitly
 * opts in, while still allowing collaboration-dedicated routes to force it on.
 */
export const useCollaborationRuntimeStore =
  create<CollaborationRuntimeState>()(
    persist(
      (set) => ({
        enabled: false,
        setEnabled: (enabled) => set({ enabled }),
      }),
      {
        name: "collaboration-runtime",
      },
    ),
  );
