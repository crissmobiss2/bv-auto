import { describe, expect, it } from "vitest";
import { CrossShopError, referencedIds, scopeArgs, scopeFilter, stampCreate } from "@/lib/tenant";

const none = async () => 0;
const one = async () => 1;

describe("tenant scoping", () => {
  it("scopes roots by shopId, children through their parent, and the shop by id", () => {
    expect(scopeFilter("Customer", "s1")).toEqual({ shopId: "s1" });
    expect(scopeFilter("JobPart", "s1")).toEqual({ job: { shopId: "s1" } });
    expect(scopeFilter("LineItem", "s1")).toEqual({ OR: [{ quote: { shopId: "s1" } }, { invoice: { shopId: "s1" } }] });
    expect(scopeFilter("Shop", "s1")).toEqual({ id: "s1" });
    expect(scopeFilter("VehicleSpec", "s1")).toBeNull();
  });

  it("adds the shop filter to unique lookups without dropping the unique key", async () => {
    const args = await scopeArgs("Invoice", "findUnique", { where: { id: "i1" } }, "s1", one, new Set());
    expect(args.where).toEqual({ id: "i1", AND: [{ shopId: "s1" }] });
  });

  it("stamps creates, including nested creates of other tenant models", async () => {
    const args = await scopeArgs("Customer", "create", { data: { firstName: "A", vehicles: { create: [{ make: "Ford" }] } } }, "s1", one, new Set());
    expect(args.data).toMatchObject({ shopId: "s1", vehicles: { create: [{ make: "Ford", shopId: "s1" }] } });
  });

  it("uses the shop relation for checked creates on models that have one", () => {
    expect(stampCreate("Job", { customer: { connect: { id: "c1" } } }, "s1")).toMatchObject({ shop: { connect: { id: "s1" } } });
    expect(stampCreate("Job", { customerId: "c1" }, "s1")).toMatchObject({ shopId: "s1" });
  });

  it("rejects writes that point at another shop's rows", async () => {
    await expect(scopeArgs("Vehicle", "create", { data: { customerId: "other" } }, "s1", none, new Set())).rejects.toBeInstanceOf(CrossShopError);
    await expect(scopeArgs("Vehicle", "create", { data: { customerId: "fresh" } }, "s1", none, new Set(["fresh"]))).resolves.toBeTruthy();
  });

  it("never lets an update move a row to another shop", async () => {
    const args = await scopeArgs("Customer", "update", { where: { id: "c1" }, data: { shopId: "s2", firstName: "B" } }, "s1", one, new Set());
    expect(args.data).toEqual({ firstName: "B" });
  });

  it("finds foreign keys by scalar and connect form", () => {
    expect(referencedIds("Payment", { invoiceId: "i1" })).toContainEqual(["Invoice", "i1"]);
    expect(referencedIds("Job", { customer: { connect: { id: "c1" } } })).toContainEqual(["Customer", "c1"]);
  });

  it("rejects nested connects and nested foreign keys that point at another shop", async () => {
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, data: { photos: { connect: [{ id: "p2" }] } } }, "s1", none, new Set()))
      .rejects.toBeInstanceOf(CrossShopError);
    await expect(scopeArgs("Customer", "update", { where: { id: "c1" }, data: { jobs: { create: [{ title: "x", fleetAccountId: "f2" }] } } }, "s1", none, new Set()))
      .rejects.toBeInstanceOf(CrossShopError);
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, data: { photos: { connect: [{ id: "p1" }] } } }, "s1", one, new Set()))
      .resolves.toBeTruthy();
  });

  it("ignores a shopId or shop link supplied on create", () => {
    expect(stampCreate("Customer", { firstName: "A", shopId: "s2" }, "s1")).toMatchObject({ shopId: "s1" });
    const linked = stampCreate("Job", { title: "x", shop: { connect: { id: "s2" } }, customer: { connect: { id: "c1" } } }, "s1");
    expect(linked.shop).toEqual({ connect: { id: "s1" } });
  });

  it("allows connectOrCreate of a new id but not of another shop's record", async () => {
    const data = { data: { photos: { connectOrCreate: [{ where: { id: "p9" }, create: { url: "u" } }] } } };
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, ...data }, "s1", none, new Set(), none)).resolves.toBeTruthy();
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, ...data }, "s1", none, new Set(), one))
      .rejects.toBeInstanceOf(CrossShopError);
  });

  it("checks the selector of nested updates and deletes", async () => {
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, data: { photos: { update: [{ where: { id: "p2" }, data: { url: "u" } }] } } }, "s1", none, new Set()))
      .rejects.toBeInstanceOf(CrossShopError);
    await expect(scopeArgs("Job", "update", { where: { id: "j1" }, data: { photos: { delete: [{ id: "p2" }] } } }, "s1", none, new Set()))
      .rejects.toBeInstanceOf(CrossShopError);
  });
});
