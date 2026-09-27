// ============================================================
// HTTP CLIENT SERVICE — Booking Service
// Handles synchronous inter-service HTTP communication
// Features: timeout, retry, meaningful error messages
// ============================================================
const axios = require('axios');

const TIMEOUT_MS = 5000;  // 5 second timeout
const MAX_RETRIES = 2;    // Up to 2 retries for safe operations

/**
 * Single HTTP call with timeout.
 * Throws a structured error object on failure.
 */
async function callService(url, method = 'GET', data = null, serviceName = 'Service') {
  try {
    const config = {
      method,
      url,
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) config.data = data;

    const response = await axios(config);
    return response;
  } catch (err) {
    // Timeout error
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      const error = new Error(`${serviceName} timeout after ${TIMEOUT_MS}ms`);
      error.status = 504;
      throw error;
    }
    // Service unavailable
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      const error = new Error(`${serviceName} is unavailable (connection refused)`);
      error.status = 503;
      throw error;
    }
    // HTTP error response from service
    if (err.response) {
      const msg = err.response.data?.message || `${serviceName} returned ${err.response.status}`;
      const error = new Error(msg);
      error.status = err.response.status;
      throw error;
    }
    // Generic
    const error = new Error(`${serviceName} error: ${err.message}`);
    error.status = 502;
    throw error;
  }
}

/**
 * HTTP call with retry logic (for safe read operations only).
 * Do NOT use for mutations that can cause duplicate side effects.
 */
async function callServiceWithRetry(url, method = 'GET', data = null, serviceName = 'Service') {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      console.log(`[BOOKING SERVICE] Attempt ${attempt} → ${method} ${url}`);
      const response = await callService(url, method, data, serviceName);
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`[BOOKING SERVICE] Attempt ${attempt} failed: ${err.message}`);
      // Don't retry on 4xx client errors (not found, unauthorized, etc.)
      if (err.status >= 400 && err.status < 500) {
        throw err;
      }
      // Don't retry on the last attempt
      if (attempt <= MAX_RETRIES) {
        console.log(`[BOOKING SERVICE] Retrying in 500ms...`);
        await sleep(500);
      }
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { callService, callServiceWithRetry };
