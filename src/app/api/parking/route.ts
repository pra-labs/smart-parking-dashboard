import { NextResponse } from "next/server";
import {
  getParkingState,
  updateParkingState,
  GateStatus,
  ExitGateStatus,
} from "@/lib/parkingStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getParkingState();
  const now = Date.now();
  const elapsedMs = now - state.lastUpdated;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  // Online if pinged within the last 10 seconds
  const isOnline = elapsedSeconds <= 10;

  return NextResponse.json(
    {
      status: "success",
      totalCapacity: 3,
      slots: {
        s1: state.s1,
        s2: state.s2,
        s3: state.s3,
      },
      free: state.free,
      occupied: 3 - state.free,
      gate: state.gate,
      exitGate: state.exitGate || "IDLE",
      temp: state.temp ?? 27.5,
      humidity: state.humidity ?? 55,
      emergency: state.emergency ?? false,
      nightMode: state.nightMode ?? false,
      lastUpdated: state.lastUpdated,
      elapsedSeconds,
      device: {
        online: isOnline,
        statusText: isOnline ? "ESP32 Online" : "ESP32 Offline",
        thresholdSeconds: 10,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const partialUpdate: {
      s1?: boolean;
      s2?: boolean;
      s3?: boolean;
      free?: number;
      gate?: GateStatus;
      exitGate?: ExitGateStatus;
      temp?: number;
      humidity?: number;
      emergency?: boolean;
      nightMode?: boolean;
    } = {};

    if (typeof body.s1 === "boolean") partialUpdate.s1 = body.s1;
    if (typeof body.s2 === "boolean") partialUpdate.s2 = body.s2;
    if (typeof body.s3 === "boolean") partialUpdate.s3 = body.s3;
    if (typeof body.free === "number") partialUpdate.free = body.free;

    if (
      body.gate &&
      ["OPEN", "CLOSED", "FULL", "IDLE"].includes(String(body.gate).toUpperCase())
    ) {
      partialUpdate.gate = String(body.gate).toUpperCase() as GateStatus;
    }

    if (
      body.exitGate &&
      ["OPEN", "CLOSED", "IDLE"].includes(String(body.exitGate).toUpperCase())
    ) {
      partialUpdate.exitGate = String(body.exitGate).toUpperCase() as ExitGateStatus;
    }

    if (typeof body.temp === "number") partialUpdate.temp = body.temp;
    if (typeof body.humidity === "number") partialUpdate.humidity = body.humidity;
    if (typeof body.emergency === "boolean") partialUpdate.emergency = body.emergency;
    if (typeof body.nightMode === "boolean") partialUpdate.nightMode = body.nightMode;

    const updated = updateParkingState(partialUpdate);

    return NextResponse.json({
      status: "success",
      message: "Parking state updated",
      received: {
        s1: updated.s1,
        s2: updated.s2,
        s3: updated.s3,
        free: updated.free,
        gate: updated.gate,
        exitGate: updated.exitGate,
        temp: updated.temp,
        humidity: updated.humidity,
        emergency: updated.emergency,
        nightMode: updated.nightMode,
      },
      timestamp: updated.lastUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: "Invalid JSON payload",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
