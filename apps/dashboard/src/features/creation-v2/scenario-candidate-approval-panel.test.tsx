/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScenarioCandidateApprovalPanel } from "./scenario-candidate-approval-panel";

const candidates: any[] = [
  { title: "First", description: "First description", scenes: [{ phase: "HOOK", duration: 8, description: "Scene" }] },
  { title: "Second", description: "Second description", scenes: [{ phase: "HOOK", duration: 8, description: "Scene" }] },
];
function renderPanel(approve = vi.fn().mockResolvedValue({ revision: { revisionNumber: 1, sourceCandidateIndex: 0 } })) {
  render(<ScenarioCandidateApprovalPanel artifactId="11111111-1111-4111-8111-111111111111" candidates={candidates} approve={approve} />);
  return approve;
}
beforeEach(() => vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "stable-key") }));
describe("ScenarioCandidateApprovalPanel", () => {
  it("requires a selection and marks the selected candidate", async () => {
    const user = userEvent.setup(); renderPanel();
    expect(screen.getByRole("button", { name: /approve selected/i })).toBeDisabled();
    await user.click(screen.getByText("Second"));
    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve selected/i })).toBeEnabled();
  });
  it("submits only artifact and candidate index, preserves its key across retry, and shows success", async () => {
    const user = userEvent.setup(); const approve = vi.fn().mockRejectedValueOnce(Object.assign(new Error("stack secret"), { code: "IDEMPOTENCY_KEY_REUSED" })).mockResolvedValueOnce({ revision: { revisionNumber: 2, sourceCandidateIndex: 0 } }); renderPanel(approve);
    await user.click(screen.getByText("First")); await user.click(screen.getByRole("button", { name: /approve selected/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already used"); expect(screen.queryByText(/stack secret/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve selected/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Approved revision 2");
    expect(approve).toHaveBeenNthCalledWith(1, { scenarioArtifactId: "11111111-1111-4111-8111-111111111111", sourceCandidateIndex: 0 }, "approve:stable-key");
    expect(approve).toHaveBeenNthCalledWith(2, { scenarioArtifactId: "11111111-1111-4111-8111-111111111111", sourceCandidateIndex: 0 }, "approve:stable-key");
  });
  it("can approve a later candidate as a new revision", async () => {
    const user = userEvent.setup(); const approve = vi.fn().mockResolvedValueOnce({ revision: { revisionNumber: 1, sourceCandidateIndex: 0 } }).mockResolvedValueOnce({ revision: { revisionNumber: 2, sourceCandidateIndex: 1 } }); renderPanel(approve);
    await user.click(screen.getByText("First")); await user.click(screen.getByRole("button", { name: /approve selected/i })); await screen.findByText(/Approved revision 1/);
    await user.click(screen.getByText("Second")); await user.click(screen.getByRole("button", { name: /approve as new/i }));
    expect(await screen.findByText(/Approved revision 2/)).toBeInTheDocument(); expect(approve).toHaveBeenLastCalledWith(expect.objectContaining({ sourceCandidateIndex: 1 }), expect.any(String));
  });
});
