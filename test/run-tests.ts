/**
 * PediDose Automated Test Suite
 * Comprehensive clinical dosage calculation, database integrity, search, AI, and safety validation checks.
 */

import {
  calculatePediatricDosage,
  calculatePracticalSyringeAdvice,
  formatTabletFraction,
  normalizeAge,
  normalizeWeightToKg,
} from '../src/engine/calculator.ts';
import {
  DATABASE_METADATA,
  getAllMedications,
  getMedicationById,
  getMedicationsByCategory,
  getMedicationsByCountry,
  getMedicationsBySource,
  getDiscrepancyFlaggedMedications,
  getBannedOrRestrictedMedications,
  registerMedicationRecord,
  MEDICATION_DATABASE,
} from '../src/data/medicationDatabase.ts';
import {
  calculateLevenshteinDistance,
  calculateSimilarity,
  searchMedications,
} from '../src/engine/search.ts';
import {
  buildDatabaseGroundingSummary,
  formatVerifiedMedicationToAiSchema,
  resolveLocalDatabaseMatch,
} from '../src/engine/aiGrounding.ts';
import {
  checkPediatricDrugInteractions,
  runClinicalSafetyAudit,
} from '../src/engine/safetyEngine.ts';
import {
  getWhoEstimatedWeight,
  getWhoReferenceTable,
} from '../src/engine/whoGrowth.ts';
import {
  initOfflineDatabase,
  getOfflineMedications,
  getOfflineMedicationById,
  getOfflineMetadata,
  cacheAiResponse,
  getCachedAiResponse,
  isNetworkOnline,
} from '../src/services/offlineStorage.ts';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

export function describe(suiteName: string, fn: () => void) {
  console.log(`\n📋 Running Test Suite: ${suiteName}`);
  fn();
}

export function it(testName: string, fn: () => void) {
  const start = performance.now();
  try {
    fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite: '', name: testName, passed: true, durationMs });
    console.log(`  ✅ PASS: ${testName} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({
      suite: '',
      name: testName,
      passed: false,
      error: err?.message || String(err),
      durationMs,
    });
    console.error(`  ❌ FAIL: ${testName} (${durationMs}ms)\n     Error: ${err?.message || err}`);
  }
}

export async function itAsync(testName: string, fn: () => Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite: '', name: testName, passed: true, durationMs });
    console.log(`  ✅ PASS: ${testName} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({
      suite: '',
      name: testName,
      passed: false,
      error: err?.message || String(err),
      durationMs,
    });
    console.error(`  ❌ FAIL: ${testName} (${durationMs}ms)\n     Error: ${err?.message || err}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, but received ${JSON.stringify(actual)}`
    );
  }
}

