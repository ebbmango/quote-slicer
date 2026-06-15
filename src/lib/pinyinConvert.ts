// Canonical pinyin storage helpers.
//
// Canonical form = numbered pinyin, one syllable, lowercase letters + a single
// tone digit (0–4; 0 = neutral tone). This is the shape `pinyin-pro` emits with
// `toneType: 'num'` (e.g. 知 → "zhi1", 的 → "de0"). We store this canonical form
// so it is system-agnostic and easy to convert into other transliterations
// later (Wade-Giles, Zhuyin) — see docs/plans/canonical-pinyin-storage.md.
//
// The Mapping UI still shows and accepts diacritic pinyin ("zhī"); only the
// stored/exported value is canonical.

import { convert } from 'pinyin-pro';

// Precomposed tone-marked vowels used by diacritic pinyin.
const TONE_DIACRITICS = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

// A canonical numbered-pinyin syllable: ascii letters (plus bare ü) + tone digit.
const CANONICAL = /^[a-zü]+[0-4]$/;

// Splits a numbered syllable into its letters and tone digit for validation.
const SYLLABLE_TONE = /^([a-zü]+)([0-4])$/;

// Every valid toneless Mandarin pinyin syllable, as emitted by pinyin-pro
// (`toneType: 'none'`) over the CJK range. Used to tell toneless pinyin ("zhi")
// apart from free-text notes ("river") so only the former gets a neutral tone.
// prettier-ignore
const PINYIN_SYLLABLES = new Set<string>([
	"a", "ai", "an", "ang", "ao", "ba", "bai", "ban", "bang", "bao", "bei", "ben", "beng", "bi",
	"bian", "biao", "bie", "bin", "bing", "bo", "bu", "ca", "cai", "can", "cang", "cao", "ce",
	"cen", "ceng", "cha", "chai", "chan", "chang", "chao", "che", "chen", "cheng", "chi", "chong",
	"chou", "chu", "chua", "chuai", "chuan", "chuang", "chui", "chun", "chuo", "ci", "cong",
	"cou", "cu", "cuan", "cui", "cun", "cuo", "da", "dai", "dan", "dang", "dao", "de", "den",
	"deng", "di", "dia", "dian", "diao", "die", "ding", "diu", "dong", "dou", "du", "duan", "dui",
	"dun", "duo", "e", "ei", "en", "eng", "er", "fa", "fan", "fang", "fei", "fen", "feng", "fo",
	"fou", "fu", "ga", "gai", "gan", "gang", "gao", "ge", "gei", "gen", "geng", "gong", "gou",
	"gu", "gua", "guai", "guan", "guang", "gui", "gun", "guo", "ha", "hai", "han", "hang", "hao",
	"he", "hei", "hen", "heng", "hong", "hou", "hu", "hua", "huai", "huan", "huang", "hui", "hun",
	"huo", "ji", "jia", "jian", "jiang", "jiao", "jie", "jin", "jing", "jiong", "jiu", "ju",
	"juan", "jue", "jun", "ka", "kai", "kan", "kang", "kao", "ke", "kei", "ken", "keng", "kong",
	"kou", "ku", "kua", "kuai", "kuan", "kuang", "kui", "kun", "kuo", "la", "lai", "lan", "lang",
	"lao", "le", "lei", "leng", "li", "lia", "lian", "liang", "liao", "lie", "lin", "ling", "liu",
	"long", "lou", "lu", "luan", "lun", "luo", "lü", "lüe", "m", "ma", "mai", "man", "mang",
	"mao", "me", "mei", "men", "meng", "mi", "mian", "miao", "mie", "min", "ming", "miu", "mo",
	"mou", "mu", "na", "nai", "nan", "nang", "nao", "ne", "nei", "nen", "neng", "ng", "ni",
	"nian", "niang", "niao", "nie", "nin", "ning", "niu", "nong", "nou", "nu", "nuan", "nuo",
	"nü", "nüe", "o", "ou", "pa", "pai", "pan", "pang", "pao", "pei", "pen", "peng", "pi", "pian",
	"piao", "pie", "pin", "ping", "po", "pou", "pu", "qi", "qia", "qian", "qiang", "qiao", "qie",
	"qin", "qing", "qiong", "qiu", "qu", "quan", "que", "qun", "ran", "rang", "rao", "re", "ren",
	"reng", "ri", "rong", "rou", "ru", "ruan", "rui", "run", "ruo", "sa", "sai", "san", "sang",
	"sao", "se", "sen", "seng", "sha", "shai", "shan", "shang", "shao", "she", "shen", "sheng",
	"shi", "shou", "shu", "shua", "shuai", "shuan", "shuang", "shui", "shun", "shuo", "si",
	"song", "sou", "su", "suan", "sui", "sun", "suo", "ta", "tai", "tan", "tang", "tao", "te",
	"teng", "ti", "tian", "tiao", "tie", "ting", "tong", "tou", "tu", "tuan", "tui", "tun", "tuo",
	"wa", "wai", "wan", "wang", "wei", "wen", "weng", "wo", "wu", "xi", "xia", "xian", "xiang",
	"xiao", "xie", "xin", "xing", "xiong", "xiu", "xu", "xuan", "xue", "xun", "ya", "yan", "yang",
	"yao", "ye", "yi", "yin", "ying", "yo", "yong", "you", "yu", "yuan", "yue", "yun", "za",
	"zai", "zan", "zang", "zao", "ze", "zei", "zen", "zeng", "zha", "zhai", "zhan", "zhang",
	"zhao", "zhe", "zhen", "zheng", "zhi", "zhong", "zhou", "zhu", "zhua", "zhuai", "zhuan",
	"zhuang", "zhui", "zhun", "zhuo", "zi", "zong", "zou", "zu", "zuan", "zui", "zun", "zuo",
]);

