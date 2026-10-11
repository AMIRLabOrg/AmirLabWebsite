import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { getPublicCacheConfig } from "@/lib/cache-config.mjs";

export async function POST(request: Request) {
  const secret = process.env.PUBLIC_CACHE_REVALIDATION_SECRET?.trim();
  if (!secret || secret.length < 32) return new Response(null, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401 });
  }
  const config = getPublicCacheConfig();
  if (config.enabled) {
    revalidateTag(config.tag, { expire: 0 });
    revalidatePath("/", "layout");
  }
  return Response.json(
    { revalidated: config.enabled },
    { headers: { "Cache-Control": "no-store" } },
  );
}
