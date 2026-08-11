import { render, screen } from "@testing-library/react";
import { PredictionResult } from "./PredictionResult";
import { PredictionResult as PredictionResultType } from "@/types";

const result: PredictionResultType = {
  predictedPitch: "4-Seam Fastball",
  probability: 0.42,
  probabilities: [{ pitch: "4-Seam Fastball", probability: 0.42 }],
  similarSituationTotal: 50,
  similarSituationBreakdown: [{ pitch: "4-Seam Fastball", count: 20 }],
  matchingSituations: 20,
};

describe("PredictionResult", () => {
  it("no longer renders the Similar Situations breakdown section", () => {
    render(<PredictionResult result={result} loading={false} emptyMessage="" />);
    expect(screen.queryByText("Similar Situations")).not.toBeInTheDocument();
  });

  it("still renders the 'Why' explanation sentence", () => {
    render(<PredictionResult result={result} loading={false} emptyMessage="" />);
    expect(screen.getByText(/why 4-seam fastball\?/i)).toBeInTheDocument();
    expect(screen.getByText(/most similar historical situations resulted in a/i)).toBeInTheDocument();
  });

  it("shows the empty-state message when there is no result yet", () => {
    render(<PredictionResult result={null} loading={false} emptyMessage="Select a pitcher." />);
    expect(screen.getByText("Select a pitcher.")).toBeInTheDocument();
  });
});
