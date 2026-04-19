// middleware.ts
// Protect /canvas and /layouts — redirect to sign-in if no session.

export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/canvas', '/layouts'],
}
