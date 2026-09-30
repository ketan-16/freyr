<!--
  Spend against its allocation, from `meter()` in progress.ts. Under the cap it
  is one fill; over it the track rescales so the plan and the overspend both
  fit, the excess in loss red. `mark` is the share of the period gone (0–1): a
  fill past it is spending ahead of the calendar. `tone` colours the fill by
  the bucket's own hue, or by severity (neutral → amber at 80% → red over).
  Always rendered beside a figure — the bar is a glance, the number the truth.
-->
<script lang="ts">
	import { meter } from '$lib/progress';

	let {
		actual,
		allocated,
		mark,
		tone = 'bucket',
		size = '',
		label
	}: {
		actual: number;
		allocated: number | null | undefined;
		mark?: number | null;
		tone?: 'bucket' | 'severity' | 'neutral';
		size?: '' | 'thin' | 'tall';
		label?: string;
	} = $props();

	const m = $derived(meter(actual, allocated));
	const severity = $derived(
		tone === 'severity' && m
			? m.klass === 'over'
				? 'over'
				: m.klass === 'warn'
					? 'warn'
					: 'neutral'
			: ''
	);
	/** Where the calendar says spending should be, in track coordinates. */
	const markAt = $derived(m && mark != null ? Math.min(1, Math.max(0, mark)) * m.width : null);
</script>

<div
	class="bullet {size} {severity} {tone === 'neutral' ? 'neutral' : ''}"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#if m}
		{#if m.width > 0}<span class="fill" style:width="{m.width}%"></span>{/if}
		{#if m.overflow > 0}<span class="over" style:flex="1"></span>{/if}
		{#if markAt != null}<span class="mark" style:left="{markAt}%"></span>{/if}
	{/if}
</div>
