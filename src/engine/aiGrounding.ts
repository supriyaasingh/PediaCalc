/**
 * PediDose AI Grounding & Strict Schema Formatter
 * Connects natural language queries to verified clinical database entries.
 * Enforces zero-fabrication rules: strictly binds to verified pediatric records.
 */

import { MEDICATION_DATABASE } from '../data/medicationDatabase.ts';
import { IndicationDosingRule, MedicationRecord } from '../types/medication.ts';
import {
  AvailableIndicationOption,
  ExtractedQueryEntities,
  PatientCalculationPreview,
  StructuredMedicationAiResponse,
} from '../types/ai.ts';
import { searchMedications } from './search.ts';

/**
 * Recognizes and provides clinical explanations for pediatric pharmacological concepts
 * e.g., "difference between mg/kg/day and mg/kg/dose"
 */
export function resolveClinicalConcept(query: string): StructuredMedicationAiResponse | null {
  const q = query.toLowerCase();

  const isDoseBasisComparison =
    (q.includes('mg/kg/day') || q.includes('mg/kg/d') || q.includes('per day')) &&
    (q.includes('mg/kg/dose') || q.includes('per dose')) &&
    (q.includes('difference') || q.includes('vs') || q.includes('versus') || q.includes('compare') || q.includes('what'));

  const isGeneralDoseBasisQuery =
    q.includes('difference between mg/kg/day and mg/kg/dose') ||
    q.includes('mg/kg/day vs mg/kg/dose') ||
    q.includes('mg/kg/dose vs mg/kg/day') ||
    (q.includes('what is the difference') && q.includes('mg/kg'));

  if (isDoseBasisComparison || isGeneralDoseBasisQuery) {
    return {
      genericName: 'Pediatric Pharmacology Concept: mg/kg/day vs. mg/kg/dose',
      brandNames: ['Clinical Dosing Methodology'],
      category: 'Pharmacological Dosing Principles',
      activeIngredients: ['Cumulative Daily Exposure', 'Single Bolus Exposure'],
      formulations: ['N/A — Mathematical & Clinical Concept'],
      indication: 'Pediatric Dose Calculation Safety & Verification',
      doseBasis: 'Comparative Protocol (mg/kg/day vs mg/kg/dose)',
      dosePerKg: null,
      frequency: 'Varies by drug half-life and therapeutic index',
      dosesPerDay: null,
      maximumSingleDose: null,
      maximumDailyDose: null,
      route: 'All routes (Oral, IV, IM, PR)',
      ageRestrictions: ['Applies across all pediatric cohorts (Neonates to Adolescents)'],
      referenceSource: 'World Health Organization (WHO) Model Formulary for Children; BNF for Children; AAP Pediatric Clinical Practice Guidelines',
      verificationStatus: 'Verified Pediatric Clinical Pharmacokinetics Standard',
      queryType: 'clinical_concept',
      conceptTitle: 'mg/kg/day (Total Daily Dose) vs. mg/kg/dose (Per-Administration Dose)',
      conceptExplanation:
        'Understanding dose basis is paramount in pediatrics to avert catastrophic medication errors. "mg/kg/day" represents the total cumulative drug quantity prescribed over 24 hours, which MUST be divided into equal fractional doses (e.g. 40 mg/kg/day divided twice daily = 20 mg/kg/dose). Conversely, "mg/kg/dose" specifies the exact quantity given at each single administration event (e.g. Paracetamol 15 mg/kg/dose every 4-6 hours).',
      conceptKeyPoints: [
        'mg/kg/day (Cumulative Daily Dose): Total 24-hour drug quantity. Requires dividing by the dosing frequency (e.g. 90 mg/kg/day divided BID = 45 mg/kg administered every 12 hours).',
        'mg/kg/dose (Per-Administration Dose): The exact amount administered at each single dose interval. Never divide this number further.',
        'CRITICAL SAFETY WARNING: Administering an mg/kg/day value at each dosing interval causes a 2x, 3x, or 4x acute overdose. Always check the dose basis label before dispensing.',
        'Prescription Best Practice: Specify both the dose basis AND the resulting per-dose milligram and liquid milliliter amount in written pediatric orders.',
      ],
      clinicalSummary:
        'mg/kg/day is the total 24-hour drug requirement divided across scheduled daily administrations. mg/kg/dose is the exact quantity given at each single administration event.',
      warnings: [
        'HIGH-RISK PITFALL: Confusing mg/kg/day with mg/kg/dose is one of the most frequent causes of ten-fold or multi-fold pediatric dosing overdoses.',
      ],
      clinicalExplanation:
        'In pediatric medicine, antimicrobial agents are frequently dosed in mg/kg/day (e.g., Amoxicillin 80-90 mg/kg/day divided q12h), whereas antipyretics and analgesics are dosed in mg/kg/dose (e.g., Paracetamol 15 mg/kg/dose q4-6h prn).',
    };
  }

  return null;
}

