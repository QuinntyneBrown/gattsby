export const EVIDENCE_FILTERS = ['All', 'Sent', 'Received', 'You', 'Agent'] as const;
export type EvidenceFilter = (typeof EVIDENCE_FILTERS)[number];
