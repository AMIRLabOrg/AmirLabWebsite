import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const main = read('src/main.ts');
const filter = read('src/common/api-exception.filter.ts');
const reviewProblem = read('src/common/review-problem.ts');

expect(
  main.includes('app.useGlobalFilters(new ApiExceptionFilter())'),
  'ApiExceptionFilter must remain registered globally.',
);
expect(
  !filter.includes('message: raw'),
  'The raw backend exception must never be returned as the public message.',
);
expect(
  filter.includes('defaultPublicMessage'),
  'The exception boundary must provide safe status-based fallback messages.',
);
expect(
  filter.includes('publicMessage'),
  'Explicit domain-safe public messages must be supported.',
);
expect(
  reviewProblem.includes('publicMessage'),
  'Review helpers must provide public-safe domain messages.',
);
expect(
  reviewProblem.includes('issues'),
  'Review helpers must support item-specific issues.',
);

if (failures.length) {
  console.error('API boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('API error boundary contracts verified.');
