"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bluetooth, BluetoothOff, Loader2, ScanLine, Trash2, Car, AlertTriangle, Gauge } from "lucide-react";
import { BleObdTransport } from "@/lib/obd2/ble-transport";
import { Elm327 } from "@/lib/obd2/elm327";
import { Capacitor } from "@capacitor/core";
import type { BleDevice } from "@capacitor-community/bluetooth-le";

type Status = "idle" | "scanning" | "connecting" | "initializing" | "ready" | "reading" | "error";

export interface ObdScanResult {
  vin?: string | null;
  stored: string[];
  pending: string[];
  permanent: string[];
  milOn?: boolean;
  freezeFrameDtc?: string | null;
  liveData?: Record<string, number>;
}

export function ObdScanner({ onResult }: { onResult?: (r: ObdScanResult) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connected, setConnected] = useState<string>("");
  const [result, setResult] = useState<ObdScanResult | null>(null);
  const transportRef = useRef<BleObdTransport | null>(null);
  const elmRef = useRef<Elm327 | null>(null);

  const isNative = Capacitor.isNativePlatform();

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
    setStatus("idle");
  }

  async function readAll() {
    const elm = elmRef.current;
    if (!elm) return;
    setStatus("reading");
    setError("");
    try {
      const [vin, dtcs, monitors, freezeDtc, liveData] = await Promise.all([
        elm.readVin(),
        elm.readDtcs(),
        elm.readMonitors(),
        elm.readFreezeFrameDtc(),
        elm.readLiveData(),
      ]);
      const r: ObdScanResult = {
        vin, stored: dtcs.stored, pending: dtcs.pending, permanent: dtcs.permanent,
        milOn: monitors?.milOn, freezeFrameDtc: freezeDtc, liveData,
      };
      setResult(r);
      onResult?.(r);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Read failed");
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
          {connected && (
            <Badge className="bg-green-100 text-green-700 font-normal">
              {connected}
            </Badge>
          )}
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
            <Button onClick={scan} disabled={status === "scanning"} variant="outline" className="w-full">
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
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
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
              <Button onClick={readAll} disabled={status === "reading"} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {status === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
                Scan vehicle
              </Button>
              <Button onClick={clearCodes} disabled={status === "reading"} variant="outline" title="Clear DTCs">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button onClick={disconnect} variant="outline" title="Disconnect">
                <BluetoothOff className="h-4 w-4" />
              </Button>
            </div>

            {result && (
              <div className="space-y-2 text-sm">
                {result.vin && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-xs text-gray-500">VIN</span>
                    <p className="font-mono text-sm">{result.vin}</p>
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
                {result.liveData && Object.keys(result.liveData).length > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Gauge className="h-3 w-3" /> Live data</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                      {Object.entries(result.liveData).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-gray-500">{k}</span><span>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
