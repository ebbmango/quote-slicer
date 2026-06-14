import type { QuoteExport } from '$lib/tokenState';

function isPrimitive(v: unknown): boolean {
	return v === null || typeof v !== 'object';
}

const TOKEN_FIELDS = ['id', 'text', 'pinyin', 'line', 'type'] as const;

function isTokenObject(v: unknown): v is Record<string, unknown> {
	if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
	const entries = Object.entries(v as Record<string, unknown>);
	const keys = entries.map(([k]) => k);
	return (
		['id', 'text', 'line', 'type'].every((k) => keys.includes(k)) &&
		entries.every(([, val]) => isPrimitive(val))
	);
}

// undefined isn't valid JSON, but we display it literally for unannotated pinyin.
function formatValue(v: unknown): string {
	return v === undefined ? 'undefined' : JSON.stringify(v);
}

// Render "id": 1, "text": "你", ... — padding each field to colWidths so the
// same field lines up across every token in the array. Braces added by caller.
// `fields` is fixed per array (e.g. includes "pinyin" for source tokens) so every
// row has the same columns; missing values render as null.
function formatTokenBody(
	token: Record<string, unknown>,
	fields: readonly string[],
	colWidths: Record<string, number>
): string {
	return fields
		.map((k) => `${JSON.stringify(k)}: ${formatValue(token[k]).padEnd(colWidths[k] ?? 0)}`)
		.join(', ')
		.trimEnd();
}

// Like JSON.stringify(v, null, 2), but arrays of primitives are kept on one line
// so id lists (e.g. sourceTokenIds) don't each take their own row.
function formatJson(value: unknown, indent = 0): string {
	const pad = '  '.repeat(indent);
	const padInner = '  '.repeat(indent + 1);

	if (Array.isArray(value)) {
		if (value.length === 0) return '[]';
		if (value.every(isPrimitive)) {
			return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
		}
		if (value.every(isTokenObject)) {
			const tokens = value as Record<string, unknown>[];
			const fields = TOKEN_FIELDS.filter(
				(k) => k !== 'pinyin' || tokens.some((t) => 'pinyin' in t)
			);
			const colWidths: Record<string, number> = {};
			for (const t of tokens) {
				for (const k of fields) {
					colWidths[k] = Math.max(colWidths[k] ?? 0, formatValue(t[k]).length);
				}
			}
			const bodies = tokens.map((t) => formatTokenBody(t, fields, colWidths));
			const bodyWidth = Math.max(...bodies.map((b) => b.length));
			const items = bodies.map((b) => `${padInner}{ ${b.padEnd(bodyWidth)} }`);
			return `[\n${items.join(',\n')}\n${pad}]`;
		}
		const items = value.map((v) => padInner + formatJson(v, indent + 1));
		return `[\n${items.join(',\n')}\n${pad}]`;
	}

	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>);
		if (entries.length === 0) return '{}';
		const items = entries.map(
			([k, v]) => `${padInner}${JSON.stringify(k)}: ${formatJson(v, indent + 1)}`
		);
		return `{\n${items.join(',\n')}\n${pad}}`;
	}

	return JSON.stringify(value);
}

/**
 * Pretty-prints a QuoteExport for display. Like JSON.stringify(v, null, 2) but:
 * arrays of primitives stay on one line, and arrays of token objects render as a
 * column-aligned table (each field padded to its widest value across the array).
 */
export function formatExport(data: QuoteExport): string {
	return formatJson(data);
}
