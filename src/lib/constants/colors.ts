export type MappingColor = {
	// Token view colors — used by InteractiveSourceText / InteractiveTargetText
	source: string;
	target: string;
	// Panel card colors — used by Mapping.svelte
	base: string; // active card backdrop
	text: string; // active hanzi + pinyin text
	tagNoInactive: string; // number tag text, inactive
	tagBgInactive: string; // number tag background, inactive
	tagBgActive: string; // number tag background, active; also × button color
	botInactive: string; // bottom bar background, inactive
	botTextInactive: string; // bottom bar text, inactive
	botActive: string; // bottom bar background, active
	botTextActive: string; // bottom bar text, active
};

export const MAPPING_COLORS: MappingColor[] = [
	{
		// applesour
		source: '#AAC834',
		target: '#A7C727',
		base: '#D9EA96',
		text: '#556124',
		tagNoInactive: '#667c0f',
		tagBgInactive: '#DBE9A2',
		tagBgActive: '#a4b368',
		botInactive: '#edf1dc',
		botTextInactive: '#8ea04d',
		botActive: '#eaf1cf',
		botTextActive: '#818c57'
	},
	{
		// lush
		source: '#67C492',
		target: '#53C085',
		base: '#8AE1B2',
		text: '#266845',
		tagNoInactive: '#216943',
		tagBgInactive: '#AEE1C6',
		tagBgActive: '#62b186',
		botInactive: '#dfeee5',
		botTextInactive: '#5a9174',
		botActive: '#caedda',
		botTextActive: '#579072'
	},
	{
		// seabreeze
		source: '#88C8D7',
		target: '#70C0D3',
		base: '#92D8E0',
		text: '#255F6C',
		tagNoInactive: '#1C5F6E',
		tagBgInactive: '#ACE4EA',
		tagBgActive: '#66a7b2',
		botInactive: '#dfeef2',
		botTextInactive: '#568a95',
		botActive: '#cceaed',
		botTextActive: '#578892'
	},
	{
		// azure
		source: '#8291DF',
		target: '#7384D9',
		base: '#9EA8DC',
		text: '#212E6F',
		tagNoInactive: '#314299',
		tagBgInactive: '#B7C2F9',
		tagBgActive: '#6c77b0',
		botInactive: '#e1e5f7',
		botTextInactive: '#6573b5',
		botActive: '#d2d6eb',
		botTextActive: '#566094'
	},
	{
		// compostella
		source: '#B18AE1',
		target: '#AC80E2',
		base: '#C1A2E7',
		text: '#3F1B6C',
		tagNoInactive: '#7528AF',
		tagBgInactive: '#DCC1FD',
		tagBgActive: '#8d6cb6',
		botInactive: '#eee5f7',
		botTextInactive: '#9960c4',
		botActive: '#e0d4f0',
		botTextActive: '#705293'
	},
	{
		// sugar
		source: '#D69BD8',
		target: '#CF83D2',
		base: '#DF9DE1',
		text: '#582259',
		tagNoInactive: '#99299B',
		tagBgInactive: '#F7C8F8',
		tagBgActive: '#a96cab',
		botInactive: '#f6e6f5',
		botTextInactive: '#b462b7',
		botActive: '#ecd2ed',
		botTextActive: '#835785'
	},
	{
		// strawberry
		source: '#D87D8F',
		target: '#D1647A',
		base: '#E396A6',
		text: '#511824',
		tagNoInactive: '#81273A',
		tagBgInactive: '#F6BDC9',
		tagBgActive: '#a96472',
		botInactive: '#f5e4e7',
		botTextInactive: '#a55f6e',
		botActive: '#eecfd5',
		botTextActive: '#804f59'
	},
	{
		// maple
		source: '#E4A67C',
		target: '#DA9160',
		base: '#ECB48F',
		text: '#522C13',
		tagNoInactive: '#873E0E',
		tagBgInactive: '#FFCDAC',
		tagBgActive: '#ae7e5d',
		botInactive: '#f8e8df',
		botTextInactive: '#a9714c',
		botActive: '#f1dbcc',
		botTextActive: '#82604a'
	},
	{
		// beeswax
		source: '#D1B953',
		target: '#C7AD3F',
		base: '#F3DF8D',
		text: '#4D4213',
		tagNoInactive: '#735D02',
		tagBgInactive: '#F1E1A1',
		tagBgActive: '#b1a05c',
		botInactive: '#f3efdb',
		botTextInactive: '#998943',
		botActive: '#f5eccb',
		botTextActive: '#7f754a'
	}
];
