import { Component, type ErrorInfo, type ReactNode } from 'react';

/** If any screen throws while drawing, show a readable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[screen crashed]', error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0c0e12] text-slate-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#12151a] border border-slate-800 rounded-2xl p-6 space-y-3">
          <h1 className="text-lg font-semibold text-slate-100">Something went wrong on this screen</h1>
          <p className="text-sm text-slate-400">Your data is safe. Reload to try again.</p>
          <pre className="text-xs text-red-300 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{this.state.error.message}</pre>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Reload</button>
            <button onClick={() => window.location.assign('/')} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm">Go to start</button>
          </div>
        </div>
      </div>
    );
  }
}
