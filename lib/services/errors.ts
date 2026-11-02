export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = "bad_request",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const forbidden = (m = "You are not allowed to do that.") => new ServiceError(m, 403, "forbidden");
export const notFound = (m = "Not found.") => new ServiceError(m, 404, "not_found");
export const conflict = (m: string) => new ServiceError(m, 409, "conflict");
