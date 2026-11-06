/**
 * PediDose Verified Pediatric Medication Database
 * Source: BNF for Children (BNFc 2025-2026), AAP Red Book (33rd Edition),
 * WHO Model Formulary for Children.
 *
 * ZERO-FABRICATION RULE: Dosing rules are verified from authoritative pediatric references.
 */

import { DatabaseMetadata, MedicationRecord } from '../types/medication.ts';
import { INDIAN_FORMULARY_RECORDS } from './indianFormularyRecords.ts';

export const DATABASE_METADATA: DatabaseMetadata = {
  version: '2026.11',
  lastUpdated: '2026-11-06',
  get totalRecords() {
    return MEDICATION_DATABASE.length;
  },
  verificationAuthority: 'IAP Pediatric Drug Formulary / CDSCO National Drug Registry / BNF for Children / AAP / WHO',
  disclaimer: 'Clinical decision-support reference database. Integrated and normalized across Indian Academy of Pediatrics (IAP), CDSCO, India Drug Index, Drug Today, and CIMS India. Must be reviewed in conjunction with patient-specific factors, organ function, and clinical judgement.',
  integratedSources: [
    'IAP Pediatric Drug Formulary (Indian Academy of Pediatrics)',
    'CDSCO Drug Registry (ABDM / MoHFW, Govt of India)',
    'India Drug Index (Pharmaceutical Compendium)',
    'Drug Today Online (Commercial Formulary Directory)',
    'CIMS / MIMS India (Prescribing & Therapeutic Reference)',
    'British National Formulary for Children (BNFc)',
    'American Academy of Pediatrics (AAP)',
    'WHO Model Formulary for Children',
  ],
};

