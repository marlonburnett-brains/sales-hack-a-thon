# Lumenalta Hackathon

A modern web application built with Next.js, structured as a Turborepo monorepo.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Monorepo**: [Turborepo](https://turbo.build/repo)
- **Language**: TypeScript
- **Styling**: TailwindCSS

## Project Structure

```
lumenalta-hackathon/
├── apps/
│   └── web/          # Next.js web application
├── packages/
│   ├── ui/           # Shared UI components
│   ├── config/       # Shared configuration (ESLint, TypeScript, Tailwind)
│   └── utils/        # Shared utilities
├── turbo.json
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (recommended) or npm/yarn

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## Apps

### `apps/web`

The primary Next.js application.

- **URL**: http://localhost:3000

## Packages

| Package | Description |
|---|---|
| `packages/ui` | Shared React component library |
| `packages/config` | Shared ESLint, TypeScript, and Tailwind configurations |
| `packages/utils` | Shared utility functions |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm test` | Run tests across all packages |
| `pnpm clean` | Remove all build artifacts |
