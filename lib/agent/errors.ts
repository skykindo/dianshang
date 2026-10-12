export class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
