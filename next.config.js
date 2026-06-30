/** @type {import('next').NextConfig} */
module.exports = {
  /**
   * WebCodecs does NOT require SharedArrayBuffer, so COOP/COEP headers
   * are no longer needed.  Clean config — nothing special required.
   *
   * If you ever re-enable ffmpeg.wasm as a fallback for Firefox, restore:
   *
   *   async headers() {
   *     return [{ source: "/(.*)", headers: [
   *       { key: "Cross-Origin-Opener-Policy",  value: "same-origin"  },
   *       { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
   *     ]}];
   *   },
   */
};
