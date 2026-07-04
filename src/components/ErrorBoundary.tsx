import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const MAX_RETRIES = 3;

interface ErrorBoundaryState {
  error: Error | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, retryCount: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="panel rounded-[28px] p-6">
          <p className="text-sm text-red-400 font-semibold">页面崩溃</p>
          <p className="mt-2 text-xs text-muted">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => {
              if (this.state.retryCount >= MAX_RETRIES) return;
              this.setState((prev) => ({ error: null, retryCount: prev.retryCount + 1 }));
            }}
            disabled={this.state.retryCount >= MAX_RETRIES}
            className="mt-4 rounded-xl border border-[color:var(--panel-border)] px-3 py-2 text-xs disabled:opacity-40"
          >
            {this.state.retryCount >= MAX_RETRIES ? '已达到最大重试次数' : '重试'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
