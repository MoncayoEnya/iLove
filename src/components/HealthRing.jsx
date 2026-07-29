// Circular progress ring for the relationship health score. Uses
// `currentColor` + Tailwind text-color classes for both the track and the
// arc, so it automatically follows the active accent palette/theme without
// needing its own color props.
export default function HealthRing({ score, size = 72, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90 flex-shrink-0"
      role="img"
      aria-label={`Relationship health ${clamped}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        stroke="currentColor"
        className="text-white/35"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-plumdeep transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}
