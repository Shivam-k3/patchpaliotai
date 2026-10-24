import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Northstar landing page", () => {
  it("renders the primary product sections and navigation", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /find your north\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /clarity is a competitive advantage/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /choose your pace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start for free/i })).toHaveAttribute("href", "#signup");
    expect(screen.getByRole("heading", { name: /ready to find your north/i })).toBeInTheDocument();
  });

  it("opens the mobile menu and changes billing prices", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /toggle menu/i }));
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Product" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /annual/i }));
    expect(screen.getByText("$23")).toBeInTheDocument();
    expect(screen.getByText("$63")).toBeInTheDocument();
  });

  it("validates signup and shows local success feedback", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText(/work email/i);
    await user.click(screen.getByRole("button", { name: /join the waitlist/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/work email/i);
    await user.type(input, "not-an-email");
    await user.click(screen.getByRole("button", { name: /join the waitlist/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    await user.clear(input);
    await user.type(input, " alex@example.com ");
    await user.click(screen.getByRole("button", { name: /join the waitlist/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/local preview signup/i);
  });
});
