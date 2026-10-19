import { EventEmitter } from "node:events";
import { afterEach, expect, test, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("node:http", () => ({ get, default: { get } }));
vi.mock("node:https", () => ({ get, default: { get } }));
afterEach(() => vi.unstubAllEnvs());

test("cold starts retain valid generations and missed scoped webhooks expire only dependencies", async () => {
  vi.resetModules();
  vi.stubEnv("API_URL", "https://api.example.test/api");
  vi.stubEnv("PUBLIC_CACHE_NAMESPACE", "revision-test");
  vi.stubEnv("PUBLIC_CACHE_ENABLED", "true");
  let scopes = {
    content: "initial",
    people: "one",
    research: "one",
    about: "one",
  };
  get.mockImplementation((_url, _options, callback) => {
    const request = new EventEmitter();
    queueMicrotask(() => {
      const response = Object.assign(new EventEmitter(), {
        statusCode: 200,
        setEncoding() {},
      });
      callback(response);
      response.emit("data", JSON.stringify({ revision: "legacy", scopes }));
      response.emit("end");
    });
    return request;
  });
  const { nativeCache, refreshRevision, revisionTags, tagsCurrent } =
    await import("../../cache-handlers/revision.mjs");
  const people = await revisionTags("/people/member");
  const about = await revisionTags("/site-content/about");
  expect(tagsCurrent(people)).toBe(true);
  expect(await nativeCache.getExpiration(["_N_T_/layout"])).toBe(0);
  expect(await nativeCache.getExpiration(["revision-test:people"])).toBe(0);
  scopes = { ...scopes, people: "two" };
  await refreshRevision();
  expect(tagsCurrent(people)).toBe(false);
  expect(tagsCurrent(about)).toBe(true);
  expect(
    await nativeCache.getExpiration(["revision-test:people"]),
  ).toBeGreaterThan(0);
  expect(await nativeCache.getExpiration(["revision-test:about"])).toBe(0);
  const updated = await revisionTags("/people/member");
  expect(tagsCurrent(updated)).toBe(true);
  expect(tagsCurrent([...people, ...updated])).toBe(false);
  scopes = { ...scopes, content: "reset" };
  await refreshRevision();
  expect(tagsCurrent(updated)).toBe(false);
});
