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
  Sparkles,
  Shield,
  Gauge,
  Terminal,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  RotateCcw,
  Zap,
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

interface LogEntry {
  id: string;
  time: string;
  msg: string;
  type: "info" | "warn" | "error" | "post";
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPacketTime, setLastPacketTime] = useState<string>("Waiting for stream...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);
  
  // Heartbeat pulse flash state
  const [packetBeat, setPacketBeat] = useState(false);

  // Debug registers expanded state per bay
  const [expandedBayDebug, setExpandedBayDebug] = useState<Record<string, boolean>>({
    s1: false,
    s2: false,
    s3: false,
  });

  // Floating Debug Drawer / Simulator Tab
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(true);

  // Log filter tabs
  const [logFilter, setLogFilter] = useState<"ALL" | "POST" | "WARN" | "ERROR">("ALL");

  const [eventLogs, setEventLogs] = useState<LogEntry[]>([
    { id: "1", time: "--:--:--", msg: "Dashboard initialized. Ready for ESP32 telemetry packets.", type: "info" },
  ]);

  useEffect(() => {
    setMounted(true);
    setEventLogs([
      { id: "1", time: new Date().toLocaleTimeString(), msg: "Dashboard initialized. Ready for ESP32 telemetry packets.", type: "info" },
    ]);
  }, []);

  const addLog = useCallback((msg: string, type: "info" | "warn" | "error" | "post" = "info") => {
    const time = new Date().toLocaleTimeString();
    setEventLogs((prev) => [{ id: Math.random().toString(), time, msg, type }, ...prev.slice(0, 39)]);
  }, []);

  const fetchParkingData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/parking", { cache: "no-store" });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        
        // Trigger visual heartbeat pulse
        setPacketBeat(true);
        setTimeout(() => setPacketBeat(false), 450);

        if (json.lastUpdated) {
          const date = new Date(json.lastUpdated);
          setLastPacketTime(date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }

        setData((prev) => {
          if (prev) {
            // Check for occupancy changes
            if (prev.slots.s1 !== json.slots.s1) {
              addLog(`Slot 01: changed to ${json.slots.s1 ? "OCCUPIED" : "VACANT"}`, json.slots.s1 ? "warn" : "info");
            }
            if (prev.slots.s2 !== json.slots.s2) {
              addLog(`Slot 02: changed to ${json.slots.s2 ? "OCCUPIED" : "VACANT"}`, json.slots.s2 ? "warn" : "info");
            }
            if (prev.slots.s3 !== json.slots.s3) {
              addLog(`Slot 03: changed to ${json.slots.s3 ? "OCCUPIED" : "VACANT"}`, json.slots.s3 ? "warn" : "info");
            }
            if (prev.gate !== json.gate) {
              addLog(`Gate Barrier: switched servo angle to [${json.gate}]`, "post");
            }
            // Check connectivity drop
            if (prev.device.online && !json.device.online) {
              addLog("ESP32 Heartbeat lost (>10s ping timeout). Marked OFFLINE.", "error");
            } else if (!prev.device.online && json.device.online) {
              addLog("ESP32 Heartbeat restored. Marked ONLINE.", "info");
            }
          }
          return json;
        });
      }
    } catch (err) {
      console.error("Failed to fetch parking status:", err);
      addLog("Stream fetch failure: connection refused.", "error");
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

  // Hardware Simulation Controls
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

      addLog(`Simulator trigger: POST /api/parking -> ${JSON.stringify(payload)}`, "post");

      await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchParkingData();
    } catch (err) {
      console.error("Demo trigger failed:", err);
      addLog("Simulator injection error.", "error");
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

  const toggleBayDebug = (slotKey: string) => {
    setExpandedBayDebug((prev) => ({ ...prev, [slotKey]: !prev[slotKey] }));
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === "ALL") return eventLogs;
    if (logFilter === "POST") return eventLogs.filter((l) => l.type === "post");
    if (logFilter === "WARN") return eventLogs.filter((l) => l.type === "warn");
    if (logFilter === "ERROR") return eventLogs.filter((l) => l.type === "error");
    return eventLogs;
  }, [eventLogs, logFilter]);

  const getGateConfig = (status: string) => {
    switch (status) {
      case "OPEN":
        return {
          title: "BARRIER RAISED",
          desc: "Entry gate open &bull; Vehicle passage cleared",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          accent: "text-emerald-400",
          barrierAngle: "-rotate-60",
          servoDegrees: "90°",
          statusColor: "emerald",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
        };
      case "CLOSED":
        return {
          title: "BARRIER LOWERED",
          desc: "Entry gate down &bull; Sensor scanning for vehicle",
          badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          accent: "text-amber-400",
          barrierAngle: "rotate-0",
          servoDegrees: "0° (LOCKED)",
          statusColor: "amber",
          icon: <Shield className="w-5 h-5 text-amber-400" />,
        };
      case "FULL":
        return {
          title: "LOT FULL (BLOCKED)",
          desc: "Capacity reached &bull; Servo locked down",
          badge: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          accent: "text-rose-400",
          barrierAngle: "rotate-0",
          servoDegrees: "0° (INHIBIT)",
          statusColor: "rose",
          icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
        };
      default:
        return {
          title: "STANDBY / IDLE",
          desc: "Servo motor standby &bull; Ultrasonic loop ready",
          badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
          accent: "text-cyan-400",
          barrierAngle: "-rotate-12",
          servoDegrees: "15°",
          statusColor: "cyan",
          icon: <Activity className="w-5 h-5 text-cyan-400" />,
        };
    }
  };

  const gateInfo = getGateConfig(gateStatus);

  return (
    <div className="min-h-screen bg-[#06080e] text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-black">
      {/* Background Subtle Ambience & Radial Mesh */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.12),rgba(255,255,255,0))] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Content Area */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-28 flex-1 flex flex-col gap-6">
        
        {/* 1. TOP HEADER & CONNECTION HEALTH INDICATORS */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium tracking-wide uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu className="w-3 h-3 animate-spin text-cyan-400" style={{ animationDuration: "6s" }} />
                PraLabs Engineering Studio
              </span>
              <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400" />
                IoT Subsystem v2.5
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                Smart Parking Telemetry
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Microsecond bay proximity sensors, servo barrier synchronization, and edge telemetry health monitoring.
            </p>
          </div>

          {/* Connection Pill & Last Seen Timestamp */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            
            {/* Heartbeat Status Box */}
            <div className="flex items-center gap-3 bg-slate-900/90 border border-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xl shadow-lg">
              
              {/* Dynamic Beating LED Status Dot */}
              <div className="relative flex items-center justify-center">
                <span
                  className={`w-3.5 h-3.5 rounded-full transition-transform duration-200 ${
                    isOnline
                      ? packetBeat
                        ? "bg-emerald-400 scale-125 shadow-[0_0_15px_#10b981]"
                        : "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                      : packetBeat
                      ? "bg-rose-400 scale-125 shadow-[0_0_15px_#f43f5e]"
                      : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                  }`}
                />
                <span
                  className={`absolute w-5 h-5 rounded-full animate-ping opacity-40 ${
                    isOnline ? "bg-emerald-400" : "bg-rose-500"
                  }`}
                />
              </div>

              {/* Status Text & Connectivity Info */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider">
                  {isOnline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">ESP32 ONLINE</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400">ESP32 OFFLINE</span>
                    </>
                  )}
                </div>
                
                {/* Last Packet Exact Timestamp */}
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Last packet: </span>
                  <span className="text-slate-200 font-semibold" suppressHydrationWarning>
                    {lastPacketTime}
                  </span>
                </div>
              </div>

              {/* Manual Stream Refresh Button */}
              <button
                onClick={() => fetchParkingData(true)}
                title="Immediate stream poll"
                disabled={isRefreshing}
                className="ml-1 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {/* 2. METRICS HUD OVERVIEW */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Facility Capacity */}
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
                <span className="text-xs font-mono text-slate-500">Bays</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Zone Alpha
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Sensor Protocol</span>
              <span className="text-white font-bold">Active IR Beam</span>
            </div>
          </div>

          {/* Available Bays (Soft Green Glow) */}
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

          {/* Occupied Bays (Soft Red / Amber Glow) */}
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

          {/* Barrier Gate Telemetry Metric */}
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
              <span>Servo Angle</span>
              <span className={`font-semibold ${gateInfo.accent}`}>{gateInfo.servoDegrees}</span>
            </div>
          </div>
        </section>

        {/* 3. PARKING BAYS MATRIX & BARRIER ARM GRAPHIC */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 3 DISTINCT PARKING BAY CARDS (2 Cols) */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 relative flex flex-col justify-between">
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-5 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Bay Occupancy Matrix
                  </h2>
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded">
                    Zone 01
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Color-coded sensor cards with collapsible IoT hardware registers
                </p>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                  <span className="text-slate-300">Available Bay</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  <span className="text-slate-300">Occupied Bay</span>
                </div>
              </div>
            </div>

            {/* Driveway Guide Banner */}
            <div className="my-5 rounded-xl bg-[#090d18] border border-dashed border-slate-700/60 p-3 text-center text-xs text-slate-400 font-mono flex items-center justify-between px-6">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>ENTRY LANE</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="h-0.5 w-10 bg-amber-400/50" />
                <span className="text-[11px] tracking-widest text-slate-400 font-bold uppercase">
                  ACTIVE DRIVEWAY
                </span>
                <span className="h-0.5 w-10 bg-amber-400/50" />
              </div>
              <span className="text-slate-500 font-semibold">MAX 10 KM/H</span>
            </div>

            {/* 3 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { id: "s1", label: "BAY 01", pin: "GPIO 13", adc: "ADC1_CH4", isOccupied: data?.slots?.s1 ?? false },
                { id: "s2", label: "BAY 02", pin: "GPIO 14", adc: "ADC1_CH6", isOccupied: data?.slots?.s2 ?? false },
                { id: "s3", label: "BAY 03", pin: "GPIO 27", adc: "ADC2_CH7", isOccupied: data?.slots?.s3 ?? false },
              ].map((slot) => {
                const isOccupied = slot.isOccupied;
                const isDebugOpen = expandedBayDebug[slot.id];

                return (
                  <div
                    key={slot.id}
                    className={`relative rounded-xl p-5 flex flex-col justify-between transition-all duration-500 border-2 overflow-hidden ${
                      isOccupied
                        ? "bg-gradient-to-b from-rose-950/40 via-[#111728] to-rose-950/50 border-rose-500/70 shadow-[0_0_25px_rgba(244,63,94,0.18)]"
                        : "bg-gradient-to-b from-emerald-950/40 via-[#111728] to-emerald-950/50 border-emerald-500/70 shadow-[0_0_25px_rgba(16,185,129,0.18)]"
                    }`}
                  >
                    {/* Parking Bay Yellow Road Boundaries */}
                    <div className="absolute top-0 bottom-0 left-2 w-1.5 bg-gradient-to-b from-amber-400/40 via-amber-400/20 to-amber-400/40 pointer-events-none rounded-full" />
                    <div className="absolute top-0 bottom-0 right-2 w-1.5 bg-gradient-to-b from-amber-400/40 via-amber-400/20 to-amber-400/40 pointer-events-none rounded-full" />

                    {/* Top Bay Tag */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black tracking-widest text-slate-100 bg-slate-900/95 px-2.5 py-1 rounded border border-white/10">
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

                    {/* Vehicle Silhouette & Animation */}
                    <div className="relative z-10 my-6 flex flex-col items-center justify-center">
                      {isOccupied ? (
                        <div className="flex flex-col items-center">
                          <div className="relative p-5 rounded-2xl bg-rose-500/10 border border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                            <Car className="w-16 h-16 text-rose-400 filter drop-shadow-[0_0_10px_#f43f5e]" />
                            <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-mono font-semibold text-rose-300">
                            <span>Vehicle Present</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            Distance &lt; 15cm
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
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
                          <span className="text-[10px] font-mono text-slate-400">
                            Beam Clear
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sensor Pin Diagnostic & Collapsible Debug Drawer */}
                    <div className="relative z-10 pt-3 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">{slot.pin}</span>
                        <span className={isOccupied ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                          {isOccupied ? "SIG_HIGH" : "SIG_LOW"}
                        </span>
                      </div>

                      {/* GPIO & Raw Register Collapsible Toggle */}
                      <button
                        onClick={() => toggleBayDebug(slot.id)}
                        className="mt-2.5 w-full flex items-center justify-between text-[10px] font-mono text-slate-400 hover:text-cyan-400 py-1 px-2 rounded bg-slate-900/60 border border-white/[0.06] transition"
                      >
                        <span>{isDebugOpen ? "Hide Registers" : "Debug Registers"}</span>
                        {isDebugOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {/* Collapsible Register Details */}
                      {isDebugOpen && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] font-mono space-y-1 bg-black/40 p-2 rounded border border-white/[0.05] animate-in fade-in duration-200">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Channel:</span>
                            <span className="text-slate-300">{slot.adc}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Raw Register:</span>
                            <span className={isOccupied ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                              {isOccupied ? "0x01 (PULLUP)" : "0x00 (CLEAR)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Debounce:</span>
                            <span className="text-slate-300">200ms Active</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Facility Status */}
            <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-2">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Zero-Latency Proximity Matrix &bull; Collision Avoidance Subsystem</span>
              </span>
              <span>
                Total Lot Utilization: <strong className="text-white">{occupancyRate}%</strong>
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: VISUAL GATE SERVO WIDGET + TELEMETRY STREAM LOGS */}
          <div className="space-y-6">
            
            {/* Visual Barrier Gate Servo Widget */}
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    SG90 Servo Barrier Arm
                  </h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border uppercase ${gateInfo.badge}`}>
                  {gateStatus}
                </span>
              </div>

              {/* Graphical Servo Barrier Simulation */}
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="relative w-52 h-36 flex items-end justify-center">
                  
                  {/* Servo Post Housing */}
                  <div className="w-8 h-28 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700 rounded-t-lg border border-slate-500 relative flex flex-col items-center justify-between py-2 shadow-xl">
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${gateStatus === "OPEN" ? "bg-emerald-400 shadow-[0_0_10px_#10b981]" : "bg-slate-700"}`} />
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${gateStatus === "CLOSED" ? "bg-amber-400 shadow-[0_0_10px_#f59e0b]" : "bg-slate-700"}`} />
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${gateStatus === "FULL" ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]" : "bg-slate-700"}`} />
                    <span className="text-[8px] font-mono text-slate-400">SG90</span>
                  </div>

                  {/* Barrier Arm Servo Rotating Pivot */}
                  <div
                    className={`origin-left transition-transform duration-700 ease-out absolute bottom-16 left-[62px] ${gateInfo.barrierAngle}`}
                  >
                    <div className="w-40 h-3.5 rounded-r-full bg-gradient-to-r from-red-600 via-white to-red-600 border border-slate-300 shadow-xl flex items-center justify-around px-2">
                      <span className="w-2 h-full bg-slate-900/50" />
                      <span className="w-2 h-full bg-slate-900/50" />
                      <span className="w-2 h-full bg-slate-900/50" />
                      <span className="w-2 h-full bg-slate-900/50" />
                    </div>
                  </div>

                  {/* Road Floor Line */}
                  <div className="absolute bottom-0 inset-x-0 h-2 bg-slate-700 rounded-full" />
                </div>

                <div className="text-center mt-3">
                  <div className={`text-xs font-mono font-bold ${gateInfo.accent}`}>
                    {gateInfo.title}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {gateInfo.desc}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Current Rotation</span>
                <span className={`font-semibold ${gateInfo.accent}`}>{gateInfo.servoDegrees}</span>
              </div>
            </div>

            {/* Telemetry Stream Logs with Filters */}
            <div className="glass-panel rounded-2xl p-5 relative overflow-hidden flex flex-col">
              
              <div className="flex flex-col gap-2 pb-3 border-b border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                      Telemetry Stream Buffer
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {filteredLogs.length} events
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 pt-1">
                  {(["ALL", "POST", "WARN", "ERROR"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        logFilter === filter
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-slate-400 bg-slate-900 hover:text-slate-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event Log Window */}
              <div className="mt-3 space-y-1.5 max-h-[175px] overflow-y-auto font-mono text-[11px] pr-1">
                {filteredLogs.length === 0 ? (
                  <div className="text-slate-500 py-4 text-center">No logs matching filter.</div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 py-0.5 text-slate-300">
                      <span className="text-slate-500 whitespace-nowrap" suppressHydrationWarning>
                        [{log.time}]
                      </span>
                      <span
                        className={
                          log.type === "error"
                            ? "text-rose-400 font-bold"
                            : log.type === "warn"
                            ? "text-amber-300"
                            : log.type === "post"
                            ? "text-cyan-300"
                            : "text-emerald-400"
                        }
                      >
                        &gt; {log.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 4. DEDICATED FLOATING DEBUG PANEL / SIMULATOR (COLLAPSIBLE TAB) */}
      <aside className="fixed bottom-4 right-4 z-50">
        {isDebugPanelOpen ? (
          <div className="glass-panel-elevated rounded-2xl p-4 shadow-2xl border border-cyan-500/40 max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold text-white">Hardware Debug Simulator</span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                  Live
                </span>
              </div>
              <button
                onClick={() => setIsDebugPanelOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 mb-3">
              Trigger raw sensor inputs & cycle servo barrier arm without physical ESP32
            </p>

            {/* Bay Toggles */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "s1" as const, label: "Bay 01", state: data?.slots?.s1 ?? false },
                { key: "s2" as const, label: "Bay 02", state: data?.slots?.s2 ?? false },
                { key: "s3" as const, label: "Bay 03", state: data?.slots?.s3 ?? false },
              ].map((b) => (
                <button
                  key={b.key}
                  onClick={() => sendDemoUpdate({ [b.key]: !b.state })}
                  disabled={isDemoSubmitting}
                  className={`p-2 rounded-xl text-xs font-mono font-semibold transition border flex flex-col items-center justify-center gap-1 ${
                    b.state
                      ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                      : "bg-slate-900 border-white/10 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
                  }`}
                >
                  <span className="text-[10px] text-slate-400">{b.label}</span>
                  <span className="font-bold">{b.state ? "OCCUPIED" : "VACANT"}</span>
                </button>
              ))}
            </div>

            {/* Gate Cycle & Reset */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
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
                className="flex-1 py-1.5 px-3 rounded-xl text-xs font-mono font-semibold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 transition flex items-center justify-center gap-1.5"
              >
                <span>Cycle Barrier:</span>
                <span className="text-white font-bold">{gateStatus}</span>
              </button>

              <button
                onClick={() => sendDemoUpdate({ s1: false, s2: false, s3: false, gate: "IDLE" })}
                disabled={isDemoSubmitting}
                title="Reset all bays"
                className="py-1.5 px-2.5 rounded-xl text-xs font-mono text-slate-400 bg-slate-900 border border-white/10 hover:text-white hover:border-white/20 transition flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsDebugPanelOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-mono font-semibold bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 shadow-xl hover:bg-cyan-900 transition backdrop-blur-md"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Open Hardware Simulator</span>
          </button>
        )}
      </aside>
    </div>
  );
}
