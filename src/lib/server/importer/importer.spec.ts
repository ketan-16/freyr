import ExcelJS from 'exceljs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goalProgress } from '../goals';
import { listCategories } from '../categories';
import { listTransactions, monthlyActuals } from '../ledger';
import { openLendingsTotal } from '../registry';
import { testDb } from '../test-db';
import { AlreadyImportedError, runImport } from './index';

let db: DatabaseSync;
let xlsxPath: string;

function d(y: number, m: number, day: number): Date {
	return new Date(Date.UTC(y, m - 1, day));
}

/** A compact synthetic workbook mirroring the real sheet layouts. */
async function buildFixture(): Promise<string> {
	const wb = new ExcelJS.Workbook();

	const monthly = wb.addWorksheet('Monthly');
	monthly.addRow(['Month', 'Salary', 'Wants', 'Wants', 'Needs', 'Needs', 'Invest', 'Invest']);
	monthly.addRow([
		d(2024, 8, 1),
		80137,
		0.3086081998479501,
		24730.93531121518,
		0.29999999999999993,
		24041.099999999995,
		0.3913918001520499,
		31364.96468878482
	]);
	monthly.addRow([
		d(2024, 9, 1),
		101518,
		0.3086081998479501,
		31329.287232164203,
		0.29999999999999993,
		30455.399999999994,
		0.3913918001520499,
		39733.3127678358
	]);
	monthly.addRow(['.']);
	monthly.addRow([
		d(2025, 1, 1),
		999999,
		0.27,
		11111,
		0.3,
		22222,
		0.43,
		33333,
		'Accidentally overwrote 2025 Data'
	]);
	monthly.addRow([
		d(2025, 1, 1),
		140209,
		0.27199748084053704,
		30613.49479117086,
		0.29999999999999993,
		35601.69999999999,
		0.42800251915946297,
		60009.805208829144
	]);

	const yearly = wb.addWorksheet('Yearly');
	yearly.addRow([
		'Year',
		'Income',
		'Income',
		'Needs',
		'Needs',
		'Wants',
		'Wants',
		'Investments',
		'Investments'
	]);
	yearly.addRow([
		'Year',
		'Job',
		'Side Hustle',
		'Estimate',
		'Actual',
		'Estimate',
		'Actual',
		'Estimate',
		'Actual'
	]);
	yearly.addRow([2021, 116558, 1648, 59103, 36000, 35461.8, 37050, 23641.2, 28058.65]);
	yearly.addRow([2024, 999, 0, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA']); // covered by monthly

	const budget = wb.addWorksheet('Budget');
	budget.addRow(['Year', 'Starting Salary', 'Increment', 'Ending Salary']);
	budget.addRow([2021, 0, 0, 396000]);
	budget.addRow([2022, 396000, 120780, 516780]);

	const goals = wb.addWorksheet('Goals');
	goals.getCell('A1').value = 'Category Name →';
	goals.getCell('B1').value = 'Car';
	goals.getCell('C1').value = 'Wedding';
	goals.getCell('A2').value = 'Estimated Amount →';
	goals.getCell('B2').value = 700000;
	goals.getCell('C2').value = 1000000;
	goals.getCell('A6').value = 'Quarterly Breakdown';
	goals.getCell('A7').value = 'Quarter';
	goals.getCell('A8').value = 'Pre-Q3 2024';
	goals.getCell('B8').value = 396500;
	goals.getCell('C8').value = 25000;
	goals.getCell('A9').value = 'Q3 2024';
	goals.getCell('B9').value = 33500;
	goals.getCell('C9').value = 2000;
	goals.getCell('A10').value = 'Q4 2024';
	goals.getCell('B10').value = 70000;
	goals.getCell('C10').value = 0; // zero contribution — skipped

	const tabs = wb.addWorksheet('Tabs');
	tabs.addRow(['Tab Name', 'Amount', 'Status', 'Saved In', 'Planned For']);
	tabs.addRow(['Bike', 125000, 'In Progress', 'Bank']);
	tabs.addRow(['Car', 460000, 'Complete', 'FD', 'AU FD Full Utilization']); // dup of Goals
	tabs.addRow(['Total', 585000]);

	const lendings = wb.addWorksheet('Lendings');
	lendings.addRow([
		'Person',
		'Amount',
		'With Interest',
		'Principal Left',
		d(2024, 6, 1),
		d(2024, 7, 1)
	]);
	lendings.addRow(['Makarand', 186000, 246000, 175500, 10000, 500]);
	lendings.addRow(['Sarvesh']); // no amount — skipped

	const insurance = wb.addWorksheet('Insurance');
	insurance.addRow([
		'Type',
		'Person',
		'Policy Number',
		'Activation Date',
		'Renewal Date',
		'Cover (Lacs)',
		'Total Cover Post NCB',
		'Premium 2024',
		'Premium 2025'
	]);
	insurance.addRow(['Mediclaim', 'Me', 85011897, d(2024, 6, 20), null, 10, 10, 8816, 9280]);
	insurance.addRow(['Term Plan', 'Me', 'F8403691', d(2024, 5, 27), null, 200, null, 14514, 14514]);

	const purchases = wb.addWorksheet('Big Purchases');
	purchases.addRow(['Name', 'Purchase Date', 'Price', 'Used Until', 'Years used', 'Comment']);
	purchases.addRow(['Phone', d(2022, 12, 25), 15048]);
	purchases.addRow(['Apple iPhone 16', d(2024, 10, 28), null, null, null, 'battery limits']);

	const cards = wb.addWorksheet('Cards');
	cards.addRow(['Available Cards']);
	cards.addRow([
		'Card',
		'AMF',
		'Spend Benefits',
		'Benefits',
		'Benefits',
		'Benefits',
		'Comments',
		'Lounge',
		'Exceptions',
		'My use case'
	]);
	cards.addRow(['Card', 'AMF', 'Spend Benefits', 0.1, 0.05, 0.01]);
	cards.addRow([
		'Jupiter Edge +',
		0,
		'TBD',
		'Amazon, Flipkart',
		'MakeMyTrip',
		'All other spends',
		'10% upto 1.5k/m',
		'NA',
		'Grocery, GVs',
		'Major Shopping'
	]);
	cards.addRow(['Jupiter Card', 'Billing', '17th']);
	cards.addRow(['Merchant', 'Amount', 'Amount', 'Jewels ( 5J=1Rs.)', 'Limit']);
	cards.addRow(['Amazon', 496.3, 496.3, 2481.5, 500]);
	cards.addRow(['Total', 496.3, 496.3, 2481.5]);

	const investments = wb.addWorksheet('Investments');
	investments.addRow(['Regular Monthly Investments']);
	investments.addRow(['Total Amount', 60000]);
	investments.addRow(['Chosen Funds', 'Type', '%', 'Amount']);
	investments.addRow(['Fund A', 'Large Cap', 0.5]);
	investments.addRow(['Fund B', 'Mid Cap', 0.5]);

	const emergency = wb.addWorksheet('Emergency Fund');
	emergency.getCell('A1').value = 'Last Updated';
	emergency.getCell('B1').value = 'Jan 5th, 2025';
	emergency.getCell('A5').value = 'Bike EMI';
	emergency.getCell('B5').value = 4727;
	emergency.getCell('A6').value = 'Wants';
	emergency.getCell('B6').value = 3000;
	emergency.getCell('A7').value = 'Grocery';
	emergency.getCell('B7').value = 2000;
	emergency.getCell('A15').value = 'Planned Months';
	emergency.getCell('B15').value = 6;

	const path = join(mkdtempSync(join(tmpdir(), 'freyr-xlsx-')), 'fixture.xlsx');
	await wb.xlsx.writeFile(path);
	return path;
}

beforeEach(async () => {
	db = testDb();
	xlsxPath = await buildFixture();
});

afterEach(() => {
	db.close();
});

describe('runImport', () => {
	it('imports the whole fixture and reconciles totals', async () => {
		const report = await runImport(db, xlsxPath);

		// Monthly: 3 months × (income + 3 buckets) = 12; Yearly 2021: 5;
		// Goals: Car 3 + Wedding 2 (Q4 zero skipped); Tabs: Bike opening 1;
		// Lendings: 2 repayments.
		expect(report.transactions).toBe(12 + 5 + 5 + 1 + 2);
		expect(report.budgetPeriods).toBe(2);
		expect(report.salaryProjections).toBe(2);
		expect(report.goals).toBe(3); // Car, Wedding, Bike (Tabs Car deduped)
		expect(report.lendings).toBe(1);
		expect(report.policies).toBe(2);
		expect(report.purchases).toBe(2);
		expect(report.cards).toBe(1);
		expect(report.sipFunds).toBe(2);
		expect(report.emergencyItems).toBe(3);

		// Monthly actuals for the clean 2025-01 row (overwrote row skipped).
		expect(monthlyActuals(db, 2025, 1)).toEqual({
			income: 14020900,
			needs: 3061349,
			wants: 3560170,
			invest: 6000981
		});

		// Budget periods: the two distinct ratio triples.
		const periods = db
			.prepare(
				'SELECT effective_from, needs_bp, wants_bp, invest_bp FROM budget_periods ORDER BY effective_from'
			)
			.all();
		expect(periods).toEqual([
			{ effective_from: '2024-08-01', needs_bp: 3086, wants_bp: 3000, invest_bp: 3914 },
			{ effective_from: '2025-01-01', needs_bp: 2720, wants_bp: 3000, invest_bp: 4280 }
		]);

		// Yearly 2021 landed on Dec 31; 2024 skipped (covered by monthly).
		const y2021 = listTransactions(db, { year: 2021 });
		expect(y2021).toHaveLength(5);
		expect(new Set(y2021.map((t) => t.date))).toEqual(new Set(['2021-12-31']));

		// Goal totals match the sheet's accumulated sums.
		const progress = goalProgress(db);
		const car = progress.find((p) => p.goal.name === 'Car')!;
		expect(car.contributed).toBe(50000000); // 396500 + 33500 + 70000 rupees
		expect(car.goal.targetPaise).toBe(70000000);
		const bike = progress.find((p) => p.goal.name === 'Bike')!;
		expect(bike.contributed).toBe(12500000);
		expect(bike.goal.kind).toBe('pot');

		// Lending principal left: 186000 − 10500.
		expect(openLendingsTotal(db)).toBe(17550000);

		// Insurance: lakh covers and premiums.
		const policy = db
			.prepare("SELECT cover_paise FROM insurance_policies WHERE policy_type = 'term'")
			.get() as { cover_paise: number };
		expect(policy.cover_paise).toBe(2000000000);
		const premiums = db.prepare('SELECT COUNT(*) AS n FROM insurance_premiums').get() as {
			n: number;
		};
		expect(premiums.n).toBe(4);

		// SIP funds in basis points.
		const funds = db.prepare('SELECT pct_bp FROM sip_plan_funds ORDER BY id').all() as {
			pct_bp: number;
		}[];
		expect(funds.map((f) => f.pct_bp)).toEqual([5000, 5000]);

		// Emergency items seed needs categories, except the "Wants" bucket name.
		const seeded = listCategories(db);
		expect(seeded.map((c) => c.name)).toContain('Bike EMI');
		expect(seeded.map((c) => c.name)).toContain('Grocery');
		expect(seeded.map((c) => c.name)).not.toContain('Wants');
		expect(seeded.every((c) => c.scope === 'needs')).toBe(true);
		const plan = db.prepare('SELECT planned_months FROM emergency_fund_plans').get() as {
			planned_months: number;
		};
		expect(plan.planned_months).toBe(6);

		// Dedup + skip notes present.
		expect(report.notes.join('\n')).toMatch(/Tabs "Car".*Goals wins/);
		expect(report.notes.join('\n')).toMatch(/Sarvesh.*no amount/);
	});

	it('refuses to run twice', async () => {
		await runImport(db, xlsxPath);
		await expect(runImport(db, xlsxPath)).rejects.toThrow(AlreadyImportedError);
	});
});
