/**
 * PediDose Clinical Dosing Safety & Validation Engine
 * Independent clinical verification gatekeeper enforcing multi-tier safety checks.
 */

import { SafetyAuditInput, SafetyAuditResult, SafetyIssue } from '../types/safety.ts';

export function runClinicalSafetyAudit(input: SafetyAuditInput): SafetyAuditResult {
  const issues: SafetyIssue[] = [];
  const {
    patient,
    medication,
    indication,
    formulation,
    route,
    proposedSingleDoseMg,
    proposedDailyDoseMg,
    dosesPerDay,
  } = input;

  // 1. Missing Clinical Information Checks
  if (!patient.weightKg || patient.weightKg <= 0 || isNaN(patient.weightKg)) {
    issues.push({
      id: 'missing_weight',
      category: 'missing_information',
      severity: 'critical',
      title: 'Missing or Invalid Weight',
      message: 'Pediatric dosing cannot proceed without an accurate measured child weight in kilograms.',
      clinicalAction: 'Measure child’s weight accurately before proceeding.',
    });
  }

  if (patient.ageInMonths === undefined || patient.ageInMonths < 0 || isNaN(patient.ageInMonths)) {
    issues.push({
      id: 'missing_age',
      category: 'missing_information',
      severity: 'critical',
      title: 'Missing Patient Age',
      message: 'Patient age in months/years is required to verify formulation suitability and age-restricted contraindications.',
      clinicalAction: 'Specify patient age in days, months, or years.',
    });
  }

  if (!dosesPerDay || dosesPerDay < 1) {
    issues.push({
      id: 'missing_frequency',
      category: 'missing_information',
      severity: 'critical',
      title: 'Invalid Administration Frequency',
      message: 'Dosing frequency must be at least 1 dose per 24-hour period.',
      clinicalAction: 'Specify a valid daily administration frequency (e.g., OD, BD, TDS, QDS).',
    });
  }

  // 2. Liquid Concentration Checks
  if (
    formulation.type === 'syrup' ||
    formulation.type === 'suspension' ||
    formulation.type === 'drops' ||
    formulation.type === 'solution'
  ) {
    if (!formulation.concentration.strengthMg || !formulation.concentration.volumeMl) {
      issues.push({
        id: 'missing_concentration',
        category: 'missing_information',
        severity: 'critical',
        title: 'Missing Formulation Concentration',
        message: 'Liquid volume calculation cannot be performed without valid strength (mg) and package volume (mL).',
        clinicalAction: 'Select a verified formulation with known mg/mL concentration.',
      });
    }
  }

  // 3. Duplicate Active Ingredient Detection
  if (patient.concurrentMedications && patient.concurrentMedications.length > 0) {
    const activeNames = medication.activeIngredients.map((ing) => ing.name.toLowerCase());
    const targetBrandNames = medication.brandNames.map((b) => b.toLowerCase());
    const targetGeneric = medication.genericName.toLowerCase();

    for (const concurrent of patient.concurrentMedications) {
      const concurrentLower = concurrent.toLowerCase();

      // Check if concurrent medication matches target generic or any of its brand names or ingredients
      const isDuplicate =
        activeNames.some((ing) => concurrentLower.includes(ing) || ing.includes(concurrentLower)) ||
        targetBrandNames.some((brand) => concurrentLower.includes(brand)) ||
        concurrentLower.includes(targetGeneric) ||
        (targetGeneric.includes('paracetamol') &&
          (concurrentLower.includes('crocin') ||
            concurrentLower.includes('dolo') ||
            concurrentLower.includes('calpol') ||
            concurrentLower.includes('tylenol') ||
            concurrentLower.includes('pcm') ||
            concurrentLower.includes('acetaminophen')));

      if (isDuplicate) {
        issues.push({
          id: `duplicate_${concurrent}`,
          category: 'duplicate_ingredient',
          severity: 'critical',
          title: `Potential Duplicate Active Ingredient: "${concurrent}"`,
          message: `Patient is concurrently receiving "${concurrent}", which shares active ingredients with ${medication.genericName}. Concurrent therapy carries a severe risk of cumulative toxicity or accidental overdose.`,
          clinicalAction: `Review patient medication administration record (MAR) and discontinue duplicate agent before prescribing.`,
          affectedItem: concurrent,
        });
      }
    }

    // 3b. Drug-Drug Interaction Safety Matrix
    const interactionIssues = checkPediatricDrugInteractions(
      medication.genericName + ' ' + medication.id,
      patient.concurrentMedications
    );
    issues.push(...interactionIssues);
  }

  // 4. Age Restrictions & Formulation Swallowing Safety
  if (formulation.minAgeMonths && patient.ageInMonths < formulation.minAgeMonths) {
    const isSolid =
      formulation.type === 'tablet' ||
      formulation.type === 'capsule';

    issues.push({
      id: 'formulation_age_restriction',
      category: 'age_restriction',
      severity: isSolid ? 'critical' : 'warning',
      title: `Formulation Age Restriction (${formulation.name})`,
      message: `${formulation.name} is restricted to children >= ${formulation.minAgeMonths} months (patient is ${patient.ageInMonths.toFixed(1)} months). ${isSolid ? 'Solid oral dosage forms present a choking hazard in infants/toddlers.' : ''}`,
      clinicalAction: isSolid
        ? 'Switch to an oral liquid suspension, drops, or dispersible tablet.'
        : 'Verify clinical necessity with a senior pediatric specialist.',
      affectedItem: formulation.name,
    });
  }

  if (indication.minAgeMonths && patient.ageInMonths < indication.minAgeMonths) {
    issues.push({
      id: 'indication_min_age',
      category: 'age_restriction',
      severity: 'critical',
      title: `Indication Age Restriction (${indication.indicationName})`,
      message: `The indication "${indication.indicationName}" is not approved for patients under ${indication.minAgeMonths} months (patient is ${patient.ageInMonths.toFixed(1)} months).`,
      clinicalAction: 'Select an age-appropriate indication or alternative pediatric agent.',
      affectedItem: indication.indicationName,
    });
  }

  if (indication.minWeightKg && patient.weightKg < indication.minWeightKg) {
    issues.push({
      id: 'indication_min_weight',
      category: 'age_restriction',
      severity: 'critical',
      title: `Minimum Weight Restriction (${indication.minWeightKg} kg)`,
      message: `Patient weight of ${patient.weightKg.toFixed(1)} kg is below the minimum threshold of ${indication.minWeightKg} kg required for this medication regimen.`,
      clinicalAction: 'Choose an alternative agent approved for low-weight infants.',
    });
  }

  // 5. Contraindications & Allergy Auditing
  if (patient.knownAllergies && patient.knownAllergies.length > 0) {
    for (const allergy of patient.knownAllergies) {
      const allergyLower = allergy.toLowerCase();
      const isPenicillin =
        medication.id === 'amoxicillin' ||
        medication.id === 'amoxicillin_clavulanate';

      if (isPenicillin && (allergyLower.includes('penicillin') || allergyLower.includes('amoxicillin') || allergyLower.includes('beta-lactam'))) {
        issues.push({
          id: 'allergy_penicillin',
          category: 'contraindication',
          severity: 'critical',
          title: `CRITICAL ALLERGY: ${allergy}`,
          message: `Patient has documented allergy to ${allergy}. Administering ${medication.genericName} is strictly contraindicated due to risk of severe IgE-mediated anaphylaxis.`,
          clinicalAction: 'Select a non-penicillin alternative (e.g., Macrolide such as Azithromycin, or Cephalosporin if non-severe).',
          affectedItem: allergy,
        });
      }

      if (medication.genericName.toLowerCase().includes(allergyLower)) {
        issues.push({
          id: `allergy_${allergy}`,
          category: 'contraindication',
          severity: 'critical',
          title: `Documented Drug Allergy: ${allergy}`,
          message: `Patient allergy profile matches ${medication.genericName}.`,
          clinicalAction: 'Select an alternative drug from a different therapeutic class.',
        });
      }
    }
  }

  // Clinical conditions contraindication audits
  if (patient.clinicalConditions && patient.clinicalConditions.length > 0) {
    for (const cond of patient.clinicalConditions) {
      const condLower = cond.toLowerCase();

      // Ibuprofen + Varicella / Chickenpox
      if (
        medication.id === 'ibuprofen' &&
        (condLower.includes('varicella') || condLower.includes('chickenpox') || condLower.includes('shingles'))
      ) {
        issues.push({
          id: 'contraindication_varicella_nsaid',
          category: 'contraindication',
          severity: 'critical',
          title: 'Contraindication: Ibuprofen in Varicella (Chickenpox)',
          message: 'NSAIDs administered during active varicella significantly increase the risk of invasive Group A Streptococcal superinfections and necrotizing fasciitis.',
          clinicalAction: 'Discontinue Ibuprofen immediately. Use Paracetamol for antipyresis.',
          affectedItem: cond,
        });
      }

      // Paracetamol / Co-amoxiclav + Severe Hepatic Impairment
      if (
        (medication.id === 'paracetamol' || medication.id === 'amoxicillin_clavulanate') &&
        (condLower.includes('hepatic') || condLower.includes('liver failure') || condLower.includes('cirrhosis'))
      ) {
        issues.push({
          id: 'contraindication_hepatic_impairment',
          category: 'contraindication',
          severity: 'critical',
          title: 'Contraindication: Severe Active Hepatic Impairment',
          message: `${medication.genericName} is contraindicated or requires extreme reduction in active acute liver failure or severe hepatic decompensation.`,
          clinicalAction: 'Consult pediatric hepatology before administering any hepatically metabolized medications.',
          affectedItem: cond,
        });
      }
    }
  }

  // 6. Route Compatibility
  if (route && !medication.approvedRoutes.includes(route)) {
    issues.push({
      id: 'route_incompatibility',
      category: 'route_mismatch',
      severity: 'critical',
      title: `Incompatible Route: "${route}"`,
      message: `${medication.genericName} is approved only for [${medication.approvedRoutes.join(', ')}]. The requested route "${route}" is unapproved.`,
      clinicalAction: `Change administration route to an approved route: ${medication.approvedRoutes.join(' or ')}.`,
      affectedItem: route,
    });
  }

  // 7. Maximum Single and Daily Dose Limits
  if (indication.maxSingleDoseMg && proposedSingleDoseMg > indication.maxSingleDoseMg) {
    issues.push({
      id: 'dose_exceeds_single_cap',
      category: 'dose_exceeded',
      severity: 'warning',
      title: `Single Dose Exceeds Verified Ceiling (${indication.maxSingleDoseMg} mg)`,
      message: `The proposed single dose of ${proposedSingleDoseMg.toFixed(1)} mg exceeds the clinical reference maximum single dose of ${indication.maxSingleDoseMg} mg.`,
      clinicalAction: `Cap single administration at ${indication.maxSingleDoseMg} mg.`,
    });
  }

  if (indication.maxDailyDoseMg && proposedDailyDoseMg > indication.maxDailyDoseMg) {
    issues.push({
      id: 'dose_exceeds_daily_cap',
      category: 'dose_exceeded',
      severity: 'warning',
      title: `Daily Dose Exceeds 24-Hour Ceiling (${indication.maxDailyDoseMg} mg)`,
      message: `The proposed daily dose of ${proposedDailyDoseMg.toFixed(1)} mg/day exceeds the clinical reference maximum daily ceiling of ${indication.maxDailyDoseMg} mg/day.`,
      clinicalAction: `Cap total 24-hour dose at ${indication.maxDailyDoseMg} mg/day.`,
    });
  }

  if (
    indication.weightBasedMaxDailyDosePerKg &&
    patient.weightKg > 0 &&
    proposedDailyDoseMg > patient.weightKg * indication.weightBasedMaxDailyDosePerKg
  ) {
    const weightCap = patient.weightKg * indication.weightBasedMaxDailyDosePerKg;
    issues.push({
      id: 'weight_daily_cap_exceeded',
      category: 'dose_exceeded',
      severity: 'warning',
      title: `Weight-Based Daily Cap Exceeded (${indication.weightBasedMaxDailyDosePerKg} mg/kg/day)`,
      message: `Proposed daily dose of ${proposedDailyDoseMg.toFixed(1)} mg/day exceeds the weight-adjusted daily limit of ${weightCap.toFixed(1)} mg/day.`,
      clinicalAction: `Cap total daily dose at ${weightCap.toFixed(1)} mg/day.`,
    });
  }

  // 8. Combination Medication Active Ingredient Verification (Augmentin)
  const isCombination = medication.isCombination;
  const activeIngredientDosingTarget = indication.targetActiveIngredient;
  let combinationTargetVerified = true;

  if (isCombination) {
    const targetIngredient = medication.activeIngredients.find(
      (ing) => ing.name.toLowerCase() === activeIngredientDosingTarget.toLowerCase()
    );

    if (!targetIngredient || !targetIngredient.isPrimaryDosingTarget) {
      combinationTargetVerified = false;
      issues.push({
        id: 'combination_target_unverified',
        category: 'combination_target',
        severity: 'critical',
        title: 'Unverified Combination Target Ingredient',
        message: `For combination drug ${medication.genericName}, pediatric dosing must target "${activeIngredientDosingTarget}", but formulation target could not be verified.`,
        clinicalAction: 'Verify that concentration and calculations are based on the primary active ingredient (e.g. Amoxicillin in Augmentin).',
      });
    }
  }

  // 9. Renal and Hepatic Impairment Adjustments
  if (patient.gfrMlMin !== undefined && patient.gfrMlMin < 50) {
    issues.push({
      id: 'renal_impairment_adjustment',
      category: 'renal_hepatic',
      severity: 'warning',
      title: `Renal Adjustment Required (GFR: ${patient.gfrMlMin} mL/min)`,
      message: medication.organAdjustments.renalAdjustment,
      clinicalAction: 'Review dosing interval and maximum permissible daily dose according to renal clearance guidelines.',
    });
  }

  if (patient.hasHepaticImpairment) {
    issues.push({
      id: 'hepatic_impairment_adjustment',
      category: 'renal_hepatic',
      severity: 'warning',
      title: 'Hepatic Function Consideration',
      message: medication.organAdjustments.hepaticAdjustment,
      clinicalAction: 'Monitor liver function enzymes; consider dose interval extension.',
    });
  }

  // 10. CDSCO Regulatory Status & Banned Fixed-Dose Combinations (FDCs)
  if (medication.regulatoryStatus?.isBannedFdcInIndia || medication.clinicalApprovalStatus === 'banned_in_children') {
    issues.push({
      id: 'cdsco_banned_pediatric_fdc',
      category: 'contraindication',
      severity: 'critical',
      title: `BANNED FIXED-DOSE COMBINATION (CDSCO): ${medication.genericName}`,
      message:
        medication.regulatoryStatus?.bannedFdcNotice ||
        medication.regulatoryStatus?.regulatoryWarning ||
        `This combination formulation is prohibited for pediatric use in India under Section 26A of the Drugs and Cosmetics Act (GSR 438(E) / CDSCO) due to safety concerns and lack of therapeutic justification.`,
      clinicalAction: 'DO NOT PRESCRIBE. Discontinue immediately and switch to verified pediatric monotherapy.',
      affectedItem: medication.genericName,
    });
  }

  // 11. Reliable Pediatric Dosing Verification Check
  if (medication.hasReliablePediatricDosing === false) {
    issues.push({
      id: 'unverified_pediatric_dosing',
      category: 'missing_information',
      severity: 'critical',
      title: `Unverified Pediatric Dosing: ${medication.genericName}`,
      message:
        'Authoritative pediatric clinical guidelines (IAP, BNFc, WHO) have not verified safe pediatric dosing parameters for this entity. Per clinical safety protocol, dose calculation is halted.',
      clinicalAction: 'Do not extrapolate adult doses. Consult a pediatric specialist or reference hospital formulary.',
      affectedItem: medication.genericName,
    });
  }

  // 12. Clinical Discrepancy Flagging Across Referenced Sources
  if (medication.discrepancyAudit?.hasDiscrepancy && medication.discrepancyAudit.requiresClinicalReview) {
    issues.push({
      id: 'clinical_discrepancy_review_required',
      category: 'clinical_discrepancy',
      severity: 'warning',
      title: `Clinical Discrepancy Flagged: ${medication.genericName}`,
      message:
        medication.discrepancyAudit.discrepancySummary ||
        'Discrepancies identified between referenced drug compendia (CDSCO/IAP/Drug Today/CIMS). Clinical review required before dosing.',
      clinicalAction:
        medication.discrepancyAudit.clinicalActionRequired ||
        medication.discrepancyAudit.clinicalRecommendation ||
        'Review patient indications and confirm dosing with primary pediatric clinical guidelines (IAP Pediatric Drug Formulary).',
      affectedItem: medication.genericName,
    });
  }

  // Final Assessment
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const canProceed = criticalCount === 0;

  let safetyStatus: 'PASS' | 'WARNING' | 'CRITICAL_STOP' = 'PASS';
  let stoppingExplanation: string | undefined;

  if (criticalCount > 0) {
    safetyStatus = 'CRITICAL_STOP';
    stoppingExplanation = `Dosing calculation stopped for clinical safety: ${criticalCount} critical safety issue(s) detected. Please resolve critical alerts before proceeding.`;
  } else if (warningCount > 0) {
    safetyStatus = 'WARNING';
  }

  return {
    canProceed,
    safetyStatus,
    criticalCount,
    warningCount,
    issues,
    stoppingExplanation,
    combinationTargetVerified,
    activeIngredientDosingTarget,
  };
}

