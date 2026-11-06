/**
 * PediDose AI Grounding & Strict Schema Formatter
 * Connects natural language queries to verified clinical database entries.
 * Enforces zero-fabrication rules.
 */

import { MEDICATION_DATABASE } from '../data/medicationDatabase.ts';
import { IndicationDosingRule, MedicationRecord } from '../types/medication.ts';
import { StructuredMedicationAiResponse } from '../types/ai.ts';
import { searchMedications } from './search.ts';

/**
 * Maps a verified database record and indication into the strict Section 6 JSON schema
 */
export function formatVerifiedMedicationToAiSchema(
  med: MedicationRecord,
  indication?: IndicationDosingRule,
  statusOverride = 'Verified from PediDose Clinical Database'
): StructuredMedicationAiResponse {
  const ind = indication || med.indications[0];

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
    lines.push(`\nMEDICATION: ${med.genericName}`);
    lines.push(`- Brands: ${med.brandNames.join(', ')}`);
    lines.push(`- Aliases: ${med.aliases.join(', ')}`);
    lines.push(`- Category: ${med.category}`);
    lines.push(`- Active Ingredients: ${med.activeIngredients.map((i) => i.name).join(', ')}`);
    lines.push(`- Approved Formulations: ${med.formulations.map((f) => f.name).join('; ')}`);
    lines.push(`- Indications & Dosing:`);
    for (const ind of med.indications) {
      lines.push(
        `  * ${ind.indicationName}: ${ind.doseValue} ${ind.doseBasis} (${ind.recommendedFrequencyDosesPerDay}x/day, ${ind.frequencyDescription}), Max single: ${ind.maxSingleDoseMg ?? 'none'}, Max daily: ${ind.maxDailyDoseMg ?? 'none'}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Fallback parser using local multi-vector search when Gemini API is unavailable or offline
 */
export function resolveLocalDatabaseMatch(query: string): StructuredMedicationAiResponse | null {
  const searchResp = searchMedications(query);
  if (searchResp.results.length === 0) {
    return null;
  }

  const topMatch = searchResp.results[0];
  const med = topMatch.medication;
  const ind = topMatch.matchingIndications?.[0] || med.indications[0];

  return formatVerifiedMedicationToAiSchema(
    med,
    ind,
    'Verified Local Database (Deterministic Grounded Match)'
  );
}
