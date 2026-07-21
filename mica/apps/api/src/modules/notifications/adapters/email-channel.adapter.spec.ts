import { EmailChannelAdapter } from "./email-channel.adapter";

/**
 * Covers the two guarantees the email channel owes its callers: user-typed
 * text cannot become markup in someone's inbox, and announcing the same
 * business event twice does not send two emails.
 */
describe("EmailChannelAdapter", () => {
  function build(createBehaviour: "ok" | "duplicate" = "ok", user: unknown = { id: "u1", email: "m@example.com" }) {
    const prisma = {
      user: { findUnique: jest.fn(async () => user) },
      notification: {
        create: jest.fn(async () => {
          if (createBehaviour === "duplicate") {
            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
          }
          return { id: "n1" };
        }),
      },
    };
    const queue = { add: jest.fn(async () => undefined) };
    const adapter = new EmailChannelAdapter(prisma as never, queue as never);
    return { adapter, prisma, queue };
  }

  const base = {
    recipientId: "u1",
    type: "invoice.rejected",
    title: "تم رفض فاتورتك",
    body: "السبب: مبلغ غير مطابق",
  };

  it("escapes markup coming from user-typed text", async () => {
    const { adapter, queue } = build();

    await adapter.send({ ...base, body: 'السبب: <img src=x onerror="alert(1)">' });

    // add() is called as add("send", data) — the payload is the second argument.
    const [[, job]] = queue.add.mock.calls as unknown as [[string, { html: string }]];
    expect(job.html).not.toContain("<img");
    expect(job.html).toContain("&lt;img");
  });

  it("queues exactly one job for a new event", async () => {
    const { adapter, queue } = build();

    await adapter.send({ ...base, idempotencyKey: "MICA_INVOICE_ACCEPTED:inv-1" });

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it("scopes the idempotency key per recipient so a fan-out still reaches everyone", async () => {
    const { adapter, prisma } = build();

    await adapter.send({ ...base, idempotencyKey: "MICA_INVOICE_SUBMITTED:inv-1" });

    const [[args]] = prisma.notification.create.mock.calls as unknown as [
      [{ data: { idempotencyKey?: string } }],
    ];
    expect(args.data.idempotencyKey).toBe("MICA_INVOICE_SUBMITTED:inv-1:u1");
  });

  it("sends nothing when the same event is announced twice", async () => {
    const { adapter, queue } = build("duplicate");

    await adapter.send({ ...base, idempotencyKey: "MICA_INVOICE_ACCEPTED:inv-1" });

    // The unique constraint tripped, so no second email may be queued.
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("propagates failures that are not duplicates", async () => {
    const prisma = {
      user: { findUnique: jest.fn(async () => ({ id: "u1", email: "m@example.com" })) },
      notification: {
        create: jest.fn(async () => {
          throw new Error("connection lost");
        }),
      },
    };
    const adapter = new EmailChannelAdapter(prisma as never, { add: jest.fn() } as never);

    await expect(adapter.send(base)).rejects.toThrow("connection lost");
  });

  it("skips a recipient with no address instead of queueing an undeliverable job", async () => {
    const { adapter, queue } = build("ok", { id: "u1", email: null });

    await adapter.send(base);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
