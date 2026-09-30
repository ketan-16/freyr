<!--
  The month stepper with a year-of-months picker. `href` builds a link for any
  month, so each screen keeps its own filters across the jump.
-->
<script lang="ts">
	import { addMonths, MONTH_NAMES, monthLabel } from '$lib/dates';
	import Icon from './Icon.svelte';
	import Stepper from './Stepper.svelte';

	let {
		year,
		month,
		today,
		href
	}: {
		year: number;
		month: number;
		today: string;
		href: (year: number, month: number) => string;
	} = $props();

	const prev = $derived(addMonths(year, month, -1));
	const next = $derived(addMonths(year, month, 1));
	const nowYear = $derived(Number(today.slice(0, 4)));
	const nowMonth = $derived(Number(today.slice(5, 7)));
	/**
	 * The year the picker shows. Derived from the month as well as the year, so
	 * any navigation — even within the year — puts it back on the viewed one.
	 */
	let shown = $derived.by(() => {
		void month; // read so a step within the year resets the picker too
		return year;
	});
</script>

<Stepper
	unit="month"
	label={monthLabel(year, month)}
	prev={{ href: href(prev.year, prev.month), label: monthLabel(prev.year, prev.month) }}
	next={{ href: href(next.year, next.month), label: monthLabel(next.year, next.month) }}
>
	{#snippet picker(close)}
		<div class="picker-h">
			<!-- Links, so the year steps with script off too; script keeps the popover open. -->
			<a
				class="icon-btn"
				href={href(shown - 1, month)}
				aria-label="Previous year"
				onclick={(e) => {
					e.preventDefault();
					shown -= 1;
				}}
			>
				<Icon name="chevron-left" />
			</a>
			<span class="tnum">{shown}</span>
			<a
				class="icon-btn"
				href={href(shown + 1, month)}
				aria-label="Next year"
				onclick={(e) => {
					e.preventDefault();
					shown += 1;
				}}
			>
				<Icon name="chevron-right" />
			</a>
		</div>
		<div class="picker-grid">
			{#each MONTH_NAMES as name, i (name)}
				<a
					href={href(shown, i + 1)}
					aria-current={shown === year && i + 1 === month ? 'true' : undefined}
					aria-label={monthLabel(shown, i + 1)}
					class:today={shown === nowYear && i + 1 === nowMonth}
					onclick={close}>{name.slice(0, 3)}</a
				>
			{/each}
		</div>
		{#if year !== nowYear || month !== nowMonth}
			<a class="btn ghost block" href={href(nowYear, nowMonth)} onclick={close}>This month</a>
		{/if}
	{/snippet}
</Stepper>
