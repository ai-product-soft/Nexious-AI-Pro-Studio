/**
 * Worker Graph
 * DAG-based execution planner for workers.
 * Determines parallel vs sequential execution and generates timeline data.
 */

export class WorkerGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map(); // adjacency: node -> Set(dependencies)
  }

  addNode(id, worker, duration = 1, metadata = {}) {
    this.nodes.set(id, { id, worker, duration, metadata, status: 'pending' });
    if (!this.edges.has(id)) {
      this.edges.set(id, new Set());
    }
  }

  addDependency(nodeId, dependencyId) {
    if (!this.nodes.has(nodeId) || !this.nodes.has(dependencyId)) {
      throw new Error(`Unknown node: ${nodeId} or ${dependencyId}`);
    }
    if (nodeId === dependencyId) {
      throw new Error('Self-dependency not allowed');
    }
    this.edges.get(nodeId).add(dependencyId);
  }

  validate() {
    const errors = [];

    // Detect cycles using DFS
    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const deps = this.edges.get(nodeId) || new Set();
      for (const dep of deps) {
        if (!visited.has(dep) && hasCycle(dep)) {
          return true;
        }
        if (recStack.has(dep)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const [id] of this.nodes) {
      if (!visited.has(id)) {
        if (hasCycle(id)) {
          errors.push('Circular dependency detected in worker graph');
          break;
        }
      }
    }

    // Check for orphaned dependencies
    const allDeps = new Set();
    for (const deps of this.edges.values()) {
      deps.forEach(d => allDeps.add(d));
    }

    const nodeIds = new Set(this.nodes.keys());
    const orphaned = [...allDeps].filter(d => !nodeIds.has(d));
    if (orphaned.length > 0) {
      errors.push(`Orphaned dependencies: ${orphaned.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  getExecutionPlan() {
    const inDegree = new Map();
    const nodes = this.nodes;

    // Initialize in-degree
    for (const [id] of nodes) {
      inDegree.set(id, 0);
    }

    // Calculate in-degree from edges
    for (const [id, deps] of this.edges) {
      for (const dep of deps) {
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }

    // Topological sort using Kahn's algorithm
    const queue = [];
    const result = [];
    const levels = new Map();

    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
        levels.set(id, 0);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levels.get(current);
      result.push({
        id: current,
        ...nodes.get(current),
        level: currentLevel
      });

      // Find nodes that depend on current (reverse edges)
      for (const [id, deps] of this.edges) {
        if (deps.has(current)) {
          const newDegree = inDegree.get(id) - 1;
          inDegree.set(id, newDegree);
          if (newDegree === 0) {
            queue.push(id);
            levels.set(id, currentLevel + 1);
          }
        }
      }
    }

    if (result.length !== nodes.size) {
      throw new Error('Cycle detected: cannot create execution plan');
    }

    // Group by level for parallel execution
    const groups = [];
    const maxLevel = Math.max(...levels.values());
    for (let i = 0; i <= maxLevel; i++) {
      groups.push(result.filter(n => n.level === i).map(n => n.id));
    }

    return {
      sequence: result,
      parallelGroups: groups,
      totalNodes: result.length,
      maxDepth: maxLevel + 1,
      estimatedDuration: this.calculateDuration(result, levels)
    };
  }

  calculateDuration(sequence, levels) {
    const levelDurations = new Map();
    for (const node of sequence) {
      const level = levels.get(node.id);
      const current = levelDurations.get(level) || 0;
      levelDurations.set(level, Math.max(current, node.duration));
    }
    return [...levelDurations.values()].reduce((a, b) => a + b, 0);
  }

  toGanttData() {
    const plan = this.getExecutionPlan();
    const ganttItems = [];
    let currentTime = 0;

    // Group by level
    const levelGroups = new Map();
    plan.sequence.forEach(node => {
      const level = node.level;
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level).push(node);
    });

    // Calculate start/end times per level
    const levelTimes = new Map();
    const maxLevel = Math.max(...plan.sequence.map(n => n.level));
    for (let i = 0; i <= maxLevel; i++) {
      const nodes = levelGroups.get(i) || [];
      const maxDuration = Math.max(...nodes.map(n => n.duration), 0);
      const startTime = currentTime;
      const endTime = startTime + maxDuration;

      nodes.forEach(node => {
        ganttItems.push({
          id: node.id,
          worker: node.worker,
          start: startTime,
          end: startTime + node.duration,
          duration: node.duration,
          level: i,
          dependencies: [...(this.edges.get(node.id) || [])]
        });
      });

      levelTimes.set(i, { start: startTime, end: endTime });
      currentTime = endTime;
    }

    return {
      items: ganttItems,
      totalDuration: currentTime,
      levelTimes: Object.fromEntries(levelTimes)
    };
  }
}

export default WorkerGraph;
