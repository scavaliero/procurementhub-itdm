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
const isRecoverableError = (error: Error) =>
  error.message?.includes("removeChild") ||
  error.message?.includes("insertBefore") ||
  error.message?.includes("not a child of this node") ||
  error.message?.includes("Rendered more hooks") ||
  error.message?.includes("Rendered fewer hooks");

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Auto-recover from browser-extension DOM errors
    if (isRecoverableError(error)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (isExtensionDomError(error)) {
      // Force re-render to recover
      this.setState({ hasError: false, error: null });
    }
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
          <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            Riprova
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