export const BASE_MEDICATION_DATABASE: MedicationRecord[] = [
  // 1. PARACETAMOL
  {
    id: 'paracetamol',
    genericName: 'Paracetamol',
    brandNames: ['Crocin', 'Dolo', 'Calpol', 'Tylenol', 'Panadol', 'Fevelex'],
    aliases: ['PCM', 'APAP', 'Acetaminophen', 'Paracetamolum'],
    category: 'Analgesics & Antipyretics',
    subcategories: ['Fever Reducer', 'Pain Management'],
    therapeuticClass: 'Non-opioid analgesic and antipyretic',
    description: 'First-line pediatric antipyretic and analgesic for mild-to-moderate pain and reduction of fever in neonates, infants, and children.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Paracetamol',
        strengthMg: 100,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'pcm_drops',
        name: 'Infant Oral Drops (100 mg/mL)',
        type: 'drops',
        route: 'oral',
        concentration: {
          strengthMg: 100,
          volumeMl: 1,
          unit: 'mg/mL',
          displayLabel: '100 mg/mL (with calibrated dropper)',
        },
        minAgeMonths: 1,
        notes: 'High concentration for infants; measure carefully using the calibrated dropper.',
      },
      {
        id: 'pcm_syrup_120',
        name: 'Pediatric Oral Suspension (120 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 120,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '120 mg in 5 mL (24 mg/mL)',
        },
        minAgeMonths: 2,
        notes: 'Standard pediatric oral suspension for infants and toddlers.',
      },
      {
        id: 'pcm_syrup_250',
        name: 'Pediatric Suspension Forte (250 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 250,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '250 mg in 5 mL (50 mg/mL)',
        },
        minAgeMonths: 24,
        notes: 'Forte suspension suitable for older children (>= 2 years) to reduce swallow volume.',
      },
      {
        id: 'pcm_tab_500',
        name: 'Oral Tablet (500 mg, Scored)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 500,
          unit: 'mg/tablet',
          displayLabel: '500 mg per scored tablet',
        },
        canBeDivided: true,
        minAgeMonths: 72, // >= 6 years
        notes: 'Scored tablet; can be halved into 250 mg doses for children able to swallow solid tablets.',
      },
      {
        id: 'pcm_tab_650',
        name: 'Oral Tablet (650 mg, Scored)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 650,
          unit: 'mg/tablet',
          displayLabel: '650 mg per scored tablet',
        },
        canBeDivided: true,
        minAgeMonths: 144, // >= 12 years
        notes: 'For older adolescents and adults (> 12 years / > 40 kg).',
      },
      {
        id: 'pcm_iv_10mg_ml',
        name: 'Paracetamol IV Infusion (10 mg/mL, 100 mL Vial)',
        type: 'iv',
        route: 'intravenous',
        concentration: {
          strengthMg: 1000,
          volumeMl: 100,
          unit: 'mg/100mL',
          displayLabel: '10 mg/mL IV Infusion (1000 mg in 100 mL)',
        },
        minAgeMonths: 1,
        notes: 'Infuse intravenously over 15 minutes. For infants and children under 10 kg, measure precise volume via pediatric syringe.',
      },
    ],
    approvedRoutes: ['oral', 'rectal', 'intravenous'],
    indications: [
      {
        id: 'pcm_fever_pain',
        indicationName: 'Mild to Moderate Pain and Pyrexia (Fever)',
        severity: 'standard',
        description: 'Standard weight-based pediatric dosing for fever reduction and acute pain relief.',
        doseBasis: 'mg_kg_dose',
        doseValue: 15,
        recommendedFrequencyDosesPerDay: 4,
        frequencyDescription: 'Every 4 to 6 hours as needed (maximum 4 doses in 24 hours)',
        defaultTreatmentDurationDays: 3,
        durationDescription: 'Limit to 3 days without medical review',
        minAgeMonths: 1,
        maxSingleDoseMg: 1000,
        maxDailyDoseMg: 4000,
        weightBasedMaxDailyDosePerKg: 60,
        targetActiveIngredient: 'Paracetamol',
        clinicalNotes: 'Do not administer more frequently than every 4 hours. Maximum 60 mg/kg/day or 4000 mg/day, whichever is less.',
      },
      {
        id: 'pcm_post_vaccine',
        indicationName: 'Post-Immunisation Pyrexia (Infants 2-3 months)',
        severity: 'mild',
        description: 'Targeted single-dose antipyretic administration post meningococcal / routine infant vaccination.',
        doseBasis: 'fixed_dose',
        doseValue: 60,
        recommendedFrequencyDosesPerDay: 2,
        frequencyDescription: 'Single 60 mg dose at vaccination, repeated once after 4-6 hours if required',
        defaultTreatmentDurationDays: 1,
        minAgeMonths: 2,
        maxSingleDoseMg: 60,
        maxDailyDoseMg: 120,
        targetActiveIngredient: 'Paracetamol',
        clinicalNotes: 'BNFc guidance: 60 mg immediately at vaccination, repeated after 4-6 hours if fever persists.',
      },
    ],
    contraindications: [
      'Severe active hepatic impairment or acute liver failure',
      'Known hypersensitivity to paracetamol or any excipients',
    ],
    precautions: [
      'Duplicate active ingredient warning: Verify child is not taking OTC cold/cough syrups containing paracetamol.',
      'Chronic malnutrition, dehydration, or weight < 10 kg: Monitor closely to avoid cumulative hepatotoxicity.',
      'Renal impairment: Extend dosage interval to every 6-8 hours in moderate-to-severe renal impairment.',
    ],
    adverseEffectsCommon: ['Skin rash (rare)', 'Nausea', 'Thrombocytopenia (very rare)'],
    organAdjustments: {
      renalAdjustment: 'GFR 10-50 mL/min: administer every 6 hours. GFR < 10 mL/min: administer every 8 hours.',
      hepaticAdjustment: 'Dose reduction and extended intervals required in mild-to-moderate impairment; contraindicated in severe hepatic failure.',
    },
    referenceSources: [
      {
        sourceName: 'British National Formulary for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Analgesics / Paracetamol',
        recommendationLevel: 'Class A Evidence',
      },
      {
        sourceName: 'AAP Pediatric Fever Clinical Practice Guideline',
        editionOrYear: '2024',
        sectionOrUrl: 'Fever and Antipyretic Use in Children',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 2. AUGMENTIN (AMOXICILLIN + CLAVULANIC ACID)
  {
    id: 'amoxicillin_clavulanate',
    genericName: 'Amoxicillin and Clavulanic Acid (Co-amoxiclav)',
    brandNames: ['Augmentin', 'Augmentin Duo', 'Clavam', 'Curam', 'Moxikind-CV', 'Advent'],
    aliases: ['Augmentin', 'Co-amoxiclav', 'Amox-Clav', 'Augmentin Duo'],
    category: 'Antibacterial / Penicillin Combination',
    subcategories: ['Beta-Lactam Antibiotics', 'Beta-Lactamase Inhibitor Combinations'],
    therapeuticClass: 'Broad-spectrum bactericidal penicillin with beta-lactamase inhibitor',
    description: 'First-line combination antibiotic for pediatric acute otitis media, bacterial sinusitis, community-acquired pneumonia, and animal/human bite wounds.',
    isCombination: true,
    combinationRatio: '7:1 (Augmentin Duo) and 4:1 (Standard Augmentin)',
    activeIngredients: [
      {
        name: 'Amoxicillin',
        strengthMg: 200,
        unit: 'mg',
        isPrimaryDosingTarget: true, // Critical: Dosing rules ALWAYS target Amoxicillin
      },
      {
        name: 'Clavulanic Acid',
        strengthMg: 28.5,
        unit: 'mg',
        isPrimaryDosingTarget: false,
      },
    ],
    formulations: [
      {
        id: 'aug_duo_susp_228',
        name: 'Augmentin Duo Oral Suspension 7:1 (228.5 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 200, // Amoxicillin strength target
          volumeMl: 5,
          unit: 'mg/5mL (Amoxicillin)',
          displayLabel: '228.5 mg/5mL (contains 200 mg Amox + 28.5 mg Clav per 5 mL = 40 mg/mL Amox)',
        },
        minAgeMonths: 2,
        notes: '7:1 ratio enables twice-daily (BD/q12h) administration and causes less clavulanate-mediated diarrhea.',
      },
      {
        id: 'aug_susp_156',
        name: 'Augmentin Standard Oral Suspension 4:1 (156.25 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 125, // Amoxicillin strength target
          volumeMl: 5,
          unit: 'mg/5mL (Amoxicillin)',
          displayLabel: '156.25 mg/5mL (contains 125 mg Amox + 31.25 mg Clav per 5 mL = 25 mg/mL Amox)',
        },
        minAgeMonths: 1,
        notes: '4:1 ratio; typically administered 3 times daily (TDS/q8h).',
      },
      {
        id: 'aug_duo_tab_625',
        name: 'Augmentin Duo Scored Tablet 7:1 (625 mg)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 500, // Amoxicillin strength target
          unit: 'mg/tablet (Amoxicillin)',
          displayLabel: '625 mg tablet (500 mg Amox + 125 mg Clav)',
        },
        canBeDivided: true,
        minAgeMonths: 72, // >= 6 years
        notes: 'For children >= 40 kg or capable of swallowing solid tablets. Dose calculation targets the 500 mg amoxicillin fraction.',
      },
    ],
    approvedRoutes: ['oral', 'intravenous'],
    indications: [
      {
        id: 'aug_aom_standard',
        indicationName: 'Acute Otitis Media / Sinusitis (Standard Dose, Augmentin Duo 7:1)',
        severity: 'standard',
        description: 'Standard empirical pediatric treatment for acute otitis media or acute bacterial sinusitis using 7:1 formulation.',
        doseBasis: 'mg_kg_day',
        doseValue: 40,
        recommendedFrequencyDosesPerDay: 2,
        frequencyDescription: 'Every 12 hours (BD / twice daily)',
        defaultTreatmentDurationDays: 10,
        durationDescription: '7 to 10 days (5-7 days for children >= 2 years with uncomplicated infection)',
        minAgeMonths: 2,
        maxSingleDoseMg: 1000,
        maxDailyDoseMg: 2000,
        targetActiveIngredient: 'Amoxicillin',
        clinicalNotes: 'Dose is calculated on the AMOXICILLIN component (40 mg/kg/day divided in 2 doses = 20 mg/kg/dose).',
      },
      {
        id: 'aug_aom_high_dose',
        indicationName: 'Acute Otitis Media (High Dose / Recurrent / Resistant Pneumococcal)',
        severity: 'high_dose',
        description: 'High-dose regimen recommended by AAP for daycare attendees, recent antibiotic exposure, or unimmunized children.',
        doseBasis: 'mg_kg_day',
        doseValue: 90,
        recommendedFrequencyDosesPerDay: 2,
        frequencyDescription: 'Every 12 hours (BD / twice daily)',
        defaultTreatmentDurationDays: 10,
        durationDescription: '10 days',
        minAgeMonths: 2,
        maxSingleDoseMg: 1500,
        maxDailyDoseMg: 3000,
        targetActiveIngredient: 'Amoxicillin',
        clinicalNotes: 'AAP high-dose otitis media recommendation: 90 mg/kg/day of amoxicillin with 6.4 mg/kg/day clavulanate divided q12h.',
      },
      {
        id: 'aug_skin_soft_tissue',
        indicationName: 'Skin & Soft Tissue Infections / Animal Bites (Augmentin 4:1)',
        severity: 'moderate',
        description: 'Pediatric treatment for complicated soft tissue infections, wound cellulitis, or human/animal bites.',
        doseBasis: 'mg_kg_day',
        doseValue: 30,
        recommendedFrequencyDosesPerDay: 3,
        frequencyDescription: 'Every 8 hours (TDS / three times daily)',
        defaultTreatmentDurationDays: 7,
        durationDescription: '7 days',
        minAgeMonths: 1,
        maxSingleDoseMg: 500,
        maxDailyDoseMg: 1500,
        targetActiveIngredient: 'Amoxicillin',
        clinicalNotes: 'Dose calculated based on Amoxicillin: 30 mg/kg/day divided q8h using 4:1 oral suspension.',
      },
    ],
    contraindications: [
      'History of severe immediate hypersensitivity (anaphylaxis) to penicillins, ampicillin, or any beta-lactam agent',
      'History of co-amoxiclav-induced cholestatic jaundice or hepatic dysfunction',
    ],
    precautions: [
      'Gastrointestinal tolerance: Administer at start of a meal to minimize diarrhea and stomach upset.',
      'Clavulanic acid toxicity: Do not use two 375 mg tablets in place of one 625 mg tablet because it doubles the clavulanate dose.',
      'Infectious mononucleosis (EBV): High risk of erythematous morbilliform rash; avoid use if mono is suspected.',
    ],
    adverseEffectsCommon: ['Diarrhea (clavulanate-related)', 'Nausea/vomiting', 'Diaper dermatitis / Candidiasis', 'Urticarial rash'],
    organAdjustments: {
      renalAdjustment: 'GFR 10-30 mL/min: Max 15 mg/kg Amox every 12h. GFR < 10 mL/min: Max 15 mg/kg Amox once daily.',
      hepaticAdjustment: 'Dose with caution; monitor hepatic function parameters periodically.',
    },
    referenceSources: [
      {
        sourceName: 'AAP Clinical Practice Guideline: Acute Otitis Media',
        editionOrYear: '2023-2024 update',
        sectionOrUrl: 'Antibiotic Selection & Dosing (Amoxicillin/Clavulanate)',
      },
      {
        sourceName: 'British National Formulary for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Infections / Co-amoxiclav',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 3. AMOXICILLIN (PLAIN)
  {
    id: 'amoxicillin',
    genericName: 'Amoxicillin',
    brandNames: ['Amoxil', 'Mox', 'Novamox', 'Almox', 'Trimox'],
    aliases: ['Amox', 'Amoxicillinum'],
    category: 'Antibacterial / Penicillins',
    subcategories: ['Aminopenicillins'],
    therapeuticClass: 'Bactericidal aminopenicillin antibiotic',
    description: 'First-line antimicrobial for pediatric community-acquired pneumonia, acute streptococcal pharyngitis, and uncomplicated otitis media.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Amoxicillin',
        strengthMg: 125,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'amox_susp_125',
        name: 'Oral Suspension (125 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 125,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '125 mg in 5 mL (25 mg/mL)',
        },
        minAgeMonths: 1,
      },
      {
        id: 'amox_susp_250',
        name: 'Oral Suspension Forte (250 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 250,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '250 mg in 5 mL (50 mg/mL)',
        },
        minAgeMonths: 6,
      },
      {
        id: 'amox_disp_tab_250',
        name: 'Dispersible Tablet (250 mg)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 250,
          unit: 'mg/tablet',
          displayLabel: '250 mg dispersible tablet',
        },
        canBeDivided: true,
        minAgeMonths: 12,
        notes: 'Disperses rapidly in a small teaspoon of water or milk for toddlers.',
      },
      {
        id: 'amox_cap_500',
        name: 'Capsule (500 mg)',
        type: 'capsule',
        route: 'oral',
        concentration: {
          strengthMg: 500,
          unit: 'mg/capsule',
          displayLabel: '500 mg capsule',
        },
        canBeDivided: false, // Capsules cannot be halved!
        minAgeMonths: 72,
        notes: 'Do not open or divide capsules. For children able to swallow solid capsules.',
      },
    ],
    approvedRoutes: ['oral', 'intravenous'],
    indications: [
      {
        id: 'amox_aom_high_dose',
        indicationName: 'Acute Otitis Media (High Dose Protocol)',
        severity: 'high_dose',
        description: 'AAP first-line recommendation to overcome penicillin-resistant Streptococcus pneumoniae in middle ear fluid.',
        doseBasis: 'mg_kg_day',
        doseValue: 90,
        recommendedFrequencyDosesPerDay: 2,
        frequencyDescription: 'Every 12 hours (BD / twice daily)',
        defaultTreatmentDurationDays: 10,
        durationDescription: '10 days (5-7 days for children >= 2 years)',
        minAgeMonths: 2,
        maxSingleDoseMg: 1500,
        maxDailyDoseMg: 3000,
        targetActiveIngredient: 'Amoxicillin',
      },
      {
        id: 'amox_cap',
        indicationName: 'Community-Acquired Pneumonia (Mild to Moderate)',
        severity: 'standard',
        description: 'First-line oral treatment for typical bacterial community-acquired pneumonia in children.',
        doseBasis: 'mg_kg_day',
        doseValue: 50,
        recommendedFrequencyDosesPerDay: 2,
        frequencyDescription: 'Every 12 hours (BD) or every 8 hours (TDS)',
        defaultTreatmentDurationDays: 5,
        durationDescription: '5 to 7 days',
        minAgeMonths: 3,
        maxSingleDoseMg: 1000,
        maxDailyDoseMg: 2000,
        targetActiveIngredient: 'Amoxicillin',
      },
    ],
    contraindications: ['Documented penicillin allergy or anaphylaxis'],
    precautions: ['Adjust dose in severe renal impairment', 'EBV rash risk'],
    adverseEffectsCommon: ['Loose stools', 'Nausea', 'Maculopapular rash'],
    organAdjustments: {
      renalAdjustment: 'GFR 10-30 mL/min: administer every 12 hours. GFR < 10 mL/min: administer every 24 hours.',
      hepaticAdjustment: 'No primary dose adjustment required.',
    },
    referenceSources: [
      {
        sourceName: 'AAP Pediatric Infectious Diseases Society Guidelines for CAP',
        editionOrYear: '2024',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Infections / Amoxicillin',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 4. IBUPROFEN
  {
    id: 'ibuprofen',
    genericName: 'Ibuprofen',
    brandNames: ['Brufen', 'Advil', 'Motrin', 'Ibugesic', 'Nurofen'],
    aliases: ['IBU', 'Ibuprofenum'],
    category: 'Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)',
    subcategories: ['Analgesics & Antipyretics', 'Anti-inflammatory'],
    therapeuticClass: 'Propionic acid derivative NSAID (COX-1 and COX-2 inhibitor)',
    description: 'Second-line pediatric antipyretic and anti-inflammatory agent for acute pain, fever refractory to paracetamol, and juvenile arthritis.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Ibuprofen',
        strengthMg: 100,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'ibu_susp_100',
        name: 'Oral Suspension (100 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 100,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '100 mg in 5 mL (20 mg/mL)',
        },
        minAgeMonths: 3,
        notes: 'Approved for infants >= 3 months and body weight >= 5 kg.',
      },
      {
        id: 'ibu_susp_200',
        name: 'Oral Suspension Forte (200 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 200,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '200 mg in 5 mL (40 mg/mL)',
        },
        minAgeMonths: 24,
      },
      {
        id: 'ibu_tab_200',
        name: 'Tablet (200 mg, Scored)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 200,
          unit: 'mg/tablet',
          displayLabel: '200 mg scored tablet',
        },
        canBeDivided: true,
        minAgeMonths: 72,
      },
      {
        id: 'ibu_tab_400',
        name: 'Tablet (400 mg, Scored)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 400,
          unit: 'mg/tablet',
          displayLabel: '400 mg scored tablet',
        },
        canBeDivided: true,
        minAgeMonths: 144, // >= 12 years
      },
    ],
    approvedRoutes: ['oral', 'intravenous'],
    indications: [
      {
        id: 'ibu_pain_fever',
        indicationName: 'Pain and Pyrexia (Fever) Relief',
        severity: 'standard',
        description: 'Standard pediatric weight-based antipyretic dosing.',
        doseBasis: 'mg_kg_dose',
        doseValue: 10,
        recommendedFrequencyDosesPerDay: 3,
        frequencyDescription: 'Every 6 to 8 hours with food (max 3-4 doses per 24 hours)',
        defaultTreatmentDurationDays: 3,
        minAgeMonths: 3,
        minWeightKg: 5,
        maxSingleDoseMg: 400,
        maxDailyDoseMg: 1200,
        weightBasedMaxDailyDosePerKg: 40,
        targetActiveIngredient: 'Ibuprofen',
        clinicalNotes: 'Maximum 40 mg/kg/day or 1200 mg/day (up to 2400 mg/day in older adolescents under specialist supervision).',
      },
      {
        id: 'ibu_jia',
        indicationName: 'Juvenile Idiopathic Arthritis (Anti-inflammatory Regimen)',
        severity: 'high_dose',
        description: 'High-dose anti-inflammatory therapy for pediatric joint inflammation.',
        doseBasis: 'mg_kg_day',
        doseValue: 35,
        recommendedFrequencyDosesPerDay: 3,
        frequencyDescription: 'Every 8 hours with meals',
        defaultTreatmentDurationDays: 30,
        minAgeMonths: 6,
        maxSingleDoseMg: 800,
        maxDailyDoseMg: 2400,
        targetActiveIngredient: 'Ibuprofen',
      },
    ],
    contraindications: [
      'Active peptic ulceration, gastrointestinal hemorrhage, or history of NSAID-induced perforation',
      'Severe dehydration or acute kidney injury',
      'Varicella (Chickenpox): Increased risk of severe invasive group A streptococcal necrotizing fasciitis',
      'Third trimester of pregnancy in adolescent patients (risk of premature closure of ductus arteriosus)',
    ],
    precautions: [
      'Always administer with or after food/milk to prevent gastritis.',
      'Asthma: May trigger bronchospasm in aspirin-sensitive asthmatic children.',
      'Dehydrated children: High risk of renal papillary necrosis; ensure adequate rehydration prior to initiation.',
    ],
    adverseEffectsCommon: ['Dyspepsia', 'Abdominal pain', 'Diarrhea', 'Nausea'],
    organAdjustments: {
      renalAdjustment: 'Avoid in severe renal impairment (GFR < 30 mL/min). Risk of acute renal failure in volume-depleted states.',
      hepaticAdjustment: 'Dose reduction in hepatic impairment; avoid in severe cirrhosis.',
    },
    referenceSources: [
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'NSAIDs / Ibuprofen',
      },
      {
        sourceName: 'WHO Model Formulary for Children',
        editionOrYear: '2024',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 5. AZITHROMYCIN
  {
    id: 'azithromycin',
    genericName: 'Azithromycin',
    brandNames: ['Zithromax', 'Azee', 'Azithral', 'Zady', 'Azax'],
    aliases: ['AZM', 'Azithro', 'Azithromycinum'],
    category: 'Antibacterial / Macrolides',
    subcategories: ['Azalides', 'Atypical Antibacterials'],
    therapeuticClass: 'Bacteriostatic macrolide/azalide inhibiting bacterial 50S ribosomal protein synthesis',
    description: 'First-line agent for pediatric atypical pneumonia (Mycoplasma pneumoniae, Chlamydia pneumoniae), pertussis, and penicillin-allergic pharyngitis.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Azithromycin',
        strengthMg: 100,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'azm_susp_100',
        name: 'Oral Suspension (100 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 100,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '100 mg in 5 mL (20 mg/mL)',
        },
        minAgeMonths: 6,
      },
      {
        id: 'azm_susp_200',
        name: 'Oral Suspension Forte (200 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 200,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '200 mg in 5 mL (40 mg/mL)',
        },
        minAgeMonths: 6,
      },
      {
        id: 'azm_tab_250',
        name: 'Oral Tablet (250 mg)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 250,
          unit: 'mg/tablet',
          displayLabel: '250 mg film-coated tablet',
        },
        canBeDivided: false, // Film-coated, do not split
        minAgeMonths: 72,
        notes: 'Film-coated tablet; swallow whole with water. Do not crush.',
      },
      {
        id: 'azm_tab_500',
        name: 'Oral Tablet (500 mg)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 500,
          unit: 'mg/tablet',
          displayLabel: '500 mg film-coated tablet',
        },
        canBeDivided: false,
        minAgeMonths: 144,
      },
    ],
    approvedRoutes: ['oral', 'intravenous'],
    indications: [
      {
        id: 'azm_cap_atypical',
        indicationName: 'Community-Acquired Pneumonia (Atypical Pathogens / 3-Day Course)',
        severity: 'standard',
        description: 'Once-daily 3-day treatment for pediatric atypical pneumonia or acute respiratory infections.',
        doseBasis: 'mg_kg_day',
        doseValue: 10,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) for 3 consecutive days',
        defaultTreatmentDurationDays: 3,
        durationDescription: '3 days',
        minAgeMonths: 6,
        maxSingleDoseMg: 500,
        maxDailyDoseMg: 500,
        targetActiveIngredient: 'Azithromycin',
        clinicalNotes: '10 mg/kg once daily for 3 days (total course dose 30 mg/kg), max 500 mg daily.',
      },
      {
        id: 'azm_strep_5day',
        indicationName: 'Streptococcal Pharyngitis (Penicillin-Allergic / 5-Day Protocol)',
        severity: 'standard',
        description: '5-day stepdown regimen: 10 mg/kg on Day 1, followed by 5 mg/kg on Days 2-5.',
        doseBasis: 'mg_kg_day',
        doseValue: 10,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (Day 1: 10 mg/kg, Days 2-5: 5 mg/kg once daily)',
        defaultTreatmentDurationDays: 5,
        durationDescription: '5 days',
        minAgeMonths: 6,
        maxSingleDoseMg: 500,
        maxDailyDoseMg: 500,
        targetActiveIngredient: 'Azithromycin',
      },
    ],
    contraindications: [
      'Hypersensitivity to azithromycin, erythromycin, or any macrolide/ketolide antibiotic',
      'History of cholestatic jaundice / hepatic dysfunction associated with prior azithromycin use',
    ],
    precautions: [
      'QT Prolongation: Caution in patients with congenital long QT syndrome or concurrent QT-prolonging drugs.',
      'Infantile hypertrophic pyloric stenosis (IHPS): Risk in neonates treated with macrolides.',
      'Take 1 hour before or 2 hours after meals (or with food if GI upset occurs).',
    ],
    adverseEffectsCommon: ['Abdominal cramps', 'Diarrhea', 'Nausea/vomiting', 'Headache'],
    organAdjustments: {
      renalAdjustment: 'No dose adjustment required for GFR >= 10 mL/min. Caution with GFR < 10 mL/min.',
      hepaticAdjustment: 'Excreted via liver; avoid in severe hepatic failure.',
    },
    referenceSources: [
      {
        sourceName: 'AAP Pediatric Infectious Diseases Society Guidelines',
        editionOrYear: '2024',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Infections / Azithromycin',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 6. ONDANSETRON
  {
    id: 'ondansetron',
    genericName: 'Ondansetron',
    brandNames: ['Zofran', 'Emeset', 'Ondem', 'Vomikind', 'Zofer'],
    aliases: ['OND', 'Ondansetronum'],
    category: 'Antiemetics & Antinauseants',
    subcategories: ['5-HT3 Receptor Antagonists'],
    therapeuticClass: 'Selective serotonin 5-HT3 receptor antagonist',
    description: 'First-line antiemetic for acute gastroenteritis in pediatric emergency departments to facilitate successful oral rehydration therapy (ORT).',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Ondansetron',
        strengthMg: 2,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'ond_sol_2mg',
        name: 'Oral Solution (2 mg/5mL)',
        type: 'solution',
        route: 'oral',
        concentration: {
          strengthMg: 2,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '2 mg in 5 mL (0.4 mg/mL)',
        },
        minAgeMonths: 6,
      },
      {
        id: 'ond_odt_4mg',
        name: 'Orally Disintegrating Tablet (ODT 4 mg)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 4,
          unit: 'mg/tablet',
          displayLabel: '4 mg ODT (dissolves on tongue)',
        },
        canBeDivided: true,
        minAgeMonths: 12,
        notes: 'Dissolves on the tongue without requiring water; ideal for vomiting children.',
      },
      {
        id: 'ond_inj_2mg_ml',
        name: 'Ondansetron Injection (2 mg/mL, 2 mL Ampoule)',
        type: 'injection',
        route: 'intravenous',
        concentration: {
          strengthMg: 4,
          volumeMl: 2,
          unit: 'mg/2mL',
          displayLabel: '2 mg/mL (4 mg in 2 mL ampoule)',
        },
        minAgeMonths: 6,
        notes: 'Administer slow IV push over 2–5 minutes or dilute in 50 mL 5% Dextrose/0.9% NaCl over 15 minutes. Also approved for intramuscular (IM) use.',
      },
    ],
    approvedRoutes: ['oral', 'intravenous', 'intramuscular'],
    indications: [
      {
        id: 'ond_age_ort',
        indicationName: 'Acute Gastroenteritis Induced Vomiting (to facilitate Oral Rehydration)',
        severity: 'standard',
        description: 'Single-dose oral administration in ED/urgent care to enable oral fluid intake and prevent IV rehydration.',
        doseBasis: 'mg_kg_dose',
        doseValue: 0.15,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Single dose initially; may repeat after 8 hours only if persistent vomiting hinders ORT',
        defaultTreatmentDurationDays: 1,
        minAgeMonths: 6,
        maxSingleDoseMg: 4,
        maxDailyDoseMg: 8,
        targetActiveIngredient: 'Ondansetron',
        clinicalNotes: '0.15 mg/kg single oral dose (max 4 mg for weight 8-15 kg; max 8 mg for weight > 15 kg). Wait 15-30 min before offering oral fluids.',
      },
    ],
    contraindications: [
      'Congenital Long QT syndrome or concurrent apomorphine administration',
      'Known hypersensitivity to 5-HT3 antagonists',
    ],
    precautions: [
      'Gastroenteritis caveat: Ondansetron stops vomiting but does not treat diarrhea; may slightly increase stool frequency.',
      'Do not use routinely for mild, self-limiting vomiting.',
    ],
    adverseEffectsCommon: ['Headache', 'Constipation or transient diarrhea', 'Fatigue'],
    organAdjustments: {
      renalAdjustment: 'No dose adjustment required.',
      hepaticAdjustment: 'Severe hepatic impairment (Child-Pugh >= 10): Maximum total daily dose 8 mg.',
    },
    referenceSources: [
      {
        sourceName: 'AAP Clinical Practice Guideline on Acute Gastroenteritis',
        editionOrYear: '2023 update',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Gastrointestinal / Ondansetron',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 7. CETIRIZINE
  {
    id: 'cetirizine',
    genericName: 'Cetirizine Hydrochloride',
    brandNames: ['Zyrtec', 'Cetzine', 'Alerid', 'Incid-L', 'Cetrine'],
    aliases: ['CTZ', 'Cetirizine'],
    category: 'Antihistamines',
    subcategories: ['Second-Generation H1 Antagonists', 'Allergy Relief'],
    therapeuticClass: 'Selective peripheral H1-receptor inverse agonist',
    description: 'Non-sedating second-generation antihistamine for pediatric allergic rhinitis, perennial allergic conjunctivitis, and chronic spontaneous urticaria.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Cetirizine Hydrochloride',
        strengthMg: 5,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'ctz_drops_10',
        name: 'Oral Drops (10 mg/mL)',
        type: 'drops',
        route: 'oral',
        concentration: {
          strengthMg: 10,
          volumeMl: 1,
          unit: 'mg/mL',
          displayLabel: '10 mg in 1 mL (approx. 20 drops = 1 mL)',
        },
        minAgeMonths: 6,
      },
      {
        id: 'ctz_syrup_5',
        name: 'Oral Syrup (5 mg/5mL)',
        type: 'syrup',
        route: 'oral',
        concentration: {
          strengthMg: 5,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '5 mg in 5 mL (1 mg/mL)',
        },
        minAgeMonths: 12,
      },
      {
        id: 'ctz_tab_10',
        name: 'Tablet (10 mg, Scored)',
        type: 'tablet',
        route: 'oral',
        concentration: {
          strengthMg: 10,
          unit: 'mg/tablet',
          displayLabel: '10 mg scored tablet',
        },
        canBeDivided: true,
        minAgeMonths: 72,
      },
    ],
    approvedRoutes: ['oral'],
    indications: [
      {
        id: 'ctz_allergic_rhinitis',
        indicationName: 'Allergic Rhinitis and Chronic Urticaria (Age-Banded Dosing)',
        severity: 'standard',
        description: 'Fixed age-tiered pediatric dosing per BNFc recommendations.',
        doseBasis: 'fixed_dose',
        doseValue: 5,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) or divided in 2 doses for younger children',
        defaultTreatmentDurationDays: 14,
        minAgeMonths: 6,
        maxSingleDoseMg: 10,
        maxDailyDoseMg: 10,
        targetActiveIngredient: 'Cetirizine Hydrochloride',
        clinicalNotes: 'Dosing tiers: 6-23 mo: 2.5 mg OD; 2-5 yr: 2.5 mg BD or 5 mg OD; 6+ yr: 10 mg OD.',
      },
    ],
    contraindications: ['End-stage renal disease (GFR < 10 mL/min) or patients undergoing hemodialysis'],
    precautions: ['Mild sedation may occur in sensitive children; caution with concurrent sedatives.'],
    adverseEffectsCommon: ['Somnolence (mild)', 'Dry mouth', 'Headache'],
    organAdjustments: {
      renalAdjustment: 'GFR 30-49 mL/min: Reduce dose by 50%. GFR 10-29 mL/min: Reduce dose by 50% and administer every other day.',
      hepaticAdjustment: 'Dose reduction recommended in patients with combined renal and hepatic impairment.',
    },
    referenceSources: [
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Allergic Conditions / Cetirizine',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },

  // 8. SALBUTAMOL
  {
    id: 'salbutamol',
    genericName: 'Salbutamol (Albuterol)',
    brandNames: ['Ventolin', 'Asthalin', 'ProAir', 'Salamol'],
    aliases: ['Albuterol', 'Salbutamolum'],
    category: 'Respiratory / Bronchodilators',
    subcategories: ['Short-Acting Beta-2 Agonists (SABA)', 'Asthma Relievers'],
    therapeuticClass: 'Selective beta-2 adrenergic receptor agonist',
    description: 'First-line reliever bronchodilator for reversible airway obstruction in acute pediatric asthma exacerbations and viral wheeze.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Salbutamol',
        strengthMg: 2,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'sal_syrup_2',
        name: 'Oral Syrup (2 mg/5mL)',
        type: 'syrup',
        route: 'oral',
        concentration: {
          strengthMg: 2,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '2 mg in 5 mL (0.4 mg/mL)',
        },
        minAgeMonths: 24,
        notes: 'Oral route is slower and has higher systemic side-effects (tremor, tachycardia) than inhaled route.',
      },
      {
        id: 'sal_nebulizer_2_5',
        name: 'Nebulizer Solution (2.5 mg/2.5mL)',
        type: 'solution',
        route: 'inhalation',
        concentration: {
          strengthMg: 2.5,
          volumeMl: 2.5,
          unit: 'mg/2.5mL',
          displayLabel: '2.5 mg unit-dose nebule',
        },
        minAgeMonths: 1,
        notes: 'For acute severe wheeze unresponsive to MDI with spacer.',
      },
    ],
    approvedRoutes: ['inhalation', 'oral', 'intravenous'],
    indications: [
      {
        id: 'sal_bronchospasm_oral',
        indicationName: 'Reversible Airway Obstruction (Oral Relief when Inhaler Unavailable)',
        severity: 'standard',
        description: 'Weight-based oral bronchodilator dosing.',
        doseBasis: 'mg_kg_dose',
        doseValue: 0.1,
        recommendedFrequencyDosesPerDay: 3,
        frequencyDescription: 'Every 8 hours as needed (TDS)',
        defaultTreatmentDurationDays: 5,
        minAgeMonths: 24,
        maxSingleDoseMg: 2,
        maxDailyDoseMg: 8,
        targetActiveIngredient: 'Salbutamol',
        clinicalNotes: 'GINA preference is ALWAYS inhaled via spacer. Oral syrup is restricted to settings where inhalers with spacers are inaccessible.',
      },
    ],
    contraindications: ['Known hypersensitivity to salbutamol or excipients'],
    precautions: [
      'Inhaled route with spacer is clinically superior to oral syrup for efficacy and safety.',
      'Cardiovascular effects: Monitor for tachycardia, palpitations, and fine skeletal muscle tremors.',
      'Hypokalemia: High doses can cause hypokalemia; monitor potassium in severe acute asthma.',
    ],
    adverseEffectsCommon: ['Fine tremor (hands)', 'Tachycardia / palpitations', 'Agitation or restlessness'],
    organAdjustments: {
      renalAdjustment: 'No specific adjustment, but high doses should be used with caution.',
      hepaticAdjustment: 'No dose adjustment required.',
    },
    referenceSources: [
      {
        sourceName: 'Global Initiative for Asthma (GINA) Pediatric Guidelines',
        editionOrYear: '2024 update',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Respiratory / Salbutamol',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },
  // 9. CEFTRIAXONE
  {
    id: 'ceftriaxone',
    genericName: 'Ceftriaxone',
    brandNames: ['Rocephin', 'Monocef', 'Cefbact', 'Oframax'],
    aliases: ['Ceftriaxone Sodium', 'CTRN'],
    category: 'Antibiotics & Anti-infectives',
    subcategories: ['Third-Generation Cephalosporin', 'Parenteral Antibiotic', 'Sepsis & Meningitis'],
    therapeuticClass: 'Third-generation parenteral cephalosporin',
    description: 'Parenteral third-generation cephalosporin for severe pediatric infections including bacterial meningitis, sepsis, and complicated community-acquired pneumonia.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Ceftriaxone',
        strengthMg: 1000,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'cef_inj_500',
        name: 'Vial for Injection (500 mg powder)',
        type: 'injection',
        route: 'intravenous',
        concentration: {
          strengthMg: 500,
          volumeMl: 5,
          unit: '100 mg/mL',
          displayLabel: '500 mg reconstituted to 5 mL (100 mg/mL)',
        },
        minAgeMonths: 1,
        notes: 'Reconstitute with Sterile Water for Injection. Administer by slow IV injection over 2–4 minutes or IV infusion over 30 minutes.',
      },
      {
        id: 'cef_inj_1000',
        name: 'Vial for Injection (1000 mg / 1 g powder)',
        type: 'injection',
        route: 'intravenous',
        concentration: {
          strengthMg: 1000,
          volumeMl: 10,
          unit: '100 mg/mL',
          displayLabel: '1000 mg reconstituted to 10 mL (100 mg/mL)',
        },
        minAgeMonths: 1,
        notes: 'Infuse over at least 30 minutes. NEVER mix or infuse with calcium-containing IV solutions.',
      },
    ],
    approvedRoutes: ['intravenous', 'intramuscular'],
    indications: [
      {
        id: 'cef_severe_inf',
        indicationName: 'Severe Pediatric Infection / Sepsis / Severe CAP',
        severity: 'severe',
        description: 'Standard weight-based systemic antibiotic dosing for severe bacterial infections.',
        doseBasis: 'mg_kg_day',
        doseValue: 80,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) or divided every 12 hours (BD)',
        defaultTreatmentDurationDays: 7,
        minAgeMonths: 1,
        maxSingleDoseMg: 2000,
        maxDailyDoseMg: 2000,
        targetActiveIngredient: 'Ceftriaxone',
        clinicalNotes: 'Can be administered as a single daily dose (80 mg/kg/day) or divided into 40 mg/kg BD.',
      },
      {
        id: 'cef_meningitis',
        indicationName: 'Acute Bacterial Meningitis',
        severity: 'severe',
        description: 'High-dose meningeal penetration dosing.',
        doseBasis: 'mg_kg_day',
        doseValue: 100,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) or 50 mg/kg every 12 hours (BD)',
        defaultTreatmentDurationDays: 10,
        minAgeMonths: 1,
        maxSingleDoseMg: 4000,
        maxDailyDoseMg: 4000,
        targetActiveIngredient: 'Ceftriaxone',
        clinicalNotes: 'Initial dose 100 mg/kg (max 4000 mg), followed by 100 mg/kg once daily or 50 mg/kg twice daily.',
      },
    ],
    contraindications: [
      'CONTRAINDICATED in neonates (<=28 days) if they require (or are expected to require) treatment with calcium-containing IV solutions (e.g. Ringer’s Lactate, parenteral nutrition) due to risk of precipitation of ceftriaxone-calcium salt in lungs and kidneys.',
      'Neonates with hyperbilirubinemia or jaundice (displaces bilirubin from albumin binding sites, risking kernicterus).',
      'Severe immediate hypersensitivity (anaphylaxis) to cephalosporins or beta-lactam antibiotics.',
    ],
    precautions: [
      'Flush intravenous lines thoroughly with compatible solution between infusions; never mix with calcium solutions.',
      'Biliary lithiasis / pseudolithiasis reported on prolonged high doses; monitor gallbladder ultrasound if symptoms occur.',
      'Monitor prothrombin time / INR during prolonged therapy in malnourished children.',
    ],
    adverseEffectsCommon: ['Diarrhea', 'Pain at injection site', 'Rash', 'Transient elevation of liver transaminases'],
    organAdjustments: {
      renalAdjustment: 'No dose adjustment required in mild-to-moderate renal impairment; for severe impairment (GFR < 10 mL/min), daily dose should not exceed 2 g/day.',
      hepaticAdjustment: 'No dose adjustment necessary unless severe concurrent hepatic and renal impairment coexist.',
    },
    referenceSources: [
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Infections / Ceftriaxone',
      },
      {
        sourceName: 'American Academy of Pediatrics (AAP) Red Book',
        editionOrYear: '33rd Edition (2024-2027)',
        sectionOrUrl: 'Antimicrobial Therapy / Ceftriaxone',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },
  // 10. PREDNISOLONE
  {
    id: 'prednisolone',
    genericName: 'Prednisolone',
    brandNames: ['Prelone', 'Orapred', 'Pediapred', 'Omnipred'],
    aliases: ['Prednisone', 'Pred'],
    category: 'Corticosteroids & Anti-inflammatory',
    subcategories: ['Oral Corticosteroid', 'Respiratory Emergency', 'Asthma & Croup'],
    therapeuticClass: 'Systemic synthetic glucocorticoid',
    description: 'Systemic glucocorticoid for acute pediatric asthma exacerbations, croup, and acute inflammatory disorders.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Prednisolone',
        strengthMg: 5,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'pred_sol_5mg',
        name: 'Oral Solution (5 mg/5mL)',
        type: 'solution',
        route: 'oral',
        concentration: {
          strengthMg: 5,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '5 mg in 5 mL (1 mg/mL)',
        },
        minAgeMonths: 1,
        notes: 'Administer with or immediately after food or milk to reduce gastric irritation.',
      },
      {
        id: 'pred_sol_15mg',
        name: 'Oral Solution Forte (15 mg/5mL)',
        type: 'solution',
        route: 'oral',
        concentration: {
          strengthMg: 15,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '15 mg in 5 mL (3 mg/mL)',
        },
        minAgeMonths: 1,
        notes: 'Concentrated solution for older children requiring higher doses.',
      },
      {
        id: 'pred_disp_tab_5',
        name: 'Soluble / Dispersible Tablet (5 mg)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 5,
          volumeMl: 1,
          unit: 'mg',
          displayLabel: '5 mg dispersible tablet',
        },
        minAgeMonths: 12,
        canBeDivided: true,
        notes: 'Disperse in 5–10 mL of water immediately before administration.',
      },
    ],
    approvedRoutes: ['oral'],
    indications: [
      {
        id: 'pred_asthma_acute',
        indicationName: 'Acute Asthma Exacerbation (Short Course)',
        severity: 'standard',
        description: 'Systemic oral steroid burst for acute wheeze/asthma.',
        doseBasis: 'mg_kg_day',
        doseValue: 1.5,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily in the morning (OD) for 3 days',
        defaultTreatmentDurationDays: 3,
        minAgeMonths: 1,
        maxSingleDoseMg: 40,
        maxDailyDoseMg: 40,
        targetActiveIngredient: 'Prednisolone',
        clinicalNotes: 'Dose range 1–2 mg/kg/day (max 40 mg for under 5 years, 60 mg for 5–12 years) for 3–5 days without tapering.',
      },
      {
        id: 'pred_croup',
        indicationName: 'Croup (Laryngotracheobronchitis)',
        severity: 'standard',
        description: 'Oral glucocorticoid reduction of subglottic edema.',
        doseBasis: 'mg_kg_dose',
        doseValue: 1,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Single dose; repeat after 12–24h if clinically indicated',
        defaultTreatmentDurationDays: 1,
        minAgeMonths: 3,
        maxSingleDoseMg: 40,
        maxDailyDoseMg: 40,
        targetActiveIngredient: 'Prednisolone',
        clinicalNotes: 'Single dose of 1 mg/kg. Dexamethasone is an accepted alternative.',
      },
    ],
    contraindications: [
      'Systemic untreated fungal or parasitic infection.',
      'Known hypersensitivity to prednisolone or formulation excipients.',
      'Live viral vaccination during high-dose immunosuppressive therapy.',
    ],
    precautions: [
      'Gastrointestinal erosion: Synergistic mucosal ulceration and bleeding risk with concurrent NSAIDs (e.g. Ibuprofen).',
      'Short burst therapy (3–5 days) does not cause hypothalamic-pituitary-adrenal (HPA) axis suppression and can be stopped abruptly.',
      'Infection masking: May mask fever and symptoms of serious infections.',
    ],
    adverseEffectsCommon: ['Vomiting or unpleasant taste', 'Transient mood irritability or hyperactivity', 'Gastric upset', 'Appetite stimulation'],
    organAdjustments: {
      renalAdjustment: 'No dose adjustment required.',
      hepaticAdjustment: 'Use with caution; prednisolone is active and does not require hepatic conversion (unlike prednisone).',
    },
    referenceSources: [
      {
        sourceName: 'British Thoracic Society / SIGN British Guideline on the Management of Asthma',
        editionOrYear: '2024 update',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Endocrine / Corticosteroids / Prednisolone',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },
  // 11. CEFIXIME
  {
    id: 'cefixime',
    genericName: 'Cefixime',
    brandNames: ['Suprax', 'Zifi', 'Taxim-O', 'Cefspan'],
    aliases: ['CFXM'],
    category: 'Antibiotics & Anti-infectives',
    subcategories: ['Third-Generation Cephalosporin', 'Oral Antibiotic', 'Pediatric UTI'],
    therapeuticClass: 'Oral third-generation cephalosporin antibiotic',
    description: 'Oral broad-spectrum third-generation cephalosporin for uncomplicated pediatric urinary tract infections, acute otitis media, and bacterial enteritis.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Cefixime',
        strengthMg: 100,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'cfx_susp_100',
        name: 'Oral Suspension (100 mg/5mL)',
        type: 'suspension',
        route: 'oral',
        concentration: {
          strengthMg: 100,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '100 mg in 5 mL (20 mg/mL)',
        },
        minAgeMonths: 6,
        notes: 'Shake well before administration. Reconstituted suspension remains stable for 14 days at room temperature or refrigerated.',
      },
      {
        id: 'cfx_disp_tab_100',
        name: 'Dispersible Tablet (100 mg)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 100,
          volumeMl: 1,
          unit: 'mg',
          displayLabel: '100 mg dispersible tablet',
        },
        minAgeMonths: 12,
        canBeDivided: true,
        notes: 'Disperse tablet in 5–10 mL of clean water before administration.',
      },
      {
        id: 'cfx_disp_tab_200',
        name: 'Dispersible Tablet (200 mg)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 200,
          volumeMl: 1,
          unit: 'mg',
          displayLabel: '200 mg dispersible tablet',
        },
        minAgeMonths: 24,
        canBeDivided: true,
        notes: 'For older children and adolescents; can be halved along score line.',
      },
    ],
    approvedRoutes: ['oral'],
    indications: [
      {
        id: 'cfx_uti',
        indicationName: 'Uncomplicated Urinary Tract Infection (UTI)',
        severity: 'standard',
        description: 'First-line oral cephalosporin for pediatric UTI.',
        doseBasis: 'mg_kg_day',
        doseValue: 8,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) or divided into 4 mg/kg BD',
        defaultTreatmentDurationDays: 7,
        minAgeMonths: 6,
        maxSingleDoseMg: 400,
        maxDailyDoseMg: 400,
        targetActiveIngredient: 'Cefixime',
        clinicalNotes: 'AAP guidelines recommend 8 mg/kg/day as once-daily or divided twice daily for 7–10 days.',
      },
    ],
    contraindications: [
      'Severe immediate hypersensitivity (anaphylaxis) to cephalosporins or beta-lactam antibiotics.',
    ],
    precautions: [
      'Not approved for infants under 6 months due to limited safety and pharmacokinetic data.',
      'Clostridioides difficile-associated diarrhea (CDAD) risk on prolonged therapy.',
    ],
    adverseEffectsCommon: ['Loose stools or diarrhea', 'Abdominal discomfort', 'Mild nausea', 'Skin rash'],
    organAdjustments: {
      renalAdjustment: 'For GFR 20–50 mL/min, give 75% of standard dose; for GFR < 20 mL/min, give 50% of standard dose.',
      hepaticAdjustment: 'No dose adjustment required.',
    },
    referenceSources: [
      {
        sourceName: 'AAP Clinical Practice Guideline for the Diagnosis and Management of the Initial UTI in Febrile Infants and Children',
        editionOrYear: '2023 update',
      },
      {
        sourceName: 'BNF for Children (BNFc)',
        editionOrYear: '2025-2026',
        sectionOrUrl: 'Infections / Cefixime',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },
  // 12. ZINC SULFATE
  {
    id: 'zinc_sulfate',
    genericName: 'Zinc Sulfate',
    brandNames: ['Zincovit Drops', 'Zinconia', 'Micro-Zinc', 'BabyZinc'],
    aliases: ['Zinc', 'Zinc Gluconate'],
    category: 'Nutritional & Gastroenterology',
    subcategories: ['Essential Mineral', 'WHO Acute Diarrhea Protocol', 'Pediatric Enteritis'],
    therapeuticClass: 'Essential trace mineral',
    description: 'WHO/UNICEF Essential Medicine for pediatric acute diarrhea and gastroenteritis to accelerate mucosal recovery and prevent recurrences.',
    isCombination: false,
    activeIngredients: [
      {
        name: 'Elemental Zinc',
        strengthMg: 20,
        unit: 'mg',
        isPrimaryDosingTarget: true,
      },
    ],
    formulations: [
      {
        id: 'zinc_syrup_20',
        name: 'Oral Syrup (20 mg elemental zinc in 5 mL)',
        type: 'syrup',
        route: 'oral',
        concentration: {
          strengthMg: 20,
          volumeMl: 5,
          unit: 'mg/5mL',
          displayLabel: '20 mg elemental zinc in 5 mL (4 mg/mL)',
        },
        minAgeMonths: 1,
        notes: 'Administer with or after feeding to prevent vomiting.',
      },
      {
        id: 'zinc_disp_tab_20',
        name: 'Dispersible Tablet (20 mg elemental zinc)',
        type: 'dispersible_tablet',
        route: 'oral',
        concentration: {
          strengthMg: 20,
          volumeMl: 1,
          unit: 'mg',
          displayLabel: '20 mg dispersible tablet',
        },
        minAgeMonths: 2,
        canBeDivided: true,
        notes: 'WHO formulation: Disperse in 5 mL clean water or expressed breast milk.',
      },
    ],
    approvedRoutes: ['oral'],
    indications: [
      {
        id: 'zinc_diarrhea_who',
        indicationName: 'Acute Diarrhea / Gastroenteritis (WHO / UNICEF Protocol)',
        severity: 'standard',
        description: 'Fixed-duration 10–14 day oral zinc supplementation to restore intestinal epithelial integrity.',
        doseBasis: 'fixed_dose',
        doseValue: 20,
        recommendedFrequencyDosesPerDay: 1,
        frequencyDescription: 'Once daily (OD) for 10–14 days',
        defaultTreatmentDurationDays: 14,
        minAgeMonths: 1,
        maxSingleDoseMg: 20,
        maxDailyDoseMg: 20,
        targetActiveIngredient: 'Elemental Zinc',
        clinicalNotes: 'WHO Guideline: Infants under 6 months receive 10 mg/day (½ tablet or 2.5 mL syrup); children >= 6 months receive 20 mg/day for full 10–14 days.',
      },
    ],
    contraindications: [
      'Known hypersensitivity to zinc salts or formulation components.',
    ],
    precautions: [
      'Take after meals or milk feeding: zinc on an empty stomach commonly induces acute nausea or vomiting.',
      'Do not co-administer simultaneously with oral iron or copper supplements due to competitive absorption.',
    ],
    adverseEffectsCommon: ['Nausea or metallic taste', 'Transient vomiting if given without food', 'Abdominal cramping'],
    organAdjustments: {
      renalAdjustment: 'Caution in severe renal failure; zinc excretion may be diminished.',
      hepaticAdjustment: 'No dose adjustment required.',
    },
    referenceSources: [
      {
        sourceName: 'WHO / UNICEF Clinical Management of Acute Diarrhea',
        editionOrYear: 'WHO Guidelines (Revised)',
        sectionOrUrl: 'Zinc Supplementation Protocol',
      },
      {
        sourceName: 'WHO Model Formulary for Children',
        editionOrYear: 'Latest Edition',
        sectionOrUrl: 'Gastroenterology / Zinc Sulfate',
      },
    ],
    lastVerifiedDate: '2026-11-04',
    databaseVersion: '2026.11',
    verifiedBy: 'Pediatric Clinical Informatics Team',
  },
];

