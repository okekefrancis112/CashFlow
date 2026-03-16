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
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="arc1" x1="120" y1="140" x2="380" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="arc2" x1="380" y1="340" x2="120" y2="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="512" height="512" rx="108" fill="url(#logo-bg)" />
      {/* Upper arc */}
      <path
        d="M148 188 C190 130, 300 110, 370 160"
        stroke="url(#arc1)"
        strokeWidth="28"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lower arc */}
      <path
        d="M364 324 C322 382, 212 402, 142 352"
        stroke="url(#arc2)"
        strokeWidth="28"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dollar sign — vertical stroke */}
      <line x1="256" y1="195" x2="256" y2="317" stroke="white" strokeWidth="12" strokeLinecap="round" />
      {/* Dollar sign — S curve */}
      <path
        d="M222 228 C222 208, 290 206, 290 228 C290 250, 222 248, 222 272 C222 296, 290 294, 290 274"
        stroke="white"
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
