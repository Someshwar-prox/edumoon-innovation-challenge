// Small SVG primitives we render inline so we don't pull in extra deps.
export function GoogleLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <path
        d="M9 20V12M9 12L13 16L9 20ZM23 12V20M23 20L19 16L23 20Z"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3" fill="white" />
    </svg>
  );
}

// AIBridge brand mark — uses /logo.png (the actual smaller logo).
import Image from 'next/image'

export function BrandMark({
  size = 40,
  className = '',
  priority = false,
}: {
  size?: number
  className?: string
  priority?: boolean
}) {
  // Render at 2× to keep it crisp on retina/high-DPI displays.
  const renderSize = Math.round(size * 2)
  return (
    <Image
      src="/logo.png"
      alt="AIBridge"
      width={renderSize}
      height={renderSize}
      quality={75}
      unoptimized={false}
      priority={priority}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
