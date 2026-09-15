// Provide harmless defaults so modules that construct clients at import
// time (e.g. lib/prisma.ts) don't crash under vitest. No real connections
// are made — all DB access in tests goes through vi.mock('@/lib/prisma').
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_SECRET ??= 'test-secret'
process.env.NEXTAUTH_URL ??= 'http://localhost:3000'
