import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./public-cache", () => ({
  publicJson: vi.fn().mockResolvedValue([]),
  PublicApiError: class extends Error {},
}));

import { connection } from "next/server";
import { publicJson } from "./public-cache";
import { getPublicStats, getResearch } from "./api";

test("homepage research requests only its three displayed papers", async () => {
  await getResearch("PAPER", 3);
  expect(publicJson).toHaveBeenLastCalledWith(
    "/research?type=PAPER&limit=3",
    false,
  );
});

test("live statistics stay outside the prerender while retaining their data cache", async () => {
  vi.mocked(connection).mockClear();
  vi.mocked(publicJson).mockClear();
  await getPublicStats();
  expect(connection).toHaveBeenCalledOnce();
  expect(publicJson).toHaveBeenCalledWith("/stats", false, 60);
  expect(vi.mocked(connection).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(publicJson).mock.invocationCallOrder[0],
  );
});
