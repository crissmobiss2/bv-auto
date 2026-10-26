import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Prisma to avoid real DB calls in unit tests.
const db = {
  invoice: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  job: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(() => Promise.resolve([])),
};

// Support both array transactions and interactive callback transactions.
db.$transaction.mockImplementation((arg: unknown) =>
  typeof arg === "function"
    ? (arg as (tx: typeof db) => unknown)(db)
    : Promise.all(arg as Promise<unknown>[])
);

vi.mock("@/lib/prisma", () => ({ prisma: db }));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "test-user", role: "ADMIN", email: "test@test.com", shopId: "shop_1" } })),
}));