/**
 * Expandable Medication Database combining base BNFc/AAP records with Indian Pediatric Formularies
 * (IAP Pediatric Drug Formulary, CDSCO, India Drug Index, Drug Today, and CIMS India).
 */
export const MEDICATION_DATABASE: MedicationRecord[] = [
  ...BASE_MEDICATION_DATABASE,
  ...INDIAN_FORMULARY_RECORDS,
];

/**
 * Dynamic Medication Registration Engine
 * Allows dynamically registering new medications and updated formulations without frontend modifications.
 */
export function registerMedicationRecord(record: MedicationRecord): boolean {
  const existingIdx = MEDICATION_DATABASE.findIndex(
    (m) => m.id.toLowerCase() === record.id.toLowerCase()
  );
  if (existingIdx >= 0) {
    MEDICATION_DATABASE[existingIdx] = record;
  } else {
    MEDICATION_DATABASE.push(record);
  }
  return true;
}

/**
 * Database access utilities
 */
export function getAllMedications(): MedicationRecord[] {
  return MEDICATION_DATABASE;
}

export function getMedicationById(id: string): MedicationRecord | undefined {
  return MEDICATION_DATABASE.find((med) => med.id.toLowerCase() === id.toLowerCase());
}

export function getMedicationsByCategory(category: string): MedicationRecord[] {
  return MEDICATION_DATABASE.filter(
    (med) =>
      med.category.toLowerCase().includes(category.toLowerCase()) ||
      med.subcategories?.some((sc) => sc.toLowerCase().includes(category.toLowerCase()))
  );
}