/**
 * Extracts structured clinical entities (weight, age, indication, route, drug candidate)
 * from a doctor's natural language query using regex pattern matching.
 */
export function extractEntitiesFromQuery(query: string): ExtractedQueryEntities {
  const result: ExtractedQueryEntities = {};
  const cleanQ = query.trim();

  // 1. Extract Weight in kg
  const weightMatch = cleanQ.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|kilogram|kilograms)\b/i);
  if (weightMatch) {
    const parsedWeight = parseFloat(weightMatch[1]);
    if (!isNaN(parsedWeight) && parsedWeight > 0 && parsedWeight <= 150) {
      result.weightKg = parsedWeight;
    }
  }

  // 2. Extract Age (months, years, days)
  const ageMatch = cleanQ.match(/(\d+(?:\.\d+)?)\s*(?:-| )?\s*(years?|yrs?|months?|mos?|days?|d|m|y)(?:-old|\s+old)?\b/i);
  if (ageMatch) {
    const val = parseFloat(ageMatch[1]);
    const rawUnit = ageMatch[2].toLowerCase();
    if (!isNaN(val)) {
      result.ageValue = val;
      if (rawUnit.startsWith('y')) {
        result.ageUnit = 'years';
        result.ageDisplay = `${val} year${val === 1 ? '' : 's'}`;
      } else if (rawUnit.startsWith('m')) {
        result.ageUnit = 'months';
        result.ageDisplay = `${val} month${val === 1 ? '' : 's'}`;
      } else if (rawUnit.startsWith('d')) {
        result.ageUnit = 'days';
        result.ageDisplay = `${val} day${val === 1 ? '' : 's'}`;
      }
    }
  }

  // 3. Extract Route
  if (/\b(?:oral|orally|po|p\.o\.|by mouth|syrup|suspension|drops|tablet)\b/i.test(cleanQ)) {
    result.route = 'oral';
  } else if (/\b(?:iv|intravenous|intravenously)\b/i.test(cleanQ)) {
    result.route = 'iv';
  } else if (/\b(?:im|intramuscular|intramuscularly)\b/i.test(cleanQ)) {
    result.route = 'im';
  } else if (/\b(?:rectal|suppository|pr)\b/i.test(cleanQ)) {
    result.route = 'rectal';
  }

  // 4. Extract Indication keywords
  const indicationMap: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b(?:ear infection|otitis media|aom|acute otitis media)\b/i, name: 'Acute Otitis Media' },
    { pattern: /\b(?:fever|pyrexia|temperature)\b/i, name: 'Fever (Pyrexia Reduction)' },
    { pattern: /\b(?:pain|analgesia|headache)\b/i, name: 'Mild-to-Moderate Pain' },
    { pattern: /\b(?:pneumonia|cap|community acquired pneumonia)\b/i, name: 'Community-Acquired Pneumonia' },
    { pattern: /\b(?:pharyngitis|strep pharyngitis|sore throat)\b/i, name: 'Streptococcal Pharyngitis / Tonsillitis' },
    { pattern: /\b(?:tonsillitis|acute tonsillitis)\b/i, name: 'Acute Streptococcal Tonsillitis' },
    { pattern: /\b(?:sinusitis|rhinosinusitis)\b/i, name: 'Acute Bacterial Rhinosinusitis' },
    { pattern: /\b(?:uti|urinary tract infection|cystitis|pyelonephritis)\b/i, name: 'Urinary Tract Infection' },
    { pattern: /\b(?:asthma|wheezing|bronchospasm)\b/i, name: 'Acute Asthma Exacerbation' },
    { pattern: /\b(?:vomiting|emesis|gastroenteritis)\b/i, name: 'Vomiting in Gastroenteritis' },
    { pattern: /\b(?:diarrhea|diarrhoea|zinc supplementation)\b/i, name: 'Acute Diarrhea Management' },
  ];

  for (const item of indicationMap) {
    if (item.pattern.test(cleanQ)) {
      result.indication = item.name;
      break;
    }
  }

  // 5. Clean medicine query candidate
  let stripped = cleanQ
    .replace(/\b(?:what is the pediatric dose of|what is the dose of|what is the dosage of|dose of|dosage of|dosage information for|pediatric dose of|recommended dose of|can you find the verified pediatric dosing information for|can you find the verified pediatric dosing for|can you find the dosage for|find the dosage information for|find dosage for|find dose of|find)\b/gi, '')
    .replace(/\b(?:for|in)\s+(?:an?\s+)?\d+(?:\.\d+)?\s*(?:kg|kgs|kilo|kilogram|kilograms)\s*(?:child|infant|toddler|patient|baby)?\b/gi, '')
    .replace(/\b(?:for|in)\s+(?:an?\s+)?\d+(?:\.\d+)?\s*(?:years?|yrs?|months?|mos?|days?|d|m|y)(?:-old|\s+old)?\s*(?:child|infant|toddler|patient|baby)?\b/gi, '')
    .replace(/\b(?:with|having|for)\s+(?:an?\s+)?(?:ear infection|otitis media|fever|pneumonia|tonsillitis|pharyngitis|sinusitis|pain|vomiting|asthma|diarrhea)\b/gi, '')
    .replace(/\b(?:child|infant|toddler|patient|pediatric|paediatric)\b/gi, '')
    .trim();

  result.medicineName = stripped.replace(/[?.,!]+$/, '').trim();

  return result;
}

