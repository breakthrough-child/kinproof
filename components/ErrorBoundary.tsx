"use client";
import { Component, type ReactNode } from "react";
import { ErrorView } from "./ErrorView";

/** Contains a crash to one part of the page (e.g. the confirmation overlay) instead of blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[kinproof] ${this.props.label ?? "component"} crashed:`, error);
  }

  render() {
    if (this.state.error) {
      return <ErrorView compact error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
