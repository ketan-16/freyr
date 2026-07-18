import type ExcelJS from 'exceljs';
import type { DatabaseSync } from 'node:sqlite';
import { createPeriod } from '../budgets';
import { createTransaction } from '../ledger';
import { cellDate, cellNumber, cellPaise, cellString, paiseFromNumber, ratioToBP } from './cells';
import type { Report } from './index';

export const IMPORT_NOTE = 'Imported from Excel';

/**
 * Monthly sheet. Layout (verified against the workbook dump):
 *   A=month date, B=salary, C/D=needs ratio+amount (headers say "Wants" — the
 *   percentages prove the swap), E/F=wants ratio+amount, G/H=invest ratio+amount,
 *   I=optional note. Rows with "Accidentally overwrote" in I are superseded by
 *   clean duplicates at the sheet bottom; "." rows are placeholders.
 *
 * Returns the set of years that have monthly rows (Yearly import skips them).
 */
export function importMonthly(
	db: DatabaseSync,
	ws: ExcelJS.Worksheet,
	report: Report
): Set<number> {
	report.notes.push(
		'Monthly: headers label C=Wants/E=Needs but ratios prove C/D=needs, E/F=wants — imported swapped.'
	);

	interface MonthRow {
		date: string;
		salaryPaise: number;
		needsPaise: number;
		wantsPaise: number;
		investPaise: number;
		needsBP: number;
		wantsBP: number;
		investBP: number;
	}
	const months = new Map<string, MonthRow>();

	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return; // header
		const note = cellString(row.getCell('I').value);
		const label = cellString(row.getCell('A').value);
		if (label === '.') return; // placeholder
		if (/accidentally overwrote/i.test(note)) {
			report.notes.push(`Monthly R${rowNumber}: skipped ("${note}") — clean duplicate wins.`);
			return;
		}
		const date = cellDate(row.getCell('A').value);
		if (!date) return;
		const salaryPaise = cellPaise(row.getCell('B').value);
		if (salaryPaise == null) return;

		const month: MonthRow = {
			date,
			salaryPaise,
			needsPaise: cellPaise(row.getCell('D').value) ?? 0,
			wantsPaise: cellPaise(row.getCell('F').value) ?? 0,
			investPaise: cellPaise(row.getCell('H').value) ?? 0,
			needsBP: ratioToBP(cellNumber(row.getCell('C').value) ?? 0),
			wantsBP: ratioToBP(cellNumber(row.getCell('E').value) ?? 0),
			investBP: ratioToBP(cellNumber(row.getCell('G').value) ?? 0)
		};
		if (months.has(date))
			report.notes.push(`Monthly R${rowNumber}: duplicate month ${date} replaced by later row.`);
		months.set(date, month);
	});

	const years = new Set<number>();
	const sorted = [...months.values()].sort((a, b) => a.date.localeCompare(b.date));

	// Budget periods: distinct bp triples, effective from the first month each appears.
	let lastTriple = '';
	for (const m of sorted) {
		const triple = `${m.needsBP}/${m.wantsBP}/${m.investBP}`;
		if (triple !== lastTriple) {
			createPeriod(db, {
				effectiveFrom: m.date,
				needsBP: m.needsBP,
				wantsBP: m.wantsBP,
				investBP: m.investBP
			});
			report.budgetPeriods++;
			lastTriple = triple;
		}
	}

	for (const m of sorted) {
		years.add(Number(m.date.slice(0, 4)));
		createTransaction(db, {
			date: m.date,
			amountPaise: m.salaryPaise,
			direction: 'income',
			incomeSource: 'job',
			imported: true,
			note: IMPORT_NOTE
		});
		report.transactions++;
		for (const [bucket, paise] of [
			['needs', m.needsPaise],
			['wants', m.wantsPaise],
			['investments', m.investPaise]
		] as const) {
			if (paise <= 0) continue;
			createTransaction(db, {
				date: m.date,
				amountPaise: paise,
				direction: 'outflow',
				bucket,
				imported: true,
				note: IMPORT_NOTE
			});
			report.transactions++;
		}
	}

	return years;
}

/**
 * Yearly sheet (pre-Monthly history). Layout: A=year, B=job income, C=side
 * hustle, E/G/I = needs/wants/invest ACTUALS (D/F/H are estimates). "NA" cells
 * skip. Only years without monthly rows import, dated Dec 31.
 */
export function importYearly(
	db: DatabaseSync,
	ws: ExcelJS.Worksheet,
	monthlyYears: Set<number>,
	report: Report
): void {
	ws.eachRow((row, rowNumber) => {
		if (rowNumber <= 2) return; // two header rows
		const year = cellNumber(row.getCell('A').value);
		if (year == null) return;
		if (monthlyYears.has(year)) {
			report.notes.push(`Yearly ${year}: skipped — monthly rows cover it.`);
			return;
		}
		const date = `${year}-12-31`;
		const entries = [
			{ direction: 'income', incomeSource: 'job', paise: cellPaise(row.getCell('B').value) },
			{
				direction: 'income',
				incomeSource: 'side_hustle',
				paise: cellPaise(row.getCell('C').value)
			},
			{ direction: 'outflow', bucket: 'needs', paise: cellPaise(row.getCell('E').value) },
			{ direction: 'outflow', bucket: 'wants', paise: cellPaise(row.getCell('G').value) },
			{ direction: 'outflow', bucket: 'investments', paise: cellPaise(row.getCell('I').value) }
		] as const;
		let any = false;
		for (const e of entries) {
			if (e.paise == null || e.paise <= 0) continue;
			createTransaction(db, {
				date,
				amountPaise: e.paise,
				direction: e.direction,
				bucket: 'bucket' in e ? e.bucket : undefined,
				incomeSource: 'incomeSource' in e ? e.incomeSource : undefined,
				imported: true,
				note: IMPORT_NOTE
			});
			report.transactions++;
			any = true;
		}
		if (!any) report.notes.push(`Yearly ${year}: no importable figures.`);
	});
}

/**
 * Budget sheet → salary_projections. Layout: A=year, B=starting salary,
 * C=increment amount, D=ending salary. increment_bp derived as round(C/B×10000)
 * when B>0 (the % literal only exists inside formulas).
 */
export function importBudget(db: DatabaseSync, ws: ExcelJS.Worksheet, report: Report): void {
	ws.eachRow((row, rowNumber) => {
		if (rowNumber === 1) return;
		const year = cellNumber(row.getCell('A').value);
		const ending = cellNumber(row.getCell('D').value);
		if (year == null || ending == null || ending <= 0) return;
		const starting = cellNumber(row.getCell('B').value) ?? 0;
		const increment = cellNumber(row.getCell('C').value) ?? 0;
		const incrementBP = starting > 0 ? Math.round((increment / starting) * 10000) : null;
		db.prepare(
			'INSERT INTO salary_projections (year, ending_salary_paise, increment_bp) VALUES (?, ?, ?)'
		).run(year, paiseFromNumber(ending), incrementBP);
		report.salaryProjections++;
	});
}
