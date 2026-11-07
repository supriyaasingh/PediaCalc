/**
 * PediDose AI Assistant Types & Structured Schema
 * As required by Specification Section 6 & Physician Decision Support
 */

export interface ExtractedQueryEntities {
  medicineName?: string;
  brandName?: string;
  indication?: string;
  weightKg?: number;
  ageValue?: number;
  ageUnit?: 'months' | 'years' | 'days';
  ageDisplay?: string;
  route?: string;
}

export interface PatientCalculationPreview {
  weightKg: number;
  doseBasis: string;
  doseValue: number;
  dosePerDoseMg: number;
  totalDailyDoseMg: number;
  dosesPerDay: number;
  frequency: string;
  suggestedFormulationName?: string;
  suggestedVolumeMl?: number;
  suggestedTabletCount?: string;
  wasSingleCapped?: boolean;
  wasDailyCapped?: boolean;
  cappingNote?: string;
}

export interface AvailableIndicationOption {
  id: string;
  indicationName: string;
  doseValue: number;
  doseBasis: string;
  frequencyDescription: string;
  defaultDurationDays?: number;
  maxSingleDoseMg?: number | null;
  maxDailyDoseMg?: number | null;
}

export interface StructuredMedicationAiResponse {
  // Required Section 6 Schema Baseline
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

  // Rich Physician-Friendly & Natural Language Understanding Extensions
  queryType?: 'medication_dosing' | 'clinical_concept' | 'not_found' | 'need_clarification';
  clinicalSummary?: string;
  conceptTitle?: string;
  conceptExplanation?: string;
  conceptKeyPoints?: string[];
  duration?: string;
  verificationDate?: string;
  warnings?: string[];
  contraindications?: string[];
  matchedMedicationId?: string;
  matchedIndicationId?: string;
  extractedEntities?: ExtractedQueryEntities;
  patientCalculationPreview?: PatientCalculationPreview;
  availableIndications?: AvailableIndicationOption[];
  followUpQuestion?: string;
  suggestedAlternatives?: string[];
}
