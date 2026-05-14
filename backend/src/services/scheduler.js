/*
  CPM (Critical Path Method) scheduler — pure functions.
  Implements the math from project_management_study_guide.md Part 1:
    - Earliest start (forward pass)
    - Latest start (backward pass)
    - Total slack, free slack
    - Critical path

  No DB, no I/O. Takes plain task objects, returns plain results.

  Input shape:
    tasks: [{ id, duration, dependencies: [id] }]

  Output of computeSchedule(tasks):
    {
      projectDuration: Number,
      criticalPath: [id, ...],          // one canonical path
      criticalSet: Set<id>,             // all tasks where totalSlack === 0
      slacks: Map<id, {
        ES, EF, LS, LF, totalSlack, freeSlack, isCritical
      }>
    }

  Throws Error('Cycle detected in dependency graph') if dependencies form a cycle.
*/

function buildGraph(tasks) {
  const nodes = new Set();
  const durations = new Map();
  const predecessors = new Map();
  const successors = new Map();

  for (const t of tasks || []) {
    const id = String(t.id);
    nodes.add(id);
    durations.set(id, Number(t.duration) || 0);
    if (!predecessors.has(id)) predecessors.set(id, []);
    if (!successors.has(id)) successors.set(id, []);
  }

  for (const t of tasks || []) {
    const tid = String(t.id);
    for (const dep of t.dependencies || []) {
      const did = String(dep);
      if (!nodes.has(did)) continue; // skip dangling refs (deleted task, cross-project, etc.)
      if (did === tid) continue; // skip self-loop defensively
      predecessors.get(tid).push(did);
      successors.get(did).push(tid);
    }
  }

  return { nodes, durations, predecessors, successors };
}

function topologicalSort(graph) {
  const { nodes, predecessors, successors } = graph;
  const indeg = new Map();
  for (const id of nodes) indeg.set(id, predecessors.get(id).length);

  const queue = [];
  for (const id of nodes) {
    if (indeg.get(id) === 0) queue.push(id);
  }

  const out = [];
  while (queue.length) {
    const n = queue.shift();
    out.push(n);
    for (const s of successors.get(n) || []) {
      indeg.set(s, indeg.get(s) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }

  if (out.length !== nodes.size) {
    throw new Error('Cycle detected in dependency graph');
  }
  return out;
}

function forwardPass(graph) {
  const order = topologicalSort(graph);
  const ES = new Map();
  const EF = new Map();
  for (const id of order) {
    const preds = graph.predecessors.get(id);
    const es = preds.length === 0 ? 0 : Math.max(...preds.map((p) => EF.get(p)));
    ES.set(id, es);
    EF.set(id, es + graph.durations.get(id));
  }
  return { ES, EF, order };
}

function backwardPass(graph, projectDuration, forwardOrder) {
  const order = (forwardOrder || topologicalSort(graph)).slice().reverse();
  const LS = new Map();
  const LF = new Map();
  for (const id of order) {
    const succs = graph.successors.get(id);
    const lf = succs.length === 0 ? projectDuration : Math.min(...succs.map((s) => LS.get(s)));
    LF.set(id, lf);
    LS.set(id, lf - graph.durations.get(id));
  }
  return { LS, LF };
}

function computeSlacks(graph, forward, backward) {
  const { ES, EF } = forward;
  const { LS, LF } = backward;
  const result = new Map();
  for (const id of graph.nodes) {
    const totalSlack = LS.get(id) - ES.get(id);
    const succs = graph.successors.get(id);
    let freeSlack;
    if (succs.length === 0) {
      // For terminal tasks, free slack equals total slack: anything pushed
      // beyond ES still has to fit before the project ends.
      freeSlack = totalSlack;
    } else {
      freeSlack = Math.min(...succs.map((s) => ES.get(s) - EF.get(id)));
    }
    result.set(id, {
      ES: ES.get(id),
      EF: EF.get(id),
      LS: LS.get(id),
      LF: LF.get(id),
      totalSlack,
      freeSlack: Math.max(0, freeSlack),
      isCritical: totalSlack === 0,
    });
  }
  return result;
}

function findCriticalPath(graph, slacks) {
  // Walk from a critical task with no critical predecessor.
  // Tie-break: among critical successors, pick the one with greatest EF
  // (the one driving the chain). For well-formed graphs this gives the canonical path.
  const isCritical = (id) => slacks.get(id)?.isCritical;

  const roots = [];
  for (const id of graph.nodes) {
    if (!isCritical(id)) continue;
    const preds = graph.predecessors.get(id) || [];
    if (preds.every((p) => !isCritical(p))) roots.push(id);
  }
  if (roots.length === 0) return [];

  // Pick the root whose forward chain is longest (deterministic).
  let best = [];
  for (const root of roots) {
    const path = [root];
    let current = root;
    const seen = new Set([current]);
    while (true) {
      const succs = (graph.successors.get(current) || []).filter(isCritical);
      if (succs.length === 0) break;
      // Among critical successors, prefer one whose EF is largest (deepest chain).
      let next = succs[0];
      for (const s of succs) {
        if (slacks.get(s).EF > slacks.get(next).EF) next = s;
      }
      if (seen.has(next)) break; // cycle safeguard (shouldn't happen with critical slack)
      path.push(next);
      seen.add(next);
      current = next;
    }
    if (path.length > best.length) best = path;
  }
  return best;
}

function computeSchedule(tasks) {
  const graph = buildGraph(tasks);
  if (graph.nodes.size === 0) {
    return { projectDuration: 0, criticalPath: [], criticalSet: new Set(), slacks: new Map() };
  }
  const forward = forwardPass(graph);
  const projectDuration = forward.EF.size === 0
    ? 0
    : Math.max(...forward.EF.values());
  const backward = backwardPass(graph, projectDuration, forward.order);
  const slacks = computeSlacks(graph, forward, backward);
  const criticalPath = findCriticalPath(graph, slacks);
  const criticalSet = new Set();
  for (const [id, s] of slacks.entries()) {
    if (s.isCritical) criticalSet.add(id);
  }
  return { projectDuration, criticalPath, criticalSet, slacks };
}

/*
  Resource loading curve — sums peopleRequired of all tasks active at each
  integer time step in [0, projectDuration]. Pure function over scheduleTasks
  (the array returned by the schedule endpoint or computed locally).

  Input:
    scheduleTasks: [{ id, ES, duration, peopleRequired }]
    projectDuration: Number
  Output:
    { peak, points: [{ t, demand }] }
*/
function computeResourceCurve(scheduleTasks, projectDuration) {
  const points = [];
  const D = Math.max(0, Math.ceil(Number(projectDuration) || 0));
  if (!Array.isArray(scheduleTasks) || scheduleTasks.length === 0 || D === 0) {
    return { peak: 0, points: [{ t: 0, demand: 0 }] };
  }

  let peak = 0;
  for (let t = 0; t <= D; t += 1) {
    let demand = 0;
    for (const task of scheduleTasks) {
      const es = Number(task.ES) || 0;
      const dur = Number(task.duration) || 0;
      const r = Number(task.peopleRequired) || 0;
      if (dur <= 0) continue;
      const ef = es + dur;
      // Task active during half-open interval [es, ef).
      if (t >= es && t < ef) demand += r;
    }
    if (demand > peak) peak = demand;
    points.push({ t, demand });
  }

  return { peak, points };
}

module.exports = {
  buildGraph,
  topologicalSort,
  forwardPass,
  backwardPass,
  computeSlacks,
  findCriticalPath,
  computeSchedule,
  computeResourceCurve,
};