/**
 * Calculates patient calculation preview strictly using verified dosing parameters
 */
export function calculatePatientPreview(
  med: MedicationRecord,
  indication: IndicationDosingRule,
  weightKg: number
): PatientCalculationPreview | undefined {
  if (!weightKg || weightKg <= 0) return undefined;

  let dosePerDoseMg = 0;
  let totalDailyDoseMg = 0;
  let wasSingleCapped = false;
  let wasDailyCapped = false;
  let cappingNote = '';

  const doseBasis = indication.doseBasis;
  const doseValue = indication.doseValue;
  const dosesPerDay = indication.recommendedFrequencyDosesPerDay || 1;

  if (doseBasis === 'mg_kg_day') {
    let unCappedDaily = weightKg * doseValue;
    if (indication.maxDailyDoseMg && unCappedDaily > indication.maxDailyDoseMg) {
      totalDailyDoseMg = indication.maxDailyDoseMg;
      wasDailyCapped = true;
      cappingNote = `Daily dose capped at absolute ceiling of ${indication.maxDailyDoseMg} mg.`;
    } else {
      totalDailyDoseMg = unCappedDaily;
    }

    let unCappedSingle = totalDailyDoseMg / dosesPerDay;
    if (indication.maxSingleDoseMg && unCappedSingle > indication.maxSingleDoseMg) {
      dosePerDoseMg = indication.maxSingleDoseMg;
      wasSingleCapped = true;
      cappingNote = `${cappingNote} Single dose capped at maximum of ${indication.maxSingleDoseMg} mg.`.trim();
    } else {
      dosePerDoseMg = unCappedSingle;
    }
  } else if (doseBasis === 'mg_kg_dose') {
    let unCappedSingle = weightKg * doseValue;
    if (indication.maxSingleDoseMg && unCappedSingle > indication.maxSingleDoseMg) {
      dosePerDoseMg = indication.maxSingleDoseMg;
      wasSingleCapped = true;
      cappingNote = `Single dose capped at maximum of ${indication.maxSingleDoseMg} mg.`;
    } else {
      dosePerDoseMg = unCappedSingle;
    }

    let unCappedDaily = dosePerDoseMg * dosesPerDay;
    if (indication.maxDailyDoseMg && unCappedDaily > indication.maxDailyDoseMg) {
      totalDailyDoseMg = indication.maxDailyDoseMg;
      wasDailyCapped = true;
      cappingNote = `${cappingNote} Total daily dose capped at ${indication.maxDailyDoseMg} mg ceiling.`.trim();
    } else {
      totalDailyDoseMg = unCappedDaily;
    }
  } else {
    // Fixed dose
    dosePerDoseMg = doseValue;
    totalDailyDoseMg = doseValue * dosesPerDay;
  }

  // Round values cleanly
  dosePerDoseMg = Math.round(dosePerDoseMg * 10) / 10;
  totalDailyDoseMg = Math.round(totalDailyDoseMg * 10) / 10;

  // Find preferred pediatric formulation (syrup/suspension or drops)
  const oralLiquid = med.formulations.find(
    (f) => f.type === 'suspension' || f.type === 'syrup' || f.type === 'solution' || f.type === 'drops'
  );

  let suggestedVolumeMl: number | undefined;
  let suggestedFormulationName: string | undefined;

  if (oralLiquid && oralLiquid.concentration.strengthMg > 0) {
    const concMgPerMl = oralLiquid.concentration.strengthMg / (oralLiquid.concentration.volumeMl || 5);
    if (concMgPerMl > 0) {
      suggestedVolumeMl = Math.round((dosePerDoseMg / concMgPerMl) * 10) / 10;
      suggestedFormulationName = `${oralLiquid.name} (${oralLiquid.concentration.displayLabel})`;
    }
  }

  return {
    weightKg,
    doseBasis: doseBasis === 'mg_kg_day' ? 'mg/kg/day' : doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'fixed_dose',
    doseValue,
    dosePerDoseMg,
    totalDailyDoseMg,
    dosesPerDay,
    frequency: indication.frequencyDescription,
    suggestedFormulationName,
    suggestedVolumeMl,
    wasSingleCapped,
    wasDailyCapped,
    cappingNote: cappingNote || undefined,
  };
}

