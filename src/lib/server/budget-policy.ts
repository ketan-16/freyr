/**
 * How the base salary splits, and how each raise splits.
 *
 * A raise of fraction g moves every bucket's share by
 *     share' = (share + marginal × g) / (1 + g)
 * which folds over a promotion history into a drift-free closed form in the
 * cumulative growth factor F = Π (1 + gᵢ):
 *     share  = marginal + (base − marginal) / F
 *
 * The salary never appears, so a promotion percentage alone determines the
 * weights. F and the intermediate shares are dimensionless ratios — the only
 * floats in this feature. They never touch money: the output is integer basis
 * points and every rupee figure still goes through integer mulBP.
 */

export interface TripleBP {
	needsBP: number;
	wantsBP: number;
	investBP: number;
}

export interface Policy {
	baseEffectiveFrom: string;
	base: TripleBP;
	marginal: TripleBP;
}

export const TOTAL_BP = 10000;

export function assertTriple(t: TripleBP, label: string): void {
	const total = t.needsBP + t.wantsBP + t.investBP;
	if (total !== TOTAL_BP)
		throw new Error(`${label} must sum to 100% (got ${(total / 100).toFixed(2)}%).`);
}

/**
 * Rounds three exact basis-point shares to integers summing to exactly 10000,
 * which the budget_periods CHECK constraint requires.
 *
 * Largest remainder: floor all three, then hand the leftover units to the
 * largest fractional parts. Because each floor loses under one unit, there are
 * never more than two to hand out. Ties go to the earlier bucket so the result
 * is deterministic.
 */
export function roundTripleBP(exact: [number, number, number]): [number, number, number] {
	const floors = exact.map(Math.floor) as [number, number, number];
	const leftover = TOTAL_BP - (floors[0] + floors[1] + floors[2]);
	const byRemainder = exact
		.map((value, index) => ({ frac: value - floors[index], index }))
		.sort((a, b) => b.frac - a.frac || a.index - b.index);

	const out: [number, number, number] = [...floors];
	for (let k = 0; k < leftover; k++) out[byRemainder[k].index] += 1;
	return out;
}

/** Weights after folding the given raises, in basis points, over the policy. */
export function weightsAfter(policy: Policy, incrementsBP: number[]): TripleBP {
	let f = 1;
	for (const increment of incrementsBP) f *= 1 + increment / TOTAL_BP;

	const share = (base: number, marginal: number) => marginal + (base - marginal) / f;
	const [needsBP, wantsBP, investBP] = roundTripleBP([
		share(policy.base.needsBP, policy.marginal.needsBP),
		share(policy.base.wantsBP, policy.marginal.wantsBP),
		share(policy.base.investBP, policy.marginal.investBP)
	]);
	return { needsBP, wantsBP, investBP };
}
