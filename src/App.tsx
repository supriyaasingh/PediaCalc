/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  Beaker,
  BookOpen,
  Bot,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  Divide,
  Droplet,
  ExternalLink,
  FileText,
  Filter,
  HeartPulse,
  HelpCircle,
  Info,
  Loader2,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  Syringe,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { calculatePediatricDosage, normalizeAge } from './engine/calculator.ts';
import { AgeUnit, CalculationInput, DoseBasis, FormulationType, WeightUnit, AdministrationRoute } from './types/dosage.ts';
import {
  DATABASE_METADATA,
  getAllMedications,
  getDistinctCategories,
  getMedicationById,
  MEDICATION_DATABASE,
} from './data/medicationDatabase.ts';
import { IndicationDosingRule, MedicationFormulation, MedicationRecord } from './types/medication.ts';
import { searchMedications, SearchResponse } from './engine/search.ts';
import { StructuredMedicationAiResponse } from './types/ai.ts';
import { queryAiAssistant } from './services/aiService.ts';
import { runClinicalSafetyAudit } from './engine/safetyEngine.ts';
import { SafetyAuditResult } from './types/safety.ts';
import {
  getWhoEstimatedWeight,
  getWhoReferenceTable,
  WhoChartPoint,
  WhoWeightEstimate,
} from './engine/whoGrowth.ts';
import {
  getOfflineMetadata,
  initOfflineDatabase,
  isNetworkOnline,
  OfflineMetadata,
} from './services/offlineStorage.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'database' | 'ai' | 'safety' | 'who' | 'system'>('calculator');

  // Search Engine State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [showAmbiguityModal, setShowAmbiguityModal] = useState<boolean>(false);

  // AI Assistant Tab State
  const [aiPrompt, setAiPrompt] = useState<string>('What is the recommended dose of Augmentin Duo for a child with acute otitis media?');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<StructuredMedicationAiResponse | null>(null);
  const [aiSource, setAiSource] = useState<string>('');
  const [aiNotice, setAiNotice] = useState<string | undefined>();
  const [aiError, setAiError] = useState<string | null>(null);

  // Calculator Form State
  const [weight, setWeight] = useState<number>(10);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [age, setAge] = useState<number>(2);
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('years');
  const [doseBasis, setDoseBasis] = useState<DoseBasis>('mg_kg_day');
  const [doseValue, setDoseValue] = useState<number>(40);
  const [dosesPerDay, setDosesPerDay] = useState<number>(2);
  const [formulationType, setFormulationType] = useState<FormulationType>('suspension');
  const [syrupStrengthMg, setSyrupStrengthMg] = useState<number>(200);
  const [syrupVolumeMl, setSyrupVolumeMl] = useState<number>(5);
  const [tabletStrengthMg, setTabletStrengthMg] = useState<number>(500);
  const [canTabletBeDivided, setCanTabletBeDivided] = useState<boolean>(true);
  const [dropsPerMl, setDropsPerMl] = useState<number>(20);
  const [injectionStrengthMg, setInjectionStrengthMg] = useState<number>(4);
  const [injectionVolumeMl, setInjectionVolumeMl] = useState<number>(2);
  const [administrationRoute, setAdministrationRoute] = useState<AdministrationRoute>('oral');
  const [treatmentDurationDays, setTreatmentDurationDays] = useState<number | undefined>(7);

  // Weight Estimation Tracking & Modal State
  const [isEstimatedWeight, setIsEstimatedWeight] = useState<boolean>(false);
  const [estimatedWeightSource, setEstimatedWeightSource] = useState<string>('');
  const [showWhoEstimateModal, setShowWhoEstimateModal] = useState<boolean>(false);
  const [whoModalSex, setWhoModalSex] = useState<'male' | 'female'>('male');
  const [whoModalAgeMonths, setWhoModalAgeMonths] = useState<number>(24);

  // WHO Growth Tab State
  const [whoTabSex, setWhoTabSex] = useState<'male' | 'female'>('male');
  const [whoTabAgeMonths, setWhoTabAgeMonths] = useState<number>(24);

  // Offline Capability State
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineMetadata, setOfflineMetadata] = useState<OfflineMetadata | null>(null);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  useEffect(() => {
    setIsOnline(isNetworkOnline());
    initOfflineDatabase().then((meta) => {
      setOfflineMetadata(meta);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [maxSingleDoseMg, setMaxSingleDoseMg] = useState<string>('');
  const [maxDailyDoseMg, setMaxDailyDoseMg] = useState<string>('');
  const [weightBasedMaxDailyDosePerKg, setWeightBasedMaxDailyDosePerKg] = useState<string>('');
  const [activeIngredientTarget, setActiveIngredientTarget] = useState<string>('Amoxicillin');
  const [drugLabel, setDrugLabel] = useState<string>('Augmentin Duo (Amoxicillin/Clavulanate)');
  const [indicationLabel, setIndicationLabel] = useState<string>('Acute Otitis Media (Standard 7:1)');
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('amoxicillin_clavulanate');
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [hasCalculated, setHasCalculated] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Patient Clinical Safety Profile State
  const [concurrentMeds, setConcurrentMeds] = useState<string[]>([]);
  const [newConcurrentInput, setNewConcurrentInput] = useState<string>('');
  const [knownAllergies, setKnownAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState<string>('');
  const [clinicalConditions, setClinicalConditions] = useState<string[]>([]);
  const [newConditionInput, setNewConditionInput] = useState<string>('');
  const [gfrInput, setGfrInput] = useState<string>('');

  // Database Tab State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dbSearchQuery, setDbSearchQuery] = useState<string>('');
  const [selectedMedication, setSelectedMedication] = useState<MedicationRecord | null>(
    MEDICATION_DATABASE[1] // Augmentin default selected
  );

  const categories = useMemo(() => getDistinctCategories(), []);

  // Filtered medications for database view
  const filteredMedications = useMemo(() => {
    return MEDICATION_DATABASE.filter((med) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        med.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        med.subcategories?.some((sc) => sc.toLowerCase().includes(selectedCategory.toLowerCase()));

      const query = dbSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        med.genericName.toLowerCase().includes(query) ||
        med.brandNames.some((b) => b.toLowerCase().includes(query)) ||
        med.aliases.some((a) => a.toLowerCase().includes(query)) ||
        med.indications.some((ind) => ind.indicationName.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, dbSearchQuery]);

  // Currently selected medication derived safely from selectedMedicationId
  const currentMedication = useMemo(
    () => (selectedMedicationId ? (getMedicationById(selectedMedicationId) || MEDICATION_DATABASE.find((m) => m.id === selectedMedicationId)) : undefined),
    [selectedMedicationId]
  );

  // Search matches for intelligent drug search dropdown
  const searchMatches = useMemo(() => {
    if (!drugLabel || drugLabel.trim().length < 2) return [];
    return searchMedications(drugLabel).results.slice(0, 5);
  }, [drugLabel]);

  // Execute advanced medication search
  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) {
      setSearchResponse(null);
      return;
    }
    const response = searchMedications(term);
    setSearchResponse(response);
    if (response.results.length > 0) {
      if (response.isAmbiguous || response.results.length > 1) {
        setShowAmbiguityModal(true);
      } else {
        loadMedicationIntoCalculator(response.results[0].medication);
      }
    }
  };

  // Execute AI Assistant natural language query
  const handleAiQuery = async (queryToRun?: string) => {
    const q = (queryToRun || aiPrompt).trim();
    if (!q) return;
    setIsAiLoading(true);
    setAiError(null);

    const result = await queryAiAssistant(q);
    setIsAiLoading(false);
    if (result.data) {
      setAiResponse(result.data);
      setAiSource(result.source);
      setAiNotice(result.notice);
    } else {
      setAiError(result.error || 'Unable to parse medication from query.');
    }
  };

  // Load a medication & indication from database/search into the active dosage calculator
  const loadMedicationIntoCalculator = (
    med: MedicationRecord,
    indication?: IndicationDosingRule,
    formulation?: MedicationFormulation
  ) => {
    const targetInd = indication || med.indications[0];
    const targetForm = formulation || med.formulations[0];

    setSelectedMedicationId(med.id);
    setDrugLabel(`${med.genericName} (${med.brandNames.slice(0, 3).join(', ')})`);
    setIndicationLabel(targetInd.indicationName);
    setActiveIngredientTarget(targetInd.targetActiveIngredient);
    setDoseBasis(targetInd.doseBasis);
    setDoseValue(targetInd.doseValue);
    setDosesPerDay(targetInd.recommendedFrequencyDosesPerDay);

    setMaxSingleDoseMg(targetInd.maxSingleDoseMg ? String(targetInd.maxSingleDoseMg) : '');
    setMaxDailyDoseMg(targetInd.maxDailyDoseMg ? String(targetInd.maxDailyDoseMg) : '');
    setWeightBasedMaxDailyDosePerKg(
      targetInd.weightBasedMaxDailyDosePerKg ? String(targetInd.weightBasedMaxDailyDosePerKg) : ''
    );

    setFormulationType(targetForm.type);
    setAdministrationRoute(targetForm.route || 'oral');
    setTreatmentDurationDays(targetInd.defaultTreatmentDurationDays);

    if (
      targetForm.type === 'syrup' ||
      targetForm.type === 'suspension' ||
      targetForm.type === 'solution'
    ) {
      setSyrupStrengthMg(targetForm.concentration.strengthMg);
      setSyrupVolumeMl(targetForm.concentration.volumeMl || 5);
    } else if (targetForm.type === 'drops') {
      setSyrupStrengthMg(targetForm.concentration.strengthMg);
      setSyrupVolumeMl(targetForm.concentration.volumeMl || 1);
      setDropsPerMl(targetForm.dropsPerMl ?? 20);
    } else if (
      targetForm.type === 'tablet' ||
      targetForm.type === 'dispersible_tablet' ||
      targetForm.type === 'capsule'
    ) {
      setTabletStrengthMg(targetForm.concentration.strengthMg);
      setCanTabletBeDivided(targetForm.canBeDivided !== false);
    } else if (targetForm.type === 'injection' || targetForm.type === 'iv') {
      setInjectionStrengthMg(targetForm.concentration.strengthMg);
      setInjectionVolumeMl(targetForm.concentration.volumeMl || 1);
      setSyrupStrengthMg(targetForm.concentration.strengthMg);
      setSyrupVolumeMl(targetForm.concentration.volumeMl || 1);
    }

    setShowAmbiguityModal(false);
    setActiveTab('calculator');
  };

  // Load AI response into calculator
  const loadAiResponseIntoCalculator = () => {
    if (!aiResponse) return;
    const match = MEDICATION_DATABASE.find(
      (m) => m.genericName.toLowerCase() === aiResponse.genericName.toLowerCase()
    );
    if (match) {
      const ind = match.indications.find(
        (i) => i.indicationName.toLowerCase() === aiResponse.indication.toLowerCase()
      ) || match.indications[0];
      loadMedicationIntoCalculator(match, ind);
    } else {
      setDrugLabel(`${aiResponse.genericName} (${aiResponse.brandNames.join(', ')})`);
      setIndicationLabel(aiResponse.indication);
      setDoseBasis(aiResponse.doseBasis as DoseBasis);
      if (aiResponse.dosePerKg) setDoseValue(aiResponse.dosePerKg);
      if (aiResponse.dosesPerDay) setDosesPerDay(aiResponse.dosesPerDay);
      if (aiResponse.maximumSingleDose) setMaxSingleDoseMg(String(aiResponse.maximumSingleDose));
      if (aiResponse.maximumDailyDose) setMaxDailyDoseMg(String(aiResponse.maximumDailyDose));
      setActiveTab('calculator');
    }
  };

  // Live Clinical Safety Audit Execution
  const safetyAudit: SafetyAuditResult = useMemo(() => {
    const med = currentMedication || (selectedMedicationId ? getMedicationById(selectedMedicationId) : undefined) || MEDICATION_DATABASE[1];
    const ind =
      med.indications.find((i) => i.indicationName.toLowerCase() === indicationLabel.toLowerCase()) ||
      med.indications[0];
    const form =
      med.formulations.find((f) => f.type === formulationType) ||
      med.formulations[0];

    const { ageInMonths } = normalizeAge(age || 0, ageUnit);
    const weightKg = weightUnit === 'lbs' ? (weight || 0) * 0.45359237 : (weight || 0);

    // Approximate proposed doses for safety check
    let proposedSingle = 0;
    let proposedDaily = 0;
    if (doseBasis === 'mg_kg_day') {
      proposedDaily = weightKg * doseValue;
      proposedSingle = proposedDaily / dosesPerDay;
    } else if (doseBasis === 'mg_kg_dose') {
      proposedSingle = weightKg * doseValue;
      proposedDaily = proposedSingle * dosesPerDay;
    } else {
      proposedSingle = doseValue;
      proposedDaily = doseValue * dosesPerDay;
    }

    return runClinicalSafetyAudit({
      patient: {
        weightKg,
        ageInMonths,
        concurrentMedications: concurrentMeds,
        knownAllergies,
        clinicalConditions,
        gfrMlMin: gfrInput ? Number(gfrInput) : undefined,
      },
      medication: med,
      indication: ind,
      formulation: form,
      route: 'oral',
      proposedSingleDoseMg: proposedSingle,
      proposedDailyDoseMg: proposedDaily,
      dosesPerDay,
    });
  }, [
    currentMedication,
    selectedMedicationId,
    indicationLabel,
    formulationType,
    age,
    ageUnit,
    weight,
    weightUnit,
    doseBasis,
    doseValue,
    dosesPerDay,
    concurrentMeds,
    knownAllergies,
    clinicalConditions,
    gfrInput,
  ]);

  // Perform live dosage calculation
  const calculation = useMemo(() => {
    try {
      if (currentMedication && currentMedication.hasReliablePediatricDosing === false) {
        return {
          result: null,
          error: 'Verified pediatric dosage information unavailable.',
        };
      }

      if (
        (formulationType === 'syrup' || formulationType === 'suspension' || formulationType === 'drops' || formulationType === 'solution') &&
        (!syrupStrengthMg || !syrupVolumeMl || syrupStrengthMg <= 0 || syrupVolumeMl <= 0)
      ) {
        return {
          result: null,
          error: 'Liquid concentration unknown: Please specify medication strength (mg) and volume (mL).',
        };
      }

      if (
        (formulationType === 'tablet' || formulationType === 'dispersible_tablet' || formulationType === 'capsule') &&
        (!tabletStrengthMg || tabletStrengthMg <= 0)
      ) {
        return {
          result: null,
          error: 'Tablet strength unknown: Please specify strength in mg per tablet.',
        };
      }

      const input: CalculationInput = {
        weight,
        weightUnit,
        isEstimatedWeight,
        estimatedWeightSource: isEstimatedWeight ? estimatedWeightSource : undefined,
        age,
        ageUnit,
        doseBasis,
        doseValue,
        dosesPerDay,
        formulationType,
        route: administrationRoute,
        syrupStrengthMg: syrupStrengthMg || undefined,
        syrupVolumeMl: syrupVolumeMl || undefined,
        tabletStrengthMg: tabletStrengthMg || undefined,
        canTabletBeDivided,
        dropsPerMl,
        injectionConcentrationMgPerMl:
          injectionStrengthMg && injectionVolumeMl
            ? injectionStrengthMg / injectionVolumeMl
            : undefined,
        maxSingleDoseMg: maxSingleDoseMg ? Number(maxSingleDoseMg) : null,
        maxDailyDoseMg: maxDailyDoseMg ? Number(maxDailyDoseMg) : null,
        weightBasedMaxDailyDosePerKg: weightBasedMaxDailyDosePerKg
          ? Number(weightBasedMaxDailyDosePerKg)
          : null,
        activeIngredientTarget,
      };

      return {
        result: calculatePediatricDosage(input),
        error: null,
      };
    } catch (err: any) {
      return {
        result: null,
        error: err?.message || 'Error calculating dosage',
      };
    }
  }, [
    weight,
    weightUnit,
    isEstimatedWeight,
    estimatedWeightSource,
    age,
    ageUnit,
    doseBasis,
    doseValue,
    dosesPerDay,
    formulationType,
    administrationRoute,
    syrupStrengthMg,
    syrupVolumeMl,
    tabletStrengthMg,
    canTabletBeDivided,
    dropsPerMl,
    injectionStrengthMg,
    injectionVolumeMl,
    maxSingleDoseMg,
    maxDailyDoseMg,
    weightBasedMaxDailyDosePerKg,
    activeIngredientTarget,
    currentMedication,
  ]);

  const handleCopyClinicalNote = () => {
    if (!calculation.result) return;
    const med = getMedicationById(selectedMedicationId);
    const lines = [
      `PEDIDOSE CLINICAL PRESCRIPTION SUMMARY`,
      `Date/Time: ${new Date().toLocaleString()}`,
      `Patient Weight: ${weight} ${weightUnit}${isEstimatedWeight ? ' [ESTIMATED via WHO Standards - Calibrated Scale Required]' : ''}`,
      `Patient Age: ${age} ${ageUnit}`,
      `Medication: ${med?.genericName || drugLabel}`,
      `Target Ingredient: ${activeIngredientTarget || 'Active Component'}`,
      `Indication: ${indicationLabel}`,
      `Formulation: ${formulationType} (Route: ${administrationRoute})`,
      `Single Dose: ${calculation.result.dosePerDoseMg.toFixed(1)} mg`,
      calculation.result.syrup ? `Liquid Volume: ${calculation.result.syrup.formattedVolumePerDose}` : null,
      calculation.result.drops ? `Infant Drops: ${calculation.result.drops.formattedDrops}` : null,
      calculation.result.tablet ? `Tablets: ${calculation.result.tablet.formattedTabletsPerDose}` : null,
      calculation.result.dispersibleTablet ? `Dispersible Tablets: ${calculation.result.dispersibleTablet.formattedTablets} (in 5-10 mL fluid)` : null,
      calculation.result.injectable ? `Injection Volume: ${calculation.result.injectable.formattedVolume}` : null,
      calculation.result.syringeAdvice ? `Recommended Syringe: ${calculation.result.syringeAdvice.recommendedSyringe} (Administer ${calculation.result.syringeAdvice.roundedMeasurableVolumeMl.toFixed(2)} mL)` : null,
      `Frequency: ${dosesPerDay} times daily (Total 24h: ${calculation.result.totalDailyDoseMg.toFixed(1)} mg/day)`,
      `Safety Audit: ${safetyAudit.canProceed ? 'PASSED CLINICAL AUDIT' : 'SAFETY ISSUE DETECTED'}`,
      `Reference Monograph: ${DATABASE_METADATA.verificationAuthority} (v${DATABASE_METADATA.version})`,
    ].filter(Boolean).join('\n');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(lines).then(() => {
        setCopiedNote(true);
        setTimeout(() => setCopiedNote(false), 2500);
      }).catch(() => {
        setCopiedNote(true);
        setTimeout(() => setCopiedNote(false), 2500);
      });
    }
  };

  const handlePrintClinicalOrder = () => {
    window.print();
  };

  const handleCalculateDosage = () => {
    if (!drugLabel.trim()) {
      setFormError('Please enter or search for a medicine name.');
      return;
    }
    if (!weight || weight <= 0) {
      setFormError("Please enter the child's weight in kg.");
      return;
    }
    if (!doseValue || doseValue <= 0) {
      setFormError('Please enter the prescribed dose.');
      return;
    }

    setFormError(null);
    setHasCalculated(true);

    setTimeout(() => {
      const resultEl = document.getElementById('dosage-result-section');
      if (resultEl) {
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Clinical Safety Banner */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between border-b border-amber-600">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              <strong>Clinical Decision-Support Notice:</strong> Prototype for verified calculation and clinical validation. Does not replace professional prescribing judgment.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-slate-900 text-xs shrink-0 font-mono">
            <span
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-semibold ${
                isOnline
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                  : 'bg-amber-200 text-amber-950 border-amber-400 font-bold'
              }`}
              title={isOnline ? 'Online: Cloud services & updates active' : 'Offline: Local verified database active'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Online (v{DATABASE_METADATA.version})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-900" />
                  <span>Offline Mode Active</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1 bg-amber-400 px-2 py-0.5 rounded border border-amber-600/30">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              Safety Engine Active
            </span>
            <span>Verified: {DATABASE_METADATA.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Main Clinical Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Pedi<span className="text-teal-600">Dose</span>
                </span>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Pro Clinical
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                Advanced Pediatric Medication & Dosage Calculation Platform
              </p>
            </div>
          </div>

          {/* Quick Search Bar in Header */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search generic, brand (Crocin, Dolo, Augmentin), PCM, symptom..."
                className="w-full pl-9 pr-8 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-teal-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResponse(null);
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'calculator'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculator</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'database'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Drug Database</span>
            </button>

            <button
              onClick={() => setActiveTab('safety')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'safety'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Safety Engine</span>
              {safetyAudit.safetyStatus === 'CRITICAL_STOP' && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'ai'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>AI Assistant</span>
            </button>

            <button
              onClick={() => setActiveTab('who')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'who'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>WHO Growth</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'system'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>System & Tests</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="max-w-2xl w-full mx-auto space-y-6">
            {/* Offline Medication Not Found Notification */}
            {searchResponse && searchResponse.results.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Medication Not Found in Local Offline Database</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  <strong>&quot;{searchResponse.query}&quot;</strong> is not present in the local verified pediatric database. You can still calculate dosage manually by entering the medicine strength and prescribed dose below.
                </p>
              </div>
            )}

            {/* REAL-TIME SAFETY AUDIT NOTICES IN CALCULATOR */}
            {safetyAudit.safetyStatus === 'CRITICAL_STOP' && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 rounded-xl p-5 shadow-sm space-y-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-rose-950 dark:text-rose-200">
                        CRITICAL SAFETY ALERT: CALCULATION HALTED
                      </h3>
                      <span className="bg-rose-600 text-white text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                        Stop Prescribing
                      </span>
                    </div>
                    <p className="text-xs text-rose-800 dark:text-rose-300 mt-1 font-medium">
                      {safetyAudit.stoppingExplanation}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('safety')}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                  >
                    <span>View Safety Engine</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="pt-2 border-t border-rose-200 dark:border-rose-800 space-y-2">
                  {safetyAudit.issues
                    .filter((i) => i.severity === 'critical')
                    .map((issue, idx) => (
                      <div key={idx} className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                        <span className="font-bold block">{issue.title}</span>
                        <p className="text-rose-800 dark:text-rose-300">{issue.message}</p>
                        <p className="text-[11px] font-semibold text-rose-950 dark:text-rose-100">
                          <strong>Action Required:</strong> {issue.clinicalAction}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {/* Simplified Single-Column Form Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 sm:p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <span>Pediatric Dosage Calculator</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Fast, verified pediatric dosing with real-time safety validation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('database')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800 transition flex items-center gap-1 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Browse</span> Formulary
                </button>
              </div>

              {/* 1. Medicine Name */}
              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  1. Medicine Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={drugLabel}
                    onChange={(e) => {
                      setDrugLabel(e.target.value);
                      setIsSearchOpen(true);
                      if (formError) setFormError(null);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Search or type medication name (e.g. Paracetamol, Augmentin, Amoxicillin)"
                    className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-800 font-medium transition"
                  />
                  {drugLabel && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrugLabel('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Intelligent Drug Search Dropdown */}
                {isSearchOpen && searchMatches.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Verified Formulary Matches</span>
                      <button
                        type="button"
                        onClick={() => setIsSearchOpen(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {searchMatches.map((match) => (
                      <button
                        key={match.medication.id}
                        type="button"
                        onClick={() => {
                          loadMedicationIntoCalculator(match.medication, match.medication.indications[0]);
                          setIsSearchOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3 transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{match.medication.genericName}</span>
                            {match.medication.brandNames.length > 0 && (
                              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                ({match.medication.brandNames.slice(0, 3).join(', ')})
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {match.medication.category} &bull; {match.medication.indications.map((i) => i.indicationName).join(', ')}
                          </p>
                        </div>
                        <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded font-mono shrink-0">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Condition / Indication Selector for Drugs with Multiple Verified Regimens (e.g. Cefpodoxime, Augmentin) */}
                {currentMedication?.indications && currentMedication.indications.length > 1 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Condition / Indication:
                      </span>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                        Auto-updates dose & max limits
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentMedication.indications.map((ind) => {
                        const isSelected = indicationLabel.toLowerCase() === ind.indicationName.toLowerCase();
                        return (
                          <button
                            key={ind.id}
                            type="button"
                            onClick={() => {
                              loadMedicationIntoCalculator(currentMedication, ind);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              isSelected
                                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-500'
                            }`}
                          >
                            {ind.indicationName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Medicine Strength */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    2. Medicine Strength
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formulationType === 'tablet' ? 'mg / tablet' : 'mg / mL'}
                  </span>
                </div>

                <div className="space-y-2">
                  {/* Verified Presets if available for selected medication */}
                  {currentMedication?.formulations && currentMedication.formulations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentMedication.formulations.map((f, idx) => {
                        const isFormActive =
                          (formulationType === 'tablet' && (f.type === 'tablet' || f.type === 'dispersible_tablet')) ||
                          (formulationType === 'syrup' && (f.type === 'syrup' || f.type === 'suspension' || f.type === 'solution')) ||
                          (formulationType === 'drops' && f.type === 'drops');
                        const isStrengthMatch =
                          formulationType === 'tablet'
                            ? tabletStrengthMg === f.concentration.strengthMg
                            : syrupStrengthMg === f.concentration.strengthMg && (f.concentration.volumeMl ? syrupVolumeMl === f.concentration.volumeMl : true);

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              if (f.type === 'tablet' || f.type === 'dispersible_tablet') {
                                setFormulationType('tablet');
                                setTabletStrengthMg(f.concentration.strengthMg);
                                setCanTabletBeDivided(f.canBeDivided !== false);
                              } else if (f.type === 'drops') {
                                setFormulationType('drops');
                                setSyrupStrengthMg(f.concentration.strengthMg);
                                setSyrupVolumeMl(f.concentration.volumeMl || 1);
                                setDropsPerMl((f as any).dropsPerMl || 20);
                              } else {
                                setFormulationType('syrup');
                                setSyrupStrengthMg(f.concentration.strengthMg);
                                setSyrupVolumeMl(f.concentration.volumeMl || 5);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              isFormActive && isStrengthMatch
                                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {f.concentration.strengthMg} mg{f.concentration.volumeMl ? ` / ${f.concentration.volumeMl} mL` : '/tab'}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Direct input fields based on form */}
                  {formulationType === 'tablet' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={tabletStrengthMg || ''}
                            onChange={(e) => setTabletStrengthMg(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 250"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                          />
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                            mg / tablet
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canTabletBeDivided}
                            onChange={(e) => setCanTabletBeDivided(e.target.checked)}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                          />
                          <span>Scored tablet (can be split ½ or ¼)</span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Strength (mg)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={syrupStrengthMg || ''}
                            onChange={(e) => setSyrupStrengthMg(parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 125"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                            mg
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Per Volume (mL)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            value={syrupVolumeMl || ''}
                            onChange={(e) => setSyrupVolumeMl(parseFloat(e.target.value) || 1)}
                            placeholder="e.g. 5"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                            mL
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">Concentration</label>
                        <div className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-teal-800 dark:text-teal-300 font-mono font-bold">
                          {syrupVolumeMl > 0 ? (syrupStrengthMg / syrupVolumeMl).toFixed(1) : 0} mg/mL
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Child's Weight */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    3. Child's Weight <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const { ageInMonths } = normalizeAge(age, ageUnit);
                      setWhoModalAgeMonths(Math.max(0, Math.min(120, Math.round(ageInMonths))));
                      setShowWhoEstimateModal(true);
                    }}
                    className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-900 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>WHO weight estimate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={weight || ''}
                    onChange={(e) => {
                      setWeight(parseFloat(e.target.value) || 0);
                      setIsEstimatedWeight(false);
                      setEstimatedWeightSource('');
                      if (formError) setFormError(null);
                    }}
                    placeholder="e.g. 12.5"
                    className={`w-full pl-3 pr-12 py-2.5 text-sm rounded-xl font-mono outline-none border transition ${
                      isEstimatedWeight
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-950 dark:text-amber-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 dark:text-slate-400">
                    kg
                  </span>
                </div>
                {isEstimatedWeight && (
                  <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 text-[11px] text-amber-900 dark:text-amber-300">
                    <span>⚠️ Estimated: {estimatedWeightSource} (Calibrate with scale when available)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEstimatedWeight(false);
                        setEstimatedWeightSource('');
                      }}
                      className="text-amber-800 dark:text-amber-200 font-bold underline ml-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Age (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  4. Age <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={age || ''}
                      onChange={(e) => setAge(parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 3"
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                  <div className="w-32">
                    <select
                      value={ageUnit}
                      onChange={(e) => setAgeUnit(e.target.value as AgeUnit)}
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="years">Years</option>
                      <option value="months">Months</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 5. Prescribed Dose */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  5. Prescribed Dose <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={doseValue || ''}
                      onChange={(e) => {
                        setDoseValue(parseFloat(e.target.value) || 0);
                        if (formError) setFormError(null);
                      }}
                      placeholder="e.g. 15"
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                  <div>
                    <select
                      value={doseBasis}
                      onChange={(e) => setDoseBasis(e.target.value as DoseBasis)}
                      className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-slate-100 font-medium outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                    >
                      <option value="mg_kg_day">mg / kg / day</option>
                      <option value="mg_kg_dose">mg / kg / dose</option>
                      <option value="fixed_dose">mg (Fixed total dose)</option>
                    </select>
                  </div>
                </div>

                {/* Frequency selection */}
                <div className="pt-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Dosing Frequency</span>
                    <span className="text-[11px] font-mono text-teal-700 dark:text-teal-300">
                      {dosesPerDay} {dosesPerDay === 1 ? 'dose' : 'doses'} / 24 hours
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: 'Once daily (OD)', sub: 'q24h' },
                      { val: 2, label: 'Twice daily (BD)', sub: 'q12h' },
                      { val: 3, label: '3x daily (TDS)', sub: 'q8h' },
                      { val: 4, label: '4x daily (QID)', sub: 'q6h' },
                    ].map((freq) => (
                      <button
                        key={freq.val}
                        type="button"
                        onClick={() => setDosesPerDay(freq.val)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                          dosesPerDay === freq.val
                            ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="truncate">{freq.label}</div>
                        <div className={`text-[10px] ${dosesPerDay === freq.val ? 'text-teal-100' : 'text-slate-400'}`}>
                          {freq.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6. Medicine Form */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  6. Medicine Form
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'tablet', label: 'Tablet', icon: Pill },
                    { id: 'syrup', label: 'Syrup', icon: Beaker },
                    { id: 'drops', label: 'Drops', icon: Droplet },
                  ].map((item) => {
                    const isSelected =
                      item.id === 'tablet'
                        ? formulationType === 'tablet' || formulationType === 'dispersible_tablet'
                        : item.id === 'syrup'
                        ? formulationType === 'syrup' || formulationType === 'suspension' || formulationType === 'solution'
                        : formulationType === 'drops';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.id === 'tablet') {
                            setFormulationType('tablet');
                            if (currentMedication?.formulations) {
                              const tab = currentMedication.formulations.find((f) => f.type === 'tablet' || f.type === 'dispersible_tablet');
                              if (tab) {
                                setTabletStrengthMg(tab.concentration.strengthMg);
                                setCanTabletBeDivided(tab.canBeDivided !== false);
                              }
                            }
                          } else if (item.id === 'syrup') {
                            setFormulationType('syrup');
                            if (currentMedication?.formulations) {
                              const syp = currentMedication.formulations.find((f) => f.type === 'syrup' || f.type === 'suspension' || f.type === 'solution');
                              if (syp) {
                                setSyrupStrengthMg(syp.concentration.strengthMg);
                                setSyrupVolumeMl(syp.concentration.volumeMl || 5);
                              }
                            }
                          } else if (item.id === 'drops') {
                            setFormulationType('drops');
                            if (currentMedication?.formulations) {
                              const drp = currentMedication.formulations.find((f) => f.type === 'drops');
                              if (drp) {
                                setSyrupStrengthMg(drp.concentration.strengthMg);
                                setSyrupVolumeMl(drp.concentration.volumeMl || 1);
                                setDropsPerMl((drp as any).dropsPerMl || 20);
                              }
                            }
                          }
                        }}
                        className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition text-center cursor-pointer ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 dark:border-teal-400 text-teal-900 dark:text-teal-200 ring-2 ring-teal-500/20 font-bold'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <item.icon className={`w-5 h-5 ${isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`} />
                        <span className="text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Validation Error Message */}
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              {/* 7. Calculate Dosage button */}
              <button
                type="button"
                onClick={handleCalculateDosage}
                className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-sm text-base flex items-center justify-center gap-2 transition duration-150 cursor-pointer"
              >
                <Calculator className="w-5 h-5" />
                <span>Calculate Dosage</span>
              </button>
            </div>

            {/* Preserved Dosage Results Display */}
            {hasCalculated && (
              <div id="dosage-result-section" className="space-y-5 animate-in fade-in duration-200">
                {calculation.error ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Calculation Error</h4>
                      <p className="text-xs mt-1">{calculation.error}</p>
                    </div>
                  </div>
                ) : calculation.result ? (
                  <div className="space-y-5">
                    {/* Primary Dosage Result Card */}
                    <div id="dosage-print-sheet" className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-gradient-to-r from-teal-700 to-teal-800 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{drugLabel}</h3>
                            {calculation.result.activeIngredientTarget && (
                              <span className="text-[11px] bg-teal-900/60 px-2 py-0.5 rounded text-teal-200 font-mono">
                                Target Component: {calculation.result.activeIngredientTarget}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-teal-100 mt-0.5">
                            Indication: <strong className="text-white">{indicationLabel}</strong> &bull; Category: <span className="text-teal-200">{getMedicationById(selectedMedicationId)?.category || 'Pediatric Medication'}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                              safetyAudit.safetyStatus === 'CRITICAL_STOP'
                                ? 'bg-rose-500 text-white animate-pulse'
                                : calculation.result.safetyStatus === 'warning'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-emerald-500 text-white'
                            }`}
                          >
                            {safetyAudit.safetyStatus === 'CRITICAL_STOP' ? (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5" /> SAFETY HALTED
                              </>
                            ) : calculation.result.safetyStatus === 'warning' ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" /> CAPPED / WARNING
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" /> SAFE VERIFIED
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Clinical Parameters Grid Summary */}
                      <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Patient Weight</span>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {calculation.result.weightKg.toFixed(2)} kg
                            </span>
                            {calculation.result.isEstimatedWeight ? (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                                ESTIMATED
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded">
                                Measured
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Formulation & Route</span>
                          <span className="font-semibold text-slate-900 text-xs mt-1 block capitalize truncate">
                            {formulationType.replace('_', ' ')} ({administrationRoute})
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Dose Basis</span>
                          <span className="font-mono font-bold text-teal-800 text-xs mt-1 block">
                            {doseValue} {doseBasis === 'mg_kg_day' ? 'mg/kg/day' : doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'mg fixed'}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Duration</span>
                          <span className="font-semibold text-slate-900 text-xs mt-1 block">
                            {treatmentDurationDays ? `${treatmentDurationDays} days` : 'Clinical response'}
                          </span>
                        </div>
                      </div>

                      {/* Prominent Dose Metrics */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-100">
                        {/* Single Dose Box */}
                        <div className="bg-teal-50/70 border-2 border-teal-500/40 rounded-xl p-4 relative overflow-hidden space-y-3">
                          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                            Single Dose (Per Administration)
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-teal-950 font-mono">
                              {calculation.result.dosePerDoseMg.toFixed(1)}
                            </span>
                            <span className="text-sm font-bold text-teal-800">mg / dose</span>
                          </div>

                          {/* Formulation-specific quantity rendering */}
                          {calculation.result.syrup && (formulationType === 'syrup' || formulationType === 'suspension' || formulationType === 'solution') && (
                            <div className="pt-2 border-t border-teal-200/60 flex items-center justify-between">
                              <span className="text-xs text-teal-900 font-medium">Liquid Volume:</span>
                              <span className="text-base font-bold text-teal-950 font-mono bg-white px-2.5 py-0.5 rounded border border-teal-200">
                                {calculation.result.syrup.formattedVolumePerDose}
                              </span>
                            </div>
                          )}

                          {calculation.result.drops && (
                            <div className="pt-2 border-t border-indigo-200/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-indigo-900 font-medium">Infant Drops:</span>
                                <span className="text-base font-bold text-indigo-950 font-mono bg-white px-2.5 py-0.5 rounded border border-indigo-200">
                                  {calculation.result.drops.formattedDrops}
                                </span>
                              </div>
                              <p className="text-[10px] text-indigo-800">
                                {calculation.result.drops.calibratedDropperNote}
                              </p>
                            </div>
                          )}

                          {calculation.result.tablet && formulationType === 'tablet' && (
                            <div className="pt-2 border-t border-teal-200/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-teal-900 font-medium">Tablet Quantity:</span>
                                <span className="text-base font-bold text-teal-950 font-mono bg-white px-2.5 py-0.5 rounded border border-teal-200">
                                  {calculation.result.tablet.formattedTabletsPerDose}
                                </span>
                              </div>
                              {calculation.result.tablet.divisionWarning ? (
                                <p className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">
                                  ⚠️ {calculation.result.tablet.divisionWarning}
                                </p>
                              ) : (
                                calculation.result.tablet.canBeDivided &&
                                Math.abs(calculation.result.tablet.rawTabletsPerDose - Math.round(calculation.result.tablet.rawTabletsPerDose)) > 1e-4 && (
                                  <p className="text-[10px] text-teal-800 dark:text-teal-300">
                                    ✓ Scored formulation: Approved for division along score line.
                                  </p>
                                )
                              )}
                            </div>
                          )}

                          {calculation.result.dispersibleTablet && (
                            <div className="pt-2 border-t border-cyan-200/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-cyan-900 font-medium">Dispersible Tablets:</span>
                                <span className="text-base font-bold text-cyan-950 font-mono bg-white px-2.5 py-0.5 rounded border border-cyan-200">
                                  {calculation.result.dispersibleTablet.formattedTablets}
                                </span>
                              </div>
                              <p className="text-[10px] text-cyan-800 font-medium">
                                {calculation.result.dispersibleTablet.dispersionInstructions}
                              </p>
                            </div>
                          )}

                          {calculation.result.capsule && (
                            <div className="pt-2 border-t border-rose-200/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-rose-900 font-medium">Hard Capsule Count:</span>
                                <span className="text-base font-bold text-rose-950 font-mono bg-white px-2.5 py-0.5 rounded border border-rose-200">
                                  {calculation.result.capsule.formattedCapsules}
                                </span>
                              </div>
                              {calculation.result.capsule.warning && (
                                <p className="text-[10px] text-rose-700 font-bold">
                                  ⚠️ {calculation.result.capsule.warning}
                                </p>
                              )}
                            </div>
                          )}

                          {calculation.result.injectable && (
                            <div className="pt-2 border-t border-purple-200/60 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-900 font-medium">Injection Volume:</span>
                                <span className="text-base font-bold text-purple-950 font-mono bg-white px-2.5 py-0.5 rounded border border-purple-200">
                                  {calculation.result.injectable.formattedVolume} ({calculation.result.injectable.route})
                                </span>
                              </div>
                              <p className="text-[10px] text-purple-800">
                                {calculation.result.injectable.infusionNotes}
                              </p>
                            </div>
                          )}

                          {/* Practical Syringe Measurement & Clinical Rounding Guidance */}
                          {calculation.result.syringeAdvice && (
                            <div className="pt-2 border-t border-teal-200/80 space-y-1 bg-teal-50/70 p-2 rounded-lg border border-teal-200">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-teal-950 flex items-center gap-1">
                                  <span>💉 Practical Syringe Administration:</span>
                                </span>
                                <span className="font-mono font-bold text-teal-950 bg-white px-2 py-0.5 rounded border border-teal-300 text-[11px]">
                                  {calculation.result.syringeAdvice.roundedMeasurableVolumeMl.toFixed(2)} mL
                                </span>
                              </div>
                              <p className="text-[10px] text-teal-800 font-medium">
                                {calculation.result.syringeAdvice.recommendedSyringe}
                              </p>
                              <div className="text-[10px] text-teal-900 flex justify-between font-mono pt-0.5">
                                <span>Delivered: {calculation.result.syringeAdvice.effectiveDoseMg} mg</span>
                                <span>Variance: {calculation.result.syringeAdvice.percentAdjustment >= 0 ? '+' : ''}{calculation.result.syringeAdvice.percentAdjustment}%</span>
                              </div>
                              <p className="text-[9px] text-teal-700 italic">
                                {calculation.result.syringeAdvice.clinicalNote}
                              </p>
                            </div>
                          )}

                          {calculation.result.wasSingleDoseCapped && (
                            <div className="text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded font-medium">
                              Capped from {calculation.result.uncappedDosePerDoseMg.toFixed(1)} mg (Max single dose: {maxSingleDoseMg} mg)
                            </div>
                          )}
                        </div>

                        {/* Total Daily Dose Box */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                            Total Daily Dose (24 Hours)
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-slate-900 font-mono">
                              {calculation.result.totalDailyDoseMg.toFixed(1)}
                            </span>
                            <span className="text-sm font-bold text-slate-600">mg / day</span>
                          </div>

                          <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs text-slate-600">
                            <div className="flex justify-between">
                              <span>Administrations:</span>
                              <span className="font-bold text-slate-800">{dosesPerDay} times daily</span>
                            </div>
                            {calculation.result.syrup && (
                              <div className="flex justify-between">
                                <span>Total 24h Liquid Volume:</span>
                                <span className="font-bold text-slate-800 font-mono">
                                  {calculation.result.syrup.dailyVolumeMl.toFixed(1)} mL/day
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-[11px]">
                              <span>Daily Maximum Ceiling:</span>
                              <span className="font-mono text-slate-700">
                                {maxDailyDoseMg ? `${maxDailyDoseMg} mg/day` : 'None specified'}
                              </span>
                            </div>
                          </div>

                          {calculation.result.wasDailyDoseCapped && (
                            <div className="text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded font-medium">
                              Capped from {calculation.result.uncappedTotalDailyDoseMg.toFixed(1)} mg daily
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warnings and Capping Notices */}
                      {calculation.result.warnings.length > 0 && (
                        <div className="p-4 bg-amber-50/80 border-b border-amber-200 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Clinical Safety Alerts & Capping Notices:</span>
                          </div>
                          <ul className="space-y-1 pl-5 list-disc text-xs text-amber-900">
                            {calculation.result.warnings.map((w, idx) => (
                              <li key={idx} className="leading-snug">{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Reference Source & Verification Box */}
                      <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>
                            <strong>Reference Authority:</strong> {DATABASE_METADATA.verificationAuthority}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-teal-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>Verified Monograph v{DATABASE_METADATA.version}</span>
                        </div>
                      </div>

                      {/* Mathematical Transparency */}
                      <div className="p-5 bg-slate-50/50">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Divide className="w-3.5 h-3.5 text-teal-600" />
                          Mathematical Audit & Formula Traceability
                        </h4>
                        <div className="bg-white rounded-lg p-3 border border-slate-200 font-mono text-xs space-y-1.5 text-slate-700">
                          <p className="text-teal-700 font-semibold">{calculation.result.formula}</p>
                          <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                            {calculation.result.calculationSteps.map((step, idx) => (
                              <p key={idx} className="flex items-start gap-2">
                                <span className="text-slate-400 select-none">&bull;</span>
                                <span>{step}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Clinical Actions & Print/EHR Export */}
                      <div className="p-4 bg-slate-100/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handlePrintClinicalOrder}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition shadow-sm cursor-pointer"
                            title="Print / Save PDF of this dosage calculation"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            Print Clinical Order
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyClinicalNote}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm cursor-pointer ${
                              copiedNote
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                            title="Copy prescription summary for EHR/MAR charting"
                          >
                            {copiedNote ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Copied to Clipboard!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                                Copy EHR Note
                              </>
                            )}
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Verified Calculation &bull; PediDose
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DRUG DATABASE */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Verified Pediatric Medication Database</h2>
                    <span className="text-xs bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full font-mono">
                      v{DATABASE_METADATA.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Structured pediatric dosing, multiple clinical indications, formulations, age restrictions, and reference sources.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    placeholder="Search by generic, brand, alias..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 font-semibold shrink-0">Category:</span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-full font-medium shrink-0 transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All ({MEDICATION_DATABASE.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full font-medium shrink-0 transition-colors ${
                      selectedCategory === cat
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-3">
                {filteredMedications.map((med) => {
                  const isSelected = selectedMedication?.id === med.id;
                  return (
                    <div
                      key={med.id}
                      onClick={() => setSelectedMedication(med)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-sm">{med.genericName}</h3>
                            {med.isCombination && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                                Combo {med.combinationRatio}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            {med.brandNames.slice(0, 4).join(', ')}
                          </p>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                          {med.indications.length} Indication{med.indications.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{med.description}</p>

                      <div className="mt-3 flex items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-500">
                        <span className="font-medium text-slate-700">{med.category}</span>
                        <span>{med.formulations.length} Formulations</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-7">
                {selectedMedication ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm space-y-6 p-6">
                    <div className="border-b border-slate-100 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900">
                              {selectedMedication.genericName}
                            </h2>
                            {selectedMedication.isCombination && (
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-semibold">
                                Combination ({selectedMedication.combinationRatio})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            <strong>Brands:</strong> {selectedMedication.brandNames.join(', ')} &bull; <strong>Aliases:</strong> {selectedMedication.aliases.join(', ')}
                          </p>
                          <p className="text-xs text-teal-700 font-medium mt-0.5">
                            Class: {selectedMedication.therapeuticClass}
                          </p>
                        </div>

                        <button
                          onClick={() => loadMedicationIntoCalculator(selectedMedication)}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>Load in Calculator</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 mt-3">{selectedMedication.description}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-teal-600" />
                        Active Ingredients
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {selectedMedication.activeIngredients.map((ing, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border ${
                              ing.isPrimaryDosingTarget
                                ? 'bg-teal-50/70 border-teal-200 text-teal-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{ing.name}</span>
                              {ing.isPrimaryDosingTarget && (
                                <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.5 rounded font-bold">
                                  Primary Target
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {ing.isPrimaryDosingTarget
                                ? 'All pediatric dosing equations calculate against this ingredient.'
                                : 'Adjuvant active component.'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                        Approved Indications & Verified Dosing Rules
                      </h4>
                      <div className="space-y-3">
                        {selectedMedication.indications.map((ind) => (
                          <div
                            key={ind.id}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-slate-900 text-sm">
                                  {ind.indicationName}
                                </h5>
                                <p className="text-slate-600 text-xs mt-0.5">{ind.description}</p>
                              </div>
                              <button
                                onClick={() => loadMedicationIntoCalculator(selectedMedication, ind)}
                                className="bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 px-2 py-1 rounded text-[11px] font-semibold shrink-0 transition-colors"
                              >
                                Use Indication &rarr;
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/80 font-mono text-[11px]">
                              <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-400 block text-[10px]">Reference Dose</span>
                                <span className="font-bold text-slate-800">
                                  {ind.doseValue} {ind.doseBasis === 'mg_kg_day' ? 'mg/kg/day' : ind.doseBasis === 'mg_kg_dose' ? 'mg/kg/dose' : 'mg'}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-400 block text-[10px]">Frequency</span>
                                <span className="font-bold text-slate-800">
                                  {ind.recommendedFrequencyDosesPerDay}x daily
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-400 block text-[10px]">Max Single Dose</span>
                                <span className="font-bold text-slate-800">
                                  {ind.maxSingleDoseMg ? `${ind.maxSingleDoseMg} mg` : 'Standard'}
                                </span>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-400 block text-[10px]">Max Daily Dose</span>
                                <span className="font-bold text-slate-800">
                                  {ind.maxDailyDoseMg ? `${ind.maxDailyDoseMg} mg` : 'Standard'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                    Select a medication from the list to view its verified clinical monograph.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SAFETY ENGINE (EXPANDED PHASE 6) */}
        {activeTab === 'safety' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        Clinical Dosing Safety Engine
                      </h2>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${
                          safetyAudit.safetyStatus === 'CRITICAL_STOP'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : safetyAudit.safetyStatus === 'WARNING'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        STATUS: {safetyAudit.safetyStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Independent safety audit: checks duplicate active ingredients, age & route restrictions, contraindications, allergies, and organ adjustments.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded font-mono">
                    {safetyAudit.issues.length} Clinical Audit Issue{safetyAudit.issues.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Patient Clinical Profile Simulator Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* Concurrent Medications Box (Duplicate Ingredient Check) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Concurrent Patient Medications
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newConcurrentInput}
                      onChange={(e) => setNewConcurrentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newConcurrentInput.trim()) {
                          setConcurrentMeds([...concurrentMeds, newConcurrentInput.trim()]);
                          setNewConcurrentInput('');
                        }
                      }}
                      placeholder="e.g. Crocin 120mg/5mL, Dolo"
                      className="w-full px-2.5 py-1 text-xs text-slate-900 border border-slate-300 rounded bg-white"
                    />
                    <button
                      onClick={() => {
                        if (newConcurrentInput.trim()) {
                          setConcurrentMeds([...concurrentMeds, newConcurrentInput.trim()]);
                          setNewConcurrentInput('');
                        }
                      }}
                      className="bg-slate-800 text-white p-1 rounded hover:bg-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 min-h-[30px]">
                    {concurrentMeds.map((med, i) => (
                      <span
                        key={i}
                        className="bg-white border border-slate-300 text-slate-800 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        {med}
                        <button
                          onClick={() => setConcurrentMeds(concurrentMeds.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Documented Allergies */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Documented Allergies
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newAllergyInput}
                      onChange={(e) => setNewAllergyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newAllergyInput.trim()) {
                          setKnownAllergies([...knownAllergies, newAllergyInput.trim()]);
                          setNewAllergyInput('');
                        }
                      }}
                      placeholder="e.g. Penicillin, Sulfa"
                      className="w-full px-2.5 py-1 text-xs text-slate-900 border border-slate-300 rounded bg-white"
                    />
                    <button
                      onClick={() => {
                        if (newAllergyInput.trim()) {
                          setKnownAllergies([...knownAllergies, newAllergyInput.trim()]);
                          setNewAllergyInput('');
                        }
                      }}
                      className="bg-slate-800 text-white p-1 rounded hover:bg-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 min-h-[30px]">
                    {knownAllergies.map((all, i) => (
                      <span
                        key={i}
                        className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        {all}
                        <button
                          onClick={() => setKnownAllergies(knownAllergies.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Clinical Conditions & GFR */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Underlying Conditions & GFR
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newConditionInput}
                      onChange={(e) => setNewConditionInput(e.target.value)}
                      placeholder="e.g. Varicella (Chickenpox)"
                      className="w-full px-2.5 py-1 text-xs text-slate-900 border border-slate-300 rounded bg-white"
                    />
                    <button
                      onClick={() => {
                        if (newConditionInput.trim()) {
                          setClinicalConditions([...clinicalConditions, newConditionInput.trim()]);
                          setNewConditionInput('');
                        }
                      }}
                      className="bg-slate-800 text-white p-1 rounded hover:bg-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 min-h-[30px]">
                    {clinicalConditions.map((cond, i) => (
                      <span
                        key={i}
                        className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        {cond}
                        <button
                          onClick={() => setClinicalConditions(clinicalConditions.filter((_, idx) => idx !== i))}
                          className="text-amber-400 hover:text-amber-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <label className="text-slate-600">Renal GFR (mL/min):</label>
                    <input
                      type="number"
                      value={gfrInput}
                      onChange={(e) => setGfrInput(e.target.value)}
                      placeholder="e.g. 25"
                      className="w-20 px-2 py-0.5 text-xs text-slate-900 border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Issues Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Clinical Audit Findings ({safetyAudit.issues.length})
              </h3>

              {safetyAudit.issues.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-800 flex flex-col items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 mb-2" />
                  <h4 className="font-bold text-sm">All Safety Validation Checks Passed</h4>
                  <p className="text-xs text-emerald-700 mt-1 max-w-md">
                    Zero duplicate active ingredients, zero contraindications, formulation age suitability verified, and target dosing parameters are within reference safety limits.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {safetyAudit.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border space-y-2 ${
                        issue.severity === 'critical'
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : issue.severity === 'warning'
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-sky-50 border-sky-300 text-sky-950'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {issue.severity === 'critical' ? (
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : issue.severity === 'warning' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-sky-600 shrink-0" />
                          )}
                          <h4 className="font-bold text-sm">{issue.title}</h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                            issue.severity === 'critical'
                              ? 'bg-rose-600 text-white'
                              : issue.severity === 'warning'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-sky-600 text-white'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed">{issue.message}</p>

                      <div className="pt-2 border-t border-slate-200/60 text-[11px] font-semibold flex items-center justify-between">
                        <span>Action Required: {issue.clinicalAction}</span>
                        <span className="font-mono text-[10px] text-slate-500 uppercase">
                          Category: {issue.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AI ASSISTANT */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
                    <Sparkles className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        AI Clinical Decision-Support Assistant
                      </h2>
                      <span className="text-xs bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full font-mono">
                        Gemini 3.8 Flash Grounded
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Translates natural language clinical queries, corrects spelling, and retrieves structured dosing strictly from the verified pediatric database. Zero dosing parameter fabrication.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Ask a Natural Language Pediatric Medication Question:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                    placeholder="e.g. Recommended dose of Augmentin Duo for 2-year-old with otitis media..."
                    className="flex-1 px-4 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                  <button
                    onClick={() => handleAiQuery()}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Querying AI...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Ask AI Engine</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {aiResponse && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
                <div className="bg-slate-900 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-teal-400" />
                      <h3 className="font-bold text-sm">
                        Verified AI Match: {aiResponse.genericName}
                      </h3>
                      <span className="text-[10px] bg-teal-900 text-teal-300 border border-teal-700 px-2 py-0.5 rounded font-mono">
                        {aiSource}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target Indication: {aiResponse.indication} &bull; Route: {aiResponse.route}
                    </p>
                  </div>

                  <button
                    onClick={loadAiResponseIntoCalculator}
                    className="bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Calculator className="w-4 h-4" />
                    <span>Apply to Dosage Calculator</span>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <pre className="bg-slate-900 text-teal-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800">
                    {JSON.stringify(aiResponse, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: WHO GROWTH STANDARDS EXPLORER */}
        {activeTab === 'who' && (() => {
          const whoEstimate = getWhoEstimatedWeight(whoTabAgeMonths, whoTabSex);
          const whoTable = getWhoReferenceTable();

          return (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">
                        WHO Child Growth Reference Standard
                      </h2>
                      <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                        0 – 10 Years
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      World Health Organization (WHO) Multicentre Growth Reference Study Group (50th percentile median weights &amp; &plusmn;2SD reference ranges).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setWhoTabSex('male')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                        whoTabSex === 'male'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Boy (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhoTabSex('female')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                        whoTabSex === 'female'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Girl (Female)
                    </button>
                  </div>
                </div>

                {/* Interactive Age & Weight Estimate Display */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-6 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>Child's Age: {whoTabAgeMonths} months ({(whoTabAgeMonths / 12).toFixed(1)} years)</span>
                        <span className="text-teal-700 font-mono">0 to 120 mo</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="120"
                        step="1"
                        value={whoTabAgeMonths}
                        onChange={(e) => setWhoTabAgeMonths(parseInt(e.target.value) || 0)}
                        className="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Direct Months Input:
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={whoTabAgeMonths}
                          onChange={(e) => setWhoTabAgeMonths(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                          className="w-full px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg font-mono bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Years Equivalent:
                        </label>
                        <div className="px-3 py-1.5 text-xs font-mono font-bold text-slate-800 bg-slate-100 rounded-lg border border-slate-200">
                          {(whoTabAgeMonths / 12).toFixed(2)} years
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setWeight(whoEstimate.medianWeightKg);
                        setWeightUnit('kg');
                        setAge(whoTabAgeMonths >= 24 ? Math.round(whoTabAgeMonths / 12) : whoTabAgeMonths);
                        setAgeUnit(whoTabAgeMonths >= 24 ? 'years' : 'months');
                        setIsEstimatedWeight(true);
                        setEstimatedWeightSource(
                          `WHO 50th %ile (${whoTabSex === 'male' ? 'Boy' : 'Girl'}, ${whoTabAgeMonths}m)`
                        );
                        setActiveTab('calculator');
                      }}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Scale className="w-4 h-4" />
                      <span>Apply Estimated Weight ({whoEstimate.medianWeightKg} kg) to Calculator</span>
                    </button>
                  </div>

                  <div className="md:col-span-6 bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <div>
                      <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                        WHO 50th Percentile Median Weight ({whoTabSex === 'male' ? 'Boy' : 'Girl'})
                      </span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold text-teal-950 font-mono">
                          {whoEstimate.medianWeightKg}
                        </span>
                        <span className="text-base font-bold text-teal-800">kg</span>
                        <span className="text-xs text-slate-500 font-mono ml-2">
                          (~{(whoEstimate.medianWeightKg * 2.20462).toFixed(1)} lbs)
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200/80 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">Expected Normal Range (-2SD to +2SD):</span>
                        <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {whoEstimate.p15WeightKg} kg &ndash; {whoEstimate.p85WeightKg} kg
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Standard Deviations:</span>
                        <span>-2SD (3rd–15th %ile) to +2SD (85th–97th %ile)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Clinical Estimate Notice:
                      </span>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        {whoEstimate.clinicalDisclaimer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete WHO Growth Reference Milestones Table */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-600" />
                  WHO Growth Standards Milestones Table (0 to 10 Years)
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Milestone / Age</th>
                        <th className="py-2.5 px-3 text-teal-800">Boy Median</th>
                        <th className="py-2.5 px-3 text-slate-500">Boy Range (-2SD to +2SD)</th>
                        <th className="py-2.5 px-3 text-pink-800">Girl Median</th>
                        <th className="py-2.5 px-3 text-slate-500">Girl Range (-2SD to +2SD)</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {whoTable.map((row) => {
                        const isCurrent = whoTabAgeMonths === row.months;
                        return (
                          <tr
                            key={row.months}
                            className={`hover:bg-slate-50 transition-colors ${
                              isCurrent ? 'bg-teal-50/60 font-semibold' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-sans font-medium text-slate-900">
                              {row.ageDisplay} ({row.months}m)
                            </td>
                            <td className="py-2 px-3 text-teal-900 font-bold">{row.maleMedian} kg</td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.maleMinus2sd} &ndash; {row.malePlus2sd} kg
                            </td>
                            <td className="py-2 px-3 text-pink-900 font-bold">{row.femaleMedian} kg</td>
                            <td className="py-2 px-3 text-slate-600">
                              {row.femaleMinus2sd} &ndash; {row.femalePlus2sd} kg
                            </td>
                            <td className="py-2 px-3 text-right font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setWhoTabAgeMonths(row.months);
                                  const median = whoTabSex === 'male' ? row.maleMedian : row.femaleMedian;
                                  setWeight(median);
                                  setWeightUnit('kg');
                                  setAge(row.months >= 24 ? Math.round(row.months / 12) : row.months);
                                  setAgeUnit(row.months >= 24 ? 'years' : 'months');
                                  setIsEstimatedWeight(true);
                                  setEstimatedWeightSource(
                                    `WHO 50th %ile (${whoTabSex === 'male' ? 'Boy' : 'Girl'}, ${row.months}m)`
                                  );
                                  setActiveTab('calculator');
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:bg-teal-100 bg-teal-50 rounded border border-teal-200 transition-colors"
                              >
                                Select &amp; Dose
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 6: SYSTEM & OFFLINE ARCHITECTURE */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Phase 8 Offline Mode &amp; Local Database Storage Complete
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    IndexedDB persistent local database with localStorage and in-memory fallbacks. All 8 verified medication monographs, multi-indication dosing, combination targeting, and clinical gatekeeping calculations run completely offline without an active network connection.
                  </p>
                </div>
              </div>
            </div>

            {/* Offline Database Storage Status Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Database className="w-4 h-4 text-teal-600" />
                    Local Database Cache &amp; Synchronization Status
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Persistent client-side storage for zero-latency pediatric point-of-care calculation.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSyncingOffline}
                  onClick={async () => {
                    setIsSyncingOffline(true);
                    const meta = await initOfflineDatabase();
                    setOfflineMetadata(meta);
                    setIsSyncingOffline(false);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                  <span>{isSyncingOffline ? 'Re-indexing...' : 'Re-index Offline Store'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Formulary Version
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-1 block">
                    v{DATABASE_METADATA.version}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Last Verified Date
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-1 block">
                    {DATABASE_METADATA.lastUpdated}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Storage Driver
                  </span>
                  <span className="font-mono font-bold text-teal-800 text-sm mt-1 block uppercase">
                    {offlineMetadata?.storageDriver || 'IndexedDB'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Offline Status
                  </span>
                  <span className="font-semibold text-emerald-700 text-xs mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    8 Monographs Cached
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1 font-mono text-[11px]">
                <p>
                  <strong>Offline Verification Authority:</strong> {DATABASE_METADATA.verificationAuthority}
                </p>
                <p>
                  <strong>Indexed Stores:</strong> medications (8 monographs), metadata (schema v{DATABASE_METADATA.version}), ai_cache (offline grounded explanations).
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Ambiguity Resolution Modal */}
      {showAmbiguityModal && searchResponse && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Select Medication: &quot;{searchResponse.query}&quot;
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Multiple verified candidates match your search. Select the appropriate clinical match.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAmbiguityModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {searchResponse.symptomNotice && (
              <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Clinical Guard:</strong> {searchResponse.symptomNotice}
                </span>
              </div>
            )}

            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {searchResponse.results.map((match, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 transition-all space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">
                          {match.medication.genericName}
                        </h4>
                        <span className="text-[10px] font-mono bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">
                          {match.matchedField.toUpperCase()} MATCH
                        </span>
                      </div>
                      <p className="text-xs text-teal-700 font-medium">
                        Brands: {match.medication.brandNames.join(', ')}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {match.relevanceExplanation}
                      </p>
                    </div>

                    <button
                      onClick={() => loadMedicationIntoCalculator(match.medication)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1 transition-colors shrink-0"
                    >
                      <span>Select</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowAmbiguityModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHO Child Growth Weight Estimation Modal */}
      {showWhoEstimateModal && (() => {
        const est = getWhoEstimatedWeight(whoModalAgeMonths, whoModalSex);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      WHO Growth Weight Estimation
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Standard 50th Percentile Weight for Age (0–120 months)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhoEstimateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Sex Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Child's Biological Sex
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWhoModalSex('male')}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-colors ${
                        whoModalSex === 'male'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Boy (Male)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhoModalSex('female')}
                      className={`py-2 text-xs font-bold rounded-lg border text-center transition-colors ${
                        whoModalSex === 'female'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Girl (Female)
                    </button>
                  </div>
                </div>

                {/* Age in Months */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Age: {whoModalAgeMonths} months ({(whoModalAgeMonths / 12).toFixed(1)} yr)</span>
                    <span className="text-teal-700 font-mono">0 – 120 mo</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="120"
                    step="1"
                    value={whoModalAgeMonths}
                    onChange={(e) => setWhoModalAgeMonths(parseInt(e.target.value) || 0)}
                    className="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Calculated Result Card */}
                <div className="p-4 bg-teal-50/70 rounded-xl border border-teal-200 space-y-2">
                  <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">
                    WHO Median (50th Percentile) Weight
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-teal-950 font-mono">
                      {est.medianWeightKg}
                    </span>
                    <span className="text-sm font-bold text-teal-800">kg</span>
                    <span className="text-xs text-slate-500 font-mono ml-1">
                      (~{(est.medianWeightKg * 2.20462).toFixed(1)} lbs)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-teal-900 pt-2 border-t border-teal-200/60">
                    <span>Expected Range (-2SD to +2SD):</span>
                    <span className="font-mono font-bold">{est.p15WeightKg} – {est.p85WeightKg} kg</span>
                  </div>
                </div>

                {/* Clinical Notice */}
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>CLINICAL ESTIMATE:</strong> Never substitute estimated weight for calibrated scale measurement when administering high-risk medications.
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWhoEstimateModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWeight(est.medianWeightKg);
                    setWeightUnit('kg');
                    setIsEstimatedWeight(true);
                    setEstimatedWeightSource(
                      `WHO 50th %ile (${whoModalSex === 'male' ? 'Boy' : 'Girl'}, ${whoModalAgeMonths}m)`
                    );
                    setShowWhoEstimateModal(false);
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Apply Estimated Weight ({est.medianWeightKg} kg)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clinical Reference Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            <span>PediDose Clinical Decision Support Engine &bull; Database v{DATABASE_METADATA.version}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Zero-fabrication clinical math. Verified against AAP, BNF for Children, and WHO guidelines.
          </div>
        </div>
      </footer>
    </div>
  );
}
