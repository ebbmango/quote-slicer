// jsdom does not implement matchMedia; the theme controller (src/lib/systemTheme.ts)
// queries it at module init, so the stub must exist before any test file imports.
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string): MediaQueryList =>
		({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false
		}) as unknown as MediaQueryList
});