/**
 * Attempt to parse a user-typed pinyin syllable into canonical numbered form.
 *
 * Returns the canonical string ("zhi1", "de0") when the input is recognizably
 * pinyin — already numbered, diacritic, or a bare toneless syllable (which gets
 * the neutral tone, "zhi" → "zhi0"). Returns `null` when the input is not a
 * pinyin syllable (free-text notes, partial input, unsupported romanizations),
 * so callers can preserve the raw text unchanged.
 */
export function toCanonical(input: string): string | null {
	const s = input.trim().toLowerCase();
	if (!s) return null;

	// Numbered pinyin — validate the syllable against the table so only real
	// pinyin becomes canonical, normalizing the "v" → "ü" typing convention
	// ("lv2" → "lü2", but "abc1" → null).
	const numbered = SYLLABLE_TONE.exec(s);
	if (numbered) return canonicalize(numbered[1], numbered[2]);

	// Diacritic pinyin — convert to numbered, then validate the same way.
	if (TONE_DIACRITICS.test(s)) {
		const m = SYLLABLE_TONE.exec(convert(s, { format: 'symbolToNum' }).toLowerCase());
		return m ? canonicalize(m[1], m[2]) : null;
	}

	// Bare toneless syllable — assign neutral tone if it is real pinyin.
	return canonicalize(s, '0');
}

// Normalizes a toneless syllable ("v" → "ü") and pairs it with its tone digit,
// but only if it is a real pinyin syllable; otherwise null (free-text note).
function canonicalize(syllable: string, tone: string): string | null {
	const normalized = syllable.replace(/v/g, 'ü');
	return PINYIN_SYLLABLES.has(normalized) ? normalized + tone : null;
}

/**
 * Render a stored value for display in the Mapping UI.
 *
 * Canonical numbered pinyin ("zhi1") becomes diacritic ("zhī"). Anything that
 * is not canonical numbered pinyin (raw free-text notes) is returned unchanged.
 */
export function toDisplay(value: string): string {
	if (!CANONICAL.test(value)) return value;
	return convert(value, { format: 'numToSymbol' });
}
