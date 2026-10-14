import 'dotenv/config';
import assert from 'node:assert/strict';

const origin = 'http://localhost:3000';
const base = 'http://127.0.0.1:3001/api';
assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
assert.equal(new URL(process.env.DATABASE_URL).port, '5433');
const login = await fetch(`${base}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 201, 'Seeded admin can log in locally');
const { csrfToken } = await login.json();
const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
const headers = { cookie, origin, 'x-csrf-token': csrfToken };
async function read(path) {
  const response = await fetch(`${base}${path}`, { headers });
  assert.equal(response.status, 200, `GET ${path}`);
  return response.json();
}
try {
  const library = await read('/research-library?page=1&pageSize=20');
  assert.ok(library.total > 0);
  assert.ok(library.items.length <= 20);
  const history = await read('/research-library?view=retained');
  assert.ok(history.items.every((item) => item.reviewStatus === 'PUBLISHED'), 'Retracted works are excluded from link history');
  const issues = await read('/research-library?view=issues');
  assert.ok(issues.items.some((item) => item.reviewStatus === 'ARCHIVED'), 'Freshly imported retractions appear in source issues');
  const projects = await read('/projects/mine?view=all');
  assert.equal(projects.items.length, 1);
  const id = projects.items[0].researchItemId;
  const workspace = await read(`/projects/${id}/workspace`);
  assert.ok(workspace.tasks.length <= 20);
  assert.equal(workspace.taskSummary.completedTasks + workspace.taskSummary.openTasks, workspace._count.tasks);
  const tasks = await read(`/projects/${id}/tasks?page=2`);
  assert.equal(tasks.total, workspace._count.tasks);
  const summary = await read('/admin/jobs/summary');
  assert.ok(summary.registeredTypes.includes('SYNC_OPENALEX_AUTHOR'));
  assert.ok(!summary.registeredTypes.includes('DISCOVER_RESEARCH_SOURCE'));
  assert.ok(!summary.registeredTypes.includes('SYNC_SCHOLAR_PROFILE'));
  assert.equal(summary.health.neverSyncedProfiles, 0);
  for (const route of ['/research', '/research-review/not-a-uuid']) {
    const response = await fetch(`${base}${route}`, { method: 'POST', headers });
    assert.equal(response.status, 404, 'Manual research routes remain retired');
  }
  console.log('Local seeded admin API, catalogue pagination, project totals, worker health and retired routes passed.');
} finally {
  const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers });
  assert.ok(logout.ok, 'Test session is removed');
}
