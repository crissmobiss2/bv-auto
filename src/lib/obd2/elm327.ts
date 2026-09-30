// ELM327 command layer. Transport-agnostic: any object implementing
// ObdTransport (BLE UART, classic SPP, WiFi TCP) can drive it.

export interface ObdTransport {
  send(data: string): Promise<void>;
  onData(cb: (chunk: string) => void): void;
  onDisconnect(cb: () => void): void;
}

export class ElmError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new ElmError(`${what} timed out`)), ms)),
  ]);
}

const DTC_SYS = ["P", "C", "B", "U"];

export function decodeDtc(raw: number): string {
  const sys = DTC_SYS[(raw >> 14) & 0x3];
  const d2 = (raw >> 12) & 0x3;
  const rest = (raw & 0x0fff).toString(16).padStart(3, "0").toUpperCase();
  return `${sys}${d2}${rest}`;
}

export class Elm327 {
  private buffer = "";
  private waiters: ((line: string) => void)[] = [];

  constructor(private transport: ObdTransport) {
    transport.onData(chunk => {
      this.buffer += chunk;
      const idx = this.buffer.indexOf(">");
      if (idx >= 0) {
        const resp = this.buffer.slice(0, idx);
        this.buffer = this.buffer.slice(idx + 1);
        const w = this.waiters.shift();
        w?.(resp);
      }
    });
  }

  /** Send an AT/PID command and resolve with the response (echo and prompt stripped). */
  command(cmd: string, timeoutMs = 5000): Promise<string> {
    const resp = new Promise<string>(resolve => this.waiters.push(resolve));
    return withTimeout(
      this.transport.send(cmd + "\r").then(() => resp),
      timeoutMs,
      cmd,
    ).then(raw =>
      raw
        .split(/\r+/)
        .map(l => l.trim())
        .filter(l => l && l !== cmd && l !== ">" && l !== "SEARCHING..." && !/^AT/i.test(l))
        .join("\r"),
    );
  }

  /** Hex payload lines for a mode+PID request (headers included so we slice them off). */
  private async pidLines(pid: string): Promise<string[]> {
    const resp = await this.command(pid, 8000);
    if (/UNABLE TO CONNECT|NO DATA|STOPPED|CAN ERROR/i.test(resp)) {
      throw new ElmError(resp.split("\r")[0] || "ECU returned no data");
    }
    return resp
      .split("\r")
      .map(l => l.replace(/[\s:]/g, ""))
      .filter(l => /^[0-9A-Fa-f]+$/.test(l));
  }

  async initialize(): Promise<{ elmVersion: string; protocol: string }> {
    const ver = await this.command("ATI", 10000).catch(() => "");
    await this.command("ATE0");
    await this.command("ATL0");
    await this.command("ATS0");
    await this.command("ATH1"); // headers on: lets us split multi-ECU responses
    await this.command("ATAT1");
    await this.command("ATSP0"); // auto protocol
    await this.pidLines("0100"); // bus probe — throws if no ECU answers
    const proto = await this.command("ATDP").catch(() => "");
    return {
      elmVersion: ver.replace(/\r/g, " ").trim(),
      protocol: proto.replace(/\r/g, " ").trim(),
    };
  }

  /** VIN via mode 09 PID 02. */
  async readVin(): Promise<string | null> {
    try {
      const lines = await this.pidLines("0902");
      // Frames look like: 7E8 10 14 49 02 01 56 49 4E / 7E8 21 ... — take bytes after the 0x49 marker
      const data = lines.join("");
      const idx = data.indexOf("4902");
      if (idx < 0) return null;
      const hex = data.slice(idx + 6); // skip 4902 + 1 count byte
      const ascii = (hex.match(/../g) ?? [])
        .map(b => String.fromCharCode(parseInt(b, 16)))
        .join("")
        .replace(/[^ -~]/g, "")
        .trim();
      return ascii.length >= 11 ? ascii.slice(0, 17) : null;
    } catch {
      return null;
    }
  }

  /** Stored (mode 03), pending (07) and permanent (0A) DTCs. */
  async readDtcs(): Promise<{ stored: string[]; pending: string[]; permanent: string[] }> {
    const [stored, pending, permanent] = await Promise.all([
      this.modeDtc("03"),
      this.modeDtc("07"),
      this.modeDtc("0A"),
    ]);
    return { stored, pending, permanent };
  }

  private async modeDtc(mode: string): Promise<string[]> {
    try {
      const lines = await this.pidLines(mode);
      const out: string[] = [];
      for (const l of lines) {
        // Skip 3-byte header (7E8xx) + 2-byte mode response (4x)
        const body = l.length > 10 ? l.slice(8) : l.slice(4);
        for (let i = 0; i + 4 <= body.length; i += 4) {
          const raw = parseInt(body.slice(i, i + 4), 16);
          if (raw !== 0) out.push(decodeDtc(raw));
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  /** MIL status + DTC count from mode 01 PID 01. */
  async readMonitors(): Promise<{ milOn: boolean; dtcCount: number } | null> {
    try {
      const [l] = await this.pidLines("0101");
      const a = parseInt(l.slice(-8, -6), 16);
      return { milOn: (a & 0x80) !== 0, dtcCount: a & 0x7f };
    } catch {
      return null;
    }
  }

  /** DTC that triggered the stored freeze frame (mode 01 PID 02). */
  async readFreezeFrameDtc(): Promise<string | null> {
    try {
      const [l] = await this.pidLines("0102");
      const raw = parseInt(l.slice(-4), 16);
      return raw ? decodeDtc(raw) : null;
    } catch {
      return null;
    }
  }

  /** Live data PIDs. Unsupported PIDs are skipped. */
  async readLiveData(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    const jobs: [key: string, pid: string, decode: (b: number[]) => number][] = [
      ["rpm", "010C", b => (b[0] * 256 + b[1]) / 4],
      ["speedKph", "010D", b => b[0]],
      ["coolantTempC", "0105", b => b[0] - 40],
      ["intakeTempC", "010F", b => b[0] - 40],
      ["throttlePct", "0111", b => (b[0] * 100) / 255],
      ["engineLoadPct", "0104", b => (b[0] * 100) / 255],
      ["mafGps", "0110", b => (b[0] * 256 + b[1]) / 100],
      ["fuelPressureKpa", "010A", b => b[0] * 3],
      ["batteryVoltage", "0142", b => (b[0] * 256 + b[1]) / 1000],
    ];
    await Promise.all(
      jobs.map(async ([key, pid, fn]) => {
        try {
          const [l] = await this.pidLines(pid);
          const bytes = (l.slice(-8).match(/../g) ?? []).map(h => parseInt(h, 16));
          if (bytes.length) out[key] = Math.round(fn(bytes) * 100) / 100;
        } catch { /* PID unsupported on this vehicle */ }
      }),
    );
    return out;
  }

  async clearDtcs(): Promise<boolean> {
    const resp = await this.command("04", 8000);
    return !/UNABLE|ERROR|\?/i.test(resp);
  }
}
