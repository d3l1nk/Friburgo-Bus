export function errMessage(e: unknown, fallback = 'Erro desconhecido'): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  return fallback;
}
