// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormatInputsRenderer } from "./format-inputs";
import { ScenarioState } from "./scenario-state";

describe("Creation Wizard V2 components", () => {
  it("renders typed Content Format inputs and preserves sibling state", () => {
    const change = vi.fn();
    render(
      <FormatInputsRenderer
        schema={{
          type: "object",
          properties: {
            environment: { type: "string", description: "Where it happens" },
            notes: { type: "string", format: "multiline" },
            count: { type: "integer", minimum: 1, maximum: 10 },
            intensity: { type: "string", enum: ["low", "high"] },
            enabled: { type: "boolean" },
          },
          required: ["environment"],
          additionalProperties: false,
        }}
        values={{ environment: "bridge", count: 8 }}
        errors={{ environment: "Required" }}
        onChange={change}
      />,
    );
    expect(screen.getByLabelText("environment *")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    fireEvent.change(screen.getByLabelText("count"), {
      target: { value: "9" },
    });
    expect(change).toHaveBeenCalledWith({ environment: "bridge", count: 9 });
    expect(screen.getByText("Where it happens")).toBeInTheDocument();
  });

  it("shows queued and running states without a fake percentage", () => {
    const attempt = {
      attemptNumber: 2,
      queuedAt: "2026-07-22T00:00:00Z",
      startedAt: "2026-07-22T00:00:01Z",
      provider: "minimax",
      modelId: "minimax-m2",
    };
    const { rerender } = render(
      <ScenarioState
        status="queued"
        attempt={attempt}
        onStart={vi.fn()}
        pending={false}
      />,
    );
    expect(screen.getByText(/Attempt 2 is queued/)).toBeInTheDocument();
    rerender(
      <ScenarioState
        status="running"
        attempt={attempt}
        onStart={vi.fn()}
        pending={false}
      />,
    );
    expect(screen.getByText(/Attempt 2 is running/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it("shows a safe failed state and Retry without raw diagnostics", () => {
    render(
      <ScenarioState
        status="failed"
        attempt={{
          attemptNumber: 1,
          errorCode: "SCENARIO_GENERATION_TRUNCATED",
          errorMessage: "safe",
          correlationId: "request-1",
          diagnosticPayload: "SECRET RAW RESPONSE",
        }}
        onStart={vi.fn()}
        pending={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Retry with same settings" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SECRET RAW RESPONSE/)).not.toBeInTheDocument();
    expect(screen.getByText(/request-1/)).toBeInTheDocument();
  });
});
