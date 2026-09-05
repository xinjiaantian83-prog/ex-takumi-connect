window.ESTIMATE_CONFIG = {
  version: 1,
  workTypes: {
    carport: {
      label: "カーポート",
      variants: {
        single: { label: "1台用", baseLaborCost: 50000 },
        double: { label: "2台用", baseLaborCost: 80000 },
        triple: { label: "3台用", baseLaborCost: 120000 }
      },
      addOns: {
        removal: { label: "既存カーポート撤去", defaultCost: 20000 },
        chipping: { label: "土間コンクリートハツリ", defaultCost: 15000 },
        carrying: { label: "手運搬あり", defaultCost: 10000 },
        difficultColumns: { label: "柱位置難あり", defaultCost: 10000 },
        specialWork: { label: "高所・特殊作業あり", defaultCost: 15000 }
      },
      regions: {
        standard: { label: "標準地域", surcharge: 0 },
        remote: { label: "遠方", surcharge: 10000 },
        special: { label: "特殊地域", surcharge: 20000 }
      }
    }
  },
  pricing: {
    minimumGrossProfit: 60000,
    defaultDesiredGrossProfit: 100000,
    profitFocusedMarkup: 30000
  }
};
