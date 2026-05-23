const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../src/config/db');
const Note = require('../src/models/noteModel');
const Project = require('../src/models/projectModel');

const APPLY = process.argv.includes('--apply');

const HOURS_PER_UNIT = {
  hour: 1,
  day: 8,
  week: 40,
  month: 160,
};

function convertHoursToUnit(hours, unit) {
  const divisor = HOURS_PER_UNIT[unit] || 8;
  if (unit === 'hour') return hours;
  return Math.round((hours / divisor) * 100) / 100;
}

async function main() {
  await connectDB();

  // 1. timeUnit on projects
  const projectsMissingUnit = await Project.find({
    $or: [{ timeUnit: { $exists: false } }, { timeUnit: null }],
  }).select('_id');
  console.log(`Projects missing timeUnit: ${projectsMissingUnit.length}`);
  if (APPLY && projectsMissingUnit.length) {
    const r = await Project.updateMany(
      { $or: [{ timeUnit: { $exists: false } }, { timeUnit: null }] },
      { $set: { timeUnit: 'day' } },
    );
    console.log(`  -> set timeUnit on ${r.modifiedCount} projects`);
  }

  const projects = await Project.find({}).select('_id timeUnit').lean();
  const unitByProject = new Map(
    projects.map((p) => [String(p._id), p.timeUnit || 'day']),
  );

  // 2. Note.duration from estimatedHours
  const notesNeedingDuration = await Note.find({
    $and: [
      { $or: [{ duration: { $exists: false } }, { duration: 0 }, { duration: null }] },
      { estimatedHours: { $gt: 0 } },
    ],
  }).select('_id project estimatedHours').lean();
  console.log(`Notes needing duration backfill: ${notesNeedingDuration.length}`);
  let durationUpdates = 0;
  for (const n of notesNeedingDuration) {
    const unit = unitByProject.get(String(n.project)) || 'day';
    const dur = convertHoursToUnit(Number(n.estimatedHours) || 0, unit);
    if (APPLY) {
      await Note.updateOne({ _id: n._id }, { $set: { duration: dur } });
    }
    durationUpdates += 1;
  }
  console.log(`  -> ${APPLY ? 'wrote' : 'WOULD write'} duration on ${durationUpdates} notes`);

  // 3. Backfill actualEnd from done status
  const doneMissingEnd = await Note.find({
    status: 'done',
    $or: [{ actualEnd: { $exists: false } }, { actualEnd: null }],
  }).select('_id updatedAt').lean();
  console.log(`Done notes missing actualEnd: ${doneMissingEnd.length}`);
  if (APPLY && doneMissingEnd.length) {
    for (const n of doneMissingEnd) {
      await Note.updateOne({ _id: n._id }, { $set: { actualEnd: n.updatedAt } });
    }
    console.log(`  -> wrote actualEnd on ${doneMissingEnd.length} notes`);
  }

  // 4. Backfill actualStart for in-progress notes
  const inProgressMissingStart = await Note.find({
    status: { $ne: 'done' },
    progress: { $gt: 0 },
    $or: [{ actualStart: { $exists: false } }, { actualStart: null }],
  }).select('_id updatedAt progress duration project').lean();
  console.log(`In-progress notes missing actualStart: ${inProgressMissingStart.length}`);
  let startUpdates = 0;
  for (const n of inProgressMissingStart) {
    const unit = unitByProject.get(String(n.project)) || 'day';
    const hoursPerUnit = HOURS_PER_UNIT[unit] || 8;
    const elapsedHours = ((Number(n.progress) || 0) / 100) * (Number(n.duration) || 0) * hoursPerUnit;
    const start = new Date(new Date(n.updatedAt).getTime() - elapsedHours * 3600 * 1000);
    if (APPLY) {
      await Note.updateOne({ _id: n._id }, { $set: { actualStart: start } });
    }
    startUpdates += 1;
  }
  console.log(`  -> ${APPLY ? 'wrote' : 'WOULD write'} actualStart on ${startUpdates} notes`);

  console.log('\n--- Summary ---');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN (use --apply to commit)'}`);
  console.log(`Projects timeUnit updates: ${projectsMissingUnit.length}`);
  console.log(`Note duration updates: ${durationUpdates}`);
  console.log(`Note actualEnd updates: ${doneMissingEnd.length}`);
  console.log(`Note actualStart updates: ${startUpdates}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
