# Locker Layout Tool

CAD-style locker installation layout and workshop drawing tool. Drag-and-drop lockers onto a scaled room plan, add dimension annotations, then export factory-ready PDF workshop drawings or AutoCAD DXF files.

## Quick start (Windows)

### 1. Prerequisites
- [Node.js 20 LTS](https://nodejs.org) — free
- [PostgreSQL for Windows](https://www.postgresql.org/download/windows/) — free

### 2. Install PostgreSQL

Run the PostgreSQL installer. During setup:
- Set a password for the `postgres` user — write it down
- Keep the default port `5432`
- Tick **pgAdmin 4** when offered (free visual database browser)

After install, open **pgAdmin 4** or **SQL Shell (psql)** from the Start menu and create the database:
```sql
CREATE DATABASE locker_tool;
```

### 3. Clone and install dependencies
```powershell
git clone <your-repo>
cd locker-layout-tool
npm install
```

### 4. Configure environment
```powershell
copy .env.example .env.local
```

Open `.env.local` and set your values:
```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/locker_tool"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-generated-secret-here"
```

Generate a NextAuth secret (run in PowerShell):
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Initialise the database
```powershell
npx prisma generate
npx prisma db push
```

Verify tables were created:
```powershell
npx prisma studio
```

### 6. Run the dev server
```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the canvas editor.

---

## Key commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npx prisma db push` | Sync schema to DB |
| `npx prisma studio` | Visual DB browser |
| `npx shadcn@latest add <component>` | Add UI component |

## Adding shadcn/ui components

Run once to initialise shadcn:
```powershell
npx shadcn@latest init
```

Then add components as needed:
```powershell
npx shadcn@latest add button dialog input tooltip
```

---

## Deployment (Vercel + Supabase)

1. Push repo to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Run `npx prisma db push` once against your production DB

---

## Tech stack

| Layer | Library |
|-------|---------|
| Framework | Next.js 14 (App Router) |
| Canvas | react-konva (Konva.js) |
| State | Zustand |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth.js |
| PDF export | jsPDF + svg2pdf.js |
| DXF export | dxf-writer |
| Styling | Tailwind CSS + shadcn/ui |

See `CLAUDE.md` for full architecture details and build order.
