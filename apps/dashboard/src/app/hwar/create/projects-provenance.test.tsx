import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { push, listProjects } = vi.hoisted(() => ({
  push: vi.fn(),
  listProjects: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/actions", () => ({
  listProjects,
  ActionHttpError: class ActionHttpError extends Error {},
}));
import CreateIndex from "./page";
const project = {
  id: "project-1",
  title: "Kept title",
  status: "pending",
  createdAt: "2026-01-01",
  scenesCount: 0,
  keyframesCount: 0,
  hasFinalVideo: false,
};
function renderProjects() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CreateIndex />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  push.mockReset();
  listProjects.mockReset();
});
describe("Projects provenance and empty state", () => {
  it("keeps prompt and legacy titles without an empty provenance block", async () => {
    listProjects.mockResolvedValue([
      project,
      { ...project, id: "legacy", title: "Legacy trend", status: "complete" },
    ]);
    renderProjects();
    expect(await screen.findByText("Kept title")).toBeInTheDocument();
    expect(screen.getByText("Legacy trend")).toBeInTheDocument();
    expect(screen.queryByText("Content Format ·")).not.toBeInTheDocument();
  });
  it("renders format, template, both, archived status, and working links", async () => {
    listProjects.mockResolvedValue([
      {
        ...project,
        id: "format",
        contentFormat: {
          id: "cf",
          name: "Explainer",
          slug: "explainer",
          status: "active",
        },
      },
      {
        ...project,
        id: "template",
        storyTemplate: { id: "st", name: "Three beats" },
      },
      {
        ...project,
        id: "both",
        contentFormat: {
          id: "archived",
          name: "Old format",
          slug: "old",
          status: "archived",
        },
        storyTemplate: { id: "st2", name: "Template two" },
      },
    ]);
    renderProjects();
    const formatLink = await screen.findByRole("link", {
      name: "Content Format · Explainer",
    });
    expect(formatLink).toHaveAttribute("href", "/content-formats/cf");
    expect(
      screen.getByText("Story Template · Three beats"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Content Format · Old format · Archived"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Story Template · Template two"),
    ).toBeInTheDocument();
  });
  it("shows canonical empty-state copy and create CTA", async () => {
    listProjects.mockResolvedValue([]);
    renderProjects();
    expect(
      await screen.findByText("Create your first project"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Start from your own prompt, an active Content Format, or a Story Template.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Create Project|New Project/ })
        .length,
    ).toBeGreaterThan(0);
  });
});
