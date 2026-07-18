import type ExcelJS from 'exceljs';
import type { DatabaseSync } from 'node:sqlite';
import { ensureCategory } from '../ledger';
import {
	insertBigPurchase,
	insertCard,
	insertCardReward,
	insertEmergencyItem,
	insertInsurancePolicy,
	insertPremium,
	insertSipFund,
	insertSipPlan,
	setEmergencyPlan
} from '../registry';
import { cellDate, cellNumber, cellPaise, cellString, lakhsToPaise, ratioToBP } from './cells';
import type { Report } from './index';

/**
 * Insurance sheet. Layout: A=type, B=person, C=policy number, D=activation
 * date, F=cover (lakhs), G=cover post NCB (lakhs), H/I/J=premiums 2024/25/26
 * (year taken from the header text "Premium 2024" …).
 */
export function importInsurance(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	const header = ws.getRow(1);
	const premiumCols: { col: number; year: number }[] = [];
	header.eachCell({ includeEmpty: false }, (cell, col) => {
		const m = cellString(cell.value).match(/^Premium\s+(\d{4})$/i);
		if (m) premiumCols.push({ col, year: Number(m[1]) });
	});

	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;
		const type = cellString(row.getCell('A').value);
		if (!type) return;
		const policyType = /term/i.test(type) ? 'term' : 'mediclaim';
		const coverLakhs = cellNumber(row.getCell('F').value);
		const ncbLakhs = cellNumber(row.getCell('G').value);
		const policyId = insertInsurancePolicy(db, {
			policyType,
			person: cellString(row.getCell('B').value),
			policyNumber: cellString(row.getCell('C').value) || null,
			activationDate: cellDate(row.getCell('D').value),
			coverPaise: coverLakhs == null ? null : lakhsToPaise(coverLakhs),
			coverPostNCBPaise: ncbLakhs == null ? null : lakhsToPaise(ncbLakhs)
		});
		report.policies++;
		for (const { col, year } of premiumCols) {
			const paise = cellPaise(row.getCell(col).value);
			if (paise != null && paise > 0) insertPremium(db, policyId, year, paise);
		}
	});
}

/** Big Purchases sheet: A=name, B=date, C=price (may be empty), F=comment. */
export function importBigPurchases(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;
		const name = cellString(row.getCell('A').value);
		if (!name) return;
		const price = cellPaise(row.getCell('C').value);
		if (price == null)
			report.notes.push(`Big Purchases "${name.slice(0, 40)}…": no price recorded.`);
		insertBigPurchase(
			db,
			name,
			cellDate(row.getCell('B').value),
			price,
			cellString(row.getCell('F').value) || null
		);
		report.purchases++;
	});
}

/**
 * Cards sheet. Two blocks: available cards (rows after the double header,
 * until a blank gap), then a rewards tracker ("Jupiter Card" block with
 * merchant rows). Card rows: A=name, B=AMF, C=spend benefit, D/E/F=tier
 * merchant lists, G=caps, H=lounge, I=exceptions, J=use case.
 * Reward rows attach to the card whose name shares the block's first word.
 */
export function importCards(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	const cardIds = new Map<string, number>();
	let rewardsCardId: number | null = null;
	let inRewards = false;

	ws.eachRow((row, rowNumber) => {
		const a = cellString(row.getCell('A').value);
		if (!a || rowNumber <= 3) return; // banner + double header

		if (/^(Jupiter Card|.* Card)$/i.test(a) && cellString(row.getCell('B').value) === 'Billing') {
			inRewards = true;
			const brand = a.replace(/\s*Card$/i, '').toLowerCase();
			for (const [name, id] of cardIds) {
				if (name.toLowerCase().includes(brand)) rewardsCardId = id;
			}
			if (rewardsCardId == null)
				report.notes.push(
					`Cards: rewards block "${a}" matched no imported card — rewards skipped.`
				);
			return;
		}

		if (!inRewards) {
			const amf = cellPaise(row.getCell('B').value);
			const id = insertCard(db, {
				name: a,
				annualFeePaise: amf,
				spendBenefit: cellString(row.getCell('C').value) || null,
				tier1Merchants: cellString(row.getCell('D').value) || null,
				tier2Merchants: cellString(row.getCell('E').value) || null,
				tier3Desc: cellString(row.getCell('F').value) || null,
				caps: cellString(row.getCell('G').value) || null,
				loungeRule: cellString(row.getCell('H').value) || null,
				exceptions: cellString(row.getCell('I').value) || null,
				useCase: cellString(row.getCell('J').value) || null
			});
			cardIds.set(a, id);
			report.cards++;
			return;
		}

		// Rewards block rows: A=merchant, B=reward amount, D=points. Skip headers/totals.
		if (/^(Merchant|Total)$/i.test(a) || rewardsCardId == null) return;
		const reward = cellPaise(row.getCell('B').value);
		if (reward == null || reward <= 0) return;
		const points = cellNumber(row.getCell('D').value);
		insertCardReward(
			db,
			rewardsCardId,
			a,
			reward,
			points == null ? null : Math.round(points),
			null
		);
	});
}

/**
 * Investments sheet → one SIP plan. Layout: B2=total monthly amount; fund rows
 * from R4: A=name, B=cap type, C=ratio.
 */
export function importInvestments(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	const total = cellPaise(ws.getRow(2).getCell('B').value);
	if (total == null || total <= 0) {
		report.notes.push('Investments: no total amount — SIP plan skipped.');
		return;
	}
	const planId = insertSipPlan(db, total);
	report.sipFunds = 0;
	ws.eachRow((row, rowNumber) => {
		if (rowNumber < 4) return;
		const name = cellString(row.getCell('A').value);
		const ratio = cellNumber(row.getCell('C').value);
		if (!name || ratio == null) return;
		insertSipFund(db, planId, name, cellString(row.getCell('B').value) || null, ratioToBP(ratio));
		report.sipFunds = (report.sipFunds ?? 0) + 1;
	});
}

/**
 * Emergency Fund sheet. Item rows (A=name, B=monthly amount) until the
 * "Per-month Expense" summary; "Planned Months" row → the single plan row.
 * Item names seed ledger categories (except the "Wants" bucket name).
 */
export function importEmergencyFund(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	let months: number | null = null;
	ws.eachRow((row) => {
		const name = cellString(row.getCell('A').value);
		const value = row.getCell('B').value;
		if (!name) return;
		if (/^Planned Months$/i.test(name)) {
			months = cellNumber(value);
			return;
		}
		if (/^(Last Updated|Expected Expenses|Per-month Expense|Total Amount|Rounded)$/i.test(name))
			return;
		const paise = cellPaise(value);
		if (paise == null || paise <= 0) return;
		insertEmergencyItem(db, name, paise);
		report.emergencyItems = (report.emergencyItems ?? 0) + 1;
		if (!/^wants$/i.test(name)) ensureCategory(db, name);
	});
	if (months != null && months > 0) setEmergencyPlan(db, months);
	else report.notes.push('Emergency Fund: no planned-months value found.');
}
