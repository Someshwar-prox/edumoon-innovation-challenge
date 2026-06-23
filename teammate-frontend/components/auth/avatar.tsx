'use client'

// Avatar used in the landing header + dashboard top bar.
// Shows the real photo when an avatar URL is present (Google), otherwise
// falls back to a gradient circle with the first letter of the user's name.
import Image from 'next/image'
import { useState } from 'react'

interface AvatarProps {
  name: string
  email?: string
  avatarUrl: string | null
  size?: number
  className?: string
}

function initials(name: string, email?: string): string {
  const source = (name && name.trim()) || (email && email.trim()) || '?'
  // Use first non-empty word, take its first letter.
  const first = source.split(/\s+/).find((w) => w.length > 0) ?? source
  return first.charAt(0).toUpperCase()
}

export function Avatar({ name, email, avatarUrl, size = 32, className = '' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = avatarUrl && !imgFailed

  if (showImage) {
    return (
      <Image
        src={avatarUrl}
        alt={name || email || 'Profile'}
        width={size}
        height={size}
        unoptimized
        className={`rounded-full object-cover border border-slate-200 ${className}`}
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
      aria-label={name || email || 'User'}
    >
      {initials(name, email)}
    </div>
  )
}
