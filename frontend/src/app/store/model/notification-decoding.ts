import type { DecodedMetric } from '../../knowledge-base/decoders/decoded-metric';

/** Decoded evidence captured with one raw notification. */
export type NotificationDecoding =
  | { readonly decoded: readonly DecodedMetric[]; readonly decodeError?: never }
  | { readonly decoded?: never; readonly decodeError: string };
