import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  getPublicCacheConfig,
  PUBLIC_CACHE_SCOPES,
} from "@/lib/cache-config.mjs";

export async function POST(request: Request) {
  const secret = process.env.PUBLIC_CACHE_REVALIDATION_SECRET?.trim();
  if (!secret || secret.length < 32) return new Response(null, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401 });
  }
  const config = getPublicCacheConfig();
  let scopes: string[] = ["content"];
  const body = await request.text();
  if (body) {
    try {
      const value = JSON.parse(body);
      if (value.scopes !== undefined) {
        if (
          !Array.isArray(value.scopes) ||
          !value.scopes.length ||
          value.scopes.length > PUBLIC_CACHE_SCOPES.length ||
          !value.scopes.every(
            (scope: unknown) =>
              typeof scope === "string" && PUBLIC_CACHE_SCOPES.includes(scope),
          )
        )
          return new Response(null, { status: 400 });
        scopes = [...new Set<string>(value.scopes)];
      }
    } catch {
      return new Response(null, { status: 400 });
    }
  }
  if (config.enabled) {
    for (const scope of scopes)
      revalidateTag(`${config.namespace}:${scope}`, { expire: 0 });
    if (scopes.includes("content")) revalidatePath("/", "layout");
  }
  return Response.json(
    { revalidated: config.enabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}
