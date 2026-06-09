import { MAPPING_COLORS } from '$lib/constants/colors';
import type { RawTargetToken } from '$lib/tokenize';

export type MappingId = string;

export type Mapping = {
	id: MappingId;
	colorIndex: number;
	sourceIndices: number[];
	targetIndices: number[];
	pinyin: string[]; // parallel to sourceIndices
};

export type TokenState =
	| { kind: 'unmapped' }
	| { kind: 'idle'; color: string }
	| { kind: 'active'; color: string };

export function deriveSourceTokenState(
	i: number,
	sourceMappingIndex: Map<number, MappingId>,
	mappings: Mapping[],
	activeMappingId: MappingId | null
): TokenState {
	const claimed = sourceMappingIndex.get(i);
	if (claimed === undefined) return { kind: 'unmapped' };
	const m = mappings.find((x) => x.id === claimed)!;
	const color = MAPPING_COLORS[m.colorIndex % MAPPING_COLORS.length].source;
	if (claimed === activeMappingId) return { kind: 'active', color };
	return { kind: 'idle', color };
}

// Whitespace bridging rule: a whitespace token inherits the state of its nearest
// non-whitespace neighbors on both sides if they belong to the same mapping.
function findBridgeMappingId(
	i: number,
	targetTokens: RawTargetToken[],
	targetMappingIndex: Map<number, MappingId>
): MappingId | undefined {
	let left: MappingId | undefined;
	for (let k = i - 1; k >= 0; k--) {
		if (targetTokens[k]?.type !== 'whitespace') {
			left = targetMappingIndex.get(k);
			break;
		}
	}
	let right: MappingId | undefined;
	for (let k = i + 1; k < targetTokens.length; k++) {
		if (targetTokens[k]?.type !== 'whitespace') {
			right = targetMappingIndex.get(k);
			break;
		}
	}
	return left !== undefined && left === right ? left : undefined;
}

export function deriveTargetTokenState(
	i: number,
	targetTokens: RawTargetToken[],
	targetMappingIndex: Map<number, MappingId>,
	mappings: Mapping[],
	activeMappingId: MappingId | null
): TokenState {
	const claimed = targetMappingIndex.get(i);
	if (claimed === undefined) {
		if (targetTokens[i]?.type === 'whitespace') {
			const bridgeId = findBridgeMappingId(i, targetTokens, targetMappingIndex);
			if (bridgeId !== undefined) {
				const m = mappings.find((x) => x.id === bridgeId)!;
				const color = MAPPING_COLORS[m.colorIndex % MAPPING_COLORS.length].target;
				if (bridgeId === activeMappingId) return { kind: 'active', color };
				return { kind: 'idle', color };
			}
		}
		return { kind: 'unmapped' };
	}
	const m = mappings.find((x) => x.id === claimed)!;
	const color = MAPPING_COLORS[m.colorIndex % MAPPING_COLORS.length].target;
	if (claimed === activeMappingId) return { kind: 'active', color };
	return { kind: 'idle', color };
}
