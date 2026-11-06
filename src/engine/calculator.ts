/**
 * PediDose Dosage Calculation Engine
 * Validated pediatric clinical decision-support calculation module.
 */

import {
  CalculationInput,
  CalculationResult,
  CapsuleResult,
  DispersibleTabletResult,
  DropsResult,
  InjectableResult,
  PracticalSyringeAdvice,
  SyrupResult,
  TabletResult,
} from '../types/dosage.ts';

/**
 * Normalizes weight in kg from input unit
 */
export function normalizeWeightToKg(weight: number, unit: 'kg' | 'lbs'): number {
  if (weight <= 0 || isNaN(weight)) {
    throw new Error('Invalid weight: Weight must be a positive number greater than zero.');
  }
  if (unit === 'lbs') {
    return weight * 0.45359237;
  }
  return weight;
}

/**
 * Normalizes age to days, months, and years
 */
export function normalizeAge(
  age: number,
  unit: 'days' | 'months' | 'years'
): { ageInDays: number; ageInMonths: number; ageInYears: number } {
  if (age < 0 || isNaN(age)) {
    throw new Error('Invalid age: Age cannot be negative.');
  }

  let ageInDays: number;
  let ageInMonths: number;
  let ageInYears: number;

  switch (unit) {
    case 'days':
      ageInDays = age;
      ageInMonths = age / 30.4375;
      ageInYears = age / 365.25;
      break;
    case 'months':
      ageInMonths = age;
      ageInDays = age * 30.4375;
      ageInYears = age / 12;
      break;
    case 'years':
      ageInYears = age;
      ageInMonths = age * 12;
      ageInDays = age * 365.25;
      break;
  }

  return { ageInDays, ageInMonths, ageInYears };
}

/**
/**
 * Formats a calculated tablet quantity into a human-readable mixed fraction wherever mathematically exact.
 * E.g.:
 * - 0.50 → "½ tablet"
 * - 0.75 → "¾ tablet"
 * - 1.00 → "1 tablet"
 * - 1.25 → "1¼ tablets"
 * - 1.50 → "1½ tablets"
 * - 1.75 → "1¾ tablets"
 * - 2.00 → "2 tablets"
 * - 2.50 → "2½ tablets"
 * - 0.60 → "0.60 tablets" (retains decimal when not an exact supported fraction)
 *
 * Rules:
 * 1. Convert into a readable mixed fraction wherever mathematically exact.
 * 2. Never round a dosage to the nearest convenient fraction.
 * 3. If quantity cannot be accurately represented using supported fractions (¼, ½, ¾), retain decimal display.
 */
export function formatTabletFraction(rawCount: number): string {
  if (rawCount <= 0 || isNaN(rawCount)) return '0 tablets';

  // Check if it is an exact integer (within floating-point precision)
  const nearestInt = Math.round(rawCount);
  if (Math.abs(rawCount - nearestInt) < 1e-4) {
    return `${nearestInt} tablet${nearestInt === 1 ? '' : 's'}`;
  }

  const integerPart = Math.floor(rawCount);
  const remainder = rawCount - integerPart;

  // Strict mathematical check for supported splitting fractions (quarters and halves)
  // Epsilon 1e-4 prevents rounding arbitrary decimals (like 0.48, 0.52, or 0.60) to convenient fractions
  const EPSILON = 1e-4;
  let fractionSymbol = '';
  if (Math.abs(remainder - 0.25) < EPSILON) {
    fractionSymbol = '¼';
  } else if (Math.abs(remainder - 0.5) < EPSILON) {
    fractionSymbol = '½';
  } else if (Math.abs(remainder - 0.75) < EPSILON) {
    fractionSymbol = '¾';
  }

  if (fractionSymbol) {
    if (integerPart === 0) {
      // 0.25, 0.50, 0.75 are singular: "¼ tablet", "½ tablet", "¾ tablet"
      return `${fractionSymbol} tablet`;
    }
    // Mixed fractions greater than 1 are plural: "1¼ tablets", "1½ tablets", "1¾ tablets", "2½ tablets"
    return `${integerPart}${fractionSymbol} tablets`;
  }

  // When not an exact supported fraction, retain exact decimal representation (e.g. "0.60 tablets")
  return `${rawCount.toFixed(2)} tablets`;
}

