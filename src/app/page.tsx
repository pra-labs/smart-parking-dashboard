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
  X,
  RotateCcw,
  Zap,
  Info,
  Maximize2,
  Minimize2,
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
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPacketTime, setLastPacketTime] = useState<string>("WAITING...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);
  const [packetBeat, setPacketBeat] = useState(false);

  // Mobile Hardware Info Popover modal
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Debug registers expanded state per bay
  const [expandedBayDebug, setExpandedBayDebug] = useState<Record<string, boolean>>({
    s1: false,
    s2: false,
    s3: false,
  });

  // FAB Debug Simulator Drawer state
  const [isSimDrawerOpen, setIsSimDrawerOpen] = useState(false);

  // Bottom Expandable Terminal Sheet state (collapsed vs expanded)
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);

  // Log filter tabs
  const [logFilter, setLogFilter] = useState<"ALL" | "POST" | "WARN" | "ERROR">("ALL");

  const [eventLogs, setEventLogs] = useState<LogEntry[]>([
    { id: "1", time: "--:--:--", msg: "SYS_INIT // MISSION CONTROL ONLINE. WAITING FOR ESP32 STREAM.", type: "info" },
  ]);

  useEffect(() => {
    setEventLogs([
      { id: "1", time: new Date().toLocaleTimeString(), msg: "SYS_INIT // MISSION CONTROL ONLINE. WAITING FOR ESP32 STREAM.", type: "info" },
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
            if (prev.slots.s1 !== json.slots.s1) {
              addLog(`IR_GPIO_13 // BAY_01: ${json.slots.s1 ? "TRIG_OCCUPIED" : "TRIG_CLEAR"}`, json.slots.s1 ? "warn" : "info");
            }
            if (prev.slots.s2 !== json.slots.s2) {
              addLog(`IR_GPIO_14 // BAY_02: ${json.slots.s2 ? "TRIG_OCCUPIED" : "TRIG_CLEAR"}`, json.slots.s2 ? "warn" : "info");
            }
            if (prev.slots.s3 !== json.slots.s3) {
              addLog(`IR_GPIO_27 // BAY_03: ${json.slots.s3 ? "TRIG_OCCUPIED" : "TRIG_CLEAR"}`, json.slots.s3 ? "warn" : "info");
            }
            if (prev.gate !== json.gate) {
              addLog(`SERVO_SG90 // BARRIER: [${json.gate}]`, "post");
            }
            if (prev.device.online && !json.device.online) {
              addLog("WARN // HEARTBEAT TIMEOUT (>10s). ESP32 LINK OFFLINE.", "error");
            } else if (!prev.device.online && json.device.online) {
              addLog("LINK_RESTORED // ESP32 HEARTBEAT RESUMED.", "info");
            }
          }
          return json;
        });
      }
    } catch (err) {
      console.error("Stream fetch failure:", err);
      addLog("ERR // CONNECTION REFUSED ON TELEMETRY BUS.", "error");
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
    }
  }, [addLog]);

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

      addLog(`TX_SIM // INJECT PACKET: ${JSON.stringify(payload)}`, "post");

      await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await fetchParkingData();
    } catch (err) {
      console.error("Simulation injection failure:", err);
      addLog("ERR // SIMULATION PACKET DROPPED.", "error");
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

  const latestLog = eventLogs[0] || { msg: "Awaiting telemetry...", time: "--:--" };

  const getGateConfig = (status: string) => {
    switch (status) {
      case "OPEN":
        return {
          title: "BARRIER RAISED // ACCESS GRANTED",
          desc: "Servo at 90° &bull; Vehicle passage cleared",
          badge: "bg-emerald-500/20 text-[#00ff9d] border-emerald-500/40",
          accent: "text-[#00ff9d]",
          angleDeg: 90,
          icon: <CheckCircle2 className="w-5 h-5 text-[#00ff9d]" />,
        };
      case "CLOSED":
        return {
          title: "BARRIER LOWERED // SECURED",
          desc: "Servo at 0° &bull; Ultrasonic scan active",
          badge: "bg-amber-500/20 text-[#ffb703] border-amber-500/40",
          accent: "text-[#ffb703]",
          angleDeg: 0,
          icon: <Shield className="w-5 h-5 text-[#ffb703]" />,
        };
      case "FULL":
        return {
          title: "LOT FULL // ACCESS DENIED",
          desc: "Capacity maximum &bull; Barrier interlock engaged",
          badge: "bg-rose-500/20 text-[#ff0055] border-rose-500/40",
          accent: "text-[#ff0055]",
          angleDeg: 0,
          icon: <AlertTriangle className="w-5 h-5 text-[#ff0055]" />,
        };
      default:
        return {
          title: "STANDBY // READY LOOP",
          desc: "Servo calibrated &bull; Inbound radar waiting",
          badge: "bg-cyan-500/20 text-[#00f0ff] border-cyan-500/40",
          accent: "text-[#00f0ff]",
          angleDeg: 15,
          icon: <Activity className="w-5 h-5 text-[#00f0ff]" />,
        };
    }
  };

  const gateInfo = getGateConfig(gateStatus);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-mono flex flex-col relative selection:bg-cyan-400 selection:text-black pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      
      {/* Background Deep Space Overlay Grid */}
      <div className="fixed inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,240,255,0.1),transparent)] pointer-events-none" />

      {/* 1. SLIM COMPACT STATUS APP BAR */}
      <header className="sticky top-0 z-40 bg-[#07090e]/90 backdrop-blur-xl border-b border-cyan-500/30 px-3 sm:px-6 py-2.5 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Left: Brand + Status Pill in One Clean Line */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${
                isOnline
                  ? packetBeat
                    ? "bg-[#00f0ff] scale-125 shadow-[0_0_12px_#00f0ff]"
                    : "bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]"
                  : "bg-[#ff0055] shadow-[0_0_8px_#ff0055]"
              }`}
            />
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm sm:text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#00ff9d] uppercase truncate">
                PRALABS // HUD
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className={isOnline ? "text-[#00ff9d] font-bold" : "text-[#ff0055] font-bold"}>
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </span>
                <span>&bull;</span>
                <span className="truncate" suppressHydrationWarning>{lastPacketTime}</span>
              </div>
            </div>
          </div>

          {/* Right: Hardware Info Chip + Large Touch Refresh Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Info Trigger Button */}
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-cyan-500/30 text-cyan-400 hover:text-white hover:border-cyan-400 text-xs transition min-h-[38px] min-w-[38px] justify-center"
              title="Hardware & Node Specs"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold">SPECS</span>
            </button>

            {/* Refresh Button (Touch Target >= 44x44px) */}
            <button
              onClick={() => fetchParkingData(true)}
              title="Poll Telemetry"
              disabled={isRefreshing}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded bg-slate-900 border border-cyan-500/30 text-cyan-400 hover:text-white hover:border-cyan-400 active:scale-95 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#00f0ff]" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col gap-4 sm:gap-6">
        
        {/* 2. HIGH-LEVEL KPI METRICS (TIGHT 2x2 GRID ON MOBILE, 4-COL ON DESKTOP) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* Capacity */}
          <div className="relative bg-[#0c101d] border border-cyan-500/30 p-3 sm:p-4 rounded shadow-[0_0_12px_rgba(0,240,255,0.06)] flex flex-col justify-between">
            <div className="flex justify-between items-center text-slate-400 text-[10px] sm:text-xs">
              <span className="tracking-wider uppercase font-bold">CAPACITY</span>
              <span className="text-[9px] sm:text-[10px] text-cyan-400 bg-cyan-950/80 border border-cyan-800 px-1 py-0.2 rounded">Z-01</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white my-1">
              3 <span className="text-[10px] sm:text-xs text-slate-500 font-normal">BAYS</span>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 flex justify-between">
              <span>HARDWARE:</span>
              <span className="text-slate-200">3x IR ARRAY</span>
            </div>
          </div>

          {/* Vacant Slots (Emerald) */}
          <div className="relative bg-[#0c101d] border border-emerald-500/40 p-3 sm:p-4 rounded shadow-[0_0_16px_rgba(0,255,157,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-400 text-[10px] sm:text-xs font-bold">
              <span className="flex items-center gap-1">
                <CircleDot className="w-3 h-3 animate-pulse" />
                VACANT
              </span>
              <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-[#00ff9d] border border-emerald-500/40 px-1 py-0.2 rounded">FREE</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-[#00ff9d] my-1 drop-shadow-[0_0_10px_rgba(0,255,157,0.4)]">
              {loading ? "..." : freeSlots}
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-[#00ff9d] h-full transition-all duration-700 shadow-[0_0_8px_#00ff9d]"
                style={{ width: `${(freeSlots / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Occupied Slots (Rose) */}
          <div className="relative bg-[#0c101d] border border-rose-500/40 p-3 sm:p-4 rounded shadow-[0_0_16px_rgba(255,0,85,0.1)] flex flex-col justify-between">
            <div className="flex justify-between items-center text-rose-400 text-[10px] sm:text-xs font-bold">
              <span className="flex items-center gap-1">
                <Car className="w-3 h-3" />
                OCCUPIED
              </span>
              <span className="text-[9px] sm:text-[10px] bg-rose-500/20 text-[#ff0055] border border-rose-500/40 px-1 py-0.2 rounded">{occupancyRate}%</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-[#ff0055] my-1 drop-shadow-[0_0_10px_rgba(255,0,85,0.4)]">
              {loading ? "..." : occupiedSlots}
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-[#ff0055] h-full transition-all duration-700 shadow-[0_0_8px_#ff0055]"
                style={{ width: `${(occupiedSlots / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Barrier Gate Status */}
          <div className="relative bg-[#0c101d] border border-cyan-500/30 p-3 sm:p-4 rounded shadow-[0_0_12px_rgba(0,240,255,0.06)] flex flex-col justify-between">
            <div className="flex justify-between items-center text-slate-400 text-[10px] sm:text-xs">
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-[#00f0ff]" />
                GATE SERVO
              </span>
              <span className={`text-[9px] sm:text-[10px] px-1 py-0.2 rounded border uppercase font-bold ${gateInfo.badge}`}>
                {gateStatus}
              </span>
            </div>
            <div className={`text-sm sm:text-base font-bold my-1 tracking-tight truncate ${gateInfo.accent}`}>
              {gateInfo.title.split("//")[0]}
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 flex justify-between">
              <span>ANGLE:</span>
              <span className={`font-bold ${gateInfo.accent}`}>{gateInfo.angleDeg}°</span>
            </div>
          </div>
        </section>

        {/* 3. DIGITAL TWIN BAY MATRIX & RADIAL GAUGE */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* ADAPTIVE BAY MATRIX CARDS (2 Cols) */}
          <div className="lg:col-span-2 bg-[#0c101d] border border-cyan-500/30 p-4 sm:p-6 rounded shadow-[0_0_20px_rgba(0,240,255,0.08)] flex flex-col justify-between">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-widest uppercase flex items-center gap-2">
                  <span>DIGITAL TWIN // BAY MATRIX</span>
                  <span className="text-[9px] text-cyan-400 bg-cyan-950 border border-cyan-800 px-1.5 py-0.2 rounded">LIVE</span>
                </h2>
                <p className="text-[11px] text-slate-400">Sensor occupancy reflection with hardware registers</p>
              </div>

              {/* Status Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00ff9d]" />
                  <span className="text-[11px] text-slate-300">VACANT</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ff0055]" />
                  <span className="text-[11px] text-slate-300">OCCUPIED</span>
                </div>
              </div>
            </div>

            {/* Inbound Road Graphics */}
            <div className="my-3 sm:my-5 rounded bg-[#07090e] border border-dashed border-slate-700/80 p-2 text-center text-xs text-slate-400 flex items-center justify-between px-3 sm:px-6">
              <span className="text-cyan-400 font-bold text-[10px] sm:text-xs">&gt;&gt; INBOUND</span>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="h-0.5 w-4 sm:w-8 bg-amber-400/50" />
                <span className="tracking-widest uppercase text-slate-300 text-[10px] sm:text-[11px] font-bold">DRIVEWAY LANE</span>
                <span className="h-0.5 w-4 sm:w-8 bg-amber-400/50" />
              </div>
              <span className="text-slate-500 font-bold text-[10px] sm:text-xs">10 KM/H</span>
            </div>

            {/* 3 Adaptive Digital Twin Bay Cards (Full width tap targets on mobile, 3-col on desktop) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
              {[
                { id: "s1", label: "BAY // 01", pin: "GPIO 13", adc: "ADC1_CH4", isOccupied: data?.slots?.s1 ?? false },
                { id: "s2", label: "BAY // 02", pin: "GPIO 14", adc: "ADC1_CH6", isOccupied: data?.slots?.s2 ?? false },
                { id: "s3", label: "BAY // 03", pin: "GPIO 27", adc: "ADC2_CH7", isOccupied: data?.slots?.s3 ?? false },
              ].map((bay) => {
                const isOccupied = bay.isOccupied;
                const isDebugOpen = expandedBayDebug[bay.id];

                return (
                  <div
                    key={bay.id}
                    className={`relative p-4 sm:p-5 rounded-lg border-2 transition-all duration-300 flex flex-col justify-between ${
                      isOccupied
                        ? "bg-[#140b12] border-rose-500/70 shadow-[0_0_20px_rgba(255,0,85,0.2)]"
                        : "bg-[#0b1411] border-emerald-500/70 shadow-[0_0_20px_rgba(0,255,157,0.18)]"
                    }`}
                  >
                    {/* Bay Side Markings */}
                    <div className="absolute top-0 bottom-0 left-1 w-1 bg-amber-400/40 rounded-full pointer-events-none" />
                    <div className="absolute top-0 bottom-0 right-1 w-1 bg-amber-400/40 rounded-full pointer-events-none" />

                    {/* Top Tag */}
                    <div className="flex justify-between items-center mb-2 sm:mb-3">
                      <span className="text-xs font-bold tracking-widest text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {bay.label}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase rounded border ${
                          isOccupied
                            ? "bg-rose-500/20 text-[#ff0055] border-rose-500/40 animate-pulse"
                            : "bg-emerald-500/20 text-[#00ff9d] border-emerald-500/40"
                        }`}
                      >
                        {isOccupied ? "OCCUPIED" : "VACANT"}
                      </span>
                    </div>

                    {/* Center Hologram */}
                    <div className="my-3 sm:my-5 flex flex-col items-center justify-center">
                      {isOccupied ? (
                        <div className="flex flex-col items-center">
                          <div className="relative p-4 sm:p-5 rounded-xl bg-rose-500/10 border border-rose-500/40 shadow-[0_0_25px_rgba(255,0,85,0.25)]">
                            <Car className="w-12 h-12 sm:w-16 sm:h-16 text-[#ff0055] filter drop-shadow-[0_0_8px_#ff0055]" />
                            <div className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                            </div>
                          </div>
                          <span className="mt-2 text-[11px] sm:text-xs font-bold text-rose-400">VEHICLE IN BAY</span>
                          <span className="text-[9px] text-slate-400">IR_DIST: &lt;15cm</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="relative p-4 sm:p-5 rounded-xl bg-emerald-500/[0.06] border border-dashed border-emerald-500/40 holo-grid shadow-[0_0_15px_rgba(0,255,157,0.12)]">
                            <Car className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-500/20" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] sm:text-[11px] font-bold text-[#00ff9d] bg-black/80 px-2 py-0.5 rounded border border-emerald-500/50">
                                FREE
                              </span>
                            </div>
                          </div>
                          <span className="mt-2 text-[11px] sm:text-xs font-bold text-[#00ff9d] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff9d] animate-ping" />
                            READY TO PARK
                          </span>
                          <span className="text-[9px] text-slate-400">BEAM UNOBSTRUCTED</span>
                        </div>
                      )}
                    </div>

                    {/* Technical Depth & Expandable Hardware Registers Accordion */}
                    <div className="pt-2.5 border-t border-slate-800 space-y-1 text-xs text-slate-400">
                      <div className="flex justify-between text-[11px]">
                        <span>PIN:</span>
                        <span className="text-slate-200 font-bold">{bay.pin}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>REGISTER:</span>
                        <span className={isOccupied ? "text-[#ff0055] font-bold" : "text-[#00f0ff] font-bold"}>
                          {isOccupied ? "SIG_HIGH" : "SIG_LOW"}
                        </span>
                      </div>

                      {/* Touch target >= 44px */}
                      <button
                        onClick={() => toggleBayDebug(bay.id)}
                        className="mt-2 w-full flex items-center justify-between text-[10px] text-slate-300 hover:text-cyan-400 py-2.5 px-3 rounded bg-black/40 border border-slate-800 min-h-[44px] active:bg-slate-800 transition"
                      >
                        <span className="font-bold">{isDebugOpen ? "HIDE REGISTERS" : "VIEW REGISTERS"}</span>
                        {isDebugOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isDebugOpen && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] space-y-1 bg-black/60 p-2.5 rounded animate-in fade-in duration-200">
                          <div className="flex justify-between">
                            <span className="text-slate-500">ADC CHANNEL:</span>
                            <span className="text-slate-300">{bay.adc}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">PULLUP STATUS:</span>
                            <span className={isOccupied ? "text-[#ff0055]" : "text-[#00ff9d]"}>
                              {isOccupied ? "0x01 (ENGAGED)" : "0x00 (CLEAR)"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">DEBOUNCE:</span>
                            <span className="text-slate-300">200ms Active</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Utilization Banner */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>INTELLIGENT ALLOCATION</span>
              </span>
              <span>UTILIZATION: <strong className="text-white">{occupancyRate}%</strong></span>
            </div>
          </div>

          {/* SERVO RADIAL GAUGE CARD */}
          <div className="bg-[#0c101d] border border-cyan-500/30 p-4 sm:p-6 rounded shadow-[0_0_20px_rgba(0,240,255,0.08)] relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">SG90 RADIAL DIAL</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${gateInfo.badge}`}>
                {gateStatus}
              </span>
            </div>

            {/* Radial Arc SVG Gauge */}
            <div className="py-4 sm:py-6 flex flex-col items-center justify-center">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                <svg className="w-36 h-36 sm:w-40 sm:h-40 -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#1e293b"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset="62.8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={gateStatus === "OPEN" ? "#00ff9d" : gateStatus === "CLOSED" ? "#ffb703" : "#ff0055"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (188.4 * (gateInfo.angleDeg / 90))}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-black text-white">{gateInfo.angleDeg}°</span>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider">SERVO ANGLE</span>
                </div>
              </div>

              <div className="text-center mt-2">
                <div className={`text-xs font-bold ${gateInfo.accent}`}>{gateInfo.title}</div>
                <p className="text-[11px] text-slate-400 mt-0.5">{gateInfo.desc}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400">
              <span>INTERLOCK:</span>
              <span className="text-white font-bold">{gateStatus === "FULL" ? "LOCKED (FULL)" : "ACTIVE"}</span>
            </div>
          </div>
        </section>
      </main>

      {/* 5. COLLAPSIBLE BOTTOM DRAWER: MISSION CONTROL TERMINAL & LOGS */}
      <section className="fixed bottom-0 inset-x-0 z-30 bg-[#07090e]/95 border-t border-cyan-500/40 backdrop-blur-xl shadow-2xl transition-all duration-300">
        
        {/* Collapsed Drawer Header Bar (Touch target to expand) */}
        <div
          onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
          className="px-3 sm:px-6 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 active:bg-slate-900 transition min-h-[46px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-white tracking-wider shrink-0">LOGS:</span>
            <span className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-md font-mono" suppressHydrationWarning>
              [{latestLog.time}] {latestLog.msg}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded border border-slate-700">
              {filteredLogs.length} EVTS
            </span>
            <button className="text-slate-400 hover:text-white p-1">
              {isTerminalExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Drawer Terminal Console */}
        {isTerminalExpanded && (
          <div className="px-3 sm:px-6 pb-4 pt-1 max-h-[50vh] sm:max-h-[300px] overflow-hidden flex flex-col crt-scanlines border-t border-slate-800">
            
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 py-2">
              {(["ALL", "POST", "WARN", "ERROR"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLogFilter(filter);
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition min-h-[32px] ${
                    logFilter === filter
                      ? "bg-cyan-500/20 text-[#00f0ff] border border-cyan-500/40"
                      : "text-slate-400 bg-slate-900 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Scrollable Log Lines */}
            <div className="space-y-1 overflow-y-auto max-h-[220px] text-[11px] pr-1">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-1.5 py-0.5">
                  <span className="text-slate-500 whitespace-nowrap" suppressHydrationWarning>[{log.time}]</span>
                  <span
                    className={
                      log.type === "error"
                        ? "text-[#ff0055] font-bold"
                        : log.type === "warn"
                        ? "text-[#ffb703]"
                        : log.type === "post"
                        ? "text-[#00f0ff]"
                        : "text-[#00ff9d]"
                    }
                  >
                    &gt; {log.msg}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1 text-cyan-400 text-xs mt-2">
                <span>root@esp32-mesh:~#</span>
                <span className="w-2 h-4 bg-cyan-400 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 6. FLOATING ACTION BUTTON (FAB) & SIMULATOR BOTTOM SHEET */}
      <div className="fixed bottom-14 right-4 z-40">
        <button
          onClick={() => setIsSimDrawerOpen(true)}
          className="flex items-center justify-center min-w-[50px] min-h-[50px] rounded-full bg-cyan-500 text-black font-black shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-cyan-400 active:scale-95 transition"
          title="Open Hardware Simulator"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>

      {/* Simulator Modal / Bottom Sheet */}
      {isSimDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0c101d] border border-cyan-500/40 p-4 sm:p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold text-white tracking-wider">HARDWARE SIMULATOR</span>
                <span className="text-[9px] text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">LIVE</span>
              </div>
              <button
                onClick={() => setIsSimDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 my-3 leading-relaxed">
              Inject mock sensor inputs & cycle servo barrier arm without physical ESP32
            </p>

            {/* Bay Toggles */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { key: "s1" as const, label: "BAY 01", state: data?.slots?.s1 ?? false },
                { key: "s2" as const, label: "BAY 02", state: data?.slots?.s2 ?? false },
                { key: "s3" as const, label: "BAY 03", state: data?.slots?.s3 ?? false },
              ].map((b) => (
                <button
                  key={b.key}
                  onClick={() => sendDemoUpdate({ [b.key]: !b.state })}
                  disabled={isDemoSubmitting}
                  className={`p-3 rounded-lg text-xs font-bold transition border flex flex-col items-center justify-center gap-1 min-h-[58px] active:scale-95 ${
                    b.state
                      ? "bg-[#140b12] border-rose-500 text-[#ff0055] shadow-[0_0_12px_rgba(255,0,85,0.3)]"
                      : "bg-[#0b1411] border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:text-[#00ff9d]"
                  }`}
                >
                  <span className="text-[10px] text-slate-400">{b.label}</span>
                  <span className="text-[11px] font-black">{b.state ? "OCCUPIED" : "VACANT"}</span>
                </button>
              ))}
            </div>

            {/* Gate Cycle & Reset (Touch-friendly >= 48px) */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
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
                className="flex-1 py-3 px-3 rounded-lg text-xs font-black bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 active:scale-95 transition flex items-center justify-center gap-1.5 min-h-[48px]"
              >
                <span>CYCLE BARRIER:</span>
                <span className="text-white font-black">{gateStatus}</span>
              </button>

              <button
                onClick={() => sendDemoUpdate({ s1: false, s2: false, s3: false, gate: "IDLE" })}
                disabled={isDemoSubmitting}
                title="Reset all bays"
                className="py-3 px-3.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-600 active:scale-95 transition flex items-center gap-1 min-h-[48px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESET</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. HARDWARE INFO POPUP MODAL */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0c101d] border border-cyan-500/40 p-5 rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">HARDWARE SPECS</span>
              </div>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs text-slate-300 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">MICROCONTROLLER:</span>
                <span className="text-slate-200 font-bold">ESP32-WROOM-32D</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">PROXIMITY ARRAY:</span>
                <span className="text-slate-200">3x IR Obstacle Sensors</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">ACTUATOR:</span>
                <span className="text-slate-200">SG90 9g Micro Servo</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">COMM PROTOCOL:</span>
                <span className="text-cyan-400">HTTP REST (JSON)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">WATCHDOG TIMEOUT:</span>
                <span className="text-amber-400">10 Seconds</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-4 py-2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900 transition"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
