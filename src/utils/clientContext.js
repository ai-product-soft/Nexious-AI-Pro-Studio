import { getDb } from '../data/db.js';

export async function getClientProfile(projectId) {
  const db = await getDb();
  const rows = await db.select('SELECT * FROM client_context WHERE project_id = ?', [projectId]);
  return rows[0] || null;
}

export async function saveClientProfile(projectId, clientName, details = {}) {
  const db = await getDb();
  const existing = await db.select('SELECT id FROM client_context WHERE project_id = ?', [projectId]);
  
  const profile = details.profile || `${clientName} in the digital domain.`;
  const constraints = details.constraints || 'None specified.';
  const preferences = details.preferences || 'Standard UI styling.';

  if (existing.length > 0) {
    await db.execute(`
      UPDATE client_context 
      SET client_name = ?, business_profile = ?, constraints = ?, custom_preferences = ?, updated_at = datetime('now')
      WHERE project_id = ?
    `, [clientName, profile, constraints, preferences, projectId]);
  } else {
    await db.execute(`
      INSERT INTO client_context (id, project_id, client_name, business_profile, constraints, custom_preferences)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [crypto.randomUUID(), projectId, clientName, profile, constraints, preferences]);
  }
}
