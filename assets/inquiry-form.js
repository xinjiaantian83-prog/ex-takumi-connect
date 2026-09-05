(function (root) {
  const INQUIRY_STATUS = 'new';
  const DEMO_CASE_STORAGE_KEY = 'kagawaExteriorDemoCases';
  const CASE_ID_CONFIG = { prefectureCode: 'KGW' };
  function createInquiryId(now = new Date()) {
    return `INQ-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  function inquiryPayloadFromFormData(formData, now = new Date()) {
    return {
      inquiryId: createInquiryId(now), createdAt: now.toISOString(),
      customerName: String(formData.get('customerName') || '').trim(),
      phone: String(formData.get('phone') || '').trim(), email: String(formData.get('email') || '').trim(),
      prefecture: String(formData.get('prefecture') || '').trim(), city: String(formData.get('city') || '').trim(),
      addressDetail: String(formData.get('addressDetail') || '').trim(),
      workCategories: formData.getAll('workCategories').map(String),
      workCategoryOther: String(formData.get('workCategoryOther') || '').trim(),
      projectType: String(formData.get('projectType') || ''), desiredTiming: String(formData.get('desiredTiming') || ''),
      budgetRange: String(formData.get('budgetRange') || ''), message: String(formData.get('message') || '').trim(),
      preferredContactMethod: String(formData.get('preferredContactMethod') || ''),
      preferredContactTime: String(formData.get('preferredContactTime') || ''), photoReferences: [],
      privacyAccepted: formData.get('privacyAccepted') === 'true', status: INQUIRY_STATUS
    };
  }
  function createCaseId(now = new Date(), sequence = 1, config = CASE_ID_CONFIG) {
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `${config.prefectureCode}-${date}-${String(sequence).padStart(3, '0')}`;
  }
  function inquiryToCase(inquiry, options = {}) {
    const now = options.now || new Date(inquiry.createdAt);
    return {
      caseId: options.caseId || createCaseId(now, options.sequence || 1, options.caseIdConfig),
      sourceInquiryId: inquiry.inquiryId, createdAt: inquiry.createdAt,
      customerName: inquiry.customerName, customerContact: { phone: inquiry.phone, email: inquiry.email }, addressDetail: inquiry.addressDetail,
      area: inquiry.city, initialRequestCategories: [...inquiry.workCategories],
      requestSummary: inquiry.message, preferredTiming: inquiry.desiredTiming, status: 'new',
      assignedContractorId: null, assignedContractorName: null, siteVisitDate: null, estimateSubmittedAt: null,
      contractStatus: 'pending', finalWorkCategories: [], finalContractAmount: null, referralFee: null, reportSubmittedAt: null,
      notes: '', declinedContractorIds: [], lastStatusUpdatedAt: inquiry.createdAt,
      offeredContractorId: null, offeredContractorName: null, offeredAt: null, responseDeadline: null,
      offerStatus: 'none', offerHistory: [], urgency: 'normal', demoData: true
    };
  }
  function validateInquiry(payload) {
    const issues = [];
    if (!payload.customerName) issues.push({ name: 'customerName', message: 'お名前を入力してください。' });
    if (!/^[0-9０-９()（）+＋ー\-\s]{8,}$/.test(payload.phone)) issues.push({ name: 'phone', message: '電話番号を8文字以上で入力してください。' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) issues.push({ name: 'email', message: 'メールアドレスを正しい形式で入力してください。' });
    if (!payload.city) issues.push({ name: 'city', message: '工事予定の市町村を入力してください。' });
    if (!payload.workCategories.length) issues.push({ name: 'workCategories', message: '希望工事を1つ以上選択してください。' });
    if (payload.workCategories.includes('その他') && !payload.workCategoryOther) issues.push({ name: 'workCategoryOther', message: 'その他の工事内容を入力してください。' });
    if (!payload.message) issues.push({ name: 'message', message: '問い合わせ内容を入力してください。' });
    if (!payload.privacyAccepted) issues.push({ name: 'privacyAccepted', message: '個人情報の取り扱いをご確認のうえ同意してください。' });
    return issues;
  }
  const api = { INQUIRY_STATUS, DEMO_CASE_STORAGE_KEY, CASE_ID_CONFIG, createCaseId, inquiryPayloadFromFormData, inquiryToCase, validateInquiry };
  root.InquiryForm = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-inquiry-form]').forEach(form => {
    const otherToggle = form.querySelector('[data-inquiry-other]');
    const otherField = form.querySelector('[data-inquiry-other-field]');
    const otherInput = form.querySelector('[name="workCategoryOther"]');
    const summary = form.querySelector('[data-inquiry-errors]');
    const status = form.querySelector('.form-status');
    const submit = form.querySelector('[type="submit"]');
    let started = false;
    const updateOther = () => { otherField.hidden = !otherToggle.checked; otherInput.required = otherToggle.checked; if (!otherToggle.checked) otherInput.value = ''; };
    form.addEventListener('input', () => { if (!started) { started = true; root.trackEvent?.('form_start', { form: 'customer' }); } });
    otherToggle.addEventListener('change', updateOther);
    form.addEventListener('reset', () => setTimeout(updateOther));
    updateOther();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      form.querySelectorAll('.is-invalid').forEach(element => element.classList.remove('is-invalid'));
      const payload = inquiryPayloadFromFormData(new FormData(form));
      const issues = validateInquiry(payload);
      if (issues.length) {
        summary.innerHTML = `<strong>入力内容をご確認ください</strong><ul>${issues.map(issue => `<li>${issue.message}</li>`).join('')}</ul>`;
        summary.hidden = false;
        issues.forEach(issue => form.querySelector(`[name="${issue.name}"]`)?.closest('.field, .check')?.classList.add('is-invalid'));
        const first = form.querySelector(`[name="${issues[0].name}"]`);
        first?.focus({ preventScroll: true }); first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      summary.hidden = true; summary.innerHTML = ''; submit.disabled = true; status.textContent = '送信しています…';
      const endpoint = form.dataset.endpoint;
      try {
        if (endpoint) {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error('send_failed');
        } else await new Promise(resolve => setTimeout(resolve, 300));
        if (!endpoint) {
          const existing = JSON.parse(localStorage.getItem(DEMO_CASE_STORAGE_KEY) || '[]');
          const caseItem = inquiryToCase(payload, { sequence: existing.length + 1 });
          localStorage.setItem(DEMO_CASE_STORAGE_KEY, JSON.stringify([...existing, caseItem]));
          status.innerHTML = 'お問い合わせを受け付けました。内容を確認のうえ、対応可能な施工店をご案内します。<br><a href="contractors/cases/?demoInquiry=latest">開発用案件管理で確認する →</a>';
        } else status.textContent = 'お問い合わせを受け付けました。内容を確認のうえ、対応可能な施工店をご案内します。';
        root.trackEvent?.('form_submit', { form: 'customer', demo: !endpoint }); form.reset(); started = false;
      } catch { status.textContent = '送信できませんでした。時間をおいて再度お試しください。'; }
      finally { setTimeout(() => { submit.disabled = false; }, 1000); }
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
