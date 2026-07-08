import type { Alignment } from '$lib/context/alignment.svelte';
import { PANEL_SELECTOR } from '$lib/navigation/gridDom';

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
		// Either token panel — identified by data-zone, like every other reader
		// (was two aria-label matches; the panel wrapper carries the zone in all tools).
		if (target.closest(PANEL_SELECTOR)) return;
		// Presentation controls opt out of deselect-on-click via data-keep-selection
		// (theme toggle, maps/json panel toggle). They don't change the editing tool,
		// so nuking the active mapping when you flip the theme or swap the side panel
		// is just lost work. Tool switches (link/line/view) are deliberately NOT marked
		// — switching tool still deselects, as does a click on bare canvas.
		if (target.closest('[data-keep-selection]')) return;
		alignment.deselect();
	}

	document.addEventListener('keydown', handleDeleteKey);
	document.addEventListener('click', handleDocumentClick);
	return () => {
		document.removeEventListener('keydown', handleDeleteKey);
		document.removeEventListener('click', handleDocumentClick);
	};
}
