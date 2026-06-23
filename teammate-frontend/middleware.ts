import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Dashboard is now opt-in. The home page is the authed landing; the
  // dashboard layout still does its own client-side auth check, but we
  // don't gate the route at the edge anymore (since the access token
  // lives in localStorage, not cookies, an edge check would always
  // bounce the user).
  return NextResponse.next()
}
