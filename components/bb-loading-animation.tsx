export default function BBLoadingAnimation() {
  return (
    <svg
      className="bb-loading-animation"
      viewBox="0 0 640 640"
      aria-hidden="true"
    >
      <path
        className="bb-loader-body"
        d="M244 108 Q244 92 260 92 H380 Q396 92 396 108 V230 Q396 246 380 256 L340 278 V298 H300 V278 L260 256 Q244 246 244 230Z"
      />
      <g className="bb-plunger">
        <path d="M307 48 H333 V94 H307Z" />
        <rect x="283" y="34" width="74" height="18" rx="5" />
      </g>
      <g className="bb-magazine">
        <path d="M289 354 H351 L356 410 Q363 467 393 529 Q396 537 387 540 L319 565 Q312 568 307 559 Q276 490 276 425 V368 Q276 354 289 354Z" />
        <rect x="284" y="346" width="68" height="14" rx="3" />
      </g>
      <g className="bb-falling-bbs">
        <circle className="bb-falling-bb" cx="320" cy="293" r="6" />
        <circle
          className="bb-falling-bb bb-falling-bb-delayed"
          cx="320"
          cy="293"
          r="6"
        />
      </g>
    </svg>
  );
}
