import fileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache.js";
import { refreshRevision } from "./revision.mjs";

export default class PublicRouteCache extends fileSystemCache.default {
  async get(key, context) {
    if (
      context.kind === "APP_PAGE" &&
      /^\/(?:$|index$|about(?:\/|$)|people(?:\/|$)|departments(?:\/|$)|papers(?:\/|$)|datasets(?:\/|$)|projects(?:\/|$)|open-positions(?:\/|$))/.test(
        key,
      )
    ) {
      if (!(await refreshRevision())) return null;
    }
    return super.get(key, context);
  }
}
