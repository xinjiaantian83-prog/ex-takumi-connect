window.OFFER_CONFIG = { defaultResponseHours: 24, availableResponseHours: [6, 12, 24, 48] };

window.createCaseOffer = function createCaseOffer(caseItem, contractor, responseHours = window.OFFER_CONFIG.defaultResponseHours, now = new Date()) {
  if (caseItem.offerStatus === "pending") return { ok: false, reason: "offer_pending" };
  if (caseItem.offerStatus === "accepted") return { ok: false, reason: "offer_already_accepted" };
  if (!window.OFFER_CONFIG.availableResponseHours.includes(Number(responseHours))) return { ok: false, reason: "invalid_deadline" };
  const offeredAt = new Date(now);
  const responseDeadline = new Date(offeredAt.getTime() + Number(responseHours) * 3600000);
  const historyEntry = { contractorId: contractor.contractorId, contractorName: contractor.businessName, offeredAt: offeredAt.toISOString(), responseDeadline: responseDeadline.toISOString(), result: "pending", respondedAt: null, declineReason: null };
  Object.assign(caseItem, { offeredContractorId: contractor.contractorId, offeredContractorName: contractor.businessName, offeredAt: historyEntry.offeredAt, responseDeadline: historyEntry.responseDeadline, offerStatus: "pending", status: "awaiting_response" });
  caseItem.offerHistory.push(historyEntry);
  return { ok: true, event: "offerCreated", historyEntry };
};

window.acceptCaseOffer = function acceptCaseOffer(caseItem, now = new Date()) {
  if (caseItem.offerStatus !== "pending") return { ok: false, reason: "no_pending_offer" };
  const respondedAt = new Date(now).toISOString();
  const historyEntry = caseItem.offerHistory.at(-1);
  Object.assign(historyEntry, { result: "accepted", respondedAt });
  Object.assign(caseItem, { offerStatus: "accepted", assignedContractorId: caseItem.offeredContractorId, assignedContractorName: caseItem.offeredContractorName, status: "introduced", lastStatusUpdatedAt: respondedAt });
  return { ok: true, event: "offerAccepted", historyEntry };
};

window.declineCaseOffer = function declineCaseOffer(caseItem, declineReason = null, now = new Date()) {
  if (caseItem.offerStatus !== "pending") return { ok: false, reason: "no_pending_offer" };
  const respondedAt = new Date(now).toISOString();
  const historyEntry = caseItem.offerHistory.at(-1);
  Object.assign(historyEntry, { result: "declined", respondedAt, declineReason: declineReason || null });
  if (!caseItem.declinedContractorIds.includes(caseItem.offeredContractorId)) caseItem.declinedContractorIds.push(caseItem.offeredContractorId);
  Object.assign(caseItem, { offerStatus: "declined", status: "selecting", assignedContractorId: null, assignedContractorName: null, lastStatusUpdatedAt: respondedAt });
  return { ok: true, event: "offerDeclined", historyEntry };
};

window.expireCaseOfferIfNeeded = function expireCaseOfferIfNeeded(caseItem, now = new Date()) {
  if (caseItem.offerStatus !== "pending" || new Date(now) <= new Date(caseItem.responseDeadline)) return { ok: false, reason: "not_expired" };
  const respondedAt = new Date(now).toISOString();
  const historyEntry = caseItem.offerHistory.at(-1);
  Object.assign(historyEntry, { result: "expired", respondedAt });
  Object.assign(caseItem, { offerStatus: "expired", status: "selecting", assignedContractorId: null, assignedContractorName: null, lastStatusUpdatedAt: respondedAt });
  return { ok: true, event: "offerExpired", historyEntry };
};

window.cancelCaseOffer = function cancelCaseOffer(caseItem, now = new Date()) {
  if (caseItem.offerStatus !== "pending") return { ok: false, reason: "no_pending_offer" };
  const respondedAt = new Date(now).toISOString();
  const historyEntry = caseItem.offerHistory.at(-1);
  Object.assign(historyEntry, { result: "cancelled", respondedAt });
  Object.assign(caseItem, { offerStatus: "none", status: "selecting", offeredContractorId: null, offeredContractorName: null, offeredAt: null, responseDeadline: null, lastStatusUpdatedAt: respondedAt });
  return { ok: true, event: "offerCancelled", historyEntry };
};
