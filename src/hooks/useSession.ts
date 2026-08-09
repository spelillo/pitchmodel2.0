import { useCallback, useMemo, useState } from "react";
import { LoggedPitch, SessionState } from "@/types";

const EMPTY_SESSION: SessionState = {
  active: false,
  startedAt: null,
  log: [],
};

function makeId() {
  return `pitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSession() {
  const [session, setSession] = useState<SessionState>(EMPTY_SESSION);

  const startSession = useCallback(() => {
    setSession({ active: true, startedAt: Date.now(), log: [] });
  }, []);

  const endSession = useCallback(() => {
    setSession((prev) => ({ ...prev, active: false }));
  }, []);

  const logPitch = useCallback((entry: Omit<LoggedPitch, "id" | "timestamp">) => {
    setSession((prev) => ({
      ...prev,
      log: [{ ...entry, id: makeId(), timestamp: Date.now() }, ...prev.log],
    }));
  }, []);

  const stats = useMemo(() => {
    const count = session.log.length;
    if (count === 0) {
      return { count: 0, trueAccuracy: 0, adjustedAccuracy: 0 };
    }
    const trueSum = session.log.reduce((sum, p) => sum + p.trueAccuracy, 0);
    const adjustedSum = session.log.reduce((sum, p) => sum + p.adjustedAccuracy, 0);
    return {
      count,
      trueAccuracy: trueSum / count,
      adjustedAccuracy: adjustedSum / count,
    };
  }, [session.log]);

  return { session, startSession, endSession, logPitch, stats };
}
