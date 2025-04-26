export interface NodeData {
  id: string;
  x: number;
  y: number;
}

export interface LinkData {
  source: string; // Node ID
  target: string; // Node ID
}

export interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

export type Player = 'cat' | 'mouse';

export interface GameState {
  catNodeId: string;
  mouseNodeId: string;
  currentPlayer: Player | null; // null when game ends
  turnCount: number;
  gameEnded: boolean;
  message: string;
}

// Added type for the stages loaded from JSON
// Use NodeData for nodes to include position
export interface StageData {
  graph_id: number | string; // Atlas index or custom ID
  nodes: NodeData[]; // Use NodeData which includes id, x, y
  edges: [number, number][]; // List of edges [source_id, target_id] (keep as numbers for now)
  cat_start_node: number; // Keep as number ID
  mouse_start_node: number; // Keep as number ID
  minimax_cat_moves: number; // Renamed key to match python script output
  optimal_path?: Array<[number, number]>; // Optional: Cat position, Mouse position for each step
}
