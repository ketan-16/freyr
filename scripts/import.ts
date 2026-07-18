/**
 * One-time Excel seed import.
 * Usage: npm run import -- "Finances v2.xlsx" [--db freyr.db]
 */
import { formatBP, formatMoney } from '../src/lib/money';
import { migrate, open } from '../src/lib/server/db';
import { runImport } from '../src/lib/server/importer';

const args = process.argv.slice(2);
const dbFlag = args.indexOf('--db');
const dbPath = dbFlag >= 0 ? args[dbFlag + 1] : 'freyr.db';
const xlsxPath = args.filter((_, i) => dbFlag < 0 || (i !== dbFlag && i !== dbFlag + 1))[0];

if (!xlsxPath) {
	console.error('usage: npm run import -- <xlsx path> [--db freyr.db]');
	process.exit(1);
}

const db = open(dbPath);
migrate(db);

try {
	const report = await runImport(db, xlsxPath);

	console.log(`\nImported into ${dbPath}:`);
	console.log(`  transactions:       ${report.transactions}`);
	console.log(`  budget periods:     ${report.budgetPeriods}`);
	console.log(`  salary projections: ${report.salaryProjections}`);
	console.log(`  goals/pots:         ${report.goals}`);
	console.log(`  lendings:           ${report.lendings}`);
	console.log(`  insurance policies: ${report.policies}`);
	console.log(`  big purchases:      ${report.purchases}`);
	console.log(`  cards:              ${report.cards}`);
	console.log(`  sip funds:          ${report.sipFunds ?? 0}`);
	console.log(`  emergency items:    ${report.emergencyItems ?? 0}`);

	console.log('\nNotes:');
	for (const note of report.notes) console.log(`  - ${note}`);

	console.log('\nVerify against the sheet:');
	const goals = db
		.prepare(
			`SELECT g.name, g.kind, g.target_paise, COALESCE(SUM(t.amount_paise), 0) AS contributed
			 FROM goals g LEFT JOIN transactions t ON t.goal_id = g.id
			 GROUP BY g.id ORDER BY g.name`
		)
		.all() as { name: string; kind: string; target_paise: number | null; contributed: number }[];
	for (const g of goals)
		console.log(
			`  ${g.kind} ${g.name}: contributed ${formatMoney(g.contributed)}` +
				(g.target_paise ? ` of ${formatMoney(g.target_paise)}` : '')
		);

	const lendings = db
		.prepare(
			`SELECT l.person, l.principal_paise, COALESCE(SUM(t.amount_paise), 0) AS repaid
			 FROM lendings l LEFT JOIN transactions t ON t.lending_id = l.id
			 GROUP BY l.id ORDER BY l.person`
		)
		.all() as { person: string; principal_paise: number; repaid: number }[];
	for (const l of lendings)
		console.log(
			`  lending ${l.person}: principal left ${formatMoney(l.principal_paise - l.repaid)}`
		);

	const periods = db
		.prepare(
			'SELECT effective_from, needs_bp, wants_bp, invest_bp FROM budget_periods ORDER BY effective_from'
		)
		.all() as { effective_from: string; needs_bp: number; wants_bp: number; invest_bp: number }[];
	for (const p of periods)
		console.log(
			`  budget from ${p.effective_from}: needs ${formatBP(p.needs_bp)} / wants ${formatBP(p.wants_bp)} / invest ${formatBP(p.invest_bp)}`
		);

	const yearly = db
		.prepare(
			`SELECT substr(date, 1, 4) AS y,
			        SUM(CASE WHEN direction = 'income' AND income_source IN ('job','side_hustle') THEN amount_paise ELSE 0 END) AS income,
			        SUM(CASE WHEN bucket = 'needs' THEN amount_paise ELSE 0 END) AS needs,
			        SUM(CASE WHEN bucket = 'wants' THEN amount_paise ELSE 0 END) AS wants,
			        SUM(CASE WHEN bucket = 'investments' THEN amount_paise ELSE 0 END) AS invest
			 FROM transactions GROUP BY y ORDER BY y`
		)
		.all() as { y: string; income: number; needs: number; wants: number; invest: number }[];
	for (const r of yearly)
		console.log(
			`  ${r.y}: income ${formatMoney(r.income)} | needs ${formatMoney(r.needs)} | wants ${formatMoney(r.wants)} | invest ${formatMoney(r.invest)}`
		);
} finally {
	db.close();
}
