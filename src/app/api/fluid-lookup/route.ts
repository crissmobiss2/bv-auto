import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const year  = parseInt(searchParams.get("year") || "0");
  const make  = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";

  if (!year || !make || !model) {
    return NextResponse.json({ error: "year, make, model required" }, { status: 400 });
  }

  const spec = await prisma.vehicleSpec.findFirst({
    where: {
      year,
      make: { equals: make, mode: "insensitive" },
      model: { equals: model, mode: "insensitive" },
    },
  });

  if (!spec) {
    return NextResponse.json({ error: "Vehicle not found in database" }, { status: 404 });
  }

  return NextResponse.json({
    vehicle: `${spec.year} ${spec.make} ${spec.model}${spec.trim ? ` ${spec.trim}` : ""}`,
    engine: spec.engine,
    fluids: {
      oil: { type: spec.oilType, capacityQts: spec.oilCapacityQts },
      coolant: { type: spec.coolantType, capacityQts: spec.coolantCapacityQts },
      transmission: { type: spec.transFluidType, capacityQts: spec.transFluidQts, transType: spec.transType },
      brakeFluid: spec.brakeFluidType,
      powerSteering: spec.powerSteeringFluid,
      diffFront: spec.diffFluidFrontType ? { type: spec.diffFluidFrontType, qts: spec.diffFluidFrontQts } : null,
      diffRear: spec.diffFluidRearType ? { type: spec.diffFluidRearType, qts: spec.diffFluidRearQts } : null,
      transferCase: spec.transferCaseFluid ? { type: spec.transferCaseFluid, qts: spec.transferCaseQts } : null,
      ac: { refrigerant: spec.refrigerantType, oz: spec.refrigerantOz, oil: spec.acOilType },
    },
    battery: { group: spec.batteryGroup, cca: spec.batteryCCA },
    tires: {
      front: spec.tireSizeFront,
      rear: spec.tireSizeRear,
      pressureFront: spec.tirePressureFront,
      pressureRear: spec.tirePressureRear,
    },
    brakes: {
      wheelNutTorque: spec.wheelNutTorque,
      frontRotorDia: spec.frontRotorDia,
      rearRotorDia: spec.rearRotorDia,
      frontRotorMinMM: spec.frontRotorMinMM,
      rearRotorMinMM: spec.rearRotorMinMM,
    },
    sparkPlugs: { partNumber: spec.sparkPlugPN, gapIn: spec.sparkPlugGapIn, intervalMiles: spec.sparkPlugMiles },
    adas: { features: spec.adasFeatures, calibrationRequired: spec.adasCalRequired },
    timing: { type: spec.timingType, beltMiles: spec.timingBeltMiles },
  });
}
