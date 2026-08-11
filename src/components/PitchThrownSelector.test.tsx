import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PitchThrownSelector } from "./PitchThrownSelector";

describe("PitchThrownSelector", () => {
  it("renders the four category column labels", () => {
    render(<PitchThrownSelector predictedPitch={null} selected={null} onSelect={jest.fn()} />);
    expect(screen.getByText("Fastball")).toBeInTheDocument();
    expect(screen.getByText("Breaking")).toBeInTheDocument();
    expect(screen.getByText("Off-speed")).toBeInTheDocument();
    // "Other" is both a column label and a pitch type in that column —
    // scope to the label element specifically.
    expect(screen.getByText("Other", { selector: "p" })).toBeInTheDocument();
  });

  it("never renders a Pitch Out button", () => {
    render(<PitchThrownSelector predictedPitch={null} selected={null} onSelect={jest.fn()} />);
    expect(screen.queryByRole("radio", { name: /pitch out/i })).not.toBeInTheDocument();
  });

  it("calls onSelect with the clicked pitch", async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    render(<PitchThrownSelector predictedPitch={null} selected={null} onSelect={onSelect} />);

    await user.click(screen.getByRole("radio", { name: "Slider" }));

    expect(onSelect).toHaveBeenCalledWith("Slider");
  });

  it("marks the selected pitch as checked", () => {
    render(
      <PitchThrownSelector predictedPitch={null} selected="Curveball" onSelect={jest.fn()} />
    );
    expect(screen.getByRole("radio", { name: "Curveball" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("flags the predicted pitch's button by its title", () => {
    render(
      <PitchThrownSelector predictedPitch="Changeup" selected={null} onSelect={jest.fn()} />
    );
    expect(screen.getByRole("radio", { name: /changeup/i })).toHaveAttribute(
      "title",
      "Changeup (predicted)"
    );
  });
});
