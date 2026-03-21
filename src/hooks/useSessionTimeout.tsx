import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes
const COUNTDOWN_SECONDS = 60;

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const startInactivityTimer = useCallback(() => {
    clearTimers();
    if (!user) return;
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(COUNTDOWN_SECONDS);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearTimers();
            setShowWarning(false);
            signOut().then(() => navigate("/login"));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_MS);
  }, [user, clearTimers, signOut, navigate]);

  const handleStillHere = useCallback(() => {
    setShowWarning(false);
    clearTimers();
    startInactivityTimer();
  }, [clearTimers, startInactivityTimer]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    const resetTimer = () => {
      if (!showWarning) startInactivityTimer();
    };

    events.forEach((e) => document.addEventListener(e, resetTimer, { passive: true }));
    startInactivityTimer();

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetTimer));
      clearTimers();
    };
  }, [user, showWarning, startInactivityTimer, clearTimers]);

  const SessionTimeoutModal = useCallback(() => {
    if (!showWarning) return null;
    return (
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-sm"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Sessione in scadenza
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              La tua sessione sta per scadere per inattività.
            </p>
            <div className="flex items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-destructive">
                {countdown}s
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleStillHere} className="w-full">
              Sono ancora qui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }, [showWarning, countdown, handleStillHere]);

  return { SessionTimeoutModal };
}
