export type MappingColor = {
	base: string;
	source: string;
	target: string;
};

export const MAPPING_COLORS: MappingColor[] = [
	{ base: '#D9EA96', source: '#AAC834', target: '#A7C727' }, // applesour
	{ base: '#8AE1B2', source: '#67C492', target: '#53C085' }, // lush
	{ base: '#92D8E0', source: '#88C8D7', target: '#70C0D3' }, // seabreeze
	{ base: '#9EA8DC', source: '#8291DF', target: '#7384D9' }, // azure
	{ base: '#C1A2E7', source: '#B18AE1', target: '#AC80E2' }, // compostella
	{ base: '#DF9DE1', source: '#D69BD8', target: '#CF83D2' }, // sugar
	{ base: '#E396A6', source: '#D87D8F', target: '#D1647A' }, // strawberry
	{ base: '#ECB48F', source: '#E4A67C', target: '#DA9160' }, // maple
	{ base: '#F3DF8D', source: '#D1B953', target: '#C7AD3F' }, // beeswax
];
