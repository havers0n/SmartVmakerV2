import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscoveryRunPage from "@/app/discovery/runs/[runId]/page";
import { AddToContentFormatDialog } from "@/features/discovery-content-formats/add-to-content-format-dialog";
import { ContentFormatsApiError, contentFormatsApi } from "./api";

const draft = { id: "format-draft", name: "Draft format", slug: "draft-format", status: "draft" as const, formatType: "short_form", description: "Draft", updatedAt: "2026-01-01" };
const active = { ...draft, id: "format-active", name: "Active format", status: "active" as const };
const archived = { ...draft, id: "format-archived", name: "Archived format", status: "archived" as const };
const videos = (count = 2) => Array.from({ length: count }, (_, index) => ({
  videoId: index === 0 ? "video-a-uuid" : index === 1 ? "video-b-uuid" : `video-${index}-uuid`,
  youtubeId: index === 0 ? "youtube-a" : index === 1 ? "youtube-b" : `youtube-${index}`,
  query: "query", searchOrder: "relevance", resultPosition: index + 1, title: `Video ${index + 1}`,
  channelTitle: "Channel", viewCount: 10, publishedAt: "2026-01-01",
}));

function renderUi(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function renderDialog(props: Partial<React.ComponentProps<typeof AddToContentFormatDialog>> = {}) {
  const onAttached = vi.fn();
  const onOpenChange = vi.fn();
  const rendered = renderUi(<AddToContentFormatDialog open onOpenChange={onOpenChange} runId="current-run-id" selectedVideoIds={new Set(["video-a-uuid", "video-b-uuid"])} onAttached={onAttached} {...props} />);
  return { onAttached, onOpenChange, ...rendered };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(contentFormatsApi, "list").mockResolvedValue([
    { format: draft, videoCount: 1, channelCount: 0, evidenceCount: 0 },
    { format: active, videoCount: 2, channelCount: 0, evidenceCount: 0 },
    { format: archived, videoCount: 3, channelCount: 0, evidenceCount: 0 },
  ]);
});

