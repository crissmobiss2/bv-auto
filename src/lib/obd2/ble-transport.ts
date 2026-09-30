// BLE UART transport for ELM327-style OBD-II dongles.
// Works with the common BLE adapters (Veepeak OBDCheck BLE/BLE+, etc.)
// that expose a serial service — tries the FFE0/FFE1 clone profile first,
// then the Nordic UART Service profile.

import { BleClient, numbersToDataView, type BleDevice } from "@capacitor-community/bluetooth-le";
import type { ObdTransport } from "./elm327";

interface UartProfile {
  service: string;
  write: string;
  notify: string;
}

const PROFILES: UartProfile[] = [
  // Cheap ELM327 BLE clones (e.g. Veepeak, generic "OBDII" dongles)
  { service: "0000ffe0-0000-1000-8000-00805f9b34fb", write: "0000ffe1-0000-1000-8000-00805f9b34fb", notify: "0000ffe1-0000-1000-8000-00805f9b34fb" },
  { service: "0000fff0-0000-1000-8000-00805f9b34fb", write: "0000fff2-0000-1000-8000-00805f9b34fb", notify: "0000fff1-0000-1000-8000-00805f9b34fb" },
  // Nordic UART Service
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e", notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e" },
];

const SCAN_NAME_HINTS = /obd|elm|vlink|veepeak|odb|car\s*scanner|vgate|vgate/i;

export class BleObdTransport implements ObdTransport {
  private device: BleDevice | null = null;
  private profile: UartProfile | null = null;
  private dataCb: ((chunk: string) => void) | null = null;
  private disconnectCb: (() => void) | null = null;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  onData(cb: (chunk: string) => void) { this.dataCb = cb; }
  onDisconnect(cb: () => void) { this.disconnectCb = cb; }

  /** Scan for OBD-capable BLE peripherals for `timeoutMs`. */
  static async scan(timeoutMs = 10000): Promise<BleDevice[]> {
    await BleClient.initialize({ androidNeverForLocation: true });
    const found = new Map<string, BleDevice>();
    await BleClient.requestLEScan(
      { allowDuplicates: false },
      res => {
        const name = res.device.name ?? res.localName ?? "";
        if (name && (SCAN_NAME_HINTS.test(name) || true)) found.set(res.device.deviceId, res.device);
      },
    );
    await new Promise(r => setTimeout(r, timeoutMs));
    await BleClient.stopLEScan().catch(() => {});
    return [...found.values()];
  }

  /** Scan, preferring devices whose advertised name looks like an OBD dongle. */
  static async scanForObd(timeoutMs = 10000): Promise<BleDevice[]> {
    const all = await BleObdTransport.scan(timeoutMs);
    const hinted = all.filter(d => SCAN_NAME_HINTS.test(d.name ?? ""));
    return hinted.length ? hinted : all;
  }

  async connect(device: BleDevice): Promise<void> {
    this.device = device;
    await BleClient.connect(device.deviceId, () => {
      this.disconnectCb?.();
    });
    // Find a profile this dongle actually exposes
    const services = await BleClient.getServices(device.deviceId);
    const uuids = new Set(services.flatMap(s => [s.uuid, ...s.characteristics.map(c => c.uuid)]));
    this.profile = PROFILES.find(p => uuids.has(p.service) && uuids.has(p.write) && uuids.has(p.notify)) ?? null;
    if (!this.profile) throw new Error("Device does not expose a known UART service");
    await BleClient.startNotifications(device.deviceId, this.profile.service, this.profile.notify, dv => {
      const text = this.decoder.decode(dv);
      if (text) this.dataCb?.(text);
    });
  }

  async send(data: string): Promise<void> {
    if (!this.device || !this.profile) throw new Error("Not connected");
    const bytes = this.encoder.encode(data);
    // Chunk at 20 bytes — the safe MTU default for BLE UART clones
    for (let i = 0; i < bytes.length; i += 20) {
      await BleClient.write(
        this.device.deviceId,
        this.profile.service,
        this.profile.write,
        numbersToDataView([...bytes.slice(i, i + 20)]),
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) await BleClient.disconnect(this.device.deviceId).catch(() => {});
    this.device = null;
    this.profile = null;
  }
}
