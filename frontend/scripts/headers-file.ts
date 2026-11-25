// Reads the `_headers` file format used by Cloudflare Pages and Netlify (ADR 0003): a path
// pattern line, then indented `Name: value` lines. Only the subset Gattsby's file uses is read:
// exact paths and patterns ending in `*`.

export interface HeaderRule {
  readonly pattern: string;
  readonly headers: Readonly<Record<string, string>>;
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: { pattern: string; headers: Record<string, string> }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: {} });
      continue;
    }
    const current = rules.at(-1);
    const separator = line.indexOf(':');
    if (!current || separator === -1) {
      throw new Error(`Malformed _headers line: ${line}`);
    }
    current.headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return rules;
}

export function headersFor(rules: readonly HeaderRule[], pathname: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const rule of rules) {
    const matches = rule.pattern.endsWith('*')
      ? pathname.startsWith(rule.pattern.slice(0, -1))
      : pathname === rule.pattern;
    if (matches) {
      Object.assign(headers, rule.headers);
    }
  }
  return headers;
}
