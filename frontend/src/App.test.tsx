import { render, screen, waitFor } from "@testing-library/react";
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
    vi.unstubAllGlobals();
  });

  it("shows an offline state and retry control when the backend is unreachable", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Backend: offline/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeTruthy();
  });
});