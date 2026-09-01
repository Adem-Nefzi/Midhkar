/**
 * render-store.ts â€” chunk storage for the serverless render pipeline.
 *
 * Two backends behind one interface:
 *  - Vercel Blob (production): OIDC pair (VERCEL_OIDC_TOKEN +
 *    BLOB_STORE_ID) or legacy BLOB_READ_WRITE_TOKEN. Blob paths are
 *    the only cross-invocation state â€” every chunk/finalize call may
 *    land on a different function instance.
 *  - Local disk (dev): keeps `next dev` on a laptop fully working
 *    with zero Blob setup.
 *
 * Backend selection is LAZY (per-call): Next inlines process.env at
 * build time for vars present during `next build`, but
 * VERCEL_OIDC_TOKEN is injected at RUNTIME on Vercel â€” a module-load
 * check would freeze the wrong answer into the bundle.
 */

export interface RenderStore {
  put(path: string, data: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  exists(path: string): Promise<boolean>;
  delete(prefix: string): Promise<void>;
}

/* Blob is configured via EITHER the classic read-write token OR the
 * newer OIDC pair. Either means: use Blob. Evaluated lazily on every
 * call â€” Next inlines build-time env vars, but VERCEL_OIDC_TOKEN is
 * runtime-injected on Vercel (functions receive it as the
 * x-vercel-oidc-token request HEADER; the SDK resolves it per call).
 *
 * In Vercel Functions process.env.VERCEL_OIDC_TOKEN is empty â€” the
 * token arrives via request context â€” so there, BLOB_STORE_ID alone
 * (a project env var present iff a store is connected) is the signal.
 * Locally, env-pulled VERCEL_* vars can't be trusted to discriminate
 * dev-vs-deployed, so we PROBE the store once per instance: a cheap
 * head() that returns not_found proves credentials+store are live. */
function blobEnvConfigured(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (typeof token === "string" && token.length > 0) return true;
  const store = process.env.BLOB_STORE_ID;
  if (typeof store !== "string" || store.length === 0) return false;
  const oidc = process.env.VERCEL_OIDC_TOKEN;
  return typeof oidc === "string" && oidc.length > 0;
}

/* Probe result cached per lambda instance (module scope). */
let blobProbe: Promise<boolean> | null = null;
async function blobProbeOnce(): Promise<boolean> {
  if (!blobProbe) {
    blobProbe = (async () => {
      try {
        const { head } = await import("@vercel/blob");
        await head("renders/probe-store-availability");
        return true; /* exists â€” fine, still proves auth works */
      } catch (err) {
        if (err instanceof Error) {
          const name = err.constructor?.name ?? "";
          if (name === "BlobNotFoundError") return true;
          if (name === "BlobAccessError" || name === "BlobOidcEnvironmentNotAllowedError") return false;
          if (name === "BlobStoreNotFoundError" || name === "BlobError") return false;
        }
        return false; /* unknown auth/store failure â€” disk is safer */
      }
    })();
  }
  return blobProbe;
}

async function shouldUseBlob(): Promise<boolean> {
  if (blobEnvConfigured()) return true;
  const store = process.env.BLOB_STORE_ID;
  if (typeof store === "string" && store.length > 0) {
    return blobProbeOnce();
  }
  return false;
}

/* â”€â”€ Vercel Blob backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * put/get/head/del + list documented at
 * https://vercel.com/docs/vercel-blob/using-blob-sdk (access required:
 * 'private' â€” files are delivered only through our routes). */
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
    /* head() throws BlobNotFoundError when missing â€” it never returns
     * null (only get() does). Verify + treat not_found as false. */
    const { head, BlobNotFoundError } = await import("@vercel/blob");
    try {
      await head(path);
      return true;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return false;
      const code = (err as { code?: string }).code;
      if (code === "not_found" || code === "forbidden") return false;
      throw err;
    }
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

/* â”€â”€ Disk backend (dev only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

const blobStore = new BlobStore();
const diskStore = new DiskStore();

/* Lazily resolved per call â€” see header note. Method access returns a
 * bound method of the backend chosen for THIS call. */
export const renderStore: RenderStore = new Proxy({} as RenderStore, {
  get(_t, prop: keyof RenderStore) {
    return async (...args: unknown[]) => {
      const backend = (await shouldUseBlob()) ? blobStore : diskStore;
      const method = backend[prop] as (...a: unknown[]) => unknown;
      return method.apply(backend, args);
    };
  },
});

/* Path scheme â€” everything lives under `renders/<jobId>/`:
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

/* Awaitable for routes that need to know the backend (cron cleanup). */
export async function isStoreConfigured(): Promise<boolean> {
  return shouldUseBlob();
}
