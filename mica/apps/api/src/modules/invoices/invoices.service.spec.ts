import { ConflictException } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";

/**
 * Covers the decision path only: that an accept/reject writes conditionally on
 * the invoice still being PENDING, and that a caller who loses the race is
 * told so instead of silently overwriting the winner.
 *
 * The service is constructed directly with fakes rather than through the Nest
 * testing module — the decision path touches Prisma and the notifier only, so
 * a container would add setup without adding coverage.
 */
describe("InvoicesService decisions", () => {
  const invoice = {
    id: "inv-1",
    status: "PENDING",
    invoiceNumber: "INV-2026-000042",
    createdById: "mechanic-1",
    decidedById: "manager-1",
    decidedAt: new Date("2026-07-21T09:00:00Z"),
    rejectionReason: null,
    // Prisma returns a Decimal; a string satisfies the .toString() the
    // template calls without dragging the Decimal runtime into a unit test.
    amount: "1500.00",
    vehicle: { id: "veh-1", plateNumber: "ABC-1234", name: null },
  };

  function build(updateManyCounts: number[], found: Record<string, unknown> = invoice) {
    const counts = [...updateManyCounts];
    const prisma = {
      invoice: {
        // Typed with its argument so the assertions below can read back the
        // recorded call; a zero-arg jest.fn() records an empty tuple.
        updateMany: jest.fn(async (_args: { data: Record<string, unknown> }) => ({
          count: counts.shift() ?? 0,
        })),
        findFirst: jest.fn(async () => found),
      },
      user: { findUnique: jest.fn(async () => ({ firstName: "سالم", lastName: "المدير" })) },
    };
    const notifications = { notify: jest.fn(async () => undefined) };
    const config = { get: jest.fn(() => "https://mica.example.com") };
    const tokens = {
      issue: jest.fn(async () => "tok"),
      peek: jest.fn(async () => ({ invoiceId: "inv-1", userId: "manager-1" })),
      consume: jest.fn(async () => true),
      revokeForInvoice: jest.fn(async () => undefined),
    };
    const service = new InvoicesService(
      prisma as never,
      {} as never,
      {} as never,
      notifications as never,
      config as never,
      tokens as never,
    );
    return { service, prisma, notifications, tokens };
  }

  it("accepts an invoice that is still pending", async () => {
    const { service, prisma, notifications } = build([1]);

    const result = await service.accept("inv-1", {} as never, "manager-1");

    expect(result.id).toBe("inv-1");
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    // The guard must live in the WHERE clause, not in a separate read.
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", status: "PENDING" }),
      }),
    );
  });

  it("records who decided and when", async () => {
    const { service, prisma } = build([1]);

    await service.accept("inv-1", {} as never, "manager-1");

    const [{ data }] = prisma.invoice.updateMany.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(data.decidedById).toBe("manager-1");
    expect(data.decidedAt).toBeInstanceOf(Date);
    expect(data.status).toBe("ACCEPTED");
  });

  it("rejects with the supplied reason", async () => {
    const { service, prisma } = build([1]);

    await service.reject("inv-1", { rejectionReason: "المبلغ غير مطابق" } as never, "manager-1");

    const [{ data }] = prisma.invoice.updateMany.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(data.status).toBe("REJECTED");
    expect(data.rejectionReason).toBe("المبلغ غير مطابق");
  });

  it("refuses a second decision on an already-decided invoice", async () => {
    const { service, notifications } = build([0], { ...invoice, status: "ACCEPTED" });

    await expect(service.accept("inv-1", {} as never, "manager-2")).rejects.toBeInstanceOf(
      ConflictException,
    );
    // The mechanic must not receive a second, contradicting email.
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  describe("deciding from an email link", () => {
    it("spends the token before touching the invoice", async () => {
      const { service, tokens, prisma } = build([1]);

      await service.decideFromToken("tok", { decision: "approve" }, "manager-1");

      // If the invoice were written first, a double-submitted form could
      // decide twice before either consume returned.
      const consumeOrder = tokens.consume.mock.invocationCallOrder[0] ?? Infinity;
      const updateOrder = prisma.invoice.updateMany.mock.invocationCallOrder[0] ?? -1;
      expect(consumeOrder).toBeLessThan(updateOrder);
    });

    it("refuses a token that was already spent", async () => {
      const { service, tokens, prisma } = build([1]);
      tokens.consume.mockResolvedValueOnce(false);

      await expect(
        service.decideFromToken("tok", { decision: "approve" }, "manager-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it("refuses an expired token without deciding", async () => {
      const { service, tokens, prisma } = build([1]);
      tokens.peek.mockResolvedValueOnce("expired" as never);

      await expect(
        service.decideFromToken("tok", { decision: "approve" }, "manager-1"),
      ).rejects.toThrow(/انتهت صلاحية/);
      expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    });

    it("retires the other managers' links once decided", async () => {
      const { service, tokens } = build([1]);

      await service.decideFromToken("tok", { decision: "approve" }, "manager-1");

      expect(tokens.revokeForInvoice).toHaveBeenCalledWith("inv-1");
    });

    it("goes through the same reject path, reason included", async () => {
      const { service, prisma } = build([1]);

      await service.decideFromToken(
        "tok",
        { decision: "reject", rejectionReason: "المبلغ غير مطابق" },
        "manager-1",
      );

      const [{ data }] = prisma.invoice.updateMany.mock.calls[0] as unknown as [
        { data: Record<string, unknown> },
      ];
      expect(data.status).toBe("REJECTED");
      expect(data.rejectionReason).toBe("المبلغ غير مطابق");
    });
  });

  it("lets exactly one of two concurrent managers win", async () => {
    // Both callers see PENDING; the database matches one row and zero rows.
    const { service, notifications } = build([1, 0], invoice);

    const results = await Promise.allSettled([
      service.accept("inv-1", {} as never, "manager-1"),
      service.reject("inv-1", { rejectionReason: "مكررة" } as never, "manager-2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});
