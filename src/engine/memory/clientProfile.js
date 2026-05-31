/**
 * Client Profile
 * Deep client modeling with preferences, history, and pattern detection.
 */

export class ClientProfile {
  constructor(db) {
    this.db = db;
  }

  async create(client) {
    const id = client.id || `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.db.execute(
      `INSERT INTO clients (id, name, business, budget, preferences, history, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        client.name,
        client.business || '',
        client.budget || 0,
        JSON.stringify(client.preferences || {}),
        JSON.stringify(client.history || []),
        Date.now(),
        Date.now()
      ]
    );
    return { id, ...client };
  }

  async update(id, updates) {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Client not found: ${id}`);

    const merged = {
      ...existing,
      ...updates,
      preferences: { ...existing.preferences, ...(updates.preferences || {}) },
      history: [...(existing.history || []), ...(updates.history || [])]
    };

    await this.db.execute(
      `UPDATE clients SET
       name = ?, business = ?, budget = ?, preferences = ?, history = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.name,
        merged.business,
        merged.budget,
        JSON.stringify(merged.preferences),
        JSON.stringify(merged.history),
        Date.now(),
        id
      ]
    );

    return merged;
  }

  async getById(id) {
    const rows = await this.db.select('SELECT * FROM clients WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return this.hydrate(rows[0]);
  }

  async getByName(name) {
    const rows = await this.db.select(
      'SELECT * FROM clients WHERE name LIKE ?',
      [`%${name}%`]
    );
    return rows.map(r => this.hydrate(r));
  }

  async getHistory(id) {
    const client = await this.getById(id);
    return client ? client.history : [];
  }

  async detectPattern(id) {
    const history = await this.getHistory(id);
    if (history.length < 3) return null;

    // Simple pattern detection: most frequent product type, domain, budget range
    const types = {};
    const domains = {};
    let totalBudget = 0;

    history.forEach(h => {
      types[h.productType] = (types[h.productType] || 0) + 1;
      domains[h.domain] = (domains[h.domain] || 0) + 1;
      totalBudget += h.budget || 0;
    });

    const avgBudget = totalBudget / history.length;

    return {
      preferredType: this.getMaxKey(types),
      preferredDomain: this.getMaxKey(domains),
      averageBudget: Math.round(avgBudget),
      projectCount: history.length,
      budgetTrend: this.calculateTrend(history.map(h => h.budget || 0))
    };
  }

  getMaxKey(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    const first = values[0];
    const last = values[values.length - 1];
    const diff = last - first;
    if (diff > first * 0.2) return 'increasing';
    if (diff < -first * 0.2) return 'decreasing';
    return 'stable';
  }

  hydrate(row) {
    return {
      id: row.id,
      name: row.name,
      business: row.business,
      budget: row.budget,
      preferences: this.safeJsonParse(row.preferences, {}),
      history: this.safeJsonParse(row.history, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  safeJsonParse(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }
}

export default ClientProfile;
