import type { Alignment } from '$lib/context/alignment.svelte';

export function initAlignmentShortcuts(alignment: Alignment): () => void {
	function handleDeleteKey(e: KeyboardEvent) {
		if (e.key !== 'Delete' && e.key !== 'Backspace') return;
		const active = document.activeElement;
		if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
		const focusedId = (active?.closest('li[data-mapping-id]') as HTMLElement)?.dataset.mappingId;
		// Fresh/active mappings aren't focused yet — fall back to the active one so
		// Backspace works right after creating a mapping, not just while tabbing the list.
		const id = focusedId ?? alignment.activeMappingId;
		if (!id) return;
		e.preventDefault();
		alignment.deleteById(id);
	}

	function handleDocumentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('[data-mapping-id]')) return;
		if (target.closest('[aria-label="Source tokens"]')) return;
		if (target.closest('[aria-label="Target tokens"]')) return;
		alignment.deselect();
	}

	document.addEventListener('keydown', handleDeleteKey);
	document.addEventListener('click', handleDocumentClick);
	return () => {
		document.removeEventListener('keydown', handleDeleteKey);
		document.removeEventListener('click', handleDocumentClick);
	};
}
