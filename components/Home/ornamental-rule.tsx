// A running diamond border, like the thin gold marginal rule at the top of
// an illuminated Qur'an manuscript page. A single repeating shape, tiled
// horizontally — no risk of a tessellation seam since it only repeats in
// one direction.
export function OrnamentalRule() {
  return (
    <svg aria-hidden="true" className="block h-[6px] w-full">
      <defs>
        <pattern id="rule-diamonds" width="18" height="6" patternUnits="userSpaceOnUse">
          <path
            d="M9 0 L13 3 L9 6 L5 3 Z"
            fill="none"
            stroke="#c49f4f"
            strokeOpacity="0.55"
            strokeWidth="0.75"
          />
        </pattern>
      </defs>
      <rect width="100%" height="6" fill="url(#rule-diamonds)" />
    </svg>
  );
}