/**
 * Core clinical pediatric dosage calculation engine
 */
export function calculatePediatricDosage(input: CalculationInput): CalculationResult {
  const warnings: string[] = [];
  const calculationSteps: string[] = [];

  // 1. Weight validation and normalization
  if (!input.weight || input.weight <= 0) {
    throw new Error('Weight must be specified as a positive number.');
  }
  const weightKg = normalizeWeightToKg(input.weight, input.weightUnit);
  if (input.weightUnit === 'lbs') {
    calculationSteps.push(
      `Converted weight: ${input.weight} lbs × 0.45359237 = ${weightKg.toFixed(2)} kg`
    );
  } else {
    calculationSteps.push(`Measured weight: ${weightKg.toFixed(2)} kg`);
  }

  // 2. Age normalization
  const { ageInDays, ageInMonths, ageInYears } = normalizeAge(input.age, input.ageUnit);
  calculationSteps.push(
    `Patient age: ${input.age} ${input.ageUnit} (approx. ${ageInMonths.toFixed(1)} months / ${ageInYears.toFixed(2)} years)`
  );

  // 3. Frequency validation
  const dosesPerDay = Math.floor(input.dosesPerDay);
  if (dosesPerDay < 1) {
    throw new Error('Frequency must be at least 1 dose per day.');
  }

  // 4. Calculate un-capped doses based on reference basis
  let uncappedDosePerDoseMg = 0;
  let uncappedTotalDailyDoseMg = 0;
  let formula = '';

  if (input.doseBasis === 'mg_kg_day') {
    uncappedTotalDailyDoseMg = weightKg * input.doseValue;
    uncappedDosePerDoseMg = uncappedTotalDailyDoseMg / dosesPerDay;
    formula = `Total Daily Dose = Weight (${weightKg.toFixed(2)} kg) × Reference (${input.doseValue} mg/kg/day)`;
    calculationSteps.push(
      `Step A: Daily Dose = ${weightKg.toFixed(2)} kg × ${input.doseValue} mg/kg/day = ${uncappedTotalDailyDoseMg.toFixed(2)} mg/day`
    );
    calculationSteps.push(
      `Step B: Dose per administration = ${uncappedTotalDailyDoseMg.toFixed(2)} mg/day ÷ ${dosesPerDay} doses/day = ${uncappedDosePerDoseMg.toFixed(2)} mg/dose`
    );
  } else if (input.doseBasis === 'mg_kg_dose') {
    uncappedDosePerDoseMg = weightKg * input.doseValue;
    uncappedTotalDailyDoseMg = uncappedDosePerDoseMg * dosesPerDay;
    formula = `Dose per administration = Weight (${weightKg.toFixed(2)} kg) × Reference (${input.doseValue} mg/kg/dose)`;
    calculationSteps.push(
      `Step A: Dose per administration = ${weightKg.toFixed(2)} kg × ${input.doseValue} mg/kg/dose = ${uncappedDosePerDoseMg.toFixed(2)} mg/dose`
    );
    calculationSteps.push(
      `Step B: Total Daily Dose = ${uncappedDosePerDoseMg.toFixed(2)} mg/dose × ${dosesPerDay} doses/day = ${uncappedTotalDailyDoseMg.toFixed(2)} mg/day`
    );
  } else if (input.doseBasis === 'fixed_dose') {
    uncappedDosePerDoseMg = input.doseValue;
    uncappedTotalDailyDoseMg = uncappedDosePerDoseMg * dosesPerDay;
    formula = `Fixed dose = ${input.doseValue} mg per administration`;
    calculationSteps.push(
      `Step A: Fixed dose per administration = ${uncappedDosePerDoseMg.toFixed(2)} mg/dose`
    );
    calculationSteps.push(
      `Step B: Total Daily Dose = ${uncappedDosePerDoseMg.toFixed(2)} mg/dose × ${dosesPerDay} doses/day = ${uncappedTotalDailyDoseMg.toFixed(2)} mg/day`
    );
  }

  // 5. Maximum Dose Validation & Capping
  let wasDailyDoseCapped = false;
  let wasSingleDoseCapped = false;
  let appliedCapType: 'absolute_single' | 'absolute_daily' | 'weight_based_daily' | undefined;
  let appliedCapMg: number | undefined;

  // Determine weight-based daily cap
  let weightDailyCap = Infinity;
  if (input.weightBasedMaxDailyDosePerKg && input.weightBasedMaxDailyDosePerKg > 0) {
    weightDailyCap = weightKg * input.weightBasedMaxDailyDosePerKg;
    if (uncappedTotalDailyDoseMg > weightDailyCap) {
      wasDailyDoseCapped = true;
      appliedCapType = 'weight_based_daily';
      appliedCapMg = weightDailyCap;
      warnings.push(
        `Calculated daily dose (${uncappedTotalDailyDoseMg.toFixed(1)} mg) exceeded weight-based maximum limit (${input.weightBasedMaxDailyDosePerKg} mg/kg/day = ${weightDailyCap.toFixed(1)} mg/day). Capped at ${weightDailyCap.toFixed(1)} mg/day.`
      );
      calculationSteps.push(
        `Safety Cap: Capped at weight-based maximum daily dose of ${weightDailyCap.toFixed(1)} mg/day`
      );
    }
  }

  // Determine absolute daily cap
  let absoluteDailyCap = Infinity;
  if (input.maxDailyDoseMg && input.maxDailyDoseMg > 0) {
    absoluteDailyCap = input.maxDailyDoseMg;
    if (uncappedTotalDailyDoseMg > absoluteDailyCap) {
      wasDailyDoseCapped = true;
      appliedCapType = 'absolute_daily';
      appliedCapMg = absoluteDailyCap;
      warnings.push(
        `Calculated total daily dose (${uncappedTotalDailyDoseMg.toFixed(1)} mg) exceeded absolute maximum daily limit (${absoluteDailyCap} mg/day). Capped at ${absoluteDailyCap} mg/day.`
      );
      calculationSteps.push(
        `Safety Cap: Capped at absolute maximum daily limit of ${absoluteDailyCap} mg/day`
      );
    }
  }

  // Determine absolute single cap (Never use daily maximum as single ceiling!)
  let absoluteSingleCap = Infinity;
  if (input.maxSingleDoseMg && input.maxSingleDoseMg > 0) {
    absoluteSingleCap = input.maxSingleDoseMg;
    if (uncappedDosePerDoseMg > absoluteSingleCap) {
      wasSingleDoseCapped = true;
      appliedCapType = 'absolute_single';
      appliedCapMg = absoluteSingleCap;
      warnings.push(
        `Calculated single dose (${uncappedDosePerDoseMg.toFixed(1)} mg) exceeded absolute maximum single dose limit (${absoluteSingleCap} mg). Capped at ${absoluteSingleCap} mg/dose.`
      );
      calculationSteps.push(
        `Safety Cap: Capped at absolute single dose limit of ${absoluteSingleCap} mg/dose`
      );
    }
  }

  // Compute final effective single and daily doses
  const effectiveDailyCap = Math.min(weightDailyCap, absoluteDailyCap);
  const maxSinglePermittedByDailyCap = effectiveDailyCap / dosesPerDay;
  const dosePerDoseMg = Math.min(
    uncappedDosePerDoseMg,
    absoluteSingleCap,
    maxSinglePermittedByDailyCap
  );
  const totalDailyDoseMg = dosePerDoseMg * dosesPerDay;

  // 6. Formulation-specific calculations
  let syrup: SyrupResult | undefined;
  let tablet: TabletResult | undefined;
  let drops: DropsResult | undefined;
  let dispersibleTablet: DispersibleTabletResult | undefined;
  let capsule: CapsuleResult | undefined;
  let injectable: InjectableResult | undefined;

  // Oral liquids (Syrup / Oral Suspension / Solution / Drops)
  if (
    input.formulationType === 'syrup' ||
    input.formulationType === 'suspension' ||
    input.formulationType === 'drops' ||
    input.formulationType === 'solution'
  ) {
    if (!input.syrupStrengthMg || !input.syrupVolumeMl) {
      warnings.push(
        'Missing formulation concentration parameters (strength in mg or volume in mL).'
      );
    } else if (input.syrupStrengthMg <= 0 || input.syrupVolumeMl <= 0) {
      throw new Error('Liquid strength and volume must be positive numbers.');
    } else {
      const concentrationMgPerMl = input.syrupStrengthMg / input.syrupVolumeMl;
      const volumePerDoseMl = dosePerDoseMg / concentrationMgPerMl;
      const dailyVolumeMl = totalDailyDoseMg / concentrationMgPerMl;

      // Note: Never silently round a calculated dose upward!
      const formattedVolumePerDose = `${Number(volumePerDoseMl.toFixed(2))} mL`;

      syrup = {
        concentrationMgPerMl,
        volumePerDoseMl,
        dailyVolumeMl,
        formattedVolumePerDose,
      };

      calculationSteps.push(
        `Liquid concentration: ${input.syrupStrengthMg} mg per ${input.syrupVolumeMl} mL = ${concentrationMgPerMl.toFixed(2)} mg/mL`
      );
      calculationSteps.push(
        `Calculated volume: ${dosePerDoseMg.toFixed(2)} mg ÷ ${concentrationMgPerMl.toFixed(2)} mg/mL = ${formattedVolumePerDose} per administration`
      );

      // Specific Drops calculation
      if (input.formulationType === 'drops') {
        const hasVerifiedDropFactor = typeof input.dropsPerMl === 'number' && input.dropsPerMl > 0;
        const dropsPerMl = hasVerifiedDropFactor ? input.dropsPerMl! : 0;
        const totalDrops = hasVerifiedDropFactor ? Math.round(volumePerDoseMl * dropsPerMl) : 0;
        const formattedDrops = hasVerifiedDropFactor
          ? `${totalDrops} drops (${Number(volumePerDoseMl.toFixed(2))} mL)`
          : `${Number(volumePerDoseMl.toFixed(2))} mL (Verified drop factor unavailable)`;

        drops = {
          volumeMl: volumePerDoseMl,
          dropsPerMl,
          totalDrops,
          formattedDrops,
          calibratedDropperNote: hasVerifiedDropFactor
            ? `Calibrated at ${dropsPerMl} drops/mL. Measure strictly using manufacturer-calibrated oral dropper. Do not substitute household droppers.`
            : 'Verified drop factor unavailable: Do NOT guess number of drops. Measure volume in mL strictly using a calibrated oral syringe.',
        };

        if (hasVerifiedDropFactor) {
          calculationSteps.push(
            `Drops calculation: ${volumePerDoseMl.toFixed(2)} mL × ${dropsPerMl} drops/mL = ${totalDrops} drops per administration`
          );
        } else {
          warnings.push(
            'Drop factor (drops/mL) is unknown for this product. Do not assume or guess drop count; administer volume in mL using a calibrated syringe.'
          );
          calculationSteps.push(
            `Drops note: Drop factor unknown; administer exact volume of ${Number(volumePerDoseMl.toFixed(2))} mL using a calibrated oral syringe.`
          );
        }
      }
    }
  }

  // Tablets & Dispersible Tablets
  if (
    input.formulationType === 'tablet' ||
    input.formulationType === 'dispersible_tablet'
  ) {
    if (!input.tabletStrengthMg || input.tabletStrengthMg <= 0) {
      warnings.push('Missing or invalid tablet strength parameter.');
    } else {
      const rawTabletsPerDose = dosePerDoseMg / input.tabletStrengthMg;
      const canBeDivided = input.canTabletBeDivided !== false;
      let divisionWarning: string | undefined;

      const isWhole = Math.abs(rawTabletsPerDose - Math.round(rawTabletsPerDose)) < 1e-4;

      if (!canBeDivided && !isWhole) {
        divisionWarning =
          'CRITICAL SAFETY WARNING: This tablet formulation cannot be safely split or divided. Consider a liquid/suspension formulation or alternative tablet strength to avoid inaccurate dosing.';
        warnings.push(divisionWarning);
      } else if (canBeDivided && !isWhole) {
        const remainder = rawTabletsPerDose - Math.floor(rawTabletsPerDose);
        const isSupportedFraction =
          Math.abs(remainder - 0.25) < 1e-4 ||
          Math.abs(remainder - 0.5) < 1e-4 ||
          Math.abs(remainder - 0.75) < 1e-4;

        if (!isSupportedFraction) {
          divisionWarning = `DOSING ACCURACY WARNING: Scored tablets can only be divided into halves (½) or quarters (¼). A calculated quantity of ${rawTabletsPerDose.toFixed(2)} tablets cannot be accurately split. Use an oral liquid formulation or alternative tablet strength.`;
          warnings.push(divisionWarning);
        }
      }

      const formattedTablets = formatTabletFraction(rawTabletsPerDose);

      tablet = {
        tabletStrengthMg: input.tabletStrengthMg,
        rawTabletsPerDose,
        formattedTabletsPerDose: formattedTablets,
        canBeDivided,
        divisionWarning,
      };

      calculationSteps.push(
        `Tablet calculation: ${dosePerDoseMg.toFixed(2)} mg ÷ ${input.tabletStrengthMg} mg/tablet = ${formattedTablets}`
      );

      if (canBeDivided && !isWhole) {
        const remainder = rawTabletsPerDose - Math.floor(rawTabletsPerDose);
        if (Math.abs(remainder - 0.5) < 1e-4) {
          calculationSteps.push('Tablet splitting: Scored tablet approved for splitting along score line into halves (½ tablet).');
        } else if (Math.abs(remainder - 0.25) < 1e-4 || Math.abs(remainder - 0.75) < 1e-4) {
          calculationSteps.push('Tablet splitting: Quad-scored tablet approved for splitting along score lines into quarters (¼ tablet).');
        }
      }

      // Dispersible Tablet instructions
      if (input.formulationType === 'dispersible_tablet') {
        dispersibleTablet = {
          tabletsCount: rawTabletsPerDose,
          formattedTablets,
          dispersionVolumeMl: 5,
          dispersionInstructions: `Disperse ${formattedTablets} in 5 to 10 mL of clean boiled drinking water, breast milk, or formula immediately prior to administration. Swirl thoroughly and administer entire volume.`,
        };
        calculationSteps.push(
          `Dispersible tablet preparation: Disperse in 5–10 mL liquid immediately before administration.`
        );
      }
    }
  }

  // Capsules (Strict Hard Non-Dividable Rule)
  if (input.formulationType === 'capsule') {
    if (!input.tabletStrengthMg || input.tabletStrengthMg <= 0) {
      warnings.push('Missing or invalid capsule strength parameter.');
    } else {
      const rawCapsules = dosePerDoseMg / input.tabletStrengthMg;
      const isExactWhole = Math.abs(rawCapsules - Math.round(rawCapsules)) < 0.05;
      let divisionWarning: string | undefined;

      if (!isExactWhole) {
        divisionWarning = `CRITICAL SAFETY WARNING: Hard capsules CANNOT be opened, split, or divided. Required dose is ${rawCapsules.toFixed(2)} capsules (${dosePerDoseMg.toFixed(1)} mg). Must switch to an oral suspension or dispersible tablet to avoid lethal or subtherapeutic inaccuracy.`;
        warnings.push(divisionWarning);
      }

      capsule = {
        capsuleStrengthMg: input.tabletStrengthMg,
        rawCapsules,
        formattedCapsules: isExactWhole
          ? `${Math.round(rawCapsules)} capsule${Math.round(rawCapsules) === 1 ? '' : 's'}`
          : `${rawCapsules.toFixed(2)} capsules (CANNOT SPLIT)`,
        canBeDivided: false,
        warning: divisionWarning,
      };

      calculationSteps.push(
        `Capsule calculation: ${dosePerDoseMg.toFixed(2)} mg ÷ ${input.tabletStrengthMg} mg/capsule = ${capsule.formattedCapsules}`
      );
    }
  }

  // Injectable / IV medications
  if (input.formulationType === 'injection' || input.formulationType === 'iv') {
    const injStrength = input.syrupStrengthMg || input.injectionConcentrationMgPerMl;
    const injVolume = input.syrupVolumeMl || 1;

    if (!injStrength || injStrength <= 0) {
      warnings.push('Missing injectable concentration parameter (strength in mg).');
    } else {
      const concentrationMgPerMl = injStrength / injVolume;
      const volumeMl = dosePerDoseMg / concentrationMgPerMl;
      const formattedVolume = `${Number(volumeMl.toFixed(2))} mL`;

      injectable = {
        concentrationMgPerMl,
        volumeMl,
        formattedVolume,
        route: input.route || 'intravenous',
        infusionNotes:
          'Inspect visually for particulate matter and discolouration prior to administration. Verify aseptic technique and slow administration rate protocol.',
      };

      calculationSteps.push(
        `Injectable concentration: ${injStrength} mg / ${injVolume} mL = ${concentrationMgPerMl.toFixed(2)} mg/mL`
      );
      calculationSteps.push(
        `Injectable volume: ${dosePerDoseMg.toFixed(2)} mg ÷ ${concentrationMgPerMl.toFixed(2)} mg/mL = ${formattedVolume} (${input.route || 'IV/IM'})`
      );
    }
  }

  // 7. Practical Syringe Measurement & Clinical Rounding Guidelines
  let syringeAdvice: PracticalSyringeAdvice | undefined;
  if (syrup && syrup.volumePerDoseMl > 0) {
    syringeAdvice = calculatePracticalSyringeAdvice(
      syrup.volumePerDoseMl,
      syrup.concentrationMgPerMl,
      wasSingleDoseCapped || wasDailyDoseCapped,
      input.maxSingleDoseMg
    );
    calculationSteps.push(
      `Practical Administration Guide: Use ${syringeAdvice.recommendedSyringe}. Measurable volume: ${syringeAdvice.roundedMeasurableVolumeMl.toFixed(2)} mL (${syringeAdvice.effectiveDoseMg} mg, ${syringeAdvice.percentAdjustment >= 0 ? '+' : ''}${syringeAdvice.percentAdjustment}%).`
    );
  } else if (injectable && injectable.volumeMl > 0) {
    syringeAdvice = calculatePracticalSyringeAdvice(
      injectable.volumeMl,
      injectable.concentrationMgPerMl,
      wasSingleDoseCapped || wasDailyDoseCapped,
      input.maxSingleDoseMg
    );
    calculationSteps.push(
      `Parenteral Administration Guide: Use ${syringeAdvice.recommendedSyringe}. Measurable volume: ${syringeAdvice.roundedMeasurableVolumeMl.toFixed(2)} mL (${syringeAdvice.effectiveDoseMg} mg).`
    );
  }

  // Estimated weight safety check
  if (input.isEstimatedWeight) {
    const estimateWarning = `CLINICAL SAFETY WARNING: Patient weight (${weightKg.toFixed(1)} kg) is an ESTIMATE (${input.estimatedWeightSource || 'WHO Growth Standards'}). Estimated weight MUST NOT be used to administer definitive medication doses without clinical review; verify actual weight on a calibrated scale.`;
    warnings.unshift(estimateWarning);
    calculationSteps.unshift(`⚠️ ESTIMATED WEIGHT APPLIED: ${weightKg.toFixed(1)} kg (Scale measurement required).`);
  }

  // 8. Safety Status assessment
  let safetyStatus: 'safe' | 'warning' | 'critical' = 'safe';
  if (
    tablet?.divisionWarning ||
    capsule?.warning ||
    warnings.some((w) => w.includes('CRITICAL'))
  ) {
    safetyStatus = 'critical';
  } else if (
    warnings.length > 0 ||
    wasSingleDoseCapped ||
    wasDailyDoseCapped ||
    input.isEstimatedWeight
  ) {
    safetyStatus = 'warning';
  }

  return {
    success: true,
    weightKg,
    isEstimatedWeight: input.isEstimatedWeight,
    estimatedWeightSource: input.estimatedWeightSource,
    ageInDays,
    ageInMonths,
    ageInYears,
    doseBasis: input.doseBasis,
    dosesPerDay,
    dosePerDoseMg,
    totalDailyDoseMg,
    uncappedDosePerDoseMg,
    uncappedTotalDailyDoseMg,
    wasSingleDoseCapped,
    wasDailyDoseCapped,
    appliedCapType,
    appliedCapMg,
    syrup,
    tablet,
    drops,
    dispersibleTablet,
    capsule,
    injectable,
    syringeAdvice,
    warnings,
    safetyStatus,
    formula,
    calculationSteps,
    activeIngredientTarget: input.activeIngredientTarget,
  };
}