export interface ClinicalInteractionRule {
  drugAKeywords: string[];
  drugBKeywords: string[];
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  clinicalAction: string;
}

export const PEDIATRIC_INTERACTION_RULES: ClinicalInteractionRule[] = [
  {
    drugAKeywords: ['ceftriaxone', 'rocephin', 'monocef'],
    drugBKeywords: ['calcium', 'ringer', 'hartmann', 'calcium gluconate', 'calcium chloride'],
    severity: 'critical',
    title: 'CONTRAINDICATION: Ceftriaxone + Calcium Precipitation',
    message: 'Co-administration of ceftriaxone and IV calcium solutions is contraindicated in neonates and dangerous in children due to fatal intravascular and renal ceftriaxone-calcium precipitation.',
    clinicalAction: 'Do not use calcium-containing diluents (e.g., Ringer\'s Lactate) or infuse concurrently. In children, lines must be thoroughly flushed between infusions.',
  },
  {
    drugAKeywords: ['ibuprofen', 'brufen', 'advil', 'motrin'],
    drugBKeywords: ['prednisolone', 'prednisone', 'dexamethasone', 'hydrocortisone', 'steroid'],
    severity: 'warning',
    title: 'MAJOR INTERACTION: NSAID + Systemic Corticosteroid',
    message: 'Concurrent administration of ibuprofen and oral corticosteroids synergistically increases gastrointestinal ulceration and mucosal bleeding risk.',
    clinicalAction: 'Avoid concurrent systemic NSAID and steroid therapy if feasible. If clinically indicated, co-prescribe gastric acid suppression and monitor stool for occult blood.',
  },
  {
    drugAKeywords: ['salbutamol', 'albuterol', 'ventolin', 'asthalin'],
    drugBKeywords: ['propranolol', 'labetalol', 'carvedilol', 'timolol', 'beta-blocker'],
    severity: 'critical',
    title: 'CONTRAINDICATION: Salbutamol + Non-Selective Beta-Blocker',
    message: 'Non-selective beta-blockers antagonize beta-2 bronchodilation, precipitating refractory and severe bronchospasm in pediatric patients.',
    clinicalAction: 'Non-cardioselective beta-blockers are contraindicated in pediatric patients with asthma or reactive airway disease receiving salbutamol.',
  },
  {
    drugAKeywords: ['azithromycin', 'zithromax', 'azee'],
    drugBKeywords: ['ondansetron', 'zofran', 'emeset'],
    severity: 'warning',
    title: 'MAJOR INTERACTION: Additive QTc Interval Prolongation',
    message: 'Both azithromycin and ondansetron prolong cardiac ventricular repolarization (QTc interval). Concurrent use poses additive risk of cardiac dysrhythmias and Torsades de Pointes.',
    clinicalAction: 'Perform baseline ECG if risk factors (congenital long QT, hypokalemia, hypomagnesemia) exist. Monitor cardiac rhythm or consider alternative antiemetic/antibiotic.',
  },
  {
    drugAKeywords: ['amoxicillin', 'amoxil'],
    drugBKeywords: ['amoxicillin_clavulanate', 'augmentin', 'co-amoxiclav', 'clavulanate'],
    severity: 'critical',
    title: 'CONTRAINDICATION: Duplicate Beta-Lactam Overdose',
    message: 'Augmentin already contains therapeutic doses of amoxicillin. Concomitant administration leads to unnecessary double-dosing and gastrointestinal toxicity.',
    clinicalAction: 'Discontinue single-agent amoxicillin when escalating to amoxicillin-clavulanic acid.',
  },
];

