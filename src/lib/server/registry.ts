import type { DatabaseSync } from 'node:sqlite';
import type { Paise } from '$lib/money';

export interface LendingInput {
	person: string;
	principalPaise: number;
	withInterestPaise?: number | null;
	lentOn?: string | null;
	notes?: string | null;
}

export function createLending(db: DatabaseSync, l: LendingInput): number {
	if (!l.person.trim()) throw new Error('Lending person is required.');
	if (!Number.isInteger(l.principalPaise) || l.principalPaise <= 0)
		throw new Error('Lending principal must be a positive amount.');
	const result = db
		.prepare(
			`INSERT INTO lendings (person, principal_paise, with_interest_paise, lent_on, notes)
			 VALUES (?, ?, ?, ?, ?)`
		)
		.run(
			l.person.trim(),
			l.principalPaise,
			l.withInterestPaise ?? null,
			l.lentOn ?? null,
			l.notes ?? null
		);
	return Number(result.lastInsertRowid);
}

/** Σ principal − Σ repayments over open lendings — computed, never stored. */
export function openLendingsTotal(db: DatabaseSync): Paise {
	const row = db
		.prepare(
			`SELECT COALESCE(SUM(l.principal_paise), 0)
			      - COALESCE((SELECT SUM(t.amount_paise) FROM transactions t
			                  JOIN lendings ol ON ol.id = t.lending_id
			                  WHERE ol.status = 'open'), 0) AS total
			 FROM lendings l WHERE l.status = 'open'`
		)
		.get() as { total: number };
	return row.total;
}

// ---- Import-target insert helpers (used by the seed importer only) ----

export interface InsurancePolicyInput {
	policyType: 'mediclaim' | 'term';
	person: string;
	policyNumber?: string | null;
	activationDate?: string | null;
	coverPaise?: number | null;
	coverPostNCBPaise?: number | null;
	notes?: string | null;
}

export function insertInsurancePolicy(db: DatabaseSync, p: InsurancePolicyInput): number {
	const result = db
		.prepare(
			`INSERT INTO insurance_policies
			 (policy_type, person, policy_number, activation_date, cover_paise, cover_post_ncb_paise, notes)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			p.policyType,
			p.person,
			p.policyNumber ?? null,
			p.activationDate ?? null,
			p.coverPaise ?? null,
			p.coverPostNCBPaise ?? null,
			p.notes ?? null
		);
	return Number(result.lastInsertRowid);
}

export function insertPremium(
	db: DatabaseSync,
	policyId: number,
	year: number,
	amountPaise: number
): void {
	db.prepare('INSERT INTO insurance_premiums (policy_id, year, amount_paise) VALUES (?, ?, ?)').run(
		policyId,
		year,
		amountPaise
	);
}

export function insertBigPurchase(
	db: DatabaseSync,
	name: string,
	purchaseDate: string | null,
	pricePaise: number | null,
	notes: string | null
): number {
	const result = db
		.prepare(
			'INSERT INTO big_purchases (name, purchase_date, price_paise, notes) VALUES (?, ?, ?, ?)'
		)
		.run(name, purchaseDate, pricePaise, notes);
	return Number(result.lastInsertRowid);
}

export interface CardInput {
	name: string;
	annualFeePaise?: number | null;
	spendBenefit?: string | null;
	tier1Merchants?: string | null;
	tier2Merchants?: string | null;
	tier3Desc?: string | null;
	caps?: string | null;
	loungeRule?: string | null;
	exceptions?: string | null;
	useCase?: string | null;
	status?: 'active' | 'closed';
}

export function insertCard(db: DatabaseSync, c: CardInput): number {
	const result = db
		.prepare(
			`INSERT INTO cards
			 (name, annual_fee_paise, spend_benefit, tier1_merchants, tier2_merchants, tier3_desc,
			  caps, lounge_rule, exceptions, use_case, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			c.name,
			c.annualFeePaise ?? null,
			c.spendBenefit ?? null,
			c.tier1Merchants ?? null,
			c.tier2Merchants ?? null,
			c.tier3Desc ?? null,
			c.caps ?? null,
			c.loungeRule ?? null,
			c.exceptions ?? null,
			c.useCase ?? null,
			c.status ?? 'active'
		);
	return Number(result.lastInsertRowid);
}

export function insertCardReward(
	db: DatabaseSync,
	cardId: number,
	merchant: string,
	rewardPaise: number,
	points: number | null,
	period: string | null
): void {
	db.prepare(
		'INSERT INTO card_rewards (card_id, merchant, reward_paise, points, period) VALUES (?, ?, ?, ?, ?)'
	).run(cardId, merchant, rewardPaise, points, period);
}

export function insertSipPlan(db: DatabaseSync, monthlyTotalPaise: number): number {
	const result = db
		.prepare('INSERT INTO sip_plans (monthly_total_paise) VALUES (?)')
		.run(monthlyTotalPaise);
	return Number(result.lastInsertRowid);
}

export function insertSipFund(
	db: DatabaseSync,
	planId: number,
	name: string,
	capType: string | null,
	pctBP: number
): void {
	db.prepare(
		'INSERT INTO sip_plan_funds (plan_id, name, cap_type, pct_bp) VALUES (?, ?, ?, ?)'
	).run(planId, name, capType, pctBP);
}

export function setEmergencyPlan(db: DatabaseSync, months: number): void {
	db.prepare(
		`INSERT INTO emergency_fund_plans (id, planned_months) VALUES (1, ?)
		 ON CONFLICT (id) DO UPDATE SET planned_months = excluded.planned_months`
	).run(months);
}

export function insertEmergencyItem(db: DatabaseSync, name: string, monthlyPaise: number): void {
	db.prepare('INSERT INTO emergency_fund_items (name, monthly_paise) VALUES (?, ?)').run(
		name,
		monthlyPaise
	);
}
