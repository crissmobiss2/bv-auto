import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";

// Common OBD-II DTC codes — covers ~80% of what shops see day-to-day
const DTC_DB: Record<string, { description: string; system: string; severity: "low" | "medium" | "high" }> = {
  P0016: { description: "Crankshaft/Camshaft Position Correlation (Bank 1, Sensor A)", system: "Engine - Timing", severity: "high" },
  P0017: { description: "Crankshaft/Camshaft Position Correlation (Bank 1, Sensor B)", system: "Engine - Timing", severity: "high" },
  P0030: { description: "O2 Sensor Heater Control Circuit (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0068: { description: "MAP/MAF - Throttle Position Correlation", system: "Engine - Air/Fuel", severity: "medium" },
  P0087: { description: "Fuel Rail/System Pressure Too Low", system: "Fuel System", severity: "high" },
  P0088: { description: "Fuel Rail/System Pressure Too High", system: "Fuel System", severity: "high" },
  P0089: { description: "Fuel Pressure Regulator 1 Performance", system: "Fuel System", severity: "high" },
  P0097: { description: "Intake Air Temperature Sensor 2 Circuit Low", system: "Engine - Sensors", severity: "low" },
  P0101: { description: "Mass Air Flow Circuit Range/Performance", system: "Engine - Air/Fuel", severity: "medium" },
  P0102: { description: "Mass Air Flow Circuit Low Input", system: "Engine - Air/Fuel", severity: "medium" },
  P0103: { description: "Mass Air Flow Circuit High Input", system: "Engine - Air/Fuel", severity: "medium" },
  P0106: { description: "Manifold Absolute Pressure Circuit Range/Performance", system: "Engine - Air/Fuel", severity: "medium" },
  P0107: { description: "Manifold Absolute Pressure Circuit Low", system: "Engine - Air/Fuel", severity: "medium" },
  P0108: { description: "Manifold Absolute Pressure Circuit High", system: "Engine - Air/Fuel", severity: "medium" },
  P0111: { description: "Intake Air Temperature Sensor 1 Circuit Range", system: "Engine - Sensors", severity: "low" },
  P0112: { description: "Intake Air Temperature Sensor 1 Circuit Low", system: "Engine - Sensors", severity: "low" },
  P0113: { description: "Intake Air Temperature Sensor 1 Circuit High", system: "Engine - Sensors", severity: "low" },
  P0116: { description: "Engine Coolant Temperature Circuit Range/Performance", system: "Cooling System", severity: "medium" },
  P0117: { description: "Engine Coolant Temperature Circuit Low", system: "Cooling System", severity: "medium" },
  P0118: { description: "Engine Coolant Temperature Circuit High", system: "Cooling System", severity: "medium" },
  P0121: { description: "Throttle Position Sensor A Circuit Range/Performance", system: "Engine - Throttle", severity: "medium" },
  P0122: { description: "Throttle Position Sensor A Circuit Low", system: "Engine - Throttle", severity: "medium" },
  P0123: { description: "Throttle Position Sensor A Circuit High", system: "Engine - Throttle", severity: "medium" },
  P0128: { description: "Coolant Temperature Below Thermostat Regulating Temperature", system: "Cooling System", severity: "medium" },
  P0130: { description: "O2 Sensor Circuit (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0131: { description: "O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0132: { description: "O2 Sensor Circuit High Voltage (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0133: { description: "O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0134: { description: "O2 Sensor Circuit No Activity Detected (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0135: { description: "O2 Sensor Heater Circuit (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P0138: { description: "O2 Sensor Circuit High Voltage (Bank 1, Sensor 2)", system: "Emissions", severity: "medium" },
  P0141: { description: "O2 Sensor Heater Circuit (Bank 1, Sensor 2)", system: "Emissions", severity: "medium" },
  P0148: { description: "Fuel Delivery Error", system: "Fuel System", severity: "high" },
  P0171: { description: "System Too Lean (Bank 1)", system: "Engine - Air/Fuel", severity: "medium" },
  P0172: { description: "System Too Rich (Bank 1)", system: "Engine - Air/Fuel", severity: "medium" },
  P0174: { description: "System Too Lean (Bank 2)", system: "Engine - Air/Fuel", severity: "medium" },
  P0175: { description: "System Too Rich (Bank 2)", system: "Engine - Air/Fuel", severity: "medium" },
  P0191: { description: "Fuel Rail Pressure Sensor Circuit Range/Performance", system: "Fuel System", severity: "high" },
  P0193: { description: "Fuel Rail Pressure Sensor Circuit High", system: "Fuel System", severity: "high" },
  P0196: { description: "Engine Oil Temperature Sensor Range/Performance", system: "Engine - Sensors", severity: "low" },
  P0201: { description: "Injector Circuit Open - Cylinder 1", system: "Fuel System", severity: "high" },
  P0202: { description: "Injector Circuit Open - Cylinder 2", system: "Fuel System", severity: "high" },
  P0203: { description: "Injector Circuit Open - Cylinder 3", system: "Fuel System", severity: "high" },
  P0204: { description: "Injector Circuit Open - Cylinder 4", system: "Fuel System", severity: "high" },
  P0205: { description: "Injector Circuit Open - Cylinder 5", system: "Fuel System", severity: "high" },
  P0206: { description: "Injector Circuit Open - Cylinder 6", system: "Fuel System", severity: "high" },
  P0217: { description: "Engine Coolant Over-Temperature Condition", system: "Cooling System", severity: "high" },
  P0218: { description: "Transmission Over Temperature Condition", system: "Transmission", severity: "high" },
  P0219: { description: "Engine Over Speed Condition", system: "Engine", severity: "high" },
  P0222: { description: "Throttle Position Sensor B Circuit Low", system: "Engine - Throttle", severity: "medium" },
  P0223: { description: "Throttle Position Sensor B Circuit High", system: "Engine - Throttle", severity: "medium" },
  P0234: { description: "Turbocharger/Supercharger A Overboost Condition", system: "Forced Induction", severity: "high" },
  P0236: { description: "Turbocharger/Supercharger Boost Sensor A Circuit Range", system: "Forced Induction", severity: "medium" },
  P0238: { description: "Turbocharger/Supercharger Boost Sensor A Circuit High", system: "Forced Induction", severity: "medium" },
  P0261: { description: "Cylinder 1 Injector Circuit Low", system: "Fuel System", severity: "high" },
  P0263: { description: "Cylinder 1 Contribution/Balance Fault", system: "Fuel System", severity: "high" },
  P0299: { description: "Turbo/Super Charger Underboost Condition", system: "Forced Induction", severity: "high" },
  P0300: { description: "Random/Multiple Cylinder Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0301: { description: "Cylinder 1 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0302: { description: "Cylinder 2 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0303: { description: "Cylinder 3 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0304: { description: "Cylinder 4 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0305: { description: "Cylinder 5 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0306: { description: "Cylinder 6 Misfire Detected", system: "Ignition/Fuel", severity: "high" },
  P0316: { description: "Misfire Detected on Startup (First 1000 Revolutions)", system: "Ignition/Fuel", severity: "high" },
  P0325: { description: "Knock Sensor 1 Circuit (Bank 1 or Single Sensor)", system: "Engine - Sensors", severity: "medium" },
  P0326: { description: "Knock Sensor 1 Circuit Range/Performance (Bank 1)", system: "Engine - Sensors", severity: "medium" },
  P0327: { description: "Knock Sensor 1 Circuit Low (Bank 1)", system: "Engine - Sensors", severity: "medium" },
  P0328: { description: "Knock Sensor 1 Circuit High (Bank 1)", system: "Engine - Sensors", severity: "medium" },
  P0332: { description: "Knock Sensor 2 Circuit Low (Bank 2)", system: "Engine - Sensors", severity: "medium" },
  P0335: { description: "Crankshaft Position Sensor A Circuit", system: "Engine - Sensors", severity: "high" },
  P0336: { description: "Crankshaft Position Sensor A Circuit Range/Performance", system: "Engine - Sensors", severity: "high" },
  P0340: { description: "Camshaft Position Sensor A Circuit (Bank 1 or Single Sensor)", system: "Engine - Sensors", severity: "high" },
  P0341: { description: "Camshaft Position Sensor A Circuit Range/Performance (Bank 1)", system: "Engine - Sensors", severity: "high" },
  P0344: { description: "Camshaft Position Sensor A Circuit Intermittent (Bank 1)", system: "Engine - Sensors", severity: "high" },
  P0345: { description: "Camshaft Position Sensor A Circuit (Bank 2)", system: "Engine - Sensors", severity: "high" },
  P0365: { description: "Camshaft Position Sensor B Circuit (Bank 1)", system: "Engine - Sensors", severity: "high" },
  P0380: { description: "Glow Plug/Heater Circuit A", system: "Engine - Diesel", severity: "medium" },
  P0385: { description: "Crankshaft Position Sensor B Circuit", system: "Engine - Sensors", severity: "high" },
  P0390: { description: "Camshaft Position Sensor B Circuit (Bank 2)", system: "Engine - Sensors", severity: "high" },
  P0400: { description: "Exhaust Gas Recirculation Flow Malfunction", system: "Emissions - EGR", severity: "medium" },
  P0401: { description: "Exhaust Gas Recirculation Flow Insufficient", system: "Emissions - EGR", severity: "medium" },
  P0402: { description: "Exhaust Gas Recirculation Flow Excessive", system: "Emissions - EGR", severity: "medium" },
  P0404: { description: "Exhaust Gas Recirculation Circuit Range/Performance", system: "Emissions - EGR", severity: "medium" },
  P0405: { description: "Exhaust Gas Recirculation Sensor A Circuit Low", system: "Emissions - EGR", severity: "medium" },
  P0406: { description: "Exhaust Gas Recirculation Sensor A Circuit High", system: "Emissions - EGR", severity: "medium" },
  P0410: { description: "Secondary Air Injection System", system: "Emissions", severity: "medium" },
  P0411: { description: "Secondary Air Injection System Incorrect Upstream Flow", system: "Emissions", severity: "medium" },
  P0420: { description: "Catalyst System Efficiency Below Threshold (Bank 1)", system: "Emissions - Catalytic", severity: "medium" },
  P0421: { description: "Warm Up Catalyst Efficiency Below Threshold (Bank 1)", system: "Emissions - Catalytic", severity: "medium" },
  P0430: { description: "Catalyst System Efficiency Below Threshold (Bank 2)", system: "Emissions - Catalytic", severity: "medium" },
  P0440: { description: "Evaporative Emission Control System Malfunction", system: "Emissions - EVAP", severity: "low" },
  P0441: { description: "Evaporative Emission Control System Incorrect Purge Flow", system: "Emissions - EVAP", severity: "low" },
  P0442: { description: "Evaporative Emission Control System Small Leak", system: "Emissions - EVAP", severity: "low" },
  P0443: { description: "Evaporative Emission Control System Purge Control Valve Circuit", system: "Emissions - EVAP", severity: "low" },
  P0446: { description: "Evaporative Emission Control System Vent Control Circuit", system: "Emissions - EVAP", severity: "low" },
  P0449: { description: "Evaporative Emission Control System Vent Valve/Solenoid Circuit", system: "Emissions - EVAP", severity: "low" },
  P0451: { description: "Evaporative Emission Control System Pressure Sensor Range", system: "Emissions - EVAP", severity: "low" },
  P0452: { description: "Evaporative Emission Control System Pressure Sensor Low", system: "Emissions - EVAP", severity: "low" },
  P0453: { description: "Evaporative Emission Control System Pressure Sensor High", system: "Emissions - EVAP", severity: "low" },
  P0455: { description: "Evaporative Emission Control System Large Leak", system: "Emissions - EVAP", severity: "medium" },
  P0456: { description: "Evaporative Emission Control System Very Small Leak", system: "Emissions - EVAP", severity: "low" },
  P0457: { description: "Evaporative Emission Control System Leak Detected (Fuel Cap Loose)", system: "Emissions - EVAP", severity: "low" },
  P0461: { description: "Fuel Level Sensor A Circuit Range/Performance", system: "Fuel System", severity: "low" },
  P0462: { description: "Fuel Level Sensor A Circuit Low", system: "Fuel System", severity: "low" },
  P0463: { description: "Fuel Level Sensor A Circuit High", system: "Fuel System", severity: "low" },
  P0480: { description: "Cooling Fan 1 Control Circuit", system: "Cooling System", severity: "high" },
  P0481: { description: "Cooling Fan 2 Control Circuit", system: "Cooling System", severity: "high" },
  P0483: { description: "Cooling Fan Rationality Check", system: "Cooling System", severity: "medium" },
  P0491: { description: "Secondary Air Injection System Insufficient Flow (Bank 1)", system: "Emissions", severity: "medium" },
  P0492: { description: "Secondary Air Injection System Insufficient Flow (Bank 2)", system: "Emissions", severity: "medium" },
  P0496: { description: "Evaporative Emission System High Purge Flow", system: "Emissions - EVAP", severity: "low" },
  P0500: { description: "Vehicle Speed Sensor A", system: "Drivetrain", severity: "medium" },
  P0501: { description: "Vehicle Speed Sensor A Range/Performance", system: "Drivetrain", severity: "medium" },
  P0505: { description: "Idle Control System", system: "Engine - Idle", severity: "medium" },
  P0506: { description: "Idle Control System RPM Lower Than Expected", system: "Engine - Idle", severity: "medium" },
  P0507: { description: "Idle Control System RPM Higher Than Expected", system: "Engine - Idle", severity: "medium" },
  P0520: { description: "Engine Oil Pressure Sensor/Switch Circuit", system: "Lubrication", severity: "high" },
  P0521: { description: "Engine Oil Pressure Sensor/Switch Range/Performance", system: "Lubrication", severity: "high" },
  P0522: { description: "Engine Oil Pressure Sensor/Switch Low Voltage", system: "Lubrication", severity: "high" },
  P0523: { description: "Engine Oil Pressure Sensor/Switch High Voltage", system: "Lubrication", severity: "high" },
  P0524: { description: "Engine Oil Pressure Too Low", system: "Lubrication", severity: "high" },
  P0532: { description: "A/C Refrigerant Pressure Sensor Circuit Low", system: "HVAC", severity: "medium" },
  P0533: { description: "A/C Refrigerant Pressure Sensor Circuit High", system: "HVAC", severity: "medium" },
  P0541: { description: "Intake Air Heater Circuit Low (Bank 1)", system: "Engine - Diesel", severity: "medium" },
  P0562: { description: "System Voltage Low", system: "Electrical", severity: "high" },
  P0563: { description: "System Voltage High", system: "Electrical", severity: "high" },
  P0571: { description: "Brake Switch A Circuit", system: "Brakes", severity: "medium" },
  P0572: { description: "Brake Switch A Circuit Low", system: "Brakes", severity: "medium" },
  P0574: { description: "Cruise Control System - Vehicle Speed Too High", system: "Cruise Control", severity: "low" },
  P0600: { description: "Serial Communication Link", system: "Computer/Network", severity: "high" },
  P0601: { description: "Internal Control Module Memory Check Sum Error", system: "Computer/Network", severity: "high" },
  P0602: { description: "Control Module Programming Error", system: "Computer/Network", severity: "high" },
  P0606: { description: "PCM Processor Fault", system: "Computer/Network", severity: "high" },
  P0607: { description: "Control Module Performance", system: "Computer/Network", severity: "high" },
  P0614: { description: "ECM/TCM Incompatible", system: "Computer/Network", severity: "high" },
  P0615: { description: "Starter Relay Circuit", system: "Electrical", severity: "high" },
  P0620: { description: "Generator Control Circuit", system: "Electrical", severity: "high" },
  P0622: { description: "Generator Field F Terminal Circuit", system: "Electrical", severity: "high" },
  P0627: { description: "Fuel Pump A Control Circuit Open", system: "Fuel System", severity: "high" },
  P0641: { description: "Sensor Reference Voltage A Circuit Open", system: "Engine - Sensors", severity: "high" },
  P0645: { description: "A/C Clutch Relay Control Circuit", system: "HVAC", severity: "medium" },
  P0650: { description: "Malfunction Indicator Lamp (MIL) Control Circuit", system: "Electrical", severity: "medium" },
  P0660: { description: "Intake Manifold Tuning Valve Control Circuit Open (Bank 1)", system: "Engine - Intake", severity: "medium" },
  P0700: { description: "Transmission Control System (MIL Request)", system: "Transmission", severity: "high" },
  P0705: { description: "Transmission Range Sensor Circuit (PRNDL Input)", system: "Transmission", severity: "high" },
  P0706: { description: "Transmission Range Sensor Circuit Range/Performance", system: "Transmission", severity: "high" },
  P0711: { description: "Transmission Fluid Temperature Sensor A Circuit Range", system: "Transmission", severity: "medium" },
  P0712: { description: "Transmission Fluid Temperature Sensor A Circuit Low", system: "Transmission", severity: "medium" },
  P0713: { description: "Transmission Fluid Temperature Sensor A Circuit High", system: "Transmission", severity: "medium" },
  P0715: { description: "Input/Turbine Speed Sensor A Circuit", system: "Transmission", severity: "high" },
  P0717: { description: "Input/Turbine Speed Sensor A Circuit No Signal", system: "Transmission", severity: "high" },
  P0720: { description: "Output Speed Sensor Circuit", system: "Transmission", severity: "high" },
  P0721: { description: "Output Speed Sensor Circuit Range/Performance", system: "Transmission", severity: "high" },
  P0722: { description: "Output Speed Sensor Circuit No Signal", system: "Transmission", severity: "high" },
  P0725: { description: "Engine Speed Input Circuit", system: "Transmission", severity: "high" },
  P0730: { description: "Incorrect Gear Ratio", system: "Transmission", severity: "high" },
  P0731: { description: "Gear 1 Incorrect Ratio", system: "Transmission", severity: "high" },
  P0732: { description: "Gear 2 Incorrect Ratio", system: "Transmission", severity: "high" },
  P0733: { description: "Gear 3 Incorrect Ratio", system: "Transmission", severity: "high" },
  P0734: { description: "Gear 4 Incorrect Ratio", system: "Transmission", severity: "high" },
  P0735: { description: "Gear 5 Incorrect Ratio", system: "Transmission", severity: "high" },
  P0740: { description: "Torque Converter Clutch Circuit Malfunction", system: "Transmission", severity: "high" },
  P0741: { description: "Torque Converter Clutch Circuit Performance or Stuck Off", system: "Transmission", severity: "high" },
  P0750: { description: "Shift Solenoid A Malfunction", system: "Transmission", severity: "high" },
  P0755: { description: "Shift Solenoid B Malfunction", system: "Transmission", severity: "high" },
  P0760: { description: "Shift Solenoid C Malfunction", system: "Transmission", severity: "high" },
  P0765: { description: "Shift Solenoid D Malfunction", system: "Transmission", severity: "high" },
  P0770: { description: "Shift Solenoid E Malfunction", system: "Transmission", severity: "high" },
  P0780: { description: "Shift Malfunction", system: "Transmission", severity: "high" },
  P0800: { description: "Transfer Case Control System (MIL Request)", system: "4WD/AWD", severity: "high" },
  P0815: { description: "Upshift Switch Circuit", system: "Transmission", severity: "low" },
  P0816: { description: "Downshift Switch Circuit", system: "Transmission", severity: "low" },
  P0826: { description: "Up and Down Shift Switch to Vehicle Speed Correlation", system: "Transmission", severity: "medium" },
  P0830: { description: "Clutch Pedal Switch A Circuit", system: "Transmission", severity: "medium" },
  P0840: { description: "Transmission Fluid Pressure Sensor/Switch A Circuit", system: "Transmission", severity: "high" },
  P0868: { description: "Transmission Fluid Pressure Low", system: "Transmission", severity: "high" },
  P0882: { description: "TCM Power Input Signal Low", system: "Transmission", severity: "high" },
  P0888: { description: "TCM Power Relay Sense Circuit Range/Performance", system: "Transmission", severity: "high" },
  P1101: { description: "Mass Air Flow Sensor Out of Self-Test Range", system: "Engine - Air/Fuel", severity: "medium" },
  P2101: { description: "Throttle Actuator Control Motor Circuit Range/Performance", system: "Engine - Throttle", severity: "high" },
  P2111: { description: "Throttle Actuator Control System - Stuck Open", system: "Engine - Throttle", severity: "high" },
  P2112: { description: "Throttle Actuator Control System - Stuck Closed", system: "Engine - Throttle", severity: "high" },
  P2119: { description: "Throttle Actuator Control Throttle Body Range/Performance", system: "Engine - Throttle", severity: "high" },
  P2122: { description: "Throttle/Pedal Position Sensor/Switch D Circuit Low", system: "Engine - Throttle", severity: "high" },
  P2123: { description: "Throttle/Pedal Position Sensor/Switch D Circuit High", system: "Engine - Throttle", severity: "high" },
  P2127: { description: "Throttle/Pedal Position Sensor/Switch E Circuit Low", system: "Engine - Throttle", severity: "high" },
  P2128: { description: "Throttle/Pedal Position Sensor/Switch E Circuit High", system: "Engine - Throttle", severity: "high" },
  P2135: { description: "Throttle/Pedal Position Sensor/Switch A/B Voltage Correlation", system: "Engine - Throttle", severity: "high" },
  P2138: { description: "Throttle/Pedal Position Sensor/Switch D/E Voltage Correlation", system: "Engine - Throttle", severity: "high" },
  P2176: { description: "Throttle Actuator Control System - Idle Position Not Learned", system: "Engine - Throttle", severity: "medium" },
  P2187: { description: "System Too Lean at Idle (Bank 1)", system: "Engine - Air/Fuel", severity: "medium" },
  P2188: { description: "System Too Rich at Idle (Bank 1)", system: "Engine - Air/Fuel", severity: "medium" },
  P2195: { description: "O2 Sensor Signal Biased/Stuck Lean (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P2196: { description: "O2 Sensor Signal Biased/Stuck Rich (Bank 1, Sensor 1)", system: "Emissions", severity: "medium" },
  P2227: { description: "Barometric Pressure Circuit Range/Performance", system: "Engine - Sensors", severity: "low" },
  P2270: { description: "O2 Sensor Signal Stuck Lean (Bank 1, Sensor 2)", system: "Emissions", severity: "medium" },
  P2271: { description: "O2 Sensor Signal Stuck Rich (Bank 1, Sensor 2)", system: "Emissions", severity: "medium" },
  P2279: { description: "Intake Air System Leak", system: "Engine - Air/Fuel", severity: "medium" },
  P2291: { description: "Injector Control Pressure Too Low - Engine Cranking", system: "Fuel System", severity: "high" },
  P2303: { description: "Ignition Coil A Secondary Circuit Insufficient Ionization", system: "Ignition", severity: "high" },
  P2401: { description: "EVAP Leak Detection Pump Control Circuit Low", system: "Emissions - EVAP", severity: "low" },
  P2402: { description: "EVAP Leak Detection Pump Control Circuit High", system: "Emissions - EVAP", severity: "low" },
  P2420: { description: "EVAP Vent Valve Stuck Open", system: "Emissions - EVAP", severity: "low" },
  P2422: { description: "EVAP Canister Vent Shut Valve Close Malfunction", system: "Emissions - EVAP", severity: "low" },
  P2440: { description: "Secondary Air Injection Switching Valve Stuck Open (Bank 1)", system: "Emissions", severity: "medium" },
  P2441: { description: "Secondary Air Injection Switching Valve Stuck Closed (Bank 1)", system: "Emissions", severity: "medium" },
  P2534: { description: "Ignition Switch Run/Crank Circuit Low", system: "Electrical", severity: "high" },
  P2610: { description: "ECM/PCM Internal Engine Off Timer Performance", system: "Computer/Network", severity: "high" },
  P2614: { description: "Camshaft Position Output Circuit", system: "Engine - Sensors", severity: "high" },
  P2635: { description: "Fuel Pump A Low Flow/Performance", system: "Fuel System", severity: "high" },
  C0035: { description: "Right Front Wheel Speed Sensor Circuit", system: "ABS/Stability", severity: "high" },
  C0040: { description: "Right Front Wheel Speed Sensor Circuit Range/Performance", system: "ABS/Stability", severity: "high" },
  C0041: { description: "Right Front Wheel Speed Sensor Circuit Range/Performance", system: "ABS/Stability", severity: "high" },
  C0045: { description: "Left Front Wheel Speed Sensor Circuit", system: "ABS/Stability", severity: "high" },
  C0050: { description: "Right Rear Wheel Speed Sensor Circuit", system: "ABS/Stability", severity: "high" },
  C0055: { description: "Left Rear Wheel Speed Sensor Circuit", system: "ABS/Stability", severity: "high" },
  C0060: { description: "Left Front ABS Solenoid 1 Circuit", system: "ABS/Stability", severity: "high" },
  C0110: { description: "ABS Motor Circuit", system: "ABS/Stability", severity: "high" },
  C0121: { description: "Valve Relay Circuit", system: "ABS/Stability", severity: "high" },
  C0131: { description: "ABS/TCS Pressure Circuit", system: "ABS/Stability", severity: "high" },
  C0161: { description: "ABS/TCS Brake Switch Circuit", system: "ABS/Stability", severity: "medium" },
  C0186: { description: "Lateral Accelerometer Signal Erratic", system: "ABS/Stability", severity: "medium" },
  C0196: { description: "Yaw Rate Sensor Circuit", system: "ABS/Stability", severity: "medium" },
  C0200: { description: "Right Front Wheel Speed Sensor Circuit", system: "ABS/Stability", severity: "high" },
  C0205: { description: "Right Front Wheel Speed Sensor Circuit Range/Performance", system: "ABS/Stability", severity: "high" },
  B0001: { description: "Driver Frontal Stage 1 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0002: { description: "Driver Frontal Stage 2 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0010: { description: "Passenger Frontal Stage 1 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0011: { description: "Passenger Frontal Stage 2 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0020: { description: "Right Front Side Stage 1 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0030: { description: "Left Front Side Stage 1 Deployment Control", system: "Airbag/SRS", severity: "high" },
  B0051: { description: "Supplemental Restraint System (SRS) - Deployment Commanded", system: "Airbag/SRS", severity: "high" },
  B0060: { description: "Side Impact Sensor (Right)", system: "Airbag/SRS", severity: "high" },
  B0070: { description: "Side Impact Sensor (Left)", system: "Airbag/SRS", severity: "high" },
  U0001: { description: "High Speed CAN Communication Bus", system: "Computer/Network", severity: "high" },
  U0010: { description: "Medium Speed CAN Communication Bus", system: "Computer/Network", severity: "high" },
  U0073: { description: "Control Module Communication Bus Off", system: "Computer/Network", severity: "high" },
  U0100: { description: "Lost Communication With ECM/PCM A", system: "Computer/Network", severity: "high" },
  U0101: { description: "Lost Communication With TCM", system: "Computer/Network", severity: "high" },
  U0102: { description: "Lost Communication With Transfer Case Control Module", system: "Computer/Network", severity: "high" },
  U0103: { description: "Lost Communication With Gear Shift Module", system: "Computer/Network", severity: "medium" },
  U0121: { description: "Lost Communication With Anti-Lock Brake System Control Module", system: "Computer/Network", severity: "high" },
  U0122: { description: "Lost Communication With Vehicle Dynamics Control Module", system: "Computer/Network", severity: "high" },
  U0126: { description: "Lost Communication With Steering Angle Sensor Module", system: "Computer/Network", severity: "medium" },
  U0129: { description: "Lost Communication With Brake System Control Module", system: "Computer/Network", severity: "high" },
  U0131: { description: "Lost Communication With Power Steering Control Module", system: "Computer/Network", severity: "medium" },
  U0140: { description: "Lost Communication With Body Control Module", system: "Computer/Network", severity: "high" },
  U0155: { description: "Lost Communication With Instrument Panel Cluster (IPC)", system: "Computer/Network", severity: "medium" },
  U0164: { description: "Lost Communication With HVAC Control Module", system: "Computer/Network", severity: "medium" },
};

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code")?.toUpperCase().trim();
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const year = searchParams.get("year") || "";

  if (!code) return apiError("code is required", 400);

  const known = DTC_DB[code];

  if (known) {
    // Enhance with AI if vehicle context provided
    if (make && model && year && process.env.ANTHROPIC_API_KEY) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{
            role: "user",
            content: `Vehicle: ${year} ${make} ${model}\nDTC Code: ${code} - ${known.description}\n\nAs an ASE-certified automotive technician, provide:\n1. Top 3 most likely causes for this specific vehicle (ranked by probability)\n2. Recommended diagnostic steps\n3. Estimated repair cost range (parts + labor)\n\nBe concise. Format as JSON: { "causes": ["...", "...", "..."], "diagnosticSteps": ["...", "..."], "estimatedCost": "$X - $Y" }`
          }]
        });
        const text = (msg.content[0] as { text: string }).text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        return apiSuccess({ code, ...known, ai: aiData });
      } catch {
        // AI unavailable, return base data
      }
    }
    return apiSuccess({ code, ...known });
  }

  // Code not in local DB — try AI if available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const vehicleCtx = make ? `Vehicle: ${year} ${make} ${model}\n` : "";
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `${vehicleCtx}OBD-II DTC Code: ${code}\n\nAs an ASE-certified technician, provide:\n1. Code description/definition\n2. System affected\n3. Severity (low/medium/high)\n4. Top 3 likely causes\n5. Estimated repair cost range\n\nFormat as JSON: { "description": "...", "system": "...", "severity": "low|medium|high", "causes": [...], "estimatedCost": "$X - $Y" }`
        }]
      });
      const text = (msg.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return apiSuccess({ code, ...data, source: "ai" });
      }
    } catch {
      // fall through
    }
  }

  return apiError(`Code ${code} not found in database`, 404);
}
