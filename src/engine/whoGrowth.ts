/**
 * PediDose WHO Child Growth Reference Standard
 * Grounded in World Health Organization (WHO) Child Growth Standards
 * (0 to 10 years / 0 to 120 months) 50th percentile (median) weight data.
 *
 * SPECIFICATION RULE:
 * - Clearly label any weight estimate as an estimate.
 * - Never present estimated weight as measured weight.
 * - Do not use estimated weight to generate a definitive medication dose.
 * - Always prioritize actual measured weight.
 */

export interface WhoWeightEstimate {
  ageInMonths: number;
  sex: 'male' | 'female';
  medianWeightKg: number;
  p15WeightKg: number;
  p85WeightKg: number;
  isEstimate: true;
  label: string;
  clinicalDisclaimer: string;
}

export interface WhoChartPoint {
  months: number;
  ageDisplay: string;
  maleMedian: number;
  maleMinus2sd: number;
  malePlus2sd: number;
  femaleMedian: number;
  femaleMinus2sd: number;
  femalePlus2sd: number;
}

export function getWhoReferenceTable(): WhoChartPoint[] {
  return [
    { months: 0, ageDisplay: 'Birth', maleMedian: 3.3, maleMinus2sd: 2.5, malePlus2sd: 4.4, femaleMedian: 3.2, femaleMinus2sd: 2.4, femalePlus2sd: 4.2 },
    { months: 1, ageDisplay: '1 month', maleMedian: 4.5, maleMinus2sd: 3.4, malePlus2sd: 5.8, femaleMedian: 4.2, femaleMinus2sd: 3.2, femalePlus2sd: 5.5 },
    { months: 2, ageDisplay: '2 months', maleMedian: 5.6, maleMinus2sd: 4.3, malePlus2sd: 7.1, femaleMedian: 5.1, femaleMinus2sd: 3.9, femalePlus2sd: 6.6 },
    { months: 3, ageDisplay: '3 months', maleMedian: 6.4, maleMinus2sd: 5.0, malePlus2sd: 8.0, femaleMedian: 5.8, femaleMinus2sd: 4.5, femalePlus2sd: 7.5 },
    { months: 6, ageDisplay: '6 months', maleMedian: 7.9, maleMinus2sd: 6.4, malePlus2sd: 9.8, femaleMedian: 7.3, femaleMinus2sd: 5.7, femalePlus2sd: 9.3 },
    { months: 9, ageDisplay: '9 months', maleMedian: 8.9, maleMinus2sd: 7.1, malePlus2sd: 11.0, femaleMedian: 8.2, femaleMinus2sd: 6.5, femalePlus2sd: 10.5 },
    { months: 12, ageDisplay: '1 year (12m)', maleMedian: 9.6, maleMinus2sd: 7.7, malePlus2sd: 12.0, femaleMedian: 8.9, femaleMinus2sd: 7.0, femalePlus2sd: 11.5 },
    { months: 18, ageDisplay: '1.5 years (18m)', maleMedian: 10.9, maleMinus2sd: 8.8, malePlus2sd: 13.7, femaleMedian: 10.2, femaleMinus2sd: 8.1, femalePlus2sd: 13.2 },
    { months: 24, ageDisplay: '2 years (24m)', maleMedian: 12.2, maleMinus2sd: 9.7, malePlus2sd: 15.3, femaleMedian: 11.5, femaleMinus2sd: 9.0, femalePlus2sd: 14.8 },
    { months: 36, ageDisplay: '3 years (36m)', maleMedian: 14.3, maleMinus2sd: 11.3, malePlus2sd: 18.3, femaleMedian: 13.9, femaleMinus2sd: 10.8, femalePlus2sd: 18.1 },
    { months: 48, ageDisplay: '4 years (48m)', maleMedian: 16.3, maleMinus2sd: 12.7, malePlus2sd: 21.2, femaleMedian: 16.1, femaleMinus2sd: 12.3, femalePlus2sd: 21.5 },
    { months: 60, ageDisplay: '5 years (60m)', maleMedian: 18.3, maleMinus2sd: 14.1, malePlus2sd: 24.2, femaleMedian: 18.2, femaleMinus2sd: 13.7, femalePlus2sd: 24.9 },
    { months: 72, ageDisplay: '6 years (72m)', maleMedian: 20.5, maleMinus2sd: 15.6, malePlus2sd: 27.8, femaleMedian: 20.2, femaleMinus2sd: 15.0, femalePlus2sd: 28.5 },
    { months: 84, ageDisplay: '7 years (84m)', maleMedian: 22.9, maleMinus2sd: 17.2, malePlus2sd: 31.8, femaleMedian: 22.4, femaleMinus2sd: 16.5, femalePlus2sd: 32.7 },
    { months: 96, ageDisplay: '8 years (96m)', maleMedian: 25.6, maleMinus2sd: 19.0, malePlus2sd: 36.5, femaleMedian: 25.0, femaleMinus2sd: 18.1, femalePlus2sd: 37.5 },
    { months: 108, ageDisplay: '9 years (108m)', maleMedian: 28.6, maleMinus2sd: 21.0, malePlus2sd: 42.0, femaleMedian: 28.2, femaleMinus2sd: 20.2, femalePlus2sd: 43.2 },
    { months: 120, ageDisplay: '10 years (120m)', maleMedian: 31.9, maleMinus2sd: 23.2, malePlus2sd: 48.0, femaleMedian: 31.9, femaleMinus2sd: 22.5, femalePlus2sd: 49.5 },
  ];
}

