import type ExcelJS from 'exceljs';
import type { DatabaseSync } from 'node:sqlite';
import { createGoal, ensureLocation } from '../goals';
import { createTransaction } from '../ledger';
import { createLending } from '../registry';
import { cellDate, cellPaise, cellString, quarterLabelToDate } from './cells';
import type { Report } from './index';
import { IMPORT_NOTE } from './monthly';

/**
 * Goals sheet. Layout: goals across columns B..; R1=names, R2=targets,
 * R7+ quarterly rows (A=label like "Pre-Q3 2024", per-goal amounts).
 * Contributions land as investment outflows at location "Bank".
 * Returns the goal names imported (Tabs dedups against them).
 */
export function importGoals(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): Set<string> {
	const bankId = ensureLocation(db, 'Bank');
	const names = new Set<string>();
	const goalCols: { col: number; id: number; name: string }[] = [];

	const nameRow = ws.getRow(1);
	const targetRow = ws.getRow(2);
	nameRow.eachCell({ includeEmpty: false }, (cell, col) => {
		if (col === 1) return; // "Category Name →" label
		const name = cellString(cell.value);
		if (!name) return;
		const target = cellPaise(targetRow.getCell(col).value);
		const id = createGoal(db, { name, kind: 'goal', targetPaise: target });
		report.goals++;
		names.add(name.toLowerCase());
		goalCols.push({ col, id, name });
	});

	ws.eachRow((row, rowNumber) => {
		if (rowNumber < 7) return; // headers + summary block
		const label = cellString(row.getCell('A').value);
		if (!label || /^quarter$/i.test(label)) return;
		let date: string;
		try {
			date = quarterLabelToDate(label);
		} catch {
			return; // not a quarter row
		}
		for (const g of goalCols) {
			const paise = cellPaise(row.getCell(g.col).value);
			if (paise == null || paise <= 0) continue;
			createTransaction(db, {
				date,
				amountPaise: paise,
				direction: 'outflow',
				bucket: 'investments',
				goalId: g.id,
				locationId: bankId,
				imported: true,
				note: `${IMPORT_NOTE} (${label})`
			});
			report.transactions++;
		}
	});

	return names;
}

/** The date used for undated opening contributions (Tabs pots). */
export const POT_OPENING_DATE = '2024-06-30';

/**
 * Tabs sheet → pots. Layout: A=name, B=amount, C=status, D=saved-in, E=planned
 * for. "Total" row skipped. Names already imported from Goals are skipped
 * (Goals wins). Saved amounts become one opening contribution at the saved-in
 * location; the pot target is the saved amount.
 */
export function importTabs(
	db: DatabaseSync,
	ws: ExcelJS.Worksheet,
	goalNames: Set<string>,
	report: Report
): void {
	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;
		const name = cellString(row.getCell('A').value);
		if (!name || /^total$/i.test(name)) return;
		if (goalNames.has(name.toLowerCase())) {
			report.notes.push(`Tabs "${name}": skipped — already imported from Goals (Goals wins).`);
			return;
		}
		const paise = cellPaise(row.getCell('B').value);
		if (paise == null || paise <= 0) {
			report.notes.push(`Tabs "${name}": skipped — no amount.`);
			return;
		}
		const status = cellString(row.getCell('C').value);
		const savedIn = cellString(row.getCell('D').value) || 'Bank';
		const plannedFor = cellString(row.getCell('E').value) || null;
		const goalId = createGoal(db, {
			name,
			kind: 'pot',
			targetPaise: paise,
			status: /^complete$/i.test(status) ? 'complete' : 'active',
			plannedFor
		});
		report.goals++;
		createTransaction(db, {
			date: POT_OPENING_DATE,
			amountPaise: paise,
			direction: 'outflow',
			bucket: 'investments',
			goalId,
			locationId: ensureLocation(db, savedIn),
			imported: true,
			note: `${IMPORT_NOTE} (opening balance)`
		});
		report.transactions++;
	});
}

/**
 * Lendings sheet. Layout: A=person, B=amount, C=with interest, D=principal
 * left (computed — ignored), E..=monthly repayment columns whose HEADER row
 * holds the month date. Person rows without an amount are skipped with a note.
 */
export function importLendings(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	const header = ws.getRow(1);
	const repaymentCols: { col: number; date: string }[] = [];
	header.eachCell({ includeEmpty: false }, (cell, col) => {
		const date = cellDate(cell.value);
		if (date) repaymentCols.push({ col, date });
	});

	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;
		const person = cellString(row.getCell('A').value);
		if (!person) return;
		const principal = cellPaise(row.getCell('B').value);
		if (principal == null || principal <= 0) {
			report.notes.push(`Lendings R${rowNumber} "${person}": skipped — no amount.`);
			return;
		}
		const lendingId = createLending(db, {
			person,
			principalPaise: principal,
			withInterestPaise: cellPaise(row.getCell('C').value)
		});
		report.lendings++;
		for (const { col, date } of repaymentCols) {
			const paise = cellPaise(row.getCell(col).value);
			if (paise == null || paise <= 0) continue;
			createTransaction(db, {
				date,
				amountPaise: paise,
				direction: 'income',
				incomeSource: 'other',
				lendingId,
				imported: true,
				note: `${IMPORT_NOTE} (repayment)`
			});
			report.transactions++;
		}
	});
}
