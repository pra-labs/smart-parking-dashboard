"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Car,
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  CircleDot,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Flame,
} from "lucide-react";

interface SlotData {
  s1: boolean;
  s2: boolean;
  s3: boolean;
}

interface ApiResponse {
  status: string;
  totalCapacity: number;
  slots: SlotData;
  free: number;
  occupied: number;
  gate: "OPEN" | "CLOSED" | "FULL" | "IDLE";
  lastUpdated: number;
  elapsedSeconds: number;
  device: {
    online: boolean;
    statusText: string;
    thresholdSeconds: number;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);

  const fetchParkingData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/parking", { cache: "no-store" });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setLastFetchTime(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch parking status:", err);
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  }, []);

  // Polling every 1 second
  useEffect(() => {
    fetchParkingData();
    const interval = setInterval(() => {
      fetchParkingData();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchParkingData]);

  // Handle Demo Mode Manual Updates
  const sendDemoUpdate = async (overrides: Partial<{ s1: boolean; s2: boolean; s3: boolean; gate: string }>) => {
    setIsDemoSubmitting(true);
    try {
      const currentSlots = data?.slots || { s1: false, s2: false, s3: false };
      const currentGate = data?.gate || "IDLE";

      const payload = {
        s1: overrides.s1 !== undefined ? overrides.s1 : currentSlots.s1,
        s2: overrides.s2 !== undefined ? overrides.s2 : currentSlots.s2,
        s3: overrides.s3 !== undefined ? overrides.s3 : currentSlots.s3,
        gate: overrides.gate !== undefined ? overrides.gate : currentGate,
      };

      await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchParkingData();
    } catch (err) {
      console.error("Demo trigger failed:", err);
    } finally {
      setIsDemoSubmitting(false);
    }
  };

  const isOnline = data?.device?.online ?? false;
  const freeSlots = data?.free ?? 3;
  const occupiedSlots = data?.occupied ?? 0;
  const gateStatus = data?.gate ?? "IDLE";

  const getGateBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return {
          text: "Barrier Open",
          color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
      case "CLOSED":
        return {
          text: "Barrier Closed",
          color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
          icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
        };
      case "FULL":
        return {
          text: "Lot Full (Stop)",
          color: "bg-rose-500/20 text-rose-300 border-rose-500/30",
          icon: <Flame className="w-4 h-4 text-rose-400" />,
        };
      default:
        return {
          text: "Gate Idle / Ready",
          color: "bg-sky-500/20 text-sky-300 border-sky-500/30",
          icon: <ShieldCheck className="w-4 h-4 text-sky-400" />,
        };
    }
  };

  const gateBadge = getGateBadge(gateStatus);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Background Subtle Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-36 flex-1 flex flex-col gap-6">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-full uppercase">
                IoT Edge System
              </span>
              <span className="text-xs text-slate-500 font-mono">ESP32 + Wokwi</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
              PraLabs Smart Parking System
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Live automated slot occupancy & barrier gate telemetry
            </p>
          </div>

          {/* Connectivity Pill & Timer */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${
                isOnline
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              }`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>ESP32 Connected</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>ESP32 Offline (&gt;10s)</span>
                </>
              )}
            </div>

            <button
              onClick={() => fetchParkingData(true)}
              title="Manual refresh"
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition"
            >
              <RefreshCw
                className={`w-3 h-3 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
              />
              <span className="hidden sm:inline font-mono">
                {data ? `${data.elapsedSeconds}s ago` : "syncing..."}
              </span>
            </button>
          </div>
        </header>

        {/* Metrics Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Capacity */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between backdrop-blur-sm shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Capacity
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold text-slate-100">3</span>
              <span className="text-xs text-slate-500 font-mono">Bays</span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-slate-500 h-full w-full" />
            </div>
          </div>

          {/* Available Slots */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between backdrop-blur-sm shadow-[0_0_20px_rgba(16,185,129,0.05)]">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CircleDot className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Available Slots
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                {loading ? "-" : freeSlots}
              </span>
              <span className="text-xs text-emerald-500 font-medium">Free Now</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${(freeSlots / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Occupied Slots */}
          <div className="bg-gradient-to-br from-rose-950/30 to-slate-900/80 border border-rose-500/20 rounded-xl p-4 flex flex-col justify-between backdrop-blur-sm">
            <span className="text-xs font-medium text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-rose-400" />
              Occupied Slots
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-extrabold text-rose-400">
                {loading ? "-" : occupiedSlots}
              </span>
              <span className="text-xs text-rose-500 font-medium">Vehicles Parked</span>
            </div>
            <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${(occupiedSlots / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Gate Telemetry */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between backdrop-blur-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
              Entry Gate
            </span>
            <div className="mt-2">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${gateBadge.color}`}
              >
                {gateBadge.icon}
                <span>{gateBadge.text}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-3 flex items-center justify-between">
              <span>Telemetry:</span>
              <span className="text-slate-300 uppercase">{gateStatus}</span>
            </div>
          </div>
        </section>

        {/* Visual Parking Bay Layout */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-slate-800/60">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Parking Bay Floor Plan</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  Level 01
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Visual slot occupancy status mirrored directly from ESP32 ultrasonic/IR sensors
              </p>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-300">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-300">Occupied</span>
              </div>
            </div>
          </div>

          {/* Road / Driveway Header Visual */}
          <div className="relative mb-6 rounded-lg bg-slate-950/80 border border-dashed border-slate-800 p-2.5 text-center text-xs text-slate-500 font-mono flex items-center justify-center gap-2">
            <span className="h-0.5 w-12 bg-slate-700" />
            <span>DRIVEWAY & ENTRY ACCESS LANE</span>
            <span className="h-0.5 w-12 bg-slate-700" />
          </div>

          {/* 3 Parking Bays */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: "s1", label: "Slot 01", isOccupied: data?.slots?.s1 ?? false },
              { id: "s2", label: "Slot 02", isOccupied: data?.slots?.s2 ?? false },
              { id: "s3", label: "Slot 03", isOccupied: data?.slots?.s3 ?? false },
            ].map((slot) => {
              const isOccupied = slot.isOccupied;
              return (
                <div
                  key={slot.id}
                  className={`group relative rounded-xl p-5 sm:p-6 flex flex-col justify-between min-h-[300px] transition-all duration-500 border-2 overflow-hidden ${
                    isOccupied
                      ? "bg-gradient-to-b from-rose-950/20 via-slate-900/90 to-rose-950/30 border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.18)]"
                      : "bg-gradient-to-b from-emerald-950/20 via-slate-900/90 to-emerald-950/30 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.18)]"
                  }`}
                >
                  {/* Road Bay White Line Markings (Left & Right) */}
                  <div className="absolute top-0 bottom-0 left-2 w-1 bg-gradient-to-b from-yellow-500/40 via-yellow-500/20 to-yellow-500/40 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 right-2 w-1 bg-gradient-to-b from-yellow-500/40 via-yellow-500/20 to-yellow-500/40 pointer-events-none" />

                  {/* Slot Top Header */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="font-mono text-sm tracking-wider font-bold text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                      {slot.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold tracking-wider px-2.5 py-1 rounded-full border uppercase ${
                        isOccupied
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {isOccupied ? "OCCUPIED" : "AVAILABLE"}
                    </span>
                  </div>

                  {/* Center Realistic Representation */}
                  <div className="relative z-10 my-8 flex flex-col items-center justify-center">
                    {isOccupied ? (
                      <div className="flex flex-col items-center">
                        <div className="relative p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.25)] transition-transform duration-500 transform group-hover:scale-105">
                          <Car className="w-16 h-16 sm:w-20 sm:h-20 text-rose-400" />
                          <div className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                          </div>
                        </div>
                        <span className="mt-3 text-xs font-mono text-rose-300">
                          Vehicle In Bay
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="relative p-6 rounded-2xl bg-emerald-500/10 border border-dashed border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-transform duration-500 transform group-hover:scale-105">
                          <Car className="w-16 h-16 sm:w-20 sm:h-20 text-emerald-500/30" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-600/40">
                              READY
                            </span>
                          </div>
                        </div>
                        <span className="mt-3 text-xs font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Bay Vacant
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Slot Footer Sensor Detail */}
                  <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>Pin IR-{slot.id.toUpperCase()}</span>
                    <span className={isOccupied ? "text-rose-400" : "text-emerald-400"}>
                      {isOccupied ? "Triggered (HIGH)" : "Clear (LOW)"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quick Help & Payload Reference */}
        <section className="bg-slate-900/30 border border-slate-800/70 rounded-xl p-4 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2 text-slate-300 font-semibold mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>ESP32 Telemetry Protocol</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>POST /api/parking &bull; Header: Content-Type: application/json</span>
            <span className="text-slate-500">
              Last packet: {lastFetchTime.toLocaleTimeString()}
            </span>
          </div>
        </section>
      </div>

      {/* Floating Demo / Testing Bar */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-4 py-3 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Title & Info */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Demo & Hardware Test Controller</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                  Interactive
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Simulate ESP32 sensor triggers & gate conditions directly in the browser
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Slot 1 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s1: !data?.slots?.s1 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition border flex items-center gap-1.5 ${
                data?.slots?.s1
                  ? "bg-rose-950/70 border-rose-600 text-rose-300"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span>Slot 1:</span>
              <span className="font-bold">{data?.slots?.s1 ? "OCC" : "VAC"}</span>
            </button>

            {/* Slot 2 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s2: !data?.slots?.s2 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition border flex items-center gap-1.5 ${
                data?.slots?.s2
                  ? "bg-rose-950/70 border-rose-600 text-rose-300"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span>Slot 2:</span>
              <span className="font-bold">{data?.slots?.s2 ? "OCC" : "VAC"}</span>
            </button>

            {/* Slot 3 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s3: !data?.slots?.s3 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition border flex items-center gap-1.5 ${
                data?.slots?.s3
                  ? "bg-rose-950/70 border-rose-600 text-rose-300"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span>Slot 3:</span>
              <span className="font-bold">{data?.slots?.s3 ? "OCC" : "VAC"}</span>
            </button>

            {/* Cycle Gate Status */}
            <button
              onClick={() => {
                const nextGate: Record<string, string> = {
                  IDLE: "OPEN",
                  OPEN: "CLOSED",
                  CLOSED: "FULL",
                  FULL: "IDLE",
                };
                sendDemoUpdate({ gate: nextGate[gateStatus] || "IDLE" });
              }}
              disabled={isDemoSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-900 border border-slate-700 text-sky-300 hover:border-sky-500 transition flex items-center gap-1.5"
            >
              <span>Gate:</span>
              <span className="font-bold">{gateStatus}</span>
            </button>

            {/* Reset All */}
            <button
              onClick={() => sendDemoUpdate({ s1: false, s2: false, s3: false, gate: "IDLE" })}
              disabled={isDemoSubmitting}
              title="Reset all slots to empty"
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 bg-slate-900 border border-slate-800 hover:text-slate-200 hover:border-slate-600 transition"
            >
              Reset
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
