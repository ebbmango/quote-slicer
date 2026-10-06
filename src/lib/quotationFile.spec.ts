import { describe, expect, it } from 'vitest';
import type { AttestationTranslationAlignment } from './quotation';
import {
	buildQuotationFile,
	formatQuotationFile,
	QUOTATION_FORMAT_VERSION,
	quotationFileProblems,
	type QuotationFile
} from './quotationFile';

const data: AttestationTranslationAlignment = {
	attestation: {
		tokens: [
			{ id: 0, text: '你', type: 'character', pinyin: 'ni3' },
			{ id: 1, text: '好', type: 'character', pinyin: undefined },
			{ id: 2, text: '。', type: 'punctuation', pinyin: null },
			{ id: 3, text: '一', type: 'character' }
		]
	},
	translation: { tokens: [{ id: 0, text: 'hello', type: 'text' }] },
	alignment: {
		mappings: [{ id: 'm1', sourceTokenIds: [0, 1], targetTokenIds: [0] }],
		breaks: { attestation: [], translation: [] }
	}
};

/** L001I-Q01-blocked-breath.json, exactly as Verbarium's docs/quotation-contract.md prints it. */
const verbariumExample = `{
  "formatVersion": 1,
  "provenance": "Shuowen Jiezi, 丂部, 丂 entry",
  "sourceLink": "https://ctext.org/shuo-wen-jie-zi/kao-bu#:~:text=%E4%B8%82%EF%BC%9A%E6%B0%94%E6%AC%B2%E8%88%92%E5%87%BA%E3%80%82%F0%A0%83%91%E4%B8%8A%E7%A4%99%E6%96%BC%E4%B8%80%E4%B9%9F%E3%80%82",
  "attestation": {
    "tokens": [
      { "id": 0, "text": "气", "pinyin": "qi4", "type": "character" },
      { "id": 1, "text": "欲", "pinyin": "yu4", "type": "character" },
      { "id": 2, "text": "舒", "pinyin": "shu1", "type": "character" },
      { "id": 3, "text": "出", "pinyin": "chu1", "type": "character" },
      { "id": 4, "text": "。", "pinyin": null, "type": "punctuation" },
      { "id": 5, "text": "𠃑", "type": "character" },
      { "id": 6, "text": "上", "pinyin": "shang4", "type": "character" },
      { "id": 7, "text": "礙", "pinyin": "ai4", "type": "character" },
      { "id": 8, "text": "於", "pinyin": "yu2", "type": "character" },
      { "id": 9, "text": "一", "pinyin": "yi1", "type": "character" },
      { "id": 10, "text": "也", "pinyin": "ye3", "type": "character" },
      { "id": 11, "text": "。", "pinyin": null, "type": "punctuation" }
    ]
  },
  "translation": {
    "tokens": [
      { "id": 0, "text": "Air", "type": "text" },
      { "id": 1, "text": " ", "type": "whitespace" },
      { "id": 2, "text": "wishes", "type": "text" },
      { "id": 3, "text": " ", "type": "whitespace" },
      { "id": 4, "text": "to", "type": "text" },
      { "id": 5, "text": " ", "type": "whitespace" },
      { "id": 6, "text": "come", "type": "text" },
      { "id": 7, "text": " ", "type": "whitespace" },
      { "id": 8, "text": "out.", "type": "text" },
      { "id": 26, "text": " ", "type": "whitespace" },
      { "id": 9, "text": "The", "type": "text" },
      { "id": 10, "text": " ", "type": "whitespace" },
      { "id": 11, "text": "upward", "type": "text" },
      { "id": 12, "text": " ", "type": "whitespace" },
      { "id": 13, "text": "flow", "type": "text" },
      { "id": 14, "text": " ", "type": "whitespace" },
      { "id": 15, "text": "is", "type": "text" },
      { "id": 16, "text": " ", "type": "whitespace" },
      { "id": 17, "text": "blocked", "type": "text" },
      { "id": 18, "text": " ", "type": "whitespace" },
      { "id": 19, "text": "by", "type": "text" },
      { "id": 20, "text": " ", "type": "whitespace" },
      { "id": 21, "text": "the", "type": "text" },
      { "id": 22, "text": " ", "type": "whitespace" },
      { "id": 23, "text": "horizontal", "type": "text" },
      { "id": 24, "text": " ", "type": "whitespace" },
      { "id": 25, "text": "stroke.", "type": "text" }
    ]
  },
  "alignment": {
    "mappings": [
      { "id": "260d4e56-1d22-4fb2-b83c-71e0f1faebda", "sourceTokenIds": [0], "targetTokenIds": [0] },
      { "id": "a5c64e6f-cc17-4fd0-b55c-14dc0252e0fe", "sourceTokenIds": [1], "targetTokenIds": [2] },
      { "id": "4b502b94-bf72-43b6-874f-b3877c908625", "sourceTokenIds": [2], "targetTokenIds": [6] },
      { "id": "ff5b3819-37a9-4313-af90-f6ea3b62bbda", "sourceTokenIds": [3], "targetTokenIds": [8] },
      { "id": "2abb8f7c-9c84-419b-af32-5ff29723bdbf", "sourceTokenIds": [5], "targetTokenIds": [13] },
      { "id": "b4fe3918-42dc-46d1-a507-ddf42dc800f9", "sourceTokenIds": [6], "targetTokenIds": [11] },
      { "id": "835ccda4-ff64-4fa1-9b42-69e2dd4f643b", "sourceTokenIds": [7], "targetTokenIds": [17] },
      { "id": "4073a610-fdfb-49e1-90d1-42ee25e7e4a1", "sourceTokenIds": [8], "targetTokenIds": [19] },
      { "id": "35855a8f-b7d1-405c-95b6-3002243164db", "sourceTokenIds": [9], "targetTokenIds": [23, 25] },
      { "id": "434b77e0-37d9-418e-a365-ab2493e20488", "sourceTokenIds": [10], "targetTokenIds": [15] }
    ],
    "breaks": {
      "attestation": [],
      "translation": [10]
    }
  }
}
`;

