/**
 * Anwendungsfehler mit maschinenlesbarem Code. Das Frontend übersetzt den Code
 * in eine verständliche Meldung – technische Details gelangen nie zum Benutzer.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

export const badRequest = (code = 'bad_request', message?: string, fields?: Record<string, string>) =>
  new AppError(400, code, message, fields);
export const unauthorized = (code = 'unauthorized') => new AppError(401, code);
export const forbidden = (code = 'forbidden') => new AppError(403, code);
/** Wird auch bei fremden Ressourcen verwendet, damit deren Existenz nicht preisgegeben wird (IDOR). */
export const notFound = (code = 'not_found') => new AppError(404, code);
export const conflict = (code = 'conflict', message?: string) => new AppError(409, code, message);
export const payloadTooLarge = (code = 'file_too_large') => new AppError(413, code);
export const unsupportedMedia = (code = 'unsupported_file_type') => new AppError(415, code);
export const unavailable = (code = 'service_unavailable', message?: string) => new AppError(503, code, message);
