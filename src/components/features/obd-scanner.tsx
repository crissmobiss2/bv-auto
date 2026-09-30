"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bluetooth, BluetoothOff, Loader2, ScanLine, Trash2, Car, AlertTriangle, Gauge, Brain } from "lucide-react";
import { BleObdTransport } from "@/lib/obd2/ble-transport";
import { Elm327 } from "@/lib/obd2/elm327";
import { Capacitor } from "@capacitor/core";
import type { BleDevice } from "@capacitor-community/bluetooth-le";

type Status = "idle" | "scanning" | "connecting" | "initializing" | "ready" | "reading" | "error";

export interface ObdScanResult {
  vin?: string | null;
  vinDecoded?: { year?: string; make?: string; model?: string; engine?: string } | null;
  stored: string[];
  pending: string[];
  permanent: string[];
  milOn?: boolean;
  freezeFrameDtc?: string | null;
  liveData?: Record<string, number>;
}

const LIVE_LABELS: Record<string, { label: string; unit: string; max: number }> = {
  rpm:             { label: "RPM",          unit: "",    max: 7000 },
  speedKph:        { label: "Speed",        unit: "km/h", max: 200 },
  coolantTempC:    { label: "Coolant",      unit: "°C",  max: 130 },
  intakeTempC:     { label: "Intake air",   unit: "°C",  max: 80 },
  throttlePct:     { label: "Throttle",     unit: "%",   max: 100 },
  engineLoadPct:   { label: "Engine load",  unit: "%",   max: 100 },
  mafGps:          { label: "MAF",          unit: "g/s", max: 200 },
  fuelPressureKpa: { label: "Fuel press.",  unit: "kPa", max: 450 },
  batteryVoltage:  { label: "Control mod.", unit: "V",   max: 16 },
};

