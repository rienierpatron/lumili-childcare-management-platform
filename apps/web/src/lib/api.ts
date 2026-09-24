const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:30001'

export async function apiFetch<T> (
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `API request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}
