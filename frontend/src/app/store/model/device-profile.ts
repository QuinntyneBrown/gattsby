export interface DeviceProfile {
  readonly kind: 'gattsby.device-profile';
  readonly formatVersion: '1.0';
  readonly kbVersion: string;
  readonly id: string;
  readonly investigationId: string;
  readonly createdAt: string;
  readonly location?: string;
  readonly identity: {
    readonly displayName: string;
    readonly advertisedName: string | null;
    readonly deviceType: string | null;
    readonly maker: string | null;
    readonly model: string | null;
    readonly firmware: string | null;
    readonly evidence: readonly string[];
  };
  readonly services: {
    readonly advertised: readonly string[];
    readonly discovered: readonly string[];
    readonly unreachable: readonly { readonly uuid: string | null; readonly reason: string }[];
  };
  readonly protocol: {
    readonly name: string;
    readonly variant: string | null;
    readonly service: string | null;
    readonly confidence: number;
    readonly hypothesisVersion: number;
  } | null;
  readonly metrics: readonly {
    readonly metric: string;
    readonly label: string;
    readonly characteristic: string;
    readonly rule:
      | { readonly kind: 'offset'; readonly offset: number; readonly length: number }
      | { readonly kind: 'flag'; readonly flagBit: number };
    readonly type: string;
    readonly endianness: 'little' | 'big';
    readonly scale: number;
    readonly unit: string;
    readonly rateHz?: number;
    readonly status: 'confirmed' | 'likely' | 'claimedOnly' | 'claimedNotSeen';
    readonly evidence: readonly string[];
  }[];
  readonly features: readonly {
    readonly feature: string;
    readonly command: {
      readonly characteristic: string;
      readonly opCode: string;
      readonly parameter: {
        readonly type: string;
        readonly scale: number;
        readonly unit: string;
      } | null;
    };
    readonly range: {
      readonly min: number;
      readonly max: number;
      readonly increment: number;
      readonly source: string;
    } | null;
    readonly test: { readonly from: number; readonly to: number; readonly result: string } | null;
    readonly status: 'confirmed' | 'claimedOnly' | 'refused';
    readonly evidence: readonly string[];
  }[];
  readonly handshake: {
    readonly vendor: string;
    readonly characteristic: string;
    readonly bytes: string;
    readonly source: string;
  } | null;
  readonly quirks: readonly { readonly text: string; readonly evidence: readonly string[] }[];
  readonly undetermined: readonly { readonly subject: string; readonly reason: string }[];
  readonly verdict: Pick<import('./verdict').Verdict, 'kind' | 'protocol' | 'label' | 'summary'>;
  readonly missingToolRequests: readonly string[];
  readonly counts: {
    readonly steps: number;
    readonly packets: number;
    readonly approvedCommands: number;
  };
}
