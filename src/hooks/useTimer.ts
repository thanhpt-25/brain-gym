import { useState, useEffect, useRef } from 'react';

interface UseTimerOptions {
  /** Deadline as a client-clock timestamp (ms); null while there is none. */
  deadline: number | null;
  onExpire?: () => void;
  isActive: boolean;
}

function secondsUntil(deadline: number | null): number {
  if (deadline == null) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * Countdown derived from a fixed deadline rather than decremented per tick,
 * so it stays correct when the tab is throttled in the background, the
 * device sleeps, or the attempt is resumed after a reload.
 */
export function useTimer({ deadline, onExpire, isActive }: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(() => secondsUntil(deadline));
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  // Fire onExpire once per deadline, even if the timer is paused/resumed.
  const expiredFor = useRef<number | null>(null);

  useEffect(() => {
    setTimeLeft(secondsUntil(deadline));
    if (!isActive || deadline == null) return;

    const tick = () => {
      const left = secondsUntil(deadline);
      setTimeLeft(left);
      if (left <= 0 && expiredFor.current !== deadline) {
        expiredFor.current = deadline;
        onExpireRef.current?.();
      }
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isActive, deadline]);

  return { timeLeft };
}
