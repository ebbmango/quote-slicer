export type MappingColorVariant = {
	// Token view colors — used by InteractiveSourceText / InteractiveTargetText
	source: string;
	target: string;
	// Panel card colors — used by Mapping.svelte
	base: string; // active card backdrop
	text: string; // active hanzi + pinyin text
	tagNoInactive: string; // number tag text, inactive
	tagBgInactive: string; // number tag background, inactive
	tagBgActive: string; // number tag background, active; also × button color
	tagNoActive: string; // number tag text, active
	botInactive: string; // bottom bar background, inactive
	botTextInactive: string; // bottom bar text, inactive
	botActive: string; // bottom bar background, active
	botTextActive: string; // bottom bar text, active
	bgFocusInactive: string; // card backdrop, focused but not active
};

export type MappingColor = {
	light: MappingColorVariant;
	dark: MappingColorVariant;
};

/**
 * View-mode hover-highlight color. Flat for now — the same red lights up a
 * hovered mapping in both panels, ignoring each mapping's own palette entry.
 */
export const HIGHLIGHT_COLOR = "rgb(255, 0, 55)";

export const MAPPING_COLOR_NAMES = [
	"applesour",
	"lush",
	"seabreeze",
	"azure",
	"compostella",
	"sugar",
	"strawberry",
	"maple",
	"beeswax",
] as const;

export type MappingColorName = (typeof MAPPING_COLOR_NAMES)[number];

