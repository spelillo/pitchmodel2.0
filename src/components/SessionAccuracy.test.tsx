import { render, screen } from "@testing-library/react";
import { SessionAccuracy } from "./SessionAccuracy";
import { LoggedPitch } from "@/types";

function makeLog(count: number): LoggedPitch[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pitch-${i}`,
    timestamp: i,
    pitcherName: "Rookie Ace",
    batterName: "Slugger",
    count: "1-2",
    predictedPitch: "4-Seam Fastball",
    predictedProbability: 0.4,
    actualPitch: "Sinker",
    trueAccuracy: 0,
    adjustedAccuracy: 0.75,
  }));
}

describe("SessionAccuracy", () => {
  it("shows an empty-state message when nothing has been logged", () => {
    render(
      <SessionAccuracy active count={0} trueAccuracyValue={0} adjustedAccuracyValue={0} log={[]} />
    );
    expect(screen.getByText(/no pitches logged yet/i)).toBeInTheDocument();
  });

  it("renders every row when the log has 10 or fewer entries", () => {
    render(
      <SessionAccuracy
        active
        count={7}
        trueAccuracyValue={0.5}
        adjustedAccuracyValue={0.7}
        log={makeLog(7)}
      />
    );
    expect(screen.getAllByText("Sinker")).toHaveLength(7);
    expect(screen.queryByText(/most recent/i)).not.toBeInTheDocument();
  });

  it("caps the visible rows at 10 even when the session log is longer, and says so", () => {
    render(
      <SessionAccuracy
        active
        count={23}
        trueAccuracyValue={0.5}
        adjustedAccuracyValue={0.7}
        log={makeLog(23)}
      />
    );
    expect(screen.getAllByText("Sinker")).toHaveLength(10);
    expect(screen.getByText(/10 most recent shown/i)).toBeInTheDocument();
    expect(screen.getByText(/based on 23 logged pitches/i)).toBeInTheDocument();
  });

  it("still reports accuracy percentages computed over the whole session, not just the visible rows", () => {
    render(
      <SessionAccuracy
        active
        count={23}
        trueAccuracyValue={0.42}
        adjustedAccuracyValue={0.81}
        log={makeLog(23)}
      />
    );
    expect(screen.getByText("42.0%")).toBeInTheDocument();
    expect(screen.getByText("81.0%")).toBeInTheDocument();
  });
});
