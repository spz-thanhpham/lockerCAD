# Locker Layout Tool — Claude Code Context

## Project Overview

A web-based **locker layout workshop drawing tool** — think Canva-style drag-and-drop UI but for designing locker installations. Designers input room dimensions and locker specs, arrange lockers on a canvas, label/number them, then export factory-ready workshop drawings (dimensioned PDF + DXF for AutoCAD).

**Primary users:**
- Internal designers — create layouts for customers
- Customers — review and approve layouts via share link

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| Canvas / Drawing | react-konva (Konva.js) |
| State management | Zustand |
| Database ORM | Prisma |
| Database | PostgreSQL (Supabase or local Docker) |
| Auth | NextAuth.js (Email + Google) |
| PDF export | jsPDF + svg2pdf.js |
| DXF export | dxf-writer |
| Deployment | Vercel (app) + Supabase (DB) |

---

## Folder Structure

```
locker-layout-tool/
├── CLAUDE.md                        ← YOU ARE HERE
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── .env.local                       ← secrets (never commit)
├── .env.example                     ← template for env vars
│
├── prisma/
│   └── schema.prisma                ← DB models: User, Project, Layout, LockerTemplate
│
├── types/
│   └── index.ts                     ← shared TypeScript types (LockerObject, RoomConfig, etc.)
│
├── lib/
│   ├── prisma.ts                    ← Prisma client singleton
│   ├── auth.ts                      ← NextAuth config/options
│   ├── canvas-helpers.ts            ← Konva utility functions (snap, align, dimension calc)
│   └── export.ts                    ← PDF + DXF export logic
│
├── app/
│   ├── layout.tsx                   ← root layout (font, providers)
│   ├── page.tsx                     ← landing / redirect to /layouts
│   │
│   ├── canvas/
│   │   └── page.tsx                 ← main canvas editor page (full screen)
│   │
│   ├── layouts/
│   │   └── page.tsx                 ← saved layouts list / dashboard
│   │
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts         ← NextAuth route handler
│       └── layouts/
│           └── route.ts             ← GET (list), POST (create) layouts
│
├── components/
│   ├── editor/
│   │   ├── CanvasBoard.tsx          ← main Konva Stage + Layer, handles zoom/pan
│   │   ├── LockerObject.tsx         ← single draggable locker shape on canvas
│   │   ├── RoomOutline.tsx          ← room boundary rectangle
│   │   ├── DimensionLine.tsx        ← CAD-style dimension annotation arrows
│   │   ├── Toolbar.tsx              ← left sidebar: add locker, select, zoom tools
│   │   ├── PropertiesPanel.tsx      ← right sidebar: width/height/label/color inputs
│   │   └── LockerTemplateList.tsx   ← panel of preset locker sizes to drag onto canvas
│   │
│   ├── export/
│   │   ├── ExportPDF.tsx            ← PDF export button + logic (jsPDF + svg2pdf)
│   │   └── ExportDXF.tsx            ← DXF export button + logic (dxf-writer)
│   │
│   └── ui/                          ← shadcn/ui components live here (auto-generated)
│       └── (button.tsx, dialog.tsx, input.tsx, etc.)
```

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  role      Role      @default(DESIGNER)
  projects  Project[]
  createdAt DateTime  @default(now())
}

