/**
 * Základní třída chyb HTTP se stavovým kódem.
 * Vyhoďte to z obslužných rutin směrování, abyste odeslali konkrétní chyby HTTP.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Konstruktéři pohodlí
export const BadRequestError = (msg: string) => new HttpError(400, msg);
export const UnauthorizedError = (msg: string) => new HttpError(401, msg);
export const ForbiddenError = (msg: string) => new HttpError(403, msg);
export const NotFoundError = (msg: string) => new HttpError(404, msg);
