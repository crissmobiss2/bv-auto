import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Prisma to avoid real DB calls in unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    payment: { create: vi.fn() },
    customer: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
    job: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "test-user", role: "ADMIN", email: "test@test.com" } })),
}));
