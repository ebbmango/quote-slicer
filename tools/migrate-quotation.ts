import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { migrateQuotation } from '../src/lib/legacyMigration.ts';

// ponytail: parse literal exports with the installed TypeScript parser; never execute input.
function literal(node: ts.Node): unknown {
	if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
	if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(p => {
		if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) throw new Error('Only literal object properties are supported');
		return [p.name.text, literal(p.initializer)];
	}));
	if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
	if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isStringLiteral(node) ? node.text : Number(node.text);
	if (node.kind === ts.SyntaxKind.NullKeyword) return null;
	if (ts.isIdentifier(node) && node.text === 'undefined') return undefined;
	throw new Error('Input must contain data literals, not executable expressions');
}

try {
	const files = process.argv.slice(2);
	if (!files.length) throw new Error('Usage: node tools/migrate-quotation.ts <quotation.json|quotation.ts> [...]');
	for (const path of files) {
		const text = readFileSync(path, 'utf8');
		let input: unknown;
		if (path.endsWith('.json')) input = JSON.parse(text);
		else {
			const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
			const values = source.statements.filter(ts.isVariableStatement).flatMap(s => s.declarationList.declarations).filter(d => d.initializer);
			if (values.length !== 1) throw new Error(`${path}: expected exactly one literal quotation declaration`);
			input = literal(values[0].initializer!);
		}
		console.log(JSON.stringify({ path, ...migrateQuotation(input) }, null, 2));
	}
} catch (error) {
	console.error((error as Error).message);
	process.exitCode = 1;
}
