function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

export function markdownTable(headers: string[], rows: string[][]): string {
  const header = `| ${headers.map(escapeCell).join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(escapeCell).join(' | ')} |`).join('\n');
  return [header, separator, body].join('\n');
}

export function markdownSection(title: string, level: number, content: string): string {
  return `${'#'.repeat(level)} ${title}\n\n${content}\n`;
}

export function turnFolderName(turno: number): string {
  return `turno-${String(turno).padStart(2, '0')}`;
}
