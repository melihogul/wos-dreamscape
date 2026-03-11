export interface Dot {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  color: string;
  userId: string;
  timestamp: number;
}

export interface Room {
  id: string;
  hostId: string;
  viewers: string[];
  dots: Dot[];
}

export interface SignalData {
  type: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}
