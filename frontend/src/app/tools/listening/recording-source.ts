import type { Decoder } from '../../knowledge-base/decoders/decoder';

export interface RecordingSource {
  readonly service: string;
  readonly uuid: string;
  readonly decoder?: Decoder;
}
