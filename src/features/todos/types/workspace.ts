export type BlockId = "todos" | "todoDetails";

export type BlockLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

export type BlockLayouts = Record<BlockId, BlockLayout>;

export type BlockRect = Pick<BlockLayout, "x" | "y" | "width" | "height">;
