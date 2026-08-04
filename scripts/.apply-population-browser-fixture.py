from pathlib import Path

path = Path('tests/browser/admin-runtime.spec.ts')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "        populationEconomy: {\n          credits:",
        "        populationEconomy: {\n          demographics: {\n            currentPopulation: 10_000, targetPopulation: 10_152, structuralCapacity: 14_026, activeCapacity: 5_170, activeCapacityEma: 5_170,\n            occupancyRateBps: 7_026, industryOperatingRateBps: 3_969, incomeHealthBps: 10_000, demandSatisfactionBps: 4_384,\n            lastMigration: 4, lastMigrationDirection: 'in', lastClassConversions: 2, lastPopulationCycleId: 100, referenceBudget: 5_786.64,\n            targetByModel: { basic: 6_165, skilled: 2_845, professional: 1_142 },\n            structuralCapacityByComplexity: {\n              C1: { count: 332, participatingCount: 90, structuralCapacity: 3_652, activeCapacity: 995 },\n              C2: { count: 223, participatingCount: 122, structuralCapacity: 3_680, activeCapacity: 2_013 },\n              C3: { count: 79, participatingCount: 36, structuralCapacity: 1_912, activeCapacity: 871 },\n              C4: { count: 48, participatingCount: 18, structuralCapacity: 1_690, activeCapacity: 634 },\n              C5: { count: 11, participatingCount: 4, structuralCapacity: 545, activeCapacity: 198 },\n              C6: { count: 9, participatingCount: 4, structuralCapacity: 614, activeCapacity: 273 },\n              C7: { count: 10, participatingCount: 2, structuralCapacity: 935, activeCapacity: 187 },\n            },\n          },\n          credits:",
    ),
    (
        "basic: { id: 'basic', name: '基础人口', consumptionState:",
        "basic: { id: 'basic', name: '基础人口', population: 6_000, targetPopulation: 6_165, laborForce: 3_300, employed: 3_200, unemployed: 100, vacancies: 0, perCapitaIncomeEma: 0.018333, recentPeakPerCapitaIncome: 0.018667, consumptionState:",
    ),
    (
        "skilled: { id: 'skilled', name: '技术人口', consumptionState:",
        "skilled: { id: 'skilled', name: '技术人口', population: 3_000, targetPopulation: 2_845, laborForce: 1_650, employed: 1_500, unemployed: 150, vacancies: 0, perCapitaIncomeEma: 0.023333, recentPeakPerCapitaIncome: 0.026, consumptionState:",
    ),
    (
        "professional: { id: 'professional', name: '专业人口', consumptionState:",
        "professional: { id: 'professional', name: '专业人口', population: 1_000, targetPopulation: 1_142, laborForce: 550, employed: 470, unemployed: 80, vacancies: 20, perCapitaIncomeEma: 0.02, recentPeakPerCapitaIncome: 0.04, consumptionState:",
    ),
    (
        "pendingIncome: { production: 100, construction: 50, warehouse: 20, marketService: 10 }",
        "pendingIncome: { production: 100, construction: 50, warehouse: 20, marketService: 10, banking: 0, research: 0 }",
    ),
    (
        "pendingIncome: { production: 60, construction: 20, warehouse: 10, marketService: 10 }",
        "pendingIncome: { production: 60, construction: 20, warehouse: 10, marketService: 10, banking: 0, research: 0 }",
    ),
    (
        "pendingIncome: { production: 10, construction: 5, warehouse: 3, marketService: 2 }",
        "pendingIncome: { production: 10, construction: 5, warehouse: 3, marketService: 2, banking: 0, research: 0 }",
    ),
    (
        "sources: { production: 10_000, construction: 2_000, warehouse: 0, marketService: 1 }",
        "sources: { production: 10_000, construction: 2_000, warehouse: 0, marketService: 1, banking: 0, research: 0 }",
    ),
    ("'稳定需求比例／目标钱包'", "'最低消费保障率／目标钱包'"),
    ("'稳定需求比例（%）'", "'最低消费保障率（%）'"),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'POPULATION_BROWSER_FIX_MISMATCH count={count} text={old[:80]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Population browser fixture upgraded.')
