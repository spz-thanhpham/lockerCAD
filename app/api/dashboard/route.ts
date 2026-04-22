export const dynamic = 'force-dynamic'

// Single endpoint for initial page load — returns owned projects, shared projects,
// and layouts for the first owned project, all in one DB round-trip.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string

  // Fire all three queries in parallel
  const [projects, sharedShares] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { layouts: true } } },
    }),
    (prisma as any).sharePermission.findMany({
      where: { userId, projectId: { not: null } },
      include: {
        project: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { layouts: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const firstProjectId = projects[0]?.id ?? null

  // Fetch first project's layouts only if there is one
  const layouts = firstProjectId
    ? await prisma.layout.findMany({
        where: { projectId: firstProjectId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, name: true, projectId: true,
          roomWidth: true, roomDepth: true,
          createdAt: true, updatedAt: true,
        },
      })
    : []

  const sharedProjects = sharedShares
    .filter((s: any) => s.project !== null)
    .map((s: any) => ({ ...s.project, sharePermission: s.permission, shareId: s.id }))

  return NextResponse.json({ projects, sharedProjects, layouts, firstProjectId })
}
