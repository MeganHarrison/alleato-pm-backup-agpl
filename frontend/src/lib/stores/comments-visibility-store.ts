import { create } from "zustand";

interface CommentsVisibilityState {
  /** When true, Velt comment pins and the recorder/audio/video widgets render on the page. */
  visible: boolean;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
}

/**
 * Controls whether the global Velt collaboration layer (comment pins, recorder
 * control panel, audio/video playback widgets) is shown on top of page content.
 *
 * Intentionally session-scoped so comments never reappear during the initial
 * hydration pass on a fresh page load. Read by `VeltGlobalLayer`; toggled from
 * the header comments menu.
 */
export const useCommentsVisibilityStore = create<CommentsVisibilityState>(
  (set) => ({
    visible: false,
    toggle: () => set((state) => ({ visible: !state.visible })),
    setVisible: (visible) => set({ visible }),
  }),
);
