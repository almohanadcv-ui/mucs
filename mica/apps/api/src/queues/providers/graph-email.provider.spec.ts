import { GraphEmailProvider } from "./graph-email.provider";

describe("GraphEmailProvider", () => {
  const settings: Record<string, string> = {
    "mail.graph.tenantId": "tenant-1",
    "mail.graph.clientId": "client-1",
    "mail.graph.clientSecret": "secret-1",
    "mail.graph.from": "no-reply@example.com",
  };

  function build(overrides: Record<string, string | undefined> = {}) {
    const config = { get: jest.fn((k: string) => ({ ...settings, ...overrides })[k]) };
    return new GraphEmailProvider(config as never);
  }

  const ok = (body: unknown = {}) =>
    ({ ok: true, json: async () => body, text: async () => "" }) as Response;

  const message = { to: "m@example.com", subject: "s", html: "<p>hi</p>" };

  afterEach(() => jest.restoreAllMocks());

  it("exchanges the client secret for a token, then sends", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(ok());

    await build().send(message);

    const [tokenUrl] = fetchMock.mock.calls[0] as [string];
    expect(tokenUrl).toContain("login.microsoftonline.com/tenant-1");
    const [sendUrl] = fetchMock.mock.calls[1] as [string];
    expect(sendUrl).toContain("/users/no-reply%40example.com/sendMail");
  });

  it("reuses a live token instead of re-authenticating per message", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValue(ok());

    const provider = build();
    await provider.send(message);
    await provider.send(message);

    // One token call, two sends.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not keep a copy in the sending mailbox", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(ok());

    await build().send(message);

    const body = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[1][1] as { body: string }).body,
    );
    expect(body.saveToSentItems).toBe(false);
  });

  it("marks a cid attachment inline so the logo renders in the header", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(ok());

    await build().send({
      ...message,
      attachments: [
        {
          filename: "mab-logo.png",
          content: Buffer.from("png"),
          contentType: "image/png",
          cid: "mab-logo",
        },
      ],
    });

    const body = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[1][1] as { body: string }).body,
    );
    expect(body.message.attachments[0].isInline).toBe(true);
    expect(body.message.attachments[0].contentId).toBe("mab-logo");
  });

  it("names the missing setting rather than failing obscurely", async () => {
    await expect(build({ "mail.graph.clientSecret": undefined }).send(message)).rejects.toThrow(
      /GRAPH_CLIENT_SECRET/,
    );
  });

  it("surfaces the tenant's reason when the token is refused", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "AADSTS7000215: Invalid client secret provided",
    } as Response);

    // An expired secret is the most likely cause of a sudden outage, and it is
    // only diagnosable if the message survives.
    await expect(build().send(message)).rejects.toThrow(/Invalid client secret/);
  });

  it("refreshes a stale token once when the send is refused", async () => {
    // The token was issued before an admin granted Mail.Send, so it carries no
    // such role. Without this, the first send after a permission change fails
    // until someone restarts the server.
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "stale", expires_in: 3600 }))
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "denied" } as Response)
      .mockResolvedValueOnce(ok({ access_token: "fresh", expires_in: 3600 }))
      .mockResolvedValueOnce(ok());

    await expect(build().send(message)).resolves.toEqual({});

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [, sendOptions] = fetchMock.mock.calls[3] as [string, { headers: Record<string, string> }];
    expect(sendOptions.headers.Authorization).toBe("Bearer fresh");
  });

  it("gives up after one retry rather than looping", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "t1", expires_in: 3600 }))
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "denied" } as Response)
      .mockResolvedValueOnce(ok({ access_token: "t2", expires_in: 3600 }))
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "denied" } as Response);

    await expect(build().send(message)).rejects.toThrow(/403/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry a 401, which means the credentials are wrong", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "t", expires_in: 3600 }))
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "bad" } as Response);

    await expect(build().send(message)).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a rejected send", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(ok({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "ErrorInvalidRecipients",
      } as Response);

    // 400 is the message's fault, not the token's, so it fails straight away.
    await expect(build().send(message)).rejects.toThrow(/400.*ErrorInvalidRecipients/);
  });
});