/**
 * Practical Syringe Measurement & Clinical Rounding Guidelines
 * Standardizes volumes to calibrated syringe marks without unsafe upward drift.
 */
export function calculatePracticalSyringeAdvice(
  volumeMl: number,
  concentrationMgPerMl: number,
  wasCapped: boolean,
  maxSingleDoseMg?: number | null
): PracticalSyringeAdvice {
  let recommendedSyringe: string;
  let increment: number;

  if (volumeMl <= 1.0) {
    recommendedSyringe = '1 mL oral syringe (graduated in 0.01 mL / 0.02 mL)';
    increment = 0.02;
  } else if (volumeMl <= 3.0) {
    recommendedSyringe = '3 mL oral syringe (graduated in 0.1 mL)';
    increment = 0.1;
  } else if (volumeMl <= 5.0) {
    recommendedSyringe = '5 mL oral syringe (graduated in 0.2 mL)';
    increment = 0.2;
  } else {
    recommendedSyringe = '10 mL oral syringe (graduated in 0.5 mL)';
    increment = 0.5;
  }

  // Standard nearest measurable marking
  let roundedMeasurableVolumeMl = Math.round(volumeMl / increment) * increment;
  roundedMeasurableVolumeMl = Number(roundedMeasurableVolumeMl.toFixed(3));

  // Clinical Rule: Never round upward if:
  // 1. Dose was already capped at maximum single or daily limit
  // 2. Candidate volume causes dose to exceed single max ceiling
  // 3. Upward rounding exceeds +5% of exact dose
  const exactDoseMg = volumeMl * concentrationMgPerMl;
  const candidateDoseMg = roundedMeasurableVolumeMl * concentrationMgPerMl;
  const upwardAdjustmentPercent = exactDoseMg > 0 ? ((candidateDoseMg - exactDoseMg) / exactDoseMg) * 100 : 0;

  if (roundedMeasurableVolumeMl > volumeMl) {
    if (
      wasCapped ||
      upwardAdjustmentPercent > 5.0 ||
      (maxSingleDoseMg && candidateDoseMg > maxSingleDoseMg)
    ) {
      // Round DOWN to nearest safe measurable mark
      roundedMeasurableVolumeMl = Math.floor(volumeMl / increment) * increment;
      roundedMeasurableVolumeMl = Number(roundedMeasurableVolumeMl.toFixed(3));
      if (roundedMeasurableVolumeMl === 0 && volumeMl > 0) {
        roundedMeasurableVolumeMl = increment;
      }
    }
  }

  const effectiveDoseMg = Number((roundedMeasurableVolumeMl * concentrationMgPerMl).toFixed(2));
  const percentAdjustment = exactDoseMg > 0
    ? Number((((effectiveDoseMg - exactDoseMg) / exactDoseMg) * 100).toFixed(1))
    : 0;

  let roundingDirection: 'exact' | 'rounded_down' | 'rounded_up' = 'exact';
  if (roundedMeasurableVolumeMl < volumeMl - 0.001) {
    roundingDirection = 'rounded_down';
  } else if (roundedMeasurableVolumeMl > volumeMl + 0.001) {
    roundingDirection = 'rounded_up';
  }

  const clinicalNote =
    roundingDirection === 'exact'
      ? `Exact volume (${volumeMl.toFixed(2)} mL) aligns directly with syringe calibration marks.`
      : roundingDirection === 'rounded_down'
      ? `Clinically rounded down to ${roundedMeasurableVolumeMl.toFixed(2)} mL (${effectiveDoseMg} mg, ${percentAdjustment}%) to align with syringe graduation marks without risking dosage overshoot.`
      : `Clinically rounded to ${roundedMeasurableVolumeMl.toFixed(2)} mL (${effectiveDoseMg} mg, +${percentAdjustment}%) within standard safe ±5% pediatric administration tolerance.`;

  return {
    recommendedSyringe,
    exactVolumeMl: Number(volumeMl.toFixed(3)),
    roundedMeasurableVolumeMl,
    effectiveDoseMg,
    percentAdjustment,
    roundingDirection,
    clinicalNote,
  };
}
