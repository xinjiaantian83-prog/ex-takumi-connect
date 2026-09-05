(() => {
  const source = window.CASES_DEMO_DATA;
  const demoStorageKey = "kagawaExteriorDemoCases";
  let importedCases = [];
  try { importedCases = JSON.parse(localStorage.getItem(demoStorageKey) || "[]"); } catch { importedCases = []; }
  const cases = [...importedCases, ...source.cases].map(item => window.initializeSettlement({ offeredContractorId: null, offeredContractorName: null, offeredAt: null, responseDeadline: null, offerStatus: "none", offerHistory: [], urgency: "normal", ...item }));
  const statuses = source.statuses;
  const settlementLabels = { none: "対象外", awaiting_review: "運営確認中", confirmed: "紹介料確定", invoiced: "お支払い待ち", paid: "入金確認済み", overdue: "期限超過", cancelled: "取消" };
  const yen = value => value == null ? "未報告" : `¥${Number(value).toLocaleString("ja-JP")}`;
  const date = value => value ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "未定";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const list = document.querySelector("#case-list");
  const detail = document.querySelector("#case-detail");
  const form = document.querySelector("#case-report-form");
  const caseSelect = form.elements.caseId;
  const contractedFields = document.querySelector("#contracted-fields");
  const lostFields = document.querySelector("#lost-fields");
  const categoryContainer = document.querySelector("#final-work-categories");
  const amountInput = form.elements.finalContractAmount;
  const feePreview = document.querySelector("#fee-preview");
  const feeUnconfigured = document.querySelector("#fee-unconfigured");
  let selectedCaseId = new URLSearchParams(location.search).has("demoInquiry") && importedCases.length ? importedCases.at(-1).caseId : cases[0]?.caseId;

  function renderList() {
    list.innerHTML = cases.map(item => `<button class="case-card${item.caseId === selectedCaseId ? " active" : ""}" type="button" data-case-id="${escapeHtml(item.caseId)}"><span class="case-card-top"><b>${escapeHtml(item.caseId)}</b><em class="status status-${escapeHtml(item.status)}">${escapeHtml(statuses[item.status])}</em></span><span class="case-area">${escapeHtml(item.area)}</span><strong>${escapeHtml(item.initialRequestCategories.join("・"))}</strong><span class="case-summary">${escapeHtml(item.requestSummary)}</span><span class="case-timing">希望時期：${escapeHtml(item.preferredTiming || "未定")}</span><span class="case-more">詳細を確認 →</span></button>`).join("");
    list.querySelectorAll("[data-case-id]").forEach(button => button.addEventListener("click", () => selectCase(button.dataset.caseId)));
  }

  function renderDetail() {
    const item = cases.find(caseItem => caseItem.caseId === selectedCaseId);
    if (!item) return;
    window.expireCaseOfferIfNeeded(item);
    const pending = item.offerStatus === "pending";
    const accepted = item.offerStatus === "accepted";
    let offerPanel = pending ? `<div class="active-offer"><span>回答待ち案件</span><strong>${escapeHtml(item.offeredContractorName)}へ打診中</strong><p>回答期限：${escapeHtml(date(item.responseDeadline))}</p><small>案件は原則として1社ずつご案内しています。</small></div>` : accepted ? `<div class="active-offer accepted"><span>紹介先確定</span><strong>${escapeHtml(item.assignedContractorName)}</strong></div>` : "";
    const privacyPanel = accepted ? `<div class="customer-disclosure"><strong>受諾後に開示する連絡情報（デモ）</strong><dl><div><dt>お名前</dt><dd>${escapeHtml(item.customerName)}</dd></div><div><dt>電話</dt><dd>${escapeHtml(item.customerContact?.phone || item.customerContact || "未登録")}</dd></div><div><dt>メール</dt><dd>${escapeHtml(item.customerContact?.email || "未登録")}</dd></div><div><dt>詳細住所</dt><dd>${escapeHtml(item.addressDetail || "現調前に確認")}</dd></div></dl></div>` : `<div class="privacy-scope"><strong>顧客情報は未開示です</strong><span>候補選定・打診中は、電話番号・メール・詳細住所を候補一覧へ表示しません。受諾後に必要範囲を開示する想定です。</span></div>`;
    const selectionAction = item.status === "new" ? `<button class="start-selection" type="button" data-start-selection>候補施工店を抽出する</button>` : "";
    const billingPanel = item.settlementStatus !== "none" ? `<div class="contractor-billing"><span>紹介料のお支払い状況</span><strong>${escapeHtml(settlementLabels[item.settlementStatus])}</strong>${item.confirmedReferralFee != null ? `<dl><div><dt>紹介料確定額</dt><dd>${yen(item.confirmedReferralFee)}</dd></div><div><dt>請求番号</dt><dd>${escapeHtml(item.invoiceNumber || "請求前")}</dd></div><div><dt>支払期限</dt><dd>${escapeHtml(item.paymentDueDate ? date(item.paymentDueDate) : "未設定")}</dd></div></dl>` : `<p>最終紹介料は運営確認後に確定します。</p>`}<small>紹介料のお支払い方法は、登録時にご案内する指定口座への銀行振込を予定しています。</small></div>` : "";
    offerPanel += privacyPanel + selectionAction + billingPanel;
    detail.innerHTML = `<div class="detail-head"><div><span>案件番号</span><h3>${escapeHtml(item.caseId)}</h3></div><em class="status status-${escapeHtml(item.status)}">${escapeHtml(statuses[item.status])}</em></div>${offerPanel}<dl><div><dt>地域</dt><dd>${escapeHtml(item.area)}</dd></div><div><dt>希望工事</dt><dd>${escapeHtml((item.matchingCategories || item.initialRequestCategories).join("・"))}</dd></div><div><dt>希望時期</dt><dd>${escapeHtml(item.preferredTiming)}</dd></div><div><dt>現調予定</dt><dd>${escapeHtml(date(item.siteVisitDate))}</dd></div><div class="detail-wide"><dt>問い合わせ内容</dt><dd>${escapeHtml(item.requestSummary)}</dd></div><div class="detail-wide"><dt>メモ</dt><dd>${escapeHtml(item.notes || "なし")}</dd></div></dl><div class="offer-response-copy"><strong>施工店側の回答デモ</strong><p>対応が難しい場合は、遠慮なく辞退してください。辞退によるペナルティはありません。</p></div><div class="future-actions"><button type="button" data-accept-offer${pending ? "" : " disabled"}>対応する</button><button type="button" data-decline${pending ? "" : " disabled"}>辞退する</button></div><div class="decline-box" hidden><label>辞退理由 <small>任意</small><select data-decline-reason><option value="">選択してください</option><option>スケジュール</option><option>距離</option><option>工種</option><option>現場条件</option><option>現在余力なし</option><option>その他</option></select></label><button type="button" data-confirm-decline>辞退して再選定へ戻す</button><p>早めの辞退を歓迎します。ペナルティはありません。</p></div><section class="candidate-section"><div class="candidate-heading"><div><span>運営内部用</span><h4>候補施工店</h4></div><small>候補順は参考です。最終紹介先は運営者が判断します。</small></div><div class="offer-controls"><label>回答期限<select data-response-hours><option value="6">6時間</option><option value="12">12時間</option><option value="24" selected>24時間（基本）</option><option value="48">48時間</option></select></label>${pending ? `<div class="pending-lock">現在 ${escapeHtml(item.offeredContractorName)}へ回答待ちです。別施工店への同時オファーはできません。<button type="button" data-cancel-offer>運営側でオファーをキャンセル</button></div>` : ""}</div><div class="candidate-list" data-candidate-list></div><div class="assignment-result" data-assignment-result role="status"></div><div class="offer-history"><h5>紹介履歴</h5><div data-offer-history></div></div></section>`;
    detail.querySelector("[data-accept-offer]").addEventListener("click", () => { window.acceptCaseOffer(item); refreshDetail(); });
    detail.querySelector("[data-decline]").addEventListener("click", () => { detail.querySelector(".decline-box").hidden = false; });
    detail.querySelector("[data-confirm-decline]").addEventListener("click", () => { window.declineCaseOffer(item, detail.querySelector("[data-decline-reason]").value); refreshDetail(); });
    detail.querySelector("[data-cancel-offer]")?.addEventListener("click", () => { window.cancelCaseOffer(item); refreshDetail(); });
    detail.querySelector("[data-start-selection]")?.addEventListener("click", () => { item.status = "selecting"; item.lastStatusUpdatedAt = new Date().toISOString(); refreshDetail(); });
    renderCandidates(item);
    renderOfferHistory(item);
  }

  function refreshDetail() { renderList(); renderDetail(); }

  function renderOfferHistory(item) {
    const labels = { pending: "回答待ち", accepted: "承諾", declined: "辞退", expired: "期限切れ", cancelled: "運営キャンセル" };
    const target = detail.querySelector("[data-offer-history]");
    target.innerHTML = item.offerHistory.length ? item.offerHistory.map((entry, index) => `<div class="history-item"><b>${index + 1}社目</b><strong>${escapeHtml(entry.contractorName)}</strong><span>${escapeHtml(date(entry.offeredAt))} 打診</span><em>→ ${escapeHtml(labels[entry.result])}</em></div>`).join("") : '<p>まだオファー履歴はありません。</p>';
  }

  function renderCandidates(item) {
    const target = detail.querySelector("[data-candidate-list]");
    const candidates = window.extractContractorCandidates(item, window.CONTRACTORS_DEMO_DATA);
    if (!candidates.length) {
      target.innerHTML = '<p class="no-candidates">必須条件に合う候補施工店がありません。条件を確認してください。</p>';
      return;
    }
    const capacityLabels = { available: "受付可能", limited: "少し余裕あり", full: "現在いっぱい" };
    const responseLabels = { normal: "通常", slow: "返信状況に注意", paused: "一時停止" };
    const locked = ["pending", "accepted"].includes(item.offerStatus) || item.status === "new";
    target.innerHTML = candidates.map(({ contractor, matchedCategories, requestedCategoryCount, reasons }) => `<article class="candidate-card${item.assignedContractorId === contractor.contractorId ? " selected" : ""}"><div class="candidate-card-head"><div><strong>${escapeHtml(contractor.businessName)}</strong><span>${escapeHtml(contractor.area.join("・"))}</span></div>${contractor.responseStatus === "slow" ? '<em>対応状況を確認</em>' : ""}</div><div class="candidate-reasons">${reasons.map(reason => `<span>${escapeHtml(reason)}</span>`).join("")}</div><dl><div><dt>対応工種</dt><dd>${escapeHtml(contractor.workCategories.join("・"))}</dd></div><div><dt>工種一致</dt><dd>${matchedCategories.length} / ${requestedCategoryCount}</dd></div><div><dt>受付状況</dt><dd>${escapeHtml(capacityLabels[contractor.currentCapacity])}</dd></div><div><dt>進行中</dt><dd>${contractor.activeCaseCount}件</dd></div><div><dt>直近紹介</dt><dd>${contractor.recentReferralCount}件</dd></div><div><dt>最終紹介日</dt><dd>${contractor.lastReferralAt ? escapeHtml(date(contractor.lastReferralAt)) : "紹介実績なし"}</dd></div><div><dt>レスポンス</dt><dd>${escapeHtml(responseLabels[contractor.responseStatus])}</dd></div></dl><button class="assign-button" type="button" data-assign-id="${escapeHtml(contractor.contractorId)}"${locked ? " disabled" : ""}>この施工店へ案件を打診</button></article>`).join("");
    target.querySelectorAll("[data-assign-id]").forEach(button => button.addEventListener("click", () => {
      const contractor = window.CONTRACTORS_DEMO_DATA.find(entry => entry.contractorId === button.dataset.assignId);
      const responseHours = Number(detail.querySelector("[data-response-hours]").value);
      const result = window.createCaseOffer(item, contractor, responseHours);
      refreshDetail();
      detail.querySelector("[data-assignment-result]").textContent = result.ok ? `${contractor.businessName}へ案件を打診しました。デモのため通知は送信していません。` : "現在のオファーが完了するまで、別施工店へ打診できません。";
    }));
  }

  function selectCase(caseId) {
    selectedCaseId = caseId;
    caseSelect.value = caseId;
    renderList();
    renderDetail();
    renderSettlementAdmin();
  }

  function renderFormOptions() {
    caseSelect.innerHTML = cases.map(item => `<option value="${escapeHtml(item.caseId)}">${escapeHtml(item.caseId)} / ${escapeHtml(item.area)}</option>`).join("");
    categoryContainer.innerHTML = source.workCategories.map(category => `<label><input type="checkbox" name="finalWorkCategories" value="${escapeHtml(category)}"><span>${escapeHtml(category)}</span></label>`).join("");
    caseSelect.value = selectedCaseId;
    caseSelect.addEventListener("change", () => selectCase(caseSelect.value));
  }

  function updateReportMode() {
    const mode = form.elements.contractStatus.value;
    contractedFields.hidden = mode !== "contracted";
    lostFields.hidden = mode !== "lost";
  }

  function parseAmount() {
    const digits = amountInput.value.replace(/[^0-9]/g, "");
    return digits ? Number(digits) : null;
  }

  function updateFeePreview() {
    const fee = window.calculateReferralFee(parseAmount(), window.REFERRAL_FEE_CONFIG, "contracted");
    feePreview.hidden = fee == null;
    feeUnconfigured.hidden = fee != null;
    if (fee != null) feePreview.querySelector("strong").textContent = yen(fee);
  }

  function reportPayload() {
    const mode = form.elements.contractStatus.value;
    return {
      caseId: caseSelect.value,
      contractStatus: mode,
      finalWorkCategories: mode === "contracted" ? [...form.querySelectorAll('[name="finalWorkCategories"]:checked')].map(input => input.value) : [],
      finalContractAmount: mode === "contracted" ? parseAmount() : null,
      referralFee: mode === "contracted" ? window.calculateReferralFee(parseAmount(), window.REFERRAL_FEE_CONFIG, mode) : 0,
      lostReason: mode === "lost" ? form.elements.lostReason.value || null : null,
      notes: mode === "contracted" ? form.elements.contractNotes.value.trim() : form.elements.lostNotes.value.trim(),
      declarationConfirmed: form.elements.declarationConfirmed.checked,
      reportSubmittedAt: new Date().toISOString()
    };
  }

  function validateReport() {
    const errors = [];
    const mode = form.elements.contractStatus.value;
    if (!caseSelect.value) errors.push("案件番号を選択してください。");
    if (!mode) errors.push("成約または失注を選択してください。");
    if (mode === "contracted" && !form.querySelector('[name="finalWorkCategories"]:checked')) errors.push("最終工事内容を1つ以上選択してください。");
    if (mode === "contracted" && !(parseAmount() > 0)) errors.push("最終成約金額を入力してください。");
    if (!form.elements.declarationConfirmed.checked) errors.push("自己申告の確認欄をチェックしてください。");
    const box = document.querySelector("#report-errors");
    box.hidden = errors.length === 0;
    box.innerHTML = errors.length ? `<strong>入力内容をご確認ください</strong><ul>${errors.map(error => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : "";
    if (errors.length) box.scrollIntoView({ behavior: "smooth", block: "center" });
    return errors.length === 0;
  }

  form.addEventListener("change", event => {
    if (event.target.name === "contractStatus") updateReportMode();
  });
  amountInput.addEventListener("input", () => {
    const digits = amountInput.value.replace(/[^0-9]/g, "");
    amountInput.value = digits ? Number(digits).toLocaleString("ja-JP") : "";
    updateFeePreview();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!validateReport()) return;
    const payload = reportPayload();
    const item = cases.find(caseItem => caseItem.caseId === payload.caseId);
    const result = window.submitContractSettlement(item, payload);
    document.querySelector("#report-result").innerHTML = `<strong>デモ報告を受け付けました。</strong><span>${payload.contractStatus === "contracted" ? "紹介料は運営確認後に確定します。" : "失注案件のため紹介料精算は発生しません。"}</span><code>${escapeHtml(JSON.stringify(payload))}</code>`;
    if (result.ok) { renderList(); renderDetail(); renderSettlementAdmin(); renderOperations(); }
  });

  function renderSettlementAdmin() {
    cases.forEach(item => window.markSettlementOverdueIfNeeded(item));
    const target = document.querySelector("#settlement-admin");
    const item = cases.find(caseItem => caseItem.caseId === selectedCaseId);
    const counts = ["awaiting_review", "confirmed", "invoiced", "paid", "overdue"].map(status => [settlementLabels[status], cases.filter(entry => entry.settlementStatus === status).length]);
    const totals = cases.reduce((summary, entry) => {
      if (["confirmed", "invoiced", "paid", "overdue"].includes(entry.settlementStatus)) summary.confirmed += entry.confirmedReferralFee || 0;
      if (entry.settlementStatus === "paid") summary.paid += entry.paidAmount || 0;
      return summary;
    }, { confirmed: 0, paid: 0 });
    if (!item || item.settlementStatus === "none") {
      target.innerHTML = `<div class="settlement-summary">${counts.map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join("")}</div><div class="settlement-empty">選択中の案件には、確認待ちの成約報告がありません。</div>`;
      return;
    }
    const automaticFee = window.calculateReferralFee(item.finalContractAmount, window.REFERRAL_FEE_CONFIG, "contracted");
    const difference = item.settlementStatus === "paid" ? item.paidAmount - item.confirmedReferralFee : null;
    target.innerHTML = `<div class="settlement-summary">${counts.map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join("")}<div><span>紹介料確定額</span><strong>${yen(totals.confirmed)}</strong></div><div><span>入金済み</span><strong>${yen(totals.paid)}</strong></div></div><article class="settlement-card"><div class="settlement-card-head"><div><span>案件番号</span><h3>${escapeHtml(item.caseId)}</h3></div><em data-settlement-status>${escapeHtml(settlementLabels[item.settlementStatus])}</em></div><dl class="settlement-details"><div><dt>施工店名</dt><dd>${escapeHtml(item.assignedContractorName || "未設定")}</dd></div><div><dt>報告日時</dt><dd>${escapeHtml(date(item.reportSubmittedAt))}</dd></div><div class="wide"><dt>初回問い合わせ</dt><dd>${escapeHtml(item.requestSummary)}</dd></div><div class="wide"><dt>最終工事内容</dt><dd>${escapeHtml((item.finalWorkCategories || []).join("・") || "未報告")}</dd></div><div><dt>税抜成約金額</dt><dd>${yen(item.finalContractAmount)}</dd></div><div><dt>紹介料見込み</dt><dd>${yen(automaticFee)}</dd></div><div class="wide"><dt>施工店からの補足</dt><dd>${escapeHtml(item.notes || "なし")}</dd></div></dl>${item.settlementStatus === "awaiting_review" ? `<div class="settlement-actions"><label>確定する紹介料<input data-confirmed-fee type="text" inputmode="numeric" value="${automaticFee}"></label><label>調整理由<input data-adjustment-reason placeholder="自動計算値を変更する場合は必須"></label><label class="wide">運営内部メモ<textarea data-settlement-notes></textarea></label><button type="button" data-confirm-settlement>紹介料を確定</button></div>` : ""}${item.settlementStatus === "confirmed" ? `<div class="settlement-actions"><label>支払期限<input data-payment-due type="date"></label><button type="button" data-issue-invoice>請求済みにする</button></div>` : ""}${["invoiced", "overdue", "paid"].includes(item.settlementStatus) ? `<div class="invoice-data"><dl><div><dt>紹介料</dt><dd>${yen(item.confirmedReferralFee)}</dd></div><div><dt>請求番号</dt><dd>${escapeHtml(item.invoiceNumber)}</dd></div><div><dt>請求日</dt><dd>${escapeHtml(date(item.invoicedAt))}</dd></div><div><dt>支払期限</dt><dd>${escapeHtml(date(item.paymentDueDate))}</dd></div></dl>${["invoiced", "overdue"].includes(item.settlementStatus) ? `<label>入金額<input data-paid-amount type="text" inputmode="numeric" value="${item.confirmedReferralFee}"></label><button type="button" data-confirm-payment>入金確認</button>` : `<p class="payment-complete">${escapeHtml(date(item.paidAt))} に ${yen(item.paidAmount)} の入金を確認しました。${difference ? `<strong class="payment-difference">差額：${yen(difference)}</strong>` : ""}</p>`}</div>` : ""}${!["paid", "cancelled"].includes(item.settlementStatus) ? `<div class="cancel-settlement"><label>取消理由<input data-cancel-reason placeholder="契約解除等の理由を入力"></label><button type="button" data-cancel-settlement>精算を取り消す</button></div>` : ""}<div class="settlement-message" data-settlement-message role="status"></div></article>`;
    target.querySelector("[data-confirm-settlement]")?.addEventListener("click", () => {
      const result = window.confirmSettlement(item, { confirmedReferralFee: target.querySelector("[data-confirmed-fee]").value, adjustmentReason: target.querySelector("[data-adjustment-reason]").value, settlementNotes: target.querySelector("[data-settlement-notes]").value });
      if (!result.ok) { target.querySelector("[data-settlement-message]").textContent = "紹介料を変更する場合は調整理由を入力してください。"; return; }
      renderDetail(); renderSettlementAdmin();
    });
    target.querySelector("[data-issue-invoice]")?.addEventListener("click", () => {
      const due = target.querySelector("[data-payment-due]").value;
      window.issueSettlementInvoice(item, { sequence: cases.filter(entry => entry.invoiceNumber).length + 1, paymentDueDate: due || null }); renderDetail(); renderSettlementAdmin();
    });
    target.querySelector("[data-confirm-payment]")?.addEventListener("click", () => { window.confirmSettlementPayment(item, Number(target.querySelector("[data-paid-amount]").value.replace(/[^0-9]/g, ""))); renderDetail(); renderSettlementAdmin(); });
    target.querySelector("[data-cancel-settlement]")?.addEventListener("click", () => {
      const result = window.cancelSettlement(item, target.querySelector("[data-cancel-reason]").value);
      if (!result.ok) { target.querySelector("[data-settlement-message]").textContent = "取消理由を入力してください。"; return; }
      renderDetail(); renderSettlementAdmin();
    });
  }

  function isWaiting(item, days = 7, now = new Date("2026-09-01T12:00:00+09:00")) {
    if (!["introduced", "site_visit_scheduled", "estimate_submitted"].includes(item.status)) return false;
    return now - new Date(item.lastStatusUpdatedAt) >= days * 86400000;
  }

  function renderOperations() {
    const introduced = cases.filter(item => !["new", "selecting"].includes(item.status)).length;
    const contracted = cases.filter(item => item.contractStatus === "contracted");
    const lost = cases.filter(item => item.contractStatus === "lost");
    const amount = contracted.reduce((sum, item) => sum + (item.finalContractAmount || 0), 0);
    const fees = contracted.map(item => item.referralFee).filter(Number.isFinite);
    const summary = [
      ["案件数", cases.length], ["紹介済み", introduced], ["成約", contracted.length], ["失注", lost.length],
      ["成約金額", yen(amount)], ["紹介料", fees.length ? yen(fees.reduce((sum, value) => sum + value, 0)) : "未確定"],
      ["未報告案件", cases.filter(item => !item.reportSubmittedAt && ["contracted", "lost"].includes(item.status)).length],
      ["紹介施工店", new Set(cases.map(item => item.assignedContractorId).filter(Boolean)).size]
    ];
    document.querySelector("#operations-summary").innerHTML = summary.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
    const waiting = cases.filter(item => isWaiting(item));
    document.querySelector("#waiting-cases").textContent = waiting.length ? waiting.map(item => item.caseId).join("、") : "現在、確認待ちのデモ案件はありません。";
  }

  renderFormOptions();
  renderList();
  renderDetail();
  renderSettlementAdmin();
  renderOperations();
  updateReportMode();
  updateFeePreview();
})();
