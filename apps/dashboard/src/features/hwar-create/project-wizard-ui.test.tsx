import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, listTemplates, startProject, listFormats } = vi.hoisted(() => ({
  push: vi.fn(),
  listTemplates: vi.fn(),
  startProject: vi.fn(),
  listFormats: vi.fn(),
}));
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/shared/api/actions", () => ({
  listStoryTemplates: listTemplates,
  startGenerationProject: startProject,
}));
vi.mock("@/features/content-formats/api", () => ({
  contentFormatsApi: { list: listFormats },
}));
vi.mock("@/shared/components/ai/ModelSelector", () => ({
  ModelSelector: () => <div />,
}));
import NewProject from "@/app/hwar/create/new/page";

const active = {
  format: {
    id: "format-1",
    name: "Explainer",
    status: "active",
    formatType: "explainer",
    description: "Explains",
    hookPattern: "Question",
    structurePattern: "Steps",
    visualPattern: "Clean",
    pacingPattern: "Fast",
    targetDurationMinSeconds: 30,
    targetDurationMaxSeconds: 60,
  },
  videoCount: 2,
  evidenceCount: 3,
};
const template = {
  id: "template-1",
  name: "Three beats",
  description: "A structure",
  targetDurationSeconds: 45,
  tags: ["HOOK", "PAYOFF"],
};
function renderWizard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NewProject />
    </QueryClientProvider>,
  );
}
async function openSource() {
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}
async function reviewAndCreate() {
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(screen.getByRole("button", { name: "Create Project" }));
}
beforeEach(() => {
  search = "";
  push.mockReset();
  listTemplates.mockReset().mockResolvedValue([template]);
  listFormats.mockReset().mockResolvedValue([active]);
  startProject.mockReset().mockResolvedValue({ project: { id: "project-1" } });
});

describe("production project wizard", () => {
  it("shows only canonical tabs and switches flows", async () => {
    renderWizard();
    await openSource();
    expect(screen.getByRole("tab", { name: "Prompt" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Content Formats" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Story Templates" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Trends")).not.toBeInTheDocument();
    expect(screen.queryByText("Presets")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Story Templates" }));
    expect(await screen.findByText("Three beats")).toBeInTheDocument();
  });
  it("requires prompt idea and submits a canonical prompt payload", async () => {
    renderWizard();
    await openSource();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Specific video idea"),
      "A concrete idea",
    );
    await reviewAndCreate();
    await waitFor(() => expect(startProject).toHaveBeenCalledTimes(1));
    expect(startProject).toHaveBeenCalledWith(
      expect.objectContaining({ source: "prompt", prompt: "A concrete idea" }),
    );
    expect(startProject.mock.calls[0][0]).not.toHaveProperty("contentFormatId");
    expect(startProject.mock.calls[0][0]).not.toHaveProperty("templateId");
    expect(startProject.mock.calls[0][0]).not.toHaveProperty("presetId");
    expect(startProject.mock.calls[0][0]).not.toHaveProperty("trendId");
  });
  it("requires template and idea for the standalone template flow", async () => {
    renderWizard();
    await openSource();
    await userEvent.click(screen.getByRole("tab", { name: "Story Templates" }));
    expect(await screen.findByText("Three beats")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Three beats/ }));
    await userEvent.type(
      screen.getByLabelText("Specific video idea"),
      "Template idea",
    );
    await reviewAndCreate();
    await waitFor(() =>
      expect(startProject).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "story_template",
          templateId: "template-1",
          prompt: "Template idea",
        }),
      ),
    );
    expect(startProject.mock.calls[0][0].source).not.toBe("preset");
  });
  it("loads only active formats, supports optional templates and sends canonical format payload", async () => {
    listFormats.mockResolvedValue([
      active,
      {
        ...active,
        format: {
          ...active.format,
          id: "draft",
          name: "Draft",
          status: "draft",
        },
      },
      {
        ...active,
        format: {
          ...active.format,
          id: "archived",
          name: "Archived",
          status: "archived",
        },
      },
    ]);
    renderWizard();
    await openSource();
    await userEvent.click(screen.getByRole("tab", { name: "Content Formats" }));
    expect(await screen.findByText("Explainer")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(listFormats).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Explainer/ }));
    expect(screen.getByText("View format")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Specific video idea"),
      "Format idea",
    );
    await reviewAndCreate();
    await waitFor(() =>
      expect(startProject).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "content_format",
          contentFormatId: "format-1",
          prompt: "Format idea",
        }),
      ),
    );
    expect(startProject.mock.calls[0][0]).not.toHaveProperty("templateId");
  });
  it("clears optional templates and warns without blocking incompatible duration", async () => {
    listTemplates.mockResolvedValue([
      { ...template, targetDurationSeconds: 90 },
    ]);
    renderWizard();
    await openSource();
    await userEvent.click(screen.getByRole("tab", { name: "Content Formats" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /Explainer/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Three beats/ }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("primary constraint");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("renders retry and empty active-format states", async () => {
    listFormats.mockReset().mockRejectedValue(new Error("nope"));
    renderWizard();
    await openSource();
    await userEvent.click(screen.getByRole("tab", { name: "Content Formats" }));
    expect(
      await screen.findByText(/Could not load active Content Formats/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(listFormats).toHaveBeenCalledTimes(2);
  });
  it("renders the empty active-format state", async () => {
    listFormats.mockResolvedValue([]);
    renderWizard();
    await openSource();
    await userEvent.click(screen.getByRole("tab", { name: "Content Formats" }));
    expect(
      await screen.findByText(/No active Content Formats yet/),
    ).toBeInTheDocument();
  });
  it("keeps direct URL prefill in content format flow and blocks unavailable IDs", async () => {
    search = "source=content_format&contentFormatId=format-1";
    renderWizard();
    expect(
      await screen.findByRole("tab", {
        name: "Content Formats",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("View format")).toBeInTheDocument();
    expect(screen.getByLabelText("Specific video idea")).toHaveValue("");
  });
  it("shows unavailable prefill rather than falling back to prompt", async () => {
    search = "source=content_format&contentFormatId=missing";
    listFormats.mockResolvedValue([]);
    renderWizard();
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(
      screen.getByRole("tab", { name: "Content Formats", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
