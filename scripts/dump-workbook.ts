/**
 * Dev utility: dump every sheet of an .xlsx so importer column maps can be
 * derived from ground truth. Usage: npx tsx scripts/dump-workbook.ts <path>
 */
import ExcelJS from 'exceljs';

const path = process.argv[2];
if (!path) {
	console.error('usage: tsx scripts/dump-workbook.ts <xlsx path>');
	process.exit(1);
}

function cellText(v: ExcelJS.CellValue): string {
	if (v == null) return '';
	if (v instanceof Date) return `DATE(${v.toISOString().slice(0, 10)})`;
	if (typeof v === 'object') {
		if ('formula' in v)
			return `=${v.formula} → ${cellText((v as ExcelJS.CellFormulaValue).result ?? null)}`;
		if ('richText' in v)
			return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
		if ('text' in v) return String((v as { text: string }).text);
		if ('error' in v) return `ERR(${(v as { error: string }).error})`;
		return JSON.stringify(v);
	}
	return String(v);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);

for (const ws of wb.worksheets) {
	console.log(`\n===== SHEET "${ws.name}" rows=${ws.rowCount} cols=${ws.columnCount} =====`);
	ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
		const cells: string[] = [];
		row.eachCell({ includeEmpty: false }, (cell, col) => {
			const text = cellText(cell.value).replaceAll('\n', '\\n');
			if (text !== '') cells.push(`${cell.address}=${text}`);
			void col;
		});
		if (cells.length) console.log(`R${rowNumber}: ${cells.join(' | ')}`);
	});
}
