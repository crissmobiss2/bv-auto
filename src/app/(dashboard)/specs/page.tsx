"use client";

import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Alert component not installed — using inline styling instead
import {
  Droplets, Battery, Settings, Car, Thermometer, Wrench, Gauge, Zap,
  AlertTriangle, Printer, Radio, Navigation
} from "lucide-react";

export default function SpecsPage() {
  // Vehicle selector state
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchParams, setSearchParams] = useState({ year: "", make: "", model: "" });

  const { data: spec, isLoading, error } = useQuery({
    queryKey: ["vehicleSpec", searchParams],
    queryFn: () => axios.get(`/api/vehicle-specs?year=${searchParams.year}&make=${searchParams.make}&model=${searchParams.model}`).then(r => r.data),
    enabled: !!(searchParams.year && searchParams.make && searchParams.model),
  });

  function handleSearch() {
    if (!year || !make || !model) return;
    setSearchParams({ year, make, model });
    setSearched(true);
  }

  // Spec section card helper
  function SpecCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {icon} {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5">{children}</CardContent>
      </Card>
    );
  }

  function Row({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between gap-2">
        <span className="text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
        <span className={`font-medium text-right ${highlight ? "text-blue-700" : "text-gray-900 dark:text-gray-100"}`}>{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vehicle Specifications</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">OEM fluid specs, torque values, tire pressures, battery data, and more</p>
        </div>
        {spec && !spec.error && (
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print Spec Sheet
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input placeholder="2022" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Make</Label>
              <Input placeholder="Toyota" value={make} onChange={e => setMake(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input placeholder="Camry" value={model} onChange={e => setModel(e.target.value)} />
            </div>
          </div>
          <Button className="mt-3 bg-blue-600 hover:bg-blue-700" onClick={handleSearch} disabled={!year || !make || !model || isLoading}>
            {isLoading ? "Looking up..." : "Get Specifications"}
          </Button>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading vehicle specifications...</div>
      )}

      {/* Not found */}
      {searched && !isLoading && (spec?.error || error) && (
        <div className="flex items-start gap-2 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-600" />
          <span>
            Specifications not found for {searchParams.year} {searchParams.make} {searchParams.model}.
            Try checking the <a href="/diagnostics" className="text-blue-600 underline">Diagnostics page</a> for AI-generated specs.
          </span>
        </div>
      )}

      {/* Results */}
      {spec && !spec.error && (
        <>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <h2 className="text-xl font-bold">{spec.year} {spec.make} {spec.model}</h2>
            {spec.trim && <p className="text-blue-100 text-sm">{spec.trim}</p>}
            {spec.engine && <p className="text-blue-100 text-sm mt-1">Engine: {spec.engine}</p>}
            {spec.timingType && (
              <Badge className={`mt-2 ${spec.timingType === "belt" ? "bg-red-500" : "bg-green-500"} text-white border-0`}>
                Timing {spec.timingType === "belt" ? `⚠️ Belt — Replace at ${spec.timingBeltMiles?.toLocaleString() || "??"} mi` : "✅ Chain — No replacement needed"}
              </Badge>
            )}
          </div>

          {/* Warning for timing belt */}
          {spec.timingType === "belt" && (
            <div className="flex items-start gap-2 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />
              <span><strong>Timing Belt Vehicle!</strong> Replace at {spec.timingBeltMiles?.toLocaleString() || "manufacturer specified"} miles. Failure = catastrophic engine damage.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Engine */}
            {(spec.engineDisplacement || spec.compressionRatio || spec.firingOrder) && (
              <SpecCard title="Engine" icon={<Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />}>
                <Row label="Displacement" value={spec.engineDisplacement} />
                <Row label="Cylinders" value={spec.engineCylinders} />
                <Row label="Compression" value={spec.compressionRatio} />
                <Row label="Firing Order" value={spec.firingOrder} />
                <Row label="Timing" value={spec.timingType} />
              </SpecCard>
            )}

            {/* Oil */}
            {spec.oilType && (
              <SpecCard title="Oil Service" icon={<Droplets className="h-4 w-4 text-yellow-600" />}>
                <Row label="Oil Type" value={spec.oilType} highlight />
                <Row label="Capacity (w/filter)" value={spec.oilCapacityQts ? `${spec.oilCapacityQts} qts` : null} />
                <Row label="Filter PN" value={spec.oilFilterPN} />
              </SpecCard>
            )}

            {/* Coolant */}
            {spec.coolantType && (
              <SpecCard title="Cooling System" icon={<Thermometer className="h-4 w-4 text-blue-500" />}>
                <Row label="Coolant Type" value={spec.coolantType} highlight />
                <Row label="Capacity" value={spec.coolantCapacityQts ? `${spec.coolantCapacityQts} qts` : null} />
              </SpecCard>
            )}

            {/* Transmission */}
            {spec.transFluidType && (
              <SpecCard title="Transmission" icon={<Wrench className="h-4 w-4 text-purple-600" />}>
                <Row label="Type" value={spec.transType} />
                <Row label="Fluid Type" value={spec.transFluidType} highlight />
                <Row label="Capacity" value={spec.transFluidQts ? `${spec.transFluidQts} qts` : null} />
              </SpecCard>
            )}

            {/* Other Fluids */}
            {(spec.brakeFluidType || spec.powerSteeringFluid || spec.diffFluidRearType) && (
              <SpecCard title="Other Fluids" icon={<Droplets className="h-4 w-4 text-green-600" />}>
                <Row label="Brake Fluid" value={spec.brakeFluidType} />
                <Row label="Power Steering" value={spec.powerSteeringFluid} />
                {spec.diffFluidFrontType && <Row label="Diff Front" value={`${spec.diffFluidFrontType}${spec.diffFluidFrontQts ? ` — ${spec.diffFluidFrontQts} qts` : ""}`} />}
                {spec.diffFluidRearType && <Row label="Diff Rear" value={`${spec.diffFluidRearType}${spec.diffFluidRearQts ? ` — ${spec.diffFluidRearQts} qts` : ""}`} />}
                {spec.transferCaseFluid && <Row label="Transfer Case" value={`${spec.transferCaseFluid}${spec.transferCaseQts ? ` — ${spec.transferCaseQts} qts` : ""}`} />}
              </SpecCard>
            )}

            {/* Battery */}
            {spec.batteryGroup && (
              <SpecCard title="Battery" icon={<Battery className="h-4 w-4 text-yellow-600" />}>
                <Row label="Group Size" value={spec.batteryGroup} highlight />
                <Row label="CCA" value={spec.batteryCCA ? `${spec.batteryCCA} CCA` : null} />
                <Row label="Reserve Capacity" value={spec.batteryRC ? `${spec.batteryRC} min` : null} />
              </SpecCard>
            )}

            {/* Tires */}
            {spec.tireSizeFront && (
              <SpecCard title="Tires" icon={<Car className="h-4 w-4 text-gray-700 dark:text-gray-300" />}>
                <Row label="Front Size" value={spec.tireSizeFront} highlight />
                <Row label="Rear Size" value={spec.tireSizeRear !== spec.tireSizeFront ? spec.tireSizeRear : "Same as front"} />
                <Row label="Front Pressure" value={spec.tirePressureFront ? `${spec.tirePressureFront} PSI` : null} />
                <Row label="Rear Pressure" value={spec.tirePressureRear ? `${spec.tirePressureRear} PSI` : null} />
              </SpecCard>
            )}

            {/* Brakes */}
            {spec.wheelNutTorque && (
              <SpecCard title="Brakes & Wheels" icon={<Gauge className="h-4 w-4 text-red-600" />}>
                <Row label="Wheel Nut Torque" value={spec.wheelNutTorque ? `${spec.wheelNutTorque} ft-lbs` : null} highlight />
                <Row label="Front Rotor Dia." value={spec.frontRotorDia ? `${spec.frontRotorDia}"` : null} />
                <Row label="Rear Rotor Dia." value={spec.rearRotorDia ? `${spec.rearRotorDia}"` : null} />
                <Row label="Front Rotor Min" value={spec.frontRotorMinMM ? `${spec.frontRotorMinMM} mm` : null} />
                <Row label="Rear Rotor Min" value={spec.rearRotorMinMM ? `${spec.rearRotorMinMM} mm` : null} />
                <Row label="Front Pad Min" value={spec.frontPadMinMM ? `${spec.frontPadMinMM} mm` : null} />
                <Row label="Rear Pad Min" value={spec.rearPadMinMM ? `${spec.rearPadMinMM} mm` : null} />
              </SpecCard>
            )}

            {/* Spark Plugs */}
            {spec.sparkPlugPN && (
              <SpecCard title="Ignition / Tune-Up" icon={<Zap className="h-4 w-4 text-yellow-500" />}>
                <Row label="Spark Plug" value={spec.sparkPlugPN} highlight />
                <Row label="Gap" value={spec.sparkPlugGapIn ? `${spec.sparkPlugGapIn}"` : null} />
                <Row label="Replace Interval" value={spec.sparkPlugMiles ? `${spec.sparkPlugMiles.toLocaleString()} miles` : null} />
              </SpecCard>
            )}

            {/* A/C */}
            {spec.refrigerantType && (
              <SpecCard title="A/C System" icon={<Radio className="h-4 w-4 text-blue-400" />}>
                <Row label="Refrigerant" value={spec.refrigerantType} highlight />
                <Row label="Charge" value={spec.refrigerantOz ? `${spec.refrigerantOz} oz` : null} />
                <Row label="A/C Oil" value={spec.acOilType} />
              </SpecCard>
            )}

            {/* ADAS */}
            {spec.adasFeatures?.length > 0 && (
              <SpecCard title="ADAS Systems" icon={<Navigation className="h-4 w-4 text-indigo-600" />}>
                <div className="space-y-1">
                  {spec.adasFeatures.map((f: string) => (
                    <div key={f} className="text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-1">{f}</div>
                  ))}
                </div>
                {spec.adasCalRequired?.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Calibration required after:</p>
                    {spec.adasCalRequired.map((e: string) => (
                      <div key={e} className="text-xs text-orange-700 bg-orange-50 rounded px-2 py-0.5 mb-1">⚠️ {e}</div>
                    ))}
                  </div>
                )}
              </SpecCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
