import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorView } from "@/components/ErrorView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isDemoMode } from "@/lib/demo";

const err = Object.assign(new TypeError("Cannot read properties of null (reading 'amount')"), { digest: "abc123" });

describe("ErrorView", () => {
  it("shows the real error in demo mode", () => {
    const html = renderToStaticMarkup(<ErrorView error={err} demo />);
    expect(html).toContain("demo-error-details");
    expect(html).toContain("Cannot read properties of null");
    expect(html).toContain("TypeError");
    expect(html).toContain("abc123");
  });
  it("hides details outside demo mode", () => {
    const html = renderToStaticMarkup(<ErrorView error={err} demo={false} />);
    expect(html).not.toContain("demo-error-details");
    expect(html).not.toContain("Cannot read properties");
    expect(html).toContain("Something went wrong");
  });
  it("copes with a non-Error value", () => {
    expect(() => renderToStaticMarkup(<ErrorView error={{}} demo />)).not.toThrow();
  });
  it("reads demo mode from NEXT_PUBLIC_DEMO_MODE", () => {
    const prev = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    expect(isDemoMode()).toBe(false);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE; else process.env.NEXT_PUBLIC_DEMO_MODE = prev;
  });
});

describe("ErrorBoundary", () => {
  it("captures the error and renders the fallback instead of the children", () => {
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
    const b = new ErrorBoundary({ children: <p>child</p> });
    expect(renderToStaticMarkup(<>{b.render()}</>)).toContain("child");
    b.state = { error: err };
    const html = renderToStaticMarkup(<>{b.render()}</>);
    expect(html).not.toContain("child");
    expect(html).toContain("Something went wrong");
  });
});