export function checkPediatricDrugInteractions(
  targetMedIdOrName: string,
  concurrentMeds: string[]
): SafetyIssue[] {
  const issues: SafetyIssue[] = [];
  if (!concurrentMeds || concurrentMeds.length === 0) return issues;

  const targetLower = targetMedIdOrName.toLowerCase();

  for (const concurrent of concurrentMeds) {
    const concurrentLower = concurrent.toLowerCase();

    for (const rule of PEDIATRIC_INTERACTION_RULES) {
      const matchA = rule.drugAKeywords.some((k) => targetLower.includes(k) || k.includes(targetLower));
      const matchB = rule.drugBKeywords.some((k) => concurrentLower.includes(k) || k.includes(concurrentLower));

      const matchRevA = rule.drugAKeywords.some((k) => concurrentLower.includes(k) || k.includes(concurrentLower));
      const matchRevB = rule.drugBKeywords.some((k) => targetLower.includes(k) || k.includes(targetLower));

      if ((matchA && matchB) || (matchRevA && matchRevB)) {
        issues.push({
          id: `interaction_${rule.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
          category: 'drug_interaction',
          severity: rule.severity,
          title: rule.title,
          message: rule.message,
          clinicalAction: rule.clinicalAction,
          affectedItem: concurrent,
        });
      }
    }
  }

  return issues;
}
