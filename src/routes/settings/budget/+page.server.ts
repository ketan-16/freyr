import { todayISO } from '$lib/dates';
import { parsePercentBP } from '$lib/money';
import { activeFor, createPeriod, listPeriods } from '$lib/server/budgets';
import {
	createPromotion,
	deletePromotion,
	getPolicy,
	listPromotionEffects,
	updatePolicy
} from '$lib/server/promotions';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Five constant-cost reads, none of which scale with the ledger: the one-row
 * policy (twice — listPromotionEffects re-reads it so it stays self-contained),
 * the promotion log, every period, and the period in force today.
 */
export const load: PageServerLoad = ({ locals }) => {
	const today = todayISO();
	return {
		policy: getPolicy(locals.db),
		promotions: listPromotionEffects(locals.db),
		periods: listPeriods(locals.db),
		activeId: activeFor(locals.db, today)?.id ?? null,
		today
	};
};

/** Which form a failure belongs to — four post here, and only one may show it. */
type FormName = 'savePolicy' | 'addPromotion' | 'deletePromotion' | 'addPeriod';

type Values = Record<string, string>;

/** Posted values as plain strings, for re-rendering what was typed on failure. */
async function values(request: Request): Promise<Values> {
	const form = await request.formData();
	return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

/**
 * Runs one domain write, turning whatever it throws into a 400 on the named
 * form. Every rule — the date formats, the two triples summing to 100%, a
 * non-positive raise, a duplicate date, and a base and a raise that would
 * project out of order — lives in the domain and arrives already phrased, so
 * nothing here restates it.
 */
function attempt(
	name: FormName,
	v: Values,
	write: () => void
): ActionFailure<{ failed: FormName; error: string; values: Values }> {
	try {
		write();
	} catch (err) {
		return fail(400, {
			failed: name,
			error: err instanceof Error ? err.message : String(err),
			values: v
		});
	}
	redirect(303, '/settings/budget');
}

/** One labelled percentage triple out of the posted policy form. */
function triple(v: Values, prefix: 'base' | 'marg') {
	return {
		needsBP: parsePercentBP(v[`${prefix}_needs`] || ''),
		wantsBP: parsePercentBP(v[`${prefix}_wants`] || ''),
		investBP: parsePercentBP(v[`${prefix}_invest`] || '')
	};
}

/**
 * Every write leaves budget_periods consistent without help from here:
 * updatePolicy, createPromotion and deletePromotion each reproject inside their
 * own transaction, and addPeriod writes a manual row, which no projection ever
 * touches. So no action calls rebuildProjectedPeriods.
 */
export const actions: Actions = {
	savePolicy: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('savePolicy', v, () =>
			updatePolicy(locals.db, {
				baseEffectiveFrom: v.base_effective_from,
				base: triple(v, 'base'),
				marginal: triple(v, 'marg')
			})
		);
	},

	addPromotion: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('addPromotion', v, () =>
			createPromotion(locals.db, {
				effectiveDate: v.effective_date,
				incrementBP: parsePercentBP(v.increment || ''),
				note: v.note?.trim() || null
			})
		);
	},

	deletePromotion: async ({ request, locals }) => {
		const v = await values(request);
		const id = Number(v.id);
		return attempt('deletePromotion', v, () => {
			if (id) deletePromotion(locals.db, id);
		});
	},

	addPeriod: async ({ request, locals }) => {
		const v = await values(request);
		return attempt('addPeriod', v, () =>
			createPeriod(locals.db, {
				effectiveFrom: v.effective_from,
				needsBP: parsePercentBP(v.needs || ''),
				wantsBP: parsePercentBP(v.wants || ''),
				investBP: parsePercentBP(v.invest || '')
			})
		);
	}
};
