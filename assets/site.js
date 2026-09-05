const config = window.SITE_CONFIG || {};
document.querySelectorAll('[data-service-name]').forEach(el => el.textContent = config.serviceName || el.textContent);

const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

window.trackEvent = (name, params = {}) => {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, { page_path: location.pathname, ...params });
};

function createIdempotencyKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((value, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${value.toString(16).padStart(2, '0')}`).join('');
}

document.querySelectorAll('[data-track]').forEach(el => el.addEventListener('click', () => {
  window.trackEvent(el.dataset.track, { label: el.dataset.label || el.textContent.trim() });
}));

const recruitmentHero = document.querySelector('.recruitment-home .contractor-hero');
const mobileEntryCta = document.querySelector('.recruitment-home .mobile-entry-cta');
if (recruitmentHero && mobileEntryCta && 'IntersectionObserver' in window) {
  const heroObserver = new IntersectionObserver(([entry]) => {
    mobileEntryCta.classList.toggle('is-suppressed', entry.isIntersecting);
  }, { threshold: 0.08 });
  heroObserver.observe(recruitmentHero);
}

// Contractor application payload keys are defined by the form field names.
// Repeated workCategories and supportedProjectTypes values are submitted as multi-value FormData fields.
document.querySelectorAll('[data-contractor-form]').forEach(form => {
  const otherToggle = form.querySelector('[data-work-other]');
  const otherField = form.querySelector('[data-work-other-field]');
  const otherInput = form.querySelector('[name="workCategoryOther"]');
  const categoryGroup = form.querySelector('[data-category-group]');
  const categories = [...form.querySelectorAll('[name="workCategories"]')];
  const categoryLimit = Number(categoryGroup?.dataset.categoryLimit || 3);
  const categoryLimitStatus = form.querySelector('[data-category-limit-status]');
  const prefecture = form.querySelector('[data-business-prefecture]');
  const registrationType = form.querySelector('[data-registration-type]');
  const registrationStatus = form.querySelector('[data-registration-status]');
  const launchPrefecture = form.dataset.launchPrefecture;
  const updateOtherField = () => {
    const visible = Boolean(otherToggle?.checked);
    otherField.hidden = !visible;
    otherInput.required = visible;
    if (!visible) otherInput.value = '';
  };
  const updateRegistrationType = () => {
    if (!prefecture || !registrationType || !registrationStatus) return;
    const isEarly = Boolean(prefecture.value && prefecture.value !== launchPrefecture);
    registrationType.value = isEarly ? 'early' : 'standard';
    registrationStatus.classList.toggle('is-early', isEarly);
    registrationStatus.innerHTML = isEarly
      ? `<strong>${prefecture.value}の先行登録として受け付けます。</strong><br><small>展開開始前のため、現時点では案件紹介をお約束するものではありません。</small>`
      : `<strong>${launchPrefecture}の通常登録として受け付けます。</strong>`;
  };
  const updateCategoryLimit = () => {
    const selectedCount = categories.filter(input => input.checked).length;
    const reachedLimit = selectedCount >= categoryLimit;
    categories.forEach(input => { input.disabled = reachedLimit && !input.checked; });
    if (categoryLimitStatus) categoryLimitStatus.textContent = `${selectedCount} / ${categoryLimit} 選択中`;
  };
  otherToggle?.addEventListener('change', updateOtherField);
  categories.forEach(input => input.addEventListener('change', updateCategoryLimit));
  prefecture?.addEventListener('change', updateRegistrationType);
  form.addEventListener('reset', () => setTimeout(() => {
    updateOtherField();
    updateCategoryLimit();
    updateRegistrationType();
  }));
  updateOtherField();
  updateCategoryLimit();
  updateRegistrationType();
});

function validateContractorForm(form) {
  const summary = form.querySelector('[data-validation-summary]');
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
  const issues = [];
  const invalidGroups = new Set();
  const categories = [...form.querySelectorAll('[name="workCategories"]')];
  if (!categories.some(input => input.checked)) {
    issues.push({ element: categories[0], label: '得意・主力工種を1つ以上選択してください。' });
    invalidGroups.add(form.querySelector('[data-category-group]'));
  }
  if (categories.filter(input => input.checked).length > 3) {
    issues.push({ element: categories[0], label: '得意・主力工種は3つまで選択してください。' });
    invalidGroups.add(form.querySelector('[data-category-group]'));
  }
  const phone = form.querySelector('[name="phone"]');
  if (phone.value && !/^[0-9０-９()（）+＋ー\-\s]{8,}$/.test(phone.value)) {
    issues.push({ element: phone, label: '電話番号を8文字以上の数字・ハイフン等で入力してください。' });
    invalidGroups.add(phone.closest('.field'));
  }
  [...form.elements].filter(el => el.willValidate && !el.checkValidity()).forEach(element => {
    if (element.name === 'workCategoryOther' && element.hidden) return;
    const field = element.closest('.field, .form-section, .check');
    const label = form.querySelector(`label[for="${element.id}"]`)?.textContent.trim()
      || field?.querySelector('.field-label')?.textContent.trim()
      || element.closest('label')?.textContent.trim()
      || '必須項目';
    let message = `${label.replace(/必須/g, '').trim()}を確認してください。`;
    if (element.type === 'email' && element.validity.typeMismatch) message = 'メールアドレスを正しい形式で入力してください。';
    if (element.name === 'phone' && element.validity.tooShort) message = '電話番号を8文字以上の数字・ハイフン等で入力してください。';
    if (!issues.some(issue => issue.element.name && issue.element.name === element.name)) issues.push({ element, label: message });
    invalidGroups.add(field);
  });
  invalidGroups.forEach(el => el?.classList.add('is-invalid'));
  if (!issues.length) {
    summary.hidden = true;
    summary.innerHTML = '';
    return true;
  }
  summary.innerHTML = `<strong>入力内容をご確認ください</strong><ul>${issues.map(issue => `<li>${issue.label}</li>`).join('')}</ul>`;
  summary.hidden = false;
  const first = issues[0].element;
  first?.focus({ preventScroll: true });
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

document.querySelectorAll('form[data-demo-form]:not([data-inquiry-form])').forEach(form => {
  let started = false;
  let idempotencyKey = createIdempotencyKey();
  form.addEventListener('input', () => {
    if (!started) { started = true; window.trackEvent('form_start', { form: form.dataset.formType }); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector('.form-status');
    if (form.matches('[data-contractor-form]') && !validateContractorForm(form)) return;
    if (!form.reportValidity() || submit.disabled) return;
    submit.disabled = true;
    status.textContent = '送信しています…';
    const endpoint = form.dataset.endpoint;
    try {
      if (!endpoint) throw new Error('endpoint_not_configured');
      const data = new FormData(form);
      const payload = {};
      for (const [key, value] of data.entries()) {
        if (key === 'workCategories' || key === 'supportedProjectTypes') {
          if (!payload[key]) payload[key] = [];
          payload[key].push(value);
        } else {
          payload[key] = value;
        }
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('send_failed');
      const result = await response.json();
      if (!result.ok) throw new Error('save_failed');
      status.textContent = '登録申請を受け付けました。内容確認後、運営よりご連絡します。';
      window.trackEvent(
        form.matches('[data-contractor-form]') ? 'contractor_application_success' : 'form_submit',
        { form: form.dataset.formType }
      );
      form.reset();
      idempotencyKey = createIdempotencyKey();
    } catch {
      status.textContent = endpoint
        ? '送信できませんでした。入力内容をご確認のうえ、時間をおいて再度お試しください。'
        : '現在フォームを送信できません。お手数ですが、運営者へお問い合わせください。';
    } finally {
      setTimeout(() => { submit.disabled = false; }, 1500);
    }
  });
});
