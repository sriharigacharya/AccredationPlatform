/* =====================================================
   AcademiQ — Chart.js Initializers
   All chart configurations for every page
   ===================================================== */

const AQ_COLORS = {
  gold:    "#C9A36A",
  orange:  "#A85B2C",
  success: "#56B87A",
  warning: "#E8A44A",
  danger:  "#E05555",
  info:    "#5B9BD5",
  ivory:   "rgba(250,247,242,0.85)",
  muted:   "rgba(250,247,242,0.25)",
  border:  "rgba(201,163,106,0.14)",
  grid:    "rgba(255,255,255,0.06)"
};

Chart.defaults.color         = "rgba(250,247,242,0.45)";
Chart.defaults.font.family   = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size     = 11;
Chart.defaults.borderColor   = AQ_COLORS.grid;

function makeGradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0,   color.replace(")", ",0.35)").replace("rgb","rgba"));
  g.addColorStop(1,   color.replace(")", ",0.02)").replace("rgb","rgba"));
  return g;
}

// ── Dashboard: Student Performance Chart ────────────
function initPerformanceChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  const gGold = { createLinearGradient: (...a) => ctx.createLinearGradient(...a) };
  const grad1 = ctx.createLinearGradient(0,0,0,260);
  grad1.addColorStop(0, "rgba(201,163,106,0.35)");
  grad1.addColorStop(1, "rgba(201,163,106,0.02)");
  const grad2 = ctx.createLinearGradient(0,0,0,260);
  grad2.addColorStop(0, "rgba(86,184,122,0.25)");
  grad2.addColorStop(1, "rgba(86,184,122,0.02)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
      datasets: [
        {
          label: "Average Score",
          data: [71, 74, 70, 78, 76, 82, 79, 85],
          borderColor: AQ_COLORS.gold,
          backgroundColor: grad1,
          borderWidth: 2, pointRadius: 4,
          pointBackgroundColor: AQ_COLORS.gold,
          pointBorderColor: "#1C1814",
          pointBorderWidth: 2,
          tension: 0.42, fill: true
        },
        {
          label: "Pass Rate (%)",
          data: [82, 85, 79, 87, 84, 91, 88, 93],
          borderColor: AQ_COLORS.success,
          backgroundColor: grad2,
          borderWidth: 2, pointRadius: 4,
          pointBackgroundColor: AQ_COLORS.success,
          pointBorderColor: "#1C1814",
          pointBorderWidth: 2,
          tension: 0.42, fill: true
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { boxWidth: 10, padding: 16, color: AQ_COLORS.ivory } }, tooltip: { mode: "index", intersect: false, backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 } },
      scales: {
        x: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" } },
        y: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" }, min: 60, max: 100 }
      }
    }
  });
}

// ── Dashboard: Faculty Load by Department ────────────
function initDeptChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["CSE", "ECE", "MECH", "CIVIL", "MBA", "MCA"],
      datasets: [{
        label: "Avg Load (hrs/week)",
        data: [18, 16, 20, 17, 14, 15],
        backgroundColor: [
          "rgba(201,163,106,0.7)","rgba(91,155,213,0.7)","rgba(86,184,122,0.7)",
          "rgba(232,164,74,0.7)","rgba(168,91,44,0.7)","rgba(201,163,106,0.5)"
        ],
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 } },
      scales: {
        x: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" } },
        y: { grid: { color: "transparent" }, ticks: { color: "rgba(250,247,242,0.55)" } }
      }
    }
  });
}

// ── Analytics: Actual vs Predicted ──────────────────
function initPredictionChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  const grad = ctx.createLinearGradient(0,0,0,240);
  grad.addColorStop(0,"rgba(91,155,213,0.28)");
  grad.addColorStop(1,"rgba(91,155,213,0.02)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Wk 1","Wk 2","Wk 3","Wk 4","Wk 5","Wk 6","Wk 7","Wk 8"],
      datasets: [
        {
          label: "Actual GPA",
          data: [7.2,7.4,7.1,7.6,7.3,7.8,7.5,7.9],
          borderColor: AQ_COLORS.gold,
          backgroundColor: "transparent",
          borderWidth: 2, pointRadius: 4,
          pointBackgroundColor: AQ_COLORS.gold,
          tension: 0.38
        },
        {
          label: "Predicted GPA",
          data: [7.3,7.2,7.4,7.5,7.6,7.7,7.8,8.0],
          borderColor: AQ_COLORS.info,
          backgroundColor: grad,
          borderWidth: 2, borderDash: [5,4],
          pointRadius: 4, pointBackgroundColor: AQ_COLORS.info,
          tension: 0.38, fill: true
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { boxWidth: 10, padding: 16, color: AQ_COLORS.ivory } }, tooltip: { backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 } },
      scales: {
        x: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" } },
        y: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" }, min: 5, max: 10 }
      }
    }
  });
}

// ── Analytics: Dept Pass Rate ────────────────────────
function initPassRateChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["CSE","ECE","MECH","CIVIL","MBA","MCA"],
      datasets: [{
        label: "Pass Rate (%)",
        data: [91,85,78,82,88,90],
        backgroundColor: ["rgba(86,184,122,0.75)","rgba(86,184,122,0.65)","rgba(224,85,85,0.65)","rgba(232,164,74,0.7)","rgba(86,184,122,0.7)","rgba(86,184,122,0.8)"],
        borderRadius: 6, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 } },
      scales: {
        x: { grid: { color: AQ_COLORS.grid }, ticks: { color: "rgba(250,247,242,0.4)" }, max: 100 },
        y: { grid: { color: "transparent" }, ticks: { color: "rgba(250,247,242,0.55)" } }
      }
    }
  });
}

// ── Accreditation: Compliance Donut ─────────────────
function initComplianceDonut(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Compliant","In Progress","Gap"],
      datasets: [{
        data: [62, 24, 14],
        backgroundColor: [AQ_COLORS.success, AQ_COLORS.warning, AQ_COLORS.danger],
        borderColor: "#2C2620",
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "72%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, padding: 14, color: AQ_COLORS.ivory } },
        tooltip: { backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 }
      }
    }
  });
}

// ── Document AI: Type Distribution ──────────────────
function initDocTypeChart(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Certificates","Reports","Policies","Results","Others"],
      datasets: [{
        data: [35, 28, 18, 12, 7],
        backgroundColor: [AQ_COLORS.gold, AQ_COLORS.info, AQ_COLORS.success, AQ_COLORS.orange, AQ_COLORS.warning],
        borderColor: "#2C2620", borderWidth: 3, hoverOffset: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, padding: 12, color: AQ_COLORS.ivory } },
        tooltip: { backgroundColor: "#2C2620", borderColor: AQ_COLORS.border, borderWidth: 1 }
      }
    }
  });
}
