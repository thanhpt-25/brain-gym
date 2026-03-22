import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-mono font-bold tracking-tight">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                An unexpected error occurred. We've been notified and are working on it.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] bg-muted p-3 rounded-lg overflow-auto max-h-32 text-left font-mono opacity-70">
                {this.state.error.message}
              </pre>
            )}
            <Button 
                onClick={() => window.location.reload()}
                className="w-full font-mono gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