export function ObdScanner({ onResult }: { onResult?: (r: ObdScanResult) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connected, setConnected] = useState<string>("");
  const [result, setResult] = useState<ObdScanResult | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [liveData, setLiveData] = useState<Record<string, number>>({});
  const [aiStatus, setAiStatus] = useState<"idle" | "running" | "done">("idle");
  const [aiSummary, setAiSummary] = useState("");
  const [estimateTotal, setEstimateTotal] = useState<number | null>(null);
  const transportRef = useRef<BleObdTransport | null>(null);
  const elmRef = useRef<Elm327 | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Live data stream
  useEffect(() => {
    if (!liveOn || !elmRef.current) return;
    const t = setInterval(() => {
      elmRef.current?.readLiveData()
        .then(setLiveData)
        .catch(() => setLiveOn(false));
    }, 1500);
    elmRef.current.readLiveData().then(setLiveData).catch(() => {});
    return () => clearInterval(t);
  }, [liveOn]);

  async function scan() {
    setError("");
    setStatus("scanning");
    setDevices([]);
    try {
      const found = await BleObdTransport.scanForObd(8000);
      setDevices(found);
      setStatus("idle");
      if (!found.length) setError("No Bluetooth devices found. Make sure the OBD-II adapter is plugged in and powered.");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Bluetooth scan failed");
    }
  }

  async function connect(device: BleDevice) {
    setStatus("connecting");
    setError("");
    try {
      const transport = new BleObdTransport();
      transport.onDisconnect(() => {
        setStatus("idle");
        setConnected("");
        setLiveOn(false);
        elmRef.current = null;
      });
      await transport.connect(device);
      transportRef.current = transport;
      setStatus("initializing");
      const elm = new Elm327(transport);
      await elm.initialize();
      elmRef.current = elm;
      setConnected(device.name ?? device.deviceId);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to connect — is the vehicle ignition on?");
      await transportRef.current?.disconnect().catch(() => {});
    }
  }

  async function disconnect() {
    await transportRef.current?.disconnect().catch(() => {});
    transportRef.current = null;
    elmRef.current = null;
    setConnected("");
    setResult(null);
    setLiveOn(false);
    setStatus("idle");
  }

  async function readAll() {
    const elm = elmRef.current;
    if (!elm) return;
    setStatus("reading");
    setError("");
    try {
      const [vin, dtcs, monitors, freezeDtc, live] = await Promise.all([
        elm.readVin(),
        elm.readDtcs(),
        elm.readMonitors(),
        elm.readFreezeFrameDtc(),
        elm.readLiveData(),
      ]);
      let vinDecoded = null;
      if (vin) {
        vinDecoded = await axios.get(`/api/vin-decode?vin=${vin}`).then(r => r.data).catch(() => null);
      }
      const r: ObdScanResult = {
        vin, vinDecoded, stored: dtcs.stored, pending: dtcs.pending, permanent: dtcs.permanent,
        milOn: monitors?.milOn, freezeFrameDtc: freezeDtc, liveData: live,
      };
      setResult(r);
      setLiveData(live);
      onResult?.(r);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Read failed");
    }
  }

  // One-tap: DTCs -> AI diagnosis -> AI estimate
  async function autoDiagnose() {
    const codes = result ? [...result.stored, ...result.pending, ...result.permanent] : [];
    if (!codes.length) { setError("Scan the vehicle first — no codes captured yet."); return; }
    setAiStatus("running");
    setError("");
    setAiSummary("");
    setEstimateTotal(null);
    try {
      const v = result?.vinDecoded ?? {};
      const vehicleCtx = { year: v.year || "", make: v.make || "", model: v.model || "" };
      const diag = await axios.post("/api/ai/diagnose", {
        ...vehicleCtx,
        dtcCodes: codes,
        symptoms: `OBD-II scan: ${codes.join(", ")}${result?.milOn ? " (MIL on)" : ""}`,
      }).then(r => r.data);
      setAiSummary(diag.summary || diag.likelyCauses?.[0]?.cause || "Diagnosis complete");
      try {
        const est = await axios.post("/api/ai/estimate", {
          ...vehicleCtx,
          complaint: diag.summary || `Codes: ${codes.join(", ")}`,
          dtcCodes: codes,
        }).then(r => r.data);
        const total = [...(est.laborItems ?? []), ...(est.partItems ?? [])]
          .reduce((s: number, i: { total?: number }) => s + (i.total ?? 0), 0);
        setEstimateTotal(total || null);
      } catch { /* estimate optional */ }
      setAiStatus("done");
    } catch {
      setAiStatus("idle");
      setError("AI diagnosis failed — check that ANTHROPIC_API_KEY is configured on the server.");
    }
  }

  async function clearCodes() {
    const elm = elmRef.current;
    if (!elm) return;
    setStatus("reading");
    const ok = await elm.clearDtcs();
    setStatus("ready");
    if (ok) await readAll();
    else setError("Clear failed — some vehicles require the engine off with ignition on.");
  }

  const codes = result ? [...new Set([...result.stored, ...result.pending, ...result.permanent])] : [];

  if (!isNative) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bluetooth className="h-4 w-4" /> OBD-II Scanner</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-500">
          Live vehicle scanning requires the B&V mobile app — open this page on the Android/iOS app with a Bluetooth OBD-II adapter plugged into the vehicle.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Bluetooth className="h-4 w-4" /> OBD-II Scanner</span>
          {connected && <Badge className="bg-green-100 text-green-700 font-normal">{connected}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {!connected && (
          <>
            <Button onClick={scan} disabled={status === "scanning"} variant="outline" className="w-full min-h-11">
              {status === "scanning" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {status === "scanning" ? "Scanning…" : "Scan for OBD-II adapter"}
            </Button>
            {devices.length > 0 && (
              <div className="divide-y rounded-lg border">
                {devices.map(d => (
                  <button
                    key={d.deviceId}
                    onClick={() => connect(d)}
                    disabled={status === "connecting" || status === "initializing"}
                    className="w-full text-left px-3 py-3 min-h-11 text-sm hover:bg-blue-50 flex items-center justify-between"
                  >
                    <span>{d.name || "Unnamed device"}</span>
                    <span className="text-xs text-gray-400 font-mono">{d.deviceId.slice(-8)}</span>
                  </button>
                ))}
              </div>
            )}
            {(status === "connecting" || status === "initializing") && (
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {status === "connecting" ? "Connecting…" : "Negotiating protocol with the ECU…"}
              </p>
            )}
          </>
        )}

        {connected && (
          <>
            <div className="flex gap-2">
              <Button onClick={readAll} disabled={status === "reading"} className="flex-1 bg-blue-600 hover:bg-blue-700 min-h-11">
                {status === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
                Scan vehicle
              </Button>
              <Button onClick={autoDiagnose} disabled={status === "reading" || aiStatus === "running" || !codes.length} variant="outline" className="min-h-11" title="AI diagnosis + estimate">
                {aiStatus === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              </Button>
              <Button onClick={() => setLiveOn(v => !v)} variant={liveOn ? "default" : "outline"} className="min-h-11" title="Live data">
                <Gauge className="h-4 w-4" />
              </Button>
              <Button onClick={clearCodes} disabled={status === "reading"} variant="outline" className="min-h-11" title="Clear DTCs">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button onClick={disconnect} variant="outline" className="min-h-11" title="Disconnect">
                <BluetoothOff className="h-4 w-4" />
              </Button>
            </div>

            {/* Live data stream */}
            {liveOn && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs text-gray-500 flex items-center gap-1"><Gauge className="h-3 w-3" /> Live data</p>
                {Object.keys(liveData).length === 0 && <p className="text-xs text-gray-400">Waiting for ECU data…</p>}
                <div className="space-y-1.5">
                  {Object.entries(LIVE_LABELS).map(([key, meta]) => {
                    const v = liveData[key];
                    if (v === undefined) return null;
                    const pct = Math.min(100, Math.max(0, (v / meta.max) * 100));
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{meta.label}</span>
                          <span className="font-mono">{v}{meta.unit}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-2 text-sm">
                {result.vin && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-xs text-gray-500">VIN</span>
                    <p className="font-mono text-sm">{result.vin}</p>
                    {result.vinDecoded && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {[result.vinDecoded.year, result.vinDecoded.make, result.vinDecoded.model].filter(Boolean).join(" ")}
                        {result.vinDecoded.engine ? ` · ${result.vinDecoded.engine}` : ""}
                      </p>
                    )}
                  </div>
                )}
                {result.milOn !== undefined && (
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-xs text-gray-500">Check engine light</span>
                    <Badge className={result.milOn ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}>
                      {result.milOn ? "ON" : "OFF"}
                    </Badge>
                  </div>
                )}
                <DtcBlock label="Stored codes" codes={result.stored} />
                <DtcBlock label="Pending codes" codes={result.pending} />
                <DtcBlock label="Permanent codes" codes={result.permanent} />
                {result.freezeFrameDtc && (
                  <p className="text-xs text-gray-500">Freeze frame captured for <span className="font-mono">{result.freezeFrameDtc}</span></p>
                )}
              </div>
            )}

            {/* AI pipeline result */}
            {aiStatus === "done" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700 flex items-center gap-1"><Brain className="h-3 w-3" /> AI diagnosis</p>
                <p className="text-sm">{aiSummary}</p>
                {estimateTotal !== null && (
                  <p className="text-sm font-semibold">Estimated repair: ${estimateTotal.toFixed(2)}</p>
                )}
                <Link href={`/jobs/new`} className="text-xs text-blue-600 hover:underline">
                  Create job with these codes →
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DtcBlock({ label, codes }: { label: string; codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {codes.map(c => (
          <Badge key={c} className="bg-red-100 text-red-700 font-mono">{c}</Badge>
        ))}
      </div>
    </div>
  );
}
