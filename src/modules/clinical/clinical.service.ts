import type { PcosRotterdamDto, MenopauseScoringDto, BishopScoreDto, BreastCancerRiskDto } from './clinical.schema'

export class ClinicalService {

  assessPcosRotterdam(criteria: PcosRotterdamDto) {
    const criterion1 = criteria.oligo_anovulation
    const criterion2 = criteria.clinical_hyperandrogenism || criteria.biochemical_hyperandrogenism
    const criterion3 = criteria.polycystic_ovaries_us

    const criteriaMet = [criterion1, criterion2, criterion3].filter(Boolean).length

    let phenotype: string | null = null
    if (criteriaMet >= 2) {
      if (criterion1 && criterion2 && criterion3) phenotype = 'A (Full-blown PCOS)'
      else if (criterion1 && criterion2) phenotype = 'B (Non-PCO PCOS)'
      else if (criterion2 && criterion3) phenotype = 'C (Ovulatory PCOS)'
      else if (criterion1 && criterion3) phenotype = 'D (Non-hyperandrogenic PCOS)'
    }

    const exclusionsChecked = criteria.excluded_cah || criteria.excluded_cushing || criteria.excluded_tumor

    return {
      diagnosis: criteriaMet >= 2 ? 'PCOS detected' : 'PCOS not detected',
      criteria_met: criteriaMet,
      criteria_required: 2,
      details: {
        criterion_1_oligo_anovulation: {
          present: criterion1,
          label: 'Oligo-ovulation / Anovulation',
          description: 'Menstrual irregularity (cycles >35 days or <21 days, or amenorrhea)',
          met: criterion1,
        },
        criterion_2_hyperandrogenism: {
          present: criterion2,
          label: 'Clinical and/or Biochemical Hyperandrogenism',
          description: 'Clinical signs (hirsutism, acne, alopecia) or elevated androgens (testosterone, DHEAS, FAI)',
          clinical: criteria.clinical_hyperandrogenism,
          biochemical: criteria.biochemical_hyperandrogenism,
          details: {
            hirsutism: criteria.hirsutism,
            acne: criteria.acne,
            alopecia: criteria.alopecia,
            acanthosis_nigricans: criteria.acanthosis_nigricans,
            testosterone_elevated: criteria.testosterone_elevated,
            dheas_elevated: criteria.dheas_elevated,
            free_androgen_index_elevated: criteria.free_androgen_index_elevated,
          },
          met: criterion2,
        },
        criterion_3_polycystic_ovaries: {
          present: criterion3,
          label: 'Polycystic Ovaries on Ultrasound',
          description: '≥12 follicles 2-9mm per ovary and/or ovarian volume ≥10ml',
          follicle_count: criteria.follicle_count_per_ovary,
          ovarian_volume_ml: criteria.ovarian_volume_ml,
          met: criterion3,
        },
      },
      exclusions: {
        cah_excluded: criteria.excluded_cah,
        cushing_excluded: criteria.excluded_cushing,
        tumor_excluded: criteria.excluded_tumor,
        all_checked: !!exclusionsChecked,
      },
      additional_context: {
        age: criteria.age,
        bmi: criteria.bmi,
        cycle_length_days: criteria.cycle_length_days,
      },
      phenotype,
      recommendation: criteriaMet >= 2
        ? `Meets Rotterdam diagnostic criteria for PCOS (Phenotype ${phenotype || 'unclassified'}). Consider: metabolic screening (OGTT, lipid panel), endocrine workup, and management based on patient goals (fertility, symptom management, long-term health).`
        : 'Does not meet Rotterdam criteria. Consider alternative diagnoses (hypothalamic amenorrhea, thyroid dysfunction, hyperprolactinemia, premature ovarian insufficiency).',
    }
  }

  calculateMenopauseScore(scores: MenopauseScoringDto) {
    const items = [
      { name: 'Hot flushes', value: scores.hot_flushes },
      { name: 'Night sweats', value: scores.night_sweats },
      { name: 'Sleep disturbance', value: scores.sleep_disturbance },
      { name: 'Mood swings', value: scores.mood_swings },
      { name: 'Vaginal dryness', value: scores.vaginal_dryness },
      { name: 'Reduced libido', value: scores.reduced_libido },
      { name: 'Joint pain', value: scores.joint_pain },
      { name: 'Fatigue', value: scores.fatigue },
      { name: 'Urinary frequency', value: scores.urinary_frequency },
      { name: 'Anxiety', value: scores.anxiety },
    ]

    const total = items.reduce((sum, item) => sum + item.value, 0)
    const maxScore = items.length * 4

    let severity: string
    if (total <= 10) severity = 'Mild'
    else if (total <= 20) severity = 'Moderate'
    else severity = 'Severe'

    return {
      items,
      total_score: total,
      max_score: maxScore,
      severity,
      recommendation: severity === 'Severe'
        ? 'Consider HRT consultation and symptom management.'
        : severity === 'Moderate'
        ? 'Monitor symptoms; consider lifestyle modifications and non-hormonal therapies.'
        : 'Symptoms are mild. Continue routine monitoring.',
    }
  }

