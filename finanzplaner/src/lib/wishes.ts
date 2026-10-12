export const WAIT_HOURS = 48

export function hoursSince(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 3_600_000
}

/** 48-Stunden-Regel: erst nach Ablauf der Bedenkzeit darf gekauft werden. */
export function wishStatus(createdAt: string, now: number): { allowed: boolean; hoursLeft: number; progress: number } {
  const h = Math.max(0, hoursSince(createdAt, now))
  return { allowed: h >= WAIT_HOURS, hoursLeft: Math.max(0, Math.ceil(WAIT_HOURS - h)), progress: Math.min(1, h / WAIT_HOURS) }
}
