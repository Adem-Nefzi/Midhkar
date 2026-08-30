/**
 * icons.tsx
 * One drawn icon system: 1.5 stroke, round caps, currentColor.
 * Plus the night-of-sharing marks: ayah marker, shamsa.
 */

type IconProps = { className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ── Ayah-end marker: numbered verse medallion ───────────────── */

/** Symmetric 8-point star (two rotated squares) centered at (0,0). */
function starPoints(cx: number, cy: number, rOuter: number, rInner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`,
    );
  }
  return pts.join(" ");
}

export function AyahMarker({
  value,
  className = "h-9 w-9",
  active = false,
}: {
  value: string | number;
  className?: string;
  active?: boolean;
}) {
  return (
    <span className={`ayah-marker ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <polygon
          points={starPoints(20, 20, 17, 15)}
          transform={active ? "rotate(22.5 20 20)" : undefined}
          fill={active ? "rgba(212,175,55,0.16)" : "rgba(212,175,55,0.05)"}
          stroke="currentColor"
          strokeWidth="1.2"
          className={active ? "text-gold" : "text-gold/40"}
        />
        <circle
          cx="20"
          cy="20"
          r="12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          className={active ? "text-gold/70" : "text-gold/25"}
        />
      </svg>
      <span
        className={`relative z-10 text-[13px] font-semibold tabular-nums ${active ? "text-gold" : "text-gold/60"}`}
      >
        {value}
      </span>
    </span>
  );
}

/* ── Shamsa: sunburst medallion (loading / completion) ───────── */

export function Shamsa({ className = "h-16 w-16" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="14" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="48" cy="48" r="5" fill="currentColor" opacity="0.55" />
      <circle
        cx="48"
        cy="48"
        r="26"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.5"
      />
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 16;
        const r1 = 30;
        const r2 = i % 2 === 0 ? 44 : 37;
        return (
          <line
            key={i}
            x1={48 + Math.cos(a) * r1}
            y1={48 + Math.sin(a) * r1}
            x2={48 + Math.cos(a) * r2}
            y2={48 + Math.sin(a) * r2}
            stroke="currentColor"
            strokeWidth={i % 2 === 0 ? 1.1 : 0.6}
            opacity={i % 2 === 0 ? 0.9 : 0.45}
          />
        );
      })}
    </svg>
  );
}

/* ── Geometric marks ─────────────────────────────────────────── */

export function IslamicStarIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" />
    </svg>
  );
}

export function IslamicDivider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center gap-4 ${className}`}
      aria-hidden="true"
    >
      <div className="h-px w-14 bg-gradient-to-r from-transparent to-gold/45" />
      <IslamicStarIcon className="h-3.5 w-3.5 text-gold/60" />
      <div className="h-px w-14 bg-gradient-to-l from-transparent to-gold/45" />
    </div>
  );
}

export function GeometricRosette({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={1}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4L12 8M12 16L12 20M4 12L8 12M16 12L20 12" />
      <path d="M6.34 6.34L9.17 9.17M14.83 14.83L17.66 17.66M6.34 17.66L9.17 14.83M14.83 9.17L17.66 6.34" />
    </svg>
  );
}

export function Spinner({ className = "h-6 w-6" }: IconProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gold/25 border-t-gold ${className}`}
    />
  );
}

/* ── UI icons ────────────────────────────────────────────────── */

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

export function PlayIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function DownloadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 4h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

export function FilmIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  );
}

export function TypeIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M5 7V5h14v2M12 5v14m-3 0h6" />
    </svg>
  );
}

export function SparklesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  );
}

export function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l-4 4m4-4l4 4" />
    </svg>
  );
}

export function LibraryIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function PaletteIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 100 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3c2 0 3.7-1.7 3.7-3.7C21 6.3 16.9 3 12 3z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ResetIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M4 10a8 8 0 0114-3.5M20 14a8 8 0 01-14 3.5" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}

export function MicIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
    </svg>
  );
}

export function AudioWaveIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}

export function TimerIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </svg>
  );
}

export function VideoCameraIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      {...stroke}
      aria-hidden="true"
    >
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
    </svg>
  );
}

/* ── Platform logos (brand marks, filled) ────────────────────── */

export function YoutubeLogo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
    </svg>
  );
}

export function InstagramLogo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7.1 0h9.8c2.03.04 3.25.18 4.32 1.25s1.21 2.29 1.25 4.32c.06 1.08.08 1.5.08 4.43v4c0 2.93-.02 3.35-.08 4.43-.04 2.03-.18 3.25-1.25 4.32s-2.29 1.21-4.32 1.25c-1.08.06-1.5.08-4.43.08h-4c-2.93 0-3.35-.02-4.43-.08-2.03-.04-3.25-.18-4.32-1.25S.21 20.46.07 18.43C.01 17.15 0 16.74 0 13.48v-2.96c0-3.26.01-3.67.07-4.95C.21 3.54.41 2.32 1.48 1.25S3.7.04 5.73 0H7.1Zm4.9 2.16c-3.2 0-3.58.01-4.85.07-1.2.05-1.85.26-2.28.48-.57.26-1 .59-1.43 1.02-.43.43-.76.86-1.02 1.43-.22.43-.43 1.08-.48 2.28-.06 1.27-.07 1.65-.07 4.85s.01 3.58.07 4.85c.05 1.2.26 1.85.48 2.28.26.57.59 1 1.02 1.43.43.43.86.76 1.43 1.02.43.22 1.08.43 2.28.48 1.27.06 1.65.07 4.85.07s3.58-.01 4.85-.07c1.2-.05 1.85-.26 2.28-.48.57-.26 1-.59 1.43-1.02.43-.43.76-.86 1.02-1.43.22-.43.43-1.08.48-2.28.06-1.27.07-1.65.07-4.85s-.01-3.58-.07-4.85c-.05-1.2-.26-1.85-.48-2.28-.26-.57-.59-1-1.02-1.43-.43-.43-.86-.76-1.43-1.02-.43-.22-1.08-.43-2.28-.48-1.27-.06-1.65-.07-4.85-.07Zm0 3.68A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-10.41a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z" />
    </svg>
  );
}

export function TikTokLogo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.6 5.82a5.62 5.62 0 0 1-1.3-2.88h-2.72v11.47a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6.05.87.13V8.87a5.8 5.8 0 0 0-.87-.07A5.7 5.7 0 1 0 15.4 14V8.15a8.25 8.25 0 0 0 4.6 1.4V6.8a5.63 5.63 0 0 1-3.4-.98Z" />
    </svg>
  );
}

export function FacebookLogo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

export function LandscapeLogo({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M8 15l3.2-3.2 2.1 2.1 1.7-1.7L19 16" />
      <circle cx="8" cy="9" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
