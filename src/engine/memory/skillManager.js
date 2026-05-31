/**
 * Skill Manager
 * Tracks worker skills, learns from outcomes, and prunes weak skills.
 */

export class SkillManager {
  constructor(db) {
    this.db = db;
  }

  async recordOutcome(workerId, skillName, success, metadata = {}) {
    const existing = await this.db.select(
      'SELECT * FROM skills WHERE worker_id = ? AND skill_name = ?',
      [workerId, skillName]
    );

    if (existing.length === 0) {
      await this.db.execute(
        `INSERT INTO skills (id, worker_id, skill_name, success_count, failure_count, last_used)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`${workerId}_${skillName}`, workerId, skillName, success ? 1 : 0, success ? 0 : 1, Date.now()]
      );
    } else {
      const skill = existing[0];
      const successCount = parseInt(skill.success_count || 0) + (success ? 1 : 0);
      const failureCount = parseInt(skill.failure_count || 0) + (success ? 0 : 1);
      await this.db.execute(
        `UPDATE skills SET success_count = ?, failure_count = ?, last_used = ?
         WHERE worker_id = ? AND skill_name = ?`,
        [successCount, failureCount, Date.now(), workerId, skillName]
      );
    }

    // Update worker success rate
    await this.updateWorkerStats(workerId);
  }

  async updateWorkerStats(workerId) {
    const rows = await this.db.select(
      'SELECT success_count, failure_count FROM skills WHERE worker_id = ?',
      [workerId]
    );

    const totalSuccess = rows.reduce((sum, r) => sum + parseInt(r.success_count || 0), 0);
    const totalFailure = rows.reduce((sum, r) => sum + parseInt(r.failure_count || 0), 0);
    const total = totalSuccess + totalFailure;
    const rate = total > 0 ? totalSuccess / total : 0;

    await this.db.execute(
      'UPDATE workers SET success_rate = ?, last_run = ? WHERE id = ?',
      [rate, Date.now(), workerId]
    );
  }

  async getBestSkill(workerId, taskType) {
    const rows = await this.db.select(
      `SELECT skill_name, success_count, failure_count,
       (success_count * 1.0 / (success_count + failure_count + 0.001)) as score
       FROM skills WHERE worker_id = ? AND skill_name LIKE ?`,
      [workerId, `%${taskType}%`]
    );

    if (rows.length === 0) return null;

    return rows.sort((a, b) => parseFloat(b.score) - parseFloat(a.score))[0];
  }

  async pruneSkills(workerId, threshold = 0.3) {
    const rows = await this.db.select(
      `SELECT skill_name, success_count, failure_count,
       (success_count * 1.0 / (success_count + failure_count + 0.001)) as score
       FROM skills WHERE worker_id = ?`,
      [workerId]
    );

    const toPrune = rows.filter(r => {
      const total = parseInt(r.success_count || 0) + parseInt(r.failure_count || 0);
      return parseFloat(r.score) < threshold && total > 5;
    });

    for (const skill of toPrune) {
      await this.db.execute(
        'DELETE FROM skills WHERE worker_id = ? AND skill_name = ?',
        [workerId, skill.skill_name]
      );
    }

    return { pruned: toPrune.length, remaining: rows.length - toPrune.length };
  }

  async getSkillReport(workerId) {
    const rows = await this.db.select(
      'SELECT skill_name, success_count, failure_count FROM skills WHERE worker_id = ?',
      [workerId]
    );

    const totalSkills = rows.length;
    const strongSkills = rows.filter(r => parseInt(r.success_count || 0) > parseInt(r.failure_count || 0));

    return {
      workerId,
      totalSkills,
      strongSkills: strongSkills.length,
      weakSkills: totalSkills - strongSkills.length,
      skills: rows.map(r => ({
        name: r.skill_name,
        success: parseInt(r.success_count || 0),
        failure: parseInt(r.failure_count || 0),
        rate: parseInt(r.success_count || 0) / (parseInt(r.success_count || 0) + parseInt(r.failure_count || 0) + 0.001)
      }))
    };
  }
}

export default SkillManager;
