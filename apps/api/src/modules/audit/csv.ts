function spreadsheetSafe(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return ['=', '+', '-', '@'].includes(text.trimStart()[0] ?? '') ? "'" + text : text;
}

export function csvCell(value: unknown): string {
  return '"' + spreadsheetSafe(value).replaceAll('"', '""') + '"';
}

export function buildCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return '\uFEFF' + [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n') + '\r\n';
}
