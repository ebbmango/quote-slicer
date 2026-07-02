/**
 * Svelte action: keeps a textarea's height matched to its content by resetting
 * to `auto` and re-measuring `scrollHeight` on input and window resize.
 */
export function autosize(node: HTMLTextAreaElement) {
	const resize = () => {
		node.style.height = 'auto';
		node.style.height = node.scrollHeight + 'px';
	};
	node.addEventListener('input', resize);
	window.addEventListener('resize', resize);
	resize();
	return {
		destroy: () => {
			node.removeEventListener('input', resize);
			window.removeEventListener('resize', resize);
		}
	};
}
