<!--
  Lucide, inlined (lucide-static 0.544.0, ISC). One set, one stroke, currentColor
  — see DESIGN.md § Iconography. Every glyph is path data, converted from the
  upstream SVG (rects, circles and lines become equivalent paths), so the
  component is a single {#each} rather than a branch per icon.
-->
<script lang="ts" module>
	const ICONS = {
		house: [
			'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
			'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
		],
		'arrow-left-right': ['M8 3 4 7l4 4', 'M4 7h16', 'm16 21 4-4-4-4', 'M20 17H4'],
		'chart-pie': [
			'M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z',
			'M21.21 15.89A10 10 0 1 1 8 2.83'
		],
		'chart-column': ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
		'sliders-horizontal': [
			'M10 5H3',
			'M12 19H3',
			'M14 3v4',
			'M16 17v4',
			'M21 12h-9',
			'M21 19h-5',
			'M21 5h-7',
			'M8 10v4',
			'M8 12H3'
		],
		tags: [
			'M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z',
			'M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193',
			'M10 6.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0'
		],
		settings: [
			'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
			'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'
		],
		plus: ['M5 12h14', 'M12 5v14'],
		minus: ['M5 12h14'],
		x: ['M18 6 6 18', 'm6 6 12 12'],
		search: ['m21 21-4.34-4.34', 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0'],
		command: ['M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'],
		pencil: [
			'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
			'm15 5 4 4'
		],
		trash: [
			'M10 11v6',
			'M14 11v6',
			'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
			'M3 6h18',
			'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
		],
		check: ['M20 6 9 17l-5-5'],
		archive: [
			'M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1z',
			'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8',
			'M10 12h4'
		],
		'archive-restore': [
			'M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1z',
			'M4 8v11a2 2 0 0 0 2 2h2',
			'M20 8v11a2 2 0 0 1-2 2h-2',
			'm9 15 3-3 3 3',
			'M12 12v9'
		],
		'chevron-left': ['m15 18-6-6 6-6'],
		'chevron-right': ['m9 18 6-6-6-6'],
		'chevron-down': ['m6 9 6 6 6-6'],
		'chevron-up': ['m18 15-6-6-6 6'],
		'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
		'arrow-left': ['m12 19-7-7 7-7', 'M19 12H5'],
		'arrow-up-right': ['M7 7h10v10', 'M7 17 17 7'],
		'arrow-down-left': ['M17 7 7 17', 'M17 17H7V7'],
		'corner-down-left': ['M20 4v7a4 4 0 0 1-4 4H4', 'm9 10-5 5 5 5'],
		'log-out': ['m16 17 5-5-5-5', 'M21 12H9', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'],
		sun: [
			'M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
			'M12 2v2',
			'M12 20v2',
			'm4.93 4.93 1.41 1.41',
			'm17.66 17.66 1.41 1.41',
			'M2 12h2',
			'M20 12h2',
			'm6.34 17.66-1.41 1.41',
			'm19.07 4.93-1.41 1.41'
		],
		moon: [
			'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401'
		],
		monitor: [
			'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
			'M8 21h8',
			'M12 17v4'
		],
		ellipsis: [
			'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
			'M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
			'M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'
		],
		calendar: [
			'M8 2v4',
			'M16 2v4',
			'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z',
			'M3 10h18'
		],
		info: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M12 16v-4', 'M12 8h.01'],
		'triangle-alert': [
			'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
			'M12 9v4',
			'M12 17h.01'
		],
		'circle-check': ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'm9 12 2 2 4-4'],
		target: [
			'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0',
			'M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
			'M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'
		],
		wallet: [
			'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
			'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'
		],
		delete: [
			'M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
			'm12 9 6 6',
			'm18 9-6 6'
		],
		keyboard: [
			'M10 8h.01',
			'M12 12h.01',
			'M14 8h.01',
			'M16 12h.01',
			'M18 8h.01',
			'M6 8h.01',
			'M7 16h10',
			'M8 12h.01',
			'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2z'
		]
	} satisfies Record<string, string[]>;

	export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
	let {
		name,
		size = 16,
		stroke = 1.75
	}: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each ICONS[name] as d (d)}
		<path {d} />
	{/each}
</svg>
