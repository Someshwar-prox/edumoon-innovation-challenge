// Health repository — placeholder. Real persistence is intentionally
// skipped for now; the service layer records results in-memory only.
export class HealthRepository {
  async storeHealthCheck(data: {
    status: string;
    timestamp: Date;
    version: string;
    uptime: number;
    checks: Record<string, { status: string; message?: string; responseTime?: number }>;
  }): Promise<{ id: string } & typeof data> {
    return { id: Math.random().toString(36).slice(2, 11), ...data };
  }

  async getLatestHealthCheck(): Promise<null> {
    return null;
  }

  async getHealthCheckHistory(): Promise<unknown[]> {
    return [];
  }
}

export const healthRepository = new HealthRepository();