/**
 * Maps a verified database record and indication into the strict Section 6 JSON schema
 * and enriches it with doctor-friendly clinical decision support fields.
 */
export function formatVerifiedMedicationToAiSchema(
  med: MedicationRecord,
  indication?: IndicationDosingRule,
  statusOverride = 'Verified from PediDose Clinical Database',
  extractedEntities?: ExtractedQueryEntities
): StructuredMedicationAiResponse {
  const ind = indication || med.indications[0];

  const availableIndications: AvailableIndicationOption[] = med.indications.map((i) => ({
    id: i.id,
    indicationName: i.indicationName,
    doseValue: i.doseValue,
    doseBasis: i.doseBasis === 'mg_kg_day' ? 'mg/kg/day' : i.doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'fixed_dose',
    frequencyDescription: i.frequencyDescription,
    defaultDurationDays: i.defaultTreatmentDurationDays,
    maxSingleDoseMg: i.maxSingleDoseMg ?? null,
    maxDailyDoseMg: i.maxDailyDoseMg ?? null,
  }));

  const patientPreview = extractedEntities?.weightKg
    ? calculatePatientPreview(med, ind, extractedEntities.weightKg)
    : undefined;

  // Build doctor-friendly clinical summary
  let clinicalSummary = `${med.genericName} is indicated for ${ind.indicationName} at ${ind.doseValue} ${
    ind.doseBasis === 'mg_kg_day' ? 'mg/kg/day' : ind.doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'mg'
  } administered as ${ind.frequencyDescription} via ${med.approvedRoutes[0] || 'oral'} route.`;

  if (ind.defaultTreatmentDurationDays) {
    clinicalSummary += ` Recommended treatment duration is ${ind.defaultTreatmentDurationDays} days.`;
  }

  if (patientPreview) {
    clinicalSummary += ` For a ${patientPreview.weightKg} kg child, the exact single dose is ${patientPreview.dosePerDoseMg} mg (${patientPreview.totalDailyDoseMg} mg/day in ${patientPreview.dosesPerDay} divided doses).`;
    if (patientPreview.suggestedVolumeMl && patientPreview.suggestedFormulationName) {
      clinicalSummary += ` Volume required: ${patientPreview.suggestedVolumeMl} mL per dose using ${patientPreview.suggestedFormulationName}.`;
    }
  }

  // Follow-up question if essential patient parameters are missing
  let followUpQuestion: string | undefined;
  if (!extractedEntities?.weightKg) {
    followUpQuestion =
      'What is the child’s weight? Providing patient weight allows instant volume (mL) and tablet fraction calculations.';
  } else if (med.indications.length > 1 && !extractedEntities?.indication) {
    followUpQuestion = `Multiple verified indications exist for ${med.genericName} (${med.indications.map((i) => i.indicationName).slice(0, 3).join(', ')}). Please verify the specific clinical condition.`;
  }

  return {
    genericName: med.genericName,
    brandNames: med.brandNames,
    category: med.category,
    activeIngredients: med.activeIngredients.map(
      (ing) => `${ing.name} ${ing.isPrimaryDosingTarget ? '(Primary Target)' : ''}`.trim()
    ),
    formulations: med.formulations.map((f) => `${f.name} - ${f.concentration.displayLabel}`),
    indication: ind.indicationName,
    doseBasis: ind.doseBasis === 'mg_kg_day' ? 'mg/kg/day' : ind.doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'fixed_dose',
    dosePerKg: ind.doseBasis === 'fixed_dose' ? null : ind.doseValue,
    frequency: ind.frequencyDescription,
    dosesPerDay: ind.recommendedFrequencyDosesPerDay,
    maximumSingleDose: ind.maxSingleDoseMg ?? null,
    maximumDailyDose: ind.maxDailyDoseMg ?? null,
    route: med.approvedRoutes[0] || 'oral',
    ageRestrictions: med.formulations
      .filter((f) => f.minAgeMonths)
      .map((f) => `${f.name}: Minimum age ${f.minAgeMonths} months`),
    referenceSource: med.referenceSources.map((r) => `${r.sourceName} (${r.editionOrYear})`).join('; '),
    verificationStatus: statusOverride,
    clinicalExplanation: med.description,

    // Rich additions
    queryType: 'medication_dosing',
    clinicalSummary,
    duration: ind.defaultTreatmentDurationDays ? `${ind.defaultTreatmentDurationDays} days` : 'As clinically directed',
    verificationDate: '2026 Edition (Verified Clinical Formulary)',
    warnings: [...(med.blackBoxWarnings || []), ...(med.precautions || [])],
    contraindications: med.contraindications,
    matchedMedicationId: med.id,
    matchedIndicationId: ind.id,
    extractedEntities,
    patientCalculationPreview: patientPreview,
    availableIndications,
    followUpQuestion,
  };
}

