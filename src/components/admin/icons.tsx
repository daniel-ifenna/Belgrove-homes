// Shared inline status glyphs for the admin UI. No emoji anywhere in the
// operations interface: these stroke/fill icons replace every pictograph
// (warnings, locks, checks, stars) with the same 1.6px line language as the
// sidebar icons. All inherit currentColor and default to 12px.

type P = { size?: number; className?: string };

function base(size: number, className: string | undefined, children: React.ReactNode, filled = false) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function WarnIcon({ size = 12, className }: P) {
  return base(size, className, <path d="M12 3 2 20h20z" />);
}

export function WarnTriangle({ size = 12, className }: P) {
  return base(
    size,
    className,
    <>
      <path d="M12 3 2 20h20z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  );
}

export function LockIcon({ size = 12, className }: P) {
  return base(
    size,
    className,
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  );
}

export function CheckIcon({ size = 12, className }: P) {
  return base(size, className, <path d="M4 12.5l5 5L20 6.5" />);
}

export function StarIcon({ size = 12, className }: P) {
  return base(size, className, <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />, true);
}

export function DiamondIcon({ size = 12, className }: P) {
  return base(size, className, <path d="M12 2l7 10-7 10-7-10z" />, true);
}

export function RefreshIcon({ size = 12, className }: P) {
  return base(
    size,
    className,
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 3v4h-4" />
    </>
  );
}

export function DotIcon({ size = 8, className }: P) {
  return base(size, className, <circle cx="12" cy="12" r="6" />, true);
}
