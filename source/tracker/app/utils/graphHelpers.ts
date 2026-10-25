import { logger } from '@/utils/logger';
type NodeId = string;
export interface TaskGraph {
  clear: () => void;
  hasNode: (nodeId: NodeId) => boolean;
  inNeighbors: (nodeId: NodeId) => NodeId[];
  mergeEdge: (sourceId: NodeId, targetId: NodeId) => void;
  mergeNode: (nodeId: NodeId) => void;
  nodes: () => NodeId[];
  outNeighbors: (nodeId: NodeId) => NodeId[];
}
class DirectedTaskGraph implements TaskGraph {
  private incoming = new Map<NodeId, Set<NodeId>>();
  private outgoing = new Map<NodeId, Set<NodeId>>();
  clear(): void {
    this.incoming.clear();
    this.outgoing.clear();
  }
  hasNode(nodeId: NodeId): boolean {
    return this.outgoing.has(nodeId);
  }
  inNeighbors(nodeId: NodeId): NodeId[] {
    const neighbors = this.incoming.get(nodeId);
    if (!neighbors) throw new Error(`Node "${nodeId}" does not exist`);
    return Array.from(neighbors);
  }
  mergeEdge(sourceId: NodeId, targetId: NodeId): void {
    this.mergeNode(sourceId);
    this.mergeNode(targetId);
    this.outgoing.get(sourceId)!.add(targetId);
    this.incoming.get(targetId)!.add(sourceId);
  }
  mergeNode(nodeId: NodeId): void {
    if (!this.outgoing.has(nodeId)) {
      this.outgoing.set(nodeId, new Set());
    }
    if (!this.incoming.has(nodeId)) {
      this.incoming.set(nodeId, new Set());
    }
  }
  nodes(): NodeId[] {
    return Array.from(this.outgoing.keys());
  }
  outNeighbors(nodeId: NodeId): NodeId[] {
    const neighbors = this.outgoing.get(nodeId);
    if (!neighbors) throw new Error(`Node "${nodeId}" does not exist`);
    return Array.from(neighbors);
  }
}
export function getPredecessors(graph: TaskGraph, nodeId: string): string[] {
  const allPredecessors = new Set<string>();
  const visited = new Set<string>();
  function traverse(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    try {
      const parents = graph.inNeighbors(id);
      for (const parent of parents) {
        allPredecessors.add(parent);
        traverse(parent);
      }
    } catch (error) {
      logger.error(`Error getting predecessors for node ${id}:`, error);
    }
  }
  traverse(nodeId);
  return Array.from(allPredecessors);
}
export function getSuccessors(graph: TaskGraph, nodeId: string): string[] {
  const allSuccessors = new Set<string>();
  const visited = new Set<string>();
  function traverse(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);
    try {
      const children = graph.outNeighbors(id);
      for (const child of children) {
        allSuccessors.add(child);
        traverse(child);
      }
    } catch (error) {
      logger.error(`Error getting successors for node ${id}:`, error);
    }
  }
  traverse(nodeId);
  return Array.from(allSuccessors);
}
export function getParents(graph: TaskGraph, nodeId: string): string[] {
  try {
    return graph.inNeighbors(nodeId);
  } catch (error) {
    logger.error(`Error getting parents for node ${nodeId}:`, error);
    return [];
  }
}
export function getChildren(graph: TaskGraph, nodeId: string): string[] {
  try {
    return graph.outNeighbors(nodeId);
  } catch (error) {
    logger.error(`Error getting children for node ${nodeId}:`, error);
    return [];
  }
}
export function safeAddNode(graph: TaskGraph, nodeId: string): void {
  try {
    graph.mergeNode(nodeId);
  } catch (error) {
    logger.error(`Error adding node ${nodeId} to graph:`, error);
  }
}
/**
 * Check if adding an edge would create a cycle in the graph.
 * Returns true if adding sourceId -> targetId would create a cycle.
 */
function wouldCreateCycle(graph: TaskGraph, sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true;
  // If targetId can already reach sourceId, adding sourceId -> targetId creates a cycle
  const successorsOfTarget = getSuccessors(graph, targetId);
  return successorsOfTarget.includes(sourceId);
}
export function safeAddEdge(graph: TaskGraph, sourceId: string, targetId: string): void {
  try {
    if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) {
      logger.warn(`Cannot add edge from ${sourceId} to ${targetId}: one or both nodes don't exist`);
      return;
    }
    // Check for cycles before adding
    if (wouldCreateCycle(graph, sourceId, targetId)) {
      logger.warn(
        `[Graph] Cycle detected: Cannot add edge from ${sourceId} to ${targetId}. Skipping.`
      );
      return;
    }
    graph.mergeEdge(sourceId, targetId);
  } catch (error) {
    logger.error(`Error adding edge from ${sourceId} to ${targetId}:`, error);
  }
}
export function createGraph(): TaskGraph {
  return new DirectedTaskGraph();
}
