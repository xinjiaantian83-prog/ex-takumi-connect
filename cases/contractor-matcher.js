window.CONTRACTOR_MATCHING_CONFIG = {
  excludeFullCapacity: true,
  weights: {
    categoryMatch: 100,
    noRecentReferrals: 12,
    recentReferralPenalty: 8,
    activeCasePenalty: 5,
    limitedCapacityPenalty: 15,
    slowResponsePenalty: 10
  }
};

window.extractContractorCandidates = function extractContractorCandidates(caseItem, contractors, config = window.CONTRACTOR_MATCHING_CONFIG) {
  const requested = caseItem.matchingCategories?.length ? caseItem.matchingCategories : caseItem.initialRequestCategories || [];
  const declined = new Set([...(caseItem.declinedContractorIds || []), ...(caseItem.offerHistory || []).filter(entry => ["declined", "expired"].includes(entry.result)).map(entry => entry.contractorId)]);
  const normalizeArea = value => String(value || "").replace(/(周辺|西部|東部|北部|南部)/g, "").trim();
  const caseArea = normalizeArea(caseItem.area);

  return contractors.flatMap(contractor => {
    if (!contractor.isActive || !contractor.acceptingCases) return [];
    if (contractor.responseStatus === "paused") return [];
    if (config.excludeFullCapacity && contractor.currentCapacity === "full") return [];
    if (declined.has(contractor.contractorId)) return [];
    const matchingArea = contractor.area.find(area => caseArea.includes(normalizeArea(area)) || normalizeArea(area).includes(caseArea));
    if (!matchingArea) return [];
    const matchedCategories = requested.filter(category => contractor.workCategories.includes(category));
    if (!matchedCategories.length) return [];
    const w = config.weights;
    const coverage = requested.length ? matchedCategories.length / requested.length : 0;
    const internalOrderValue = coverage * w.categoryMatch
      + (contractor.recentReferralCount === 0 ? w.noRecentReferrals : 0)
      - contractor.recentReferralCount * w.recentReferralPenalty
      - contractor.activeCaseCount * w.activeCasePenalty
      - (contractor.currentCapacity === "limited" ? w.limitedCapacityPenalty : 0)
      - (contractor.responseStatus === "slow" ? w.slowResponsePenalty : 0);
    return [{
      contractor,
      matchedCategories,
      requestedCategoryCount: requested.length,
      matchingArea,
      internalOrderValue,
      reasons: [
        `${matchingArea}対応`,
        `${requested.length}工種中${matchedCategories.length}工種対応`,
        contractor.currentCapacity === "available" ? "現在受付可能" : "受付枠は要確認",
        `直近紹介${contractor.recentReferralCount}件`
      ]
    }];
  }).sort((a, b) => b.internalOrderValue - a.internalOrderValue || a.contractor.businessName.localeCompare(b.contractor.businessName, "ja"));
};
