<!--
  Lucide, inlined. One set, 1.5px stroke, currentColor — see DESIGN.md §
  Iconography. Every glyph is expressed as path data so the component stays a
  single `{#each}` rather than a per-icon branch; rects, circles and polylines
  from upstream Lucide are converted to equivalent paths.
-->
<script lang="ts">
	const ICONS: Record<string, string[]> = {
		list: ['M3 12h.01', 'M3 18h.01', 'M3 6h.01', 'M8 12h13', 'M8 18h13', 'M8 6h13'],
		'layout-dashboard': [
			'M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
			'M4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z'
		],
		calendar: [
			'M8 2v4',
			'M16 2v4',
			'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
			'M3 10h18'
		],
		'calendar-range': [
			'M8 2v4',
			'M16 2v4',
			'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
			'M3 10h18',
			'M17 14h-6',
			'M13 18H7',
			'M7 14h.01',
			'M17 18h.01'
		],
		'sliders-horizontal': [
			'M21 4h-7',
			'M10 4H3',
			'M21 12h-9',
			'M8 12H3',
			'M21 20h-5',
			'M12 20H3',
			'M14 2v4',
			'M8 10v4',
			'M16 18v4'
		],
		target: [
			'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z',
			'M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12z',
			'M12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z'
		],
		sun: [
			'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
			'M12 2v2',
			'M12 20v2',
			'm4.93 4.93 1.41 1.41',
			'm17.66 17.66 1.41 1.41',
			'M2 12h2',
			'M20 12h2',
			'm6.34 17.66-1.41 1.41',
			'm19.07 4.93-1.41 1.41'
		],
		moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
		'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
		left: ['m15 18-6-6 6-6'],
		right: ['m9 18 6-6-6-6'],
		tags: [
			'm15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19',
			'M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z',
			'M6.5 9.5h.01'
		],
		check: ['M20 6 9 17l-5-5'],
		archive: [
			'M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8',
			'M10 12h4'
		],
		'archive-restore': [
			'M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
			'M4 8v11a2 2 0 0 0 2 2h2',
			'M20 8v11a2 2 0 0 1-2 2h-2',
			'm9 15 3-3 3 3',
			'M12 12v9'
		],
		trash: [
			'M3 6h18',
			'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
			'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
			'M10 11v6',
			'M14 11v6'
		]
	};

	let { name, size = 16 }: { name: keyof typeof ICONS | string; size?: number } = $props();

	const paths = $derived(ICONS[name] ?? []);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each paths as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
