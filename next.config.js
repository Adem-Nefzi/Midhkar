/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,
  /* Native/binary deps must stay external — webpack cannot bundle
   * .node binaries or static ffmpeg executables. Rendered at runtime
   * by the /api/render functions.
   * Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages */
  serverExternalPackages: [
    "@napi-rs/canvas",
    "ffmpeg-static",
    "ffprobe-static",
  ],
  /* Runtime-loaded binaries the static tracer misses — force them
   * into the serverless bundle for the routes that spawn them.
   * PLATFORM-SCOPED: Vercel functions are linux/x64 — pulling the
   * full ffmpeg-static/ffprobe-static globs ships every platform's
   * binary (~450MB) and blows the 250MB uncompressed function limit.
   * Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/outputFileTracingIncludes */
  outputFileTracingIncludes: {
    "/api/render/chunk": [
      "./lib/server/server-canvas/fonts/**",
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/index.js",
      "./node_modules/ffmpeg-static/package.json",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./node_modules/ffprobe-static/index.js",
      "./node_modules/ffprobe-static/package.json",
    ],
    "/api/render/finalize": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffmpeg-static/index.js",
      "./node_modules/ffmpeg-static/package.json",
    ],
  },
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
