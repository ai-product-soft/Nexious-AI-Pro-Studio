// dateFormatter.js — Timezone calibration utility for Mabishion AI v4.0
// Bypasses isolated webview container limits by reading real Host OS timezone offset via Rust.

import { invoke } from '@tauri-apps/api/core';

let systemOffsetMinutes = null;
let systemOffsetFetched = false;

/**
 * Proactively fetches system time information from Rust.
 * Fits into Rs. 0 high-speed offline local execution model.
 */
export async function fetchSystemTimeInfo() {
  if (systemOffsetFetched) return systemOffsetMinutes;
  try {
    if (window.__TAURI_INTERNALS__) {
      const info = await invoke('get_system_time_info');
      systemOffsetMinutes = info.offset_minutes;
      console.log("[dateFormatter] Timezone calibrated from Host OS (offset minutes):", systemOffsetMinutes);
    } else {
      // Browser preview fallback
      systemOffsetMinutes = -new Date().getTimezoneOffset();
    }
  } catch (err) {
    console.warn("[dateFormatter] Rust get_system_time_info failed, fallback to browser offset:", err);
    systemOffsetMinutes = -new Date().getTimezoneOffset();
  }
  systemOffsetFetched = true;
  return systemOffsetMinutes;
}

/**
 * Returns the cached Host OS offset or fallback local offset.
 */
export function getCalibratedOffset() {
  return systemOffsetMinutes !== null ? systemOffsetMinutes : -new Date().getTimezoneOffset();
}

/**
 * Converts standard SQLite UTC timestamps to Host OS local time string (12-hour format with AM/PM).
 * Example database input: "2026-05-27 11:27:04"
 */
export function formatLocalTime(ts, options = {}) {
  if (!ts) return '';
  try {
    // 1. Convert SQLite raw string to standard ISO format
    const isoStr = ts.includes('T') || ts.includes('Z') ? ts : ts.replace(' ', 'T') + 'Z';
    const dateObj = new Date(isoStr);
    
    if (isNaN(dateObj.getTime())) return ts;

    // 2. Adjust for timezone offset gap
    const rustOffset = getCalibratedOffset(); // minutes (e.g. +330 for IST)
    const browserOffset = -dateObj.getTimezoneOffset(); // minutes (e.g. 0 if UTC, +330 if IST)
    const gapMinutes = rustOffset - browserOffset;

    const correctedDate = new Date(dateObj.getTime() + (gapMinutes * 60 * 1000));
    
    // 3. Format output beautifully
    const formatOpts = {
      hour: '2-digit',
      minute: '2-digit',
      second: options.showSeconds ? '2-digit' : undefined,
      hour12: true,
      ...options
    };
    return correctedDate.toLocaleTimeString([], formatOpts);
  } catch (e) {
    console.error("[dateFormatter] formatLocalTime error:", e);
    return ts;
  }
}

/**
 * Converts standard SQLite UTC timestamps to Host OS local date string.
 */
export function formatLocalDate(ts, options = {}) {
  if (!ts) return '';
  try {
    const isoStr = ts.includes('T') || ts.includes('Z') ? ts : ts.replace(' ', 'T') + 'Z';
    const dateObj = new Date(isoStr);
    
    if (isNaN(dateObj.getTime())) return ts;

    const rustOffset = getCalibratedOffset();
    const browserOffset = -dateObj.getTimezoneOffset();
    const gapMinutes = rustOffset - browserOffset;

    const correctedDate = new Date(dateObj.getTime() + (gapMinutes * 60 * 1000));
    
    return correctedDate.toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  } catch (e) {
    console.error("[dateFormatter] formatLocalDate error:", e);
    return ts;
  }
}

// Auto-trigger calibration at module load time
fetchSystemTimeInfo().catch(err => console.warn("[dateFormatter] Auto-trigger calibration failed:", err));
