/**
 * render-store.ts — chunk storage for the serverless render pipeline.
 *
 * Two backends behind one interface:
 *  - Vercel Blob (production): BLOB_READ_WRITE_TOKEN present. Blob paths
 *    are the only cross-invocation state — every chunk/finalize call may
 *    land on a different function instance.
 *  - Local disk (dev): keeps `next dev` on a laptop fully working with
 *    zero Blob setup.
 */

export interface RenderStore {
  put(path: string, data: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  exists(path: string): Promise<boolean>;
  delete(prefix: string): Promise<void>;
}

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const hasBlob = typeof BLOB_TOKEN === "string" && BLOB_TOKEN.length > 0;

/* ── Vercel Blob backend ─────────────────────────────────────────
 * put/get/head/del + list documented at
 * https://vercel.com/docs/vercel-blob/using-blob-sdk (access required:
 * 'private' — files are delivered only through our routes). */
class BlobStore implements RenderStore {
  async put(path: string, data: Uint8Array): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(path, Buffer.from(data), {
      access: "private",
      addRandomSuffix: false,
      contentType: path.endsWith(".mp4") ? "video/mp4" : "application/octet-stream",
    });
  }

  async get(path: string): Promise<Uint8Array | null> {
    const { get } = await import("@vercel/blob");
    const res = await get(path, { access: "private" });
    if (!res || !res.stream) return null;
    const reader = res.stream.getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }

  async exists(path: string): Promise<boolean> {
    const { head } = await import("@vercel/blob");
    return (await head(path)) !== null;
  }

  async delete(prefix: string): Promise<void> {
    const { list, del } = await import("@vercel/blob");
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      const urls = page.blobs.map((b) => b.url);
      if (urls.length > 0) await del(urls);
      cursor = page.cursor;
    } while (cursor);
  }
}

/* ── Disk backend (dev only) ───────────────────────────────────── */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DISK_ROOT = join(tmpdir(), "midhkar-render");

class DiskStore implements RenderStore {
  async put(path: string, data: Uint8Array): Promise<void> {
    const file = join(DISK_ROOT, path);
    await mkdir(dirnameOf(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(path: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(join(DISK_ROOT, path)));
    } catch {
      return null;
    }
  }

  async exists(path: string): Promise<boolean> {
    return (await this.get(path)) !== null;
  }

  async delete(prefix: string): Promise<void> {
    await rm(join(DISK_ROOT, prefix), { recursive: true, force: true }).catch(
      () => {},
    );
  }
}

function dirnameOf(file: string): string {
  const i = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"));
  return i > 0 ? file.slice(0, i) : file;
}

export const renderStore: RenderStore = hasBlob ? new BlobStore() : new DiskStore();

/* Path scheme — everything lives under `renders/<jobId>/`:
 *   spec.json       the full validated plan (resume + idempotency)
 *   chunk-N.mp4    verse-aligned encoded segments
 *   bg-input.mp4    uploaded background video (upload mode)
 *   final.mp4      concatenated + faststarted output
 */
export const renderPaths = {
  spec: (jobId: string) => `renders/${jobId}/spec.json`,
  chunk: (jobId: string, i: number) => `renders/${jobId}/chunk-${i}.mp4`,
  bgUpload: (jobId: string) => `renders/${jobId}/bg-input.mp4`,
  final: (jobId: string) => `renders/${jobId}/final.mp4`,
};

export function isStoreConfigured(): boolean {
  return hasBlob;
}
