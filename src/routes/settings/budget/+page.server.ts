import { todayISO } from '$lib/dates';
import { parsePercentBP } from '$lib/money';
import { activeFor, createPeriod, listPeriods } from '$lib/server/budgets';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return {
		periods: listPeriods(locals.db),
		activeId: activeFor(locals.db, todayISO())?.id ?? null,
		today: todayISO()
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const values = Object.fromEntries(
			[...form.entries()].map(([k, v]) => [k, String(v)])
		) as Record<string, string>;
		try {
			createPeriod(locals.db, {
				effectiveFrom: values.effective_from,
				needsBP: parsePercentBP(values.needs || ''),
				wantsBP: parsePercentBP(values.wants || ''),
				investBP: parsePercentBP(values.invest || '')
			});
		} catch (err) {
			return fail(400, { error: err instanceof Error ? err.message : String(err), values });
		}
		redirect(303, '/settings/budget');
	}
};
