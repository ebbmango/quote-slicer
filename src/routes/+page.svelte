<script lang="ts">
  function autosize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    };
    node.addEventListener('input', resize);
    resize();
    return { destroy: () => node.removeEventListener('input', resize) };
  }
</script>

<div class="layout h-dvh w-dvw">
  <aside class="sidebar sidebar-left bg-[#f9f9f9]"></aside>
  <main class="content">
    <div class="flex h-full w-full flex-col items-center justify-center gap-0.5">
      <textarea
        id="original"
        name="original"
        rows="1"
        use:autosize
        class="w-full resize-none overflow-y-auto bg-transparent text-center font-wenkai text-3xl font-light opacity-30 outline-none max-h-[40vh]"
        placeholder="空"
      ></textarea>
      <textarea
        id="translation"
        name="translation"
        rows="1"
        use:autosize
        class="w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-base font-[350] italic outline-none max-h-[25vh]"
        placeholder="Use this box to enter your translated text."
      ></textarea>
      <textarea
        id="source"
        name="source"
        rows="1"
        use:autosize
        class="w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-30 outline-none max-h-[10vh]"
        placeholder="Source"
      ></textarea>
    </div>
  </main>
  <aside class="sidebar sidebar-right bg-[#f9f9f9]"></aside>
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
		border-radius: 20px;
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
