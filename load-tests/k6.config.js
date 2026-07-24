// load-tests/k6.config.js
// Shared thresholds and default options imported by every scenario.
// Each scenario may override options — these are sane defaults.

/**
 * Pass/fail gates applied to every scenario that imports this config.
 * k6 will exit with code 99 if any threshold is breached (useful for CI).
 *
 * Thresholds reference:
 *   http_req_duration  — wall-clock time from request start to last byte received
 *   http_req_failed    — fraction of requests that returned a non-2xx/3xx status
 *                        (we exclude intentional 429s via tagged metrics)
 */
export const thresholds = {
  // 95% of all requests must complete within 800 ms
  http_req_duration: ["p(95)<800"],

  // 99% of requests must complete within 2 seconds
  "http_req_duration{expected_response:true}": ["p(99)<2000"],

  // Error rate must stay below 1% (429s are tagged separately — see spike test)
  http_req_failed: ["rate<0.01"],
};

/**
 * Default scenario options — override in individual scenario files as needed.
 */
export const defaultOptions = {
  thresholds,

  // Print a human-readable summary to stdout after the run
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};
