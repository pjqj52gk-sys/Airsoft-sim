export default function BBLoadingAnimation() {
  return (
    <svg
      className="bb-loading-animation"
      viewBox="0 0 280 285"
      aria-hidden="true"
    >
      <ellipse cx="140" cy="272" rx="64" ry="6" fill="#e8f3f9" />
      <g className="bb-plunger">
        <rect x="124" y="7" width="7" height="37" rx="2" fill="#7b8790" />
        <rect x="111" y="4" width="33" height="8" rx="2" fill="#28343c" />
        <path d="M128 12V39" stroke="#d1dce4" strokeWidth="1.5" />
      </g>
      <path
        d="M97 40L145 35Q153 35 155 44L159 137Q159 149 148 151L98 153Q91 153 91 145L88 50Q88 42 97 40Z"
        fill="#253139"
        stroke="#111e27"
        strokeWidth="2"
      />
      <path
        d="M94 48L98 143M149 44L153 139"
        stroke="#53636e"
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M122 64L111 91L122 120L130 89Z" fill="#8999a5" />
      <path d="M122 64V119L130 89Z" fill="#566976" />
      {[64, 81, 98, 115, 132].map((y) => (
        <circle key={y} cx="141" cy={y} r="3" fill="#1a252d" stroke="#3b4b57" />
      ))}
      <path d="M97 151H111V158H97Z" fill="#202d36" />
      <path d="M99 158H109V167H99Z" fill="#586e7c" />
      <g className="bb-transfer">
        <circle cx="104" cy="166" r="3.3" fill="#38bdf8" />
        <circle cx="104" cy="157" r="3.3" fill="#9be0fa" />
      </g>
      <g transform="rotate(-10 129 220)">
        <path
          d="M103 182H145L151 265H105Z"
          fill="#9caab5"
          stroke="#566c7c"
          strokeWidth="2"
        />
        <path
          d="M104 182L111 172H125L128 184H145V193H103Z"
          fill="#c7d3dc"
          stroke="#566c7c"
          strokeWidth="2"
        />
        <path
          d="M113 173L116 181H122L120 173M132 177H144V185H132Z"
          fill="#354b5b"
        />
        <path d="M108 195H113L120 255H114Z" fill="#405968" />
        <path d="M118 198H124L131 253H125Z" fill="#d9eef8" />
        <path
          d="M142 197L147 255M131 209H139V222H133Z"
          fill="none"
          stroke="#778d9d"
          strokeWidth="1.5"
        />
        {[203, 221, 239].map((y) => (
          <circle
            key={y}
            cx={135 + (y - 203) * 0.08}
            cy={y}
            r="1.6"
            fill="#405968"
          />
        ))}
        <path
          d="M101 261L151 259L154 268L102 273Z"
          fill="#748b9c"
          stroke="#4b6475"
          strokeWidth="2"
        />
        {[
          [127, 248],
          [126, 237],
          [124, 226],
          [123, 215],
          [121, 204],
        ].map(([x, y], i) => (
          <circle
            key={i}
            className="bb-magazine-bb"
            style={{ animationDelay: `${i * 0.16}s` }}
            cx={x}
            cy={y}
            r="2.6"
            fill="#38bdf8"
          />
        ))}
      </g>
    </svg>
  );
}
