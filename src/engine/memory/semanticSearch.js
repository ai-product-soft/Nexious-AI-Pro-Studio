/**
 * Semantic Search
 * Offline keyword-based search using SQLite.
 * No external ML or embedding libraries. Uses LIKE matching with relevance scoring.
 */

const STOP_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one','our',
  'out','day','get','has','him','his','how','its','may','new','now','old','see','two',
  'way','who','boy','did','she','use','too','any','say','man','try','ask','end','why',
  'let','put','own','tell','very','when','much','would','there','their','what','said',
  'each','which','will','about','could','other','after','first','never','these','think',
  'where','being','every','great','might','shall','still','those','while','this','that',
  'with','have','from','they','know','want','been','good','some','time','come','here',
  'just','like','long','make','many','over','such','take','than','them','well','were'
]);

export class SemanticSearch {
  constructor(db) {
    this.db = db;
  }

  async indexProject(project) {
    const keywords = this.extractKeywords(project);
    const searchableText = [
      project.name,
      project.description,
      project.techStack,
      project.clientName,
      ...keywords
    ].filter(Boolean).join(' ').toLowerCase();

    await this.db.execute(
      `INSERT INTO search_index (project_id, content, keywords, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
       content = excluded.content,
       keywords = excluded.keywords,
       updated_at = excluded.updated_at`,
      [project.id, searchableText, JSON.stringify(keywords), Date.now(), Date.now()]
    );
  }

  extractKeywords(project) {
    const text = [
      project.name,
      project.description,
      project.requirements,
      project.notes
    ].filter(Boolean).join(' ');

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  async search(query, options = {}) {
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.1;

    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);

    if (queryWords.length === 0) return [];

    // Build dynamic query for keyword matching
    const conditions = queryWords.map(() => 'content LIKE ?').join(' OR ');
    const params = queryWords.map(w => `%${w}%`);

    const rows = await this.db.select(
      `SELECT project_id, content, keywords FROM search_index WHERE ${conditions}`,
      params
    );

    // Score results
    const scored = rows.map(row => {
      const content = (row.content || '').toLowerCase();
      let keywords = [];
      try {
        keywords = JSON.parse(row.keywords || '[]');
      } catch {
        keywords = [];
      }

      let score = 0;
      queryWords.forEach(word => {
        // Exact word boundary match in content
        const exactPattern = new RegExp('\\b' + this.escapeRegex(word) + '\\b', 'g');
        const exactMatches = (content.match(exactPattern) || []).length;
        score += exactMatches * 2;

        // Partial match
        const partialPattern = new RegExp(this.escapeRegex(word), 'g');
        const partialMatches = (content.match(partialPattern) || []).length;
        score += partialMatches;

        // Keyword match
        if (keywords.includes(word)) score += 5;
      });

      // Normalize by content length to avoid bias toward long content
      const normalizedScore = content.length > 0 ? score / Math.sqrt(content.length) : 0;

      return {
        projectId: row.project_id,
        score: normalizedScore,
        relevance: Math.min(100, Math.round(normalizedScore * 10))
      };
    });

    return scored
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async removeProject(projectId) {
    await this.db.execute(
      'DELETE FROM search_index WHERE project_id = ?',
      [projectId]
    );
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default SemanticSearch;
