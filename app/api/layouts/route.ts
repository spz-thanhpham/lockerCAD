export const dynamic = 'force-dynamic'

// app/api/layouts/route.ts
// GET  /api/layouts  — list layouts for current user
// POST /api/layouts  — create layout (auto-creates a default project if needed)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const projectId = req.nextUrl.searchParams.get('projectId')
  const view = req.nextUrl.searchParams.get('view')

  if (view === 'shared') {
    // Layout-level shares (not project-level)
    // Async IIFE guards against synchronous TypeError when sharePermission table doesn't exist yet
    const shares: any[] = await (async () => {
      try {
        return await (prisma as any).sharePermission?.findMany({
          where: { userId, layoutId: { not: null } },
          include: {
            layout: {
              select: {
                id: true, name: true, projectId: true,
                roomWidth: true, roomDepth: true,
                createdAt: true, updatedAt: true,
                project: {
                  select: {
                    id: true, name: true,
                    owner: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        }) ?? []
      } catch {
        return []
      }
    })()

    const result = shares
      .filter((s: any) => s.layout !== null)
      .map((s: any) => ({
        ...s.layout,
        sharePermission: s.permission,
        shareId: s.id,
      }))

    return NextResponse.json(result)
  }

  if (projectId) {
    // Check ownership first; if not owner, try share permission (table may not exist yet)
    const [layouts, isOwner] = await Promise.all([
      prisma.layout.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, name: true, projectId: true,
          roomWidth: true, roomDepth: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.project.findFirst({
        where: { id: projectId, ownerId: userId },
        select: { id: true },
      }),
    ])

    if (!isOwner) {
      // Fall back: check share permission — guarded in case table doesn't exist yet
      const hasShare = await (async () => {
        try {
          return !!(await (prisma as any).sharePermission?.findFirst({
            where: { userId, projectId },
            select: { id: true },
          }))
        } catch { return false }
      })()
      if (!hasShare) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(layouts)
  }

  const layouts = await prisma.layout.findMany({
    where: {
      project: { ownerId: userId },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, projectId: true,
      roomWidth: true, roomDepth: true,
      createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(layouts)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name = 'Untitled Layout', canvasData, projectId } = body

  if (!canvasData) return NextResponse.json({ error: 'canvasData required' }, { status: 400 })

  // Use supplied projectId if it belongs to this user, otherwise find/create default
  let project = projectId
    ? await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id } })
    : null

  if (!project) {
    project = await prisma.project.findFirst({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!project) {
    project = await prisma.project.create({
      data: { name: 'My Layouts', ownerId: session.user.id },
    })
  }

  const layout = await prisma.layout.create({
    data: {
      name,
      projectId: project.id,
      canvasData,
      roomWidth: canvasData.room?.widthMm ?? 6000,
      roomDepth: canvasData.room?.depthMm ?? 4000,
      scale: canvasData.room?.scale ?? 0.1,
    },
  })

  return NextResponse.json(layout, { status: 201 })
}
