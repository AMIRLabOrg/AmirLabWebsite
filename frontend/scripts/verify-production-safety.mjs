import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const failures = [];

for (const directory of ["src", "scripts"]) {
  for (const file of walk(path.join(root, directory)).filter((entry) =>
    /\.(ts|tsx|mjs)$/.test(entry),
  )) {
    inspect(file);
  }
}

if (failures.length) {
  console.error("Frontend production-safety verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Frontend production-safety source checks passed.");

function inspect(file) {
  const productionSource = file.includes(`${path.sep}src${path.sep}`);
  const text = fs.readFileSync(file, "utf8");
  const scriptKind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".ts")
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const visit = (node) => {
    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.NeverKeyword
    ) {
      fail(file, node, "unsafe `as never` assertion");
    }

    if (
      ts.isAsExpression(node) &&
      ts.isAsExpression(node.expression) &&
      node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
    ) {
      fail(file, node, "double assertion through unknown");
    }

    if (productionSource && ts.isNonNullExpression(node)) {
      fail(file, node, "non-null assertion in production code");
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
}

function fail(file, node, message) {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  failures.push(`${path.relative(root, file)}:${line + 1}: ${message}`);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
