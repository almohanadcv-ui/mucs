import { createHash } from "node:crypto";
import { InvoiceActionTokenService } from "./invoice-action-token.service";

describe("InvoiceActionTokenService", () => {
  function build(row: Record<string, unknown> | null, updateCount = 1) {
    const prisma = {
      invoiceActionToken: {
        create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({ id: "t1" })),
        findUnique: jest.fn(async () => row),
        updateMany: jest.fn(async (_args: unknown) => ({ count: updateCount })),
      },
    };
    return { service: new InvoiceActionTokenService(prisma as never), prisma };
  }

  const valid = {
    invoiceId: "inv-1",
    userId: "manager-1",
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("stores only the hash, never the token itself", async () => {
    const { service, prisma } = build(null);

    const token = await service.issue("inv-1", "manager-1");

    const [{ data }] = prisma.invoiceActionToken.create.mock.calls[0] as unknown as [
      { data: { tokenHash: string } },
    ];
    // A database leak must not hand anyone a working link.
    expect(data.tokenHash).not.toBe(token);
    expect(data.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("issues an unguessable token", async () => {
    const { service } = build(null);
    const a = await service.issue("inv-1", "m1");
    const b = await service.issue("inv-1", "m1");
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(32);
  });

  it("resolves a live token to its invoice and recipient", async () => {
    const { service } = build(valid);
    expect(await service.peek("tok")).toEqual({ invoiceId: "inv-1", userId: "manager-1" });
  });

  it("does not consume the token on peek", async () => {
    // A mail scanner or link preview must not burn the manager's link.
    const { service, prisma } = build(valid);
    await service.peek("tok");
    expect(prisma.invoiceActionToken.updateMany).not.toHaveBeenCalled();
  });

  it("reports an expired token", async () => {
    const { service } = build({ ...valid, expiresAt: new Date(Date.now() - 1000) });
    expect(await service.peek("tok")).toBe("expired");
  });

  it("reports a spent token", async () => {
    const { service } = build({ ...valid, usedAt: new Date() });
    expect(await service.peek("tok")).toBe("used");
  });

  it("reports an unknown token", async () => {
    const { service } = build(null);
    expect(await service.peek("nope")).toBe("unknown");
  });

  it("consumes a token exactly once", async () => {
    const { service } = build(valid, 1);
    expect(await service.consume("tok")).toBe(true);
  });

  it("refuses the second of two racing consumes", async () => {
    // updateMany matched no row: another request already spent it.
    const { service } = build(valid, 0);
    expect(await service.consume("tok")).toBe(false);
  });

  it("retires every outstanding link once the invoice is decided", async () => {
    const { service, prisma } = build(valid);
    await service.revokeForInvoice("inv-1");
    expect(prisma.invoiceActionToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { invoiceId: "inv-1", usedAt: null } }),
    );
  });
});
