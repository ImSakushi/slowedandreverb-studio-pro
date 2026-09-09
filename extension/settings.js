export const DEFAULTS = Object.freeze({ speed: 0.85, preservePitch: false, pitch: 0, reverb: 0.25, decay: 2.8, bass: 0, volume: 1 });
const bounds = { speed: [0.25, 2], pitch: [-12, 12], reverb: [0, 1], decay: [0.3, 8], bass: [0, 18], volume: [0, 1.5] };
export function normalize(input = {}) {
  const result = { ...DEFAULTS };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = input?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = Math.min(max, Math.max(min, value));
  }
  result.preservePitch = typeof input?.preservePitch === 'boolean' ? input.preservePitch : DEFAULTS.preservePitch;
  return result;
}
export const FACTORY_PRESETS = [
  { name: 'Late hours', settings: { ...DEFAULTS } },
  { name: 'Wide room', settings: { ...DEFAULTS, speed: 1, reverb: 0.4, decay: 4.2 } },
  { name: 'Low orbit', settings: { ...DEFAULTS, speed: 0.75, bass: 4, reverb: 0.32 } },
  { name: 'Original', settings: { ...DEFAULTS, speed: 1, reverb: 0 } }
];
