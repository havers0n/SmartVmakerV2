import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as list, POST as create } from "./route";
import { GET as listQueries, POST as createQuery } from "./[id]/queries/route";
import { PATCH as updateQuery } from "../niche-queries/[id]/route";
import {
  createNiche,
  createNicheQuery,
  getNiche,
  listNicheQueries,
  listNiches,
  updateNicheQuery,
} from "@/server/niches";

vi.mock("@/server/niches", () => ({
  createNiche: vi.fn(),
  createNicheQuery: vi.fn(),
  getNiche: vi.fn(),
  listNicheQueries: vi.fn(),
  listNiches: vi.fn(),
  updateNicheQuery: vi.fn(),
}));

const context = { params: { id: "550e8400-e29b-41d4-a716-446655440000" } };

describe("niche API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists niches", async () => {
    vi.mocked(listNiches).mockResolvedValue([
      { id: context.params.id, name: "BeamNG.drive" },
    ] as never);
    const response = await list();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: context.params.id, name: "BeamNG.drive" },
    ]);
  });

  it("creates a niche", async () => {
    vi.mocked(createNiche).mockResolvedValue({
      id: context.params.id,
      name: "Racing",
    } as never);
    const response = await create(
      new Request("http://localhost/api/niches", {
        method: "POST",
        body: JSON.stringify({ name: "Racing", slug: "racing" }),
      }),
    );
    expect(response.status).toBe(201);
  });

  it("lists and creates queries for an existing niche", async () => {
    vi.mocked(getNiche).mockResolvedValue({ id: context.params.id } as never);
    vi.mocked(listNicheQueries).mockResolvedValue([
      { id: "query-1", query: "BeamNG.drive" },
    ] as never);
    const getResponse = await listQueries(
      new Request("http://localhost"),
      context,
    );
    expect(await getResponse.json()).toHaveLength(1);

    vi.mocked(createNicheQuery).mockResolvedValue({
      id: "query-2",
      query: "BeamNG shorts",
    } as never);
    const postResponse = await createQuery(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ query: "BeamNG shorts" }),
      }),
      context,
    );
    expect(postResponse.status).toBe(201);
  });

  it("updates a query", async () => {
    vi.mocked(updateNicheQuery).mockResolvedValue({
      id: context.params.id,
      isEnabled: false,
    } as never);
    const response = await updateQuery(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ isEnabled: false }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isEnabled: false });
  });
});
