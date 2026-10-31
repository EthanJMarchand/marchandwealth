(function () {
  "use strict";

  const { PROFILES } = typeof module === "object" && module.exports
    ? require("./investor-profiles.js")
    : window.MarchandInvestorProfiles;

  // Manulife Asset Allocation Portfolios questionnaire bands (8–64 points).
  const MANULIFE_PROFILES = [
    { name: "Conservative", min: 1, max: 8 },
    { name: "Moderate", min: 9, max: 23 },
    { name: "Balanced", min: 24, max: 38 },
    { name: "Growth", min: 39, max: 64 },
  ];

  const EQUITABLE_MAX = 50;
  const MANULIFE_MAX = 64;
  const RISK_COLORS = ["#d9cbb0", "#c1a57b", "#a68a61", "#6c6753", "#30475e", "#232a35"];
  const LOSS = "#a85b4f";
  const GAIN = "#5b7f6a";

  // e = Equitable points, m = Manulife points (null when that carrier does not ask it).
  const opt = (v, label, e, m, extra = {}) => ({ v, label, e, m, ...extra });

  const QUESTIONS = [
    {
      id: "age", field: "age", section: "About you",
      prompt: "How old are you?",
      options: [
        opt("a", "Under 40", 6, null),
        opt("b", "40 to 54", 4, null),
        opt("c", "55 to 64", 2, null),
        opt("d", "65 or older", 0, null),
      ],
    },
    {
      id: "income", field: "annual-income",
      prompt: "What is your total yearly income before tax?",
      hint: "Include all sources: work, business, pension, rental, and investment income.",
      options: [
        opt("a", "Under $30,000", 0, null),
        opt("b", "$30,000 to $59,999", 1, null),
        opt("c", "$60,000 to $99,999", 2, null),
        opt("d", "$100,000 to $149,999", 3, null),
        opt("e", "$150,000 or more", 4, null),
      ],
    },
    {
      id: "networth", field: "net-worth",
      prompt: "Roughly what is your net worth?",
      hint: "Add up what you own (savings, investments, home, vehicles), then subtract what you owe (mortgage, loans, credit cards). A rough estimate is fine.",
      options: [
        opt("a", "Under $50,000", 0, null),
        opt("b", "$50,000 to $99,999", 1, null),
        opt("c", "$100,000 to $249,999", 2, null),
        opt("d", "$250,000 to $499,999", 3, null),
        opt("e", "$500,000 or more", 4, null),
      ],
    },
    {
      id: "finances", field: "savings-and-debt",
      prompt: "Which best describes your savings and debt today?",
      options: [
        opt("a", "No savings, and significant debt", 0, null),
        opt("b", "A little savings, and a fair amount of debt", 1, null),
        opt("c", "Some savings, and some debt", 2, null),
        opt("d", "Some savings, and little or no debt", 3, null),
        opt("e", "Significant savings, and little or no debt", 4, null),
      ],
    },
    {
      id: "knowledge", field: "investment-knowledge",
      prompt: "How would you describe your investment knowledge?",
      options: [
        opt("a", "Limited", 0, null, { detail: "I know little or nothing about investing." }),
        opt("b", "Basic", 2, null, { detail: "I understand the basics, like the difference between stocks and bonds." }),
        opt("c", "Good", 4, null, { detail: "I am familiar with how markets work and the main types of investments." }),
        opt("d", "Advanced", 6, null, { detail: "I understand investment risk and reward in depth, and know many different products." }),
      ],
    },
    {
      id: "horizon", field: "time-horizon", section: "Your goals and timeline",
      prompt: "When do you expect to start withdrawing this money?",
      hint: "Think about the money you plan to invest now.",
      options: [
        opt("a", "Within 3 years", 0, 1, { years: 3 }),
        opt("b", "3 to 5 years", 2, 4, { years: 5 }),
        opt("c", "6 to 10 years", 4, 6, { years: 10 }),
        opt("d", "11 to 15 years", 6, 9, { years: 15 }),
        opt("e", "More than 15 years", 6, 11, { years: 20 }),
      ],
    },
    {
      id: "goal", field: "main-goal",
      prompt: "What is your main goal for this money?",
      options: [
        opt("a", "Keep it available for emergencies or short-term needs", 0, 1),
        opt("b", "Protect it from short-term losses", 1, 1),
        opt("c", "Earn some income and grow it gradually", 2, 5),
        opt("d", "Grow it steadily over the long term", 3, 8),
        opt("e", "Grow it as much as possible over the long term", 4, 11),
      ],
    },
    {
      id: "flexibility", field: "retirement-flexibility",
      prompt: "How firm is your retirement goal?",
      hint: "Think about the income you want in retirement and the date you would like to retire.",
      options: [
        opt("a", "I must reach my goal by my target retirement date.", null, 1),
        opt("b", "I would like to come close to my goal by my target date.", null, 3),
        opt("c", "If I am not there by my target date, I can retire later.", null, 5),
        opt("d", "I review my goals and retirement date regularly, and can adjust them based on how my investments do.", null, 7),
      ],
    },
    {
      id: "attitude", field: "risk-attitude", section: "Your comfort with risk",
      prompt: "Which statement best describes how you feel about investment risk?",
      hint: "Every investment moves up and down in value. Each line shows how bumpy that choice could feel.",
      options: [
        opt("a", "I want my investments to be safe, with little or no risk of going down.", 0, 1, { wave: [0, 2] }),
        opt("b", "I accept small ups and downs for modest growth.", 2, 3, { wave: [2.5, 5] }),
        opt("c", "I accept moderate ups and downs for higher long-term returns.", 4, 5, { wave: [6, 9] }),
        opt("d", "I accept large ups and downs to get the highest long-term returns.", 6, 7, { wave: [11, 13] }),
      ],
    },
    {
      id: "range", field: "one-year-range",
      prompt: "You have $10,000 to invest for one year. Which range of results would you be most comfortable with?",
      hint: "Each bar shows the lowest and highest the investment could be worth after one year. A wider range can earn more, but can also lose more.",
      figure: "range-legend",
      options: [
        opt("a", "Investment 1", 0, 1, { low: 10000, high: 10200 }),
        opt("b", "Investment 2", 1, 1, { low: 9600, high: 10600 }),
        opt("c", "Investment 3", 2, 4, { low: 9200, high: 11000 }),
        opt("d", "Investment 4", 3, 7, { low: 8400, high: 12000 }),
        opt("e", "Investment 5", 4, 7, { low: 7600, high: 13000 }),
      ],
    },
    {
      id: "drop", field: "market-drop",
      prompt: "You invested $100,000 in a well-known fund with a strong track record. After two rough years in the markets, it is now worth $70,000. What would you do?",
      figure: "drop",
      options: [
        opt("a", "Sell everything. I could not risk losing more.", 0, 1),
        opt("b", "Sell some, to protect what is left.", 2, 3),
        opt("c", "Hold. Markets go up and down, and I would review it again in a year.", 4, 5),
        opt("d", "Buy more while prices are lower.", 6, 7),
      ],
    },
    {
      id: "morerisk", field: "more-risk",
      prompt: "If taking more risk could improve your returns, what would you do?",
      options: [
        opt("a", "Probably not take more risk", null, 1),
        opt("b", "Take a little more risk with part of my investments", null, 3),
        opt("c", "Take a lot more risk with part of my investments", null, 5),
        opt("d", "Take a lot more risk with all of my investments", null, 7),
      ],
    },
    {
      id: "behind", field: "behind-schedule",
      prompt: "A few years into your retirement plan, you find you are behind schedule to retire when you want. What would you do?",
      options: [
        opt("a", "Keep my current investments, and save as much more as I can.", null, 1),
        opt("b", "Take slightly more risk, and save a little more.", null, 4),
        opt("c", "Move everything into higher-risk investments to aim for the highest long-term return.", null, 7),
      ],
    },
  ];

  const money = (n) => `$${n.toLocaleString("en-CA")}`;

  function optionFor(question, value) {
    return question.options.find((o) => o.v === value) || null;
  }

  function answerText(question, option) {
    if (!option) return "";
    if (option.low !== undefined) return `${option.label}: ${money(option.low)} to ${money(option.high)} after one year`;
    return option.detail ? `${option.label}: ${option.detail}` : option.label;
  }

  function pointsText(option) {
    const parts = [];
    if (option.e !== null) parts.push(`Equitable ${option.e}`);
    if (option.m !== null) parts.push(`Manulife ${option.m}`);
    return parts.length ? parts.join(" · ") : "Not scored";
  }

  function scoreAnswers(answers) {
    let equitable = 0;
    let manulife = 0;
    QUESTIONS.forEach((q) => {
      const o = optionFor(q, answers[q.id]);
      if (!o) return;
      equitable += o.e || 0;
      manulife += o.m || 0;
    });
    const profile = PROFILES.find((p) => equitable <= p.max) || PROFILES[PROFILES.length - 1];
    const manulifeProfile = MANULIFE_PROFILES.find((p) => manulife <= p.max) || MANULIFE_PROFILES[MANULIFE_PROFILES.length - 1];
    return { equitable, manulife, profile, manulifeProfile };
  }

  function formatDate(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return "";
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  }

  function todayIso() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  /* ---------- PDF ---------- */

  const PDF = {
    navydeep: [35, 42, 53], gold: [193, 165, 123], golddim: [166, 138, 97], goldlight: [233, 223, 204],
    ink: [28, 33, 41], inksoft: [86, 95, 108], line: [221, 215, 202], paper: [247, 244, 239], track: [236, 230, 218],
    mutedDark: [196, 196, 196], mutedLight: [230, 230, 230], mutedText: [168, 168, 168], white: [255, 255, 255],
  };

  const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  // Standard PDF fonts only cover Latin-1, so typographic punctuation is flattened.
  const pdfSafe = (s) => String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...");

  function buildPdf(JsPDF, report, logoDataUrl) {
    const doc = new JsPDF({ unit: "pt", format: "letter" });
    const W = 612;
    const H = 792;
    const M = 54;
    const CW = W - M * 2;
    const BOTTOM = H - 64;
    const { result } = report;
    const profile = result.profile;
    let y = 0;

    const font = (family, style, size, color) => {
      doc.setFont(family, style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    };
    const text = (str, x, yy, opts) => doc.text(Array.isArray(str) ? str : pdfSafe(str), x, yy, opts);
    const wrap = (str, width) => doc.splitTextToSize(pdfSafe(str), width);

    function ring(cx, cy, r0, r1, a0, a1, color) {
      if (a1 - a0 <= 0) return;
      const steps = Math.max(2, Math.ceil((a1 - a0) / 3));
      const pts = [];
      const at = (r, a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
      };
      for (let i = 0; i <= steps; i += 1) pts.push(at(r1, a0 + ((a1 - a0) * i) / steps));
      for (let i = steps; i >= 0; i -= 1) pts.push(at(r0, a0 + ((a1 - a0) * i) / steps));
      const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
      doc.setFillColor(...color);
      doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
    }

    function donut(cx, cy, r0, r1, equity, equityColor, fixedColor) {
      const split = (equity / 100) * 360;
      ring(cx, cy, r0, r1, 0, split, equityColor);
      ring(cx, cy, r0, r1, split, 360, fixedColor);
    }

    function header() {
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", M, 38, 100, 23);
      } else {
        font("times", "bold", 16, PDF.navydeep);
        text("Marchand Wealth", M, 56);
      }
      const kicker = "INVESTOR PROFILE QUESTIONNAIRE";
      font("helvetica", "bold", 7.5, PDF.golddim);
      const kickerWidth = doc.getTextWidth(kicker) + 0.9 * (kicker.length - 1);
      doc.text(kicker, W - M - kickerWidth, 48, { charSpace: 0.9 });
      font("helvetica", "normal", 8.5, PDF.inksoft);
      text(`${report.name}  ·  ${formatDate(report.date)}`, W - M, 60, { align: "right" });
      doc.setDrawColor(...PDF.gold);
      doc.setLineWidth(1.2);
      doc.line(M, 72, W - M, 72);
      y = 100;
    }

    function ensure(space) {
      if (y + space <= BOTTOM) return;
      doc.addPage();
      header();
    }

    function eyebrow(str, x, yy, color = PDF.golddim) {
      font("helvetica", "bold", 7.5, color);
      doc.text(pdfSafe(str.toUpperCase()), x, yy, { charSpace: 0.9 });
    }

    function heading(str) {
      ensure(40);
      font("times", "bold", 15, PDF.navydeep);
      text(str, M, y);
      y += 18;
    }

    /* Page 1: result */
    header();
    font("times", "bold", 26, PDF.navydeep);
    text("Your investor profile", M, y);
    y += 20;
    font("helvetica", "normal", 10.5, PDF.inksoft);
    text(`Prepared for ${report.name}. Completed ${formatDate(report.date)}.`, M, y);
    y += 22;

    const panelH = 168;
    doc.setFillColor(...PDF.paper);
    doc.setDrawColor(...PDF.gold);
    doc.setLineWidth(1);
    doc.rect(M, y, CW, panelH, "FD");
    const px = M + 22;
    eyebrow("Your profile", px, y + 26);
    font("times", "bold", 26, PDF.navydeep);
    text(profile.name, px, y + 54);
    font("helvetica", "normal", 10, PDF.inksoft);
    text(`Risk level ${profile.level} of 6   ·   Score ${result.equitable} of ${EQUITABLE_MAX}`, px, y + 72);
    for (let i = 0; i < 6; i += 1) {
      doc.setFillColor(...(i < profile.level ? hexRgb(RISK_COLORS[i]) : PDF.track));
      doc.rect(px + i * 36, y + 82, 32, 6, "F");
    }
    eyebrow("Recommended portfolio", px, y + 112);
    font("helvetica", "bold", 13, PDF.navydeep);
    text(`${profile.equity}% equity  ·  ${profile.fixed}% fixed income`, px, y + 129);
    font("helvetica", "normal", 9.5, PDF.inksoft);
    text(wrap(profile.summary, CW - 190), px, y + 146);

    const dcx = M + CW - 82;
    const dcy = y + panelH / 2;
    donut(dcx, dcy, 36, 56, profile.equity, PDF.navydeep, PDF.gold);
    font("helvetica", "bold", 15, PDF.navydeep);
    text(`${profile.equity}%`, dcx, dcy + 2, { align: "center" });
    font("helvetica", "normal", 7, PDF.inksoft);
    text("equity", dcx, dcy + 12, { align: "center" });
    y += panelH + 16;

    const legend = [[PDF.navydeep, "Equity: stocks and equity funds"], [PDF.gold, "Fixed income: bonds, GICs, and guaranteed accounts"]];
    let lx = M;
    legend.forEach(([color, label]) => {
      doc.setFillColor(...color);
      doc.rect(lx, y - 6.5, 8, 8, "F");
      font("helvetica", "normal", 8.5, PDF.inksoft);
      text(label, lx + 13, y);
      lx += doc.getTextWidth(label) + 34;
    });
    y += 30;

    heading("What this profile means");
    profile.points.forEach((point) => {
      const lines = wrap(point, CW - 16);
      ensure(lines.length * 13 + 6);
      doc.setFillColor(...PDF.gold);
      doc.rect(M + 1, y - 5.5, 4, 4, "F");
      font("helvetica", "normal", 10, PDF.ink);
      text(lines, M + 14, y, { lineHeightFactor: 1.35 });
      y += lines.length * 13.5 + 5;
    });
    y += 16;

    heading("All six investor profiles");
    font("helvetica", "normal", 9, PDF.inksoft);
    text("Your profile is shown in colour. The others are shown in grey for comparison.", M, y);
    y += 16;
    const gap = 8;
    const colW = (CW - gap * 5) / 6;
    const cardH = 150;
    ensure(cardH + 10);
    PROFILES.forEach((p, i) => {
      const active = p === profile;
      const cx = M + i * (colW + gap);
      doc.setFillColor(...PDF.white);
      doc.setDrawColor(...(active ? PDF.gold : PDF.mutedLight));
      doc.setLineWidth(active ? 1.6 : 0.8);
      doc.rect(cx, y, colW, cardH, "FD");
      const mid = cx + colW / 2;
      font("helvetica", "bold", 6.5, active ? PDF.golddim : PDF.mutedText);
      text(`RISK LEVEL ${p.level}`, mid, y + 16, { align: "center" });
      font("times", "bold", 10.5, active ? PDF.navydeep : PDF.mutedText);
      const nameLines = wrap(p.name, colW - 10);
      text(nameLines, mid, y + (nameLines.length > 1 ? 30 : 35), { align: "center", lineHeightFactor: 1.1 });
      donut(mid, y + 78, 15, 25, p.equity, active ? PDF.navydeep : PDF.mutedDark, active ? PDF.gold : PDF.mutedLight);
      font("helvetica", "normal", 7.5, active ? PDF.inksoft : PDF.mutedText);
      text(`${p.equity}% equity`, mid, y + 120, { align: "center" });
      text(`${p.fixed}% fixed income`, mid, y + 130, { align: "center" });
      font("helvetica", "normal", 6.5, active ? PDF.golddim : PDF.mutedText);
      text(`${p.min}-${p.max} points`, mid, y + 142, { align: "center" });
    });
    y += cardH;

    /* Answers */
    doc.addPage();
    header();
    font("times", "bold", 22, PDF.navydeep);
    text("Your answers", M, y);
    y += 24;

    QUESTIONS.forEach((q, index) => {
      const o = optionFor(q, report.answers[q.id]);
      font("helvetica", "bold", 9.5, PDF.navydeep);
      const qLines = wrap(`${index + 1}. ${q.prompt}`, CW);
      font("helvetica", "normal", 9.5, PDF.ink);
      const aLines = wrap(answerText(q, o) || "Not answered", CW - 12);
      const blockH = (q.section ? 22 : 0) + qLines.length * 12.5 + aLines.length * 12.5 + 18;
      ensure(blockH);
      if (q.section) {
        y += 4;
        eyebrow(q.section, M, y, PDF.golddim);
        y += 16;
      }
      font("helvetica", "bold", 9.5, PDF.navydeep);
      text(qLines, M, y, { lineHeightFactor: 1.3 });
      y += qLines.length * 12.5 + 1;
      doc.setFillColor(...PDF.gold);
      doc.rect(M + 1, y - 6.5, 2, aLines.length * 12.5 - 1, "F");
      font("helvetica", "normal", 9.5, PDF.ink);
      text(aLines, M + 12, y, { lineHeightFactor: 1.3 });
      y += aLines.length * 12.5 + 4;
      doc.setDrawColor(...PDF.line);
      doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y);
      y += 14;
    });

    y += 8;
    heading("Summary");
    ensure(48);
    font("helvetica", "bold", 7.5, PDF.golddim);
    text("SCORE", M, y);
    text("INVESTOR PROFILE", M + 110, y);
    text("RECOMMENDED PORTFOLIO", M + 300, y);
    y += 8;
    doc.setDrawColor(...PDF.line);
    doc.line(M, y, W - M, y);
    y += 15;
    font("helvetica", "bold", 9.5, PDF.navydeep);
    text(`${result.equitable} of ${EQUITABLE_MAX}`, M, y);
    font("helvetica", "normal", 9.5, PDF.ink);
    text(`${profile.name} (risk level ${profile.level} of 6)`, M + 110, y);
    text(`${profile.equity}% equity, ${profile.fixed}% fixed income`, M + 300, y);
    y += 7;
    doc.setDrawColor(...PDF.line);
    doc.line(M, y, W - M, y);
    y += 30;

    ensure(130);
    heading("Acknowledgement");
    font("helvetica", "normal", 9.5, PDF.inksoft);
    const ack = wrap("I confirm these answers reflect my current financial situation, goals, and comfort with investment risk. I will tell my advisor if my circumstances change.", CW);
    text(ack, M, y, { lineHeightFactor: 1.35 });
    y += ack.length * 13 + 34;
    const sig = (label, x, width) => {
      doc.setDrawColor(...PDF.inksoft);
      doc.setLineWidth(0.6);
      doc.line(x, y, x + width, y);
      font("helvetica", "normal", 7.5, PDF.inksoft);
      text(label, x, y + 11);
    };
    sig("Client signature", M, 300);
    sig("Date", M + 330, CW - 330);
    y += 40;
    sig("Advisor signature: Ethan Marchand", M, 300);
    sig("Date", M + 330, CW - 330);
    y += 34;

    const disclaimer = wrap("This questionnaire is a guide to help select investments that suit your goals and comfort with risk. It is not a recommendation to buy or sell a particular security. Any amount allocated to a segregated fund is invested at the risk of the contract holder and may increase or decrease in value. Past performance does not guarantee future results. Review your investor profile with your advisor whenever your circumstances change.", CW);
    ensure(disclaimer.length * 10 + 4);
    font("helvetica", "normal", 7, PDF.inksoft);
    text(disclaimer, M, y, { lineHeightFactor: 1.35 });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      doc.setDrawColor(...PDF.line);
      doc.setLineWidth(0.5);
      doc.line(M, H - 40, W - M, H - 40);
      font("helvetica", "normal", 7.5, PDF.inksoft);
      text("Marchand Financial Solutions Inc.  ·  marchandwealth.ca  ·  ethan@marchandwealth.ca  ·  780-868-0552", M, H - 27);
      text(`Page ${i} of ${pages}`, W - M, H - 27, { align: "right" });
    }
    return doc;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { QUESTIONS, PROFILES, MANULIFE_PROFILES, scoreAnswers, buildPdf };
  }
  if (typeof document === "undefined") return;

  /* ---------- Illustrations ---------- */

  function waveSvg([amp, drift]) {
    let d = "";
    for (let i = 0; i <= 48; i += 1) {
      const t = i / 48;
      const x = 4 + t * 152;
      const y = 27 - drift * t - amp * (0.62 * Math.sin(t * 11) + 0.38 * Math.sin(t * 27 + 0.8));
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return `<svg viewBox="0 0 160 44" class="h-10 w-24 sm:w-32 shrink-0" aria-hidden="true">
      <line x1="4" x2="156" y1="27" y2="27" stroke="#ddd7ca" stroke-dasharray="3 3"/>
      <path d="${d}" fill="none" stroke="#232a35" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  function rangeSvg(low, high) {
    const min = 7000;
    const max = 13000;
    const x = (v) => 6 + ((v - min) / (max - min)) * 288;
    const loss = low < 10000
      ? `<rect x="${x(low).toFixed(1)}" y="5" width="${(x(10000) - x(low)).toFixed(1)}" height="12" fill="${LOSS}"/>`
      : "";
    return `<svg viewBox="0 0 300 22" class="mt-3 block h-auto w-full max-w-sm" aria-hidden="true">
      <line x1="${x(min)}" x2="${x(max)}" y1="11" y2="11" stroke="#ece6da" stroke-width="2"/>
      ${loss}
      <rect x="${x(10000).toFixed(1)}" y="5" width="${(x(high) - x(10000)).toFixed(1)}" height="12" fill="${GAIN}"/>
      <line x1="${x(10000).toFixed(1)}" x2="${x(10000).toFixed(1)}" y1="1" y2="21" stroke="#232a35" stroke-width="1.5"/>
    </svg>`;
  }

  function horizonBar(years) {
    return `<span class="mt-2.5 block h-1.5 w-full max-w-xs bg-[#ece6da]" aria-hidden="true">
      <span class="block h-full bg-gold" style="width:${Math.round((years / 20) * 100)}%"></span>
    </span>`;
  }

  function rangeLegend() {
    const swatch = (color) => `<span class="inline-block h-2.5 w-2.5" style="background:${color}"></span>`;
    return `<div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-inksoft">
      <span class="inline-flex items-center gap-2">${swatch(LOSS)} Possible loss</span>
      <span class="inline-flex items-center gap-2">${swatch(GAIN)} Possible gain</span>
      <span class="inline-flex items-center gap-2"><span class="inline-block h-3.5 w-[2px] bg-navydeep"></span> Your $10,000</span>
    </div>`;
  }

  function dropFigure() {
    const W = 520;
    const H = 200;
    const left = 14;
    const right = 112;
    const top = 18;
    const bottom = 34;
    const xs = (t) => left + t * (W - left - right);
    const ys = (v) => top + ((108 - v) / (108 - 64)) * (H - top - bottom);
    const pts = [[0, 100], [0.07, 103], [0.14, 98], [0.2, 101], [0.27, 93], [0.34, 96], [0.41, 88], [0.48, 91], [0.55, 83], [0.62, 86], [0.7, 77], [0.77, 80], [0.85, 72], [0.92, 74], [1, 70]];
    const line = pts.map(([t, v], i) => `${i ? "L" : "M"}${xs(t).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");
    const area = `${line} L${xs(1).toFixed(1)} ${ys(64).toFixed(1)} L${xs(0).toFixed(1)} ${ys(64).toFixed(1)} Z`;
    const endX = xs(1);
    return `<figure class="mt-5 border border-line bg-white px-3 pt-4 pb-2 sm:px-5">
      <svg viewBox="0 0 ${W} ${H}" class="block h-auto w-full" role="img" aria-label="An investment of $100,000 falls to $70,000 over two years, a 30 percent drop.">
        <defs>
          <linearGradient id="iq-drop-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#c1a57b" stop-opacity="0.3"/>
            <stop offset="1" stop-color="#c1a57b" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="${xs(0)}" x2="${endX}" y1="${ys(100)}" y2="${ys(100)}" stroke="#a68a61" stroke-dasharray="4 4"/>
        <path d="${area}" fill="url(#iq-drop-fill)"/>
        <path d="${line}" fill="none" stroke="#232a35" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
        <line x1="${endX}" x2="${endX}" y1="${ys(100)}" y2="${ys(70)}" stroke="${LOSS}" stroke-width="1.5" stroke-dasharray="2 3"/>
        <circle cx="${xs(0)}" cy="${ys(100)}" r="4.5" fill="#232a35"/>
        <circle cx="${endX}" cy="${ys(70)}" r="5.5" fill="${LOSS}"/>
        <text x="${endX + 12}" y="${ys(100) + 4}" font-size="13" fill="#565f6c">$100,000</text>
        <text x="${endX + 12}" y="${ys(70) - 2}" font-size="15" font-weight="600" fill="#232a35">$70,000</text>
        <text x="${endX + 12}" y="${ys(70) + 16}" font-size="13" font-weight="600" fill="${LOSS}">−30%</text>
        <text x="${xs(0)}" y="${H - 8}" font-size="12" fill="#565f6c">Invested</text>
        <text x="${xs(0.5)}" y="${H - 8}" font-size="12" fill="#565f6c" text-anchor="middle">1 year</text>
        <text x="${endX}" y="${H - 8}" font-size="12" fill="#565f6c" text-anchor="middle">2 years</text>
      </svg>
    </figure>`;
  }

  function donutSvg(equity, size) {
    const arc = equity >= 100
      ? `<circle cx="21" cy="21" r="15.915" fill="none" stroke="#232a35" stroke-width="6"/>`
      : equity > 0
        ? `<circle cx="21" cy="21" r="15.915" fill="none" stroke="#232a35" stroke-width="6" stroke-dasharray="${equity} ${100 - equity}" stroke-dashoffset="25"/>`
        : "";
    return `<svg viewBox="0 0 42 42" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="21" cy="21" r="15.915" fill="none" stroke="#c1a57b" stroke-width="6"/>
      ${arc}
    </svg>`;
  }

  /* ---------- Markup ---------- */

  function optionHtml(q, o) {
    let body = `<span class="block text-[15px] leading-6 text-ink">${o.label}</span>`;
    if (o.detail) body += `<span class="mt-0.5 block text-sm leading-6 text-inksoft">${o.detail}</span>`;
    if (o.low !== undefined) {
      body += `<span class="mt-0.5 block text-sm text-inksoft">Worst case <strong class="font-semibold text-navydeep">${money(o.low)}</strong> · Best case <strong class="font-semibold text-navydeep">${money(o.high)}</strong></span>`;
      body += rangeSvg(o.low, o.high);
    }
    if (o.years) body += horizonBar(o.years);
    const content = o.wave
      ? `<span class="flex min-w-0 flex-1 items-center justify-between gap-4"><span class="min-w-0">${body}</span>${waveSvg(o.wave)}</span>`
      : `<span class="min-w-0 flex-1">${body}</span>`;
    return `<label class="iq-option flex items-start gap-3 border border-line bg-white/90 px-4 py-3.5 cursor-pointer hover:border-gold transition">
      <input type="radio" name="${q.id}" value="${o.v}" class="mt-1 shrink-0">
      ${content}
    </label>`;
  }

  function questionHtml(q, index) {
    const section = q.section
      ? `<p class="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-olive"><span>${q.section}</span><span class="h-px flex-1 bg-line"></span></p>`
      : "";
    let figure = "";
    if (q.figure === "drop") figure = dropFigure();
    if (q.figure === "range-legend") figure = rangeLegend();
    return `<div class="iq-step hidden scroll-mt-24" data-step="${q.id}">
      ${section}
      <fieldset>
        <legend class="w-full">
          <span class="block text-[11.5px] font-semibold uppercase tracking-[0.14em] text-golddim">Question ${index + 1} of ${QUESTIONS.length}</span>
          <span class="mt-2 block font-serif text-[21px] md:text-2xl leading-snug text-navydeep">${q.prompt}</span>
          ${q.hint ? `<span class="mt-2 block text-sm leading-6 text-inksoft">${q.hint}</span>` : ""}
        </legend>
        ${figure}
        <div class="mt-4 grid gap-2.5">${q.options.map((o) => optionHtml(q, o)).join("")}</div>
      </fieldset>
    </div>`;
  }

  function profileCardHtml(p, active) {
    const badge = active
      ? `<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-navydeep">Your profile</span>`
      : "";
    return `<div class="iq-profile ${active ? "is-active" : "is-muted"} relative flex flex-col items-center border border-line bg-white px-3 pt-5 pb-4 text-center"${active ? ' aria-current="true"' : ""}>
      ${badge}
      <span class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-golddim">Risk level ${p.level}</span>
      <span class="mt-1 flex min-h-[2.6em] items-center font-serif text-[17px] leading-tight text-navydeep">${p.name}</span>
      <span class="mt-2">${donutSvg(p.equity, 68)}</span>
      <span class="mt-2 text-[12.5px] leading-5 text-inksoft">${p.equity}% equity<br>${p.fixed}% fixed income</span>
      <span class="mt-1 text-[11px] text-golddim">${p.min}–${p.max} points</span>
    </div>`;
  }

  /* ---------- Page ---------- */

  const form = document.getElementById("iq-form");
  if (!form) return;

  document.getElementById("iq-questions").innerHTML = QUESTIONS.map(questionHtml).join("");

  const STEPS = ["name", ...QUESTIONS.map((q) => q.id), "results"];
  const nameInput = form.elements["client-name"];
  const nextStepCard = document.getElementById("iq-next-step");
  const intakeLink = document.getElementById("iq-intake-link");
  const submitStep = document.getElementById("iq-submit-step");
  const submitBtn = document.getElementById("iq-submit");
  const statusEl = document.getElementById("iq-status");
  const doneEl = document.getElementById("iq-done");
  const downloadBtn = document.getElementById("iq-download");
  const downloadStatus = document.getElementById("iq-download-status");
  const reviewBanner = document.getElementById("iq-review-banner");

  let cursor = 0;
  let completedDate = todayIso();
  let reviewMode = false;
  let pointerAnswer = false;

  const stepEl = (name) => form.querySelector(`[data-step="${name}"]`);
  const nameReady = () => nameInput.value.trim() !== "";

  function answers() {
    const out = {};
    QUESTIONS.forEach((q) => {
      const checked = form.querySelector(`input[name="${q.id}"]:checked`);
      if (checked) out[q.id] = checked.value;
    });
    return out;
  }

  const allAnswered = (a) => QUESTIONS.every((q) => a[q.id]);

  function stepDone(name, a) {
    if (name === "name") return nameReady();
    if (name === "results") return true;
    return Boolean(a[name]);
  }

  function renderResults(a) {
    const r = scoreAnswers(a);
    const p = r.profile;
    document.getElementById("iq-profile-name").textContent = p.name;
    document.getElementById("iq-profile-summary").textContent = p.summary;
    document.getElementById("iq-profile-level").textContent = `Risk level ${p.level} of 6`;
    document.getElementById("iq-profile-score").textContent = `Score ${r.equitable} of ${EQUITABLE_MAX}`;
    document.getElementById("iq-profile-mix").textContent = `${p.equity}% equity · ${p.fixed}% fixed income`;
    document.getElementById("iq-profile-donut").innerHTML = donutSvg(p.equity, 112);
    document.getElementById("iq-profile-donut-label").textContent = `${p.equity}%`;
    document.getElementById("iq-risk-meter").innerHTML = RISK_COLORS.map((color, i) => (
      `<span class="h-1.5 flex-1" style="background:${i < p.level ? color : "#ece6da"}"></span>`
    )).join("");
    const points = document.getElementById("iq-profile-points");
    points.replaceChildren(...p.points.map((point) => {
      const li = document.createElement("li");
      li.className = "flex gap-3";
      li.innerHTML = '<span class="mt-[9px] h-1.5 w-1.5 shrink-0 bg-gold" aria-hidden="true"></span>';
      li.append(document.createTextNode(point));
      return li;
    }));
    document.getElementById("iq-profile-grid").innerHTML = PROFILES.map((x) => profileCardHtml(x, x === p)).join("");
  }

  function render() {
    const a = answers();
    STEPS.forEach((name, i) => stepEl(name)?.classList.toggle("hidden", i > cursor));
    const complete = nameReady() && allAnswered(a);
    if (complete) renderResults(a);
    const finished = complete && cursor >= STEPS.length - 1;
    submitStep.classList.toggle("hidden", !finished);
    nextStepCard.classList.toggle("hidden", !finished);
    if (finished) intakeLink.href = intakeUrl(a);
    syncNextArrow(a);
  }

  function syncNextArrow(a) {
    form.querySelectorAll(".intake-next-arrow").forEach((btn) => btn.remove());
    const frontier = STEPS[cursor];
    if (!frontier || cursor >= STEPS.length - 1) return;
    const el = stepEl(frontier);
    if (!el) return;

    const ready = stepDone(frontier, a);
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
      if (advance(frontier)) scrollToStep(STEPS[cursor]);
    });
    el.append(button);
  }

  function scrollToStep(name) {
    const el = stepEl(name);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function advance(fromName) {
    const index = STEPS.indexOf(fromName);
    if (index !== cursor || !stepDone(fromName, answers())) {
      render();
      return false;
    }
    cursor = Math.min(STEPS.length - 1, index + 1);
    render();
    return true;
  }

  form.addEventListener("pointerdown", () => { pointerAnswer = true; });
  form.addEventListener("keydown", (event) => {
    pointerAnswer = false;
    if (event.target !== nameInput) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (advance("name")) scrollToStep(STEPS[cursor]);
    } else if (event.key === "Tab" && !event.shiftKey) {
      advance("name");
    }
  });

  nameInput.addEventListener("input", render);

  form.addEventListener("change", (event) => {
    if (event.target.type !== "radio") return;
    const step = event.target.closest("[data-step]")?.dataset.step;
    const fromPointer = pointerAnswer;
    pointerAnswer = false;
    if (advance(step) && fromPointer) {
      setTimeout(() => scrollToStep(STEPS[cursor]), 260);
    }
  });

  /* Link, submission, and PDF */

  function reviewUrl(a) {
    const params = new URLSearchParams();
    params.set("name", nameInput.value.trim());
    params.set("date", completedDate);
    QUESTIONS.forEach((q) => { if (a[q.id]) params.set(q.id, a[q.id]); });
    return `${window.location.origin}/investor-questionnaire.html?${params.toString()}`;
  }

  function intakeUrl(a) {
    const params = new URLSearchParams();
    params.set("client-name", nameInput.value.trim());
    params.set("investor-profile", scoreAnswers(a).profile.key);
    params.set("iq-link", reviewUrl(a));
    return `/client-intake.html?${params.toString()}`;
  }

  function submissionBody(a, link) {
    const r = scoreAnswers(a);
    const body = new URLSearchParams();
    body.set("form-name", "investor-questionnaire");
    body.set("bot-field", form.elements["bot-field"]?.value || "");
    body.set("client-name", nameInput.value.trim());
    body.set("risk-profile", `${r.profile.name} (risk level ${r.profile.level} of 6)`);
    body.set("recommended-portfolio", `${r.profile.equity}% equity / ${r.profile.fixed}% fixed income`);
    body.set("iq-link", link);
    body.set("completed-date", formatDate(completedDate));
    QUESTIONS.forEach((q) => {
      const o = optionFor(q, a[q.id]);
      body.set(q.field, o ? `${answerText(q, o)} [${pointsText(o)}]` : "");
    });
    body.set("equitable-score", `${r.equitable} of ${EQUITABLE_MAX} (${r.profile.name})`);
    body.set("manulife-score", `${r.manulife} of ${MANULIFE_MAX} (${r.manulifeProfile.name})`);
    return body;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const a = answers();
    if (!nameReady() || !allAnswered(a)) {
      statusEl.textContent = "Please answer every question before submitting.";
      statusEl.className = "text-[13.5px] text-red-700";
      return;
    }
    statusEl.textContent = "Submitting…";
    statusEl.className = "text-[13.5px] text-inksoft";
    submitBtn.disabled = true;
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: submissionBody(a, reviewUrl(a)).toString(),
      });
      if (!res.ok) throw new Error("Submission failed");
      statusEl.textContent = "Submitted. Your answers were sent securely to Marchand Wealth.";
      statusEl.className = "text-[13.5px] text-green-700";
      submitBtn.textContent = "Submit again";
    } catch {
      statusEl.textContent = "Your answers could not be sent automatically. Please download the PDF below and email it to ethan@marchandwealth.ca.";
      statusEl.className = "text-[13.5px] text-red-700";
    } finally {
      submitBtn.disabled = false;
    }
    doneEl.classList.remove("hidden");
    doneEl.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const copyBtn = document.getElementById("iq-copy-link");
  const copyLabel = document.getElementById("iq-copy-label");
  let copyReset = null;
  copyBtn.addEventListener("click", async () => {
    const a = answers();
    if (!nameReady() || !allAnswered(a)) return;
    const link = reviewUrl(a);
    clearTimeout(copyReset);
    try {
      await navigator.clipboard.writeText(link);
      copyLabel.textContent = "Link copied";
    } catch {
      window.prompt("Copy this link to your answers:", link);
    }
    copyReset = setTimeout(() => { copyLabel.textContent = "Copy link to answers"; }, 1800);
  });

  let jsPdfLoading = null;
  function loadJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jsPdfLoading) {
      jsPdfLoading = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/assets/vendor/jspdf.umd.min.js";
        script.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF missing")));
        script.onerror = () => {
          jsPdfLoading = null;
          reject(new Error("jsPDF failed to load"));
        };
        document.head.append(script);
      });
    }
    return jsPdfLoading;
  }

  async function loadLogo() {
    try {
      const res = await fetch("/assets/logo.png");
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  downloadBtn.addEventListener("click", async () => {
    const a = answers();
    if (!nameReady() || !allAnswered(a)) return;
    const label = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Preparing PDF…";
    downloadStatus.textContent = "";
    try {
      const [JsPDF, logo] = await Promise.all([loadJsPdf(), loadLogo()]);
      const name = nameInput.value.trim();
      const doc = buildPdf(JsPDF, { name, date: completedDate, answers: a, result: scoreAnswers(a) }, logo);
      const safeName = name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "Client";
      doc.save(`${completedDate}-Investor-Questionnaire-${safeName}.pdf`);
    } catch {
      downloadStatus.textContent = "The PDF could not be created. Please try again.";
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = label;
    }
  });

  /* Opened from a submitted link: restore every answer. */
  const params = new URLSearchParams(window.location.search);
  if (params.has("name") || QUESTIONS.some((q) => params.has(q.id))) {
    nameInput.value = params.get("name") || "";
    QUESTIONS.forEach((q) => {
      const v = params.get(q.id);
      if (!v || !optionFor(q, v)) return;
      form.querySelector(`input[name="${q.id}"][value="${v}"]`).checked = true;
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "")) completedDate = params.get("date");
    const a = answers();
    const firstOpen = STEPS.findIndex((name) => !stepDone(name, a));
    cursor = firstOpen === -1 ? STEPS.length - 1 : firstOpen;
    reviewMode = firstOpen === -1;
  }

  if (reviewMode) {
    reviewBanner.classList.remove("hidden");
    document.getElementById("iq-review-text").textContent = `Answers from ${nameInput.value.trim()}, completed ${formatDate(completedDate)}.`;
    submitBtn.classList.add("hidden");
    doneEl.classList.remove("hidden");
    document.getElementById("iq-done-text").textContent = "These answers were loaded from a submitted link. Download the PDF for your records.";
  }

  render();
})();
