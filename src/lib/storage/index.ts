import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * File/object storage abstraction. **Server-only.**
 *
 * Binary files are NEVER stored in MongoDB (no Buffer, no base64 in a document). The
 * DB keeps only metadata + a `storageKey`; the bytes live behind this interface.
 *
 * PRODUCTION: implement {@link FileStorage} over an object store (S3 / GCS / Azure
 * Blob / R2) and return it from {@link getStorage}. Nothing else changes — callers
 * depend only on the interface.
 *
 * DEVELOPMENT: the default {@link LocalDiskStorage} writes under
 * `FILE_STORAGE_DIR` (or `<cwd>/.local/storage`), which is git-ignored. It is a dev
 * convenience only — not for multi-instance production.
 */
export interface FileStorage {
  readonly kind: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

/** Reject path-traversal / absolute keys — keys are always relative, "/"-separated. */
function assertSafeKey(key: string): void {
  if (!key || key.startsWith("/") || key.includes("..") || path.isAbsolute(key)) {
    throw new Error("invalid storage key");
  }
}

class LocalDiskStorage implements FileStorage {
  readonly kind = "local-disk";
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    return path.join(this.root, ...key.split("/"));
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      /* already gone — treat delete as idempotent */
    }
  }
}

let cached: FileStorage | null = null;

/** The configured storage backend. Swap the implementation here for production. */
export function getStorage(): FileStorage {
  if (cached) return cached;
  const root = (process.env.FILE_STORAGE_DIR ?? "").trim() || path.join(process.cwd(), ".local", "storage");
  cached = new LocalDiskStorage(root);
  return cached;
}
