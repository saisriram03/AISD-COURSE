import { create } from 'zustand';

export type SmartCursorState =
  | 'default'
  | 'link'
  | 'button'
  | 'grid-cell'
  | 'drag'
  | 'solving'
  | 'success'
  | 'danger'
  | 'text';

interface CursorStore {
  cursorState: SmartCursorState;
  label: string | null;
  setCursorState: (state: SmartCursorState, label?: string | null) => void;
  resetCursor: () => void;
}

export const useCursorStore = create<CursorStore>((set) => ({
  cursorState: 'default',
  label: null,
  setCursorState: (cursorState, label = null) => set({ cursorState, label }),
  resetCursor: () => set({ cursorState: 'default', label: null }),
}));
