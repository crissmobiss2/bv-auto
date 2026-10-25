import { describe, it, expect, vi } from "vitest";
import { InsufficientStockError, moveStock } from "@/lib/inventory";

function fakeTx(onHand: number) {
  const state = { onHand };
  return {
    state,
    inventoryItem: {
      updateMany: vi.fn(({ where, data }: { where: { quantityOnHand?: { gte: number } }; data: { quantityOnHand: { increment: number } } }) => {
        if (where.quantityOnHand && state.onHand < where.quantityOnHand.gte) return Promise.resolve({ count: 0 });
        state.onHand += data.quantityOnHand.increment;
        return Promise.resolve({ count: 1 });
      }),
      findUnique: vi.fn(() => Promise.resolve({ quantityOnHand: state.onHand })),
    },
    inventoryMovement: { create: vi.fn((args: { data: unknown }) => Promise.resolve(args.data)) },
  };
}

describe("moveStock", () => {
  it("issues stock and writes a ledger row with the running balance", async () => {
    const tx = fakeTx(5);
    const row = await moveStock(tx as never, { itemId: "i", quantity: -2, type: "ISSUE", jobPartId: "p" });
    expect(tx.state.onHand).toBe(3);
    expect(row).toMatchObject({ quantity: -2, balanceAfter: 3, type: "ISSUE", jobPartId: "p" });
  });

  it("refuses to take stock below zero and writes no ledger row", async () => {
    const tx = fakeTx(1);
    await expect(moveStock(tx as never, { itemId: "i", quantity: -2, type: "ISSUE" })).rejects.toBeInstanceOf(InsufficientStockError);
    expect(tx.state.onHand).toBe(1);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("receives stock without a floor check", async () => {
    const tx = fakeTx(0);
    await moveStock(tx as never, { itemId: "i", quantity: 4, type: "RECEIVE" });
    expect(tx.state.onHand).toBe(4);
  });

  it("ignores zero-quantity moves", async () => {
    const tx = fakeTx(2);
    expect(await moveStock(tx as never, { itemId: "i", quantity: 0, type: "ADJUST" })).toBeNull();
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
  });
});
