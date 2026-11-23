/** Throw from any route to send a JSON error with this status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (why = 'You do not have access to this') => new HttpError(403, why);
export const badRequest = (why: string, details?: unknown) => new HttpError(400, why, details);