describe('buildQuotationFile', () => {
	it('carries the format version and the trimmed provenance, and leaves a blank source link out', () => {
		const file = buildQuotationFile(data, { provenance: ' Shuowen Jiezi ' });
		expect(file.formatVersion).toBe(QUOTATION_FORMAT_VERSION);
		expect(file.provenance).toBe('Shuowen Jiezi');
		expect('sourceLink' in file).toBe(false);

		const linked = buildQuotationFile(data, {
			provenance: 'x',
			sourceLink: ' https://ctext.org/x '
		});
		expect(linked.sourceLink).toBe('https://ctext.org/x');
		expect(
			buildQuotationFile(data, { provenance: 'x', sourceLink: '  ' }).sourceLink
		).toBeUndefined();
	});

	it('keeps the three pinyin states apart without any undefined', () => {
		const { tokens } = buildQuotationFile(data, { provenance: 'x' }).attestation;
		expect(tokens[0].pinyin).toBe('ni3');
		expect(Object.hasOwn(tokens[1], 'pinyin')).toBe(false);
		expect(tokens[2].pinyin).toBeNull();
		expect(Object.hasOwn(tokens[3], 'pinyin')).toBe(false);
		expect(Object.keys(tokens[0])).toEqual(['id', 'text', 'pinyin', 'type']);
		expect(Object.keys(tokens[1])).toEqual(['id', 'text', 'type']);
	});

	it('does not share arrays with the export it was built from', () => {
		const file = buildQuotationFile(data, { provenance: 'x' });
		file.alignment.mappings[0].sourceTokenIds.push(99);
		file.alignment.breaks.translation.push(1);
		expect(data.alignment.mappings[0].sourceTokenIds).toEqual([0, 1]);
		expect(data.alignment.breaks.translation).toEqual([]);
	});
});

describe('quotationFileProblems', () => {
	it('finds nothing wrong with a file Verbarium accepts', () => {
		expect(quotationFileProblems(JSON.parse(verbariumExample))).toEqual([]);
	});

	it('names a source link that is not a web address', () => {
		const notAnAddress = ['The source link is not an http or https address.'];
		const problemsFor = (sourceLink: string) =>
			quotationFileProblems(buildQuotationFile(data, { provenance: 'x', sourceLink }));
		expect(problemsFor('ctext.org/x')).toEqual(notAnAddress);
		expect(problemsFor('ftp://x')).toEqual(notAnAddress);
		expect(problemsFor('https://ctext.org/x\ny')).toEqual(notAnAddress);
		expect(problemsFor('https://ctext.org/x y')).toEqual(notAnAddress);
		expect(problemsFor('https://ctext.org/x#:~:text=a')).toEqual([]);
	});

	it('names an empty provenance and outer whitespace, which the workbench lets through', () => {
		const file = buildQuotationFile(
			{
				...data,
				attestation: { tokens: [{ id: 0, text: ' ', type: 'symbol' }, ...data.attestation.tokens] },
				translation: {
					tokens: [...data.translation.tokens, { id: 1, text: ' ', type: 'whitespace' }]
				}
			},
			{ provenance: '  ' }
		);
		expect(quotationFileProblems(file)).toEqual([
			'The provenance is empty.',
			'The source text starts or ends with whitespace.',
			'The translation starts or ends with whitespace.'
		]);
	});
});

describe('formatQuotationFile', () => {
	it('writes exactly the layout Verbarium commits', () => {
		const file = JSON.parse(verbariumExample) as QuotationFile;
		expect(formatQuotationFile(file)).toBe(verbariumExample);
		expect(
			formatQuotationFile(
				buildQuotationFile(file, { provenance: file.provenance, sourceLink: file.sourceLink })
			)
		).toBe(verbariumExample);
	});

	it('round-trips through JSON.parse and ends with one newline', () => {
		const file = buildQuotationFile(data, { provenance: 'Says "so" \\ 𠃑' });
		const text = formatQuotationFile(file);
		expect(JSON.parse(text)).toEqual(file);
		expect(text.endsWith('}\n')).toBe(true);
		expect(text.endsWith('\n\n')).toBe(false);
		expect(text).toContain('{ "id": 1, "text": "好", "type": "character" }');
		expect(text).toContain('{ "id": 2, "text": "。", "pinyin": null, "type": "punctuation" }');
	});
});
