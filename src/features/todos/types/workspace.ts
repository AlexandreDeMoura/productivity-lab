export type BlockId = string;

export type BlockLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type BlockLayouts = Record<BlockId, BlockLayout>;

export type BlockRect = Pick<BlockLayout, "x" | "y" | "width" | "height">;

export type WorkspaceItem = {
  projectId: number;
  projectName: string;
  todosLayout: BlockLayout;
  detailsLayout: BlockLayout;
  selectedTodoId: number | null;
};

export type WorkspaceState = {
  items: Record<number, WorkspaceItem>;
  orderedProjectIds: number[];
};

export type WorkspaceItemUpdate = Partial<Omit<WorkspaceItem, "projectId">>;

export const addWorkspaceItem = (
  state: WorkspaceState,
  item: WorkspaceItem
): WorkspaceState => {
  const nextItems: Record<number, WorkspaceItem> = {
    ...state.items,
    [item.projectId]: {
      projectId: item.projectId,
      projectName: item.projectName,
      todosLayout: { ...item.todosLayout },
      detailsLayout: { ...item.detailsLayout },
      selectedTodoId: item.selectedTodoId,
    },
  };

  const hasProject = state.orderedProjectIds.includes(item.projectId);
  const nextOrderedProjectIds = hasProject
    ? state.orderedProjectIds
    : [...state.orderedProjectIds, item.projectId];

  return {
    items: nextItems,
    orderedProjectIds: nextOrderedProjectIds,
  };
};

const areLayoutsEqual = (a: BlockLayout, b: BlockLayout): boolean =>
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  a.z === b.z;

export const updateWorkspaceItem = (
  state: WorkspaceState,
  projectId: number,
  updates: WorkspaceItemUpdate
): WorkspaceState => {
  const current = state.items[projectId];
  if (!current) {
    return state;
  }

  const nextItem: WorkspaceItem = {
    projectId: current.projectId,
    projectName:
      updates.projectName !== undefined
        ? updates.projectName
        : current.projectName,
    todosLayout:
      updates.todosLayout !== undefined
        ? { ...updates.todosLayout }
        : current.todosLayout,
    detailsLayout:
      updates.detailsLayout !== undefined
        ? { ...updates.detailsLayout }
        : current.detailsLayout,
    selectedTodoId:
      updates.selectedTodoId !== undefined
        ? updates.selectedTodoId
        : current.selectedTodoId,
  };

  const hasChanged =
    current.projectName !== nextItem.projectName ||
    current.selectedTodoId !== nextItem.selectedTodoId ||
    !areLayoutsEqual(current.todosLayout, nextItem.todosLayout) ||
    !areLayoutsEqual(current.detailsLayout, nextItem.detailsLayout);

  if (!hasChanged) {
    return state;
  }

  return {
    items: {
      ...state.items,
      [projectId]: nextItem,
    },
    orderedProjectIds: state.orderedProjectIds,
  };
};

export const removeWorkspaceItem = (
  state: WorkspaceState,
  projectId: number
): WorkspaceState => {
  if (!state.items[projectId]) {
    return state;
  }

  const { [projectId]: removedItem, ...remaining } = state.items;
  void removedItem;
  const nextOrderedProjectIds = state.orderedProjectIds.filter(
    (id) => id !== projectId
  );

  return {
    items: remaining,
    orderedProjectIds: nextOrderedProjectIds,
  };
};
