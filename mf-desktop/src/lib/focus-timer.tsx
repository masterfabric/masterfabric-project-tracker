import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const FOCUS_KEY = "mf.desktop.focusTimer";

export const FOCUS_PRESETS = [
  { label: "25m", seconds: 25 * 60 },
  { label: "15m", seconds: 15 * 60 },
  { label: "5m", seconds: 5 * 60 },
] as const;

type FocusState = {
  endsAt: number | null;
  presetSeconds: number;
  taskTitle: string | null;
};

type FocusContextValue = FocusState & {
  remainingMs: number;
  running: boolean;
  start: (seconds: number, taskTitle?: string | null) => void;
  stop: () => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);

function loadFocus(): FocusState {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    if (!raw) {
      return { endsAt: null, presetSeconds: 25 * 60, taskTitle: null };
    }
    return JSON.parse(raw) as FocusState;
  } catch {
    return { endsAt: null, presetSeconds: 25 * 60, taskTitle: null };
  }
}

function saveFocus(state: FocusState) {
  localStorage.setItem(FOCUS_KEY, JSON.stringify(state));
}

export function formatFocusRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FocusState>(() =>
    typeof window === "undefined"
      ? { endsAt: null, presetSeconds: 25 * 60, taskTitle: null }
      : loadFocus(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state.endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.endsAt]);

  useEffect(() => {
    if (state.endsAt && state.endsAt <= Date.now()) {
      const next = { ...state, endsAt: null };
      setState(next);
      saveFocus(next);
    }
  }, [now, state]);

  const start = useCallback((seconds: number, taskTitle?: string | null) => {
    const next: FocusState = {
      endsAt: Date.now() + seconds * 1000,
      presetSeconds: seconds,
      taskTitle: taskTitle ?? null,
    };
    setState(next);
    saveFocus(next);
  }, []);

  const stop = useCallback(() => {
    const next: FocusState = { ...state, endsAt: null, taskTitle: null };
    setState(next);
    saveFocus(next);
  }, [state]);

  const remainingMs = state.endsAt
    ? Math.max(0, state.endsAt - now)
    : state.presetSeconds * 1000;

  const value = useMemo(
    () => ({
      ...state,
      remainingMs,
      running: Boolean(state.endsAt && state.endsAt > now),
      start,
      stop,
    }),
    [state, remainingMs, now, start, stop],
  );

  return (
    <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
  );
}

export function useFocusTimer() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocusTimer must be used within FocusTimerProvider");
  return ctx;
}
