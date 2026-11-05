"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Car,
  Wifi,
  WifiOff,
  Clock,
  ArrowRightLeft,
  CircleDot,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Activity,
  Radio,
  Zap,
  Sparkles,
  ChevronRight,
  Shield,
  Gauge,
  Terminal,
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
  const [eventLogs, setEventLogs] = useState<Array<{ id: string; time: string; msg: string; type: "info" | "warn" | "success" }>>([
    { id: "1", time: "Boot", msg: "Dashboard initialized. Ready for ESP32 telemetry.", type: "info" },
  ]);

  const addLog = useCallback((msg: string, type: "info" | "warn" | "success" = "info") => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setEventLogs((prev) => [{ id: Math.random().toString(), time, msg, type }, ...prev.slice(0, 19)]);
  }, []);

  const fetchParkingData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/parking", { cache: "no-store" });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData((prev) => {
          if (prev) {
            // Check for occupancy changes to add logs
            if (prev.slots.s1 !== json.slots.s1) {
              addLog(`Slot 01 changed to ${json.slots.s1 ? "OCCUPIED" : "VACANT"}`, json.slots.s1 ? "warn" : "success");
            }
            if (prev.slots.s2 !== json.slots.s2) {
              addLog(`Slot 02 changed to ${json.slots.s2 ? "OCCUPIED" : "VACANT"}`, json.slots.s2 ? "warn" : "success");
            }
            if (prev.slots.s3 !== json.slots.s3) {
              addLog(`Slot 03 changed to ${json.slots.s3 ? "OCCUPIED" : "VACANT"}`, json.slots.s3 ? "warn" : "success");
            }
            if (prev.gate !== json.gate) {
              addLog(`Gate barrier state switched to ${json.gate}`, "info");
            }
          }
          return json;
        });
        setLastFetchTime(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch parking status:", err);
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  }, [addLog]);

  // Polling every 1 second
  useEffect(() => {
    fetchParkingData();
    const interval = setInterval(() => {
      fetchParkingData();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchParkingData]);

  // Demo Controls
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

  const occupancyRate = useMemo(() => {
    return Math.round((occupiedSlots / 3) * 100);
  }, [occupiedSlots]);

  const getGateConfig = (status: string) => {
    switch (status) {
      case "OPEN":
        return {
          title: "BARRIER RAISED",
          desc: "Entry gate open, vehicle passage cleared",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          accent: "text-emerald-400",
          barrierAngle: "-rotate-45",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        };
      case "CLOSED":
        return {
          title: "BARRIER LOWERED",
          desc: "Entry gate closed, awaiting sensor trigger",
          badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          accent: "text-amber-400",
          barrierAngle: "rotate-0",
          icon: <Shield className="w-5 h-5 text-amber-400" />,
        };
      case "FULL":
        return {
          title: "PARKING FULL",
          desc: "All bays occupied. Inbound traffic blocked",
          badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          accent: "text-rose-400",
          barrierAngle: "rotate-0",
          icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
        };
      default:
        return {
          title: "SYSTEM READY",
          desc: "Servo motor standby, loop detectors active",
          badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
          accent: "text-cyan-400",
          barrierAngle: "-rotate-12",
          icon: <Activity className="w-5 h-5 text-cyan-400" />,
        };
    }
  };

  const gateInfo = getGateConfig(gateStatus);

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black">
      {/* Background Ambience & Engineering Mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Content Layout */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-40 flex-1 flex flex-col gap-6">
        
        {/* TOP BAR / STUDIO HEADER */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium tracking-wide uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu className="w-3 h-3 animate-spin text-cyan-400" style={{ animationDuration: "6s" }} />
                PraLabs Engineering Studio
              </span>
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                IoT Subsystem v2.4
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                Smart Parking Telemetry
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Microsecond slot sensor processing, dynamic servo barrier regulation, and edge-to-cloud stream.
            </p>
          </div>

          {/* Telemetry Heartbeat Status Panel */}
          <div className="flex items-center flex-wrap gap-3">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium border backdrop-blur-xl transition-all duration-300 ${
                isOnline
                  ? "bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "bg-rose-500/[0.08] border-rose-500/30 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
              }`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span>ESP32 ONLINE</span>
                  <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">
                    &lt;10s
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <WifiOff className="w-4 h-4 text-rose-400" />
                  <span>ESP32 OFFLINE</span>
                  <span className="text-[10px] text-rose-400/80 bg-rose-500/10 px-1.5 py-0.5 rounded ml-1">
                    NO HEARTBEAT
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => fetchParkingData(true)}
              title="Manual stream sync"
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/40 hover:bg-slate-800/80 transition shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {data ? `${data.elapsedSeconds}s ago` : "Syncing..."}
              </span>
            </button>
          </div>
        </header>

        {/* METRICS HUD BAR */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* 1. Total Fleet Bay Capacity */}
          <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between group">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Facility Capacity
              </span>
              <Layers className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition" />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black font-mono text-white">3</span>
                <span className="text-xs font-mono text-slate-500">Slots Total</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Zone Alpha
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Sensor Nodes</span>
              <span className="text-white font-bold">3x IR Proximity</span>
            </div>
          </div>

          {/* 2. Available Bays (Highlighted Emerald) */}
          <div className="glass-panel-elevated rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.08)]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-bold">
                <CircleDot className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Vacant Spaces
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Open
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-5xl font-black font-mono text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                {loading ? "..." : freeSlots}
              </span>
              <span className="text-xs font-mono text-emerald-400/90 font-semibold">
                Available Now
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-500/20">
              <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-700 rounded-full shadow-[0_0_10px_#10b981]"
                  style={{ width: `${(freeSlots / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. Occupied Bays (High Alert Rose) */}
          <div className="glass-panel-elevated rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.06)]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5 font-bold">
                <Car className="w-3.5 h-3.5 text-rose-400" />
                Occupied Spaces
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {occupancyRate}% Density
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-5xl font-black font-mono text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                {loading ? "..." : occupiedSlots}
              </span>
              <span className="text-xs font-mono text-rose-400/80 font-semibold">
                Vehicles Parked
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-rose-500/20">
              <div className="w-full bg-slate-800/90 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-700 rounded-full shadow-[0_0_10px_#f43f5e]"
                  style={{ width: `${(occupiedSlots / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4. Barrier Gate Telemetry */}
          <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                Gate Barrier
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${gateInfo.badge}`}>
                {gateStatus}
              </span>
            </div>
            <div className="mt-2">
              <div className={`text-base font-bold tracking-tight ${gateInfo.accent}`}>
                {gateInfo.title}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                {gateInfo.desc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Servo Actuator</span>
              <span className={`font-semibold ${gateInfo.accent}`}>SG90 Active</span>
            </div>
          </div>
        </section>

        {/* MAIN VISUALIZATION: PARKING BAY ARCHITECTURE & GATE SIMULATION */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 3 Interactive Parking Bays (Takes 2 Columns on Large Screens) */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 relative flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-5 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Bay Occupancy Matrix
                  </h2>
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
                    Real-time IR Canvas
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Microsecond digital reflection of physical or Wokwi sensor states
                </p>
              </div>

              {/* Status Markers */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                  <span className="text-slate-300">Vacant Bay</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  <span className="text-slate-300">Occupied Bay</span>
                </div>
              </div>
            </div>

            {/* Parking Lot Driveway Lane Graphic */}
            <div className="my-5 rounded-xl bg-[#090d18] border border-dashed border-slate-700/60 p-3 text-center text-xs text-slate-400 font-mono flex items-center justify-between px-6">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>INBOUND LANE</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="h-0.5 w-10 bg-amber-400/50" />
                <span className="text-[11px] tracking-widest text-slate-400 font-bold uppercase">
                  SLOT ACCESS DRIVEWAY & BULLBAR CURBS
                </span>
                <span className="h-0.5 w-10 bg-amber-400/50" />
              </div>
              <span className="text-slate-500">SPEED LIMIT: 10 KM/H</span>
            </div>

            {/* 3 Parking Bays Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { id: "s1", label: "BAY 01", pin: "GPIO 13", isOccupied: data?.slots?.s1 ?? false },
                { id: "s2", label: "BAY 02", pin: "GPIO 14", isOccupied: data?.slots?.s2 ?? false },
                { id: "s3", label: "BAY 03", pin: "GPIO 27", isOccupied: data?.slots?.s3 ?? false },
              ].map((slot) => {
                const isOccupied = slot.isOccupied;
                return (
                  <div
                    key={slot.id}
                    className={`relative rounded-xl p-5 flex flex-col justify-between min-h-[320px] transition-all duration-500 border-2 overflow-hidden ${
                      isOccupied
                        ? "bg-gradient-to-b from-rose-950/30 via-[#0d1222] to-rose-950/40 border-rose-500/80 glow-rose"
                        : "bg-gradient-to-b from-emerald-950/30 via-[#0d1222] to-emerald-950/40 border-emerald-500/80 glow-emerald"
                    }`}
                  >
                    {/* Parking White & Yellow Road Strips */}
                    <div className="absolute top-0 bottom-0 left-2 w-1.5 bg-gradient-to-b from-amber-400/50 via-amber-400/20 to-amber-400/50 pointer-events-none rounded-full" />
                    <div className="absolute top-0 bottom-0 right-2 w-1.5 bg-gradient-to-b from-amber-400/50 via-amber-400/20 to-amber-400/50 pointer-events-none rounded-full" />

                    {/* Top Bay Tag */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black tracking-widest text-slate-100 bg-slate-900/90 px-2.5 py-1 rounded border border-white/10">
                          {slot.label}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full border uppercase ${
                          isOccupied
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {isOccupied ? "OCCUPIED" : "AVAILABLE"}
                      </span>
                    </div>

                    {/* Center Realistic Vehicle & Sensor Representation */}
                    <div className="relative z-10 my-6 flex flex-col items-center justify-center">
                      {isOccupied ? (
                        <div className="flex flex-col items-center animate-in fade-in duration-500">
                          {/* Car Silhouette Container */}
                          <div className="relative p-5 rounded-2xl bg-rose-500/10 border border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.3)]">
                            <Car className="w-16 h-16 text-rose-400 filter drop-shadow-[0_0_10px_#f43f5e]" />
                            <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-mono font-semibold text-rose-300">
                            <span>Vehicle Present</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            Sonar / IR Reflection High
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center animate-in fade-in duration-500">
                          {/* Vacant Wireframe */}
                          <div className="relative p-5 rounded-2xl bg-emerald-500/[0.05] border border-dashed border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                            <Car className="w-16 h-16 text-emerald-500/20" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-500/50 px-2 py-0.5 rounded shadow-lg">
                                FREE BAY
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Ready to Park</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            Path Unobstructed
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sensor Pin Diagnostic Footer */}
                    <div className="relative z-10 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{slot.pin}</span>
                      <span className={isOccupied ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                        {isOccupied ? "SIG_HIGH (1)" : "SIG_LOW (0)"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Lot Summary Banner */}
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-2">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Intelligent Slot Allocation Active &bull; Zero Conflict Protocol</span>
              </span>
              <span className="text-slate-400">
                Current Lot Utilization: <strong className="text-white">{occupancyRate}%</strong>
              </span>
            </div>
          </div>

          {/* Right Column: Barrier Gate Visualizer + Live Event Terminal */}
          <div className="space-y-6">
            
            {/* Barrier Gate Visualizer */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Barrier Gate Arm
                  </h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border uppercase ${gateInfo.badge}`}>
                  {gateStatus}
                </span>
              </div>

              {/* Barrier Graphical Simulation */}
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="relative w-48 h-32 flex items-end justify-center">
                  
                  {/* Gate Post Left */}
                  <div className="w-7 h-24 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-lg border border-slate-500 relative flex flex-col items-center justify-between py-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                    <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                  </div>

                  {/* Barrier Arm Servo Pivot */}
                  <div
                    className={`origin-left transition-transform duration-700 ease-out absolute bottom-16 left-[58px] ${gateInfo.barrierAngle}`}
                  >
                    <div className="w-36 h-3 rounded-r-full bg-gradient-to-r from-red-600 via-white to-red-600 border border-slate-300 shadow-lg flex items-center justify-around px-2">
                      <span className="w-2 h-full bg-slate-900/40" />
                      <span className="w-2 h-full bg-slate-900/40" />
                      <span className="w-2 h-full bg-slate-900/40" />
                    </div>
                  </div>

                  {/* Road Floor Line */}
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-700 rounded-full" />
                </div>

                <div className="text-center mt-3">
                  <div className="text-xs font-mono font-bold text-white">
                    {gateInfo.title}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {gateInfo.desc}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Auto-Close Rule</span>
                <span className="text-white">Active (After Bay Park)</span>
              </div>
            </div>

            {/* Live Telemetry Event Terminal */}
            <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                    Telemetry Stream Logs
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Buffer: {eventLogs.length}/20
                </span>
              </div>

              {/* Event Log Window */}
              <div className="mt-3 space-y-1.5 max-h-[160px] overflow-y-auto font-mono text-[11px] pr-1">
                {eventLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-0.5 text-slate-300">
                    <span className="text-slate-500 whitespace-nowrap">[{log.time}]</span>
                    <span
                      className={
                        log.type === "warn"
                          ? "text-rose-400"
                          : log.type === "success"
                          ? "text-emerald-400"
                          : "text-cyan-300"
                      }
                    >
                      &gt; {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ESP32 HARDWARE INTEGRATION QUICK GUIDE */}
        <section className="glass-panel rounded-2xl p-5 sm:p-6 text-xs font-mono text-slate-400 border border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 text-white font-bold">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>ESP32 HTTP Telemetry Contract</span>
            </div>
            <span className="text-slate-500">
              POST /api/parking &bull; Header: Content-Type: application/json
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
            <div className="bg-[#090d18] p-3 rounded-lg border border-white/[0.05]">
              <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">
                Expected Ingestion Payload:
              </span>
              <pre className="text-cyan-300 text-[11px] overflow-x-auto">
{`{
  "s1": true,          // true = occupied, false = vacant
  "s2": false,
  "s3": false,
  "free": 2,
  "gate": "OPEN"       // "OPEN", "CLOSED", "FULL", "IDLE"
}`}
              </pre>
            </div>
            <div className="bg-[#090d18] p-3 rounded-lg border border-white/[0.05] flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block mb-1">
                  Connection Watchdog:
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The dashboard checks packet delta every 1000ms. If no ping is received for &gt;10 seconds, the status pill flips to <span className="text-rose-400 font-bold">ESP32 Offline</span> automatically.
                </p>
              </div>
              <div className="pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Active Server: Node / Vercel Edge</span>
                <span>Port: 3000 / 443</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FLOATING HARDWARE & DEMO TEST CONTROLLER (STUDIO QUALITY) */}
      <aside className="fixed bottom-0 left-0 right-0 z-50 bg-[#06080ef2] border-t border-white/[0.1] backdrop-blur-2xl px-4 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Label */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <span>Hardware Simulation Controller</span>
                <span className="text-[10px] text-cyan-300 bg-cyan-950 border border-cyan-800 px-1.5 py-0.2 rounded font-mono">
                  Live Wire
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Toggle bays or gate servo state directly in the browser to simulate sensor inputs
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center flex-wrap gap-2">
            
            {/* Slot 1 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s1: !data?.slots?.s1 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition border flex items-center gap-1.5 ${
                data?.slots?.s1
                  ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  : "bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400"
              }`}
            >
              <span>Bay 1:</span>
              <span>{data?.slots?.s1 ? "OCCUPIED" : "VACANT"}</span>
            </button>

            {/* Slot 2 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s2: !data?.slots?.s2 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition border flex items-center gap-1.5 ${
                data?.slots?.s2
                  ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  : "bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400"
              }`}
            >
              <span>Bay 2:</span>
              <span>{data?.slots?.s2 ? "OCCUPIED" : "VACANT"}</span>
            </button>

            {/* Slot 3 Toggle */}
            <button
              onClick={() => sendDemoUpdate({ s3: !data?.slots?.s3 })}
              disabled={isDemoSubmitting}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition border flex items-center gap-1.5 ${
                data?.slots?.s3
                  ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  : "bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400"
              }`}
            >
              <span>Bay 3:</span>
              <span>{data?.slots?.s3 ? "OCCUPIED" : "VACANT"}</span>
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
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-900 border border-white/10 text-cyan-300 hover:border-cyan-500 transition flex items-center gap-1.5"
            >
              <span>Gate:</span>
              <span className="font-bold text-white">{gateStatus}</span>
            </button>

            {/* Reset All */}
            <button
              onClick={() => sendDemoUpdate({ s1: false, s2: false, s3: false, gate: "IDLE" })}
              disabled={isDemoSubmitting}
              title="Reset all bays to vacant"
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-400 bg-slate-900 border border-white/10 hover:text-white hover:border-white/20 transition"
            >
              Reset
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
