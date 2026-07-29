export default function Loading() {
  return (
    <main className="relative min-h-screen bg-ink flex items-center justify-center overflow-hidden">
      {/* Girih pattern */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="girih-load" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40,6 L44,34 L74,26 L50,40 L74,66 L40,54 L6,66 L30,40 L6,26 L36,34 Z" fill="none" stroke="#d4af37" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#girih-load)" />
        </svg>
      </div>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-gold/[0.06] blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Rotating 8-point star */}
        <div className="relative h-20 w-20 animate-spin-slow">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <path
              d="M50,5 L58,30 L82,18 L70,42 L95,50 L70,58 L82,82 L58,70 L50,95 L42,70 L18,82 L30,58 L5,50 L30,42 L18,18 L42,30 Z"
              fill="none"
              stroke="#d4af37"
              strokeWidth="1.5"
              className="drop-shadow-[0_0_6px_rgba(212,175,55,0.3)]"
            />
            <circle cx="50" cy="50" r="20" fill="none" stroke="#d4af37" strokeWidth="0.5" opacity="0.3" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#d4af37" strokeWidth="0.3" opacity="0.15" />
          </svg>
        </div>

        {/* Shimmer text */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
          <span className="text-gold/60 text-xs uppercase tracking-[0.3em] font-medium">
            Loading
          </span>
          <div className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: "0.2s" }} />
        </div>
      </div>
    </main>
  );
}
