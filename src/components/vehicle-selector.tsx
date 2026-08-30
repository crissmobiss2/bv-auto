"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { VEHICLE_MAKES, getModelsForMake, YEAR_RANGE } from "@/lib/vehicle-data";

export interface VehicleValue {
  year: string;
  make: string;
  model: string;
  trim?: string;
  mileage?: string;
}

interface VehicleSelectorProps {
  value: VehicleValue;
  onChange: (v: VehicleValue) => void;
  showMileage?: boolean;
  showTrim?: boolean;
  compact?: boolean;
  required?: boolean;
}

export function VehicleSelector({
  value, onChange, showMileage = false, showTrim = false, compact = false, required = false,
}: VehicleSelectorProps) {
  const models = getModelsForMake(value.make);

  // When make changes, clear model if it no longer belongs to new make
  useEffect(() => {
    if (value.model && models.length > 0 && !models.includes(value.model)) {
      onChange({ ...value, model: "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.make]);

  const labelClass = `text-xs font-medium text-gray-600 ${compact ? "" : "mb-1"}`;
  const selectClass =
    "w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-50 disabled:text-gray-400";

  const cols = showMileage && showTrim
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    : showMileage
    ? "grid-cols-2 sm:grid-cols-4"
    : showTrim
    ? "grid-cols-2 sm:grid-cols-4"
    : "grid-cols-3";

  return (
    <div className={`grid gap-2 ${compact ? "gap-1.5" : ""} ${cols}`}>
      {/* Year */}
      <div>
        <Label className={labelClass}>Year{required && " *"}</Label>
        <select
          className={selectClass}
          value={value.year}
          onChange={e => onChange({ ...value, year: e.target.value })}
        >
          <option value="">Year</option>
          {YEAR_RANGE.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Make */}
      <div>
        <Label className={labelClass}>Make{required && " *"}</Label>
        <select
          className={selectClass}
          value={value.make}
          onChange={e => onChange({ ...value, make: e.target.value, model: "" })}
        >
          <option value="">Make</option>
          {VEHICLE_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Model */}
      <div>
        <Label className={labelClass}>Model{required && " *"}</Label>
        {models.length > 0 ? (
          <select
            className={selectClass}
            value={value.model}
            onChange={e => onChange({ ...value, model: e.target.value })}
            disabled={!value.make}
          >
            <option value="">Model</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <Input
            placeholder="Model"
            value={value.model}
            onChange={e => onChange({ ...value, model: e.target.value })}
            disabled={!value.make}
            className="disabled:bg-gray-50"
          />
        )}
      </div>

      {/* Trim (optional) */}
      {showTrim && (
        <div>
          <Label className={labelClass}>Trim</Label>
          <Input
            placeholder="e.g. LE, XLT, Sport"
            value={value.trim ?? ""}
            onChange={e => onChange({ ...value, trim: e.target.value })}
          />
        </div>
      )}

      {/* Mileage (optional) */}
      {showMileage && (
        <div>
          <Label className={labelClass}>Mileage</Label>
          <Input
            type="number"
            placeholder="85,000"
            value={value.mileage ?? ""}
            onChange={e => onChange({ ...value, mileage: e.target.value })}
            min="0"
            max="999999"
          />
        </div>
      )}
    </div>
  );
}
