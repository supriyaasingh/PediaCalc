/**
 * PediDose Advanced Clinical Medication Search Engine
 * Multi-dimensional search across generic names, brand names, abbreviations,
 * typos (Levenshtein distance), strengths, categories, and symptoms/conditions.
 */

import { MEDICATION_DATABASE } from '../data/medicationDatabase.ts';
import { IndicationDosingRule, MedicationFormulation, MedicationRecord } from '../types/medication.ts';

export interface SearchMatch {
  medication: MedicationRecord;
  matchedField: 'generic' | 'brand' | 'alias' | 'category' | 'symptom' | 'fuzzy' | 'strength';
  matchedTerm: string;
  score: number; // 0 - 100
  confidence: 'high' | 'medium' | 'low';
  matchingFormulations?: MedicationFormulation[];
  matchingIndications?: IndicationDosingRule[];
  relevanceExplanation: string;
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  results: SearchMatch[];
  isAmbiguous: boolean;
  didYouMean?: string;
  symptomNotice?: string;
}

// Symptom and condition clinical concept mappings (linking user queries to verified drug records)
const SYMPTOM_CONDITION_MAP: Record<string, { drugIds: string[]; explanation: string }> = {
  fever: {
    drugIds: ['paracetamol', 'ibuprofen'],
    explanation: 'First- and second-line antipyretics indicated for pyrexia reduction.',
  },
  'fever medicine': {
    drugIds: ['paracetamol', 'ibuprofen'],
    explanation: 'Antipyretics indicated for pediatric fever.',
  },
  pyrexia: {
    drugIds: ['paracetamol', 'ibuprofen'],
    explanation: 'Antipyretic therapy for temperature elevation.',
  },
  pain: {
    drugIds: ['paracetamol', 'ibuprofen'],
    explanation: 'Analgesics for mild to moderate pediatric pain relief.',
  },
  headache: {
    drugIds: ['paracetamol', 'ibuprofen'],
    explanation: 'Analgesics for headache management.',
  },
  antibiotic: {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'azithromycin'],
    explanation: 'Broad-spectrum antibacterial agents; selection depends on bacterial etiology and resistance patterns.',
  },
  antibiotics: {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'azithromycin'],
    explanation: 'Antimicrobial therapy for verified bacterial infections.',
  },
  'bacterial infection': {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'azithromycin'],
    explanation: 'Bactericidal and bacteriostatic agents indicated for bacterial pathogens.',
  },
  'medicine for bacterial infections': {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'azithromycin'],
    explanation: 'Antibacterials indicated for bacterial infections.',
  },
  'ear infection': {
    drugIds: ['amoxicillin_clavulanate', 'amoxicillin', 'cefpodoxime_proxetil', 'azithromycin'],
    explanation: 'Acute otitis media (AOM) first- and second-line oral antimicrobials.',
  },
  'acute otitis media': {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'cefpodoxime_proxetil', 'azithromycin'],
    explanation: 'Standard and high-dose AOM therapies.',
  },
  'otitis media': {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'cefpodoxime_proxetil', 'azithromycin'],
    explanation: 'Standard and high-dose AOM therapies.',
  },
  sinusitis: {
    drugIds: ['amoxicillin_clavulanate', 'amoxicillin', 'cefpodoxime_proxetil'],
    explanation: 'Acute bacterial rhinosinusitis therapy.',
  },
  tonsillitis: {
    drugIds: ['cefpodoxime_proxetil', 'amoxicillin', 'azithromycin'],
    explanation: 'Oral antibacterial therapy for acute streptococcal tonsillitis.',
  },
  pharyngitis: {
    drugIds: ['cefpodoxime_proxetil', 'amoxicillin', 'azithromycin'],
    explanation: 'Oral cephalosporin and penicillin therapies for group A streptococcal pharyngitis.',
  },
  pneumonia: {
    drugIds: ['amoxicillin', 'amoxicillin_clavulanate', 'azithromycin'],
    explanation: 'Community-acquired pneumonia (typical vs atypical macrolide coverage).',
  },
  vomiting: {
    drugIds: ['ondansetron'],
    explanation: 'Antiemetic for acute gastroenteritis vomiting to aid oral rehydration therapy.',
  },
  nausea: {
    drugIds: ['ondansetron'],
    explanation: 'Selective 5-HT3 receptor antagonist antiemetic.',
  },
  gastroenteritis: {
    drugIds: ['ondansetron'],
    explanation: 'Antiemetic support for oral rehydration in pediatric acute gastroenteritis.',
  },
  allergy: {
    drugIds: ['cetirizine'],
    explanation: 'Second-generation non-sedating H1 antihistamine for allergic reactions.',
  },
  'allergic rhinitis': {
    drugIds: ['cetirizine'],
    explanation: 'Antihistamine for rhinorrhea, sneezing, and ocular itching.',
  },
  urticaria: {
    drugIds: ['cetirizine'],
    explanation: 'Second-generation antihistamine for hives and chronic spontaneous urticaria.',
  },
  hives: {
    drugIds: ['cetirizine'],
    explanation: 'Antihistamine for pruritus and wheals.',
  },
  asthma: {
    drugIds: ['salbutamol'],
    explanation: 'Short-acting beta-2 agonist (SABA) bronchodilator for bronchospasm.',
  },
  wheeze: {
    drugIds: ['salbutamol'],
    explanation: 'Reliever bronchodilator for acute viral wheeze and asthma exacerbation.',
  },
  wheezing: {
    drugIds: ['salbutamol'],
    explanation: 'Reliever bronchodilator for acute viral wheeze and asthma exacerbation.',
  },
  cough: {
    drugIds: ['salbutamol', 'cetirizine', 'amoxicillin'],
    explanation: 'Symptom etiology must be diagnosed (bronchospasm vs allergic rhinitis vs lower respiratory infection).',
  },
  deworming: {
    drugIds: ['albendazole'],
    explanation: 'Broad-spectrum antihelminthic indicated for pediatric intestinal nematode infections.',
  },
  worms: {
    drugIds: ['albendazole'],
    explanation: 'Antihelminthic therapy for intestinal parasites (Ascaris, hookworm, pinworm).',
  },
  dehydration: {
    drugIds: ['oral_rehydration_salts', 'zinc_sulfate'],
    explanation: 'WHO/IAP oral rehydration salts and zinc protocol for fluid and electrolyte restoration.',
  },
  diarrhea: {
    drugIds: ['oral_rehydration_salts', 'zinc_sulfate'],
    explanation: 'Acute pediatric gastroenteritis protocol: ORS rehydration with 14-day elemental zinc supplementation.',
  },
  dysentery: {
    drugIds: ['metronidazole'],
    explanation: 'Antiprotozoal/antibacterial therapy for amebic dysentery and anaerobic enteric infections.',
  },
  rickets: {
    drugIds: ['cholecalciferol'],
    explanation: 'Vitamin D3 supplementation for nutritional rickets and pediatric hypocalcemia.',
  },
  anemia: {
    drugIds: ['iron_folic_acid'],
    explanation: 'Pediatric iron-deficiency anemia treatment and prophylactic supplementation (National Anemia Mukt Bharat).',
  },
};

