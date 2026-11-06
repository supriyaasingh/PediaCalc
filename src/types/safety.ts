/**
 * PediDose Clinical Safety Engine Types
 * Specification Section 5 definitions.
 */

import { AdministrationRoute } from './dosage.ts';
import { IndicationDosingRule, MedicationFormulation, MedicationRecord } from './medication.ts';

export type SafetySeverity = 'info' | 'warning' | 'critical';

export type SafetyCategory =
  | 'duplicate_ingredient'
  | 'drug_interaction'
  | 'age_restriction'
  | 'contraindication'
  | 'dose_exceeded'
  | 'missing_information'
  | 'route_mismatch'
  | 'combination_target'
  | 'renal_hepatic'
  | 'unsplittable_formulation'
  | 'clinical_discrepancy'
  | 'regulatory_warning';

export interface SafetyIssue {
  id: string;
  category: SafetyCategory;
  severity: SafetySeverity;
  title: string;
  message: string;
  clinicalAction: string;
  affectedItem?: string;
}

export interface PatientSafetyProfile {
  weightKg: number;
  ageInMonths: number;
  concurrentMedications?: string[];
  knownAllergies?: string[];
  clinicalConditions?: string[];
  gfrMlMin?: number;
  hasHepaticImpairment?: boolean;
}

export interface SafetyAuditInput {
  patient: PatientSafetyProfile;
  medication: MedicationRecord;
  indication: IndicationDosingRule;
  formulation: MedicationFormulation;
  route: AdministrationRoute;
  proposedSingleDoseMg: number;
  proposedDailyDoseMg: number;
  dosesPerDay: number;
}

export interface SafetyAuditResult {
  canProceed: boolean; // False if any CRITICAL issue stops calculation
  safetyStatus: 'PASS' | 'WARNING' | 'CRITICAL_STOP';
  criticalCount: number;
  warningCount: number;
  issues: SafetyIssue[];
  stoppingExplanation?: string;
  combinationTargetVerified: boolean;
  activeIngredientDosingTarget: string;
}
