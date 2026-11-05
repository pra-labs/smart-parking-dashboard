export type GateStatus = "OPEN" | "CLOSED" | "FULL" | "IDLE";
export type ExitGateStatus = "OPEN" | "CLOSED" | "IDLE";

export interface ParkingState {
  s1: boolean; // true = occupied, false = vacant
  s2: boolean;
  s3: boolean;
  free: number;
  gate: GateStatus; // Entry gate
  exitGate: ExitGateStatus; // Exit gate
  temp: number; // Celsius from DHT22
  humidity: number; // % from DHT22
  emergency: boolean; // Fire alarm / high temp
  nightMode: boolean; // LDR light sensor
  lastUpdated: number; // timestamp in ms
}

// Global in-memory storage (preserved across HMR and Edge/Node serverless instance lifetime)
declare global {
  // eslint-disable-next-line no-var
  var __PARKING_STORE__: ParkingState | undefined;
}

const DEFAULT_STATE: ParkingState = {
  s1: false,
  s2: false,
  s3: false,
  free: 3,
  gate: "IDLE",
  exitGate: "IDLE",
  temp: 27.5,
  humidity: 55,
  emergency: false,
  nightMode: false,
  lastUpdated: Date.now(),
};

export function getParkingState(): ParkingState {
  if (!global.__PARKING_STORE__) {
    global.__PARKING_STORE__ = { ...DEFAULT_STATE, lastUpdated: Date.now() };
  }
  return global.__PARKING_STORE__;
}

export function updateParkingState(partial: Partial<ParkingState>): ParkingState {
  const current = getParkingState();
  const s1 = typeof partial.s1 === "boolean" ? partial.s1 : current.s1;
  const s2 = typeof partial.s2 === "boolean" ? partial.s2 : current.s2;
  const s3 = typeof partial.s3 === "boolean" ? partial.s3 : current.s3;

  // Compute free slots accurately from occupancy if not explicitly given
  const occupiedCount = [s1, s2, s3].filter(Boolean).length;
  const computedFree = 3 - occupiedCount;
  const free = typeof partial.free === "number" ? partial.free : computedFree;

  let gate: GateStatus = partial.gate || current.gate;
  if (computedFree === 0 && (!partial.gate || partial.gate === "IDLE")) {
    gate = "FULL";
  }

  const exitGate: ExitGateStatus = partial.exitGate || current.exitGate || "IDLE";
  const temp = typeof partial.temp === "number" && !isNaN(partial.temp) ? partial.temp : current.temp;
  const humidity = typeof partial.humidity === "number" && !isNaN(partial.humidity) ? partial.humidity : current.humidity;

  // Emergency triggers automatically if temp > 48 or explicitly sent as true
  let emergency = typeof partial.emergency === "boolean" ? partial.emergency : current.emergency;
  if (temp > 48) {
    emergency = true;
  }

  // During emergency, gates lock open for rapid evacuation
  if (emergency) {
    gate = "OPEN";
  }

  const nightMode = typeof partial.nightMode === "boolean" ? partial.nightMode : current.nightMode;

  const newState: ParkingState = {
    s1,
    s2,
    s3,
    free,
    gate,
    exitGate: emergency ? "OPEN" : exitGate,
    temp,
    humidity,
    emergency,
    nightMode,
    lastUpdated: Date.now(),
  };

  global.__PARKING_STORE__ = newState;
  return newState;
}
