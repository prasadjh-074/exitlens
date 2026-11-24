export function Mark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="mark">
      <rect width="36" height="36" rx="10" fill="#b69afb" />
      <g
        fill="none"
        stroke="#21182e"
        strokeWidth="2.8"
        transform="rotate(-33 18 18)"
      >
        <ellipse cx="15" cy="18" rx="8" ry="10.5" />
        <ellipse cx="21" cy="18" rx="8" ry="10.5" />
      </g>
    </svg>
  )
}
export function Optics() {
  return (
    <svg
      className="optics"
      viewBox="0 0 390 175"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="glass"
          x1="0"
          y1="0"
          x2="1"
          y2=".85"
          gradientUnits="objectBoundingBox"
        >
          <stop stopColor="#dbbdff" stopOpacity=".6" />
          <stop offset=".35" stopColor="#8c65d4" stopOpacity=".09" />
          <stop offset=".68" stopColor="#b794fd" stopOpacity=".3" />
          <stop offset="1" stopColor="#8560bc" stopOpacity=".09" />
        </linearGradient>
        <linearGradient id="rim">
          <stop stopColor="#e9d9ff" />
          <stop offset=".45" stopColor="#b79dde" />
          <stop offset="1" stopColor="#72568f" />
        </linearGradient>
        <pattern id="grid" width="15" height="15" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#b29abb" opacity=".35" />
        </pattern>
      </defs>
      <rect width="390" height="175" fill="url(#grid)" />
      <g transform="rotate(26 200 90)">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={'translate(' + i * 22 + ',' + -i * 5 + ')'}>
            <ellipse
              cx="146"
              cy="100"
              rx="29"
              ry="74"
              fill="url(#glass)"
              stroke="url(#rim)"
              strokeWidth={i === 4 ? 2.2 : 1.2}
            />
            <ellipse
              cx="149"
              cy="100"
              rx="29"
              ry="74"
              stroke="#b7a2d0"
              opacity=".55"
            />
            <ellipse
              cx="149"
              cy="100"
              rx="22"
              ry="58"
              stroke="#d8bafb"
              opacity=".54"
            />
          </g>
        ))}
      </g>
    </svg>
  )
}