  calculateBishopScore(params: BishopScoreDto) {
    let dilationScore: number
    if (params.cervical_dilation_cm === 0) dilationScore = 0
    else if (params.cervical_dilation_cm <= 2) dilationScore = 1
    else if (params.cervical_dilation_cm <= 4) dilationScore = 2
    else dilationScore = 3

    let effacementScore: number
    if (params.cervical_effacement_percent <= 30) effacementScore = 0
    else if (params.cervical_effacement_percent <= 50) effacementScore = 1
    else if (params.cervical_effacement_percent <= 80) effacementScore = 2
    else effacementScore = 3

    const consistencyScore = params.cervical_consistency === 'firm' ? 0
      : params.cervical_consistency === 'medium' ? 1 : 2

    const positionScore = params.cervical_position === 'posterior' ? 0
      : params.cervical_position === 'mid' ? 1 : 2

    let stationScore: number
    if (params.fetal_station <= -3) stationScore = 0
    else if (params.fetal_station <= -1) stationScore = 1
    else if (params.fetal_station <= 0) stationScore = 2
    else stationScore = 3

    const total = dilationScore + effacementScore + consistencyScore + positionScore + stationScore

    return {
      components: {
        dilation: { value: params.cervical_dilation_cm, score: dilationScore },
        effacement: { value: params.cervical_effacement_percent, score: effacementScore },
        consistency: { value: params.cervical_consistency, score: consistencyScore },
        position: { value: params.cervical_position, score: positionScore },
        station: { value: params.fetal_station, score: stationScore },
      },
      total_score: total,
      interpretation: total >= 8 ? 'Favorable for induction' : total >= 5 ? 'Moderately favorable' : 'Unfavorable',
      recommendation: total >= 8
        ? 'Cervix is favorable for labor induction.'
        : total >= 5
        ? 'Consider cervical ripening agents if induction planned.'
        : 'Cervix is unfavorable. Cervical ripening recommended before induction.',
    }
  }

  assessBreastCancerRisk(params: BreastCancerRiskDto) {
    const riskFactors: string[] = []
    let riskPoints = 0

    if (params.age > 50) { riskFactors.push('Age > 50'); riskPoints++ }
    if (params.age_at_menarche < 12) { riskFactors.push('Early menarche (< 12)'); riskPoints++ }
    if (params.age_at_first_live_birth && params.age_at_first_live_birth > 30) { riskFactors.push('First live birth after 30'); riskPoints++ }
    if (params.family_history_breast_cancer) { riskFactors.push('Family history of breast cancer'); riskPoints += 2 }
    if (params.family_history_ovarian_cancer) { riskFactors.push('Family history of ovarian cancer'); riskPoints += 2 }
    if (params.previous_breast_biopsy) { riskFactors.push('Previous breast biopsy'); riskPoints++ }
    if (params.atypical_hyperplasia) { riskFactors.push('Atypical hyperplasia'); riskPoints += 2 }
    if (params.brca_mutation) { riskFactors.push('BRCA mutation'); riskPoints += 3 }
    if (params.bmi && params.bmi > 30) { riskFactors.push('BMI > 30'); riskPoints++ }
    if (params.alcohol_use) { riskFactors.push('Alcohol use'); riskPoints++ }
    if (params.hormone_therapy) { riskFactors.push('Hormone therapy use'); riskPoints++ }

    let riskCategory: string
    if (riskPoints >= 6) riskCategory = 'High'
    else if (riskPoints >= 3) riskCategory = 'Moderate'
    else riskCategory = 'Average'

    return {
      total_risk_factors: riskFactors.length,
      risk_factors: riskFactors,
      risk_points: riskPoints,
      risk_category: riskCategory,
      recommendation: riskCategory === 'High'
        ? 'Consider genetic counseling, early mammography screening, and chemoprevention discussion.'
        : riskCategory === 'Moderate'
        ? 'Annual mammography from age 40. Consider risk-reducing lifestyle modifications.'
        : 'Follow age-appropriate standard screening guidelines.',
    }
  }
}