model Project {
  id        String    @id @default(cuid())
  name      String
  owner     User      @relation(fields: [ownerId], references: [id])
  ownerId   String
  layouts   Layout[]
  shareToken String?  @unique   // for customer read-only link
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Layout {
  id          String   @id @default(cuid())
  name        String
  project     Project  @relation(fields: [projectId], references: [id])
  projectId   String
  canvasData  Json     // full Konva JSON snapshot of all locker objects
  roomWidth   Float    // in mm
  roomDepth   Float    // in mm
  scale       Float    @default(1)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model LockerTemplate {
  id        String  @id @default(cuid())
  name      String  // e.g. "Standard 300W", "Half-height 400W"
  width     Float   // mm
  height    Float   // mm
  depth     Float   // mm
  color     String  @default("#94a3b8")
}

enum Role {
  DESIGNER
  CUSTOMER
  ADMIN
}
```

---

## Core TypeScript Types

```typescript
// types/index.ts

export interface LockerObject {
  id: string
  x: number           // canvas position (px)
  y: number           // canvas position (px)
  width: number       // real-world mm
  height: number      // real-world mm
  depth: number       // real-world mm
  label: string       // e.g. "L01"
  color: string       // hex
  rotation: number    // degrees
  templateId?: string
}

export interface RoomConfig {
  width: number       // mm
  depth: number       // mm
  scale: number       // px per mm, e.g. 1 px = 5mm → scale = 0.2
}

export interface CanvasData {
  room: RoomConfig
  lockers: LockerObject[]
}

export interface ExportOptions {
  format: 'pdf' | 'dxf' | 'png'
  includeDimensions: boolean
  titleBlock: {
    projectName: string
    drawingNo: string
    date: string
    scale: string
    drawnBy: string
  }
}
```

---

## Environment Variables

```bash
# .env.local (copy from .env.example)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/locker_tool"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

---

## Key Implementation Notes

### Canvas (react-konva)
- The `Stage` in `CanvasBoard.tsx` represents the full room
- Scale: default **1 px = 5 mm** (configurable). So a 300mm-wide locker = 60px on canvas
- Always store locker positions/sizes in **mm** in the DB; convert to px only for rendering
- Use `Transformer` from Konva for resize handles on selected lockers
- Snap-to-grid: 10mm grid (2px at default scale) — implement in `dragBoundFunc`
- Room outline is a non-draggable `Rect` always rendered first (bottom layer)

### Dimension Lines
- Custom `DimensionLine.tsx` component draws: `|←——width——→|` style annotations
- Uses Konva `Line` + `Arrow` + `Text`
- Show on hover or when locker is selected

### PDF Export (workshop drawing)
- Use `stage.toDataURL()` to get canvas as image, embed in jsPDF
- Add title block at bottom: project name, drawing no., date, scale, drawn by
- Draw dimension annotations separately as vector (not from canvas screenshot) for precision
- A4 or A3 paper size, landscape

### DXF Export
- Use `dxf-writer` npm package
- Each locker → DXF `LWPOLYLINE` (rectangle) with layer = locker label
- Room outline → separate DXF layer `ROOM`
- Include TEXT entities for labels and dimensions

### Save / Load
- Canvas state serialised as JSON (`stage.toJSON()` from Konva)
- Stored in `Layout.canvasData` (Prisma Json field)
- Auto-save every 30 seconds + manual save button
- On load: `Konva.Node.create(canvasData)` to restore

---

## Development Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Prisma: generate client after schema change
npx prisma generate

# Prisma: push schema to DB (dev)
npx prisma db push

# Prisma: open DB browser
npx prisma studio

# Add shadcn/ui component
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add sidebar
```

---

## Build Order (recommended)

Work in this order to avoid dependency issues:

1. **`prisma/schema.prisma`** — define all models first
2. **`types/index.ts`** — shared types used everywhere
3. **`lib/prisma.ts`** — DB client singleton
4. **`lib/auth.ts`** — NextAuth config
5. **`app/api/auth/[...nextauth]/route.ts`** — auth route
6. **`app/api/layouts/route.ts`** — layout CRUD API
7. **`components/editor/CanvasBoard.tsx`** — core canvas (most complex)
8. **`components/editor/LockerObject.tsx`** — draggable locker
9. **`components/editor/Toolbar.tsx`** — tool palette
10. **`components/editor/PropertiesPanel.tsx`** — right panel
11. **`components/editor/DimensionLine.tsx`** — annotations
12. **`app/canvas/page.tsx`** — wire everything together
13. **`lib/export.ts`** — PDF + DXF logic
14. **`components/export/ExportPDF.tsx`** — export UI
15. **`app/layouts/page.tsx`** — dashboard

---

## Package.json Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "konva": "^9.3.0",
    "react-konva": "^18.2.10",
    "zustand": "^4.5.0",
    "@prisma/client": "^5.14.0",
    "next-auth": "^4.24.0",
    "jspdf": "^2.5.1",
    "svg2pdf.js": "^2.2.3",
    "dxf-writer": "^1.5.0",
    "tailwindcss": "^3.4.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "prisma": "^5.14.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0"
  }
}
```

---

## Windows / VSCode Notes

- Use **Node.js 20 LTS** — download from [nodejs.org](https://nodejs.org)
- Use **PowerShell** or **Git Bash** as terminal in VSCode
- Install VSCode extensions: **Prisma**, **Tailwind CSS IntelliSense**, **ESLint**

### PostgreSQL local setup (Windows)

1. Download and install PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   - During install: set a password for the `postgres` user — remember this
   - Keep default port `5432`
   - Tick **pgAdmin 4** when offered (free visual DB browser)

2. After install, open **pgAdmin 4** (from Start menu) or **SQL Shell (psql)** and run:
   ```sql
   CREATE DATABASE locker_tool;
   ```

3. Set your `.env.local` connection string:
   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/locker_tool"
   ```

4. Push the Prisma schema to create all tables:
   ```powershell
   npx prisma generate
   npx prisma db push
   ```

5. Optionally open the DB browser to verify tables were created:
   ```powershell
   npx prisma studio
   ```

---

*Last updated: initial scaffold. Next step → implement `CanvasBoard.tsx` and `LockerObject.tsx`.*
