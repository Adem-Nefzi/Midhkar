/**
 * dom.d.ts — the vendored canva-utils/islamic-patterns code references
 * browser DOM canvas types. Under @napi-rs/canvas the runtime objects
 * are napi SKRSContext2D/SkCanvas, structurally compatible. Alias them.
 */
import type { SKRSContext2D, SkCanvas, Canvas as NapiCanvas } from "@napi-rs/canvas";

declare global {
  type CanvasRenderingContext2D = SKRSContext2D;
  type CanvasGradient = import("@napi-rs/canvas").SkGradient;
  type CanvasImageSource = import("@napi-rs/canvas").SkImage | NapiCanvas;
  type HTMLCanvasElement = SkCanvas & NapiCanvas;
  type HTMLVideoElement = object;
  type OffscreenCanvas = NapiCanvas;
}
