const config = window.ESTIMATE_CONFIG;
const carport = config.workTypes.carport;
const yenNumber = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

const byId = (id) => document.getElementById(id);
const parseMoney = (value) => Math.max(0, Number(String(value).replace(/[^0-9]/g, "")) || 0);
const numberValue = (element) => parseMoney(element.value);
const formatMoney = (value) => `¥${yenNumber.format(Math.round(value))}`;
const setMoneyInput = (element, value) => {
  element.value = yenNumber.format(Math.max(0, Math.round(value)));
};

function formatMoneyInput(element) {
  const digitsBeforeCaret = element.value.slice(0, element.selectionStart ?? element.value.length).replace(/[^0-9]/g, "").length;
  element.value = yenNumber.format(parseMoney(element.value));
  if (document.activeElement !== element) return;
  let position = 0;
  let digits = 0;
  while (position < element.value.length && digits < digitsBeforeCaret) {
    if (/\d/.test(element.value[position])) digits += 1;
    position += 1;
  }
  element.setSelectionRange(position, position);
}

let quoteWasEdited = false;

function buildChoices() {
  const typeOptions = byId("carport-type-options");
  Object.entries(carport.variants).forEach(([key, item], index) => {
    typeOptions.insertAdjacentHTML("beforeend", `
      <label class="choice-card">
        <input type="radio" name="carportType" value="${key}" ${index === 0 ? "checked" : ""}>
        <span>${item.label}</span>
      </label>
    `);
  });

  const addOnOptions = byId("add-on-options");
  Object.entries(carport.addOns).forEach(([key, item]) => {
    addOnOptions.insertAdjacentHTML("beforeend", `
      <div class="cost-toggle">
        <label class="toggle-label" for="addon-${key}">
          <input class="addon-check" id="addon-${key}" type="checkbox" data-key="${key}">
          <span>${item.label}</span>
        </label>
        <label class="money-field compact" for="addon-cost-${key}">
          <span class="visually-hidden">${item.label}の追加原価</span>
          <span class="currency-prefix">¥</span>
          <input id="addon-cost-${key}" class="addon-cost money-input" data-key="${key}" type="text" inputmode="numeric" pattern="[0-9,]*" autocomplete="off" value="${yenNumber.format(item.defaultCost)}" disabled>
        </label>
      </div>
    `);
  });

  const regionOptions = byId("region-options");
  Object.entries(carport.regions).forEach(([key, item], index) => {
    regionOptions.insertAdjacentHTML("beforeend", `
      <label class="choice-card region-choice">
        <input type="radio" name="region" value="${key}" ${index === 0 ? "checked" : ""}>
        <span>${item.label}<small>+${formatMoney(item.surcharge)}</small></span>
      </label>
    `);
  });
}

function selectedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function calculate() {
  const productCost = numberValue(byId("product-cost"));
  const laborCost = numberValue(byId("labor-cost"));
  const desiredProfit = numberValue(byId("desired-profit"));
  const otherCost = numberValue(byId("other-cost"));
  const regionKey = selectedValue("region") || "standard";
  const regionCost = carport.regions[regionKey].surcharge;

  const addOnCost = [...document.querySelectorAll(".addon-check:checked")]
    .reduce((sum, checkbox) => sum + numberValue(byId(`addon-cost-${checkbox.dataset.key}`)), 0);
  const siteAddOnTotal = addOnCost + otherCost;

  const totalCost = productCost + laborCost + addOnCost + otherCost + regionCost;
  const profitFloor = totalCost + config.pricing.minimumGrossProfit;
  const recommendedPrice = totalCost + desiredProfit;
  const profitFocusedPrice = recommendedPrice + config.pricing.profitFocusedMarkup;

  if (!quoteWasEdited) setMoneyInput(byId("actual-price"), recommendedPrice);

  const actualPrice = numberValue(byId("actual-price"));
  const actualProfit = actualPrice - totalCost;
  const margin = actualPrice > 0 ? (actualProfit / actualPrice) * 100 : 0;

  byId("recommended-price").textContent = formatMoney(recommendedPrice);
  byId("total-cost").textContent = formatMoney(totalCost);
  byId("actual-profit").textContent = formatMoney(actualProfit);
  byId("gross-margin").textContent = `${margin.toFixed(1)}%`;
  byId("profit-floor").textContent = formatMoney(profitFloor);
  byId("profit-focused-price").textContent = formatMoney(profitFocusedPrice);
  byId("site-add-on-total").textContent = formatMoney(siteAddOnTotal);

  const warning = byId("low-price-warning");
  const isBelowFloor = actualPrice < profitFloor;
  warning.hidden = !isBelowFloor;
  if (isBelowFloor) {
    byId("warning-profit").textContent = formatMoney(actualProfit);
  }
}

function applyVariant() {
  const key = selectedValue("carportType") || "single";
  setMoneyInput(byId("labor-cost"), carport.variants[key].baseLaborCost);
  quoteWasEdited = false;
  calculate();
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    if (event.target.id === "actual-price") quoteWasEdited = true;
    if (event.target.classList.contains("money-input")) formatMoneyInput(event.target);
    if (event.target.matches("input")) calculate();
  });

  document.addEventListener("change", (event) => {
    if (event.target.name === "carportType") {
      applyVariant();
      return;
    }
    if (event.target.classList.contains("addon-check")) {
      byId(`addon-cost-${event.target.dataset.key}`).disabled = !event.target.checked;
      event.target.closest(".cost-toggle")?.classList.toggle("is-active", event.target.checked);
    }
    quoteWasEdited = false;
    calculate();
  });

  byId("reset-quote").addEventListener("click", () => {
    quoteWasEdited = false;
    calculate();
  });
}

buildChoices();
setMoneyInput(byId("labor-cost"), carport.variants.single.baseLaborCost);
setMoneyInput(byId("desired-profit"), config.pricing.defaultDesiredGrossProfit);
bindEvents();
calculate();
