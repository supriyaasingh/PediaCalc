/**
 * PediDose AI Assistant Types & Structured Schema
 * As required by Specification Section 6.
 */

export interface StructuredMedicationAiResponse {
  genericName: string;
  brandNames: string[];
  category: string;
  activeIngredients: string[];
  formulations: string[];
  indication: string;
  doseBasis: 'mg/kg/day' | 'mg/kg/dose' | string;
  dosePerKg: number | null;
  frequency: string;
  dosesPerDay: number | null;
  maximumSingleDose: number | null;
  maximumDailyDose: number | null;
  route: string;
  ageRestrictions: string[];
  referenceSource: string;
  verificationStatus: string;
  clinicalExplanation?: string;
}
