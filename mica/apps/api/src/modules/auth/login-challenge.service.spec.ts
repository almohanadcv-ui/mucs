import { createHash } from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import { LoginChallengeService } from "./login-challenge.service";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("LoginChallengeService", () => {
  function build(row: Record<string, unknown> | null, updateManyCount = 1) {
    const prisma = {
      loginChallenge: {
        create: jest.fn(async (_a: { data: Record<string, unknown> }) => ({ id: "c1" })),
        findUnique: jest.fn(async () => row),
        update: jest.fn(async (_a: unknown) => ({})),
        updateMany: jest.fn(async (_a: unknown) => ({ count: updateManyCount })),
      },
    };
    return { service: new LoginChallengeService(prisma as never), prisma };
  }

  const live = {
    userId: "u1",
    codeHash: sha("123456"),
    rememberMe: true,
    deviceLabel: null,
    attempts: 0,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  describe("issue", () => {
    it("returns a six-digit code and stores only its hash", async () => {
      const { service, prisma } = build(null);

      const { code } = await service.issue("u1", { rememberMe: false });

      expect(code).toMatch(/^\d{6}$/);
      const [{ data }] = prisma.loginChallenge.create.mock.calls[0] as unknown as [
        { data: { codeHash: string } },
      ];
      expect(data.codeHash).toBe(sha(code));
      expect(data.codeHash).not.toBe(code);
    });

    it("retires any earlier pending challenge", async () => {
      // Otherwise an old email still works after the user, suspecting
      // something, asked for a fresh code.
      const { service, prisma } = build(null);

      await service.issue("u1", { rememberMe: false });

      expect(prisma.loginChallenge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1", consumedAt: null } }),
      );
    });

    it("carries the remember-me choice to the second step", async () => {
      const { service, prisma } = build(null);

      await service.issue("u1", { rememberMe: true });

      const [{ data }] = prisma.loginChallenge.create.mock.calls[0] as unknown as [
        { data: { rememberMe: boolean } },
      ];
      expect(data.rememberMe).toBe(true);
    });
  });

  describe("verify", () => {
    it("accepts the right code and reports who it belongs to", async () => {
      const { service } = build(live);
      await expect(service.verify("c1", "123456")).resolves.toMatchObject({
        userId: "u1",
        rememberMe: true,
      });
    });

    it("counts a wrong code against the challenge", async () => {
      const { service, prisma } = build(live);

      await expect(service.verify("c1", "000000")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.loginChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
    });

    it("refuses an exhausted challenge", async () => {
      const { service } = build({ ...live, attempts: 5 });
      await expect(service.verify("c1", "123456")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuses an expired code", async () => {
      const { service } = build({ ...live, expiresAt: new Date(Date.now() - 1) });
      await expect(service.verify("c1", "123456")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("refuses a code already spent", async () => {
      const { service } = build({ ...live, consumedAt: new Date() });
      await expect(service.verify("c1", "123456")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("lets only one of two simultaneous verifications through", async () => {
      // updateMany matched nothing: another request consumed it first.
      const { service } = build(live, 0);
      await expect(service.verify("c1", "123456")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("says the same thing however it fails", async () => {
      // Distinguishing "no such challenge" from "wrong code" would tell an
      // attacker which half to keep working on.
      const messages: string[] = [];
      for (const row of [null, { ...live, consumedAt: new Date() }, live]) {
        const { service } = build(row);
        await service.verify("c1", "999999").catch((e: Error) => messages.push(e.message));
      }
      expect(new Set(messages).size).toBe(1);
    });
  });
});
