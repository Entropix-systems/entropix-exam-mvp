import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from './csv.js';

describe('spreadsheet-safe CSV output', () => {
  it('quotes cells, doubles quotes, and neutralizes formula prefixes including leading whitespace', () => {
    expect(csvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@cmd', '  =HYPERLINK("x")']) {
      expect(csvCell(value)).toBe('"\'' + value.replaceAll('"', '""') + '"');
    }
  });

  it('emits an Excel-friendly BOM and CRLF rows without exposing raw formulas', () => {
    const csv = buildCsv(['Name', 'Value'], [['Student', '=2+2']]);
    expect(csv).toBe('\uFEFF"Name","Value"\r\n"Student","\'=2+2"\r\n');
  });
});
