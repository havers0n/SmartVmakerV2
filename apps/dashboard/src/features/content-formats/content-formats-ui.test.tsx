import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentFormatsListPage } from "./list-page";
import { NewContentFormatPage } from "./new-page";
import { ContentFormatDetailPage } from "./detail-page";
import { contentFormatsApi } from "./api";
import { Toaster } from "@/shared/components/ui/toaster";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  useParams: () => ({ id: "format-1" }),
  usePathname: () => "/content-formats",
}));
const format = {
  id: "format-1",
  name: "Explainer",
  slug: "explainer",
  status: "draft" as const,
  formatType: "mixed",
  description: "Useful",
  hookPattern: "Question",
  structurePattern: "Steps",
  updatedAt: "2026-01-01",
};
const detail = (
  status: "draft" | "active" | "archived" = "draft",
  videoCount = 1,
) => ({
  format: { ...format, status },
  counts: { videoCount, channelCount: 1, evidenceCount: 1 },
  videos: [
    {
      association: {
        videoId: "v1",
        role: "supporting",
        source: "manual",
        confidence: "0.8",
        note: "note",
      },
      video: { title: "Video one", youtubeId: "yt1", channelTitle: "Channel" },
    },
  ],
  channels: [
    {
      association: {
        channelId: "c1",
        role: "primary",
        source: "manual",
        confidence: "0.7",
        note: "channel note",
      },
      channel: { title: "Channel one" },
    },
  ],
  evidence: [
    {
      evidence: {
        id: "e1",
        evidenceType: "hook",
        statement: "Claim",
        source: "manual",
        confidence: "0.9",
      },
    },
  ],
});
function renderUi(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      {node}
      <Toaster />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("Content Formats list", () => {
  it("renders loading, cards/counts, filters, retry, and navigation", async () => {
    const list = vi
      .spyOn(contentFormatsApi, "list")
      .mockResolvedValue([
        { format, videoCount: 2, channelCount: 3, evidenceCount: 4 },
      ]);
    renderUi(<ContentFormatsListPage />);
    expect(screen.getByText("Content Formats")).toBeInTheDocument();
    await screen.findByText("Explainer");
    expect(
      screen.getByText(/2 videos · 3 channels · 4 evidence/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /New Content Format/ }),
    ).toHaveAttribute("href", "/content-formats/new");
    expect(screen.getByRole("link", { name: /Explainer/ })).toHaveAttribute(
      "href",
      "/content-formats/format-1",
    );
    await userEvent.type(
      screen.getByLabelText("Search content formats"),
      "test",
    );
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ search: "test", status: "" }),
    );
    fireEvent.change(screen.getByLabelText("Status filter"), {
      target: { value: "archived" },
    });
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        search: "test",
        status: "archived",
      }),
    );
  });
  it("shows empty and error retry states", async () => {
    vi.spyOn(contentFormatsApi, "list")
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("down"));
    const { rerender } = renderUi(<ContentFormatsListPage />);
    expect(
      await screen.findByText("No content formats yet"),
    ).toBeInTheDocument();
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ContentFormatsListPage />
      </QueryClientProvider>,
    );
  });
});
describe("Content Format create", () => {
  it("validates fields and posts backend fields without status before redirect", async () => {
    const create = vi
      .spyOn(contentFormatsApi, "create")
      .mockResolvedValue(format);
    renderUi(<NewContentFormatPage />);
    expect(screen.getByLabelText("Name")).toBeInvalid();
    await userEvent.type(screen.getByLabelText("Name"), "New format");
    fireEvent.change(screen.getByLabelText(/Minimum duration/), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText(/Maximum duration/), {
      target: { value: "10" },
    });
    fireEvent.submit(screen.getByLabelText("Name").closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum duration");
    fireEvent.change(screen.getByLabelText(/Maximum duration/), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).not.toHaveProperty("status");
    expect(push).toHaveBeenCalledWith("/content-formats/format-1");
  });
  it("shows server validation errors", async () => {
    vi.spyOn(contentFormatsApi, "create").mockRejectedValue(
      new Error("Name already exists"),
    );
    renderUi(<NewContentFormatPage />);
    await userEvent.type(screen.getByLabelText("Name"), "Taken");
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("Name already exists")).toBeInTheDocument();
  });
});
describe("Content Format detail and tabs", () => {
  it("supports lifecycle and mutable tabs, and makes archived formats read-only", async () => {
    vi.spyOn(contentFormatsApi, "detail").mockResolvedValue(detail());
    const activate = vi
      .spyOn(contentFormatsApi, "activate")
      .mockResolvedValue({ ...format, status: "active" });
    renderUi(<ContentFormatDetailPage />);
    expect(await screen.findByDisplayValue("Explainer")).toBeEnabled();
    await userEvent.click(screen.getByRole("tab", { name: "Videos" }));
    expect(await screen.findByText("Video one")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Activate" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Activate$/ }),
    );
    await waitFor(() => expect(activate).toHaveBeenCalledWith("format-1"));
  });
  it("shows active notice, disabled activation, archive/restore confirmations, evidence and archived restrictions", async () => {
    vi.spyOn(contentFormatsApi, "detail").mockResolvedValue(detail("active"));
    const archive = vi
      .spyOn(contentFormatsApi, "archive")
      .mockResolvedValue({ ...format, status: "archived" });
    renderUi(<ContentFormatDetailPage />);
    expect(
      await screen.findByText(/Changes apply only to future projects/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Archive$/ }));
    await waitFor(() => expect(archive).toHaveBeenCalled());
  });

  it("keeps every archived detail control read-only while leaving restore available", async () => {
    vi.spyOn(contentFormatsApi, "detail").mockResolvedValue(detail("archived"));
    renderUi(<ContentFormatDetailPage />);
    expect(await screen.findByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Format type")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Activate" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    await userEvent.click(screen.getByRole("tab", { name: "Videos" }));
    expect(
      screen.queryByRole("button", { name: "Detach" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Channels" }));
    expect(screen.queryByLabelText("channels role")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Detach" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(
      screen.queryByRole("button", { name: "Add evidence" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("restores through the feature API, invalidates detail and list, and returns to draft semantics", async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    vi.spyOn(contentFormatsApi, "detail")
      .mockResolvedValueOnce(detail("archived"))
      .mockResolvedValue(detail("draft"));
    const restore = vi
      .spyOn(contentFormatsApi, "restore")
      .mockResolvedValue({ ...format, status: "draft" });
    renderUi(<ContentFormatDetailPage />);
    await screen.findByText("archived");
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Restore$/ }),
    );
    await waitFor(() => expect(restore).toHaveBeenCalledWith("format-1"));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["content-format", "format-1"],
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["content-formats"] });
    expect(await screen.findByText("draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
  });

  it("renders channels and sends draft or active association mutations through the feature API", async () => {
    vi.spyOn(contentFormatsApi, "detail").mockResolvedValue(detail("active"));
    const updateChannel = vi
      .spyOn(contentFormatsApi, "updateChannel")
      .mockResolvedValue(undefined);
    const deleteChannel = vi
      .spyOn(contentFormatsApi, "deleteChannel")
      .mockResolvedValue(undefined);
    renderUi(<ContentFormatDetailPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Channels" }));
    expect(screen.getByText("Channel one")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("channels role"), {
      target: { value: "frequent" },
    });
    await waitFor(() =>
      expect(updateChannel).toHaveBeenCalledWith("format-1", "c1", {
        role: "frequent",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Detach" }));
    await waitFor(() =>
      expect(deleteChannel).toHaveBeenCalledWith("format-1", "c1"),
    );
  });

  it("keeps evidence separate from videos and uses feature API create and delete mutations", async () => {
    vi.spyOn(contentFormatsApi, "detail").mockResolvedValue(detail());
    const createEvidence = vi
      .spyOn(contentFormatsApi, "createEvidence")
      .mockResolvedValue(undefined);
    const deleteEvidence = vi
      .spyOn(contentFormatsApi, "deleteEvidence")
      .mockResolvedValue(undefined);
    renderUi(<ContentFormatDetailPage />);
    await userEvent.click(await screen.findByRole("tab", { name: "Evidence" }));
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.queryByText("Video one")).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Statement"),
      "New supporting claim",
    );
    fireEvent.change(screen.getByLabelText("Evidence type"), {
      target: { value: "structure" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add evidence" }));
    await waitFor(() =>
      expect(createEvidence).toHaveBeenCalledWith("format-1", {
        evidenceType: "structure",
        statement: "New supporting claim",
        videoId: "v1",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(deleteEvidence).toHaveBeenCalledWith("format-1", "e1"),
    );
  });
});
