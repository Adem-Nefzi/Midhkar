/** @type {import('next').NextConfig} */
module.exports = {
  // No special config needed — @ffmpeg/ffmpeg loads WASM from CDN at runtime.
  // It uses single-threaded mode when SharedArrayBuffer is unavailable.
};