describe("Discovery bulk Content Format dialog", () => {
  it("shows draft and active picker entries, filters archived entries, searches, and marks the selected format", async () => {
    renderDialog();
    expect(await screen.findByText("Draft format")).toBeInTheDocument();
    expect(screen.getByText("Active format")).toBeInTheDocument();
    expect(screen.queryByText("Archived format")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search formats"), "active");
    expect(screen.queryByText("Draft format")).not.toBeInTheDocument();
    const picker = screen.getByRole("radio", { name: /Active format/ });
    await userEvent.click(picker);
    expect(picker).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Association role" })).toHaveValue("supporting");
  });

  it("renders loading, empty, and retryable picker errors", async () => {
    const list = vi.spyOn(contentFormatsApi, "list").mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderDialog();
    expect(await screen.findByText(/Loading content formats/)).toBeInTheDocument();
    unmount();
    list.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("down"));
    renderDialog();
    expect(await screen.findByText(/No draft or active Content Formats match/)).toBeInTheDocument();
  });

  it("sends only internal video IDs in the existing-format bulk payload and invalidates format queries on success", async () => {
    const attach = vi.spyOn(contentFormatsApi, "bulkAttachVideos").mockResolvedValue({ attachedVideoIds: ["video-a-uuid", "video-b-uuid"] });
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const { onAttached } = renderDialog();
    await userEvent.click(await screen.findByRole("radio", { name: /Draft format/ }));
    await userEvent.selectOptions(screen.getByLabelText("Association role"), "exemplar");
    await userEvent.click(screen.getByRole("button", { name: "Add videos" }));
    await waitFor(() => expect(attach).toHaveBeenCalledWith("format-draft", {
      videoIds: ["video-a-uuid", "video-b-uuid"], role: "exemplar", source: "discovery", discoveryRunId: "current-run-id",
    }));
    expect(attach.mock.calls[0][1]).not.toHaveProperty("youtubeId");
    expect(attach.mock.calls[0][1]).not.toHaveProperty("evidence");
    expect(attach.mock.calls[0][1]).not.toHaveProperty("channelId");
    expect(attach.mock.calls[0][1]).not.toHaveProperty("activate");
    expect(onAttached).toHaveBeenCalledOnce();
    expect(await screen.findByRole("link", { name: "Open Content Format" })).toHaveAttribute("href", "/content-formats/format-draft");
    expect(screen.getByText(/Existing associations were preserved/)).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["content-formats"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["content-format", "format-draft"] });
  });

  it("creates a draft with allowed fields, then attaches its videos without activation", async () => {
    const create = vi.spyOn(contentFormatsApi, "create").mockResolvedValue({ ...draft, id: "new-format-id", name: "New format" });
    const attach = vi.spyOn(contentFormatsApi, "bulkAttachVideos").mockResolvedValue({ attachedVideoIds: ["video-a-uuid", "video-b-uuid"] });
    const activate = vi.spyOn(contentFormatsApi, "activate");
    const { onAttached } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "New Format" }));
    expect(screen.getByRole("button", { name: "Create draft and add videos" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Name"), "New format");
    await userEvent.selectOptions(screen.getByLabelText("Format type"), "mixed");
    await userEvent.selectOptions(screen.getByLabelText("Association role"), "counterexample");
    await userEvent.click(screen.getByRole("button", { name: "Create draft and add videos" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: "New format", formatType: "mixed", description: undefined }));
    expect(create.mock.calls[0][0]).not.toHaveProperty("status");
    await waitFor(() => expect(attach).toHaveBeenCalledWith("new-format-id", {
      videoIds: ["video-a-uuid", "video-b-uuid"], role: "counterexample", source: "discovery", discoveryRunId: "current-run-id",
    }));
    expect(activate).not.toHaveBeenCalled();
    expect(onAttached).toHaveBeenCalledOnce();
    expect(await screen.findByRole("link", { name: "Open Content Format" })).toHaveAttribute("href", "/content-formats/new-format-id");
  });

  it("preserves the created draft and selection after attach failure, then retries only the attachment", async () => {
    const create = vi.spyOn(contentFormatsApi, "create").mockResolvedValue({ ...draft, id: "new-format-id", name: "Retry format" });
    const attach = vi.spyOn(contentFormatsApi, "bulkAttachVideos")
      .mockRejectedValueOnce(new ContentFormatsApiError("database connection password=secret", 500))
      .mockResolvedValueOnce({ attachedVideoIds: ["video-a-uuid", "video-b-uuid"] });
    const { onAttached } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "New Format" }));
    await userEvent.type(screen.getByLabelText("Name"), "Retry format");
    await userEvent.click(screen.getByRole("button", { name: "Create draft and add videos" }));
    expect(await screen.findByText(/Content Format was created, but videos were not attached/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open created draft" })).toHaveAttribute("href", "/content-formats/new-format-id");
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
    expect(onAttached).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry attaching videos" }));
    await waitFor(() => expect(attach).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenCalledTimes(1);
    expect(onAttached).toHaveBeenCalledOnce();
  });

  it.each([
    [new ContentFormatsApiError("invalid video", 400), /Check the selected videos and fields/],
    [new ContentFormatsApiError("missing", 404), /could not be found/],
    [new ContentFormatsApiError("archived format", 409), /archived format/],
    [new ContentFormatsApiError("not part of this run", 409), /no longer belong to this Discovery run/],
  ])("keeps selection available and gives a safe error for API failures", async (error, expected) => {
    vi.spyOn(contentFormatsApi, "bulkAttachVideos").mockRejectedValue(error);
    renderDialog();
    await userEvent.click(await screen.findByRole("radio", { name: /Draft format/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add videos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText("Add 2 videos to Content Format")).toBeInTheDocument();
  });
});

describe("Discovery page bulk selection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/videos") ? videos() : path.endsWith("/channels") ? [] : path.endsWith("/opportunity") ? { signals: [], risingSmallChannels: [], outlierVideos: [], queryPerformance: [] } : path.endsWith("/candidates") ? [] : { id: path.includes("run-b") ? "run-b" : "run-a", status: "completed", startedAt: null, finishedAt: null, errorMessage: null, videoCount: 2, uniqueChannelCount: 1, aiSummary: null, cancelRequestedAt: null, requestBudget: 0, externalRequestCount: 0 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));
  });

  it("uses internal IDs, supports deselect/clear, and clears when the run changes", async () => {
    const { rerender } = renderUi(<DiscoveryRunPage params={{ runId: "run-a" }} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Videos" }));
    const first = await screen.findByRole("checkbox", { name: "Select Video 1" });
    await userEvent.click(first);
    expect(await screen.findByText("1 videos selected")).toBeInTheDocument();
    await userEvent.click(first);
    expect(screen.queryByText("1 videos selected")).not.toBeInTheDocument();
    await userEvent.click(first);
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(/videos selected/)).not.toBeInTheDocument();
    await userEvent.click(first);
    rerender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DiscoveryRunPage params={{ runId: "run-b" }} /></QueryClientProvider>);
    await userEvent.click(await screen.findByRole("tab", { name: "Videos" }));
    expect(screen.queryByText(/videos selected/)).not.toBeInTheDocument();
  });

  it("selects and clears only the visible page, with duplicate IDs counted once", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/videos") ? [{ ...videos()[0] }, { ...videos()[0], title: "Video duplicate", searchOrder: "date" }, videos()[1]] : path.endsWith("/channels") || path.endsWith("/candidates") ? [] : path.endsWith("/opportunity") ? { signals: [], risingSmallChannels: [], outlierVideos: [], queryPerformance: [] } : { id: "run-a", status: "completed", startedAt: null, finishedAt: null, errorMessage: null, videoCount: 3, uniqueChannelCount: 1, aiSummary: null, cancelRequestedAt: null, requestBudget: 0, externalRequestCount: 0 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    renderUi(<DiscoveryRunPage params={{ runId: "run-a" }} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Videos" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select all videos on this page" }));
    expect(await screen.findByText("2 videos selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all videos on this page" }));
    expect(screen.queryByText(/videos selected/)).not.toBeInTheDocument();
  });

  it("caps current-page selection at 250 unique internal IDs", async () => {
    const manyVideos = videos(251);
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith("/videos") ? manyVideos : path.endsWith("/channels") || path.endsWith("/candidates") ? [] : path.endsWith("/opportunity") ? { signals: [], risingSmallChannels: [], outlierVideos: [], queryPerformance: [] } : { id: "run-a", status: "completed", startedAt: null, finishedAt: null, errorMessage: null, videoCount: 251, uniqueChannelCount: 1, aiSummary: null, cancelRequestedAt: null, requestBudget: 0, externalRequestCount: 0 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    });
    renderUi(<DiscoveryRunPage params={{ runId: "run-a" }} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Videos" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select all videos on this page" }));
    expect(await screen.findByText("250 videos selected")).toBeInTheDocument();
    expect(screen.getByText(/Select up to 250 videos/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Video 251" })).toBeDisabled();
  });
});
