import { describe, expect, it } from "vitest";
import {
  WARRANTY_ROLES,
  canViewCustomerFinancials,
  isCustomerApiAllowed,
  isTechnicianApiBlocked,
  isTechnicianPageBlocked,
} from "@/lib/role-access";

describe("role access policy", () => {
  it("blocks technicians from both warranty route spellings", () => {
    expect(isTechnicianApiBlocked("/api/warranty")).toBe(true);
    expect(isTechnicianApiBlocked("/api/warranties")).toBe(true);
    expect(isTechnicianApiBlocked("/api/warranties/abc")).toBe(true);
    expect(isTechnicianPageBlocked("/warranty")).toBe(true);
  });

  it("keeps the technician shop-floor APIs available", () => {
    expect(isTechnicianApiBlocked("/api/jobs")).toBe(false);
    expect(isTechnicianApiBlocked("/api/jobs/abc/photos")).toBe(false);
    expect(isTechnicianApiBlocked("/api/shops/settings")).toBe(false);
  });

  it("does not let technicians or parts coordinators read customer money data", () => {
    expect(canViewCustomerFinancials("TECHNICIAN")).toBe(false);
    expect(canViewCustomerFinancials("PARTS_COORDINATOR")).toBe(false);
    expect(canViewCustomerFinancials(null)).toBe(false);
    expect(canViewCustomerFinancials("ADMIN")).toBe(true);
    expect(canViewCustomerFinancials("DISPATCHER")).toBe(true);
    expect(canViewCustomerFinancials("ACCOUNTANT")).toBe(true);
    expect(canViewCustomerFinancials("SERVICE_ADVISOR")).toBe(true);
    expect(WARRANTY_ROLES).not.toContain("TECHNICIAN");
  });

  it("keeps the customer API allowlist closed", () => {
    expect(isCustomerApiAllowed("/api/customer/dashboard")).toBe(true);
    expect(isCustomerApiAllowed("/api/push/subscribe")).toBe(true);
    expect(isCustomerApiAllowed("/api/customers")).toBe(false);
    expect(isCustomerApiAllowed("/api/invoices")).toBe(false);
  });
});
