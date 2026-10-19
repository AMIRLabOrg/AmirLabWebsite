import { nativeCache, refreshRevision, tagsCurrent } from "./revision.mjs";

const handler = {
  ...nativeCache,
  async set(key, pendingEntry) {
    const entry = await pendingEntry;
    // Next retains expire:0 fills in dev; transient failures must not linger.
    if (entry.expire === 0) return;
    return nativeCache.set(key, Promise.resolve(entry));
  },
  async getExpiration(tags) {
    if (!(await refreshRevision())) return Date.now();
    return nativeCache.getExpiration(tags);
  },
  async get(key, softTags) {
    if (!(await refreshRevision())) return undefined;
    const entry = await nativeCache.get(key, softTags);
    return entry && tagsCurrent(entry.tags) ? entry : undefined;
  },
};

export default handler;
