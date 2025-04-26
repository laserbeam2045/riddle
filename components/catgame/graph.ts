import { NodeData, LinkData, GraphData } from './types';

// --- Graph Data ---
export const initialNodesData: NodeData[] = [
    { id: "v1", x: 100, y: 100 },
    { id: "v2", x: 200, y: 50 },
    { id: "v3", x: 300, y: 100 },
    { id: "v4", x: 300, y: 200 },
    { id: "v5", x: 200, y: 250 },
    { id: "v6", x: 200, y: 150 }
];

export const initialLinksData: LinkData[] = [
    { source: "v1", target: "v2" },
    { source: "v2", target: "v3" },
    { source: "v3", target: "v4" },
    { source: "v4", target: "v5" },
    { source: "v5", target: "v1" },
    { source: "v1", target: "v6" },
    { source: "v6", target: "v3" },
    { source: "v6", target: "v4" }
];

export const graphData: GraphData = {
    nodes: initialNodesData,
    links: initialLinksData
};

// --- Adjacency List ---
export type AdjacencyList = { [key: string]: string[] };

export function createAdjacencyList(nodes: NodeData[], links: LinkData[]): AdjacencyList {
    const adj: AdjacencyList = {};
    nodes.forEach(node => adj[node.id] = []);
    links.forEach(link => {
        if (adj[link.source] && adj[link.target]) {
            adj[link.source].push(link.target);
            adj[link.target].push(link.source);
        } else {
            console.error("Node not found for link during adjacency list creation:", link);
        }
    });
    return adj;
}

export const adjacencyList = createAdjacencyList(graphData.nodes, graphData.links);

// --- Shortest Path Calculation (BFS) ---
/**
 * Calculates the shortest path distance between two nodes using Breadth-First Search.
 * @param startId The starting node ID.
 * @param endId The ending node ID.
 * @param adj The adjacency list for the graph.
 * @returns The shortest distance, or null if unreachable.
 */
export function calculateShortestPath(startId: string, endId: string, adj: AdjacencyList): number | null {
    if (startId === endId) return 0;

    const queue: [string, number][] = [[startId, 0]]; // [nodeId, distance]
    const visited: Set<string> = new Set([startId]);

    while (queue.length > 0) {
        const [currentId, distance] = queue.shift()!; // Non-null assertion as queue is checked

        if (!adj[currentId]) continue; // Should not happen with proper graph data

        for (const neighborId of adj[currentId]) {
            if (neighborId === endId) {
                return distance + 1;
            }
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push([neighborId, distance + 1]);
            }
        }
    }

    return null; // Unreachable
}


// --- Minimax Calculation for Shortest Turns ---

const MAX_DEPTH = 20; // Maximum search depth to prevent infinite loops/long computation
const INFINITY = Number.MAX_SAFE_INTEGER;

// Helper to create a unique key for memoization
const getStateKey = (catId: string, mouseId: string, isCatTurn: boolean): string => {
    return `${catId}-${mouseId}-${isCatTurn ? 'cat' : 'mouse'}`;
};

// Memoization cache
const memo: { [key: string]: number } = {};

