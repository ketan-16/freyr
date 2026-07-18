import type ExcelJS from 'exceljs';
import { parseMoney, type Paise } from '$lib/money';

/**
 * Cell-value coercion for the seed import. exceljs hands us plain values,
 * Date objects, or { formula/sharedFormula, result } wrappers — these helpers
 * normalize them. Money floats are converted to paise via their 2-decimal
 * string form (parseMoney), never via float multiplication.
 */

type CellValue = ExcelJS.CellValue;

/** The numeric value of a cell (plain or formula result), or null. */
export function cellNumber(v: CellValue): number | null {
	if (typeof v === 'number') return v;
	if (v != null && typeof v === 'object' && 'result' in v) {
		const r = (v as { result?: CellValue }).result;
		if (typeof r === 'number') return r;
	}
	return null;
}

/** The text of a cell (plain, rich text, or formula result), '' when empty. */
export function cellString(v: CellValue): string {
	if (v == null) return '';
	if (typeof v === 'string') return v.trim();
	if (typeof v === 'number') return String(v);
	if (v instanceof Date) return isoDate(v);
	if (typeof v === 'object') {
		if ('richText' in v)
			return (v as ExcelJS.CellRichTextValue).richText
				.map((r) => r.text)
				.join('')
				.trim();
		if ('result' in v) return cellString((v as { result?: CellValue }).result ?? null);
		if ('text' in v) return String((v as { text: string }).text).trim();
	}
	return '';
}

/** The date of a cell as YYYY-MM-DD, or null. */
export function cellDate(v: CellValue): string | null {
	if (v instanceof Date) return isoDate(v);
	if (v != null && typeof v === 'object' && 'result' in v) {
		const r = (v as { result?: CellValue }).result;
		if (r instanceof Date) return isoDate(r);
	}
	return null;
}

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Converts a workbook money number to paise via its 2-decimal string form. */
export function paiseFromNumber(n: number): Paise {
	return parseMoney(n.toFixed(2));
}

/** Money paise from a cell, or null when empty/non-numeric ("NA", text…). */
export function cellPaise(v: CellValue): Paise | null {
	const n = cellNumber(v);
	return n == null ? null : paiseFromNumber(n);
}

/** A ratio cell (0.272 → 2720 basis points). */
export function ratioToBP(ratio: number): number {
	return Math.round(ratio * 10000);
}

/** Lakh count → paise (10 lakh = ₹10,00,000 = 100,000,000 paise). */
export function lakhsToPaise(lakhs: number): Paise {
	return paiseFromNumber(lakhs * 100000);
}

const QUARTER_END: Record<number, string> = { 1: '03-31', 2: '06-30', 3: '09-30', 4: '12-31' };
const QUARTER_BEFORE: Record<number, string> = { 1: '12-31', 2: '03-31', 3: '06-30', 4: '09-30' };

/**
 * Quarter labels → contribution date. "Q3 2024" → 2024-09-30 (quarter end);
 * "Pre-Q3 2024" → 2024-06-30 (the day the quarter's history begins).
 */
export function quarterLabelToDate(label: string): string {
	const m = label.trim().match(/^(Pre-)?Q([1-4])\s+(\d{4})$/i);
	if (!m) throw new Error(`unrecognized quarter label "${label}"`);
	const [, pre, q, year] = m;
	const quarter = Number(q);
	if (pre) {
		const y = quarter === 1 ? Number(year) - 1 : Number(year);
		return `${y}-${QUARTER_BEFORE[quarter]}`;
	}
	return `${year}-${QUARTER_END[quarter]}`;
}
