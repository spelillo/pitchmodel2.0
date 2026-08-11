import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AtBatResultLogger } from "./AtBatResultLogger";

describe("AtBatResultLogger", () => {
  it("renders the four category column labels", () => {
    render(<AtBatResultLogger selected={null} onSelect={jest.fn()} disabled={false} />);
    expect(screen.getByText("In Play — Reach Base")).toBeInTheDocument();
    expect(screen.getByText("In Play — Out")).toBeInTheDocument();
    expect(screen.getByText("In Play — Sac")).toBeInTheDocument();
    expect(screen.getByText("No Contact")).toBeInTheDocument();
  });

  it("places Fielders Choice and Field Error under Reach Base, not Out", () => {
    render(<AtBatResultLogger selected={null} onSelect={jest.fn()} disabled={false} />);
    expect(screen.getByRole("radio", { name: "Fielders Choice" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Field Error" })).toBeInTheDocument();
    // (column membership itself is covered by atBatResultLayout.test.ts —
    // this just confirms both buttons render and are distinct from the
    // "...Out" variant)
    expect(screen.getByRole("radio", { name: "Fielders Choice Out" })).toBeInTheDocument();
  });

  it("disables every button and marks the group disabled when disabled=true", () => {
    render(<AtBatResultLogger selected={null} onSelect={jest.fn()} disabled />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Single" })).toBeDisabled();
  });

  it("calls onSelect with the clicked result when enabled", async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(<AtBatResultLogger selected={null} onSelect={onSelect} disabled={false} />);

    await user.click(screen.getByRole("radio", { name: "Strikeout" }));

    expect(onSelect).toHaveBeenCalledWith("Strikeout");
  });

  it("marks the selected result as checked", () => {
    render(
      <AtBatResultLogger selected="Home Run" onSelect={jest.fn()} disabled={false} />
    );
    expect(screen.getByRole("radio", { name: "Home Run" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
