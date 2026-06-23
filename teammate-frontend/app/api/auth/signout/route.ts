import { signOut } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  try {
    await signOut()
    return NextResponse.json({ message: 'Signed out successfully' }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
