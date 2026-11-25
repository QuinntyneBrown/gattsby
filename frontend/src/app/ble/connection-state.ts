export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'releasing';

// The connected device as the screen shows it (connect-to-the-device design).
export interface ConnectionState {
  readonly status: ConnectionStatus;
  readonly deviceId: string | null;
  readonly deviceName: string | null;
  readonly connectedAt: number | null;
}

export interface DisconnectEvent {
  readonly deviceId: string;
  readonly at: number;
  readonly intentional: boolean;
}
