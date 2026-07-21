export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Set for images referenced by `cid:` in the HTML body. */
  cid?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResult {
  /** Provider's handle for the accepted message, when it returns one. */
  messageId?: string;
}

/**
 * A way to get a message out of the building.
 *
 * Exists because the transport is not a settled decision: SMTP was the only
 * option when MICA was built, and Microsoft has since disabled basic
 * authentication for it, which is not the last such change anyone will make.
 * Keeping the seam here means swapping transports is a config change rather
 * than a rewrite of everything that sends mail.
 */
export interface EmailProvider {
  /** Named in logs so an operator can see which transport actually ran. */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
