import { EmailProcessor } from "./email.processor";

/**
 * Covers the attachment path only: that the invoice file is fetched at send
 * time rather than carried through Redis, and that every way of failing to
 * load it still sends the message.
 */
describe("EmailProcessor attachments", () => {
  function build(invoice: Record<string, unknown> | null, read = async () => Buffer.from("pdf")) {
    const mailer = { send: jest.fn(async (_o: unknown) => ({ messageId: "m1" })) };
    const prisma = {
      invoice: { findUnique: jest.fn(async () => invoice) },
      notification: { update: jest.fn(async () => ({})) },
    };
    const storage = { read: jest.fn(read) };
    return {
      processor: new EmailProcessor(mailer as never, prisma as never, storage as never),
      mailer,
      storage,
    };
  }

  const job = (data: Record<string, unknown>) =>
    ({ id: "j1", attemptsMade: 0, opts: {}, data }) as never;

  const small = { fileKey: "k", fileName: "inv.pdf", mimeType: "application/pdf", sizeBytes: 1000 };

  it("attaches the invoice file", async () => {
    const { processor, mailer, storage } = build(small);

    await processor.process(job({ to: "a@b.c", subject: "s", html: "h", attachInvoiceId: "inv-1" }));

    expect(storage.read).toHaveBeenCalledWith("k");
    const [sent] = mailer.send.mock.calls[0] as [{ attachments?: { filename: string }[] }];
    expect(sent.attachments?.[0]?.filename).toBe("inv.pdf");
  });

  it("sends nothing extra when no invoice is named", async () => {
    const { processor, mailer, storage } = build(small);

    await processor.process(job({ to: "a@b.c", subject: "s", html: "h" }));

    expect(storage.read).not.toHaveBeenCalled();
    const [sent] = mailer.send.mock.calls[0] as [{ attachments?: unknown[] }];
    expect(sent.attachments).toBeUndefined();
  });

  it("drops an oversized file rather than failing the message", async () => {
    // Graph refuses anything over 4MB, and the approval request matters more
    // than the convenience of the attachment.
    const { processor, mailer } = build({ ...small, sizeBytes: 9_000_000 });

    await processor.process(job({ to: "a@b.c", subject: "s", html: "h", attachInvoiceId: "inv-1" }));

    expect(mailer.send).toHaveBeenCalled();
    const [sent] = mailer.send.mock.calls[0] as [{ attachments?: unknown[] }];
    expect(sent.attachments).toBeUndefined();
  });

  it("still sends when storage is unreachable", async () => {
    const { processor, mailer } = build(small, async () => {
      throw new Error("storage down");
    });

    await processor.process(job({ to: "a@b.c", subject: "s", html: "h", attachInvoiceId: "inv-1" }));

    expect(mailer.send).toHaveBeenCalled();
  });

  it("still sends when the invoice row is gone", async () => {
    const { processor, mailer } = build(null);

    await processor.process(job({ to: "a@b.c", subject: "s", html: "h", attachInvoiceId: "inv-1" }));

    expect(mailer.send).toHaveBeenCalled();
  });
});
