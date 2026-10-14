/**
 * Responses per user, path and query, kept in the warm Lambda container. The API sends
 * `Cache-Control: private, max-age=<seconds to local midnight>` and an ETag, so an entry is
 * good until midnight and is revalidated (If-None-Match → 304) now and then in between.
 */
export interface CacheEntry {
  etag?: string;
  data: unknown;
  /** When the entry was stored or last confirmed by a 304. */
  checkedAt: number;
  /** Local midnight, from max-age. */
  expiresAt: number;
}

export class ResponseCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string): CacheEntry | undefined {
    return this.entries.get(key);
  }

  set(key: string, entry: CacheEntry): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, entry);
  }

  clear(): void {
    this.entries.clear();
  }
}

export const sharedCache = new ResponseCache();
