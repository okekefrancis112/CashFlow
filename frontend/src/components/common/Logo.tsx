interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="banana-body" x1="160" y1="120" x2="380" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
        <linearGradient id="banana-shine" x1="200" y1="180" x2="340" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="512" height="512" rx="112" fill="url(#logo-bg)" />
      {/* Banana body — curved crescent */}
      <path
        d="M340 130 C400 180, 420 320, 300 420 C280 436, 250 430, 260 410 C320 320, 300 200, 220 140 C200 124, 180 130, 180 150 C180 110, 310 90, 340 130Z"
        fill="url(#banana-body)"
      />
      {/* Banana highlight — inner shine */}
      <path
        d="M320 160 C370 200, 380 310, 290 390 C310 300, 300 210, 250 165 C270 145, 300 145, 320 160Z"
        fill="url(#banana-shine)"
        opacity="0.6"
      />
      {/* Banana tip */}
      <path
        d="M300 420 C280 436, 250 430, 260 410 C270 415, 290 418, 300 420Z"
        fill="#a16207"
        opacity="0.7"
      />
      {/* Banana stem */}
      <path
        d="M330 132 C335 115, 350 108, 360 115 C355 125, 345 130, 340 130Z"
        fill="#65a30d"
      />
      {/* Dollar sign overlay — money theme */}
      <path
        d="M256 245 L256 235 M256 335 L256 345"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M236 258 C236 246, 276 242, 276 256 C276 270, 236 266, 236 280 C236 294, 276 290, 276 278"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.45"
      />
    </svg>
  );
}
