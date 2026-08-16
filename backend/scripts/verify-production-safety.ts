import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const failures: string[] = [];

for (const file of walk(path.join(root, 'src')).filter((entry) =>
  entry.endsWith('.ts'),
)) {
  inspect(file);
}
for (const directory of ['scripts', 'test']) {
  for (const file of walk(path.join(root, directory)).filter((entry) =>
    entry.endsWith('.ts'),
  )) {
    inspect(file);
  }
}

if (failures.length) {
  console.error('Production-safety verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production-safety source checks passed.');

function inspect(file: string): void {
  const isSpec = file.endsWith('.spec.ts');
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.NeverKeyword
    ) {
      fail(file, node, 'unsafe `as never` assertion');
    }

    if (!isSpec && ts.isNonNullExpression(node)) {
      fail(file, node, 'non-null assertion in production code');
    }

    if (
      !isSpec &&
      ts.isAsExpression(node) &&
      ts.isAsExpression(node.expression) &&
      node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
    ) {
      fail(file, node, 'double assertion through unknown in production code');
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === '$transaction'
    ) {
      const callback = node.arguments[0];
      if (callback && ts.isArrayLiteralExpression(callback)) {
        fail(file, callback, 'concurrent Prisma array transaction');
      }
      if (
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        containsPromiseAll(callback.body)
      ) {
        fail(
          file,
          callback,
          'Promise.all inside a Prisma transaction callback',
        );
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
}

function containsPromiseAll(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      ts.isIdentifier(child.expression.expression) &&
      child.expression.expression.text === 'Promise' &&
      child.expression.name.text === 'all'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function fail(file: string, node: ts.Node, message: string): void {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  failures.push(`${path.relative(root, file)}:${line + 1}: ${message}`);
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
