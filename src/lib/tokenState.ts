import { MAPPING_COLORS } from '$lib/constants/colors';
import type { ThemeName } from '$lib/types';
import type { SourceToken, TargetToken } from '$lib/tokenize';

export type MappingId = string;

// buildTargetText groups selected target tokens whose indices are at most this
// far apart (with only whitespace/punctuation in between) into one run instead
// of comma-joining them.
const MAX_BRIDGE_GAP = 5;

export type Mapping = {
	id: MappingId;
	colorIndex: number;
	sourceTokenIds: number[]; // token ids, stable across split/merge
	targetTokenIds: number[]; // token ids, stable across split/merge
};

export type QuoteExportMeta = {
	sourceText: string;
	targetText: string;
	authorship: string;
};

export type ExportMapping = Omit<Mapping, 'colorIndex'>;

export type QuoteExport = {
	meta: QuoteExportMeta;
	sourceTokens: SourceToken[];
	targetTokens: TargetToken[];
	mappings: ExportMapping[];
};

export type TokenState =
	| { kind: 'unmapped' }
	| { kind: 'idle'; color: string }
	| { kind: 'active'; color: string };

// Maps each token index to the Mapping that claims it. Owns the id→index
// translation so the index-building is testable without a live Alignment.
export function buildMappingIndex(
	mappings: Mapping[],
	idToIndex: Map<number, number>,
	tokenIds: (m: Mapping) => number[]
): Map<number, Mapping> {
	const index = new Map<number, Mapping>();
	for (const m of mappings) {
		for (const id of tokenIds(m)) {
			const idx = idToIndex.get(id);
			if (idx !== undefined) index.set(idx, m);
		}
	}
	return index;
}

export function deriveSourceTokenState(
	i: number,
	index: Map<number, Mapping>,
	activeMappingId: MappingId | null,
	themeName: ThemeName = 'light'
): TokenState {
	const m = index.get(i);
	if (m === undefined) return { kind: 'unmapped' };
	const color = MAPPING_COLORS[m.colorIndex % MAPPING_COLORS.length][themeName].source;
	return { kind: m.id === activeMappingId ? 'active' : 'idle', color };
}

// Whitespace bridging rule: a whitespace token inherits the state of its nearest
// non-whitespace neighbors on both sides if they belong to the same mapping.
function findBridgeMapping(
	i: number,
	targetTokens: TargetToken[],
	index: Map<number, Mapping>
): Mapping | undefined {
	let left: Mapping | undefined;
	for (let k = i - 1; k >= 0; k--) {
		if (targetTokens[k]?.type !== 'whitespace') {
			left = index.get(k);
			break;
		}
	}
	let right: Mapping | undefined;
	for (let k = i + 1; k < targetTokens.length; k++) {
		if (targetTokens[k]?.type !== 'whitespace') {
			right = index.get(k);
			break;
		}
	}
	return left !== undefined && left === right ? left : undefined;
}

export function buildTargetText(targetIndices: number[], targetTokens: TargetToken[]): string {
	if (!targetIndices.length || !targetTokens.length) return '';
	const sorted = [...targetIndices].sort((a, b) => a - b);
	const groups: number[][] = [[sorted[0]]];
	for (let i = 1; i < sorted.length; i++) {
		const group = groups[groups.length - 1];
		const prev = group[group.length - 1];
		const curr = sorted[i];
		let bridgeable = curr - prev <= MAX_BRIDGE_GAP;
		for (let k = prev + 1; bridgeable && k < curr; k++) {
			const t = targetTokens[k];
			bridgeable = t?.type === 'whitespace' || t?.type === 'punctuation';
		}
		if (bridgeable) group.push(curr);
		else groups.push([curr]);
	}
	return groups
		.map((group) => {
			let text = '';
			for (let i = group[0]; i <= group[group.length - 1]; i++) text += targetTokens[i]?.text ?? '';
			return text;
		})
		.join(', ');
}

export function deriveTargetTokenState(
	i: number,
	targetTokens: TargetToken[],
	index: Map<number, Mapping>,
	activeMappingId: MappingId | null,
	themeName: ThemeName = 'light'
): TokenState {
	let m = index.get(i);
	if (m === undefined && targetTokens[i]?.type === 'whitespace') {
		m = findBridgeMapping(i, targetTokens, index);
	}
	if (m === undefined) return { kind: 'unmapped' };
	const color = MAPPING_COLORS[m.colorIndex % MAPPING_COLORS.length][themeName].target;
	return { kind: m.id === activeMappingId ? 'active' : 'idle', color };
}