// WHO Median Weight Data (Age in months -> { male, female, -2SD, +2SD })
// Source: WHO Multicentre Growth Reference Study Group
const WHO_MEDIAN_WEIGHTS_BY_MONTH: Record<
  number,
  { male: number; female: number; m_minus2sd: number; m_plus2sd: number; f_minus2sd: number; f_plus2sd: number }
> = {
  0: { male: 3.3, female: 3.2, m_minus2sd: 2.5, m_plus2sd: 4.4, f_minus2sd: 2.4, f_plus2sd: 4.2 },
  1: { male: 4.5, female: 4.2, m_minus2sd: 3.4, m_plus2sd: 5.8, f_minus2sd: 3.2, f_plus2sd: 5.5 },
  2: { male: 5.6, female: 5.1, m_minus2sd: 4.3, m_plus2sd: 7.1, f_minus2sd: 3.9, f_plus2sd: 6.6 },
  3: { male: 6.4, female: 5.8, m_minus2sd: 5.0, m_plus2sd: 8.0, f_minus2sd: 4.5, f_plus2sd: 7.5 },
  6: { male: 7.9, female: 7.3, m_minus2sd: 6.4, m_plus2sd: 9.8, f_minus2sd: 5.7, f_plus2sd: 9.3 },
  9: { male: 8.9, female: 8.2, m_minus2sd: 7.1, m_plus2sd: 11.0, f_minus2sd: 6.5, f_plus2sd: 10.5 },
  12: { male: 9.6, female: 8.9, m_minus2sd: 7.7, m_plus2sd: 12.0, f_minus2sd: 7.0, f_plus2sd: 11.5 },
  18: { male: 10.9, female: 10.2, m_minus2sd: 8.8, m_plus2sd: 13.7, f_minus2sd: 8.1, f_plus2sd: 13.2 },
  24: { male: 12.2, female: 11.5, m_minus2sd: 9.7, m_plus2sd: 15.3, f_minus2sd: 9.0, f_plus2sd: 14.8 },
  36: { male: 14.3, female: 13.9, m_minus2sd: 11.3, m_plus2sd: 18.3, f_minus2sd: 10.8, f_plus2sd: 18.1 },
  48: { male: 16.3, female: 16.1, m_minus2sd: 12.7, m_plus2sd: 21.2, f_minus2sd: 12.3, f_plus2sd: 21.5 },
  60: { male: 18.3, female: 18.2, m_minus2sd: 14.1, m_plus2sd: 24.2, f_minus2sd: 13.7, f_plus2sd: 24.9 },
  72: { male: 20.5, female: 20.2, m_minus2sd: 15.6, m_plus2sd: 27.8, f_minus2sd: 15.0, f_plus2sd: 28.5 },
  84: { male: 22.9, female: 22.4, m_minus2sd: 17.2, m_plus2sd: 31.8, f_minus2sd: 16.5, f_plus2sd: 32.7 },
  96: { male: 25.6, female: 25.0, m_minus2sd: 19.0, m_plus2sd: 36.5, f_minus2sd: 18.1, f_plus2sd: 37.5 },
  108: { male: 28.6, female: 28.2, m_minus2sd: 21.0, m_plus2sd: 42.0, f_minus2sd: 20.2, f_plus2sd: 43.2 },
  120: { male: 31.9, female: 31.9, m_minus2sd: 23.2, m_plus2sd: 48.0, f_minus2sd: 22.5, f_plus2sd: 49.5 },
};