/**
 * Builds grounded system instruction text containing verified pediatric drug rules
 */
export function buildDatabaseGroundingSummary(): string {
  const lines: string[] = [
    'VERIFIED PEDIATRIC MEDICATION DATABASE (Source of Truth):',
  ];

  for (const med of MEDICATION_DATABASE) {
    lines.push(`\nMEDICATION: ${med.genericName} [ID: ${med.id}]`);
    lines.push(`- Brands: ${med.brandNames.join(', ')}`);
    lines.push(`- Aliases: ${med.aliases.join(', ')}`);
    lines.push(`- Category: ${med.category}`);
    lines.push(`- Active Ingredients: ${med.activeIngredients.map((i) => i.name).join(', ')}`);
    lines.push(`- Approved Formulations: ${med.formulations.map((f) => `${f.name} (${f.concentration.displayLabel})`).join('; ')}`);
    lines.push(`- Indications & Verified Dosing:`);
    for (const ind of med.indications) {
      lines.push(
        `  * ${ind.indicationName}: ${ind.doseValue} ${ind.doseBasis} (${ind.recommendedFrequencyDosesPerDay}x/day, ${ind.frequencyDescription}), Duration: ${ind.defaultTreatmentDurationDays || 'variable'} days, Max single: ${ind.maxSingleDoseMg ?? 'none'} mg, Max daily: ${ind.maxDailyDoseMg ?? 'none'} mg`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Finds best matching indication for a medication given a condition name or search query
 */
export function findMatchingIndication(med: MedicationRecord, conditionQuery?: string): IndicationDosingRule {
  if (!conditionQuery) return med.indications[0];
  const q = conditionQuery.toLowerCase();

  // Exact or substring match in indicationName
  const directMatch = med.indications.find(
    (ind) => ind.indicationName.toLowerCase().includes(q) || q.includes(ind.indicationName.toLowerCase())
  );
  if (directMatch) return directMatch;

  // Symptom aliases
  if (q.includes('ear') || q.includes('otitis')) {
    const aom = med.indications.find((ind) => /otitis/i.test(ind.indicationName));
    if (aom) return aom;
  }
  if (q.includes('fever') || q.includes('temp')) {
    const fever = med.indications.find((ind) => /fever|pyrexia/i.test(ind.indicationName));
    if (fever) return fever;
  }
  if (q.includes('pain') || q.includes('headache')) {
    const pain = med.indications.find((ind) => /pain|analgesia/i.test(ind.indicationName));
    if (pain) return pain;
  }
  if (q.includes('pharyngitis') || q.includes('tonsillitis') || q.includes('throat')) {
    const pharyng = med.indications.find((ind) => /pharyngitis|tonsillitis/i.test(ind.indicationName));
    if (pharyng) return pharyng;
  }
  if (q.includes('pneumonia') || q.includes('cap')) {
    const pna = med.indications.find((ind) => /pneumonia/i.test(ind.indicationName));
    if (pna) return pna;
  }
  if (q.includes('sinus')) {
    const sinus = med.indications.find((ind) => /sinus/i.test(ind.indicationName));
    if (sinus) return sinus;
  }
  if (q.includes('uti') || q.includes('urinary')) {
    const uti = med.indications.find((ind) => /urinary|uti/i.test(ind.indicationName));
    if (uti) return uti;
  }

  return med.indications[0];
}

/**
 * Deterministic local parser using extracted entities and multi-vector search.
 * Enforces strict zero-fabrication rules: only retrieves verified records.
 */
export function resolveLocalDatabaseMatch(query: string): StructuredMedicationAiResponse | null {
  const cleanQ = query.trim();
  if (!cleanQ) return null;

  // 1. Check if clinical concept question (e.g. mg/kg/day vs mg/kg/dose)
  const conceptResult = resolveClinicalConcept(cleanQ);
  if (conceptResult) {
    return conceptResult;
  }

  // 2. Extract clinical entities (weight, age, route, indication, drug name)
  const entities = extractEntitiesFromQuery(cleanQ);

  // 3. Search verified database using candidate medicine name or clean query
  const termToSearch = entities.medicineName && entities.medicineName.length >= 3
    ? entities.medicineName
    : cleanQ;

  let searchResp = searchMedications(termToSearch);

  // If no match on stripped name, try original query
  if (searchResp.results.length === 0 && termToSearch !== cleanQ) {
    searchResp = searchMedications(cleanQ);
  }

  // Filter out spurious matches:
  // 1. Spurious match on numerical strength token (e.g. matching '10' from '10 kg')
  // 2. Suffix collision on different drugs (e.g. roxithromycin vs azithromycin sharing -ithromycin)
  const validResults = searchResp.results.filter((res) => {
    const queryTerm = (entities.medicineName || cleanQ).toLowerCase();

    if (res.matchedField === 'strength') {
      const medLower = res.medication.genericName.toLowerCase();
      return (
        medLower.includes(queryTerm) ||
        queryTerm.includes(medLower) ||
        res.medication.brandNames.some((b) => b.toLowerCase().includes(queryTerm) || queryTerm.includes(b.toLowerCase())) ||
        res.medication.aliases.some((a) => queryTerm.includes(a.toLowerCase()))
      );
    }

    if (res.matchedField === 'fuzzy') {
      const candidateLower = res.matchedTerm.toLowerCase();
      const first3Query = queryTerm.slice(0, 3);
      const first3Cand = candidateLower.slice(0, 3);
      // Legitimate spelling typos share the root prefix or have very high similarity
      if (first3Query !== first3Cand && res.score < 75) {
        return false;
      }
    }

    return true;
  });

  // If no valid results from search, try direct matching on verified records
  if (validResults.length === 0) {
    const queryTerm = (entities.medicineName && entities.medicineName.length >= 3 ? entities.medicineName : cleanQ).toLowerCase();
    for (const med of MEDICATION_DATABASE) {
      const matchBrand = med.brandNames.some((b) => queryTerm.includes(b.toLowerCase()) || b.toLowerCase().includes(queryTerm));
      const matchGeneric = queryTerm.includes(med.genericName.toLowerCase()) || med.genericName.toLowerCase().includes(queryTerm);
      const matchAlias = med.aliases.some((a) => queryTerm.includes(a.toLowerCase()));
      const matchIngredient = med.activeIngredients.some((i) => queryTerm.includes(i.name.toLowerCase()));

      if (matchBrand || matchGeneric || matchAlias || matchIngredient) {
        const ind = findMatchingIndication(med, entities.indication || cleanQ);
        return formatVerifiedMedicationToAiSchema(
          med,
          ind,
          'Verified Local Database (Deterministic Grounded Match)',
          entities
        );
      }
    }
    return null;
  }

  const topMatch = validResults[0];
  const med = topMatch.medication;
  const targetIndication = findMatchingIndication(med, entities.indication || cleanQ);

  return formatVerifiedMedicationToAiSchema(
    med,
    targetIndication,
    'Verified Local Database (Deterministic Grounded Match)',
    entities
  );
}
