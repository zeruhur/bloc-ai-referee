import * as jsyaml from 'js-yaml';

export function parseYaml<T>(content: string): T {
  return jsyaml.load(content) as T;
}

export function stringifyYaml(obj: unknown): string {
  return jsyaml.dump(obj, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
  });
}

export function extractFrontmatter(fileContent: string): { frontmatter: string; body: string } | null {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

export function buildFileWithFrontmatter(data: unknown, body: string): string {
  return `---\n${stringifyYaml(data)}---\n\n${body}`;
}

export function parseFrontmatter<T>(fileContent: string): T | null {
  const parts = extractFrontmatter(fileContent);
  if (!parts) return null;
  return parseYaml<T>(parts.frontmatter);
}

export function patchFrontmatter<T extends object>(
  fileContent: string,
  patch: Partial<T>,
): string {
  const parts = extractFrontmatter(fileContent);
  if (!parts) {
    const data = patch;
    return `---\n${stringifyYaml(data)}---\n\n`;
  }
  const existing = parseYaml<T>(parts.frontmatter);
  const merged = { ...existing, ...patch };
  return `---\n${stringifyYaml(merged)}---\n\n${parts.body}`;
}