export const MAPPING_COLORS: MappingColor[] = [
	{
		// applesour
		light: {
			source: "#AAC834",
			target: "#A7C727",
			base: "#D9EA96",
			text: "#556124",
			tagNoInactive: "#667c0f",
			tagBgInactive: "#DBE9A2",
			tagBgActive: "#a4b368",
			tagNoActive: "white",
			botInactive: "#edf1dc",
			botTextInactive: "#8ea04d",
			botActive: "#eaf1cf",
			botTextActive: "#818c57",
			bgFocusInactive: "#F9FCF2",
		},
		dark: {
			source: "#AAC834",
			target: "#A7C727",
			base: "rgb(166, 183, 102)",
			text: "#556124",
			tagNoInactive: "#DBE9A2",
			tagBgInactive: "#636753",
			tagBgActive: "#7f8b51",
			tagNoActive: "rgb(197, 206, 160)",
			botInactive: "#34352F",
			botTextInactive: "#D5E2A1",
			botActive: "#79854E",
			botTextActive: "rgb(242, 255, 190)",
			bgFocusInactive: "#F9FCF2",
		},
	},
	{
		// lush
		light: {
			source: "#67C492",
			target: "#53C085",
			base: "#8AE1B2",
			text: "#266845",
			tagNoInactive: "#216943",
			tagBgInactive: "#AEE1C6",
			tagBgActive: "#62b186",
			tagNoActive: "white",
			botInactive: "#dfeee5",
			botTextInactive: "#5a9174",
			botActive: "#caedda",
			botTextActive: "#579072",
			bgFocusInactive: "#F5FDF9",
		},
		dark: {
			source: "#67C492",
			target: "#53C085",
			base: "rgb(113, 185, 146)",
			text: "#266845",
			tagNoInactive: "#AEE1C6",
			tagBgInactive: "#4E6055",
			tagBgActive: "rgb(85, 137, 108)",
			tagNoActive: "rgb(170, 222, 194)",
			botInactive: "#2F3330",
			botTextInactive: "#B0E6CA",
			botActive: "rgb(75, 118, 94)",
			botTextActive: "rgb(200, 254, 225)",
			bgFocusInactive: "#F5FDF9",
		},
	},
	{
		// seabreeze
		light: {
			source: "#88C8D7",
			target: "#70C0D3",
			base: "#92D8E0",
			text: "#255F6C",
			tagNoInactive: "#1C5F6E",
			tagBgInactive: "#ACE4EA",
			tagBgActive: "#66a7b2",
			tagNoActive: "white",
			botInactive: "#dfeef2",
			botTextInactive: "#568a95",
			botActive: "#cceaed",
			botTextActive: "#578892",
			bgFocusInactive: "#F2FBFC",
		},
		dark: {
			source: "#88C8D7",
			target: "#70C0D3",
			base: "rgb(117, 173, 179)",
			text: "#255F6C",
			tagNoInactive: "#ACE4EA",
			tagBgInactive: "#526267",
			tagBgActive: "rgb(82, 134, 142)",
			tagNoActive: "rgb(158, 218, 228)",
			botInactive: "#2C3235",
			botTextInactive: "#C5E3E6",
			botActive: "rgb(73, 116, 124)",
			botTextActive: "rgb(190, 242, 248)",
			bgFocusInactive: "#F2FBFC",
		},
	},
	{
		// azure
		light: {
			source: "#8291DF",
			target: "#7384D9",
			base: "#9EA8DC",
			text: "#212E6F",
			tagNoInactive: "#314299",
			tagBgInactive: "#B7C2F9",
			tagBgActive: "#6c77b0",
			tagNoActive: "white",
			botInactive: "#e1e5f7",
			botTextInactive: "#6573b5",
			botActive: "#d2d6eb",
			botTextActive: "#566094",
			bgFocusInactive: "#F7F8FD",
		},
		dark: {
			source: "#8291DF",
			target: "#7384D9",
			base: "rgb(126, 134, 176)",
			text: "#212E6F",
			tagNoInactive: "#B7C2F9",
			tagBgInactive: "#4C5062",
			tagBgActive: "rgb(86, 95, 141)",
			tagNoActive: "rgb(178, 188, 248)",
			botInactive: "#2E3035",
			botTextInactive: "#CAD3FF",
			botActive: "rgb(89, 95, 135)",
			botTextActive: "rgb(193, 200, 255)",
			bgFocusInactive: "#F7F8FD",
		},
	},
	{
		// compostella
		light: {
			source: "#B18AE1",
			target: "#AC80E2",
			base: "#C1A2E7",
			text: "#3F1B6C",
			tagNoInactive: "#7528AF",
			tagBgInactive: "#DCC1FD",
			tagBgActive: "#8d6cb6",
			tagNoActive: "white",
			botInactive: "#eee5f7",
			botTextInactive: "#9960c4",
			botActive: "#e0d4f0",
			botTextActive: "#705293",
			bgFocusInactive: "#FBF9FD",
		},
		dark: {
			source: "#B18AE1",
			target: "#AC80E2",
			base: "rgb(154, 130, 185)",
			text: "#3F1B6C",
			tagNoInactive: "#DCC1FD",
			tagBgInactive: "#5F546B",
			tagBgActive: "rgb(113, 86, 146)",
			tagNoActive: "rgb(205, 178, 248)",
			botInactive: "#312E35",
			botTextInactive: "#E4CFFF",
			botActive: "rgb(103, 86, 133)",
			botTextActive: "rgb(222, 195, 255)",
			bgFocusInactive: "#FBF9FD",
		},
	},
	{
		// sugar
		light: {
			source: "#D69BD8",
			target: "#CF83D2",
			base: "#DF9DE1",
			text: "#582259",
			tagNoInactive: "#99299B",
			tagBgInactive: "#F7C8F8",
			tagBgActive: "#a96cab",
			tagNoActive: "white",
			botInactive: "#f6e6f5",
			botTextInactive: "#b462b7",
			botActive: "#ecd2ed",
			botTextActive: "#835785",
			bgFocusInactive: "#FDF8FD",
		},
		dark: {
			source: "#D69BD8",
			target: "#CF83D2",
			base: "rgb(178, 126, 180)",
			text: "#582259",
			tagNoInactive: "#F7C8F8",
			tagBgInactive: "#645263",
			tagBgActive: "rgb(135, 86, 137)",
			tagNoActive: "rgb(230, 172, 234)",
			botInactive: "#373437",
			botTextInactive: "#F7CFF7",
			botActive: "rgb(139, 89, 142)",
			botTextActive: "rgb(248, 200, 250)",
			bgFocusInactive: "#FDF8FD",
		},
	},
	{
		// strawberry
		light: {
			source: "#D87D8F",
			target: "#D1647A",
			base: "#E396A6",
			text: "#511824",
			tagNoInactive: "#81273A",
			tagBgInactive: "#F6BDC9",
			tagBgActive: "#a96472",
			tagNoActive: "white",
			botInactive: "#f5e4e7",
			botTextInactive: "#a55f6e",
			botActive: "#eecfd5",
			botTextActive: "#804f59",
			bgFocusInactive: "#FDF5F6",
		},
		dark: {
			source: "#D87D8F",
			target: "#D1647A",
			base: "rgb(182, 120, 133)",
			text: "#511824",
			tagNoInactive: "#F6BDC9",
			tagBgInactive: "#675356",
			tagBgActive: "rgb(135, 80, 91)",
			tagNoActive: "rgb(240, 170, 188)",
			botInactive: "#393434",
			botTextInactive: "#FFD1DA",
			botActive: "rgb(120, 75, 91)",
			botTextActive: "rgb(252, 198, 215)",
			bgFocusInactive: "#FDF5F6",
		},
	},
	{
		// maple
		light: {
			source: "#E4A67C",
			target: "#DA9160",
			base: "#ECB48F",
			text: "#522C13",
			tagNoInactive: "#873E0E",
			tagBgInactive: "#FFCDAC",
			tagBgActive: "#ae7e5d",
			tagNoActive: "white",
			botInactive: "#f8e8df",
			botTextInactive: "#a9714c",
			botActive: "#f1dbcc",
			botTextActive: "#82604a",
			bgFocusInactive: "#FDF8F5",
		},
		dark: {
			source: "#E4A67C",
			target: "#DA9160",
			base: "rgb(189, 144, 114)",
			text: "#522C13",
			tagNoInactive: "#FFCDAC",
			tagBgInactive: "#645852",
			tagBgActive: "rgb(139, 101, 74)",
			tagNoActive: "rgb(248, 196, 162)",
			botInactive: "#3B3735",
			botTextInactive: "#FFD8BF",
			botActive: "rgb(110, 77, 57)",
			botTextActive: "rgb(255, 215, 185)",
			bgFocusInactive: "#FDF8F5",
		},
	},
	{
		// beeswax
		light: {
			source: "#D1B953",
			target: "#C7AD3F",
			base: "#F3DF8D",
			text: "#4D4213",
			tagNoInactive: "#735D02",
			tagBgInactive: "#F1E1A1",
			tagBgActive: "#b1a05c",
			tagNoActive: "white",
			botInactive: "#f3efdb",
			botTextInactive: "#998943",
			botActive: "#f5eccb",
			botTextActive: "#7f754a",
			bgFocusInactive: "#FDFBF6",
		},
		dark: {
			source: "#D1B953",
			target: "#C7AD3F",
			base: "rgb(194, 178, 113)",
			text: "#4D4213",
			tagNoInactive: "#F1E1A1",
			tagBgInactive: "#605C4A",
			tagBgActive: "rgb(142, 128, 74)",
			tagNoActive: "rgb(232, 218, 148)",
			botInactive: "#31302A",
			botTextInactive: "#F1E1A1",
			botActive: "rgb(131, 120, 76)",
			botTextActive: "rgb(248, 240, 182)",
			bgFocusInactive: "#FDFBF6",
		},
	},
];

export const colors: Record<MappingColorName, MappingColor> = Object
	.fromEntries(
		MAPPING_COLOR_NAMES.map((name, i) => [name, MAPPING_COLORS[i]]),
	) as Record<MappingColorName, MappingColor>;

/**
 * Color for a line-mode divisor by its running ordinal. Source-panel divisors
 * take ordinals 0..N-1; target-panel divisors continue from N (see
 * `divisorOffset` in InteractiveTargetText) so the palette sweeps unbroken
 * across both panels — last source divisor `seabreeze` → first target `azure`.
 * `field` lets source/target (or vertical/horizontal) divisors draw from
 * different shades later; defaults to `base`. Wraps after 9.
 */
export function divisorColor(
	ordinal: number,
	field: keyof MappingColorVariant = "base",
	mode: "light" | "dark" = "light",
): string {
	const n = MAPPING_COLORS.length;
	return MAPPING_COLORS[((ordinal % n) + n) % n][mode][field];
}
