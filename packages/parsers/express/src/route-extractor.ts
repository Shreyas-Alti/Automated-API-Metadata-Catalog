import * as ts from 'typescript';
import type { ParsedRoute, SourceLocation } from '@api-catalog/contracts';

const HTTP_METHODS = new Set([
  'get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'all',
]);

/**
 * Extract Express-style route declarations from a single source file.
 * Handles: app.get('/path', ...), router.post('/path', ...), etc.
 * Uses TypeScript's compiler API for robust parsing of both .js and .ts files.
 */
export function extractRoutesFromSource(filePath: string, source: string): ParsedRoute[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.Unknown,
  );

  const routes: ParsedRoute[] = [];

  function getLocation(node: ts.Node): SourceLocation {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { file: filePath, line: line + 1 };
  }

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text.toLowerCase();
        if (HTTP_METHODS.has(methodName) && node.arguments.length >= 1) {
          const firstArg = node.arguments[0];
          if (ts.isStringLiteral(firstArg)) {
            routes.push({
              method: methodName === 'all' ? '*' : methodName.toUpperCase(),
              path: firstArg.text,
              sourceLocation: getLocation(node),
            });
          }
          // Template literals like `\`/users/${id}\`` — skip for Phase 1
          // Regex route patterns — skip for Phase 1
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return routes;
}
