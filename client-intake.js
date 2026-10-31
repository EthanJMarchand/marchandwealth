(function () {
  const form = document.getElementById("client-intake-form");
  if (!form) return;

  const money = (value) => {
    const n = Number(String(value ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const filled = (value) => String(value ?? "").trim() !== "";

  const hasPartner = () => {
    const checked = form.querySelector('input[name="has-partner"]:checked');
    return checked ? checked.value === "yes" : false;
  };

  const householdChosen = () => Boolean(form.querySelector('input[name="has-partner"]:checked'));

  const dependantCount = () => Math.max(0, Math.min(12, Math.floor(money(form.elements["dependant-count"]?.value))));

  // How far the client has walked. Optional money fields unlock on leave, even if blank.
  let cursor = 0;

  const STEP_ORDER = [
    "name",
    "age",
    "income",
    "household",
    "spouse",
    "dependants",
    "debts",
    "coverage-p1",
    "coverage-p2",
    "retirement",
    "accounts-p1",
    "accounts-p2",
    "legacy",
    "returns",
    "submit",
  ];

  function stepEl(name) {
    return form.querySelector(`.intake-step[data-step="${name}"]`);
  }

  function isPartnerStep(name) {
    return stepEl(name)?.dataset.when === "partner";
  }

  function visibleStepNames() {
    return STEP_ORDER.filter((name) => {
      if (isPartnerStep(name) && !hasPartner()) return false;
      return true;
    });
  }

  function syncDependantAges() {
    const wrap = document.getElementById("intake-dependant-ages");
    if (!wrap) return;
    const count = dependantCount();
    const existing = [...wrap.querySelectorAll("[data-dep-age]")];
    // Only rebuild when the count changes. Replacing inputs on every keystroke
    // steals focus and makes the age fields look unfillable.
    if (existing.length === count) return;
    const previous = existing.map((input) => input.value);
    wrap.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const label = document.createElement("label");
      label.className = "block text-sm font-medium text-navydeep";
      label.textContent = `Dependant ${index + 1} age`;
      const input = document.createElement("input");
      input.name = `dependant-age-${index}`;
      input.dataset.depAge = "true";
      input.inputMode = "numeric";
      input.className = "mt-2 w-full rounded-sm border border-line bg-white/90 px-3.5 py-3 text-base shadow-sm focus:border-gold focus:outline-none";
      input.value = previous[index] ?? "";
      input.setAttribute("aria-label", `Age of dependant ${index + 1}`);
      label.append(input);
      wrap.append(label);
    }
  }

  function stepComplete(name) {
    if (name === "name") return filled(form.elements["client-name"]?.value);
    if (name === "age") return filled(form.elements["client-age"]?.value);
    if (name === "income") return filled(form.elements["personal-income"]?.value);
    if (name === "household") return householdChosen();
    if (name === "spouse") {
      return filled(form.elements["partner-name"]?.value)
        && filled(form.elements["partner-age"]?.value)
        && filled(form.elements["partner-income"]?.value);
    }
    if (name === "dependants") {
      if (!filled(form.elements["dependant-count"]?.value)) return false;
      const count = dependantCount();
      if (count === 0) return true;
      const ages = [...form.querySelectorAll("[data-dep-age]")];
      return ages.length === count && ages.every((input) => filled(input.value));
    }
    if (name === "retirement") return filled(form.elements["retirement-age"]?.value);
    if (name === "returns") {
      return filled(form.elements["real-return"]?.value)
        && filled(form.elements["retirement-return"]?.value)
        && filled(form.elements["province"]?.value);
    }
    // Optional clusters (debts, coverage, accounts) are complete once the client has reached them
    // and moved on — gated by cursor, not by filled values.
    return true;
  }

  function requiredGate(name) {
    return ["name", "age", "income", "household", "spouse", "dependants", "retirement", "returns"].includes(name);
  }

  function canAdvance(stepName) {
    if (requiredGate(stepName)) return stepComplete(stepName);
    return true;
  }

  function stepControls(step) {
    return [...step.querySelectorAll("input, select, textarea, button")].filter((el) => (
      el.tabIndex !== -1
      && !el.disabled
      && el.type !== "hidden"
      && el.name !== "bot-field"
      && !el.classList.contains("intake-next-arrow")
    ));
  }

  function syncNextArrow() {
    const visible = visibleStepNames();
    const maxIndex = Math.min(cursor, visible.length - 1);
    const frontier = visible[maxIndex];

    form.querySelectorAll(".intake-next-arrow").forEach((btn) => btn.remove());

    if (!frontier || frontier === "submit") return;
    if (maxIndex >= visible.length - 1) return;

    const el = stepEl(frontier);
    if (!el || el.classList.contains("hidden")) return;

    const ready = canAdvance(frontier);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `intake-next-arrow${ready ? "" : " is-waiting"}`;
    button.setAttribute("aria-label", ready ? "Show the next question" : "Answer this question to continue");
    button.disabled = !ready;
    button.innerHTML = `
      <span class="intake-next-arrow-label">${ready ? "Next" : "More below"}</span>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M5 8.5 L11 14.5 L17 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    button.addEventListener("click", () => {
      const next = advanceFrom(frontier);
      if (next) focusStep(next);
    });
    el.append(button);
  }

  function updateVisibility() {
    syncDependantAges();
    const visible = visibleStepNames();
    const maxIndex = Math.min(cursor, visible.length - 1);

    visible.forEach((name, index) => {
      const el = stepEl(name);
      if (!el) return;
      const show = index <= maxIndex;
      el.classList.toggle("hidden", !show);
      el.querySelectorAll("input, select, textarea, button").forEach((control) => {
        if (control.name === "bot-field" || control.classList.contains("intake-next-arrow")) {
          if (control.name === "bot-field") control.tabIndex = -1;
          return;
        }
        if (show) control.removeAttribute("tabindex");
        else control.tabIndex = -1;
      });
    });

    // Hide partner steps entirely when not householded.
    STEP_ORDER.forEach((name) => {
      if (!isPartnerStep(name)) return;
      if (hasPartner()) return;
      const el = stepEl(name);
      if (!el) return;
      el.classList.add("hidden");
      el.querySelectorAll("input, select, textarea, button").forEach((control) => {
        control.tabIndex = -1;
      });
    });

    syncNextArrow();
  }

  function advanceFrom(stepName) {
    const visible = visibleStepNames();
    const index = visible.indexOf(stepName);
    if (index < 0) return null;
    if (!canAdvance(stepName)) return null;
    const nextIndex = index + 1;
    if (nextIndex >= visible.length) return null;
    cursor = Math.max(cursor, nextIndex);
    updateVisibility();
    return visible[nextIndex];
  }

  function firstControl(stepName) {
    const el = stepEl(stepName);
    if (!el || el.classList.contains("hidden")) return null;
    return stepControls(el)[0] || null;
  }

  function selectIfPrefill(control) {
    if (!control || control.tagName !== "INPUT") return;
    if (control.type === "radio" || control.type === "checkbox" || control.type === "hidden") return;
    if (!filled(control.value)) return;
    // Prefill/defaults (returns, retirement age, etc.): highlight so typing replaces.
    try {
      control.select();
    } catch {
      // Some input types do not support select().
    }
  }

  function focusStep(stepName) {
    const control = firstControl(stepName);
    if (!control) return;
    control.focus({ preventScroll: false });
    selectIfPrefill(control);
    control.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function stepFromEventTarget(target) {
    return target?.closest?.(".intake-step")?.dataset?.step || null;
  }

  // Keep honeypot out of the tab order.
  const honeypot = form.querySelector('input[name="bot-field"]');
  if (honeypot) honeypot.tabIndex = -1;

  // Select prefilled values on Tab/keyboard focus, not on mouse click (so click-to-edit still works).
  let pointerFocus = false;
  form.addEventListener("pointerdown", () => { pointerFocus = true; });
  form.addEventListener("focusin", (event) => {
    const stepName = stepFromEventTarget(event.target);
    if (stepName) {
      const visible = visibleStepNames();
      const index = visible.indexOf(stepName);
      if (index >= 0) cursor = Math.max(cursor, index);
      updateVisibility();
    }
    if (!pointerFocus) selectIfPrefill(event.target);
    pointerFocus = false;
  });

  form.addEventListener("input", (event) => {
    const stepName = stepFromEventTarget(event.target);
    if (!stepName) return;

    // Required single-answer steps: unlock the next question as soon as this one has a value.
    if (requiredGate(stepName) && stepComplete(stepName)) {
      const next = advanceFrom(stepName);
      // Don't steal focus while they are still typing in a text field.
      if (next && event.target.type === "radio") focusStep(next);
      else updateVisibility();
      return;
    }

    // Typing in an optional section does not auto-skip ahead; Tab/blur does.
    updateVisibility();
  });

  form.addEventListener("change", (event) => {
    const stepName = stepFromEventTarget(event.target);
    if (!stepName) return;
    if (stepName === "household") {
      // Choosing yes/no always opens the next appropriate block.
      const next = advanceFrom(stepName);
      if (next) focusStep(next);
      else updateVisibility();
      return;
    }
    if (requiredGate(stepName) && stepComplete(stepName)) {
      advanceFrom(stepName);
      updateVisibility();
    }
  });

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const stepName = stepFromEventTarget(event.target);
    if (!stepName) return;

    const step = stepEl(stepName);
    if (!step) return;

    const controls = stepControls(step);
    const last = controls[controls.length - 1];
    const onNextArrow = event.target.classList?.contains("intake-next-arrow");
    if (event.target !== last && !onNextArrow) return;

    // Leaving the last field or the next-arrow: unlock and jump into the next question.
    if (!canAdvance(stepName)) return;

    const next = advanceFrom(stepName);
    if (!next) return;
    const nextControl = firstControl(next);
    if (!nextControl) return;
    event.preventDefault();
    nextControl.focus();
    nextControl.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  form.addEventListener("focusout", (event) => {
    const stepName = stepFromEventTarget(event.target);
    if (!stepName) return;
    // If focus is moving within the same step, do nothing.
    const nextTarget = event.relatedTarget;
    if (nextTarget && stepFromEventTarget(nextTarget) === stepName) return;

    if (requiredGate(stepName) && !stepComplete(stepName)) return;
    advanceFrom(stepName);
  });

  updateVisibility();

  const statusEl = document.getElementById("intake-status");
  const successEl = document.getElementById("intake-success");
  const planLinkEl = document.getElementById("intake-plan-link");
  const planLinkField = document.getElementById("plan-link-field");
  const copyBtn = document.getElementById("intake-copy-link");

  function buildPlanParams() {
    const params = new URLSearchParams();
    params.set("planning-mode", "both");
    params.set("client-name", form.elements["client-name"].value.trim());
    params.set("client-age", form.elements["client-age"].value.trim());
    params.set("personal-income", form.elements["personal-income"].value.trim());

    const partner = hasPartner();
    params.set("has-partner", partner ? "1" : "0");
    if (partner) {
      params.set("partner-name", form.elements["partner-name"].value.trim());
      params.set("partner-age", form.elements["partner-age"].value.trim());
      params.set("partner-income", form.elements["partner-income"].value.trim());
    }

    const count = dependantCount();
    params.set("dependant-count", String(count));
    [...form.querySelectorAll("[data-dep-age]")].forEach((input, index) => {
      if (index < count && filled(input.value)) params.set(`dependant-age-${index}`, input.value.trim());
    });

    const mapIfFilled = (name, key = name) => {
      const el = form.elements[name];
      if (el && filled(el.value)) params.set(key, el.value.trim());
    };

    mapIfFilled("debts");
    mapIfFilled("other-debts");
    mapIfFilled("existing-coverage");
    mapIfFilled("existing-ci");
    mapIfFilled("existing-disability");
    if (partner) {
      mapIfFilled("partner-existing-coverage");
      mapIfFilled("partner-existing-ci");
      mapIfFilled("partner-existing-disability");
    }
    mapIfFilled("retirement-age");
    mapIfFilled("tfsa-balance");
    mapIfFilled("tfsa-room");
    mapIfFilled("rrsp-balance");
    mapIfFilled("rrsp-room");
    mapIfFilled("nonreg-balance");
    if (partner) {
      mapIfFilled("partner-tfsa-balance");
      mapIfFilled("partner-tfsa-room");
      mapIfFilled("partner-rrsp-balance");
      mapIfFilled("partner-rrsp-room");
      mapIfFilled("partner-nonreg-balance");
    }
    mapIfFilled("real-return");
    mapIfFilled("retirement-return");
    mapIfFilled("province");

    const legacyAmount = money(form.elements["legacy-amount"]?.value);
    if (legacyAmount > 0) {
      params.set("leave-legacy", "1");
      params.set("legacy-amount", String(legacyAmount));
    } else {
      params.set("leave-legacy", "0");
    }

    const tfsaMonthly = money(form.elements["tfsa-contribution-p1"]?.value)
      + (partner ? money(form.elements["tfsa-contribution-p2"]?.value) : 0);
    const rrspMonthly = money(form.elements["rrsp-contribution-p1"]?.value)
      + (partner ? money(form.elements["rrsp-contribution-p2"]?.value) : 0);
    const nonregMonthly = money(form.elements["nonreg-contribution-p1"]?.value)
      + (partner ? money(form.elements["nonreg-contribution-p2"]?.value) : 0);
    params.set("tfsa-contribution", String(tfsaMonthly));
    params.set("rrsp-contribution", String(rrspMonthly));
    params.set("nonreg-contribution", String(nonregMonthly));

    return params;
  }

  function planUrl() {
    return `${window.location.origin}/needs-analysis.html?${buildPlanParams().toString()}`;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!filled(form.elements["client-name"]?.value)
      || !filled(form.elements["client-age"]?.value)
      || !filled(form.elements["personal-income"]?.value)
      || !householdChosen()) {
      statusEl.textContent = "Please complete the questions that have appeared so far.";
      statusEl.className = "text-[13.5px] text-red-700";
      return;
    }

    // Make sure the full form is visible for review after submit.
    cursor = visibleStepNames().length - 1;
    updateVisibility();

    const link = planUrl();
    planLinkField.value = link;
    planLinkEl.href = link;

    statusEl.textContent = "Submitting…";
    statusEl.className = "text-[13.5px] text-inksoft";

    try {
      const body = new URLSearchParams(new FormData(form));
      const res = await fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error("Submission failed");
      statusEl.textContent = "Submitted. A copy is on its way to Marchand Wealth.";
      statusEl.className = "text-[13.5px] text-green-700";
      successEl.classList.remove("hidden");
      successEl.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      statusEl.textContent = "Something went wrong submitting this. Please email ethan@marchandwealth.ca, or use the plan link below.";
      statusEl.className = "text-[13.5px] text-red-700";
      successEl.classList.remove("hidden");
    }
  });

  copyBtn?.addEventListener("click", async () => {
    const link = planLinkEl.href;
    try {
      await navigator.clipboard.writeText(link);
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = "Copy plan link"; }, 1600);
    } catch {
      copyBtn.textContent = "Select the link above to copy";
    }
  });
})();
