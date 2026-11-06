/**
 * PediDose Medication Database Schema
 * Structured, verifiable pediatric drug database types.
 */

import { AdministrationRoute, AgeUnit, DoseBasis, FormulationType } from './dosage.ts';

export interface ActiveIngredient {
  name: string;
  strengthMg: number;
  unit: string;
  isPrimaryDosingTarget: boolean; // e.g. Amoxicillin in Augmentin
}

export interface FormulationConcentration {
  strengthMg: number;
  volumeMl?: number; // for liquids (e.g. 5 mL)
  unit: string; // e.g. "mg/5mL", "mg/mL", "mg"
  displayLabel: string;
}

export interface MedicationFormulation {
  id: string;
  name: string;
  type: FormulationType;
  route: AdministrationRoute;
  concentration: FormulationConcentration;
  canBeDivided?: boolean; // splittable tablets
  packageSize?: string;
  notes?: string;
  minAgeMonths?: number;
  dropsPerMl?: number;
}

export interface IndicationDosingRule {
  id: string;
  indicationName: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'standard' | 'high_dose';
  description: string;
  doseBasis: DoseBasis;
  doseValue: number; // in mg/kg/day or mg/kg/dose
  recommendedFrequencyDosesPerDay: number;
  frequencyDescription: string; // e.g. "Every 12 hours (q12h / BD)"
  defaultTreatmentDurationDays?: number;
  durationDescription?: string; // e.g. "7 to 10 days"
  minAgeMonths?: number;
  maxAgeYears?: number;
  minWeightKg?: number;
  maxSingleDoseMg?: number;
  maxDailyDoseMg?: number;
  weightBasedMaxDailyDosePerKg?: number;
  targetActiveIngredient: string; // e.g. "Amoxicillin"
  clinicalNotes?: string;
}

export interface ClinicalReference {
  sourceName: string; // e.g. "IAP Pediatric Drug Formulary", "CDSCO Drug Registry", "India Drug Index", "CIMS/MIMS India", "Drug Today"
  editionOrYear: string;
  sectionOrUrl?: string;
  recommendationLevel?: string;
}

export interface OrganAdjustment {
  renalAdjustment: string;
  hepaticAdjustment: string;
}

export interface SourceAttribution {
  iapPediatricFormulary?: {
    isVerified: boolean;
    editionOrYear: string;
    monographTitle?: string;
    dosingGuidelineRef?: string;
    lastReviewedDate: string;
    consensusStatus?: 'primary_standard' | 'expert_consensus' | 'under_review';
  };
  cdscoDrugRegistry?: {
    isApproved: boolean;
    registrationId?: string;
    scheduleCategory: 'Schedule H' | 'Schedule H1' | 'Schedule X' | 'Schedule G' | 'OTC';
    approvalStatus: 'cdsco_approved' | 'restricted_pediatric' | 'prohibited_fdc';
    bannedFdcAlert?: string;
    lastReviewedDate: string;
  };
  indiaDrugIndex?: {
    isIndexed: boolean;
    brandListSummary: string[];
    standardStrengths: string[];
  };
  drugTodayOnline?: {
    isReferenced: boolean;
    monographRef?: string;
    packStrengths?: string[];
  };
  cimsMimsIndia?: {
    isReferenced: boolean;
    therapeuticCategoryCode?: string;
    interactionLevel?: string;
  };
}

export interface RegulatoryStatus {
  cdscoApproved: boolean;
  scheduleCategory: 'Schedule H' | 'Schedule H1' | 'Schedule X' | 'Schedule G' | 'OTC';
  registrationId?: string;
  isBannedFdcInIndia: boolean;
  bannedFdcNotice?: string;
  regulatoryWarning?: string;
  pediatricAgeApproval?: string; // e.g. "Approved for all pediatric ages", "Contraindicated < 2 years"
}

export interface ClinicalDiscrepancyAudit {
  hasDiscrepancy: boolean;
  conflictingSources?: string[];
  discrepancySummary?: string;
  clinicalActionRequired?: string;
  clinicalRecommendation?: string;
  requiresClinicalReview: boolean;
}

export interface MedicationRecord {
  id: string;
  genericName: string;
  brandNames: string[];
  aliases: string[]; // Common abbreviations like "PCM", "APAP", "Amox"
  category: string;
  subcategories?: string[];
  therapeuticClass: string;
  pharmacologicalClass?: string;
  description: string;
  country?: string; // e.g. "India"
  
  // Ingredients & Combinations
  isCombination: boolean;
  combinationRatio?: string; // e.g. "7:1", "4:1"
  activeIngredients: ActiveIngredient[];
  
  // Formulations & Routes
  formulations: MedicationFormulation[];
  approvedRoutes: AdministrationRoute[];
  
  // Dosing Rules for different indications
  indications: IndicationDosingRule[];
  
  // Safety, Warnings & Precautions
  contraindications: string[];
  precautions: string[];
  blackBoxWarnings?: string[];
  adverseEffectsCommon: string[];
  organAdjustments: OrganAdjustment;
  
  // Source Attribution & Regulatory Verification (IAP, CDSCO, IDI, Drug Today, CIMS/MIMS)
  sourceAttribution?: SourceAttribution;
  regulatoryStatus?: RegulatoryStatus;
  verificationStatus?: 'verified' | 'pending_review' | 'discrepancy_flagged';
  clinicalApprovalStatus?: 'approved_pediatric' | 'restricted_pediatric' | 'banned_in_children' | 'discrepancy_review';
  discrepancyAudit?: ClinicalDiscrepancyAudit;
  hasReliablePediatricDosing?: boolean;
  lastReviewedDate?: string;

  // Verification metadata
  referenceSources: ClinicalReference[];
  lastVerifiedDate: string;
  databaseVersion: string;
  verifiedBy: string;
}

export interface DatabaseMetadata {
  version: string;
  lastUpdated: string;
  totalRecords: number;
  verificationAuthority: string;
  disclaimer: string;
  integratedSources?: string[];
}