/**
 * Calculates Levenshtein distance between two strings
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculates string similarity ratio (0.0 to 1.0)
 */
export function calculateSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = calculateLevenshteinDistance(s1, s2);
  return (maxLen - dist) / maxLen;
}

/**
 * Searches the verified pediatric medication database using multi-vector matching
 */
export function searchMedications(rawQuery: string): SearchResponse {
  const query = rawQuery.trim();
  const normalizedQuery = query.toLowerCase();

  if (!query) {
    return {
      query,
      normalizedQuery,
      results: [],
      isAmbiguous: false,
    };
  }

  const matchesMap = new Map<string, SearchMatch>();

  // Helper to add or upgrade a match score
  const recordMatch = (
    med: MedicationRecord,
    field: SearchMatch['matchedField'],
    term: string,
    score: number,
    explanation: string,
    extraFormulations?: MedicationFormulation[],
    extraIndications?: IndicationDosingRule[]
  ) => {
    const existing = matchesMap.get(med.id);
    if (!existing || existing.score < score) {
      matchesMap.set(med.id, {
        medication: med,
        matchedField: field,
        matchedTerm: term,
        score,
        confidence: score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low',
        relevanceExplanation: explanation,
        matchingFormulations: extraFormulations,
        matchingIndications: extraIndications,
      });
    }
  };

  // 1. Exact & Substring Match on Generic Name
  for (const med of MEDICATION_DATABASE) {
    const genLower = med.genericName.toLowerCase();
    if (genLower === normalizedQuery) {
      recordMatch(med, 'generic', med.genericName, 100, `Exact match on generic name "${med.genericName}"`);
      continue;
    }
    if (genLower.startsWith(normalizedQuery)) {
      recordMatch(med, 'generic', med.genericName, 90, `Generic name starts with "${query}"`);
      continue;
    }
    if (genLower.includes(normalizedQuery)) {
      recordMatch(med, 'generic', med.genericName, 82, `Generic name contains "${query}"`);
    }
  }

  // 2. Brand Name Matches
  for (const med of MEDICATION_DATABASE) {
    for (const brand of med.brandNames) {
      const brandLower = brand.toLowerCase();
      if (brandLower === normalizedQuery) {
        recordMatch(med, 'brand', brand, 98, `Exact match on brand name "${brand}"`);
        break;
      }
      if (brandLower.startsWith(normalizedQuery)) {
        recordMatch(med, 'brand', brand, 88, `Brand name "${brand}" starts with "${query}"`);
        break;
      }
      if (brandLower.includes(normalizedQuery)) {
        recordMatch(med, 'brand', brand, 80, `Brand name "${brand}" contains "${query}"`);
        break;
      }
    }
  }

  // 3. Common Abbreviations & Aliases Match (PCM, APAP, IBU, AZM, Amox)
  for (const med of MEDICATION_DATABASE) {
    for (const alias of med.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === normalizedQuery) {
        recordMatch(med, 'alias', alias, 96, `Standard clinical abbreviation "${alias}"`);
        break;
      }
      if (aliasLower.includes(normalizedQuery) || normalizedQuery.includes(aliasLower)) {
        recordMatch(med, 'alias', alias, 84, `Abbreviation match on "${alias}"`);
        break;
      }
    }
  }

  // 4. Category & Subcategory Match (e.g. Antibiotics, Analgesics, Antipyretic)
  for (const med of MEDICATION_DATABASE) {
    const catLower = med.category.toLowerCase();
    if (catLower.includes(normalizedQuery) || normalizedQuery.includes(catLower)) {
      recordMatch(med, 'category', med.category, 75, `Matches drug category "${med.category}"`);
    }
    for (const sub of med.subcategories || []) {
      if (sub.toLowerCase().includes(normalizedQuery)) {
        recordMatch(med, 'category', sub, 74, `Matches subcategory "${sub}"`);
      }
    }
  }

  // 5. Formulation & Strength Match (e.g., "500 mg", "228.5", "120 mg/5ml")
  const strengthTokens = normalizedQuery.match(/\d+(\.\d+)?/g);
  if (strengthTokens && strengthTokens.length > 0) {
    for (const med of MEDICATION_DATABASE) {
      const matchedForms = med.formulations.filter((f) => {
        const display = f.concentration.displayLabel.toLowerCase();
        return strengthTokens.some((tok) => display.includes(tok));
      });
      if (matchedForms.length > 0) {
        recordMatch(
          med,
          'strength',
          matchedForms[0].concentration.displayLabel,
          78,
          `Matches available strength formulation: ${matchedForms[0].name}`,
          matchedForms
        );
      }
    }
  }

  // 6. Medical Condition & Symptom Match
  let symptomNotice: string | undefined;
  for (const [symptomKey, config] of Object.entries(SYMPTOM_CONDITION_MAP)) {
    if (normalizedQuery === symptomKey || normalizedQuery.includes(symptomKey) || symptomKey.includes(normalizedQuery)) {
      symptomNotice = 'Symptom-based candidates: Multiple medications may treat this condition. Clinical evaluation required; never prescribe solely based on a symptom.';
      for (const drugId of config.drugIds) {
        const drug = MEDICATION_DATABASE.find((d) => d.id === drugId);
        if (drug) {
          const matchedInds = drug.indications.filter((ind) =>
            ind.indicationName.toLowerCase().includes(symptomKey) ||
            ind.description.toLowerCase().includes(symptomKey)
          );
          recordMatch(
            drug,
            'symptom',
            symptomKey,
            72,
            `Condition/Symptom "${symptomKey}": ${config.explanation}`,
            undefined,
            matchedInds.length > 0 ? matchedInds : undefined
          );
        }
      }
    }
  }

  // 7. Misspelling & Fuzzy Match (Levenshtein Distance)
  // Run if no high-confidence exact match was already found
  let closestSuggestion: { name: string; sim: number } | undefined;
  for (const med of MEDICATION_DATABASE) {
    const candidates = [med.genericName, ...med.brandNames, ...med.aliases];
    for (const candidate of candidates) {
      const sim = calculateSimilarity(normalizedQuery, candidate);
      if (sim >= 0.70 && sim < 1.0) {
        const fuzzyScore = Math.round(sim * 85);
        recordMatch(
          med,
          'fuzzy',
          candidate,
          fuzzyScore,
          `Fuzzy match for "${candidate}" (spelling correction)`
        );
        if (!closestSuggestion || sim > closestSuggestion.sim) {
          closestSuggestion = { name: candidate, sim };
        }
      }
    }
  }

  // Sort by score descending
  const sortedResults = Array.from(matchesMap.values()).sort((a, b) => b.score - a.score);

  // Ambiguity detection:
  // True if multiple results exist and the top result doesn't have an overwhelming dominance (>25 points higher than 2nd)
  const isAmbiguous =
    sortedResults.length > 1 &&
    (sortedResults[0].score - sortedResults[1].score < 15 || sortedResults[0].score < 90);

  return {
    query,
    normalizedQuery,
    results: sortedResults,
    isAmbiguous,
    didYouMean: closestSuggestion?.name,
    symptomNotice,
  };
}
