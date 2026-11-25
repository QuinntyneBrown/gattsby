// The rejection for a call the script does not cover. The fake also reports it as unexpected.
export function notScripted(detail: string): DOMException {
  return new DOMException(`Not scripted: ${detail}`, 'NotSupportedError');
}
