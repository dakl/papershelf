import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, errorInfo.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 select-none">
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-md text-center">
            An unexpected error occurred. You can reload to try again.
          </p>
          {this.state.error && (
            <pre className="text-xs text-neutral-400 dark:text-neutral-500 mb-6 max-w-lg overflow-auto px-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
