import { invoke } from '@tauri-apps/api/core';
import { getSetting, logSearchFailure } from '../data/db.js';

// Simple in-memory search cache & log
const searchCache = new Map();
let searchLogs = [];

/**
 * Search Service Layer
 * Handles live Serper API calls, measures response time, caching,
 * image-model validation warnings, and logs all network traffic.
 */
export const SearchService = {
  /**
   * Performs a web search with full telemetry logging, caching, and model verification.
   * @param {string} query The search term
   * @param {boolean} forceLive Bypass cache and perform a live API network request
   */
  async performSearch(query, forceLive = false) {
    const serperKey = await getSetting("serper_api_key");
    const exaKey = await getSetting("exa_api_key");
    console.log("[SearchService] Serper key exists:", !!serperKey, "Length:", serperKey?.length);
    console.log("[SearchService] Exa key exists:", !!exaKey, "Length:", exaKey?.length);

    const startTime = Date.now();
    const cleanQuery = query ? query.trim() : '';

    if (!cleanQuery) {
      return {
        status: 'Training Data',
        results: [],
        responseTime: 0,
        timestamp: new Date().toLocaleTimeString(),
        sourceUrl: 'N/A',
        warning: null
      };
    }

    // 1. Check Cache first (if not forcing fresh search)
    if (!forceLive && searchCache.has(cleanQuery)) {
      const cached = searchCache.get(cleanQuery);
      console.log(`[SearchService] Cache HIT for query: "${cleanQuery}"`);
      
      const logEntry = {
        id: crypto.randomUUID(),
        query: cleanQuery,
        status: 'Cached',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString(),
        results: cached.results,
        sourceUrl: cached.results[0]?.link || 'Cached',
        warning: cached.warning
      };
      searchLogs.unshift(logEntry);
      
      return logEntry;
    }

    console.log(`[SearchService] Live API Search initiated: "${cleanQuery}"`);
    let rawResult = null;
    let status = 'Live Search';
    let apiError = null;

    try {
      const apiKey = await getSetting('serper_api_key') || '';
      
      // Perform live Tauri serper_search invoke
      rawResult = await invoke('serper_search', { query: cleanQuery, apiKey });
      console.log(`[SearchService] Serper response:`, rawResult);

      if (!rawResult || !rawResult.organic || rawResult.organic.length === 0) {
        // Fallback to simplified query or EXA
        console.warn(`[SearchService] Serper search empty, attempting simplified fallback`);
        const simpleQuery = cleanQuery.split(' ').slice(0, 3).join(' ');
        rawResult = await invoke('serper_search', { query: simpleQuery, apiKey });
      }
    } catch (err) {
      console.error(`[SearchService] Serper network call failed:`, err);
      apiError = err.message || String(err);
      status = 'Training Data'; // LLM fallback status
    }

    const responseTime = Date.now() - startTime;
    const timestamp = new Date().toLocaleTimeString();

    // Parse organic results
    let parsedResults = [];
    let sourceUrl = 'N/A';

    if (rawResult && rawResult.organic && rawResult.organic.length > 0) {
      parsedResults = rawResult.organic.slice(0, 5).map((r, idx) => ({
        id: idx + 1,
        title: r.title || 'Untitled',
        link: r.link || '',
        date: r.date || 'N/A',
        snippet: r.snippet || 'No snippet content available.'
      }));
      sourceUrl = parsedResults[0]?.link || 'N/A';
    } else {
      // If live search returned nothing or errored, log the search failure to DB
      await logSearchFailure(cleanQuery, apiError || 'No organic results').catch(() => {});
      status = 'Training Data';
    }

    // Check for Image-Generation / Multimodal non-text LLM models
    let warning = null;
    const contentString = JSON.stringify(parsedResults).toLowerCase() + ' ' + cleanQuery.toLowerCase();
    if (contentString.includes('dall-e') || contentString.includes('stable diffusion') || contentString.includes('midjourney')) {
      warning = '⚠️ Note: Some returned entries are image/multimodal models, not pure text LLMs.';
    }

    const logEntry = {
      id: crypto.randomUUID(),
      query: cleanQuery,
      status,
      responseTime,
      timestamp,
      results: parsedResults,
      sourceUrl,
      warning
    };

    // Cache the successful search result
    if (status === 'Live Search' && parsedResults.length > 0) {
      searchCache.set(cleanQuery, { results: parsedResults, warning });
    }

    // Network Tab telemetry log to console
    console.group(`📡 [Network Telemetry] Search: "${cleanQuery}"`);
    console.log(`Status: %c${status}`, `color: ${status === 'Live Search' ? '#10B981' : status === 'Cached' ? '#F59E0B' : '#EF4444'}; font-weight: bold;`);
    console.log(`Latency: ${responseTime}ms`);
    console.log(`Source URL: ${sourceUrl}`);
    console.log(`Results Found: ${parsedResults.length}`);
    if (warning) console.warn(warning);
    console.groupEnd();

    searchLogs.unshift(logEntry);
    if (searchLogs.length > 50) searchLogs = searchLogs.slice(0, 50);

    return logEntry;
  },

  /**
   * Returns all recorded search telemetry logs
   */
  getSearchLogs() {
    return searchLogs;
  },

  /**
   * Clears all in-memory search caches
   */
  clearCache() {
    searchCache.clear();
    searchLogs = [];
    console.log(`[SearchService] Cache and telemetry logs cleared.`);
  }
};
