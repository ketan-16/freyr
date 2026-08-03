import { describe, expect, it } from 'vitest';
import {
	assertTriple,
	roundTripleBP,
	weightsAfter,
	type Policy,
	type TripleBP
} from './budget-policy';

const POLICY: Policy = {
	baseEffectiveFrom: '2021-09-01',
	base: { needsBP: 5000, wantsBP: 3000, investBP: 2000 },
	marginal: { needsBP: 2000, wantsBP: 3000, investBP: 5000 }
};

/** Increments from the real workbook's Budget tab, 2022..2030. */
const WORKBOOK = [3050, 9050, 1111, 5085, 540, 1000, 1000, 1000, 1000];

/** The realized shares those increments produced, 2021..2030. */
const EXPECTED: [number, number, number][] = [
	[5000, 3000, 2000],
	[4299, 3000, 2701],
	[3207, 3000, 3793],
	[3086, 3000, 3914],
	[2720, 3000, 4280],
	[2683, 3000, 4317],
	[2621, 3000, 4379],
	[2565, 3000, 4435],
	[2513, 3000, 4487],
	[2467, 3000, 4533]
];

const sum = (t: TripleBP) => t.needsBP + t.wantsBP + t.investBP;

describe('weightsAfter', () => {
	it('reproduces the real workbook trajectory', () => {
		for (let y = 0; y < EXPECTED.length; y++) {
			const w = weightsAfter(POLICY, WORKBOOK.slice(0, y));
			expect([w.needsBP, w.wantsBP, w.investBP], `year ${2021 + y}`).toEqual(EXPECTED[y]);
		}
	});

	it('always sums to exactly 10000 across the trajectory', () => {
		for (let y = 0; y <= WORKBOOK.length; y++) {
			expect(sum(weightsAfter(POLICY, WORKBOOK.slice(0, y)))).toBe(10000);
		}
	});

	it('returns the base weights when there are no promotions', () => {
		expect(weightsAfter(POLICY, [])).toEqual(POLICY.base);
	});

	it('pins wants at 30% forever, because it is 30% of base and margin alike', () => {
		for (let y = 0; y <= WORKBOOK.length; y++) {
			expect(weightsAfter(POLICY, WORKBOOK.slice(0, y)).wantsBP).toBe(3000);
		}
	});

	it('moves wants when the marginal policy says it should', () => {
		const shrinking: Policy = {
			...POLICY,
			marginal: { needsBP: 2000, wantsBP: 2000, investBP: 6000 }
		};
		// The pin is policy, not hard-coding: a lower marginal wants drags the share down.
		expect(weightsAfter(shrinking, [10000]).wantsBP).toBeLessThan(3000);
	});

	it('is order-independent in aggregate: two raises equal their compounded product', () => {
		// 10% then 20% compounds to 32%, so both must land on identical weights.
		expect(weightsAfter(POLICY, [1000, 2000])).toEqual(weightsAfter(POLICY, [3200]));
	});

	it('converges onto the marginal split as growth compounds', () => {
		// 100 raises of 10% put F at ~13781, which drives (base − marginal)/F
		// below half a basis point — the weights land exactly on the asymptote.
		expect(weightsAfter(POLICY, Array(100).fill(1000))).toEqual({
			needsBP: 2000,
			wantsBP: 3000,
			investBP: 5000
		});
	});
});

describe('roundTripleBP', () => {
	it('leaves exact integers untouched', () => {
		expect(roundTripleBP([5000, 3000, 2000])).toEqual([5000, 3000, 2000]);
	});

	it('hands the leftover unit to the largest fractional part', () => {
		// floors are 3206/3000/3793 = 9999; needs has the largest remainder (.74)
		expect(roundTripleBP([3206.74, 3000, 3793.26])).toEqual([3207, 3000, 3793]);
	});

	it('breaks ties by bucket order, deterministically', () => {
		const out = roundTripleBP([3333.34, 3333.33, 3333.33]);
		expect(out).toEqual([3334, 3333, 3333]);
		expect(out[0] + out[1] + out[2]).toBe(10000);
	});

	it('distributes two leftover units to the two largest remainders', () => {
		// floors are 3333/3333/3332 = 9998, so two units go out: .7 and .7 beat .6
		expect(roundTripleBP([3333.7, 3333.7, 3332.6])).toEqual([3334, 3334, 3332]);
	});
});

describe('assertTriple', () => {
	it('accepts a triple summing to 10000', () => {
		expect(() =>
			assertTriple({ needsBP: 5000, wantsBP: 3000, investBP: 2000 }, 'Base')
		).not.toThrow();
	});

	it('rejects one that does not, naming the offender', () => {
		expect(() => assertTriple({ needsBP: 5000, wantsBP: 3000, investBP: 1000 }, 'Base')).toThrow(
			/Base.*100/
		);
	});
});
