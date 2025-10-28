# Multi-Project Canvas Workspace

## Overview

Transform the single-project todo app into a multi-project workspace with a sidebar for project management and the ability to drag multiple project blocks onto the canvas, each with its own TodosBlock and TodoDetailsBlock instance.

## Phase 1: Database Types & Project Backend

### Update Database Types

**File**: `src/types/database.ts`

- Add `Project` type matching the new schema (id, name, description, owner_id, metadata, created_at, updated_at)
- Add `project_id: number` to `Todo` type
- Add `ProjectInsert` and `ProjectUpdate` types

### Create Project Schemas

**File**: `src/features/projects/schemas/projectSchemas.ts` (new)

- Create Zod schemas: `createProjectSchema`, `updateProjectSchema`, `deleteProjectSchema`, `getProjectsSchema`
- Validation: name 1-100 chars, description max 500 chars, owner_id UUID

### Create Project Actions

**File**: `src/features/projects/actions/projectActions.ts` (new)

- `getProjects()` - Fetch user's projects (owner + shared)
- `createProject(input)` - Create new project with name, description
- `updateProject(input)` - Update project name/description
- `deleteProject(input)` - Delete project (cascade will remove todos)

### Update Todo Actions

**File**: `src/features/todos/actions/todoActions.ts`

- Add `project_id` to `getTodos()` - filter by project
- Add `project_id` to `createTodo()` - require project_id
- Update `clearCompletedTodos()` - add project_id filter
- Update `normalizeTodoRecord()` to include project_id

### Update Todo Schemas

**File**: `src/features/todos/schemas/todoSchemas.ts`

- Add `project_id: z.number().int().positive()` to `createTodoSchema`
- Add `project_id` to `getTodosSchema` (required)

## Phase 2: Workspace Architecture Refactor

### Create Workspace Types

**File**: `src/features/todos/types/workspace.ts`

- Replace hardcoded block IDs with dynamic system
- Add `WorkspaceItem` type: `{ projectId: number; projectName: string; todosLayout: BlockLayout; detailsLayout: BlockLayout; selectedTodoId: number | null }`
- Add `WorkspaceState` type: `{ items: Record<number, WorkspaceItem>; orderedProjectIds: number[] }`
- Add pure helpers (`addWorkspaceItem`, `updateWorkspaceItem`, `removeWorkspaceItem`) to return new state objects so React state stays immutable
- Keep `BlockLayout` unchanged

### Create Workspace Item Component

**File**: `src/features/todos/components/WorkspaceProjectItem.tsx` (new)

- Accept `projectId`, `projectName`, `layouts`, `selectedTodoId`, callbacks
- Render both TodosBlock and TodoDetailsBlock for this project
- Consume todos data and mutation callbacks provided by the parent
- Handle optimistic updates scoped to this project via those callbacks
- Pass project_id to all todo actions

## Phase 3: Projects Sidebar

### Create Project List Item

**File**: `src/features/projects/components/ProjectListItem.tsx` (new)

- Display project name, edit/delete buttons
- Draggable element (using native HTML5 drag API)
- Set `dataTransfer` with `{ type: 'project', projectId, projectName }`
- Inline edit mode for renaming

### Create Projects Sidebar

**File**: `src/features/projects/components/ProjectsSidebar.tsx` (new)

- Fetch projects with `getProjects()` action
- "Create Project" form (name + description, collapsible)
- Newly created projects surface immediately in the list but leave the canvas untouched until the user drags them over
- Render list of `ProjectListItem` components
- Handle project CRUD operations
- Styled as fixed left sidebar (280px width)

## Phase 4: Main Page Refactor

### Update Main Page

**File**: `src/app/page.tsx`

- Remove single todos/todoDetails state and blocks
- Add workspace state shaped as `{ items: Record<number, WorkspaceItem>; orderedProjectIds: number[] }`
- Add canvas drop zone handler
- On drop: create new `WorkspaceItem`, add to state immutably, compute initial layout
- On second drop of the same project, focus the existing block instead of duplicating it
- Render `ProjectsSidebar` component
- Render `WorkspaceProjectItem` for each `orderedProjectIds` entry
- Parent component owns todo fetching/caching for each project (shared hook or loader) and passes data + CRUD callbacks into `WorkspaceProjectItem`
- Remove todo-specific logic (moved to WorkspaceProjectItem)
- Keep auth logic, canvas, and layout utilities
- Update `STORAGE_KEY` strategy (store per-project or skip persistence per requirement)

### Layout Strategy for Multiple Blocks

**File**: `src/app/page.tsx` helpers

- When adding new project to canvas, compute non-overlapping position
- Use cascade/grid pattern: start at (48, 48), offset each new project by (32, 32)
- Remove layout persistence (always start empty canvas per requirements)

## Phase 5: Styling & Polish

### Sidebar Styles

**File**: `src/app/globals.css`

- Add `.projects-sidebar` base styles (fixed, left, bg, shadow)
- Add `.project-list-item` styles (hover, drag states)
- Add drag-over states for canvas drop zone
- Ensure sidebar doesn't overlap canvas blocks

### Update Root Layout

**File**: `src/app/layout.tsx`

- Add left padding to main content area for sidebar (280px)
- Ensure workspace canvas accounts for sidebar width

### Workspace Canvas Updates

**File**: `src/app/page.tsx`

- Update `.workspace-canvas` to handle drop events
- Add visual feedback for drag-over state
- Update bounds calculation to account for sidebar

## Implementation Notes

- Deploy checklist: confirm every existing `todos` row has a `user_id` so the migration backfill succeeds; verify `public.handle_updated_at` exists before running the trigger
- Each `WorkspaceProjectItem` keeps local UI state (selection, optimistic presentation) while delegating data fetching and mutations through parent-provided hooks
- Remove global `STORAGE_KEY` persistence since empty canvas is required on load
- New projects appear in the sidebar immediately but do not auto-populate the canvas; the empty canvas state should prompt users to drag a project over
- Ensure RLS policies allow project access (already in migration)
- Todo operations require `project_id`, preventing orphaned todos
- Cascade delete on project removal handles cleanup automatically
- Each project instance is independent with its own TodosBlock + TodoDetailsBlock
