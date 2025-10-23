# Productivity Lab

A modern, full-stack todo application featuring a unique draggable, resizable block-based interface. Built with Next.js 15, React 19, and Supabase.

## ✨ Features

- **Draggable & Resizable Blocks**: Todos and details appear in movable, resizable windows with smart positioning
- **Optimistic UI Updates**: Instant feedback with optimistic updates using React's `useOptimistic` hook
- **Real-time Authentication**: Secure user authentication powered by Supabase Auth
- **Focus Mode**: Maximize any block for distraction-free viewing
- **Persistent Layouts**: Block positions and sizes are saved to localStorage
- **Smart Block Positioning**: Automatic intelligent placement of detail blocks relative to main todos
- **Responsive Design**: Mobile-first design with Tailwind CSS 4
- **Type-safe**: Strict TypeScript throughout with Zod validation

## 🚀 Tech Stack

- **Framework**: Next.js 15.5.5 (App Router + Turbopack)
- **UI**: React 19, Tailwind CSS 4
- **Backend**: PostgreSQL via Supabase
- **Auth**: Supabase Auth
- **Validation**: Zod schemas
- **Testing**: Jest + React Testing Library
- **Type Safety**: TypeScript (strict mode)
- **Icons**: Lucide React
- **Interactions**: react-rnd for drag & resize


## 🛠️ Getting Started

### Prerequisites

- Node.js 20+ (recommended)
- npm, yarn, pnpm, or bun
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd productivity-lab
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   
   Run the migrations in your Supabase project:
   ```bash
   # Apply migrations to your Supabase instance
   # Located in supabase/migrations/
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)


## 🧪 Testing

```bash
npm run test
# or
yarn test
```

Tests are co-located with source files and use Jest + React Testing Library.

## 📝 Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Jest tests

## 🎨 Code Style & Patterns

- **Functional Components**: Arrow functions with named exports
- **TypeScript**: Explicit types, strict mode, no `any`
- **Server Actions**: Located in `actions/` folders with Zod validation
- **State Management**: 
  - React Query for server state
  - useState/Context for local state
  - Optimistic updates for instant UI feedback
- **Styling**: Tailwind utilities (avoiding `@apply`)
- **File Naming**: 
  - PascalCase for components
  - camelCase for utils/actions

## 🔑 Key Features Explained

### Draggable Blocks

Todos and details appear in floating, draggable windows using `react-rnd`. Each block maintains its position and size in localStorage.

### Smart Positioning

When a todo is selected, the detail block automatically positions itself:
1. First tries to the right of the todos block
2. Falls back to left, below, or above if space is insufficient
3. Centers as a last resort

### Focus Mode

Click the maximize button to enter focus mode, which:
- Centers and enlarges the block
- Stores the previous layout
- Restores position when exiting

### Optimistic Updates

All mutations (create, toggle, delete) use optimistic updates for instant feedback, then reconcile with server responses.

## 🚀 Deployment

Deploy to Vercel (recommended):

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Add your Supabase environment variables in the Vercel dashboard.

## 🤝 Contributing

This is a personal project. Contributions are not currently accepted.