/**
 * Interpolates or retrieves WHO median weight for a given age in months
 */
export function getWhoEstimatedWeight(
  ageInMonths: number,
  sex: 'male' | 'female'
): WhoWeightEstimate {
  const months = Math.max(0, Math.min(120, Math.round(ageInMonths)));

  // Exact match
  if (WHO_MEDIAN_WEIGHTS_BY_MONTH[months]) {
    const data = WHO_MEDIAN_WEIGHTS_BY_MONTH[months];
    const median = sex === 'male' ? data.male : data.female;
    const p15 = sex === 'male' ? data.m_minus2sd : data.f_minus2sd;
    const p85 = sex === 'male' ? data.m_plus2sd : data.f_plus2sd;

    return {
      ageInMonths: months,
      sex,
      medianWeightKg: median,
      p15WeightKg: p15,
      p85WeightKg: p85,
      isEstimate: true,
      label: `ESTIMATED WEIGHT: ${median} kg (WHO Median 50th %ile, ${sex === 'male' ? 'Boy' : 'Girl'})`,
      clinicalDisclaimer:
        'ESTIMATE ONLY: This value is derived from the WHO Child Growth Standards 50th percentile median. Never present or document as measured weight. Actual weight must be measured using a calibrated pediatric scale before administering critical medications.',
    };
  }

  // Linear interpolation between closest month points
  const keys = Object.keys(WHO_MEDIAN_WEIGHTS_BY_MONTH)
    .map(Number)
    .sort((a, b) => a - b);
  let lower = keys[0];
  let upper = keys[keys.length - 1];

  for (let i = 0; i < keys.length - 1; i++) {
    if (months >= keys[i] && months <= keys[i + 1]) {
      lower = keys[i];
      upper = keys[i + 1];
      break;
    }
  }

  const fraction = (months - lower) / (upper - lower);
  const lowerData = WHO_MEDIAN_WEIGHTS_BY_MONTH[lower];
  const upperData = WHO_MEDIAN_WEIGHTS_BY_MONTH[upper];

  const lowerVal = sex === 'male' ? lowerData.male : lowerData.female;
  const upperVal = sex === 'male' ? upperData.male : upperData.female;
  const interpolated = Number((lowerVal + fraction * (upperVal - lowerVal)).toFixed(1));

  const lowerP15 = sex === 'male' ? lowerData.m_minus2sd : lowerData.f_minus2sd;
  const upperP15 = sex === 'male' ? upperData.m_minus2sd : upperData.f_minus2sd;
  const p15 = Number((lowerP15 + fraction * (upperP15 - lowerP15)).toFixed(1));

  const lowerP85 = sex === 'male' ? lowerData.m_plus2sd : lowerData.f_plus2sd;
  const upperP85 = sex === 'male' ? upperData.m_plus2sd : upperData.f_plus2sd;
  const p85 = Number((lowerP85 + fraction * (upperP85 - lowerP85)).toFixed(1));

  return {
    ageInMonths: months,
    sex,
    medianWeightKg: interpolated,
    p15WeightKg: p15,
    p85WeightKg: p85,
    isEstimate: true,
    label: `ESTIMATED WEIGHT: ${interpolated} kg (WHO Median 50th %ile, ${sex === 'male' ? 'Boy' : 'Girl'})`,
    clinicalDisclaimer:
      'ESTIMATE ONLY: This value is derived from the WHO Child Growth Standards 50th percentile median. Never present or document as measured weight. Actual weight must be measured using a calibrated pediatric scale before administering critical medications.',
  };
}
