/** @type {import('next').NextConfig} */
module.exports = {
  // Stops webpack from bundling ffmpeg-static, which breaks its internal
  // __dirname-based binary path resolution (→ the "ffmpeg.exe ENOENT"
  // pointing into .next/server/vendor-chunks instead of node_modules).
  serverExternalPackages: ["ffmpeg-static"],

  // For serverless/standalone deploys: Next's file tracer can't tell that
  // the path string ffmpeg-static returns gets passed to child_process
  // .spawn() later — it only follows actual require()/import calls. Without
  // this, the binary won't be included in the deployed function bundle.
  outputFileTracingIncludes: {
    "/api/generate-video/route": ["./node_modules/ffmpeg-static/**"],
  },
};
