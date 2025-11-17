# ViraCut Frontend

Mobile-first node-based video editing platform built with Next.js 15, React Flow, TypeScript, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Redux Toolkit
- **Video Editor**: React Flow
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Video Processing**: Omniclip SDK

## Development

### Prerequisites

- Node.js 18.17.0+
- npm 9.0.0+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

3. Configure your environment variables in `.env.local`

4. Start development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run test:e2e` - Open Cypress E2E test runner
- `npm run test:e2e:headless` - Run Cypress E2E tests headlessly

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/              # React components
│   ├── atoms/              # Basic UI elements
│   ├── molecules/          # Simple component combinations
│   ├── organisms/          # Complex components
│   └── templates/          # Layout templates
├── hooks/                  # Custom React hooks
├── models/                 # Data models
├── pages/                  # Legacy pages (if needed)
├── services/               # API services
├── store/                  # Redux store configuration
├── types/                  # TypeScript type definitions
└── utils/                  # Utility functions
```

## Performance Targets

- < 2s initial load on 3G networks
- 60fps canvas rendering
- <100ms touch response time
- <500MB memory usage on mobile

## Mobile-First Development

This project follows mobile-first design principles. All components are designed and tested on mobile devices first, then enhanced for larger screens.

## Deployment

The frontend is designed to be deployed on Vercel with automatic environment variable configuration.

## License

MIT