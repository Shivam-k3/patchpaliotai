import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import App from "./App";

describe("App backend status", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/health")) {
        return Promise.reject(new Error("backend down"));
      }
      if (url.includes("/ready")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ready: false, checks: { docker: false, samples_dir: true } }),
          text: async () => "",
        } as Response);
      }
      if (url.includes("/samples")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ samples: ["case1"] }),
          text: async () => "",
        } as Response);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows an offline state and retry control when the backend is unreachable", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Backend: offline/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeTruthy();
  });

  it("renders a successful analysis response from the backend", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/health")) {
        return Promise.resolve({ ok: true, json: async () => ({ status: "ok" }), text: async () => "" } as Response);
      }
      if (url.includes("/ready")) {
        return Promise.resolve({ ok: true, json: async () => ({ checks: { docker: false, samples_dir: true } }), text: async () => "" } as Response);
      }
      if (url.includes("/samples")) {
        return Promise.resolve({ ok: true, json: async () => ({ samples: ["case1"] }), text: async () => "" } as Response);
      }
      if (url.includes("/projects")) {
        return Promise.resolve({ ok: true, json: async () => ({ projects: [] }), text: async () => "" } as Response);
      }
      if (url.includes("/analyze")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            bug_summary: "The email branch returns invalid.",
            proposed_unified_diff: "--- a/mathlib.py\n+++ b/mathlib.py\n",
          }),
          text: async () => "",
        } as Response);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    }));

    render(<App />);
    await waitFor(() => expect(screen.getByRole("option", { name: "case1" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/bug description/i), { target: { value: "Fix the email validation bug" } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect((await screen.findAllByText("The email branch returns invalid.")).length).toBeGreaterThan(0);
    expect(screen.getByText(/This is the patch proposed/i)).toBeTruthy();
  });
});