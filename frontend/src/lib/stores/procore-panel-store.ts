import { create } from "zustand";

interface ProcorepanelState {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const useProcorePanelStore = create<ProcorepanelState>()((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}));
