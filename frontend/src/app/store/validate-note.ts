import type { InvestigationNote } from './model/investigation-note';
import { StoreError } from './store-error';

export function validateNote(input: InvestigationNote): InvestigationNote {
  const location = input.location.trim();
  const note = input.note.trim();
  if (Array.from(location).length > 120) {
    throw new StoreError('INVALID_NOTE', 'Use 120 characters or fewer for the location.');
  }
  if (Array.from(note).length > 2000) {
    throw new StoreError('INVALID_NOTE', 'Use 2,000 characters or fewer for the note.');
  }
  return { location, note };
}
