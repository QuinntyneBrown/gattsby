export function plateField(text: string): string {
  return Array.from(text)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && (code < 127 || code > 159);
    })
    .join('')
    .trim()
    .slice(0, 120);
}
