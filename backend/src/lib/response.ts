export function successResponse(data: unknown) {
  return { success: true, data, timestamp: new Date().toISOString() };
}

export function errorResponse(message: string, code?: number) {
  return {
    success: false,
    error: { message, code },
    timestamp: new Date().toISOString(),
  };
}
