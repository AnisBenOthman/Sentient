import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch module-init / runtime errors that happen before React mounts
window.addEventListener("error", (e) => {
  document.body.innerHTML = `<pre style="color:red;padding:1rem;white-space:pre-wrap">
App failed to load — check the browser console.
${e.message}
${e.error?.stack ?? ""}
  </pre>`;
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
});

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("React render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: "red", padding: "1rem", whiteSpace: "pre-wrap" }}>
          {"Render error — check the browser console.\n"}
          {(this.state.error as Error).message}
          {"\n"}
          {(this.state.error as Error).stack}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