function minimax(
    catId: string,
    mouseId: string,
    isCatTurn: boolean,
    depth: number,
    adj: AdjacencyList
): number {
    // Base Cases
    if (catId === mouseId) {
        return 0; // Cat caught the mouse in the previous turn (mouse moved onto cat or cat moved onto mouse)
    }
    if (depth >= MAX_DEPTH) {
        return INFINITY; // Failed to catch within depth limit
    }

    const stateKey = getStateKey(catId, mouseId, isCatTurn);
    if (memo[stateKey] !== undefined) {
        return memo[stateKey];
    }

    let bestVal: number;

    if (isCatTurn) {
        // Cat's turn (Minimizing player - wants to minimize turns to catch)
        bestVal = INFINITY;
        const catMoves = adj[catId] || [];
        if (catMoves.length === 0) return INFINITY; // Cat has no moves

        for (const nextCatId of catMoves) {
            // If cat catches mouse immediately
            if (nextCatId === mouseId) {
                 bestVal = Math.min(bestVal, 1); // Takes 1 turn (this move)
                 continue; // No need to check further down this path
            }
            // Simulate cat move, then call minimax for mouse's turn (depth increases for cat's move)
            // Mouse turn does not increase the 'turn count' in the result, only depth for recursion control
            const value = minimax(nextCatId, mouseId, false, depth + 1, adj);
            if (value !== INFINITY) {
                 // Add 1 turn for the cat's current move
                bestVal = Math.min(bestVal, value + 1);
            } else {
                bestVal = Math.min(bestVal, INFINITY); // Propagate infinity if a path leads to no catch
            }
        }
    } else {
        // Mouse's turn (Maximizing player - wants to maximize turns until caught)
        bestVal = 0; // If mouse can't move or is caught immediately, turns = 0 from this state
        const mouseMoves = adj[mouseId] || [];
        const catNextPotentialMoves = adj[catId] || [];

        // Simple mouse strategy: avoid cat's current and next possible locations
        const safeMoves = mouseMoves.filter(
            move => move !== catId && !catNextPotentialMoves.includes(move)
        );
        const lessUnsafeMoves = mouseMoves.filter(move => move !== catId);

        let possibleMoves: string[];
        if (safeMoves.length > 0) {
            possibleMoves = safeMoves;
        } else if (lessUnsafeMoves.length > 0) {
            possibleMoves = lessUnsafeMoves;
        } else {
            possibleMoves = mouseMoves; // Mouse is trapped or has only one move (potentially onto cat)
        }

        if (possibleMoves.length === 0) {
             // Mouse has no moves, cat wins in the next turn if adjacent
             // Check if cat can move to mouse's current spot next turn
             if (catNextPotentialMoves.includes(mouseId)) {
                 bestVal = 1; // Cat catches in 1 turn
             } else {
                 bestVal = INFINITY; // Cat cannot reach trapped mouse? Should not happen in connected graph? Or means mouse wins? Let's assume INFINITY means no catch within limit.
             }

        } else {
             bestVal = 0; // Initialize bestVal for mouse turn (maximize turns)
             let canEscape = false;
             for (const nextMouseId of possibleMoves) {
                 // If mouse moves onto the cat's spot (should be avoided by strategy, but handle defensively)
                 if (nextMouseId === catId) {
                     // This path results in immediate catch (0 turns from mouse perspective)
                     // We want to maximize turns, so this is the worst outcome for the mouse.
                     // However, the function returns turns *until* catch.
                     // Let's consider the cat's perspective: cat wins in 0 *additional* cat turns.
                     // But the minimax call expects turns *from the current state*.
                     // If mouse moves onto cat, cat wins *now*. Let's return 0?
                     // This seems counter-intuitive for the maximizer.
                     // Let's rethink: minimax returns the number of *cat turns* until capture from the *current state*.
                     // If mouse moves onto cat, cat needs 0 more turns.
                     // bestVal = Math.max(bestVal, 0); // This doesn't make sense for max.

                     // Let's stick to the definition: return turns until catch.
                     // If mouse moves onto cat, turns = 0. Mouse wants to *avoid* this.
                     // If mouse *can* move somewhere else, it will prefer paths with higher turn counts.
                     continue; // Skip this move if possible, as it leads to immediate capture (0 turns).
                 }

                 // Simulate mouse move, then call minimax for cat's turn (depth doesn't increase for mouse move in result)
                 const value = minimax(catId, nextMouseId, true, depth, adj);
                 if (value !== INFINITY) {
                     canEscape = true; // Mouse found a path that doesn't lead to immediate loss within depth
                     bestVal = Math.max(bestVal, value);
                 }
             }
              // If mouse had moves, but all lead to INFINITY (no catch within limit), mouse "wins" (survives)
             if (!canEscape && possibleMoves.length > 0) {
                 // Check if any move was onto the cat's spot (which we skipped)
                 const movesOntoCat = possibleMoves.filter(move => move === catId);
                 if (movesOntoCat.length === possibleMoves.length) {
                     // Only possible move is onto the cat
                     bestVal = 0; // Catches in 0 additional cat turns
                 } else {
                     // All other moves lead to survival beyond MAX_DEPTH
                     bestVal = INFINITY;
                 }
             }
        }


    }

    memo[stateKey] = bestVal;
    return bestVal;
}


/**
 * Calculates the theoretical minimum turns for the cat to catch the mouse,
 * assuming optimal play from both sides (using Minimax).
 * @param initialCatId Initial cat node ID.
 * @param initialMouseId Initial mouse node ID.
 * @param adj Adjacency list.
 * @returns The minimum number of cat turns required, or "計算不可" / "計算中..."
 */
export function calculateTheoreticalMinTurns(initialCatId: string, initialMouseId: string, adj: AdjacencyList): number | string {
    // Clear memoization cache for each new calculation
    Object.keys(memo).forEach(key => delete memo[key]);

    // Start minimax from the initial state, cat's turn, depth 0
    const turns = minimax(initialCatId, initialMouseId, true, 0, adj);

    if (turns === INFINITY) {
        return "計算不可"; // Or indicate survival beyond limit
    } else {
        return turns;
    }
}
