<div class="layout h-dvh w-dvw">
	<aside class="sidebar sidebar-left bg-blue-100"></aside>
	<main class="content bg-amber-100"></main>
	<aside class="sidebar sidebar-right bg-blue-100"></aside>
</div>

<style>
	.layout {
		--spacing: clamp(24px, 3vw, 36px);

		padding: var(--spacing) var(--spacing);
		display: grid;
		grid-column-gap: var(--spacing);
		grid-row-gap: var(--spacing);

		/* default: main only */
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
	}

	.sidebar {
		display: none;
	}

	/* tall portrait: main + one sidebar stacked */
	@media (orientation: portrait) and (min-height: 1000px) and (max-width: 899px) {
		.layout {
			grid-template-columns: 1fr;
			grid-template-rows: 2fr 1fr;
		}

		.sidebar-left {
			display: block;
			order: 2;
		}

		.content {
			order: 1;
		}
	}

	/* medium: one sidebar + main */
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: 1fr 2fr;
			grid-template-rows: 1fr;
		}

		.sidebar-left {
			display: block;
		}
	}

	/* desktop: sidebar + main + sidebar */
	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: 1fr 2fr 1fr;
		}

		.sidebar-right {
			display: block;
		}
	}
</style>
