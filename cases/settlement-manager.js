window.SETTLEMENT_CONFIG = {
  paymentDueDays: 7,
  invoicePrefix: "REF",
  prefectureCode: "KGW",
  tax: { enabled: false, rate: null },
  bankTransfer: { configured: false }
};

window.initializeSettlement = function initializeSettlement(caseItem) {
  return Object.assign(caseItem, {
    settlementStatus: "none",
    estimatedReferralFee: null,
    confirmedReferralFee: null,
    confirmedContractAmount: null,
    confirmedAt: null,
    adjustmentReason: null,
    invoiceNumber: null,
    invoicedAt: null,
    paymentDueDate: null,
    paidAt: null,
    paidAmount: null,
    cancellationReason: null,
    cancelledAt: null,
    settlementNotes: "",
    ...caseItem
  });
};

window.submitContractSettlement = function submitContractSettlement(caseItem, report, feeConfig = window.REFERRAL_FEE_CONFIG, now = new Date()) {
  if (report.contractStatus !== "contracted") {
    Object.assign(caseItem, report, { settlementStatus: "none", estimatedReferralFee: 0 });
    return { ok: true, event: "settlementNotRequired" };
  }
  const amount = Number(report.finalContractAmount);
  if (!(amount > 0)) return { ok: false, reason: "invalid_contract_amount" };
  const estimatedReferralFee = window.calculateReferralFee(amount, feeConfig, "contracted");
  Object.assign(caseItem, report, {
    status: "contracted",
    settlementStatus: "awaiting_review",
    estimatedReferralFee,
    reportSubmittedAt: report.reportSubmittedAt || new Date(now).toISOString()
  });
  return { ok: true, event: "settlementAwaitingReview", estimatedReferralFee };
};

window.confirmSettlement = function confirmSettlement(caseItem, options = {}, now = new Date()) {
  if (caseItem.settlementStatus !== "awaiting_review") return { ok: false, reason: "not_awaiting_review" };
  const confirmedContractAmount = Number(options.confirmedContractAmount ?? caseItem.finalContractAmount);
  const automaticFee = window.calculateReferralFee(confirmedContractAmount, window.REFERRAL_FEE_CONFIG, "contracted");
  const manualFee = options.confirmedReferralFee == null || options.confirmedReferralFee === "" ? null : Number(options.confirmedReferralFee);
  if (manualFee != null && manualFee !== automaticFee && !String(options.adjustmentReason || "").trim()) return { ok: false, reason: "adjustment_reason_required" };
  const confirmedReferralFee = manualFee == null ? automaticFee : manualFee;
  Object.assign(caseItem, {
    confirmedContractAmount,
    confirmedReferralFee,
    confirmedAt: new Date(now).toISOString(),
    adjustmentReason: manualFee !== null && manualFee !== automaticFee ? String(options.adjustmentReason).trim() : null,
    settlementNotes: String(options.settlementNotes || "").trim(),
    settlementStatus: "confirmed"
  });
  return { ok: true, event: "settlementConfirmed", automaticFee, confirmedReferralFee };
};

window.createInvoiceNumber = function createInvoiceNumber(now = new Date(), sequence = 1, config = window.SETTLEMENT_CONFIG) {
  const month = new Date(now).toISOString().slice(0, 7).replace("-", "");
  return `${config.invoicePrefix}-${config.prefectureCode}-${month}-${String(sequence).padStart(3, "0")}`;
};

window.issueSettlementInvoice = function issueSettlementInvoice(caseItem, options = {}, now = new Date(), config = window.SETTLEMENT_CONFIG) {
  if (caseItem.settlementStatus !== "confirmed") return { ok: false, reason: "not_confirmed" };
  const invoicedAt = new Date(now);
  const dueDate = options.paymentDueDate ? new Date(options.paymentDueDate) : new Date(invoicedAt.getTime() + config.paymentDueDays * 86400000);
  Object.assign(caseItem, {
    invoiceNumber: options.invoiceNumber || window.createInvoiceNumber(invoicedAt, options.sequence || 1, config),
    invoicedAt: invoicedAt.toISOString(),
    paymentDueDate: dueDate.toISOString(),
    settlementStatus: "invoiced"
  });
  return { ok: true, event: "settlementInvoiced", invoiceNumber: caseItem.invoiceNumber };
};

window.confirmSettlementPayment = function confirmSettlementPayment(caseItem, paidAmount, now = new Date()) {
  if (!["invoiced", "overdue"].includes(caseItem.settlementStatus)) return { ok: false, reason: "not_payable" };
  if (!(Number(paidAmount) >= 0)) return { ok: false, reason: "invalid_paid_amount" };
  Object.assign(caseItem, { paidAt: new Date(now).toISOString(), paidAmount: Number(paidAmount), settlementStatus: "paid" });
  return { ok: true, event: "settlementPaid", difference: Number(paidAmount) - caseItem.confirmedReferralFee };
};

window.markSettlementOverdueIfNeeded = function markSettlementOverdueIfNeeded(caseItem, now = new Date()) {
  if (caseItem.settlementStatus !== "invoiced" || !caseItem.paymentDueDate || new Date(now) <= new Date(caseItem.paymentDueDate)) return { ok: false, reason: "not_overdue" };
  caseItem.settlementStatus = "overdue";
  return { ok: true, event: "settlementOverdue" };
};

window.cancelSettlement = function cancelSettlement(caseItem, reason, now = new Date()) {
  if (!String(reason || "").trim()) return { ok: false, reason: "cancellation_reason_required" };
  if (caseItem.settlementStatus === "paid") return { ok: false, reason: "paid_refund_not_supported" };
  Object.assign(caseItem, { settlementStatus: "cancelled", cancellationReason: String(reason).trim(), cancelledAt: new Date(now).toISOString() });
  return { ok: true, event: "settlementCancelled" };
};

window.createInvoiceData = function createInvoiceData(caseItem, operator = {}) {
  return {
    invoiceNumber: caseItem.invoiceNumber,
    issueDate: caseItem.invoicedAt,
    dueDate: caseItem.paymentDueDate,
    contractorName: caseItem.assignedContractorName,
    caseId: caseItem.caseId,
    contractAmountExTax: caseItem.confirmedContractAmount,
    referralFee: caseItem.confirmedReferralFee,
    taxAmount: null,
    totalAmount: null,
    operatorName: operator.name || null,
    operatorAddress: operator.address || null
  };
};
