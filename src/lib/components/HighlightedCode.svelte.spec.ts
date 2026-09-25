import { expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import HighlightedCode from './HighlightedCode.svelte';

const pending = vi.hoisted(() => new Map<string, (value: unknown) => void>());
vi.mock('shiki', () => ({
	codeToTokens: (code: string) => new Promise((resolve) => pending.set(code, resolve))
}));

it('ignores obsolete highlighting results that finish after the current export', async () => {
	const props = $state({ code: 'old export' });
	const target = document.createElement('div');
	const component = mount(HighlightedCode, { target, props });
	try {
		flushSync();
		await vi.waitFor(() => expect(pending.has('old export')).toBe(true));
		props.code = 'new export';
		flushSync();
		await vi.waitFor(() => expect(pending.has('new export')).toBe(true));
		pending.get('new export')!({ tokens: [[{ content: 'new export' }]] });
		await vi.waitFor(() => expect(target.textContent?.trim()).toBe('new export'));
		pending.get('old export')!({ tokens: [[{ content: 'old export' }]] });
		await Promise.resolve();
		flushSync();
		expect(target.textContent?.trim()).toBe('new export');
	} finally {
		await unmount(component);
		pending.clear();
	}
});
