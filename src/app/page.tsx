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
  Thermometer,
  Droplets,
  Moon,
  Sun,
  Flame,
  DoorOpen,
  DoorClosed,
  Siren,
  Lightbulb,
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
  exitGate: "OPEN" | "CLOSED" | "IDLE";
  temp: number;
  humidity: number;
  emergency: boolean;
  nightMode: boolean;
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
    { id: "1", time: "--:--:--", msg: "SYS_INIT // MISSION CONTROL & FACILITY SUITE ONLINE.", type: "info" },
  ]);

  useEffect(() => {
    setEventLogs([
      { id: "1", time: new Date().toLocaleTimeString(), msg: "SYS_INIT // MISSION CONTROL & FACILITY SUITE ONLINE.", type: "info" },
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
              addLog(`ENTRY_BARRIER // ROTATION: [${json.gate}]`, "post");
            }
            if (prev.exitGate !== json.exitGate) {
              addLog(`EXIT_BARRIER // ROTATION: [${json.exitGate}]`, "post");
            }
            if (!prev.emergency && json.emergency) {
              addLog("CRITICAL // FIRE HAZARD DETECTED! GATES LOCKED OPEN.", "error");
            } else if (prev.emergency && !json.emergency) {
              addLog("SAFETY // EMERGENCY CLEARED. NORMAL OPERATION RESUMED.", "info");
            }
            if (prev.nightMode !== json.nightMode) {
              addLog(`LDR_SENSOR // CANOPY LIGHTS: ${json.nightMode ? "ON (NIGHT)" : "OFF (DAY)"}`, "info");
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
  const sendDemoUpdate = async (
    overrides: Partial<{
      s1: boolean;
      s2: boolean;
      s3: boolean;
      gate: string;
      exitGate: string;
      temp: number;
      humidity: number;
      emergency: boolean;
      nightMode: boolean;
    }>
  ) => {
    setIsDemoSubmitting(true);
    try {
      const currentSlots = data?.slots || { s1: false, s2: false, s3: false };
      const currentGate = data?.gate || "IDLE";
      const currentExitGate = data?.exitGate || "IDLE";
      const currentTemp = data?.temp ?? 27.5;
      const currentHumidity = data?.humidity ?? 55;
      const currentEmergency = data?.emergency ?? false;
      const currentNightMode = data?.nightMode ?? false;

      const payload = {
        s1: overrides.s1 !== undefined ? overrides.s1 : currentSlots.s1,
        s2: overrides.s2 !== undefined ? overrides.s2 : currentSlots.s2,
        s3: overrides.s3 !== undefined ? overrides.s3 : currentSlots.s3,
        gate: overrides.gate !== undefined ? overrides.gate : currentGate,
        exitGate: overrides.exitGate !== undefined ? overrides.exitGate : currentExitGate,
        temp: overrides.temp !== undefined ? overrides.temp : currentTemp,
        humidity: overrides.humidity !== undefined ? overrides.humidity : currentHumidity,
        emergency: overrides.emergency !== undefined ? overrides.emergency : currentEmergency,
        nightMode: overrides.nightMode !== undefined ? overrides.nightMode : currentNightMode,
      };

      addLog(`TX_SIM // INJECT: ${JSON.stringify(payload)}`, "post");

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
  const exitGateStatus = data?.exitGate ?? "IDLE";
  const temp = data?.temp ?? 27.5;
  const humidity = data?.humidity ?? 55;
  const isEmergency = data?.emergency ?? (temp > 48);
  const isNightMode = data?.nightMode ?? false;

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

  // Entry Gate Badge info
  const getEntryGateBadge = (status: string) => {
    if (isEmergency) {
      return {
        label: "EMERGENCY OPEN",
        color: "bg-rose-500/20 text-[#ff0055] border-rose-500/50 animate-pulse",
        icon: <Siren className="w-3.5 h-3.5 text-[#ff0055]" />,
      };
    }
    switch (status) {
      case "OPEN":
        return {
          label: "OPEN",
          color: "bg-emerald-500/20 text-[#00ff9d] border-emerald-500/40",
          icon: <DoorOpen className="w-3.5 h-3.5 text-[#00ff9d]" />,
        };
      case "FULL":
        return {
          label: "LOT FULL",
          color: "bg-rose-500/20 text-[#ff0055] border-rose-500/40",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-[#ff0055]" />,
        };
      case "CLOSED":
        return {
          label: "CLOSED",
          color: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <DoorClosed className="w-3.5 h-3.5 text-slate-400" />,
        };
      default:
        return {
          label: "IDLE / STANDBY",
          color: "bg-cyan-500/20 text-[#00f0ff] border-cyan-500/40",
          icon: <Activity className="w-3.5 h-3.5 text-[#00f0ff]" />,
        };
    }
  };

  // Exit Gate Badge info
  const getExitGateBadge = (status: string) => {
    if (isEmergency) {
      return {
        label: "EMERGENCY OPEN",
        color: "bg-rose-500/20 text-[#ff0055] border-rose-500/50 animate-pulse",
        icon: <Siren className="w-3.5 h-3.5 text-[#ff0055]" />,
      };
    }
    switch (status) {
      case "OPEN":
        return {
          label: "OPEN",
          color: "bg-emerald-500/20 text-[#00ff9d] border-emerald-500/40",
          icon: <DoorOpen className="w-3.5 h-3.5 text-[#00ff9d]" />,
        };
      default:
        return {
          label: "CLOSED",
          color: "bg-slate-800 text-slate-300 border-slate-700",
          icon: <DoorClosed className="w-3.5 h-3.5 text-slate-400" />,
        };
    }
  };

  const entryBadge = getEntryGateBadge(gateStatus);
  const exitBadge = getExitGateBadge(exitGateStatus);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-mono flex flex-col relative selection:bg-cyan-400 selection:text-black pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      
      {/* Background Deep Space Overlay Grid */}
      <div className="fixed inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-60 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,240,255,0.1),transparent)] pointer-events-none" />

      {/* FULL-WIDTH PULSATING EMERGENCY ALERT BANNER */}
      {isEmergency && (
        <aside className="sticky top-0 z-50 bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-b-2 border-red-500 text-white px-3 sm:px-6 py-2.5 shadow-[0_0_35px_rgba(255,0,85,0.6)] animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm font-black tracking-wider">
            <div className="flex items-center gap-2">
              <Siren className="w-5 h-5 text-red-300 animate-bounce shrink-0" />
              <span className="uppercase text-red-100">
                CRITICAL SAFETY ALERT: HIGH TEMPERATURE / FIRE DETECTED &bull; EMERGENCY GATES LOCKED OPEN
              </span>
            </div>
            <span className="hidden md:inline px-2 py-0.5 bg-black/60 border border-red-400 text-red-300 rounded text-xs">
              TEMP: {temp}°C &gt; 48°C
            </span>
          </div>
        </aside>
      )}

      {/* 1. SLIM COMPACT STATUS APP BAR */}
      <header className={`sticky ${isEmergency ? "top-10" : "top-0"} z-40 bg-[#07090e]/90 backdrop-blur-xl border-b border-cyan-500/30 px-3 sm:px-6 py-2.5 shadow-md`}>
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
                PRALABS // FACILITY SUITE
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

          {/* Right: Hardware Info Chip + Refresh Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-cyan-500/30 text-cyan-400 hover:text-white hover:border-cyan-400 text-xs transition min-h-[38px] min-w-[38px] justify-center"
              title="Hardware Specs & Facility Config"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold">SUITE INFO</span>
            </button>

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
        
        {/* 2. HIGH-LEVEL KPI METRICS (4 CARDS: CAPACITY, VACANT, OCCUPIED, DUAL GATE SUMMARY) */}
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
              <span>FACILITY:</span>
              <span className="text-slate-200">DUAL-GATE IOT</span>
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

          {/* Dual Gate Quick Summary */}
          <div className="relative bg-[#0c101d] border border-cyan-500/30 p-3 sm:p-4 rounded shadow-[0_0_12px_rgba(0,240,255,0.06)] flex flex-col justify-between">
            <div className="flex justify-between items-center text-slate-400 text-[10px] sm:text-xs font-bold">
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-[#00f0ff]" />
                DUAL GATES
              </span>
              <span className="text-[9px] text-cyan-400 bg-cyan-950 border border-cyan-800 px-1 py-0.2 rounded">SERVO</span>
            </div>
            <div className="my-1 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[10px]">ENTRY:</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${entryBadge.color}`}>
                  {entryBadge.label}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 text-[10px]">EXIT:</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${exitBadge.color}`}>
                  {exitBadge.label}
                </span>
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80 flex justify-between">
              <span>FIRE INTERLOCK:</span>
              <span className={isEmergency ? "text-[#ff0055] font-bold" : "text-[#00ff9d] font-bold"}>
                {isEmergency ? "TRIPPED" : "NOMINAL"}
              </span>
            </div>
          </div>
        </section>

        {/* 3. NEW: FACILITY ENVIRONMENT & LIGHTING SUITE WIDGET */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: Basement Climate & Fire Safety */}
          <div className={`p-4 sm:p-5 rounded-lg border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
            isEmergency
              ? "bg-red-950/40 border-red-500 shadow-[0_0_25px_rgba(255,0,85,0.3)]"
              : "bg-[#0c101d] border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.06)]"
          }`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Thermometer className={`w-4 h-4 ${isEmergency ? "text-red-400 animate-pulse" : "text-cyan-400"}`} />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  BASEMENT CLIMATE & SAFETY
                </h3>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold flex items-center gap-1 ${
                  isEmergency
                    ? "bg-red-500/20 text-red-300 border-red-500 animate-pulse"
                    : "bg-emerald-500/20 text-[#00ff9d] border-emerald-500/40"
                }`}
              >
                {isEmergency ? (
                  <>
                    <Flame className="w-3 h-3 text-red-400" />
                    OVERHEAT / HAZARD
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-[#00ff9d]" />
                    NORMAL STATUS
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4">
              {/* Temperature */}
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-slate-500" />
                  AMBIENT TEMP
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-3xl sm:text-4xl font-black ${isEmergency ? "text-red-400 drop-shadow-[0_0_10px_#ef4444]" : "text-white"}`}>
                    {temp.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">°C</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1">SENSOR: DHT22 (GPIO 4)</span>
              </div>

              {/* Humidity */}
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-cyan-400" />
                  RELATIVE HUMIDITY
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-cyan-300">
                    {Math.round(humidity)}
                  </span>
                  <span className="text-xs text-slate-400">%</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1">OPTIMAL: 40% - 65%</span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
              <span>FIRE THRESHOLD: &gt;48.0°C</span>
              <span className={isEmergency ? "text-red-400 font-bold uppercase" : "text-emerald-400"}>
                {isEmergency ? "ALARM TRIGGERED" : "FIRE SUPPRESSION STANDBY"}
              </span>
            </div>
          </div>

          {/* Card 2: Smart Canopy Lighting & Solar LDR */}
          <div className={`p-4 sm:p-5 rounded-lg border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
            isNightMode
              ? "bg-[#101424] border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
              : "bg-[#0c101d] border-cyan-500/30 shadow-[0_0_15px_rgba(0,240,255,0.06)]"
          }`}>
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lightbulb className={`w-4 h-4 ${isNightMode ? "text-amber-400" : "text-cyan-400"}`} />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  SMART CANOPY LIGHTING
                </h3>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold flex items-center gap-1 ${
                  isNightMode
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {isNightMode ? (
                  <>
                    <Moon className="w-3 h-3 text-amber-400" />
                    NIGHT MODE ACTIVE
                  </>
                ) : (
                  <>
                    <Sun className="w-3 h-3 text-cyan-400" />
                    DAYLIGHT MODE
                  </>
                )}
              </span>
            </div>

            <div className="my-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">ILLUMINATION STATUS</span>
                <div className="text-xl sm:text-2xl font-black mt-1 text-white">
                  {isNightMode ? (
                    <span className="text-amber-300 flex items-center gap-1.5 drop-shadow-[0_0_10px_#f59e0b]">
                      <Zap className="w-5 h-5 text-amber-400" />
                      100% FLOODLIGHTS ON
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sun className="w-5 h-5 text-slate-500" />
                      LIGHTS OFF (ENERGY SAVER)
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isNightMode
                    ? "LDR lux reading &lt; 2000 &bull; Warm-white flood array engaged"
                    : "Ambient sunlight adequate &bull; 0W power draw"}
                </p>
              </div>

              {/* Visual Bulb / Light Effect */}
              <div className={`p-4 rounded-full border transition-all duration-500 ${
                isNightMode
                  ? "bg-amber-500/20 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.5)] scale-110"
                  : "bg-slate-900 border-slate-800"
              }`}>
                {isNightMode ? (
                  <Moon className="w-8 h-8 text-amber-300 animate-pulse" />
                ) : (
                  <Sun className="w-8 h-8 text-slate-600" />
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-400">
              <span>PHOTO-RESISTOR: PIN 34 (ADC)</span>
              <span className="text-slate-300">AUTO-THRESHOLD: 2000 ADC</span>
            </div>
          </div>
        </section>

        {/* 4. DIGITAL TWIN BAY MATRIX & DUAL BARRIER RADIAL CONTROLS */}
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

            {/* 3 Adaptive Digital Twin Bay Cards */}
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
                    <div className="absolute top-0 bottom-0 left-1 w-1 bg-amber-400/40 rounded-full pointer-events-none" />
                    <div className="absolute top-0 bottom-0 right-1 w-1 bg-amber-400/40 rounded-full pointer-events-none" />

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

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>INTELLIGENT ALLOCATION</span>
              </span>
              <span>UTILIZATION: <strong className="text-white">{occupancyRate}%</strong></span>
            </div>
          </div>

          {/* DUAL GATE SYNCHRONIZED CONTROLLER CARD */}
          <div className="bg-[#0c101d] border border-cyan-500/30 p-4 sm:p-6 rounded shadow-[0_0_20px_rgba(0,240,255,0.08)] relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white">DUAL BARRIER GATES</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">SERVO ARRAYS</span>
            </div>

            {/* Entry & Exit Barrier Visual Status Cards */}
            <div className="my-4 space-y-3">
              
              {/* Entry Barrier */}
              <div className={`p-3 rounded-lg border transition-all ${
                gateStatus === "OPEN" || isEmergency
                  ? "bg-emerald-950/30 border-emerald-500/50"
                  : gateStatus === "FULL"
                  ? "bg-rose-950/30 border-rose-500/50"
                  : "bg-slate-900/60 border-slate-800"
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">ENTRY BARRIER (SERVO 1)</div>
                      <div className="text-[10px] text-slate-400">PIN 18 &bull; 90° RAISE</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${entryBadge.color}`}>
                    {entryBadge.label}
                  </span>
                </div>
              </div>

              {/* Exit Barrier */}
              <div className={`p-3 rounded-lg border transition-all ${
                exitGateStatus === "OPEN" || isEmergency
                  ? "bg-emerald-950/30 border-emerald-500/50"
                  : "bg-slate-900/60 border-slate-800"
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DoorClosed className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-bold text-white">EXIT BARRIER (SERVO 2)</div>
                      <div className="text-[10px] text-slate-400">PIN 19 &bull; AUTO-CLEAR</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${exitBadge.color}`}>
                    {exitBadge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Emergency Status Notice */}
            <div className={`p-2.5 rounded text-[11px] border text-center ${
              isEmergency
                ? "bg-red-950/60 border-red-500 text-red-200 animate-pulse font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400"
            }`}>
              {isEmergency
                ? "⚠️ EVACUATION MODE: ALL BARRIERS LOCKED OPEN"
                : "GATE INTERLOCK NOMINAL: NO HAZARDS DETECTED"}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-400 mt-2">
              <span>CONTROLLER:</span>
              <span className="text-white font-bold">PWM SG90 50Hz</span>
            </div>
          </div>
        </section>
      </main>

      {/* 5. COLLAPSIBLE BOTTOM DRAWER: MISSION CONTROL TERMINAL & LOGS */}
      <section className="fixed bottom-0 inset-x-0 z-30 bg-[#07090e]/95 border-t border-cyan-500/40 backdrop-blur-xl shadow-2xl transition-all duration-300">
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

        {isTerminalExpanded && (
          <div className="px-3 sm:px-6 pb-4 pt-1 max-h-[50vh] sm:max-h-[300px] overflow-hidden flex flex-col crt-scanlines border-t border-slate-800">
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
          title="Open Facility Hardware Simulator"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>

      {/* Simulator Modal / Bottom Sheet */}
      {isSimDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#0c101d] border border-cyan-500/40 p-4 sm:p-6 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full animate-in slide-in-from-bottom-5 duration-300 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold text-white tracking-wider">FULL FACILITY HARDWARE SIMULATOR</span>
                <span className="text-[9px] text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">v3.0</span>
              </div>
              <button
                onClick={() => setIsSimDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 my-2.5 leading-relaxed">
              Toggle bay occupancy, dual gates, environmental DHT22 fire thresholds, and LDR canopy lighting.
            </p>

            {/* Bay Toggles */}
            <div className="space-y-1 mb-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">PARKING BAYS</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "s1" as const, label: "BAY 01", state: data?.slots?.s1 ?? false },
                  { key: "s2" as const, label: "BAY 02", state: data?.slots?.s2 ?? false },
                  { key: "s3" as const, label: "BAY 03", state: data?.slots?.s3 ?? false },
                ].map((b) => (
                  <button
                    key={b.key}
                    onClick={() => sendDemoUpdate({ [b.key]: !b.state })}
                    disabled={isDemoSubmitting}
                    className={`p-2.5 rounded text-xs font-bold transition border flex flex-col items-center justify-center gap-0.5 min-h-[50px] active:scale-95 ${
                      b.state
                        ? "bg-[#140b12] border-rose-500 text-[#ff0055] shadow-[0_0_10px_rgba(255,0,85,0.3)]"
                        : "bg-[#0b1411] border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:text-[#00ff9d]"
                    }`}
                  >
                    <span className="text-[9px] text-slate-400">{b.label}</span>
                    <span className="text-[10px] font-black">{b.state ? "OCCUPIED" : "VACANT"}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dual Gate Toggles */}
            <div className="space-y-1 mb-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">DUAL BARRIER GATES</span>
              <div className="grid grid-cols-2 gap-2">
                {/* Entry Gate Toggle */}
                <button
                  onClick={() => {
                    const next: Record<string, string> = { IDLE: "OPEN", OPEN: "CLOSED", CLOSED: "FULL", FULL: "IDLE" };
                    sendDemoUpdate({ gate: next[gateStatus] || "IDLE" });
                  }}
                  disabled={isDemoSubmitting}
                  className="py-2.5 px-3 rounded text-xs font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 active:scale-95 transition flex items-center justify-between"
                >
                  <span className="text-[10px]">ENTRY:</span>
                  <span className="text-white font-black">{gateStatus}</span>
                </button>

                {/* Exit Gate Toggle */}
                <button
                  onClick={() => {
                    const nextExit = exitGateStatus === "OPEN" ? "CLOSED" : "OPEN";
                    sendDemoUpdate({ exitGate: nextExit });
                  }}
                  disabled={isDemoSubmitting}
                  className="py-2.5 px-3 rounded text-xs font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 active:scale-95 transition flex items-center justify-between"
                >
                  <span className="text-[10px]">EXIT:</span>
                  <span className="text-white font-black">{exitGateStatus}</span>
                </button>
              </div>
            </div>

            {/* Environmental & Facility Hazards */}
            <div className="space-y-1 mb-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">ENVIRONMENT & CANOPY LIGHTING</span>
              <div className="grid grid-cols-2 gap-2">
                
                {/* Emergency Fire Toggle */}
                <button
                  onClick={() => {
                    const nextEmergency = !isEmergency;
                    sendDemoUpdate({
                      emergency: nextEmergency,
                      temp: nextEmergency ? 52.4 : 27.5,
                    });
                  }}
                  disabled={isDemoSubmitting}
                  className={`py-2.5 px-3 rounded text-xs font-bold transition border flex items-center justify-between active:scale-95 ${
                    isEmergency
                      ? "bg-red-950 border-red-500 text-red-200 animate-pulse"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-red-500/50"
                  }`}
                >
                  <span className="text-[10px] flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                    FIRE ALARM:
                  </span>
                  <span className={isEmergency ? "text-red-300 font-black" : "text-slate-400"}>
                    {isEmergency ? "ON (>48°C)" : "SAFE"}
                  </span>
                </button>

                {/* Night Mode Toggle */}
                <button
                  onClick={() => sendDemoUpdate({ nightMode: !isNightMode })}
                  disabled={isDemoSubmitting}
                  className={`py-2.5 px-3 rounded text-xs font-bold transition border flex items-center justify-between active:scale-95 ${
                    isNightMode
                      ? "bg-amber-950/80 border-amber-500 text-amber-300"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-500/50"
                  }`}
                >
                  <span className="text-[10px] flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-amber-400" />
                    CANOPY:
                  </span>
                  <span className={isNightMode ? "text-amber-300 font-black" : "text-slate-400"}>
                    {isNightMode ? "100% ON" : "DAY/OFF"}
                  </span>
                </button>
              </div>
            </div>

            {/* Reset All */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() =>
                  sendDemoUpdate({
                    s1: false,
                    s2: false,
                    s3: false,
                    gate: "IDLE",
                    exitGate: "IDLE",
                    emergency: false,
                    nightMode: false,
                    temp: 27.5,
                    humidity: 55,
                  })
                }
                disabled={isDemoSubmitting}
                className="py-2.5 px-4 rounded text-xs font-bold text-slate-300 bg-slate-900 border border-slate-700 hover:text-white hover:border-cyan-400 active:scale-95 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET ENTIRE FACILITY</span>
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
                <span className="text-sm font-bold text-white uppercase tracking-wider">FACILITY HARDWARE SPEC</span>
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
                <span className="text-slate-500">CONTROLLER:</span>
                <span className="text-slate-200 font-bold">ESP32-WROOM-32D</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">DUAL ACTUATORS:</span>
                <span className="text-slate-200">2x SG90 (Entry & Exit)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">CLIMATE SENSOR:</span>
                <span className="text-slate-200">DHT22 (Temp + RH)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">LIGHT SENSOR:</span>
                <span className="text-slate-200">LDR Photoresistor</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">FIRE THRESHOLD:</span>
                <span className="text-red-400 font-bold">&gt;48.0°C Auto Evac</span>
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
