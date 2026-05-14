/*
  Unit tests for backend/src/services/scheduler.js
  Derived from project_management_study_guide.md §1.6 (running example).

  Run: node src/services/scheduler.test.js
  Expected exit code: 0
*/

const assert = require('node:assert');
const { computeSchedule } = require('./scheduler');

// ----- §1.6 running example -----
const tasks = [
  { id: 'A', duration: 3, dependencies: [] },
  { id: 'B', duration: 4, dependencies: ['A'] },
  { id: 'C', duration: 2, dependencies: ['A'] },
  { id: 'D', duration: 5, dependencies: ['B'] },
  { id: 'E', duration: 3, dependencies: ['B', 'C'] },
  { id: 'F', duration: 4, dependencies: ['C'] },
  { id: 'G', duration: 2, dependencies: ['D', 'E'] },
  { id: 'H', duration: 3, dependencies: ['F', 'G'] },
];

const { projectDuration, criticalPath, slacks } = computeSchedule(tasks);

// Project duration = 17
assert.strictEqual(projectDuration, 17, `projectDuration: expected 17, got ${projectDuration}`);

// Critical path = A → B → D → G → H
assert.deepStrictEqual(criticalPath, ['A', 'B', 'D', 'G', 'H'], `criticalPath mismatch: ${JSON.stringify(criticalPath)}`);

// Earliest / Latest starts (§1.7, §1.8)
const expectedES = { A: 0, B: 3, C: 3, D: 7, E: 7, F: 5, G: 12, H: 14 };
const expectedLS = { A: 0, B: 3, C: 7, D: 7, E: 9, F: 10, G: 12, H: 14 };
for (const id of Object.keys(expectedES)) {
  const s = slacks.get(id);
  assert.strictEqual(s.ES, expectedES[id], `${id}.ES: expected ${expectedES[id]}, got ${s.ES}`);
  assert.strictEqual(s.LS, expectedLS[id], `${id}.LS: expected ${expectedLS[id]}, got ${s.LS}`);
}

// Total slack (§1.9)
const expectedTotal = { A: 0, B: 0, C: 4, D: 0, E: 2, F: 5, G: 0, H: 0 };
for (const id of Object.keys(expectedTotal)) {
  assert.strictEqual(
    slacks.get(id).totalSlack,
    expectedTotal[id],
    `${id}.totalSlack: expected ${expectedTotal[id]}, got ${slacks.get(id).totalSlack}`,
  );
}

// Critical flag matches totalSlack === 0
for (const id of Object.keys(expectedTotal)) {
  assert.strictEqual(
    slacks.get(id).isCritical,
    expectedTotal[id] === 0,
    `${id}.isCritical mismatch`,
  );
}

// Free slack (§1.10) — note: terminal task H gets totalSlack==0 → freeSlack 0
const expectedFree = { A: 0, B: 0, C: 0, D: 0, E: 2, F: 5, G: 0, H: 0 };
for (const id of Object.keys(expectedFree)) {
  assert.strictEqual(
    slacks.get(id).freeSlack,
    expectedFree[id],
    `${id}.freeSlack: expected ${expectedFree[id]}, got ${slacks.get(id).freeSlack}`,
  );
}

// ----- Edge: empty -----
{
  const r = computeSchedule([]);
  assert.strictEqual(r.projectDuration, 0);
  assert.deepStrictEqual(r.criticalPath, []);
  assert.strictEqual(r.slacks.size, 0);
}

// ----- Edge: single task -----
{
  const r = computeSchedule([{ id: 'X', duration: 5, dependencies: [] }]);
  assert.strictEqual(r.projectDuration, 5);
  assert.deepStrictEqual(r.criticalPath, ['X']);
  assert.strictEqual(r.slacks.get('X').totalSlack, 0);
}

// ----- Edge: cycle detection -----
{
  let threw = false;
  try {
    computeSchedule([
      { id: 'A', duration: 1, dependencies: ['B'] },
      { id: 'B', duration: 1, dependencies: ['A'] },
    ]);
  } catch (err) {
    threw = err.message === 'Cycle detected in dependency graph';
  }
  assert.strictEqual(threw, true, 'cycle should throw Error("Cycle detected in dependency graph")');
}

// ----- Edge: dangling dependency reference (e.g. deleted task) -----
{
  const r = computeSchedule([
    { id: 'A', duration: 2, dependencies: [] },
    { id: 'B', duration: 3, dependencies: ['A', 'GHOST'] }, // GHOST does not exist
  ]);
  assert.strictEqual(r.projectDuration, 5);
  assert.strictEqual(r.slacks.get('B').ES, 2);
}

console.log('All scheduler tests pass.');
