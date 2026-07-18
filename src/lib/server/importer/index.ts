import ExcelJS from 'exceljs';
import type { DatabaseSync } from 'node:sqlite';
import { importGoals, importLendings, importTabs } from './goals';
import { importBudget, importMonthly, importYearly } from './monthly';
import {
	importBigPurchases,
	importCards,
	importEmergencyFund,
	importInsurance,
	importInvestments
} from './registry';

export interface Report {
	transactions: number;
	budgetPeriods: number;
	salaryProjections: number;
	goals: number;
	lendings: number;
	policies: number;
	purchases: number;
	cards: number;
	sipFunds?: number;
	emergencyItems?: number;
	notes: string[];
}

export class AlreadyImportedError extends Error {
	constructor() {
		super('Import already ran — imported transactions exist. Refusing to run twice.');
		this.name = 'AlreadyImportedError';
	}
}

/**
 * One-time seed import of the Excel workbook. Idempotent by refusal; the whole
 * import runs in a single SQLite transaction. Sheets that are missing are
 * reported, not fatal.
 */
export async function runImport(db: DatabaseSync, xlsxPath: string): Promise<Report> {
	const existing = db
		.prepare('SELECT COUNT(*) AS n FROM transactions WHERE imported = 1')
		.get() as { n: number };
	if (existing.n > 0) throw new AlreadyImportedError();

	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(xlsxPath);

	const report: Report = {
		transactions: 0,
		budgetPeriods: 0,
		salaryProjections: 0,
		goals: 0,
		lendings: 0,
		policies: 0,
		purchases: 0,
		cards: 0,
		notes: []
	};

	const sheet = (name: string): ExcelJS.Worksheet | undefined => {
		const ws = wb.getWorksheet(name);
		if (!ws) report.notes.push(`Sheet "${name}" not found — skipped.`);
		return ws;
	};

	db.exec('BEGIN');
	try {
		const monthly = sheet('Monthly');
		const monthlyYears = monthly ? importMonthly(db, monthly, report) : new Set<number>();
		const yearly = sheet('Yearly');
		if (yearly) importYearly(db, yearly, monthlyYears, report);
		const budget = sheet('Budget');
		if (budget) importBudget(db, budget, report);

		const goalsSheet = sheet('Goals');
		const goalNames = goalsSheet ? importGoals(db, goalsSheet, report) : new Set<string>();
		const tabs = sheet('Tabs');
		if (tabs) importTabs(db, tabs, goalNames, report);
		const lendings = sheet('Lendings');
		if (lendings) importLendings(db, lendings, report);

		const insurance = sheet('Insurance');
		if (insurance) importInsurance(db, insurance, report);
		const purchases = sheet('Big Purchases');
		if (purchases) importBigPurchases(db, purchases, report);
		const cards = sheet('Cards');
		if (cards) importCards(db, cards, report);
		const investments = sheet('Investments');
		if (investments) importInvestments(db, investments, report);
		const emergency = sheet('Emergency Fund');
		if (emergency) importEmergencyFund(db, emergency, report);

		report.notes.push(
			'Goal contributions dated inside monthly-covered months also count toward invest actuals — the workbook could not be reconciled itemized.'
		);
		db.exec('COMMIT');
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}

	return report;
}
