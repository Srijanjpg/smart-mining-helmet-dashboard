// Keep in sync with backend/server.js:evaluateAlerts and
// backend/database/queries.js:determinHazardLevel.
//
// h2s is a discrete state from the Fermion MEMS sensor, not a ppm value:
//   0 = clear, 1 = warning, 2 = danger.
//
// ch4 is compared with >= rather than >, because the MQ-4 saturates at 1.0 %
// vol -- exactly its danger threshold -- and the firmware clamps there. See
// getSensorLevel in status.js.
//
// co warns from >2 ppm. evaluateAlerts splits the warning band into three
// messages (>2 detected, >10 increasing, >20 high), but all three are the same
// severity, so the boundary here is the lowest of them.
export const THRESHOLDS = {
  oxygen: { warning: 20.0, danger: 19.5, lowIsBad: true },
  co2: { warning: 1600, danger: 3500, lowIsBad: false },
  co: { warning: 2, danger: 35, lowIsBad: false },
  ch4: { warning: 0.5, danger: 1.0, lowIsBad: false },
  h2s: { warning: 1, danger: 2, lowIsBad: false }
};
