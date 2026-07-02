import { describe, it, expect } from 'vitest';
import { toCanonical, toDisplay } from '$lib/pinyinConvert';

describe('toCanonical', () => {
	it('converts diacritic pinyin to numbered for all tones', () => {
		expect(toCanonical('mā')).toBe('ma1');
		expect(toCanonical('má')).toBe('ma2');
		expect(toCanonical('mǎ')).toBe('ma3');
		expect(toCanonical('mà')).toBe('ma4');
	});

	it('keeps already-numbered canonical pinyin', () => {
		expect(toCanonical('zhi1')).toBe('zhi1');
		expect(toCanonical('de0')).toBe('de0');
	});

	it('lowercases and trims input', () => {
		expect(toCanonical('  Zhī  ')).toBe('zhi1');
		expect(toCanonical('ZHI1')).toBe('zhi1');
	});

	it('assigns neutral tone to bare toneless pinyin syllables', () => {
		expect(toCanonical('zhi')).toBe('zhi0');
		expect(toCanonical('ma')).toBe('ma0');
		expect(toCanonical('er')).toBe('er0');
	});

	it('normalizes the v→ü typing convention in all branches', () => {
		expect(toCanonical('nv')).toBe('nü0'); // toneless
		expect(toCanonical('lve')).toBe('lüe0'); // toneless
		expect(toCanonical('lv2')).toBe('lü2'); // numbered
		expect(toCanonical('nv3')).toBe('nü3'); // numbered
		expect(toCanonical('lve4')).toBe('lüe4'); // numbered
		expect(toCanonical('lǘ')).toBe('lü2'); // diacritic
	});

	it('validates numbered input against the syllable table', () => {
		expect(toCanonical('abc1')).toBeNull(); // matches shape but not a real syllable
		expect(toCanonical('xyz2')).toBeNull();
	});

	it('returns null for non-syllable free-text notes', () => {
		expect(toCanonical('river')).toBeNull();
		expect(toCanonical('a place name')).toBeNull();
		expect(toCanonical('xyz')).toBeNull();
		expect(toCanonical('')).toBeNull();
	});
});

describe('toDisplay', () => {
	it('converts canonical numbered pinyin to diacritic', () => {
		expect(toDisplay('zhi1')).toBe('zhī');
		expect(toDisplay('ma3')).toBe('mǎ');
	});

	it('renders ü-family syllables with the dieresis', () => {
		expect(toDisplay('lü2')).toBe('lǘ');
		expect(toDisplay('lüe4')).toBe('lüè');
		expect(toDisplay('nü3')).toBe('nǚ');
	});

	it('renders neutral tone without a mark', () => {
		expect(toDisplay('de0')).toBe('de');
		expect(toDisplay('ma0')).toBe('ma');
	});

	it('passes through non-canonical raw text unchanged', () => {
		expect(toDisplay('river')).toBe('river');
		expect(toDisplay('')).toBe('');
	});
});

describe('round-trip', () => {
	it('diacritic → canonical → diacritic for tones 1-4', () => {
		for (const d of ['mā', 'má', 'mǎ', 'mà']) {
			const canonical = toCanonical(d);
			expect(canonical).not.toBeNull();
			expect(toDisplay(canonical as string)).toBe(d);
		}
	});
});
