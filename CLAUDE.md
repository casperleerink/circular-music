# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Style note:** Be concise. Favor brevity over grammatical correctness.

## Commands

- `bun check-types` - typecheck all workspaces
- `bun install` - install deps
- `npx shadcn@latest add <component>` - add UI component (run from apps/web)

Do not run dev or build commands.

## Architecture

Turborepo monorepo for interactive audio art. See CONCEPT.md for artistic vision (shoreline shaped by collective visitor interactions, audio evolving from noise to clarity).

### Workspaces

- **apps/web** - Vite + React + TanStack Router, audio synthesis
- **apps/native** - Expo/React Native mobile app
- **packages/backend** - Convex backend (schema, auth, real-time)
- **packages/env** - Environment validation per platform (web.ts, native.ts, server.ts)
- **packages/config** - Shared TS config

### Audio (apps/web)

Elementary Audio for real-time DSP (@elemaudio/core, @elemaudio/web-renderer).

### Backend (packages/backend/convex)

Convex + Better-Auth. Schema has `players` table (userId, position). Anonymous auth enabled.

### UI

shadcn/ui components in `apps/web/src/components/ui/`.
