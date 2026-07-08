import { getContext, setContext } from 'svelte';

export type Tool = 'text' | 'link' | 'line' | 'view';

const TOOL_KEY = Symbol('tool');

class ToolContext {
	current = $state<Tool>('text');
}

export function setToolContext(): ToolContext {
	return setContext(TOOL_KEY, new ToolContext());
}

export function getToolContext(): ToolContext {
	return getContext<ToolContext>(TOOL_KEY);
}
