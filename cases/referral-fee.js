window.REFERRAL_FEE_CONFIG = {
  version: 1,
  enabled: true,
  basis: "finalContractAmountExTax",
  rate: 0.05,
  minimumFee: 20000,
  maximumFee: 120000
};

window.calculateReferralFee = function calculateReferralFee(finalContractAmountExTax, config = window.REFERRAL_FEE_CONFIG, contractStatus = "contracted") {
  const configured = config?.enabled === true
    && Number.isFinite(config.rate)
    && Number.isFinite(config.minimumFee)
    && Number.isFinite(config.maximumFee);
  if (!configured) return null;
  if (contractStatus !== "contracted" || !Number.isFinite(finalContractAmountExTax) || finalContractAmountExTax <= 0) return 0;
  const rawFee = finalContractAmountExTax * config.rate;
  const feeInWholeYen = Math.round(rawFee);
  return Math.max(config.minimumFee, Math.min(feeInWholeYen, config.maximumFee));
};
