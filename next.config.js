/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  /**
   * WebCodecs does NOT require SharedArrayBuffer, so COOP/COEP headers
   * are intentionally NOT set above. Do not add them.
   *
   * If you ever re-enable ffmpeg.wasm as a fallback for Firefox, restore:
   *
   *   { key: "Cross-Origin-Opener-Policy",  value: "same-origin"  },
   *   { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
   */
};