export function getMedicationsByCountry(country: string): MedicationRecord[] {
  return MEDICATION_DATABASE.filter(
    (med) => med.country?.toLowerCase() === country.toLowerCase()
  );
}

export function getMedicationsBySource(sourceKey: 'iap' | 'cdsco' | 'idi' | 'drugToday' | 'cims'): MedicationRecord[] {
  return MEDICATION_DATABASE.filter((med) => {
    if (!med.sourceAttribution) return false;
    switch (sourceKey) {
      case 'iap':
        return !!med.sourceAttribution.iapPediatricFormulary;
      case 'cdsco':
        return !!med.sourceAttribution.cdscoDrugRegistry;
      case 'idi':
        return !!med.sourceAttribution.indiaDrugIndex;
      case 'drugToday':
        return !!med.sourceAttribution.drugTodayOnline;
      case 'cims':
        return !!med.sourceAttribution.cimsMimsIndia;
      default:
        return false;
    }
  });
}

export function getDiscrepancyFlaggedMedications(): MedicationRecord[] {
  return MEDICATION_DATABASE.filter(
    (med) => med.discrepancyAudit?.hasDiscrepancy || med.verificationStatus === 'discrepancy_flagged'
  );
}

export function getBannedOrRestrictedMedications(): MedicationRecord[] {
  return MEDICATION_DATABASE.filter(
    (med) =>
      med.regulatoryStatus?.isBannedFdcInIndia ||
      med.clinicalApprovalStatus === 'banned_in_children' ||
      med.clinicalApprovalStatus === 'restricted_pediatric'
  );
}

export function getDistinctCategories(): string[] {
  const categories = new Set<string>();
  MEDICATION_DATABASE.forEach((med) => {
    categories.add(med.category);
  });
  return Array.from(categories);
}

