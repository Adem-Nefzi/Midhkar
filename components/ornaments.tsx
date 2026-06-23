export function GirihStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-42 -42 84 84"
      className={className ?? "h-full w-full"}
      fill="none"
    >
      <polygon
        points="0,-40 11.7,-28.3 28.3,-28.3 28.3,-11.7 40,0 28.3,11.7 28.3,28.3 11.7,28.3 0,40 -11.7,28.3 -28.3,28.3 -28.3,11.7 -40,0 -28.3,-11.7 -28.3,-28.3 -11.7,-28.3"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
