import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { push, detail } = vi.hoisted(() => ({ push: vi.fn(), detail: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "format-1" }),
}));
vi.mock("./api", () => ({
  contentFormatsApi: {
    detail,
    activate: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
    createEvidence: vi.fn(),
    updateVideo: vi.fn(),
    deleteVideo: vi.fn(),
    updateChannel: vi.fn(),
    deleteChannel: vi.fn(),
    deleteEvidence: vi.fn(),
  },
  contentFormatKeys: { detail: (id: string) => ["content-format", id] },
}));
vi.mock("./content-format-form", () => ({ ContentFormatForm: () => <div /> }));
import { ContentFormatDetailPage } from "./detail-page";
const base = (status: "active" | "draft" | "archived") => ({
  format: {
    id: "format-1",
    name: "Explainer",
    slug: "explainer",
    status,
    formatType: "explainer",
  },
  counts: { videoCount: 1, channelCount: 0, evidenceCount: 0 },
  videos: [],
  channels: [],
  evidence: [],
});
function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ContentFormatDetailPage />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  push.mockReset();
  detail.mockReset();
});
describe("Content Format project CTA", () => {
  it("takes an active format to a shareable wizard prefill URL", async () => {
    detail.mockResolvedValue(base("active"));
    renderDetail();
    await screen.findByText("Explainer");
    await screen
      .findByRole("button", { name: "Create with Wizard V2" })
      .then((button) => button.click());
    expect(push).toHaveBeenCalledWith(
      "/hwar/create/v2?contentFormatId=format-1",
    );
  });
  it("explains why draft and archived formats cannot create projects", async () => {
    detail.mockResolvedValue(base("draft"));
    const { unmount } = renderDetail();
    expect(
      await screen.findByText(
        "Activate this format before creating projects from it.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create with Wizard V2" }),
    ).not.toBeInTheDocument();
    unmount();
    detail.mockResolvedValue(base("archived"));
    renderDetail();
    expect(
      await screen.findByText(
        "Archived formats cannot be used for new projects.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create with Wizard V2" }),
    ).not.toBeInTheDocument();
  });
});
