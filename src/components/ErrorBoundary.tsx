import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Known transient React/DOM errors that can be auto-recovered
// NOTE: Do NOT include "Rendered more/fewer hooks" — those are structural
// and auto-recovering from them causes infinite re-render loops (error #310).
const isRecoverableError = (error: Error) =>
  error.message?.includes("removeChild") ||
  error.message?.includes("insertBefore") ||
  error.message?.includes("not a child of this node");

export class ErrorBoundary extends React.Component<Props, State> {
  private recoveryAttempts = 0;
  private lastErrorTime = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const now = Date.now();
    // Only auto-recover from transient DOM errors, and cap retries
    if (isRecoverableError(error)) {
      if (now - this.lastErrorTime < 2000) {
        this.recoveryAttempts++;
      } else {
        this.recoveryAttempts = 1;
      }
      this.lastErrorTime = now;

      if (this.recoveryAttempts <= 3) {
        this.setState({ hasError: false, error: null });
        return;
      }
    }
    // Non-recoverable or too many retries: stay in error state
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">Qualcosa è andato storto</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            {this.state.error?.message ?? "Errore imprevisto"}
          </p>
          <Button variant="outline" onClick={() => { this.recoveryAttempts = 0; this.setState({ hasError: false, error: null }); }}>
            Riprova
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
