/**
 * PediDose Clinical Decision Support Types
 * Pediatric Dosage Calculation & Safety Definitions
 */

export type AgeUnit = 'days' | 'months' | 'years';
export type WeightUnit = 'kg' | 'lbs';
export type DoseBasis = 'mg_kg_day' | 'mg_kg_dose' | 'fixed_dose';

export type FormulationType =
  | 'syrup'
  | 'suspension'
  | 'drops'
  | 'tablet'
  | 'dispersible_tablet'
  | 'capsule'
  | 'solution'
  | 'injection'
  | 'iv';

export type AdministrationRoute =
  | 'oral'
  | 'intravenous'
  | 'intramuscular'
  | 'rectal'
  | 'subcutaneous'
  | 'inhalation'
  | 'topical';

export interface CalculationInput {
  weight: number;
  weightUnit: WeightUnit;
  age: number;
  ageUnit: AgeUnit;
  doseBasis: DoseBasis;
  doseValue: number; // In mg/kg/day or mg/kg/dose or fixed mg
  dosesPerDay: number; // Frequency: 1 (OD), 2 (BD/q12h), 3 (TDS/q8h), 4 (QID/q6h), etc.
  frequencyLabel?: string;
  maxSingleDoseMg?: number | null;
  maxDailyDoseMg?: number | null;
  weightBasedMaxDailyDosePerKg?: number | null;
  formulationType: FormulationType;
  route?: AdministrationRoute;
  
  // Syrup / Liquid specifics
  syrupStrengthMg?: number; // e.g., 120 or 250
  syrupVolumeMl?: number; // e.g., 5 mL
  
  // Tablet specifics
  tabletStrengthMg?: number; // e.g., 500 mg
  canTabletBeDivided?: boolean; // Scored / splittable tablet
  
  // Combination medication target (e.g. Amoxicillin in Augmentin)
  activeIngredientTarget?: string;
  combinationRatio?: string; // e.g., "7:1" or "4:1"

  // Drops specifics
  dropsPerMl?: number; // Default 20 drops per mL

  // Injectable / IV specifics
  injectionConcentrationMgPerMl?: number;
  injectionDilutionVolumeMl?: number;

  // Weight estimation tracking
  isEstimatedWeight?: boolean;
  estimatedWeightSource?: string;
}

export interface SyrupResult {
  concentrationMgPerMl: number;
  volumePerDoseMl: number;
  dailyVolumeMl: number;
  formattedVolumePerDose: string;
}

export interface DropsResult {
  volumeMl: number;
  dropsPerMl: number;
  totalDrops: number;
  formattedDrops: string;
  calibratedDropperNote: string;
}

export interface DispersibleTabletResult {
  tabletsCount: number;
  formattedTablets: string;
  dispersionVolumeMl: number;
  dispersionInstructions: string;
}

export interface CapsuleResult {
  capsuleStrengthMg: number;
  rawCapsules: number;
  formattedCapsules: string;
  canBeDivided: false;
  warning?: string;
}

export interface InjectableResult {
  concentrationMgPerMl: number;
  volumeMl: number;
  formattedVolume: string;
  route: AdministrationRoute;
  infusionNotes?: string;
}

export interface TabletResult {
  tabletStrengthMg: number;
  rawTabletsPerDose: number;
  formattedTabletsPerDose: string;
  canBeDivided: boolean;
  divisionWarning?: string;
}

export interface PracticalSyringeAdvice {
  recommendedSyringe: string; // e.g. "1 mL oral syringe (0.01 mL markings)"
  exactVolumeMl: number;
  roundedMeasurableVolumeMl: number;
  effectiveDoseMg: number;
  percentAdjustment: number;
  roundingDirection: 'exact' | 'rounded_down' | 'rounded_up';
  clinicalNote: string;
}

export interface DrugInteraction {
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  drugAId: string;
  drugBId: string;
  drugAName: string;
  drugBName: string;
  interactionTitle: string;
  effect: string;
  recommendation: string;
  clinicalSource: string;
}

export interface CalculationResult {
  success: boolean;
  weightKg: number;
  isEstimatedWeight?: boolean;
  estimatedWeightSource?: string;
  ageInDays: number;
  ageInMonths: number;
  ageInYears: number;
  doseBasis: DoseBasis;
  dosesPerDay: number;
  
  // Calculated doses
  dosePerDoseMg: number;
  totalDailyDoseMg: number;
  uncappedDosePerDoseMg: number;
  uncappedTotalDailyDoseMg: number;
  
  // Capping and safety
  wasSingleDoseCapped: boolean;
  wasDailyDoseCapped: boolean;
  appliedCapType?: 'absolute_single' | 'absolute_daily' | 'weight_based_daily';
  appliedCapMg?: number;
  
  // Formulation outputs
  syrup?: SyrupResult;
  tablet?: TabletResult;
  drops?: DropsResult;
  dispersibleTablet?: DispersibleTabletResult;
  capsule?: CapsuleResult;
  injectable?: InjectableResult;
  
  // Syringe measurement & clinical rounding advice
  syringeAdvice?: PracticalSyringeAdvice;

  // Clinical warnings and messages
  warnings: string[];
  safetyStatus: 'safe' | 'warning' | 'critical';
  
  // Mathematical transparency for clinical verification
  formula: string;
  calculationSteps: string[];
  activeIngredientTarget?: string;
}