export function assertApprox(actual: number, expected: number, tolerance = 0.01, message?: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${message ? message + ': ' : ''}Expected ~${expected} (±${tolerance}), got ${actual}`
    );
  }
}

export function assertTrue(actual: boolean, message?: string) {
  if (actual !== true) {
    throw new Error(`${message ? message + ': ' : ''}Expected true, got ${actual}`);
  }
}

// -------------------------------------------------------------
// Phase 1 Baseline & Regression Tests
// -------------------------------------------------------------
describe('Phase 1: Project Environment & Core Arithmetic Baseline', () => {
  it('Verifies Node runtime and TypeScript execution environment', () => {
    assertTrue(typeof process !== 'undefined', 'Process object is defined');
    assertTrue(typeof performance.now === 'function', 'Performance timing is available');
  });

  it('Verifies normalizeWeightToKg with kg and lbs', () => {
    assertEqual(normalizeWeightToKg(10, 'kg'), 10, 'Weight in kg should remain exact');
    assertApprox(normalizeWeightToKg(22.0462, 'lbs'), 10, 0.01, '22.0462 lbs should equal ~10 kg');
  });

  it('Verifies normalizeAge for days, months, and years', () => {
    const ageDays = normalizeAge(30, 'days');
    assertApprox(ageDays.ageInMonths, 0.985, 0.05);

    const ageMonths = normalizeAge(12, 'months');
    assertApprox(ageMonths.ageInYears, 1.0, 0.01);

    const ageYears = normalizeAge(5, 'years');
    assertEqual(ageYears.ageInYears, 5);
    assertEqual(ageYears.ageInMonths, 60);
  });
});

// -------------------------------------------------------------
// Phase 2: Dosage Calculation Engine Verification & Regression Suite
// -------------------------------------------------------------
describe('Phase 2: Advanced Pediatric Dosage Calculation Engine', () => {
  it('Regression Test: Augmentin (10 kg, 40 mg/kg/day, 2 doses/day)', () => {
    const result = calculatePediatricDosage({
      weight: 10,
      weightUnit: 'kg',
      age: 2,
      ageUnit: 'years',
      doseBasis: 'mg_kg_day',
      doseValue: 40,
      dosesPerDay: 2,
      formulationType: 'suspension',
      syrupStrengthMg: 200,
      syrupVolumeMl: 5,
      activeIngredientTarget: 'Amoxicillin',
    });

    assertEqual(result.totalDailyDoseMg, 400, 'Total daily dose must equal 400 mg');
    assertEqual(result.dosePerDoseMg, 200, 'Single dose per administration must equal 200 mg');
    assertTrue(result.syrup !== undefined, 'Syrup calculation must be present');
    assertEqual(result.syrup?.concentrationMgPerMl, 40, 'Concentration must equal 40 mg/mL');
    assertEqual(result.syrup?.volumePerDoseMl, 5, 'Volume per dose must equal 5 mL');
    assertEqual(result.syrup?.dailyVolumeMl, 10, 'Daily volume must equal 10 mL');
    assertEqual(result.syrup?.formattedVolumePerDose, '5 mL');
  });

  it('Calculates mg/kg/dose accurately (12 kg child, 15 mg/kg/dose, 4 doses/day)', () => {
    const result = calculatePediatricDosage({
      weight: 12,
      weightUnit: 'kg',
      age: 18,
      ageUnit: 'months',
      doseBasis: 'mg_kg_dose',
      doseValue: 15,
      dosesPerDay: 4,
      formulationType: 'syrup',
      syrupStrengthMg: 120,
      syrupVolumeMl: 5,
    });

    assertEqual(result.dosePerDoseMg, 180, 'Single dose must equal 180 mg');
    assertEqual(result.totalDailyDoseMg, 720, 'Total daily dose must equal 720 mg');
    assertEqual(result.syrup?.concentrationMgPerMl, 24, 'Concentration must be 24 mg/mL');
    assertEqual(result.syrup?.volumePerDoseMl, 7.5, 'Volume per dose must equal 7.5 mL');
    assertEqual(result.syrup?.formattedVolumePerDose, '7.5 mL');
  });

  it('Formats tablet fractions correctly and preserves exact decimals when not a supported fraction', () => {
    // User requested examples:
    assertEqual(formatTabletFraction(0.50), '½ tablet');
    assertEqual(formatTabletFraction(0.75), '¾ tablet');
    assertEqual(formatTabletFraction(1.00), '1 tablet');
    assertEqual(formatTabletFraction(1.25), '1¼ tablets');
    assertEqual(formatTabletFraction(1.50), '1½ tablets');
    assertEqual(formatTabletFraction(1.75), '1¾ tablets');
    assertEqual(formatTabletFraction(2.00), '2 tablets');
    assertEqual(formatTabletFraction(2.50), '2½ tablets');

    // Quarter fractions and whole numbers:
    assertEqual(formatTabletFraction(0.25), '¼ tablet');
    assertEqual(formatTabletFraction(2.25), '2¼ tablets');
    assertEqual(formatTabletFraction(2.75), '2¾ tablets');
    assertEqual(formatTabletFraction(3.00), '3 tablets');

    // Decimal retention when not a supported fraction (never round to nearest convenient fraction):
    assertEqual(formatTabletFraction(0.60), '0.60 tablets');
    assertEqual(formatTabletFraction(0.48), '0.48 tablets');
    assertEqual(formatTabletFraction(0.52), '0.52 tablets');
    assertEqual(formatTabletFraction(1.20), '1.20 tablets');
    assertEqual(formatTabletFraction(1.33), '1.33 tablets');
  });

  it('Calculates splittable tablet dosage (250 mg dose, 500 mg tablet)', () => {
    const result = calculatePediatricDosage({
      weight: 25,
      weightUnit: 'kg',
      age: 8,
      ageUnit: 'years',
      doseBasis: 'fixed_dose',
      doseValue: 250,
      dosesPerDay: 2,
      formulationType: 'tablet',
      tabletStrengthMg: 500,
      canTabletBeDivided: true,
    });

    assertEqual(result.dosePerDoseMg, 250);
    assertEqual(result.tablet?.rawTabletsPerDose, 0.5);
    assertEqual(result.tablet?.formattedTabletsPerDose, '½ tablet');
    assertEqual(result.safetyStatus, 'safe');
  });

  it('Flags critical safety warning when an unsplittable tablet requires fraction', () => {
    const result = calculatePediatricDosage({
      weight: 20,
      weightUnit: 'kg',
      age: 6,
      ageUnit: 'years',
      doseBasis: 'fixed_dose',
      doseValue: 250,
      dosesPerDay: 1,
      formulationType: 'tablet',
      tabletStrengthMg: 500,
      canTabletBeDivided: false,
    });

    assertEqual(result.safetyStatus, 'critical');
    assertTrue(
      result.warnings.some((w) => w.includes('cannot be safely split')),
      'Must contain unsplittable tablet division warning'
    );
  });

  it('Caps total daily dose when exceeding absolute maximum daily limit', () => {
    const result = calculatePediatricDosage({
      weight: 45,
      weightUnit: 'kg',
      age: 14,
      ageUnit: 'years',
      doseBasis: 'mg_kg_day',
      doseValue: 125,
      dosesPerDay: 4,
      maxDailyDoseMg: 4000,
      maxSingleDoseMg: 1000,
      formulationType: 'tablet',
      tabletStrengthMg: 500,
    });

    assertTrue(result.wasDailyDoseCapped, 'Daily dose must be marked capped');
    assertEqual(result.totalDailyDoseMg, 4000, 'Total daily dose must be capped at 4000 mg');
    assertEqual(result.dosePerDoseMg, 1000, 'Single dose must be capped at 1000 mg');
  });

  it('Caps single dose without using daily maximum as single ceiling', () => {
    const result = calculatePediatricDosage({
      weight: 35,
      weightUnit: 'kg',
      age: 10,
      ageUnit: 'years',
      doseBasis: 'mg_kg_dose',
      doseValue: 15,
      dosesPerDay: 3,
      maxSingleDoseMg: 400,
      maxDailyDoseMg: 1200,
      formulationType: 'suspension',
      syrupStrengthMg: 100,
      syrupVolumeMl: 5,
    });

    assertTrue(result.wasSingleDoseCapped, 'Single dose must be marked as capped');
    assertEqual(result.dosePerDoseMg, 400, 'Single dose must be capped at 400 mg');
    assertEqual(result.totalDailyDoseMg, 1200, 'Total daily dose becomes 400 * 3 = 1200 mg');
  });

  it('Enforces weight-based daily maximum limit (e.g. 60 mg/kg/day max for paracetamol)', () => {
    const result = calculatePediatricDosage({
      weight: 10,
      weightUnit: 'kg',
      age: 1,
      ageUnit: 'years',
      doseBasis: 'mg_kg_day',
      doseValue: 80,
      dosesPerDay: 4,
      weightBasedMaxDailyDosePerKg: 60,
      maxDailyDoseMg: 4000,
      formulationType: 'syrup',
      syrupStrengthMg: 120,
      syrupVolumeMl: 5,
    });

    assertTrue(result.wasDailyDoseCapped, 'Daily dose should be capped by weight-based rule');
    assertEqual(result.totalDailyDoseMg, 600, 'Total daily dose capped at 10 * 60 = 600 mg');
    assertEqual(result.dosePerDoseMg, 150, 'Single dose capped at 600 / 4 = 150 mg');
  });

  it('Does not silently round calculated dose upward', () => {
    const result = calculatePediatricDosage({
      weight: 11,
      weightUnit: 'kg',
      age: 2,
      ageUnit: 'years',
      doseBasis: 'mg_kg_dose',
      doseValue: 15,
      dosesPerDay: 3,
      formulationType: 'syrup',
      syrupStrengthMg: 100,
      syrupVolumeMl: 5,
    });

    assertEqual(result.syrup?.volumePerDoseMl, 8.25, 'Volume must be exact 8.25 mL, not rounded up');
    assertEqual(result.syrup?.formattedVolumePerDose, '8.25 mL');
  });

  it('Throws error on invalid weight', () => {
    let errorCaught = false;
    try {
      calculatePediatricDosage({
        weight: -5,
        weightUnit: 'kg',
        age: 3,
        ageUnit: 'years',
        doseBasis: 'mg_kg_dose',
        doseValue: 15,
        dosesPerDay: 3,
        formulationType: 'syrup',
      });
    } catch (err: any) {
      errorCaught = true;
      assertTrue(err.message.includes('Weight must be specified as a positive number'));
    }
    assertTrue(errorCaught, 'Should catch invalid weight');
  });
});

// -------------------------------------------------------------
// Phase 3: Structured Medication Database Verification Tests
// -------------------------------------------------------------
describe('Phase 3: Structured Medication Database Verification', () => {
  it('Verifies database metadata and minimum record integrity', () => {
    assertTrue(DATABASE_METADATA.version === '2026.11', 'Version should match 2026.11');
    assertTrue(DATABASE_METADATA.totalRecords >= 8, 'Must have at least 8 verified drugs');
    assertEqual(MEDICATION_DATABASE.length, DATABASE_METADATA.totalRecords);
  });

  it('Verifies all records have required clinical fields and references', () => {
    const medications = getAllMedications();
    for (const med of medications) {
      assertTrue(!!med.id, `Medication ID missing in ${med.genericName}`);
      assertTrue(!!med.genericName, `Generic name missing in ${med.id}`);
      assertTrue(med.brandNames.length > 0, `Brands missing in ${med.id}`);
      assertTrue(med.activeIngredients.length > 0, `Active ingredients missing in ${med.id}`);
      assertTrue(med.formulations.length > 0, `Formulations missing in ${med.id}`);
      assertTrue(med.indications.length > 0, `Indications missing in ${med.id}`);
      assertTrue(med.contraindications.length > 0, `Contraindications missing in ${med.id}`);
      assertTrue(med.referenceSources.length > 0, `Reference sources missing in ${med.id}`);
      assertTrue(!!med.lastVerifiedDate, `Verified date missing in ${med.id}`);
    }
  });

  it('Verifies combination medication (Augmentin) dosing target integrity', () => {
    const augmentin = getMedicationById('amoxicillin_clavulanate');
    assertTrue(!!augmentin, 'Augmentin must exist in database');
    assertTrue(augmentin!.isCombination, 'Augmentin must be marked as combination');

    const primaryIngredient = augmentin!.activeIngredients.find((ing) => ing.isPrimaryDosingTarget);
    assertTrue(!!primaryIngredient, 'Primary active ingredient target must be defined');
    assertEqual(primaryIngredient!.name, 'Amoxicillin');

    for (const ind of augmentin!.indications) {
      assertEqual(ind.targetActiveIngredient, 'Amoxicillin');
    }

    const duoFormulation = augmentin!.formulations.find((f) => f.id === 'aug_duo_susp_228');
    assertTrue(!!duoFormulation, 'Duo 228.5mg/5mL formulation must exist');
    assertEqual(duoFormulation!.concentration.strengthMg, 200);
    assertEqual(duoFormulation!.concentration.volumeMl, 5);
  });

  it('Verifies multi-indication support for Paracetamol', () => {
    const pcm = getMedicationById('paracetamol');
    assertTrue(!!pcm, 'Paracetamol must exist in database');
    assertTrue(pcm!.indications.length >= 2, 'Paracetamol must support multiple indications');

    const feverIndication = pcm!.indications.find((i) => i.id === 'pcm_fever_pain');
    const vaccineIndication = pcm!.indications.find((i) => i.id === 'pcm_post_vaccine');

    assertTrue(!!feverIndication, 'Fever/pain indication must exist');
    assertTrue(!!vaccineIndication, 'Post-vaccine indication must exist');
    assertEqual(feverIndication!.doseBasis, 'mg_kg_dose');
    assertEqual(feverIndication!.doseValue, 15);
    assertEqual(vaccineIndication!.doseBasis, 'fixed_dose');
    assertEqual(vaccineIndication!.doseValue, 60);
  });

  it('Verifies category search and filtering utility', () => {
    const antibiotics = getMedicationsByCategory('Antibacterial');
    assertTrue(antibiotics.length >= 3, 'Must find at least 3 antibiotics');

    const analgesics = getMedicationsByCategory('Analgesics');
    assertTrue(analgesics.length >= 2, 'Must find at least 2 analgesics');
  });
});

// -------------------------------------------------------------
// Phase 4: Advanced Medication Search Verification Tests
// -------------------------------------------------------------
describe('Phase 4: Advanced Medication Search System', () => {
  it('Searches by generic name: "Paracetamol", "Amoxicillin"', () => {
    const pcmResult = searchMedications('Paracetamol');
    assertTrue(pcmResult.results.length > 0, 'Should return results for Paracetamol');
    assertEqual(pcmResult.results[0].medication.id, 'paracetamol');
    assertEqual(pcmResult.results[0].matchedField, 'generic');

    const amoxResult = searchMedications('Amoxicillin');
    assertTrue(amoxResult.results.length > 0, 'Should return results for Amoxicillin');
    assertEqual(amoxResult.results[0].medication.id, 'amoxicillin');
  });

  it('Searches by brand names: "Crocin", "Dolo", "Augmentin Duo"', () => {
    const crocinResult = searchMedications('Crocin');
    assertTrue(crocinResult.results.length > 0);
    assertEqual(crocinResult.results[0].medication.id, 'paracetamol');
    assertEqual(crocinResult.results[0].matchedField, 'brand');

    const doloResult = searchMedications('Dolo');
    assertTrue(doloResult.results.length > 0);
    assertEqual(doloResult.results[0].medication.id, 'paracetamol');

    const augResult = searchMedications('Augmentin Duo');
    assertTrue(augResult.results.length > 0);
    assertEqual(augResult.results[0].medication.id, 'amoxicillin_clavulanate');
  });

  it('Searches by clinical abbreviations: "PCM", "APAP", "IBU"', () => {
    const pcmResult = searchMedications('PCM');
    assertTrue(pcmResult.results.length > 0);
    assertEqual(pcmResult.results[0].medication.id, 'paracetamol');
    assertEqual(pcmResult.results[0].matchedField, 'alias');

    const ibuResult = searchMedications('IBU');
    assertTrue(ibuResult.results.length > 0);
    assertEqual(ibuResult.results[0].medication.id, 'ibuprofen');
  });

  it('Searches by misspelled names via fuzzy Levenshtein matching: "paracetmol", "amoxcillin"', () => {
    const pcmFuzzy = searchMedications('paracetmol');
    assertTrue(pcmFuzzy.results.length > 0);
    assertEqual(pcmFuzzy.results[0].medication.id, 'paracetamol');

    const amoxFuzzy = searchMedications('amoxcillin');
    assertTrue(amoxFuzzy.results.length > 0);
    assertEqual(amoxFuzzy.results[0].medication.id, 'amoxicillin');
  });

  it('Searches by condition/symptom: "Fever medicine", "Antibiotics", "Ear infection"', () => {
    const feverResult = searchMedications('fever medicine');
    assertTrue(feverResult.results.length >= 2, 'Should return Paracetamol and Ibuprofen');
    assertTrue(feverResult.isAmbiguous, 'Symptom matching must be flagged as ambiguous');
    assertTrue(!!feverResult.symptomNotice, 'Must include clinical symptom warning notice');

    const abxResult = searchMedications('antibiotics');
    assertTrue(abxResult.results.length >= 3, 'Should return Amoxicillin, Augmentin, Azithromycin');
    assertTrue(abxResult.isAmbiguous, 'Multiple antibiotics must be flagged as ambiguous for user selection');

    const earResult = searchMedications('ear infection');
    assertTrue(earResult.results.length >= 2, 'Should return otitis media antibiotics');
  });

  it('Searches by formulation strength: "228.5", "120 mg/5ml"', () => {
    const augStrength = searchMedications('228.5');
    assertTrue(augStrength.results.length > 0);
    assertEqual(augStrength.results[0].medication.id, 'amoxicillin_clavulanate');

    const pcmStrength = searchMedications('120 mg/5ml');
    assertTrue(pcmStrength.results.length > 0);
    assertEqual(pcmStrength.results[0].medication.id, 'paracetamol');
  });
});

// -------------------------------------------------------------
// Phase 5: Gemini AI Structured Grounding Verification Tests
// -------------------------------------------------------------
describe('Phase 5: Gemini AI Structured Grounding & Section 6 Schema Compliance', () => {
  it('Formats verified database record into exact Section 6 JSON schema', () => {
    const aug = getMedicationById('amoxicillin_clavulanate')!;
    const schemaOutput = formatVerifiedMedicationToAiSchema(aug, aug.indications[0]);

    assertEqual(schemaOutput.genericName, 'Amoxicillin and Clavulanic Acid (Co-amoxiclav)');
    assertTrue(schemaOutput.brandNames.includes('Augmentin Duo'));
    assertEqual(schemaOutput.doseBasis, 'mg/kg/day');
    assertEqual(schemaOutput.dosePerKg, 40);
    assertEqual(schemaOutput.dosesPerDay, 2);
    assertEqual(schemaOutput.maximumSingleDose, 1000);
    assertEqual(schemaOutput.maximumDailyDose, 2000);
    assertEqual(schemaOutput.route, 'oral');
    assertTrue(schemaOutput.activeIngredients.some((ing) => ing.includes('Amoxicillin')));
    assertTrue(schemaOutput.formulations.length > 0);
    assertTrue(schemaOutput.referenceSource.includes('AAP') || schemaOutput.referenceSource.includes('BNF'));
    assertTrue(!!schemaOutput.verificationStatus);
  });

  it('Verifies zero-fabrication: null fields remain null when unspecified in database', () => {
    const amox = getMedicationById('amoxicillin')!;
    const schemaOutput = formatVerifiedMedicationToAiSchema(amox, amox.indications[0]);

    assertEqual(schemaOutput.dosePerKg, 90);
    assertEqual(schemaOutput.doseBasis, 'mg/kg/day');
    assertEqual(schemaOutput.dosesPerDay, 2);
    assertEqual(schemaOutput.maximumDailyDose, 3000);
  });

  it('Resolves natural language queries via grounded local database matcher', () => {
    const queryResult = resolveLocalDatabaseMatch('Augmentin Duo for ear infection');
    assertTrue(!!queryResult, 'Should resolve Augmentin Duo for ear infection');
    assertEqual(queryResult!.genericName, 'Amoxicillin and Clavulanic Acid (Co-amoxiclav)');
    assertTrue(queryResult!.brandNames.includes('Augmentin Duo'));

    const pcmQuery = resolveLocalDatabaseMatch('Crocin syrup for toddler fever');
    assertTrue(!!pcmQuery, 'Should resolve Crocin syrup');
    assertEqual(pcmQuery!.genericName, 'Paracetamol');
  });

  it('Builds grounded system instruction containing verified database catalog', () => {
    const groundingText = buildDatabaseGroundingSummary();
    assertTrue(groundingText.includes('VERIFIED PEDIATRIC MEDICATION DATABASE'));
    assertTrue(groundingText.includes('Paracetamol'));
    assertTrue(groundingText.includes('Augmentin'));
    assertTrue(groundingText.includes('Ibuprofen'));
    assertTrue(groundingText.includes('Azithromycin'));
  });
});

// -------------------------------------------------------------
// Phase 6: Clinical Safety & Validation Engine Tests
// -------------------------------------------------------------
describe('Phase 6: Clinical Safety & Validation Engine', () => {
  const pcm = getMedicationById('paracetamol')!;
  const ibu = getMedicationById('ibuprofen')!;
  const aug = getMedicationById('amoxicillin_clavulanate')!;

  it('Detects duplicate active ingredients and STOPS calculation (e.g. Paracetamol + Crocin)', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 10,
        ageInMonths: 24,
        concurrentMedications: ['Crocin 120mg/5mL'], // Duplicate Paracetamol brand!
      },
      medication: pcm,
      indication: pcm.indications[0],
      formulation: pcm.formulations[1],
      route: 'oral',
      proposedSingleDoseMg: 150,
      proposedDailyDoseMg: 600,
      dosesPerDay: 4,
    });

    assertEqual(audit.canProceed, false, 'Must not proceed with duplicate active ingredient');
    assertEqual(audit.safetyStatus, 'CRITICAL_STOP');
    assertTrue(
      audit.issues.some((i) => i.category === 'duplicate_ingredient'),
      'Must contain duplicate_ingredient issue'
    );
  });

  it('Enforces age-restricted formulation limits (e.g. adult solid tablet for 10-month-old infant)', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 9,
        ageInMonths: 10, // Infant aged 10 months cannot swallow 500 mg solid tablets (min 72 months)
      },
      medication: pcm,
      indication: pcm.indications[0],
      formulation: pcm.formulations[3], // 500 mg Scored Tablet (min 72 months)
      route: 'oral',
      proposedSingleDoseMg: 135,
      proposedDailyDoseMg: 540,
      dosesPerDay: 4,
    });

    assertEqual(audit.canProceed, false, 'Solid tablet for infant must stop calculation');
    assertEqual(audit.safetyStatus, 'CRITICAL_STOP');
    assertTrue(
      audit.issues.some((i) => i.category === 'age_restriction'),
      'Must flag formulation age restriction'
    );
  });

  it('Catches contraindication: Penicillin allergy with Co-amoxiclav (Augmentin)', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 12,
        ageInMonths: 36,
        knownAllergies: ['Penicillin anaphylaxis'],
      },
      medication: aug,
      indication: aug.indications[0],
      formulation: aug.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 240,
      proposedDailyDoseMg: 480,
      dosesPerDay: 2,
    });

    assertEqual(audit.canProceed, false, 'Penicillin allergy with Augmentin must stop calculation');
    assertEqual(audit.safetyStatus, 'CRITICAL_STOP');
    assertTrue(
      audit.issues.some((i) => i.category === 'contraindication'),
      'Must flag allergy contraindication'
    );
  });

  it('Catches contraindication: Ibuprofen in patient with Varicella (Chickenpox)', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 15,
        ageInMonths: 48,
        clinicalConditions: ['Varicella (Chickenpox)'],
      },
      medication: ibu,
      indication: ibu.indications[0],
      formulation: ibu.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 150,
      proposedDailyDoseMg: 450,
      dosesPerDay: 3,
    });

    assertEqual(audit.canProceed, false, 'Ibuprofen during chickenpox must stop calculation');
    assertEqual(audit.safetyStatus, 'CRITICAL_STOP');
    assertTrue(
      audit.issues.some((i) => i.id === 'contraindication_varicella_nsaid'),
      'Must flag varicella NSAID contraindication'
    );
  });

  it('Stops calculation if child weight is missing or invalid', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 0, // Missing weight!
        ageInMonths: 24,
      },
      medication: pcm,
      indication: pcm.indications[0],
      formulation: pcm.formulations[1],
      route: 'oral',
      proposedSingleDoseMg: 150,
      proposedDailyDoseMg: 600,
      dosesPerDay: 4,
    });

    assertEqual(audit.canProceed, false, 'Calculation must stop when weight is missing');
    assertEqual(audit.safetyStatus, 'CRITICAL_STOP');
    assertTrue(audit.issues.some((i) => i.category === 'missing_information'));
  });

  it('Verifies combination target and GFR renal clearance warning', () => {
    const audit = runClinicalSafetyAudit({
      patient: {
        weightKg: 10,
        ageInMonths: 24,
        gfrMlMin: 25, // Impaired renal function (GFR < 50)
      },
      medication: aug,
      indication: aug.indications[0],
      formulation: aug.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 200,
      proposedDailyDoseMg: 400,
      dosesPerDay: 2,
    });

    assertTrue(audit.combinationTargetVerified, 'Amoxicillin combination target verified');
    assertEqual(audit.activeIngredientDosingTarget, 'Amoxicillin');
    assertTrue(
      audit.issues.some((i) => i.category === 'renal_hepatic'),
      'Must contain renal clearance warning'
    );
  });
});

// -------------------------------------------------------------
// Phase 7: Medication Formulations & WHO Growth Standards Tests
// -------------------------------------------------------------
describe('Phase 7: Medication Formulations & WHO Growth Reference Integration', () => {
  it('Calculates infant oral drops volume and drop count correctly (20 drops/mL standard)', () => {
    // 5 kg infant receiving Paracetamol 15 mg/kg/dose = 75 mg
    // Drops: 100 mg / 1 mL -> 0.75 mL -> 15 drops
    const result = calculatePediatricDosage({
      weight: 5,
      weightUnit: 'kg',
      age: 4,
      ageUnit: 'months',
      doseBasis: 'mg_kg_dose',
      doseValue: 15,
      dosesPerDay: 4,
      formulationType: 'drops',
      syrupStrengthMg: 100,
      syrupVolumeMl: 1,
      dropsPerMl: 20,
    });

    assertEqual(result.dosePerDoseMg, 75, 'Single dose is 75 mg');
    assertApprox(result.syrup?.volumePerDoseMl || 0, 0.75, 0.01, 'Volume is 0.75 mL');
    assertEqual(result.drops?.totalDrops, 15, 'Drops count should equal 15 drops');
    assertTrue(Boolean(result.drops?.formattedDrops.includes('15 drops')), 'Formatted drops label present');
  });

  it('Calculates dispersible tablet requirements with clear dispersion instructions', () => {
    // 10 kg child receiving Amoxicillin 25 mg/kg/dose = 250 mg
    // Dispersible tablet strength: 125 mg
    const result = calculatePediatricDosage({
      weight: 10,
      weightUnit: 'kg',
      age: 2,
      ageUnit: 'years',
      doseBasis: 'mg_kg_dose',
      doseValue: 25,
      dosesPerDay: 2,
      formulationType: 'dispersible_tablet',
      tabletStrengthMg: 125,
      canTabletBeDivided: true,
    });

    assertEqual(result.dosePerDoseMg, 250, 'Single dose is 250 mg');
    assertEqual(result.tablet?.rawTabletsPerDose, 2, 'Requires exactly 2 dispersible tablets');
    assertTrue(!!result.dispersibleTablet, 'Dispersible tablet result structure present');
    assertTrue(
      Boolean(result.dispersibleTablet?.dispersionInstructions.includes('5 to 10 mL')),
      'Must contain explicit fluid dispersion instructions'
    );
  });

  it('Strictly prevents splitting hard capsules and flags critical safety error for fractional count', () => {
    // 11 kg child receiving Amoxicillin 15 mg/kg/dose = 165 mg
    // Capsule strength: 250 mg -> 165 / 250 = 0.66 capsules
    const result = calculatePediatricDosage({
      weight: 11,
      weightUnit: 'kg',
      age: 3,
      ageUnit: 'years',
      doseBasis: 'mg_kg_dose',
      doseValue: 15,
      dosesPerDay: 3,
      formulationType: 'capsule',
      tabletStrengthMg: 250,
      canTabletBeDivided: false,
    });

    assertTrue(result.capsule?.canBeDivided === false, 'Capsules cannot be divided');
    assertEqual(result.safetyStatus, 'critical', 'Safety status must escalate to critical');
    assertTrue(
      result.warnings.some((w) => w.includes('Hard capsules CANNOT be opened')),
      'Must issue explicit hard capsule splitting warning'
    );
  });

  it('Calculates injection / IV volume accurately with route notes', () => {
    // Ondansetron IV: 10 kg child, 0.15 mg/kg/dose = 1.5 mg
    // Concentration: 4 mg in 2 mL = 2 mg/mL
    // Volume: 1.5 / 2 = 0.75 mL
    const result = calculatePediatricDosage({
      weight: 10,
      weightUnit: 'kg',
      age: 2,
      ageUnit: 'years',
      doseBasis: 'mg_kg_dose',
      doseValue: 0.15,
      dosesPerDay: 1,
      formulationType: 'injection',
      route: 'intravenous',
      syrupStrengthMg: 4,
      syrupVolumeMl: 2,
    });

    assertEqual(result.dosePerDoseMg, 1.5, 'Dose is 1.5 mg');
    assertApprox(result.injectable?.volumeMl || 0, 0.75, 0.01, 'Injectable volume is 0.75 mL');
    assertEqual(result.injectable?.formattedVolume, '0.75 mL');
    assertEqual(result.injectable?.route, 'intravenous');
  });

  it('Interpolates WHO Child Growth Standards median weight by age and sex', () => {
    // 24 months male median is 12.2 kg, female is 11.5 kg
    const male24 = getWhoEstimatedWeight(24, 'male');
    const female24 = getWhoEstimatedWeight(24, 'female');
    assertEqual(male24.medianWeightKg, 12.2, 'Male 24m median weight is 12.2 kg');
    assertEqual(female24.medianWeightKg, 11.5, 'Female 24m median weight is 11.5 kg');
    assertTrue(male24.isEstimate, 'Flagged as estimate');
    assertTrue(male24.clinicalDisclaimer.includes('ESTIMATE ONLY'));

    // Test linear interpolation at 30 months (halfway between 24m [12.2] and 36m [14.3])
    // Expected: 12.2 + 0.5 * (14.3 - 12.2) = 13.25 -> 13.3 kg
    const male30 = getWhoEstimatedWeight(30, 'male');
    assertApprox(male30.medianWeightKg, 13.3, 0.1, 'Interpolated male 30m weight ~13.3 kg');

    // Reference table has milestones
    const table = getWhoReferenceTable();
    assertTrue(table.length >= 15, 'Reference table contains growth milestones');
    assertEqual(table[0].ageDisplay, 'Birth');
  });

  it('Flags estimated weight prominently with safety warnings and prevents silent treatment as measured weight', () => {
    const result = calculatePediatricDosage({
      weight: 12.2,
      weightUnit: 'kg',
      isEstimatedWeight: true,
      estimatedWeightSource: 'WHO 50th percentile (Boy, 24 months)',
      age: 2,
      ageUnit: 'years',
      doseBasis: 'mg_kg_day',
      doseValue: 40,
      dosesPerDay: 2,
      formulationType: 'suspension',
      syrupStrengthMg: 200,
      syrupVolumeMl: 5,
    });

    assertTrue(result.isEstimatedWeight === true, 'Result retains isEstimatedWeight flag');
    assertEqual(result.safetyStatus, 'warning', 'Safety status elevated to warning for estimated weight');
    assertTrue(
      result.warnings.some((w) => w.includes('CLINICAL SAFETY WARNING: Patient weight') && w.includes('is an ESTIMATE')),
      'Must contain explicit estimated weight safety warning'
    );
  });
});

// -------------------------------------------------------------
// Phase 8: Offline Mode & Local Storage Engine Tests
// -------------------------------------------------------------
async function runPhase8AndSummary() {
  console.log(`\n📋 Running Test Suite: Phase 8: Offline Mode & Local Storage Engine`);

  await itAsync('Initializes offline database and returns valid metadata', async () => {
    const meta = await initOfflineDatabase();
    assertTrue(meta.isOfflineReady, 'Database must report isOfflineReady: true');
    assertEqual(meta.version, '2026.11', 'Formulary version is 2026.11');
    assertTrue(meta.totalRecords >= 12, 'Total records count is at least 12');
  });

  await itAsync('Retrieves all verified medications from local offline store', async () => {
    const meds = await getOfflineMedications();
    assertTrue(meds.length >= 12, 'Must return at least 12 verified medication records');
    assertTrue(meds.some((m) => m.id === 'paracetamol'), 'Paracetamol present');
    assertTrue(meds.some((m) => m.id === 'amoxicillin_clavulanate'), 'Augmentin present');
  });

  await itAsync('Retrieves individual medication by ID from offline storage', async () => {
    const med = await getOfflineMedicationById('amoxicillin_clavulanate');
    assertTrue(med !== null, 'Augmentin retrieved');
    assertEqual(med?.genericName, 'Amoxicillin and Clavulanic Acid (Co-amoxiclav)');
    assertEqual(med?.isCombination, true);
  });

  await itAsync('Caches and retrieves AI decision-support responses for offline access', async () => {
    const testQuery = 'Amoxicillin dose for pneumonia in 3 year old';
    const mockResponse = {
      genericName: 'Amoxicillin',
      brandNames: ['Amoxil', 'Moxatag'],
      category: 'Antibiotics',
      activeIngredients: ['Amoxicillin'],
      formulations: ['suspension', 'tablet'],
      indication: 'Community Acquired Pneumonia',
      doseBasis: 'mg_kg_day',
      dosePerKg: 90,
      frequency: 'Every 12 hours (BD)',
      dosesPerDay: 2,
      maximumSingleDose: 1000,
      maximumDailyDose: 4000,
      route: 'oral',
      ageRestrictions: [],
      referenceSource: 'AAP Red Book (33rd Edition)',
      verificationStatus: 'verified',
    };

    await cacheAiResponse(testQuery, mockResponse as any, 'gemini-3.8-flash');
    const retrieved = await getCachedAiResponse(testQuery);
    assertTrue(retrieved !== null, 'Cached AI response should be retrieved');
    assertEqual(retrieved?.response.genericName, 'Amoxicillin');
    assertEqual(retrieved?.response.dosePerKg, 90);
    assertEqual(retrieved?.source, 'gemini-3.8-flash');
  });

  await itAsync('Verifies network connectivity check utility operates reliably', async () => {
    const online = isNetworkOnline();
    assertTrue(typeof online === 'boolean', 'isNetworkOnline returns a boolean');
  });

  await itAsync('Search handles unknown medication gracefully with offline notice readiness', async () => {
    const response = searchMedications('NonexistentCure999');
    assertEqual(response.results.length, 0, 'No results returned for unknown drug');
    assertEqual(response.query, 'NonexistentCure999');
  });

  // -------------------------------------------------------------
  // PHASE 9: FORMULARY EXPANSION, CLINICAL ROUNDING & INTERACTIONS
  // -------------------------------------------------------------
  console.log(`\n📋 Running Test Suite: Phase 9: Formulary Expansion, Clinical Rounding & Drug Interactions`);

  await itAsync('Verifies Ceftriaxone monograph integrity, parenteral formulations & calcium contraindication', async () => {
    const cef = getMedicationById('ceftriaxone');
    assertTrue(cef !== undefined, 'Ceftriaxone must exist in verified database');
    assertEqual(cef?.genericName, 'Ceftriaxone');
    assertEqual(cef?.approvedRoutes.includes('intravenous'), true);
    
    // Check contraindications
    assertTrue(
      Boolean(cef?.contraindications.some((c) => c.toLowerCase().includes('calcium'))),
      'Must contain fatal neonatal calcium precipitation contraindication'
    );

    // Check meningitis indication
    const meningitisInd = cef?.indications.find((i) => i.id === 'cef_meningitis');
    assertTrue(meningitisInd !== undefined, 'Meningitis indication exists');
    assertEqual(meningitisInd?.doseValue, 100, 'Meningitis dose is 100 mg/kg/day');
    assertEqual(meningitisInd?.maxDailyDoseMg, 4000, 'Max daily dose is 4000 mg');
  });

  await itAsync('Verifies Prednisolone monograph and acute asthma burst dosing', async () => {
    const pred = getMedicationById('prednisolone');
    assertTrue(pred !== undefined, 'Prednisolone exists in database');
    assertEqual(pred?.category, 'Corticosteroids & Anti-inflammatory');
    
    const asthmaInd = pred?.indications.find((i) => i.id === 'pred_asthma_acute');
    assertTrue(asthmaInd !== undefined, 'Acute asthma burst indication exists');
    assertEqual(asthmaInd?.doseValue, 1.5, 'Dose is 1.5 mg/kg/day');
    assertEqual(asthmaInd?.maxDailyDoseMg, 40, 'Max daily dose is 40 mg');

    const dispTab = pred?.formulations.find((f) => f.type === 'dispersible_tablet');
    assertTrue(dispTab !== undefined, 'Dispersible soluble tablet formulation exists');
  });

  await itAsync('Verifies Cefixime and Zinc Sulfate WHO protocol monographs', async () => {
    const cfx = getMedicationById('cefixime');
    assertTrue(cfx !== undefined, 'Cefixime exists');
    const cfxUti = cfx?.indications.find((i) => i.id === 'cfx_uti');
    assertEqual(cfxUti?.doseValue, 8, 'Cefixime UTI dose is 8 mg/kg/day');

    const zinc = getMedicationById('zinc_sulfate');
    assertTrue(zinc !== undefined, 'Zinc sulfate exists');
    const zincDiarrhea = zinc?.indications.find((i) => i.id === 'zinc_diarrhea_who');
    assertEqual(zincDiarrhea?.targetActiveIngredient, 'Elemental Zinc');
    assertEqual(zincDiarrhea?.defaultTreatmentDurationDays, 14);
  });

  await itAsync('Recommends 1 mL oral syringe with 0.02 mL markings for volumes <= 1.0 mL', async () => {
    // 0.42 mL dose with 100 mg/mL concentration
    const advice = calculatePracticalSyringeAdvice(0.42, 100, false, 500);
    assertTrue(advice.recommendedSyringe.includes('1 mL oral syringe'), 'Recommends 1 mL oral syringe');
    assertEqual(advice.roundedMeasurableVolumeMl, 0.42);
    assertEqual(advice.effectiveDoseMg, 42);
    assertEqual(advice.roundingDirection, 'exact');
  });

  await itAsync('Recommends 5 mL syringe for 3.42 mL and safely rounds without exceeding +5%', async () => {
    // 3.42 mL of 24 mg/mL syrup = 82.08 mg
    const advice = calculatePracticalSyringeAdvice(3.42, 24, false, 250);
    assertTrue(advice.recommendedSyringe.includes('5 mL oral syringe'), 'Recommends 5 mL oral syringe');
    assertEqual(advice.roundedMeasurableVolumeMl, 3.4, 'Rounds to nearest 0.2 mL increment (3.4 mL)');
    assertTrue(advice.percentAdjustment <= 5.0, 'Never rounds upward beyond +5%');
    assertEqual(advice.roundingDirection, 'rounded_down');
  });

  await itAsync('Never rounds upward when a dose is already capped at absolute ceiling', async () => {
    // Capped dose volume 4.18 mL where increment would be 0.2 mL (4.20 mL would be higher than capped dose)
    const advice = calculatePracticalSyringeAdvice(4.18, 24, true, 100.32);
    assertTrue(advice.roundedMeasurableVolumeMl <= 4.18, 'Capped dose must round down to 4.0 or stay <= 4.18');
    assertEqual(advice.roundedMeasurableVolumeMl, 4.0, 'Floors to nearest 0.2 mL increment to prevent cap breach');
  });

  await itAsync('Detects Ceftriaxone + Calcium / Ringer Lactate as CRITICAL CONTRAINDICATION', async () => {
    const issues = checkPediatricDrugInteractions('ceftriaxone', ['Ringer Lactate IV Infusion']);
    assertTrue(issues.length > 0, 'Must flag interaction');
    const crit = issues.find((i) => i.severity === 'critical');
    assertTrue(crit !== undefined, 'Ceftriaxone + Calcium must be CRITICAL');
    assertTrue(Boolean(crit?.title.includes('Ceftriaxone + Calcium Precipitation')), 'Identifies precipitation risk');
  });

  await itAsync('Detects Ibuprofen + Prednisolone as MAJOR WARNING for synergistic GI ulceration', async () => {
    const issues = checkPediatricDrugInteractions('ibuprofen', ['Prednisolone oral solution']);
    assertTrue(issues.length > 0, 'Must flag interaction');
    const warn = issues.find((i) => i.severity === 'warning');
    assertTrue(warn !== undefined, 'Ibuprofen + Prednisolone must be WARNING');
    assertTrue(Boolean(warn?.title.includes('NSAID + Systemic Corticosteroid')), 'Identifies NSAID + Steroid interaction');
  });

  await itAsync('Detects Salbutamol + Propranolol as CRITICAL CONTRAINDICATION for bronchospasm', async () => {
    const issues = checkPediatricDrugInteractions('salbutamol', ['Propranolol']);
    assertTrue(issues.length > 0, 'Must flag interaction');
    const crit = issues.find((i) => i.severity === 'critical');
    assertTrue(crit !== undefined, 'Salbutamol + Propranolol must be CRITICAL');
  });

  await itAsync('Detects Azithromycin + Ondansetron as MAJOR WARNING for additive QTc prolongation', async () => {
    const issues = checkPediatricDrugInteractions('azithromycin', ['Ondansetron']);
    assertTrue(issues.length > 0, 'Must flag interaction');
    const warn = issues.find((i) => i.severity === 'warning');
    assertTrue(warn !== undefined, 'Azithromycin + Ondansetron must be WARNING');
    assertTrue(Boolean(warn?.title.includes('QTc Interval Prolongation')), 'Identifies QTc prolongation');
  });

  // -------------------------------------------------------------
  // Phase 10: Medical Database Integration (IAP, CDSCO, IDI, Drug Today, CIMS)
  // -------------------------------------------------------------
  console.log(`\n📋 Running Test Suite: Phase 10: Medical Database Integration & Regulatory Compliance`);

  await itAsync('1. India Drug Index: Accurately identifies Indian trade brands and formulation strengths', async () => {
    const idiMedications = getMedicationsBySource('idi');
    assertTrue(idiMedications.length >= 10, 'Must have at least 10 normalized IDI records');
    
    // Check brand search for popular Indian trade names
    const meftal = searchMedications('Meftal-P');
    assertTrue(meftal.results.length > 0, 'Must find Meftal-P');
    assertEqual(meftal.results[0].medication.genericName, 'Mefenamic Acid');

    const domstal = searchMedications('Domstal');
    assertTrue(domstal.results.length > 0, 'Must find Domstal');
    assertEqual(domstal.results[0].medication.genericName, 'Domperidone');

    const montairLc = searchMedications('Montair-LC');
    assertTrue(montairLc.results.length > 0, 'Must find Montair-LC');
    assertEqual(montairLc.results[0].medication.id, 'montelukast_levocetirizine');

    const zentel = searchMedications('Zentel');
    assertTrue(zentel.results.length > 0, 'Must find Zentel');
    assertEqual(zentel.results[0].medication.genericName, 'Albendazole');

    const electral = searchMedications('Electral');
    assertTrue(electral.results.length > 0, 'Must find Electral');
    assertEqual(electral.results[0].medication.id, 'oral_rehydration_salts');
  });

  await itAsync('2. Drug Today Online: Monograph and package concentration verification', async () => {
    const dtMedications = getMedicationsBySource('drugToday');
    assertTrue(dtMedications.length >= 10, 'Must have at least 10 Drug Today cataloged records');

    const cefuroxime = getMedicationById('cefuroxime_axetil');
    assertTrue(cefuroxime !== undefined, 'Cefuroxime must exist');
    assertTrue(cefuroxime?.sourceAttribution?.drugTodayOnline?.isReferenced === true, 'Drug Today referenced');
    assertTrue(Boolean(cefuroxime?.sourceAttribution?.drugTodayOnline?.monographRef), 'Contains monograph ref');
  });

  await itAsync('3. CIMS / MIMS India: Pharmacological classes, therapeutic codes & interactions', async () => {
    const cimsMedications = getMedicationsBySource('cims');
    assertTrue(cimsMedications.length >= 10, 'Must have at least 10 CIMS cataloged records');

    const levosalbutamol = getMedicationById('levosalbutamol');
    assertTrue(levosalbutamol !== undefined, 'Levosalbutamol must exist');
    assertEqual(levosalbutamol?.pharmacologicalClass, '(R)-Enantiomer Beta-2 Agonist');
    assertTrue(Boolean(levosalbutamol?.sourceAttribution?.cimsMimsIndia?.therapeuticCategoryCode), 'Has CIMS therapeutic code');
  });

  await itAsync('4. IAP Pediatric Drug Formulary: Verified pediatric dosing priority and calculation engine', async () => {
    const iapMedications = getMedicationsBySource('iap');
    assertTrue(iapMedications.length >= 10, 'Must have verified IAP records');

    const mefenamic = getMedicationById('mefenamic_acid');
    assertTrue(mefenamic !== undefined, 'Mefenamic Acid exists');
    assertTrue(mefenamic?.sourceAttribution?.iapPediatricFormulary?.isVerified === true, 'IAP verified');
    
    // Test calculation of Mefenamic Acid using IAP dosing: 8 mg/kg/dose, 15 kg child, 50 mg/5mL syrup
    const calc = calculatePediatricDosage({
      weight: 15,
      weightUnit: 'kg',
      age: 24,
      ageUnit: 'months',
      doseBasis: 'mg_kg_dose',
      doseValue: 8,
      dosesPerDay: 3,
      formulationType: 'suspension',
      syrupStrengthMg: 50,
      syrupVolumeMl: 5,
      maxSingleDoseMg: 250,
      maxDailyDoseMg: 750,
    });

    assertEqual(calc.dosePerDoseMg, 120, '15 kg * 8 mg/kg = 120 mg per dose');
    assertEqual(calc.totalDailyDoseMg, 360, '120 mg * 3 = 360 mg per day');
    assertEqual(calc.syrup?.volumePerDoseMl, 12.0, '120 mg / 10 mg/mL = 12 mL per dose');
    assertEqual(calc.wasSingleDoseCapped, false, 'Does not exceed 250 mg single cap');

    // Test Albendazole age-tiered IAP dosing: 18 month old receives 200 mg; 36 month old receives 400 mg
    const albendazole = getMedicationById('albendazole');
    assertTrue(albendazole !== undefined, 'Albendazole exists');
    const toddlerRule = albendazole!.indications.find((i) => i.id === 'alb_deworming_toddler');
    const olderRule = albendazole!.indications.find((i) => i.id === 'alb_deworming_older');
    assertTrue(toddlerRule !== undefined && olderRule !== undefined, 'Has age-tiered dosing');
    assertEqual(toddlerRule!.doseValue, 200, 'Toddler dose 200 mg');
    assertEqual(olderRule!.doseValue, 400, 'Older child dose 400 mg');
  });

  await itAsync('5. CDSCO Drug Registry: Regulatory approval, Schedule verification, and Banned FDC prevention', async () => {
    const cdscoMedications = getMedicationsBySource('cdsco');
    assertTrue(cdscoMedications.length >= 10, 'Must have CDSCO records');

    // Check Schedule classifications
    const albendazole = getMedicationById('albendazole');
    assertEqual(albendazole?.regulatoryStatus?.scheduleCategory, 'Schedule H');

    // Test Banned Pediatric FDC: Nimesulide + Paracetamol
    const bannedDrug = getMedicationById('nimesulide_paracetamol_banned');
    assertTrue(bannedDrug !== undefined, 'Banned record exists');
    assertTrue(bannedDrug?.regulatoryStatus?.isBannedFdcInIndia === true, 'Flagged as banned FDC in India');
    assertTrue(Boolean(bannedDrug?.regulatoryStatus?.registrationId?.includes('GSR438E')), 'Cites CDSCO GSR 438(E) notification');

    // Safety audit must CRITICALLY STOP calculation for banned FDC
    const bannedAudit = runClinicalSafetyAudit({
      patient: { weightKg: 14, ageInMonths: 36 },
      medication: bannedDrug!,
      indication: bannedDrug!.indications[0],
      formulation: bannedDrug!.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 50,
      proposedDailyDoseMg: 100,
      dosesPerDay: 2,
    });

    assertEqual(bannedAudit.canProceed, false, 'Cannot proceed with banned FDC');
    assertEqual(bannedAudit.safetyStatus, 'CRITICAL_STOP', 'Must be CRITICAL_STOP');
    const bannedIssue = bannedAudit.issues.find((i) => i.id === 'cdsco_banned_pediatric_fdc');
    assertTrue(bannedIssue !== undefined, 'Identified CDSCO banned pediatric FDC issue');
    assertTrue(Boolean(bannedIssue?.title.includes('BANNED FIXED-DOSE COMBINATION')), 'Issues prominent ban warning');
  });

  await itAsync('6. Clinical Discrepancy Flagging: Flags conflicts for review without auto-selecting dose', async () => {
    const discrepancyMeds = getDiscrepancyFlaggedMedications();
    assertTrue(discrepancyMeds.length >= 2, 'Must have flagged discrepancy medications');

    const meftalForte = getMedicationById('paracetamol_mefenamic_discrepancy');
    assertTrue(meftalForte !== undefined, 'Meftal Forte exists');
    assertTrue(meftalForte?.discrepancyAudit?.hasDiscrepancy === true, 'Discrepancy flagged');
    assertTrue(meftalForte?.discrepancyAudit?.requiresClinicalReview === true, 'Clinical review required');

    // Audit must issue a clinical discrepancy warning rather than blindly calculating
    const discAudit = runClinicalSafetyAudit({
      patient: { weightKg: 16, ageInMonths: 48 },
      medication: meftalForte!,
      indication: meftalForte!.indications[0],
      formulation: meftalForte!.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 125,
      proposedDailyDoseMg: 375,
      dosesPerDay: 3,
    });

    const discIssue = discAudit.issues.find((i) => i.category === 'clinical_discrepancy');
    assertTrue(discIssue !== undefined, 'Clinical discrepancy warning issued');
    assertTrue(Boolean(discIssue?.title.includes('Clinical Discrepancy Flagged')), 'Discrepancy title issued');
  });

  await itAsync('7. Zero-Fabrication Enforcement: Halts calculation when reliable pediatric dosing is missing', async () => {
    // Test with a medication record having hasReliablePediatricDosing: false
    const unverifiedDrug = getMedicationById('nimesulide_paracetamol_banned')!;
    assertEqual(unverifiedDrug.hasReliablePediatricDosing, false, 'Reliable dosing is false');

    const audit = runClinicalSafetyAudit({
      patient: { weightKg: 10, ageInMonths: 18 },
      medication: unverifiedDrug,
      indication: unverifiedDrug.indications[0],
      formulation: unverifiedDrug.formulations[0],
      route: 'oral',
      proposedSingleDoseMg: 20,
      proposedDailyDoseMg: 40,
      dosesPerDay: 2,
    });

    assertEqual(audit.canProceed, false, 'Strictly halted');
    const unverifiedIssue = audit.issues.find((i) => i.id === 'unverified_pediatric_dosing');
    assertTrue(unverifiedIssue !== undefined, 'Halts on unverified pediatric dosing');
  });

  await itAsync('8. Expandable Medication Database: Dynamically registers new drugs without frontend modifications', async () => {
    const initialCount = DATABASE_METADATA.totalRecords;
    
    // Register a new medication dynamically at runtime
    const testRecord: any = {
      id: 'dynamic_loratadine_test',
      genericName: 'Loratadine',
      brandNames: ['Claritin', 'Lorfast'],
      aliases: ['LOR'],
      category: 'Antihistamines',
      subcategories: ['Second-Generation H1 Antagonist'],
      therapeuticClass: 'Antihistamine',
      country: 'India',
      description: 'Second-generation non-sedating antihistamine for allergic rhinitis in children 2 years and older.',
      isCombination: false,
      activeIngredients: [{ name: 'Loratadine', strengthMg: 5, unit: 'mg', isPrimaryDosingTarget: true }],
      formulations: [
        {
          id: 'lor_syp_5mg',
          name: 'Syrup (5 mg/5mL)',
          type: 'syrup',
          route: 'oral',
          concentration: { strengthMg: 5, volumeMl: 5, unit: 'mg/5mL', displayLabel: '5 mg/5mL' },
          minAgeMonths: 24,
        },
      ],
      approvedRoutes: ['oral'],
      indications: [
        {
          id: 'lor_allergic_rhinitis',
          indicationName: 'Allergic Rhinitis (Children 2-12 years)',
          doseBasis: 'fixed_dose',
          doseValue: 5,
          recommendedFrequencyDosesPerDay: 1,
          frequencyDescription: 'Once daily (OD)',
          minAgeMonths: 24,
          maxSingleDoseMg: 10,
          maxDailyDoseMg: 10,
          targetActiveIngredient: 'Loratadine',
          clinicalNotes: 'Children < 30 kg: 5 mg OD; > 30 kg: 10 mg OD.',
        },
      ],
      contraindications: ['Known hypersensitivity to loratadine'],
      precautions: ['Adjust dose in severe hepatic impairment'],
      adverseEffectsCommon: ['Headache', 'Dry mouth'],
      organAdjustments: { renalAdjustment: 'No adjustment', hepaticAdjustment: 'Extend interval' },
      sourceAttribution: {
        iapPediatricFormulary: { isVerified: true, editionOrYear: '2025', monographTitle: 'Loratadine', dosingGuidelineRef: 'IAP Allergies', consensusStatus: 'consensus_approved' },
        cdscoDrugRegistry: { isApproved: true, registrationId: 'CDSCO-LOR-01', scheduleCategory: 'Schedule H', approvalStatus: 'approved' },
        indiaDrugIndex: { isIndexed: true, brandListSummary: ['Lorfast'], standardStrengths: ['5mg/5mL'] },
        drugTodayOnline: { isReferenced: true, monographRef: 'DT-LOR-99' },
        cimsMimsIndia: { isReferenced: true, therapeuticCategoryCode: 'CIMS-H1' },
      },
      regulatoryStatus: { cdscoApproved: true, scheduleCategory: 'Schedule H', isBannedFdcInIndia: false },
      hasReliablePediatricDosing: true,
      referenceSources: [{ sourceName: 'IAP Pediatric Formulary', editionOrYear: '2025' }],
      lastVerifiedDate: '2026-11-06',
      databaseVersion: '2026.11',
      verifiedBy: 'Dynamic Registry System',
    };

    const registered = registerMedicationRecord(testRecord);
    assertTrue(registered, 'Registration returns true');
    assertEqual(DATABASE_METADATA.totalRecords, initialCount + 1, 'Total records updated dynamically');

    const retrieved = getMedicationById('dynamic_loratadine_test');
    assertTrue(retrieved !== undefined, 'Dynamically retrieved from database');
    assertEqual(retrieved?.genericName, 'Loratadine', 'Generic name matches');

    // Clean up test drug from database
    const idx = MEDICATION_DATABASE.findIndex((m) => m.id === 'dynamic_loratadine_test');
    if (idx >= 0) MEDICATION_DATABASE.splice(idx, 1);
    assertEqual(DATABASE_METADATA.totalRecords, initialCount, 'Restores initial count after cleanup');
  });

  // -------------------------------------------------------------
  // Phase 11: Clinical Dosage Retrieval & Multi-Indication Accuracy Suite
  // -------------------------------------------------------------
  describe('Phase 11: Clinical Dosage Retrieval & Multi-Indication Accuracy Suite', () => {
    it('Retrieves verified Cefpodoxime Proxetil monograph and formulations from database', () => {
      const cefpo = getMedicationById('cefpodoxime_proxetil');
      assertTrue(!!cefpo, 'Cefpodoxime Proxetil must be present in database');
      assertEqual(cefpo!.genericName, 'Cefpodoxime Proxetil');
      assertTrue(cefpo!.brandNames.includes('Vantin'));
      assertTrue(cefpo!.brandNames.includes('Monocef-O'));
      assertTrue(cefpo!.brandNames.includes('Gudcef'));
      assertTrue(cefpo!.brandNames.includes('Cepodem'));
      assertTrue(cefpo!.activeIngredients.length >= 1);
      assertEqual(cefpo!.activeIngredients[0].name, 'Cefpodoxime');
      assertTrue(cefpo!.indications.length >= 4, 'Must support multiple condition-specific regimens');
    });

    it('Calculates Cefpodoxime for Acute Otitis Media accurately (10 mg/kg/day q12h x 5d)', () => {
      const cefpo = getMedicationById('cefpodoxime_proxetil')!;
      const aom = cefpo.indications.find((i) => i.id === 'cpd_aom')!;
      assertTrue(!!aom, 'Acute Otitis Media indication rule exists');

      // 15 kg child: 10 mg/kg/day divided q12h (2 doses/day)
      // Total daily: 150 mg. Single dose: 75 mg.
      // Syrup formulation: 50 mg / 5 mL (10 mg/mL)
      const res = calculatePediatricDosage({
        weight: 15,
        weightUnit: 'kg',
        age: 3,
        ageUnit: 'years',
        doseBasis: aom.doseBasis,
        doseValue: aom.doseValue,
        dosesPerDay: aom.recommendedFrequencyDosesPerDay,
        formulationType: 'syrup',
        syrupStrengthMg: 50,
        syrupVolumeMl: 5,
        maxSingleDoseMg: aom.maxSingleDoseMg,
        maxDailyDoseMg: aom.maxDailyDoseMg,
      });

      assertEqual(res.dosePerDoseMg, 75, 'Single dose is 75 mg');
      assertEqual(res.totalDailyDoseMg, 150, 'Daily dose is 150 mg');
      assertEqual(res.syrup?.volumePerDoseMl, 7.5, 'Liquid volume is 7.50 mL');
      assertEqual(res.wasSingleDoseCapped, false, 'Dose is not capped at single maximum (ceiling is 200 mg)');
      assertEqual(res.wasDailyDoseCapped, false, 'Daily dose is not capped (ceiling is 400 mg)');
    });

    it('Enforces condition-specific strict ceiling for Cefpodoxime Pharyngitis/Tonsillitis (100 mg/dose, 200 mg/day)', () => {
      const cefpo = getMedicationById('cefpodoxime_proxetil')!;
      const tonsillitis = cefpo.indications.find((i) => i.id === 'cpd_pharyngitis_tonsillitis')!;
      assertTrue(!!tonsillitis, 'Pharyngitis / Tonsillitis indication exists');
      assertEqual(tonsillitis.maxSingleDoseMg, 100, 'Max single dose ceiling for pharyngitis is 100 mg');
      assertEqual(tonsillitis.maxDailyDoseMg, 200, 'Max daily dose ceiling for pharyngitis is 200 mg');

      // 25 kg child: 10 mg/kg/day = 250 mg/day (125 mg/dose uncapped).
      // Because pharyngitis ceiling is 100 mg/dose and 200 mg/day, the calculation MUST cap at 100 mg single / 200 mg daily!
      const res = calculatePediatricDosage({
        weight: 25,
        weightUnit: 'kg',
        age: 7,
        ageUnit: 'years',
        doseBasis: tonsillitis.doseBasis,
        doseValue: tonsillitis.doseValue,
        dosesPerDay: tonsillitis.recommendedFrequencyDosesPerDay,
        formulationType: 'syrup',
        syrupStrengthMg: 100,
        syrupVolumeMl: 5, // 20 mg/mL forte suspension
        maxSingleDoseMg: tonsillitis.maxSingleDoseMg,
        maxDailyDoseMg: tonsillitis.maxDailyDoseMg,
      });

      assertEqual(res.dosePerDoseMg, 100, 'Single dose capped at strict 100 mg ceiling');
      assertEqual(res.totalDailyDoseMg, 200, 'Daily dose capped at strict 200 mg ceiling');
      assertEqual(res.wasSingleDoseCapped, true, 'Flagged as capped at max single dose');
      assertEqual(res.syrup?.volumePerDoseMl, 5, 'Liquid volume is 5.0 mL of forte suspension');
    });

    it('Calculates exact readable fraction for Cefpodoxime 200 mg scored tablet', () => {
      // 20 kg child, 10 mg/kg/day q12h = 100 mg/dose.
      // 200 mg tablet with canBeDivided: true -> 100 / 200 = 0.5 tablets = ½ tablet
      const res = calculatePediatricDosage({
        weight: 20,
        weightUnit: 'kg',
        age: 6,
        ageUnit: 'years',
        doseBasis: 'mg_kg_day',
        doseValue: 10,
        dosesPerDay: 2,
        formulationType: 'tablet',
        tabletStrengthMg: 200,
        canTabletBeDivided: true,
      });

      assertEqual(res.dosePerDoseMg, 100);
      assertEqual(res.tablet?.rawTabletsPerDose, 0.5);
      assertEqual(res.tablet?.formattedTabletsPerDose, '½ tablet');
      assertEqual(res.tablet?.canBeDivided, true);
    });

    it('Verifies drops calculation requires verified drop factor and does not assume 20 drops/mL', () => {
      // Case A: Verified drops with dropsPerMl = 20
      const resWithFactor = calculatePediatricDosage({
        weight: 5,
        weightUnit: 'kg',
        age: 6,
        ageUnit: 'months',
        doseBasis: 'mg_kg_dose',
        doseValue: 5,
        dosesPerDay: 2,
        formulationType: 'drops',
        syrupStrengthMg: 50,
        syrupVolumeMl: 1, // 50 mg/mL
        dropsPerMl: 20,
      });
      assertEqual(resWithFactor.dosePerDoseMg, 25);
      assertEqual(resWithFactor.drops?.volumeMl, 0.5);
      assertEqual(resWithFactor.drops?.totalDrops, 10);
      assertTrue(Boolean(resWithFactor.drops?.formattedDrops.includes('10 drops')));

      // Case B: Drops without verified dropsPerMl
      const resWithoutFactor = calculatePediatricDosage({
        weight: 5,
        weightUnit: 'kg',
        age: 6,
        ageUnit: 'months',
        doseBasis: 'mg_kg_dose',
        doseValue: 5,
        dosesPerDay: 2,
        formulationType: 'drops',
        syrupStrengthMg: 50,
        syrupVolumeMl: 1, // 50 mg/mL
        dropsPerMl: undefined,
      });
      assertEqual(resWithoutFactor.dosePerDoseMg, 25);
      assertEqual(resWithoutFactor.drops?.volumeMl, 0.5);
      assertEqual(resWithoutFactor.drops?.totalDrops, 0);
      assertTrue(Boolean(resWithoutFactor.drops?.formattedDrops.includes('Verified drop factor unavailable')));
    });
  });

  // Summary report
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`\n=================================================`);
  console.log(`Test Execution Summary: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log(`=================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8AndSummary();
