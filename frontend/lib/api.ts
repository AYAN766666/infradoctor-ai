const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://infradoctor-backend.vercel.app"

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
