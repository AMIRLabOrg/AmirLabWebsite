import fileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache.js";
import { refreshRevision, tagsCurrent } from "./revision.mjs";

export default class PublicRouteCache extends fileSystemCache.default {
  async get(key, context) {
    const path = `/${key.split("/$/").at(-1).replace(/^\/+/, "")}`;
    if (
      context.kind === "APP_PAGE" &&
      /^\/(?:$|index$|about(?:\/|$)|people(?:\/|$)|departments(?:\/|$)|papers(?:\/|$)|datasets(?:\/|$)|projects(?:\/|$)|open-positions(?:\/|$))/.test(
        path,
      )
    ) {
      if (!(await refreshRevision())) return null;
      const entry = await super.get(key, context);
      const tags = String(
        entry?.value?.headers?.["x-next-cache-tags"] ?? "",
      ).split(",");
      return tagsCurrent(tags) ? entry : null;
    }
    return super.get(key, context);
  }
}
