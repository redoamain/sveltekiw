// Helper respons untuk Astro API endpoints.
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

// Helper untuk mendapatkan pilihan database dari Astro context
export const isBackupDb = (locals: Record<string, unknown>): boolean =>
  locals.dbSource === "backup";
