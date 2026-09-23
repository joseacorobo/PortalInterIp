let currentArea = "Todas";
let chartHourly = null;
let chartTechnicians = null;
let chartWeights = null;
let activeTickets = [];
let currentOpenTicket = null;
let liveTimerInterval = null;
let timerStartMs = 0;
let isPaused = false;

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    lucide.createIcons();
    loadCurrentUserProfile();
    loadDashboardData();
    loadCurrentWorkload();
    setInterval(loadMailWorkerStatus, 20000);
    setInterval(loadCurrentWorkload, 15000);

    // Seleccionar vista inicial según hash o default a 'operative' (Vista Operativa Principal)
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('inbox') || hash.includes('mail') || hash.includes('correo')) {
        switchDashboardView('inbox');
    } else if (hash.includes('metric')) {
        switchDashboardView('metrics');
    } else if (hash.includes('audit') || hash.includes('report') || hash.includes('historial')) {
        switchDashboardView('audit');
    } else {
        switchDashboardView('operative');
    }
});

// =============================================================
// GESTOR DE TEMA v5.0 — Delega a theme.js (sistema dual)
// Tokens del Spec: brand=#1C58A8, yellow=#F4B400, navy=#0B3B78
// =============================================================

function initTheme() {
    // El tema ya fue aplicado en el snippet inline del <head>
    // Solo actualizamos los gráficos al cargar
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
               || document.documentElement.classList.contains('dark');
    // Sincronizar clave legacy para compatibilidad
    if (!localStorage.getItem('ip-theme')) {
        const legacy = localStorage.getItem('theme');
        if (legacy) localStorage.setItem('ip-theme', legacy);
    }
}

// toggleDarkMode() existe como alias por si hay código viejo que lo llame
function toggleDarkMode() {
    if (typeof window.toggleTheme === 'function') {
        window.toggleTheme();
    } else {
        // Fallback si theme.js aún no cargó
        const isDark = document.documentElement.classList.toggle('dark');
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('ip-theme', isDark ? 'dark' : 'light');
    }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    try { updateChartsTheme(isDark); } catch (err) { console.warn('Chart theme update error:', err); }
}

function updateThemeIcon(isDark) {
    // Delegado a theme.js — los iconos sun/moon son elementos HTML separados con dark:hidden/dark:block
    // No necesita manipulación adicional
}

function resolveChartCanvas(primaryId, fallbackId) {
    const el = document.getElementById(primaryId) || (fallbackId ? document.getElementById(fallbackId) : null);
    return el ? el.getContext('2d') : null;
}

function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        brand:     isDark ? '#5B9BE0' : '#1C58A8',
        brandTint: isDark ? 'rgba(91,155,224,.14)' : 'rgba(28,88,168,.1)',
        navy:      isDark ? '#8FB7E8' : '#0B3B78',
        yellow:    isDark ? '#F5C24D' : '#F4B400',
        bg:        isDark ? '#060E20' : '#F3F6FC',
        panel:     isDark ? '#0A1020' : '#FFFFFF',
        border:    isDark ? 'rgba(255, 255, 255, 0.08)' : '#E4E9F3',
        text:      isDark ? '#EEF2FA' : '#101828',
        muted:     isDark ? '#93A1C0' : '#5B6B89',
        gridLine:  isDark ? 'rgba(255,255,255,.06)' : '#E4E9F3',
    };
}

function updateChartsTheme(isDark) {
    const c = getThemeColors();

    if (chartHourly && chartHourly.options && chartHourly.options.scales) {
        if (chartHourly.options.scales.y && chartHourly.options.scales.y.grid) {
            chartHourly.options.scales.y.grid.color = c.gridLine;
        }
        ['x','y'].forEach(ax => {
            if (chartHourly.options.scales[ax]) {
                if (!chartHourly.options.scales[ax].ticks) chartHourly.options.scales[ax].ticks = {};
                chartHourly.options.scales[ax].ticks.color = c.muted;
            }
        });
        // Actualizar gradiente con colores del spec
        const ctx = chartHourly.ctx;
        if (ctx && chartHourly.data.datasets[0]) {
            const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
            gradient.addColorStop(0, isDark ? 'rgba(91,155,224,.28)' : 'rgba(28,88,168,.18)');
            gradient.addColorStop(1, isDark ? 'rgba(91,155,224,0)' : 'rgba(28,88,168,0)');
            chartHourly.data.datasets[0].borderColor = c.brand;
            chartHourly.data.datasets[0].pointBackgroundColor = c.brand;
            chartHourly.data.datasets[0].backgroundColor = gradient;
            chartHourly.data.datasets[0].pointBorderColor = c.panel;
        }
        chartHourly.update();
    }

    if (chartTechnicians && chartTechnicians.options && chartTechnicians.options.scales) {
        if (chartTechnicians.options.scales.x && chartTechnicians.options.scales.x.grid) {
            chartTechnicians.options.scales.x.grid.color = c.gridLine;
        }
        ['x','y'].forEach(ax => {
            if (chartTechnicians.options.scales[ax]) {
                if (!chartTechnicians.options.scales[ax].ticks) chartTechnicians.options.scales[ax].ticks = {};
                chartTechnicians.options.scales[ax].ticks.color = c.muted;
            }
        });
        chartTechnicians.update();
    }

    if (chartWeights && chartWeights.data && chartWeights.data.datasets && chartWeights.data.datasets[0]) {
        chartWeights.data.datasets[0].borderColor = c.panel;
        if (chartWeights.options && chartWeights.options.plugins && chartWeights.options.plugins.legend) {
            if (!chartWeights.options.plugins.legend.labels) chartWeights.options.plugins.legend.labels = {};
            chartWeights.options.plugins.legend.labels.color = c.muted;
        }
        chartWeights.update();
    }
}

function changeArea(area) {
    currentArea = area;
    
    let label = "";
    if (area === "Acceso" || area === "Redes de Acceso") {
        label = "División Redes de Acceso";
    } else if (area === "Soporte") {
        label = "Célula Soporte FTTH";
    } else if (area === "Cabecera") {
        label = "Célula Cabecera OLT";
    } else if (area === "Telefonía") {
        label = "Célula Telefonía VoIP";
    }
    
    const bcArea = document.getElementById("breadcrumb-area");
    const bcSep = document.getElementById("breadcrumb-area-separator");
    if (bcArea && bcSep) {
        if (label) {
            bcArea.innerText = label;
            bcArea.classList.remove("hidden");
            bcSep.classList.remove("hidden");
        } else {
            bcArea.innerText = "";
            bcArea.classList.add("hidden");
            bcSep.classList.add("hidden");
        }
    }
    const mainTitle = document.getElementById("main-view-title");
    if (mainTitle) {
        if (area === "Todas") {
            mainTitle.innerText = "Dashboard General de Operaciones";
        } else if (area === "Acceso" || area === "Redes de Acceso") {
            mainTitle.innerText = "Dashboard: División Redes de Acceso";
        } else {
            mainTitle.innerText = `Dashboard: ${label}`;
        }
    }
    
    reportCurrentArea = area;
    if (currentDashboardView === 'audit') {
        const sel = document.getElementById("select-report-area");
        if (sel) sel.value = area;
        loadReportsData();
    }

    // Auto-expandir el grupo acordeón correspondiente al área seleccionada
    if (area === "Acceso" || area === "Redes de Acceso" || area === "Soporte" || area === "Cabecera") {
        toggleSidebarMenu("acceso", true);
    } else if (area === "Telefonía") {
        toggleSidebarMenu("telefonia", true);
    }

    const areas = ['todas', 'acceso', 'soporte', 'cabecera', 'telefonia'];
    areas.forEach(a => {
        const pill = document.getElementById(`pill-area-${a}`);
        const nav = document.getElementById(`nav-area-${a}`);
        const isActive = (a === 'todas' && area === 'Todas') || 
                         (a === 'acceso' && (area === 'Acceso' || area === 'Redes de Acceso')) ||
                         (a === area.toLowerCase().replace('í', 'i'));
        
        if (pill) {
            pill.className = isActive 
                ? "px-3 py-1.5 rounded-lg bg-white shadow-xs text-gray-900 font-semibold transition"
                : "px-3 py-1.5 rounded-lg text-snow-muted hover:text-gray-900 transition";
        }
        if (nav) {
            nav.className = isActive
                ? "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 text-snow-blue transition"
                : "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-snow-muted hover:bg-gray-50 hover:text-gray-900 transition";
        }
    });
    
    const techTitle = document.getElementById("tech-chart-title");
    if (area === "Todas") {
        techTitle.innerText = "Carga Individual por Especialista";
    } else if (area === "Acceso" || area === "Redes de Acceso") {
        techTitle.innerText = "Carga Individual: Especialistas de Redes de Acceso";
    } else {
        techTitle.innerText = `Carga Individual: Especialistas de ${area}`;
    }
    
    loadDashboardData();
}

async function loadDashboardData() {
    try {
        const kpiRes = await fetch(`/api/kpis?area=${currentArea}`);
        const kpis = await kpiRes.json();
        
        // Nivel 1: Visión Macro (ScoreCards)
        if (document.getElementById("kpi-queue-pending")) {
            document.getElementById("kpi-queue-pending").innerText = kpis.pending_count || 0;
        }
        if (document.getElementById("kpi-queue-progress")) {
            document.getElementById("kpi-queue-progress").innerText = kpis.in_progress_count || 0;
        }
        if (document.getElementById("kpi-queue-onhold")) {
            document.getElementById("kpi-queue-onhold").innerText = kpis.on_hold_count || 0;
        }

        if (document.getElementById("kpi-total-tasks")) {
            document.getElementById("kpi-total-tasks").innerText = kpis.total_tasks || 0;
        }
        if (document.getElementById("kpi-total-points")) {
            document.getElementById("kpi-total-points").innerText = kpis.total_points || 0;
        }
        
        if (document.getElementById("kpi-critical-unassigned")) {
            document.getElementById("kpi-critical-unassigned").innerText = kpis.unassigned_critical_count || 0;
            const critBadge = document.getElementById("kpi-critical-badge");
            if (critBadge) {
                if (kpis.unassigned_critical_count > 0) {
                    critBadge.className = "text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 animate-pulse";
                    critBadge.innerText = "¡Atención Inmediata!";
                } else {
                    critBadge.className = "text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
                    critBadge.innerText = "Cola Normal";
                }
            }
        }

        if (document.getElementById("kpi-first-response")) {
            document.getElementById("kpi-first-response").innerText = kpis.avg_first_response || "8.4";
        }
        if (document.getElementById("kpi-sla-compliance")) {
            document.getElementById("kpi-sla-compliance").innerText = `${kpis.sla_compliance || 94.2}%`;
        }
        if (document.getElementById("kpi-avg-mttr")) {
            document.getElementById("kpi-avg-mttr").innerText = kpis.avg_mttr || 0;
        }
        
        const badgeEl = document.getElementById("kpi-balance-status");
        if (badgeEl) {
            badgeEl.innerText = kpis.balance_status;
            if (kpis.balance_badge === "success") {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600";
            } else if (kpis.balance_badge === "warning") {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600";
            } else {
                badgeEl.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600";
            }
        }

        renderAreaProgress(kpis.points_by_area, kpis.total_points);

        const techRes = await fetch(`/api/charts/technicians?area=${currentArea}`);
        const techData = await techRes.json();
        renderTechniciansChart(techData);
        renderTechRankingTable(techData);
        populateTechFilter(techData);

        const countEl = document.getElementById("kpi-tech-count");
        if (countEl) {
            const num = techData.length;
            countEl.innerText = `${num} especialista${num !== 1 ? 's' : ''}`;
        }

        const weightsRes = await fetch(`/api/charts/task-weights?area=${currentArea}`);
        const weightsData = await weightsRes.json();
        renderWeightsChart(weightsData);

        const hourlyRes = await fetch(`/api/charts/hourly?area=${currentArea}`);
        const hourlyData = await hourlyRes.json();
        renderHourlyChart(hourlyData);

        loadInbox();
        loadFeed();
        loadMailWorkerStatus();
        await loadCurrentWorkload();

    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

function renderAreaProgress(areaPoints, totalPoints) {
    const container = document.getElementById("area-progress-bars");
    container.innerHTML = "";
    
    const areas = [
        { name: "Soporte FTTH", key: "Soporte", color: "bg-blue-500", category: "Redes de Acceso" },
        { name: "Cabecera OLT", key: "Cabecera", color: "bg-amber-500", category: "Redes de Acceso" },
        { name: "Telefonía VoIP", key: "Telefonía", color: "bg-purple-500", category: "Servicios & Clientes" }
    ];
    
    areas.forEach(a => {
        const pts = areaPoints[a.key] || 0;
        const pct = totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0;
        const isSelected = (currentArea === a.key) || (currentArea === "Acceso" && a.category === "Redes de Acceso");
        const borderStyle = isSelected ? "border-l-4 border-snow-blue pl-2" : "";
        
        const html = `
            <div class="${borderStyle} transition cursor-pointer" onclick="changeArea('${a.key}')">
                <div class="flex justify-between items-center text-xs mb-1">
                    <span class="font-medium ${isSelected ? 'text-snow-blue font-bold' : 'text-gray-800'}">${a.name}</span>
                    <span class="text-snow-muted font-semibold">${pts} pts (${pct}%)</span>
                </div>
                <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div class="${a.color} h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML("beforeend", html);
    });
}

function renderHourlyChart(hourlyData) {
    const ctx = resolveChartCanvas('chartHourly', 'chartHourlyDemo');
    if (!ctx) return;
    if (chartHourly) chartHourly.destroy();
    
    const c = getThemeColors();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Create gradient fill with spec brand color
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.parentElement.clientHeight || 256);
    gradient.addColorStop(0, isDark ? 'rgba(91,155,224,.28)' : 'rgba(28,88,168,.18)');
    gradient.addColorStop(0.6, isDark ? 'rgba(91,155,224,.06)' : 'rgba(28,88,168,.04)');
    gradient.addColorStop(1, isDark ? 'rgba(91,155,224,0)' : 'rgba(28,88,168,0)');

    chartHourly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyData.labels,
            datasets: [{
                label: 'Incidentes Ingresados',
                data: hourlyData.data,
                borderColor: c.brand,
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: c.brand,
                pointBorderColor: c.panel,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    titleColor: isDark ? '#F8FAFC' : '#0F172A',
                    bodyColor: isDark ? '#94A3B8' : '#475569',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 10,
                    titleFont: { weight: '600', size: 11 },
                    bodyFont: { size: 11 }
                }
            },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { color: c.muted, font: { size: 10 } },
                    border: { display: false }
                },
                y: { 
                    grid: { 
                        color: c.gridLine,
                        drawBorder: false,
                        borderDash: [3, 3]
                    }, 
                    ticks: { color: c.muted, font: { size: 10 } },
                    border: { display: false },
                    beginAtZero: true 
                }
            }
        }
    });
}

function renderTechniciansChart(techData) {
    const ctx = resolveChartCanvas('chartTechnicians', 'chartTechniciansDemo');
    if (!ctx) return;
    if (chartTechnicians) chartTechnicians.destroy();
    
    const c = getThemeColors();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const labels = techData.map(t => t.name.split(' ')[0] + ' ' + (t.name.split(' ')[1] || '')[0] + '.');
    const points = techData.map(t => t.points);
    
    // Color por umbral de carga — regla del spec: no rojo/verde, solo intensidad
    // Balanceado=brand, Moderado=yellow, Alto=navy
    const colors = techData.map(t => {
        if (t.points > 80) return c.navy;     // Alto
        if (t.points > 60) return c.yellow;   // Moderado
        return c.brand;                         // Balanceado
    });
    
    chartTechnicians = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Puntos de Carga',
                data: points,
                backgroundColor: colors,
                borderRadius: 6,
                barThickness: techData.length <= 4 ? 28 : 18,
                indexAxis: 'y'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: c.panel,
                    titleColor: c.text,
                    bodyColor: c.muted,
                    borderColor: c.border,
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 10,
                    titleFont: { weight: '600', size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                        afterLabel: (ctx) => {
                            const t = techData[ctx.dataIndex];
                            return `Area: ${t.area}\nTareas: ${t.tasks}\nMTTR: ${t.avg_mttr}m\nEstado: ${t.status}`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { 
                        color: c.gridLine,
                        drawBorder: false,
                        borderDash: [3, 3]
                    },
                    ticks: { color: c.muted, font: { size: 10 } },
                    border: { display: false },
                    beginAtZero: true
                },
                y: { 
                    grid: { display: false },
                    ticks: { 
                        color: c.muted, 
                        font: { size: 10, weight: '500' }
                    },
                    border: { display: false }
                }
            }
        }
    });
}

function renderTechRankingTable(techData) {
    const tbody = document.getElementById("tech-ranking-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (!techData || techData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-snow-muted">No hay especialistas registrados en esta célula.</td></tr>';
        return;
    }
    
    techData.forEach((t, idx) => {
        const pos = idx + 1;
        let posBadge = `<span class="font-mono text-gray-500 font-semibold text-xs">${pos}</span>`;
        if (pos === 1) {
            posBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold text-[11px] shadow-2xs">1</span>`;
        } else if (pos === 2) {
            posBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-bold text-[11px]">2</span>`;
        } else if (pos === 3) {
            posBadge = `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-bold text-[11px]">3</span>`;
        }
        
        const parts = (t.name || "").split(" ");
        const initials = ((parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "")).toUpperCase() || "OP";
        
        const pct = Math.min(100, Math.round((t.points / 100) * 100));
        // Colores de barra: regla del spec — brand=balanceado, yellow=moderado, navy=alto
        let barBg  = "var(--brand)";
        let statusBadge = '<span class="saturation-badge text-[10px] font-bold px-2 py-0.5 rounded" data-level="balanced">Balanceado</span>';
        
        if (t.points > 80) {
            barBg  = "var(--navy)";
            statusBadge = '<span class="saturation-badge text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" data-level="high">Sobrecarga</span>';
        } else if (t.points > 60) {
            barBg  = "var(--yellow)";
            statusBadge = '<span class="saturation-badge text-[10px] font-bold px-2 py-0.5 rounded" data-level="moderate">Moderado</span>';
        }
        
        let liveBadge = '';
        if (currentWorkloadData && currentWorkloadData.by_operator) {
            const opWork = currentWorkloadData.by_operator.find(o => o.operator_id === t.id || o.name === t.name);
            if (opWork && opWork.active_tickets_count > 0) {
                liveBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 ml-1.5 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>${opWork.active_tickets_count} activo</span>`;
            }
        }

        const row = `
            <tr class="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition">
                <td class="py-2.5 px-3 text-center">${posBadge}</td>
                <td class="py-2.5 px-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded-lg text-white flex items-center justify-center font-bold text-[10px] shrink-0" style="background-color:var(--brand);">
                            ${initials}
                        </div>
                        <div>
                            <div class="flex items-center flex-wrap gap-1">
                                <p class="font-bold text-gray-900 dark:text-white leading-tight">${t.name}</p>
                                ${liveBadge}
                            </div>
                            <p class="text-[10px] text-snow-muted">Especialista NOC</p>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-snow-muted font-medium">${t.area}</td>
                <td class="py-2.5 px-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">${t.tasks}</td>
                <td class="py-2.5 px-3 text-right font-mono font-extrabold" style="color:var(--brand);">${t.points} pts</td>
                <td class="py-2.5 px-3">
                    <div class="w-full h-2 rounded-full overflow-hidden" style="background-color:var(--border-2);">
                        <div class="h-2 rounded-full transition-all duration-500" style="width: ${pct}%; background-color:${barBg};"></div>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-right font-mono text-snow-muted">${t.avg_mttr}m</td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

// =============================================================
// MONITOR DE CARGA DE TRABAJO EN TIEMPO REAL (TICKETS EN PROGRESO)
// Endpoint: GET /api/workload/current?area=...
// =============================================================

let currentWorkloadData = null;

async function loadCurrentWorkload(areaParam) {
    const area = areaParam || currentArea || "Todas";
    const iconSpin = document.getElementById("icon-refresh-workload");
    if (iconSpin) iconSpin.classList.add("animate-spin");

    try {
        const res = await fetch(`/api/metrics/workload?area=${encodeURIComponent(area)}`);
        if (!res.ok) {
            console.warn(`No se pudo consultar carga actual (${res.status})`);
            return;
        }
        const data = await res.json();
        currentWorkloadData = data;
        renderCurrentWorkload(data);
    } catch (err) {
        console.error("Error cargando carga de trabajo actual:", err);
    } finally {
        if (iconSpin) {
            setTimeout(() => iconSpin.classList.remove("animate-spin"), 400);
        }
    }
}

function renderCurrentWorkload(data) {
    if (!data || !data.summary) return;

    const summary = data.summary;

    // 1. Resumen superior
    const elActiveTickets = document.getElementById("workload-summary-active-tickets");
    if (elActiveTickets) elActiveTickets.innerText = summary.total_active_tickets || 0;

    const elActivePoints = document.getElementById("workload-summary-active-points");
    if (elActivePoints) elActivePoints.innerText = `${summary.total_active_points || 0} pts`;

    const elActiveOps = document.getElementById("workload-summary-active-ops");
    if (elActiveOps) elActiveOps.innerText = `${summary.active_operators_count || 0} / ${summary.total_available_operators || 0}`;

    const elBottleneck = document.getElementById("workload-summary-bottleneck");
    if (elBottleneck) elBottleneck.innerText = summary.bottleneck_area || "Ninguna";

    const elStatusPill = document.getElementById("workload-area-status-pill");
    if (elStatusPill) {
        if (summary.total_active_tickets === 0) {
            elStatusPill.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
            elStatusPill.innerText = "Sin Casos en Curso";
        } else if (summary.system_status === "Alerta") {
            elStatusPill.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse";
            elStatusPill.innerText = "Alerta de Saturación";
        } else if (summary.system_status === "Atención") {
            elStatusPill.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
            elStatusPill.innerText = "Carga Moderada";
        } else {
            elStatusPill.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
            elStatusPill.innerText = "Balance Operativo";
        }
    }

    // 2. Desglose por Célula / Área Técnica
    const areasContainer = document.getElementById("workload-areas-grid");
    if (areasContainer) {
        areasContainer.innerHTML = "";
        const areas = data.by_area || [];
        if (areas.length === 0) {
            areasContainer.innerHTML = '<div class="col-span-full text-center text-snow-muted text-xs py-2">No hay datos de áreas.</div>';
        } else {
            areas.forEach(a => {
                const isSelected = (currentArea === a.area) || (currentArea === "Acceso" && (a.area === "Soporte" || a.area === "Cabecera"));
                let borderClass = isSelected ? "border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20" : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900";
                
                let badgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                if (a.active_tickets_count > 3) badgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
                else if (a.active_tickets_count > 1) badgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";

                const cardHtml = `
                    <div class="p-3 rounded-xl border ${borderClass} transition hover:shadow-xs cursor-pointer flex flex-col justify-between" onclick="changeArea('${a.area}')">
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <div class="flex items-center gap-2 overflow-hidden">
                                <span class="w-2.5 h-2.5 rounded-full ${a.active_tickets_count > 0 ? 'bg-blue-600 animate-pulse' : 'bg-gray-300 dark:bg-slate-700'}"></span>
                                <span class="text-xs font-bold text-gray-900 dark:text-white truncate">${a.area}</span>
                            </div>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}">
                                ${a.active_tickets_count} activo${a.active_tickets_count !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-gray-100 dark:border-slate-800/80">
                            <div>
                                <span class="text-snow-muted text-[10px] block">Puntos Carga</span>
                                <span class="font-bold text-amber-600 dark:text-amber-400 font-mono">${a.active_points} pts (${a.share_percentage}%)</span>
                            </div>
                            <div class="text-right">
                                <span class="text-snow-muted text-[10px] block">Operadores</span>
                                <span class="font-bold text-gray-800 dark:text-gray-200 font-mono">${a.active_operators_count} en turno</span>
                            </div>
                        </div>
                    </div>
                `;
                areasContainer.insertAdjacentHTML("beforeend", cardHtml);
            });
        }
    }

    // 3. Matriz de Operadores (vista rendimiento y vista operativa / tablero)
    const opsContainer = document.getElementById("workload-operators-grid")
        || document.getElementById("active-operators-grid")
        || document.getElementById("operators-grid-cards");
    if (opsContainer) {
        opsContainer.innerHTML = "";
        const ops = data.by_operator || [];
        if (ops.length === 0) {
            opsContainer.innerHTML = '<div class="col-span-full text-center text-snow-muted text-xs py-4">No hay operadores registrados para esta célula.</div>';
        } else {
            ops.forEach(op => {
                const parts = (op.name || "").split(" ");
                const initials = op.avatar || (((parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "")).toUpperCase() || "OP");

                let satBadge = '';
                let borderHighlight = 'border-gray-200 dark:border-slate-800';
                
                if (op.active_tickets_count === 0) {
                    satBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Disponible</span>`;
                } else if (op.saturation_level === "Equilibrada") {
                    satBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Equilibrada · ${op.active_points} pts</span>`;
                    borderHighlight = 'border-blue-300 dark:border-blue-800 shadow-2xs';
                } else if (op.saturation_level === "Moderada") {
                    satBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Moderada · ${op.active_points} pts</span>`;
                    borderHighlight = 'border-amber-300 dark:border-amber-800 shadow-2xs';
                } else {
                    satBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">Sobrecarga · ${op.active_points} pts</span>`;
                    borderHighlight = 'border-rose-400 dark:border-rose-800 shadow-xs';
                }

                // Generar lista de tickets del operador
                let ticketsHtml = '';
                if (op.active_tickets_count > 0 && op.active_tickets && op.active_tickets.length > 0) {
                    ticketsHtml = op.active_tickets.map(t => {
                        let slaProgressBg = 'bg-emerald-500';
                        if (t.sla_status === 'breached') slaProgressBg = 'bg-rose-500';
                        else if (t.sla_status === 'warning') slaProgressBg = 'bg-amber-500';

                        return `
                            <div class="p-2.5 rounded-lg bg-gray-50/80 dark:bg-slate-800/60 border border-gray-200/80 dark:border-slate-700 space-y-2 transition hover:border-blue-300">
                                <div class="flex items-center justify-between gap-1 text-[11px]">
                                    <div class="flex items-center gap-1.5 overflow-hidden">
                                        <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${t.ticket_code}</span>
                                        <span class="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">${t.task ? t.task.code : 'P2'} · ${t.points} pts</span>
                                    </div>
                                    <span class="text-[10px] font-mono text-snow-muted flex items-center gap-1 shrink-0">
                                        <i data-lucide="clock" class="w-3 h-3 text-blue-500"></i>
                                        ${t.elapsed_minutes}m activo
                                    </span>
                                </div>
                                <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 leading-snug" title="${t.subject}">
                                    ${t.subject}
                                </p>
                                <div class="flex items-center justify-between text-[10px] text-snow-muted font-mono">
                                    <span class="truncate max-w-[140px]">Ab: ${t.subscriber_code}</span>
                                    <span class="truncate max-w-[130px]">Nodo: ${t.node_name}</span>
                                </div>
                                <div class="space-y-1 pt-0.5">
                                    <div class="flex justify-between items-center text-[10px]">
                                        <span class="text-snow-muted">SLA: ${t.elapsed_minutes}/${t.sla_minutes}m</span>
                                        <span class="font-bold text-${t.sla_color}-600 dark:text-${t.sla_color}-400">${t.sla_label} (${t.sla_percentage}%)</span>
                                    </div>
                                    <div class="w-full bg-gray-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                        <div class="${slaProgressBg} h-1.5 rounded-full transition-all duration-500" style="width: ${t.sla_percentage}%"></div>
                                    </div>
                                </div>
                                <div class="pt-1 flex justify-end">
                                    <button onclick="openTicketFromWorkload(${t.id})" class="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer transition">
                                        <span>Ver en Consola</span>
                                        <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    ticketsHtml = `
                        <div class="py-3 px-2 text-center rounded-lg bg-gray-50/40 dark:bg-slate-800/30 border border-dashed border-gray-200 dark:border-slate-700/80 text-snow-muted text-[11px] flex items-center justify-center gap-1.5">
                            <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i>
                            <span>Sin casos en atención · Cuadrilla disponible</span>
                        </div>
                    `;
                }

                const opCard = `
                    <div class="p-3.5 rounded-xl border ${borderHighlight} bg-white dark:bg-slate-900 transition flex flex-col justify-between space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2.5 overflow-hidden">
                                <div class="w-8 h-8 rounded-lg bg-[#1C58A8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                    ${initials}
                                </div>
                                <div class="overflow-hidden">
                                    <h4 class="text-xs font-bold text-gray-900 dark:text-white truncate">${op.name}</h4>
                                    <p class="text-[10px] text-snow-muted truncate">${op.role} · ${op.area}</p>
                                </div>
                            </div>
                            <div class="shrink-0">
                                ${satBadge}
                            </div>
                        </div>

                        <div class="space-y-2">
                            ${ticketsHtml}
                        </div>
                    </div>
                `;
                opsContainer.insertAdjacentHTML("beforeend", opCard);
            });
        }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function openTicketFromWorkload(ticketId) {
    if (typeof switchDashboardView === 'function') {
        switchDashboardView('inbox');
    }
    setTimeout(() => {
        if (typeof selectOutlookMessage === 'function') {
            selectOutlookMessage(ticketId);
        }
    }, 200);
}

function renderWeightsChart(weightsData) {
    const ctx = resolveChartCanvas('chartWeights', 'chartWeightsDemo');
    if (!ctx) return;
    if (chartWeights) chartWeights.destroy();
    
    const c = getThemeColors();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const labels = weightsData.map(w => w.category);
    const data = weightsData.map(w => w.count);
    const total = data.reduce((a, b) => a + b, 0);
    // P1-P5 Inter NOC palette: Cyan, Inter Blue, Indigo, Amber, Coral
    // Paleta P1-P5: brand, navy, brand-2, yellow, muted — sin rojo
    const colors = [c.brand, c.navy, '#4A90D9', c.yellow, c.muted];

    // Center label plugin (centrado exacto en el donut calculando chartArea real)
    const centerLabelPlugin = {
        id: 'centerLabel',
        afterDraw(chart) {
            const chartArea = chart.chartArea;
            if (!chartArea) return;
            const ctx2 = chart.ctx;
            ctx2.save();
            
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;
            const diameter = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            
            // Total number
            ctx2.font = `700 ${Math.max(16, Math.round(diameter * 0.16))}px Inter, sans-serif`;
            ctx2.fillStyle = c.text;
            ctx2.textAlign = 'center';
            ctx2.textBaseline = 'middle';
            ctx2.fillText(total.toString(), centerX, centerY - 7);
            
            // Sub-label
            ctx2.font = `600 ${Math.max(8, Math.round(diameter * 0.055))}px Inter, sans-serif`;
            ctx2.fillStyle = c.muted;
            ctx2.fillText('TOTAL TAREAS', centerX, centerY + 12);
            
            ctx2.restore();
        }
    };
    
    chartWeights = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : c.panel,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { 
                        boxWidth: 8,
                        boxHeight: 8,
                        font: { size: 10, weight: '500' },
                        color: c.muted,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    titleColor: isDark ? '#F8FAFC' : '#0F172A',
                    bodyColor: isDark ? '#94A3B8' : '#475569',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 10,
                    titleFont: { weight: '600', size: 11 },
                    bodyFont: { size: 11 }
                }
            }
        },
        plugins: [centerLabelPlugin]
    });
}

// =============================================================
// BANDEJA DE CORREOS Y WORKSPACE INTEGRAL CON CRONÓMETRO
// =============================================================

function populateTechFilter(techs) {
    const select = document.getElementById("filter-tech");
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="todos">Todos los Ingenieros</option>';
    techs.forEach(t => {
        select.innerHTML += `<option value="${t.name}">${t.name} (${t.area})</option>`;
    });
    if (currentVal) select.value = currentVal;
}

let currentTechnicalDepartmentId = 0; // 0 = Todos los Departamentos
let allActiveOperators = [];
let currentMailFolder = 'inbox';
let currentMailDirection = 'inbound'; // 'inbound' | 'outbound'
let outboxItems = [];
let selectedOutboxId = null;

async function loadActiveOperatorsList() {
    try {
        const res = await fetch("/api/operadores");
        if (!res.ok) return;
        allActiveOperators = await res.json();
        
        // Actualizar select de filtro filter-tech en columna 2
        const filterTech = document.getElementById("filter-tech");
        if (filterTech) {
            const curVal = filterTech.value;
            filterTech.innerHTML = '<option value="todos">Todos los Operadores</option><option value="sin_asignar">⚠️ Sin Asignar</option>';
            allActiveOperators.forEach(op => {
                const deptoLabel = op.departamento_nombre ? ` · ${op.departamento_nombre}` : '';
                filterTech.innerHTML += `<option value="${op.name}">${op.name}${deptoLabel}</option>`;
            });
            if (curVal) filterTech.value = curVal;
        }
    } catch (e) {
        console.error("Error cargando operadores:", e);
    }
}

async function selectTechnicalDepartment(deptoId) {
    currentTechnicalDepartmentId = deptoId;
    
    // 1. Actualizar estados visuales de los departamentos (0 a 6)
    for (let i = 0; i <= 6; i++) {
        const item = document.getElementById(`depto-item-${i}`);
        if (item) {
            if (i === deptoId) {
                item.classList.add("mail-folder-active");
            } else {
                item.classList.remove("mail-folder-active");
            }
        }
    }

    // 2. Desmarcar carpetas de flujo/buzón para evitar ambigüedad visual
    document.querySelectorAll(".mail-folder-item[id^='folder-item-']").forEach(el => {
        el.classList.remove("mail-folder-active");
    });

    // 3. Título del contenedor de mensajes
    const titleEl = document.getElementById("current-folder-title");
    const deptoNames = {
        0: 'Todos los Departamentos',
        1: 'Redes de Acceso y Aprovisionamiento',
        2: 'Control de Tráfico e Inalámbricas',
        3: 'Seguridad',
        4: 'Telefonía',
        5: 'Redes WAN',
        6: 'Grandes Clientes'
    };
    if (titleEl) titleEl.innerText = deptoNames[deptoId] || 'Tickets IP';

    currentMailDirection = 'inbound';
    await loadInbox();
}

async function loadInbox(folderParam) {
    if (folderParam) {
        currentMailFolder = folderParam;
    }
    const uid = window.currentUser ? window.currentUser.id : 27;
    let url = `/api/tickets/inbox?area=${encodeURIComponent(currentArea)}&user_id=${uid}`;
    if (currentMailFolder && currentMailFolder !== 'todos') {
        url += `&folder=${encodeURIComponent(currentMailFolder)}`;
    }
    if (currentTechnicalDepartmentId && currentTechnicalDepartmentId > 0) {
        url += `&depto_id=${currentTechnicalDepartmentId}`;
    }
    try {
        const res = await fetch(url);
        const tickets = await res.json();
        activeTickets = tickets;
        
        const pendingCount = tickets.filter(t => t.status === 'PENDIENTE').length;
        const badgeInbox = document.getElementById('badge-inbox-count');
        if (badgeInbox) badgeInbox.innerText = pendingCount;
        const headerBadge = document.getElementById('header-badge-count');
        if (headerBadge) {
            headerBadge.style.display = pendingCount > 0 ? 'block' : 'none';
        }
        
        applyInboxFilters();
        await loadMailStats();
        await loadActiveOperatorsList();
    } catch (err) {
        console.error("Error al cargar tickets de bandeja:", err);
    }
}

async function loadMailStats() {
    const uid = window.currentUser ? window.currentUser.id : 27;
    try {
        const res = await fetch(`/api/mail/stats?user_id=${uid}`);
        if (!res.ok) return;
        const stats = await res.json();
        
        // 1. Actualizar Telemetría Entrada/Salida en Vivo
        if (stats.telemetry) {
            const inToday = document.getElementById("telemetry-inbound-today");
            if (inToday) inToday.innerText = stats.telemetry.inbound_today;
            const inTotal = document.getElementById("telemetry-inbound-total");
            if (inTotal) inTotal.innerText = stats.telemetry.inbound_total;
            const outToday = document.getElementById("telemetry-outbound-today");
            if (outToday) outToday.innerText = stats.telemetry.outbound_today;
            const outTotal = document.getElementById("telemetry-outbound-total");
            if (outTotal) outTotal.innerText = stats.telemetry.outbound_total;
            const resRate = document.getElementById("telemetry-resolution-rate");
            if (resRate) resRate.innerText = `${stats.telemetry.resolution_rate}%`;
        }
        
        // 2. Actualizar Métricas del Operador
        if (stats.operator) {
            const opName = document.getElementById("operator-card-name");
            if (opName) opName.innerText = stats.operator.name;
            const opRole = document.getElementById("operator-card-role");
            if (opRole) opRole.innerText = `${stats.operator.role} (${stats.operator.area})`;
            const opAvatar = document.getElementById("operator-card-avatar");
            if (opAvatar) opAvatar.innerText = stats.operator.avatar;
            const opDirects = document.getElementById("operator-directs-count");
            if (opDirects) opDirects.innerText = stats.operator.direct_inbound;
            const opClaimed = document.getElementById("operator-claimed-count");
            if (opClaimed) opClaimed.innerText = stats.operator.claimed_active;
            const opReplies = document.getElementById("operator-replies-count");
            if (opReplies) opReplies.innerText = stats.operator.replies_today;
            const opResolved = document.getElementById("operator-resolved-count");
            if (opResolved) opResolved.innerText = stats.operator.resolved_today;
        }
        
        // 3. Actualizar Badges de Flujo / Buzón
        if (stats.folders) {
            const f = stats.folders;
            const mapBadges = {
                'badge-folder-inbox': f.inbox,
                'badge-folder-directos': f.directos,
                'badge-folder-mis_asignados': f.mis_asignados,
                'badge-folder-en_espera': f.en_espera,
                'badge-folder-salida': f.enviados,
                'badge-folder-resueltos': f.resueltos
            };
            for (const [id, count] of Object.entries(mapBadges)) {
                const el = document.getElementById(id);
                if (el) el.innerText = count !== undefined ? count : 0;
            }
        }

        // 4. Actualizar Badges de los 6 Departamentos Oficiales
        try {
            const deptoRes = await fetch("/api/departamentos");
            if (deptoRes.ok) {
                const deptos = await deptoRes.json();
                let totalAllDeptos = 0;
                deptos.forEach(d => {
                    const badgeEl = document.getElementById(`badge-depto-${d.id}`);
                    if (badgeEl) {
                        badgeEl.innerText = d.tickets_pendientes !== undefined ? d.tickets_pendientes : d.total_tickets;
                    }
                    totalAllDeptos += (d.tickets_pendientes || 0);
                });
                const badgeAll = document.getElementById("badge-depto-0");
                if (badgeAll) badgeAll.innerText = totalAllDeptos;
            }
        } catch (e) {
            console.warn("No se pudo actualizar badges de departamentos:", e);
        }
    } catch (e) {
        console.error("Error al cargar estadísticas del correo:", e);
    }
}

async function selectMailFolder(folderId) {
    currentMailFolder = folderId;
    
    // Desmarcar departamentos
    for (let i = 0; i <= 6; i++) {
        const item = document.getElementById(`depto-item-${i}`);
        if (item) item.classList.remove("mail-folder-active");
    }

    // Actualizar estados visuales en árbol de carpetas
    document.querySelectorAll(".mail-folder-item[id^='folder-item-']").forEach(el => {
        el.classList.remove("mail-folder-active");
    });
    const activeEl = document.getElementById(`folder-item-${folderId}`);
    if (activeEl) activeEl.classList.add("mail-folder-active");

    // Actualizar título del contenedor de mensajes
    const titleEl = document.getElementById("current-folder-title");
    const mapTitles = {
        'inbox': 'Bandeja General de Tickets',
        'directos': 'Directos a mi Buzón',
        'mis_asignados': 'Mis Tickets Asignados',
        'en_espera': 'Tickets en Espera / Terreno',
        'salida': 'Elementos Enviados (Salida SMTP)',
        'resueltos': 'Casos Resueltos'
    };
    if (titleEl) titleEl.innerText = mapTitles[folderId] || folderId.toUpperCase();

    if (folderId === 'salida') {
        currentMailDirection = 'outbound';
        await loadOutbox();
    } else {
        currentMailDirection = 'inbound';
        await loadInbox(folderId);
    }
}

async function loadOutbox() {
    try {
        const res = await fetch("/api/mail/outbox");
        outboxItems = await res.json();
        
        const countEl = document.getElementById("filter-visible-count");
        if (countEl) countEl.innerText = outboxItems.length;

        renderOutboxMessageList(outboxItems);
        loadMailStats();
    } catch (e) {
        console.error("Error cargando outbox:", e);
    }
}

function renderOutboxMessageList(items) {
    const listContainer = document.getElementById("outlook-message-list");
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (items.length === 0) {
        listContainer.innerHTML = `
            <div class="p-8 text-center text-snow-muted italic text-xs">
                <i data-lucide="send" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                No hay correos salientes registrados todavia.
            </div>
        `;
        lucide.createIcons();
        renderOutlookReadingPaneEmpty();
        return;
    }

    items.forEach((item, idx) => {
        const isSelected = (selectedOutboxId !== null && item.id === selectedOutboxId) || (selectedOutboxId === null && idx === 0);
        if (isSelected && (selectedOutboxId === null || selectedOutboxId !== item.id)) {
            selectedOutboxId = item.id;
        }

        const cleanSender = item.user_name || "Especialista NOC";
        const initials = item.user_avatar || getSenderInitials(cleanSender, item.user_email);
        const avatarColor = getAvatarColor(initials);
        const bodySnippet = (item.body_text || "Sin texto").replace(/\r?\n/g, ' ').substring(0, 110) + '...';

        const card = document.createElement("div");
        card.id = `outbox-item-${item.id}`;
        card.className = `outlook-msg-card p-3 cursor-pointer relative transition hover:bg-gray-50 dark:hover:bg-[#222225] ${isSelected ? 'outlook-item-selected' : 'bg-transparent'}`;
        card.onclick = () => selectOutboxMessage(item.id);

        card.innerHTML = `
            <div class="flex items-start gap-2.5">
                <div class="w-8 h-8 rounded-full ${avatarColor} shrink-0 flex items-center justify-center font-bold text-[11px] shadow-2xs">
                    ${initials}
                </div>
                <div class="flex-1 overflow-hidden">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[170px]">
                            Para: ${item.recipient_email || 'Solicitante'}
                        </span>
                        <span class="text-[10px] text-snow-muted font-mono shrink-0">
                            ${item.sent_at ? item.sent_at.substring(11, 16) : ''}
                        </span>
                    </div>

                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">OUT-${item.id}</span>
                        <p class="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            Re: ${item.ticket_subject || 'Respuesta tecnica'}
                        </p>
                    </div>

                    <p class="text-[11px] text-snow-muted line-clamp-2 leading-relaxed mb-2 font-normal">
                        ${bodySnippet}
                    </p>

                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Despachado SMTP</span>
                        <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">${item.ticket_code || 'TICKET'}</span>
                        <span class="text-[9px] text-snow-muted ml-auto font-medium">Por: ${cleanSender}</span>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });

    lucide.createIcons();

    if (selectedOutboxId !== null) {
        const found = items.find(i => i.id === selectedOutboxId) || items[0];
        if (found) loadOutboxItemIntoReadingPane(found);
    }
}

function selectOutboxMessage(replyId) {
    selectedOutboxId = replyId;
    document.querySelectorAll(".outlook-msg-card").forEach(el => el.classList.remove("outlook-item-selected"));
    const selectedEl = document.getElementById(`outbox-item-${replyId}`);
    if (selectedEl) selectedEl.classList.add("outlook-item-selected");

    const found = outboxItems.find(i => i.id === replyId);
    if (found) loadOutboxItemIntoReadingPane(found);
}

function loadOutboxItemIntoReadingPane(item) {
    const pane = document.getElementById("outlook-reading-pane");
    if (!pane) return;

    const cleanSender = item.user_name || "Especialista NOC";
    const initials = item.user_avatar || getSenderInitials(cleanSender, item.user_email);
    const avatarColor = getAvatarColor(initials);

    pane.innerHTML = `
        <div class="flex-1 flex flex-col h-full overflow-hidden">
            <div class="px-5 py-3 border-b border-snow-border bg-gray-50/70 dark:bg-[#1E1E20] flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-[#2C2C2E] border border-snow-border text-gray-900 dark:text-white shadow-2xs">${item.ticket_code || 'TICKET'}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">Despachado SMTP</span>
                    <span class="text-xs text-snow-muted truncate max-w-xs font-mono">&lt;${item.recipient_email}&gt;</span>
                </div>
                <span class="text-xs text-snow-muted font-mono">${item.sent_at || ''}</span>
            </div>

            <div class="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                    <h2 class="text-base font-bold text-gray-900 dark:text-white tracking-tight">Re: ${item.ticket_subject || 'Respuesta Tecnica FSM'}</h2>
                    <p class="text-xs text-snow-muted mt-1">Ticket de referencia: <strong class="text-gray-800 dark:text-gray-200 font-mono">${item.ticket_code || 'N/A'}</strong></p>
                </div>

                <div class="flex items-start justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-[#242426] border border-snow-border">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${avatarColor} font-bold text-xs flex items-center justify-center shadow-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-xs font-bold text-gray-900 dark:text-white">${cleanSender}</p>
                            <p class="text-[11px] text-snow-muted">De: <span class="font-mono">${item.user_email || 'operaciones@inter.com.ve'}</span></p>
                            <p class="text-[11px] text-snow-muted">Para: <span class="font-mono text-gray-700 dark:text-gray-300 font-semibold">${item.recipient_email}</span></p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">Entrega Confirmada</span>
                    </div>
                </div>

                <div class="rounded-xl border border-snow-border p-4 bg-white dark:bg-[#1E1E20] space-y-2">
                    <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5 border-b border-snow-border pb-1">
                        <i data-lucide="mail-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                        Cuerpo del Mensaje Saliente (RFC 5322)
                    </p>
                    <div class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans whitespace-pre-wrap bg-gray-50/50 dark:bg-[#242426] p-4 rounded-xl border border-snow-border/80 select-text font-mono">
${item.body_text || ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

async function moveTicketToFolder(ticketId, folderName) {
    try {
        const res = await fetch(`/api/tickets/${ticketId}/move-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: folderName })
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            if (currentOpenTicket && currentOpenTicket.id === ticketId) {
                currentOpenTicket.folder = folderName;
            }
            await loadInbox();
            await loadMailStats();
            if (typeof selectOutlookMessage === 'function') {
                selectOutlookMessage(ticketId);
            }
        }
    } catch (e) {
        console.error("Error al mover ticket de carpeta:", e);
    }
}

// =============================================================
// MICROSOFT 365 / OUTLOOK WEB INBOX ENGINE (NODE 160-236405)
// =============================================================

let currentInboxTab = 'todos'; // 'todos' | 'directos' | 'mis_asignados' | 'pendientes' | 'prioritarios' | 'otros'
let isOutlookFullscreen = false;
let selectedTicketId = null;

function toggleOutlookFullscreen() {
    const inbox = document.getElementById("inbox-section");
    const icon = document.getElementById("icon-outlook-screen");
    if (!inbox) return;

    isOutlookFullscreen = !isOutlookFullscreen;
    if (isOutlookFullscreen) {
        inbox.classList.add("outlook-fullscreen-mode");
        if (icon) {
            icon.setAttribute("data-lucide", "minimize-2");
        }
    } else {
        inbox.classList.remove("outlook-fullscreen-mode");
        if (icon) {
            icon.setAttribute("data-lucide", "maximize-2");
        }
    }
    lucide.createIcons();
}

function isDirectToMe(t) {
    if (!window.currentUser) return false;
    const myEmail = (window.currentUser.email || '').toLowerCase().trim();
    const myName = (window.currentUser.name || '').toLowerCase().trim();
    if (!myEmail && !myName) return false;

    const recip = (t.recipient_email || '').toLowerCase();
    if (recip && myEmail && (recip.includes(myEmail) || myEmail.includes(recip))) return true;

    const fullText = `${t.subject || ''} ${t.full_body || ''}`.toLowerCase();
    if (myEmail && fullText.includes(myEmail)) return true;
    if (myName && fullText.includes(myName)) return true;

    return false;
}

function isClaimedByMe(t) {
    if (!window.currentUser) return false;
    return t.claimed_by_user_id === window.currentUser.id;
}

function switchInboxTab(tab) {
    currentInboxTab = tab;
    ['todos', 'pendientes', 'en_proceso', 'prioritarios', 'otros', 'directos', 'mis_asignados'].forEach(t => {
        const btn = document.getElementById(`tab-inbox-${t}`);
        if (btn) {
            if (t === tab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
    applyInboxFilters();
}

function filterOutlookBySearch(query) {
    const globalInput = document.getElementById("global-search-input");
    if (globalInput) globalInput.value = query;
    applyInboxFilters();
}

function getSenderInitials(senderName, senderEmail) {
    if (senderName && senderName.trim().length > 0) {
        const parts = senderName.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }
    if (senderEmail) {
        const user = senderEmail.split('@')[0];
        return user.substring(0, 2).toUpperCase();
    }
    return "IP";
}

function getAvatarColor(initials) {
    const colors = [
        "bg-[#0078D4] text-white",
        "bg-[#107C41] text-white",
        "bg-[#8764B8] text-white",
        "bg-[#D83B01] text-white",
        "bg-[#008272] text-white",
        "bg-[#038387] text-white",
        "bg-[#498205] text-white"
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
        sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
}

function applyInboxFilters() {
    if (currentMailDirection === 'outbound') {
        const outlookSearchEl = document.getElementById("outlook-search-input");
        const globalSearchEl = document.getElementById("global-search-input");
        const searchQuery = (outlookSearchEl ? outlookSearchEl.value : (globalSearchEl ? globalSearchEl.value : "")).trim().toLowerCase();
        let filtered = outboxItems.filter(item => {
            if (searchQuery) {
                const rowStr = `${item.ticket_code || ''} ${item.recipient_email || ''} ${item.ticket_subject || ''} ${item.body_text || ''} ${item.user_name || ''}`.toLowerCase();
                return rowStr.includes(searchQuery);
            }
            return true;
        });
        const countEl = document.getElementById("filter-visible-count");
        if (countEl) countEl.innerText = filtered.length;
        renderOutboxMessageList(filtered);
        return;
    }

    const filterTech = document.getElementById("filter-tech") ? document.getElementById("filter-tech").value : "todos";
    const filterBottleneck = document.getElementById("filter-bottleneck") ? document.getElementById("filter-bottleneck").value : "todos";
    const outlookSearchEl = document.getElementById("outlook-search-input");
    const globalSearchEl = document.getElementById("global-search-input");
    const searchQuery = (outlookSearchEl ? outlookSearchEl.value : (globalSearchEl ? globalSearchEl.value : "")).trim().toLowerCase();

    // Contadores para pestañas y métricas
    let countPrioritarios = 0;
    let countEnProceso = 0;
    let countPendientes = 0;
    let countDirectos = 0;
    let countMisAsignados = 0;

    activeTickets.forEach(t => {
        const isCrit = (t.suggested_points >= 4) || 
                       (t.sla_minutes && t.sla_minutes <= 20) || 
                       (t.subject && (t.subject.includes('Bridge') || t.subject.includes('OLT') || t.subject.includes('Troncal') || t.subject.includes('Caída') || t.subject.includes('Alerta') || t.subject.includes('Falla')));
        if (isCrit) countPrioritarios++;
        if (t.status === 'PENDIENTE') countPendientes++;
        if (t.status === 'EN PROGRESO') countEnProceso++;
        if (isDirectToMe(t)) countDirectos++;
        if (isClaimedByMe(t)) countMisAsignados++;
    });

    const badgePrio = document.getElementById("badge-tab-prioritarios");
    if (badgePrio) badgePrio.innerText = countPrioritarios;
    const badgePend = document.getElementById("badge-tab-pendientes");
    if (badgePend) badgePend.innerText = countPendientes;
    const badgeProc = document.getElementById("badge-tab-proceso");
    if (badgeProc) badgeProc.innerText = countEnProceso;

    // Actualizar badges en Sidebar
    const sbInboxBadge = document.getElementById("sidebar-inbox-badge");
    if (sbInboxBadge) sbInboxBadge.innerText = countPendientes > 0 ? countPendientes : activeTickets.length;

    let filtered = activeTickets.filter(t => {
        const isCrit = (t.suggested_points >= 4) || 
                       (t.sla_minutes && t.sla_minutes <= 20) || 
                       (t.subject && (t.subject.includes('Bridge') || t.subject.includes('OLT') || t.subject.includes('Troncal') || t.subject.includes('Caída') || t.subject.includes('Alerta') || t.subject.includes('Falla')));

        // 1. Filtro por Pestaña de Estado
        if (currentInboxTab === 'directos' && !isDirectToMe(t)) return false;
        if (currentInboxTab === 'mis_asignados' && !isClaimedByMe(t)) return false;
        if (currentInboxTab === 'pendientes' && t.status !== 'PENDIENTE') return false;
        if (currentInboxTab === 'en_proceso' && t.status !== 'EN PROGRESO') return false;
        if (currentInboxTab === 'prioritarios' && !isCrit) return false;

        // 2. Filtro por Operador
        if (filterTech === "sin_asignar") {
            const hasOp = (t.operador_id && t.operador_id > 0) || (t.claimed_by_user_id && t.claimed_by_user_id > 0);
            if (hasOp && t.operador_nombre !== 'Sin Asignar') return false;
        } else if (filterTech !== "todos") {
            const opName = (t.operador_nombre || t.claimed_by_name || "").toLowerCase();
            if (opName !== filterTech.toLowerCase()) {
                return false;
            }
        }

        // 3. Filtro por Diagnóstico / SLA
        const slaMin = t.sla_minutes || 30;
        let elapsedMin = 0;
        let isOverSla = false;

        if (t.status === 'EN PROGRESO') {
            const dateRef = t.fecha_inicio_atencion || t.claimed_at;
            if (dateRef) {
                const start = new Date(dateRef.replace(' ', 'T')).getTime();
                const pausedMs = (t.total_paused_seconds || 0) * 1000;
                elapsedMin = Math.max(1, Math.round((Date.now() - start - pausedMs) / 60000));
            } else {
                elapsedMin = 14;
            }
            if (elapsedMin > slaMin) isOverSla = true;
        } else if (t.status === 'EN ESPERA') {
            elapsedMin = Math.round((t.total_paused_seconds || 600) / 60);
        } else if (t.status === 'PENDIENTE') {
            const dateRef = t.fecha_creacion || t.created_at;
            if (dateRef) {
                const created = new Date(dateRef.replace(' ', 'T')).getTime();
                elapsedMin = Math.max(1, Math.round((Date.now() - created) / 60000));
            } else {
                elapsedMin = 15;
            }
            if (elapsedMin > 45) isOverSla = true;
        }

        if (filterBottleneck === "pendientes" && t.status !== 'PENDIENTE') return false;
        if (filterBottleneck === "en_proceso" && t.status !== 'EN PROGRESO') return false;
        if (filterBottleneck === "pausados" && t.status !== 'EN ESPERA') return false;
        if (filterBottleneck === "criticos" && !isCrit) return false;
        if (filterBottleneck === "estancados" && !isOverSla && t.status !== 'EN ESPERA') return false;

        // 4. Filtro por Buscador
        if (searchQuery) {
            const rowStr = `${t.ticket_code} ${t.sender_email} ${t.subject} ${t.suggested_task_name || ''} ${t.operador_nombre || ''} ${t.claimed_by_name || ''} ${t.departamento_nombre || ''} ${t.area || ''} ${t.full_body || ''} ${t.subscriber_code || ''} ${t.node_name || ''}`.toLowerCase();
            if (!rowStr.includes(searchQuery)) return false;
        }

        return true;
    });

    const countEl = document.getElementById("filter-visible-count");
    if (countEl) countEl.innerText = filtered.length;

    renderOutlookMessageList(filtered);
}

function renderOutlookMessageList(tickets) {
    const listContainer = document.getElementById("outlook-message-list");
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (tickets.length === 0) {
        listContainer.innerHTML = `
            <div class="p-8 text-center text-snow-muted italic text-xs">
                <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
                No se encontraron tickets con los filtros actuales.
            </div>
        `;
        lucide.createIcons();
        renderOutlookReadingPaneEmpty();
        return;
    }

    tickets.forEach((t, idx) => {
        const isSelected = (selectedTicketId !== null && t.id === selectedTicketId) || (selectedTicketId === null && idx === 0);
        if (isSelected && (selectedTicketId === null || selectedTicketId !== t.id)) {
            selectedTicketId = t.id;
        }

        const isUnread = t.status === 'PENDIENTE';
        const senderName = t.sender_email ? t.sender_email.split('@')[0].replace(/[._-]/g, ' ') : "Soporte";
        const cleanSender = senderName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const initials = getSenderInitials(cleanSender, t.sender_email);
        const avatarColor = getAvatarColor(initials);

        // Preview snippet
        const bodySnippet = (t.full_body || "Sin contenido previo...")
            .replace(/\r?\n/g, ' ')
            .substring(0, 110) + '...';

        // SLA tag / diagnóstico
        const slaMin = t.sla_minutes || 30;
        let elapsedMin = 0;
        let isOverSla = false;
        let slaPill = '';

        if (t.status === 'EN PROGRESO') {
            const dateRef = t.fecha_inicio_atencion || t.claimed_at;
            if (dateRef) {
                const start = new Date(dateRef.replace(' ', 'T')).getTime();
                const pausedMs = (t.total_paused_seconds || 0) * 1000;
                elapsedMin = Math.max(1, Math.round((Date.now() - start - pausedMs) / 60000));
            } else {
                elapsedMin = 14;
            }
            isOverSla = elapsedMin > slaMin;
            if (isOverSla) {
                slaPill = `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/40 dark:text-red-400">+${elapsedMin - slaMin}m Fuera SLA</span>`;
            } else {
                slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400">En SLA (${elapsedMin}m)</span>`;
            }
        } else if (t.status === 'EN ESPERA') {
            slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-400">Pausa Terreno</span>`;
        } else if (t.status === 'PENDIENTE') {
            const dateRef = t.fecha_creacion || t.created_at;
            let waitMin = 15;
            if (dateRef) {
                const created = new Date(dateRef.replace(' ', 'T')).getTime();
                waitMin = Math.max(1, Math.round((Date.now() - created) / 60000));
            }
            slaPill = `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300">Espera: ${waitMin}m</span>`;
        } else {
            slaPill = `<span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Resuelto (${t.duracion_atencion_minutos || 15}m)</span>`;
        }

        const deptoLabel = t.departamento_nombre || t.area || 'Acceso';
        const assignedName = t.operador_nombre && t.operador_nombre !== 'Sin Asignar' ? t.operador_nombre : (t.claimed_by_name || null);

        const card = document.createElement("div");
        card.id = `msg-item-${t.id}`;
        card.className = `outlook-msg-card p-3 cursor-pointer relative transition hover:bg-gray-50 dark:hover:bg-[#222225] ${isSelected ? 'outlook-item-selected' : 'bg-transparent'}`;
        card.onclick = () => selectOutlookMessage(t.id);

        card.innerHTML = `
            <div class="flex items-start gap-2.5">
                <!-- Avatar -->
                <div class="w-8 h-8 rounded-full ${avatarColor} shrink-0 flex items-center justify-center font-bold text-[11px] shadow-2xs">
                    ${initials}
                </div>

                <!-- Content -->
                <div class="flex-1 overflow-hidden">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-xs ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'} truncate max-w-[170px]">
                            ${cleanSender}
                        </span>
                        <span class="text-[10px] text-snow-muted font-mono shrink-0">
                            ${t.created_at ? t.created_at.substring(11, 16) : '10:42'}
                        </span>
                    </div>

                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-[10px] font-mono font-bold text-[#0078D4]">${t.ticket_code}</span>
                        <p class="text-xs ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-300'} truncate">
                            ${t.subject}
                        </p>
                    </div>

                    <p class="text-[11px] text-snow-muted line-clamp-2 leading-relaxed mb-2 font-normal">
                        ${bodySnippet}
                    </p>

                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/40 text-[#0056B3] dark:text-blue-300 border border-blue-100 dark:border-blue-900 truncate max-w-[110px]" title="${deptoLabel}">
                            ${deptoLabel}
                        </span>
                        <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">+${t.suggested_points || 2} pts</span>
                        ${slaPill}
                        ${isDirectToMe(t) ? `<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300">Directo a mí</span>` : ''}
                        ${assignedName ? `
                            <span class="text-[9px] text-gray-700 dark:text-gray-300 font-medium ml-auto flex items-center gap-1 truncate max-w-[100px]" title="Asignado a ${assignedName}">
                                <i data-lucide="user-check" class="w-3 h-3 text-emerald-600 shrink-0"></i>
                                <span class="truncate">${assignedName}</span>
                            </span>
                        ` : `
                            <span class="text-[9px] text-amber-600 dark:text-amber-400 font-bold ml-auto flex items-center gap-0.5">
                                <span>⚠️ Sin Asignar</span>
                            </span>
                        `}
                    </div>
                </div>

                <!-- Unread Blue Dot Indicator -->
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-[#0078D4] shrink-0 mt-1"></span>' : ''}
            </div>
        `;
        listContainer.appendChild(card);
    });

    lucide.createIcons();

    // Cargar en el panel de lectura el ticket seleccionado
    if (selectedTicketId !== null) {
        const found = tickets.find(t => t.id === selectedTicketId) || tickets[0];
        if (found) {
            loadTicketIntoReadingPane(found);
        }
    }
}

function renderOutlookReadingPaneEmpty() {
    const pane = document.getElementById("outlook-reading-pane");
    if (!pane) return;
    pane.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
            <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-[#0078D4] flex items-center justify-center mb-4">
                <i data-lucide="mail" class="w-8 h-8"></i>
            </div>
            <h3 class="text-base font-bold text-gray-900 dark:text-white mb-1">Selecciona un correo para leerlo</h3>
            <p class="text-xs text-snow-muted max-w-sm">
                Haz clic en cualquier ticket de la lista de la izquierda para desplegar su ficha técnica, cuerpo del mensaje, parámetros y comenzar su atención técnica con cronómetro en vivo.
            </p>
        </div>
    `;
    lucide.createIcons();
}

async function selectOutlookMessage(ticketId) {
    selectedTicketId = ticketId;

    // Actualizar clase activa en la lista
    document.querySelectorAll(".outlook-msg-card").forEach(el => {
        el.classList.remove("outlook-item-selected");
    });
    const selectedEl = document.getElementById(`msg-item-${ticketId}`);
    if (selectedEl) selectedEl.classList.add("outlook-item-selected");

    // Fetch y carga del ticket
    try {
        const res = await fetch(`/api/tickets/${ticketId}`);
        const t = await res.json();
        currentOpenTicket = t;
        loadTicketIntoReadingPane(t);
    } catch (e) {
        console.error("Error fetching ticket details:", e);
    }
}

async function claimCurrentTicket() {
    if (!currentOpenTicket) return;
    const uid = window.currentUser ? window.currentUser.id : 27;
    try {
        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: uid })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            showToast("Caso tomado para atención inmediata", "success");
            currentOpenTicket.status = 'EN PROGRESO';
            currentOpenTicket.claimed_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
            currentOpenTicket.fecha_inicio_atencion = currentOpenTicket.claimed_at;
            currentOpenTicket.claimed_by_id = uid;
            currentOpenTicket.claimed_by_user_id = uid;
            currentOpenTicket.operador_id = uid;
            currentOpenTicket.operador_nombre = window.currentUser ? window.currentUser.name : 'José Corobo';
            currentOpenTicket.claimed_by_name = currentOpenTicket.operador_nombre;
            await selectOutlookMessage(currentOpenTicket.id);
            await loadInbox();
            if (window.currentDashboardView === 'audit') loadAuditLogs();
        } else {
            showToast(data.error || "No se pudo tomar el caso", "error");
        }
    } catch (e) {
        console.error("Error claiming ticket:", e);
        showToast("Error de comunicación al tomar caso", "error");
    }
}

async function assignCurrentTicketToOperator(operadorId) {
    if (!currentOpenTicket) return;
    if (!operadorId) return;
    try {
        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operador_id: parseInt(operadorId),
                notas: "Asignación técnica desde Consola Helpdesk IP"
            })
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            showToast(`Ticket asignado a ${data.operador_nombre}`, "success");
            currentOpenTicket.operador_id = parseInt(operadorId);
            currentOpenTicket.operador_nombre = data.operador_nombre;
            currentOpenTicket.claimed_by_user_id = parseInt(operadorId);
            currentOpenTicket.claimed_by_name = data.operador_nombre;
            await selectOutlookMessage(currentOpenTicket.id);
            await loadInbox();
        } else {
            showToast(data.error || "Error al asignar operador", "error");
        }
    } catch (e) {
        console.error("Error asignando ticket:", e);
        showToast("Error de conexión al asignar ticket", "error");
    }
}

async function resolveCurrentTicketNow() {
    if (!currentOpenTicket) return;
    const uid = window.currentUser ? window.currentUser.id : (currentOpenTicket.operador_id || 27);
    try {
        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: uid,
                task_type_id: currentOpenTicket.suggested_task_type_id || 1,
                points: currentOpenTicket.suggested_points || 2,
                resolution_notes: "Caso resuelto satisfactoriamente desde la Consola de Tickets IP"
            })
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
            showToast(`Ticket ${currentOpenTicket.ticket_code} resuelto (+${data.points} pts)`, "success");
            await selectOutlookMessage(currentOpenTicket.id);
            await loadInbox();
            if (typeof loadDashboardData === 'function') await loadDashboardData();
        } else {
            showToast(data.error || "Error al resolver ticket", "error");
        }
    } catch (e) {
        console.error("Error al resolver ticket:", e);
        showToast("Error de comunicación al resolver caso", "error");
    }
}

function loadTicketIntoReadingPane(t) {
    currentOpenTicket = t;
    const pane = document.getElementById("outlook-reading-pane");
    if (!pane) return;

    const senderName = t.sender_email ? t.sender_email.split('@')[0].replace(/[._-]/g, ' ') : "Soporte FibraHogar";
    const cleanSender = senderName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const initials = getSenderInitials(cleanSender, t.sender_email);
    const avatarColor = getAvatarColor(initials);

    const isBridge = (t.subject + (t.full_body || '')).toLowerCase().includes("bridge");

    // Source badge
    const src = (t.source || 'MANUAL').toUpperCase();
    let srcText = "Manual";
    let srcClass = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    if (src === 'REAL_IMAP') {
        srcText = "IMAP Real";
        srcClass = "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900";
    } else if (src === 'SIMULATOR' || src === 'SIMULADOR') {
        srcText = "Simulador FSM";
        srcClass = "bg-blue-50 text-[#0078D4] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900";
    }

    // Status badge
    let statusText = "En Atención";
    let statusClass = "bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/30 dark:text-blue-300";
    if (t.status === 'PENDIENTE') {
        statusText = "Pendiente en Cola";
        statusClass = "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-300";
    } else if (t.status === 'EN ESPERA') {
        statusText = "En Espera";
        statusClass = "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/30 dark:text-amber-300";
    } else if (t.status === 'COMPLETADO') {
        statusText = "Resuelto";
        statusClass = "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300";
    }

    const fullTimestamp = t.fecha_creacion || t.created_at || "Hoy, 10:42 AM";
    const isDirect = isDirectToMe(t);
    const isPending = t.status === 'PENDIENTE';
    const isCompleted = t.status === 'COMPLETADO';
    const isEnEspera = t.status === 'EN ESPERA';
    const deptoName = t.departamento_nombre || t.area || 'Acceso y Aprov.';
    const currentOpId = t.operador_id || t.claimed_by_user_id || null;
    const currentOpName = t.operador_nombre && t.operador_nombre !== 'Sin Asignar' ? t.operador_nombre : (t.claimed_by_name || null);

    // Calcular tiempo de espera para tickets pendientes
    let waitMinutes = 15;
    if (t.created_at || t.fecha_creacion) {
        const cDate = new Date((t.fecha_creacion || t.created_at).replace(' ', 'T')).getTime();
        waitMinutes = Math.max(1, Math.round((Date.now() - cDate) / 60000));
    }

    pane.innerHTML = `
        <div class="flex-1 flex flex-col h-full overflow-hidden">
            <!-- 1. Top Ribbon del Ticket: Código, Depto, Operador y Cronómetro -->
            <div class="px-5 py-3 border-b border-snow-border bg-gray-50/70 dark:bg-[#1E1E20] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2 overflow-hidden flex-wrap">
                    <span id="ws-ticket-code" class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-[#2C2C2E] border border-snow-border text-gray-900 dark:text-white shadow-2xs">${t.ticket_code}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-[#0056B3] dark:text-blue-300 border border-blue-200 dark:border-blue-900">${deptoName}</span>
                    <span id="ws-ticket-status-badge" class="text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass} flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-current ${t.status === 'EN PROGRESO' ? 'animate-pulse' : ''}"></span>
                        ${statusText}
                    </span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded ${srcClass}">${srcText}</span>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <!-- Selector de Asignación de Operador -->
                    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#2C2C2E] border border-snow-border shadow-2xs">
                        <i data-lucide="user-cog" class="w-3.5 h-3.5 text-snow-muted"></i>
                        <span class="text-[11px] text-snow-muted font-medium hidden sm:inline">Operador:</span>
                        <select id="select-ticket-operator" onchange="assignCurrentTicketToOperator(this.value)" class="text-[11px] font-semibold bg-transparent border-0 outline-none text-gray-900 dark:text-white cursor-pointer max-w-[150px] truncate">
                            <option value="" ${!currentOpId ? 'selected' : ''}>⚠️ Sin Asignar</option>
                            ${allActiveOperators.map(op => `
                                <option value="${op.id}" ${(currentOpId === op.id) ? 'selected' : ''}>
                                    ${op.name} (${op.departamento_nombre ? op.departamento_nombre.substring(0, 14) + '...' : op.area})
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Cronómetro / Tiempo en Vivo -->
                    <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#2C2C2E] border border-snow-border shadow-2xs">
                        <i data-lucide="timer" class="w-3.5 h-3.5 ${isPending ? 'text-amber-500' : (isCompleted ? 'text-emerald-600' : 'text-[#0078D4]')}"></i>
                        <span class="text-[11px] text-snow-muted font-medium">${isPending ? 'Espera:' : (isCompleted ? 'Duración:' : 'Atención:')}</span>
                        <span id="ws-live-timer" class="font-mono font-bold text-xs text-gray-900 dark:text-white">
                            ${isPending ? waitMinutes + ' min' : (isCompleted ? (t.duracion_atencion_minutos || 15) + ' min' : '00:00:00')}
                        </span>
                    </div>

                    <!-- Botones de Acción de Ciclo de Vida -->
                    ${isPending ? `
                    <button onclick="claimCurrentTicket()" class="px-3 py-1 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                        <i data-lucide="play" class="w-3.5 h-3.5"></i>
                        <span>Tomar Caso</span>
                    </button>
                    ` : (isCompleted ? `
                    <span class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        <span>Cerrado</span>
                    </span>
                    ` : `
                    <button id="btn-pause-ticket" onclick="togglePauseTicket()" class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 transition cursor-pointer">
                        <i data-lucide="pause-circle" class="w-3.5 h-3.5"></i>
                        <span id="btn-pause-text">${isEnEspera ? 'Reanudar' : 'Pausar'}</span>
                    </button>
                    <button onclick="resolveCurrentTicketNow()" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                        <span>Resolver</span>
                    </button>
                    `)}

                    <!-- Selector Mover a Carpeta / Depto -->
                    <div class="relative">
                        <select onchange="moveTicketToFolder(${t.id}, this.value)" class="text-[11px] font-semibold bg-white dark:bg-[#2C2C2E] border border-snow-border rounded-lg px-2 py-1 text-gray-800 dark:text-gray-200 outline-none cursor-pointer hover:border-[#0078D4] transition" title="Mover este ticket a otra bandeja">
                            <option value="" disabled selected>Mover a...</option>
                            <option value="INBOX" ${(t.folder === 'INBOX' || !t.folder) ? 'disabled' : ''}>Bandeja General</option>
                            <option value="APROVISIONAMIENTO" ${t.folder === 'APROVISIONAMIENTO' ? 'disabled' : ''}>Acceso y Aprov.</option>
                            <option value="DEMONIOS_OLT" ${t.folder === 'DEMONIOS_OLT' ? 'disabled' : ''}>Tráfico / Wireless</option>
                            <option value="IP_BRIDGE" ${t.folder === 'IP_BRIDGE' ? 'disabled' : ''}>Seguridad</option>
                            <option value="TELEFONIA" ${t.folder === 'TELEFONIA' ? 'disabled' : ''}>Telefonía</option>
                            <option value="CABECERA" ${t.folder === 'CABECERA' ? 'disabled' : ''}>Redes WAN</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 2. Email Body, Ficha Técnica y Línea de Tiempo (Scrollable) -->
            <div class="flex-1 overflow-y-auto p-5 space-y-4">
                
                ${isPending ? `
                <!-- Banner: Ticket Pendiente en Cola -->
                <div class="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2">
                        <i data-lucide="inbox" class="w-4 h-4 text-[#0078D4]"></i>
                        <span class="text-blue-900 dark:text-blue-200 font-medium">
                            Ticket pendiente en la cola de <strong>${deptoName}</strong>. Tiempo de espera acumulado: <strong>${waitMinutes} min</strong>.
                        </span>
                    </div>
                    <button onclick="claimCurrentTicket()" class="px-3.5 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer">
                        <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
                        <span>Tomar Caso y Atender</span>
                    </button>
                </div>` : ''}

                ${!isPending && !isCompleted ? `
                <!-- Banner: Asignación y Atención Activa -->
                <div class="p-2.5 ${isEnEspera ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 text-amber-900' : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 text-emerald-900'} border rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${isEnEspera ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}"></span>
                        <span class="font-medium">
                            ${isEnEspera ? 'Caso en espera / pausa técnica.' : 'Caso en atención activa por:'} <strong>${currentOpName || 'Especialista'}</strong>
                        </span>
                    </div>
                    <span class="text-[10px] text-snow-muted font-mono">Iniciado: ${t.fecha_inicio_atencion || t.claimed_at || 'Reciente'}</span>
                </div>` : ''}

                ${isCompleted ? `
                <!-- Banner: Caso Resuelto -->
                <div class="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
                    <div class="flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
                        <span>Caso resuelto y cerrado por <strong>${currentOpName || 'Especialista'}</strong>. Duración total: <strong>${t.duracion_atencion_minutos || 15} minutos</strong>.</span>
                    </div>
                    <span class="text-[10px] font-mono text-snow-muted">${t.fecha_cierre || t.completed_at || ''}</span>
                </div>` : ''}

                <!-- Subject & Metadatos Técnicos -->
                <div>
                    <h2 id="ws-ticket-subject" class="text-base font-bold text-gray-900 dark:text-white tracking-tight">${t.subject}</h2>
                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#0078D4] border border-blue-100 dark:bg-blue-950/40 dark:text-blue-300">${deptoName}</span>
                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/40 dark:text-purple-300">${t.suggested_task_name || 'Operación IP'}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">+${t.suggested_points || 2} pts (P${t.suggested_points || 2})</span>
                        <span class="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">SLA: ${t.sla_minutes || 30}m</span>
                        ${isDirect ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300">Directo a mi Buzón</span>` : ''}
                    </div>
                </div>

                <!-- Perfil del Solicitante / Correo -->
                <div class="flex items-start justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-[#242426] border border-snow-border">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full ${avatarColor} font-bold text-xs flex items-center justify-center shadow-xs">
                            ${initials}
                        </div>
                        <div>
                            <p class="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span>${cleanSender}</span>
                                <span class="text-[10px] font-normal text-snow-muted font-mono">&lt;${t.sender_email}&gt;</span>
                            </p>
                            <p class="text-[11px] text-snow-muted">Para: <span class="font-medium text-gray-700 dark:text-gray-300">${t.recipient_email ? t.recipient_email : 'Operaciones IP <operaciones@inter.com.ve>'}</span></p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] text-snow-muted font-medium block">${fullTimestamp}</span>
                        ${isPending ? `<span class="text-[9px] font-mono text-amber-600 font-bold">Espera: ${waitMinutes}m</span>` : ''}
                    </div>
                </div>

                <!-- Alerta de Seguridad (Modo Bridge o Crítico) -->
                ${isBridge ? `
                <div id="ws-bridge-alert" class="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 shrink-0 mt-0.5"></i>
                    <div>
                        <strong class="font-bold">POLÍTICA CRÍTICA DE MODO BRIDGE:</strong>
                        <span> Bajo ninguna circunstancia aplicar reaprovisionamiento ni enviar comando REFRESH por Soporte FibraHogar a esta ONT. Validar WANMAC directamente en Servidor 815.</span>
                    </div>
                </div>` : ''}

                <!-- Ficha de Parámetros Técnicos Detectados (NLP Classifier) -->
                <div class="bg-gray-50/80 dark:bg-[#202022] rounded-xl border border-snow-border p-3.5">
                    <div class="flex items-center justify-between mb-2.5">
                        <span class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="cpu" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                            Parámetros Técnicos Detectados (NLP Inter IP)
                        </span>
                        <span class="text-[10px] font-mono text-gray-500 bg-white dark:bg-[#2C2C2E] px-2 py-0.5 rounded border border-snow-border">Ficha FSM</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Abonado (10 Dígitos)</span>
                            <span id="ws-param-subscriber" class="font-bold font-mono text-gray-900 dark:text-white">${t.subscriber_code || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Serial PON</span>
                            <span id="ws-param-serial" class="font-bold font-mono text-gray-900 dark:text-white">${t.serial_pon || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Nodo OLT</span>
                            <span id="ws-param-node" class="font-bold text-gray-900 dark:text-white truncate block">${t.node_name || '--'}</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border">
                            <span class="text-[10px] text-snow-muted block">Slot / PON</span>
                            <span id="ws-param-slotpon" class="font-bold font-mono text-gray-900 dark:text-white">${t.slot_pon || '--'}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-snow-muted block">Dirección MAC Abonado</span>
                                <span id="ws-param-mac" class="font-bold font-mono text-gray-900 dark:text-white">${t.mac_address || '--'}</span>
                            </div>
                            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-gray-600 dark:text-gray-300">L2/L3</span>
                        </div>
                        <div class="bg-white dark:bg-[#252528] p-2.5 rounded-lg border border-snow-border flex items-center justify-between">
                            <div>
                                <span class="text-[10px] text-snow-muted block">Complejidad Ponderada</span>
                                <span id="ws-param-points-badge" class="font-bold text-[#0078D4]">+${t.suggested_points || 2} pts (P${t.suggested_points || 2})</span>
                            </div>
                            <span id="ws-param-taskname" class="text-[11px] text-gray-700 dark:text-gray-300 font-medium truncate">${t.suggested_task_name || 'Operación'}</span>
                        </div>
                    </div>
                </div>

                <!-- Galería de Adjuntos (si existen) -->
                ${(t.attachments && t.attachments.length > 0) ? `
                <div class="rounded-xl border border-snow-border p-3.5 bg-gray-50/70 dark:bg-[#202022] space-y-2">
                    <div class="flex items-center justify-between">
                        <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="paperclip" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                            Archivos Adjuntos (${t.attachments.length})
                        </p>
                        <span class="text-[10px] font-medium text-snow-muted">MIME Multipart</span>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                        ${t.attachments.map(att => `
                            <div onclick="openAttachmentViewer('${att.file_path}', '${att.filename}')" class="p-2 rounded-lg bg-white dark:bg-[#262629] border border-snow-border hover:border-[#0078D4] transition cursor-pointer flex flex-col justify-between group">
                                <div class="h-20 w-full rounded bg-gray-100 dark:bg-[#1C1C1E] overflow-hidden flex items-center justify-center relative mb-1.5">
                                    ${att.content_type.startsWith('image/') ? `
                                        <img src="${att.file_path}" alt="${att.filename}" class="h-full w-full object-contain group-hover:scale-105 transition duration-200">
                                    ` : `
                                        <i data-lucide="file-text" class="w-8 h-8 text-snow-muted"></i>
                                    `}
                                </div>
                                <div class="overflow-hidden">
                                    <p class="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate" title="${att.filename}">${att.filename}</p>
                                    <span class="text-[9px] text-snow-muted">${Math.round((att.file_size || 1024)/1024)} KB</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Cuerpo del Correo / Requerimiento -->
                <div class="rounded-xl border border-snow-border p-3.5 bg-white dark:bg-[#1E1E20] space-y-2">
                    <div class="flex items-center justify-between pb-1 border-b border-snow-border">
                        <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="mail-open" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                            Cuerpo del Mensaje Recibido
                        </p>
                        ${t.html_body ? `
                        <div class="flex items-center gap-1 bg-gray-100 dark:bg-[#262629] p-0.5 rounded-lg text-[10px] font-semibold">
                            <button type="button" onclick="toggleEmailBodyView('html')" id="btn-body-html" class="px-2 py-0.5 rounded bg-white dark:bg-[#333336] text-[#0078D4] dark:text-[#38BDF8] shadow-2xs cursor-pointer">
                                Vista HTML
                            </button>
                            <button type="button" onclick="toggleEmailBodyView('plain')" id="btn-body-plain" class="px-2 py-0.5 rounded text-snow-muted hover:text-gray-900 dark:hover:text-white cursor-pointer">
                                Texto Plano
                            </button>
                        </div>
                        ` : ''}
                    </div>

                    ${t.html_body ? `
                    <div id="email-view-html" class="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans bg-gray-50/50 dark:bg-[#242426] p-4 rounded-xl border border-snow-border/80 overflow-x-auto select-text">
                        ${t.html_body}
                    </div>
                    ` : ''}

                    <div id="email-view-plain" class="${t.html_body ? 'hidden' : ''} text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-sans whitespace-pre-wrap bg-gray-50/60 dark:bg-[#242426] p-3 rounded-lg border border-snow-border/80 select-text font-mono">
                        ${(t.full_body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </div>
                </div>

                <!-- 3. LÍNEA DE TIEMPO / HISTORIAL DE ESTADOS (AUDITORÍA FORENSE INMUTABLE) -->
                <div class="rounded-xl border border-snow-border p-4 bg-gray-50/70 dark:bg-[#202022] space-y-3">
                    <div class="flex items-center justify-between border-b border-snow-border pb-2">
                        <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                            <i data-lucide="history" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                            Trazabilidad y Ciclo de Vida del Ticket (${(t.historial || []).length})
                        </p>
                        <span class="text-[10px] text-snow-muted font-mono">ticket_historial_estados</span>
                    </div>

                    <div class="relative border-l-2 border-blue-300 dark:border-blue-900 ml-2.5 pl-4 py-1 space-y-3">
                        ${(t.historial && t.historial.length > 0) ? t.historial.map(h => `
                            <div class="relative text-xs space-y-0.5">
                                <span class="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-[#202022]"></span>
                                <div class="flex items-center justify-between flex-wrap gap-1">
                                    <div class="flex items-center gap-1.5">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-[#0056B3] dark:bg-blue-950 dark:text-blue-300">
                                            ${h.estado_anterior || 'Ingreso'} &rarr; ${h.estado_nuevo}
                                        </span>
                                        <span class="text-[11px] text-gray-700 dark:text-gray-300 font-medium">
                                            por <strong>${h.operador_nombre || 'Sistema'}</strong>
                                        </span>
                                    </div>
                                    <span class="text-[10px] text-snow-muted font-mono">${h.fecha_cambio || ''}</span>
                                </div>
                                <p class="text-[11px] text-snow-muted italic pl-1">${h.nota_cambio || 'Transición de estado'}</p>
                            </div>
                        `).join('') : `
                            <div class="relative text-xs">
                                <span class="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-[#202022]"></span>
                                <div class="flex items-center justify-between">
                                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-[#0056B3]">Ingreso &rarr; ${t.status}</span>
                                    <span class="text-[10px] text-snow-muted font-mono">${t.fecha_creacion || t.created_at || ''}</span>
                                </div>
                                <p class="text-[11px] text-snow-muted italic pl-1">Ticket registrado en cola general</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Historial de Respuestas Salientes (Conversation Thread) -->
                ${(t.replies && t.replies.length > 0) ? `
                <div class="rounded-xl border border-snow-border p-3.5 bg-gray-50/70 dark:bg-[#202022] space-y-2.5">
                    <p class="text-[10px] font-bold text-snow-muted uppercase tracking-wider flex items-center gap-1.5">
                        <i data-lucide="message-square" class="w-3.5 h-3.5 text-emerald-600"></i>
                        Historial de Respuestas Enviadas (${t.replies.length})
                    </p>
                    <div class="space-y-2">
                        ${t.replies.map(r => `
                            <div class="p-3 bg-white dark:bg-[#252528] rounded-lg border border-snow-border text-xs space-y-1 shadow-2xs">
                                <div class="flex items-center justify-between">
                                    <span class="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <span class="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center font-bold">
                                            ${r.user_avatar || 'JC'}
                                        </span>
                                        ${r.user_name || 'Especialista'} &bull; <span class="text-snow-muted text-[10px]">${r.user_role || 'Soporte'}</span>
                                    </span>
                                    <span class="font-mono text-[10px] text-snow-muted">${r.sent_at || ''}</span>
                                </div>
                                <p class="text-gray-700 dark:text-gray-300 font-sans whitespace-pre-wrap text-[11px] leading-relaxed pl-5">
                                    ${r.body_text}
                                </p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Módulo de Redacción y Respuesta Web -->
                ${isPending ? `
                <div class="p-4 bg-gray-50 dark:bg-[#222225] border border-snow-border rounded-xl text-center text-xs text-snow-muted flex items-center justify-center gap-2">
                    <i data-lucide="lock" class="w-4 h-4 text-snow-muted"></i>
                    <span>Para redactar respuestas o resolver este ticket, primero debes hacer clic en <strong>Tomar Caso</strong>.</span>
                </div>
                ` : (isCompleted ? `
                <div class="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-200">
                    <div class="flex items-center gap-2 font-bold mb-1">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600"></i>
                        <span>Ticket Completado y Notificación Registrada</span>
                    </div>
                    <p class="text-[11px] text-emerald-700 dark:text-emerald-300">Resolución registrada por <strong>${currentOpName || 'Especialista'}</strong>. Tiempos netos y puntos acreditados correctamente.</p>
                </div>
                ` : `
                <div class="rounded-xl border border-snow-border p-4 bg-white dark:bg-[#1E1E20] space-y-3 shadow-xs">
                    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-snow-border">
                        <div class="flex items-center gap-2">
                            <i data-lucide="reply" class="w-4 h-4 text-[#0078D4]"></i>
                            <span class="text-xs font-bold text-gray-900 dark:text-white">Redactar Respuesta Oficial (SMTP)</span>
                        </div>
                        <select id="quick-template-select" onchange="applyTechnicalTemplate(this.value)" class="text-[11px] bg-gray-50 dark:bg-[#252528] border border-snow-border rounded-lg px-2.5 py-1 text-gray-800 dark:text-gray-200 font-medium outline-none">
                            <option value="">Insertar Plantilla Técnica...</option>
                            <option value="homologada">Resolución: ONT en Whitelist y Potencia OK</option>
                            <option value="datos">Solicitud: Confirmación de Serial PON y Drop</option>
                            <option value="bridge">Alerta: Validación WANMAC en Servidor 815</option>
                            <option value="cierre_ok">Cierre Normalizado: Servicio 100% Operativo</option>
                        </select>
                    </div>

                    <div class="text-[11px] text-snow-muted flex items-center gap-2">
                        <span>Para: <strong class="text-gray-800 dark:text-gray-200">${t.sender_email}</strong></span>
                        <span>&bull;</span>
                        <span>Asunto: <strong class="text-gray-800 dark:text-gray-200">Re: ${t.subject}</strong></span>
                    </div>

                    <div>
                        <textarea id="ws_reply_body" rows="3" placeholder="Escriba aquí la respuesta técnica que se enviará por correo al solicitante..." class="w-full bg-gray-50 dark:bg-[#242426] border border-snow-border rounded-xl p-3 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078D4] leading-relaxed font-sans"></textarea>
                    </div>

                    <div class="bg-gray-50/70 dark:bg-[#252528] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs border border-snow-border">
                        <div class="flex items-center gap-2 text-snow-muted text-[11px]">
                            <i data-lucide="info" class="w-4 h-4 text-[#0078D4] shrink-0"></i>
                            <span>Conserva las cabeceras RFC 5322 en el mismo hilo de conversación.</span>
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" onclick="sendTicketReply(false)" id="btn-send-reply" class="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold transition cursor-pointer flex items-center gap-1.5">
                                <i data-lucide="send" class="w-3.5 h-3.5 text-[#0078D4]"></i>
                                <span>Enviar Respuesta</span>
                            </button>
                            <button type="button" onclick="sendTicketReply(true)" id="btn-complete-and-reply" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-xs cursor-pointer flex items-center gap-1.5">
                                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                                <span>Resolver Caso y Notificar</span>
                            </button>
                        </div>
                    </div>
                </div>
                `)}

            </div>
        </div>
    `;

    lucide.createIcons();

    // Iniciar cronómetro en vivo si está en atención
    if (t.status === 'EN PROGRESO') {
        startLiveTimer(t.fecha_inicio_atencion || t.claimed_at);
    } else {
        if (liveTimerInterval) clearInterval(liveTimerInterval);
        const timerEl = document.getElementById("ws-live-timer");
        if (timerEl) {
            timerEl.innerText = t.status === 'COMPLETADO' ? `${t.duracion_atencion_minutos || 15} min` : (t.status === 'PENDIENTE' ? `${waitMinutes} min` : "00:00:00");
        }
    }
}

function startLiveTimer(claimedAtStr) {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    
    let startDate = new Date();
    if (claimedAtStr) {
        startDate = new Date(claimedAtStr.replace(' ', 'T'));
    }
    timerStartMs = startDate.getTime();

    function update() {
        const nowMs = Date.now();
        const diffSec = Math.max(0, Math.floor((nowMs - timerStartMs) / 1000));
        
        const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
        const secs = String(diffSec % 60).padStart(2, '0');
        
        const el = document.getElementById("ws-live-timer");
        if (el) el.innerText = `${hrs}:${mins}:${secs}`;
    }

    update();
    liveTimerInterval = setInterval(update, 1000);
}

function closeWorkspaceModal() {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    const modal = document.getElementById("modalTicketWorkspace");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
    if (typeof loadOperatorAssignments === 'function') loadOperatorAssignments(true);
    if (typeof loadInbox === 'function') loadInbox();
}

async function togglePauseTicket() {
    if (!currentOpenTicket) return;
    
    if (currentOpenTicket.status === 'EN PROGRESO') {
        await fetch(`/api/tickets/${currentOpenTicket.id}/pause`, { method: 'POST', credentials: 'include' });
        currentOpenTicket.status = 'EN ESPERA';
        const btnText = document.getElementById("btn-pause-text");
        if (btnText) btnText.innerText = "Reanudar Caso";
        const stBadge = document.getElementById("ws-ticket-status-badge");
        if (stBadge) {
            stBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5";
            stBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> En Espera / Pausa`;
        }
        if (liveTimerInterval) clearInterval(liveTimerInterval);
        if (typeof showStitchSuccessToast === 'function') {
            showStitchSuccessToast("Pausa Técnica Registrada", `El caso #${currentOpenTicket.ticket_code || currentOpenTicket.id} está en espera.`);
        }
    } else {
        await fetch(`/api/tickets/${currentOpenTicket.id}/resume`, { method: 'POST', credentials: 'include' });
        currentOpenTicket.status = 'EN PROGRESO';
        const btnText = document.getElementById("btn-pause-text");
        if (btnText) btnText.innerText = "Pausar (En Espera)";
        const stBadge = document.getElementById("ws-ticket-status-badge");
        if (stBadge) {
            stBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1C58A8] border border-blue-200 flex items-center gap-1.5";
            stBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#1C58A8] animate-pulse"></span> En Atención`;
        }
        startLiveTimer(currentOpenTicket.fecha_inicio_atencion || currentOpenTicket.claimed_at);
        if (typeof showStitchSuccessToast === 'function') {
            showStitchSuccessToast("Atención Reanudada", `El cronómetro del caso #${currentOpenTicket.ticket_code || currentOpenTicket.id} continúa.`);
        }
    }
    if (typeof loadOperatorAssignments === 'function') loadOperatorAssignments(true);
}

async function submitCompleteAutomated(e) {
    if (e) e.preventDefault();
    if (!currentOpenTicket) return;
    
    const notesEl = document.getElementById("ws_resolution_notes");
    const notes = notesEl ? notesEl.value.trim() : "";
    if (!notes) {
        if (typeof showStitchSuccessToast === 'function') {
            showStitchSuccessToast("Notas Requeridas", "Por favor ingresa las notas de diagnóstico o resolución del caso.");
        }
        if (notesEl) notesEl.focus();
        return;
    }
    
    try {
        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution_notes: notes,
                task_type_id: currentOpenTicket.suggested_task_type_id
            })
        });
        
        const result = await res.json();
        if (res.ok && result.status === 'ok') {
            closeWorkspaceModal();
            if (typeof showStitchSuccessToast === 'function') {
                showStitchSuccessToast("¡Caso Resuelto con Éxito!", `El Ticket #${result.ticket || currentOpenTicket.ticket_code} fue enviado a verificación de Coordinación.`);
            }
            if (typeof loadOperatorAssignments === 'function') await loadOperatorAssignments(true);
            if (typeof loadCoordinatorTriage === 'function') await loadCoordinatorTriage();
            if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
            if (typeof loadDashboardData === 'function') loadDashboardData();
        } else {
            if (typeof showStitchSuccessToast === 'function') {
                showStitchSuccessToast("Error al Completar", result.error || "No se pudo registrar la resolución.");
            }
        }
    } catch (err) {
        console.error("Error completing ticket:", err);
        if (typeof showStitchSuccessToast === 'function') {
            showStitchSuccessToast("Error", "Error de comunicación al resolver el caso.");
        }
    }
}

async function simulateEmail() {
    try {
        const res = await fetch(`/api/tickets/simulate-incoming?area=${currentArea}`, { method: 'POST' });
        const result = await res.json();
        if (result.status === 'ok') {
            loadInbox();
        }
    } catch (e) {
        console.error("Error simulating email:", e);
    }
}

async function loadFeed() {
    const res = await fetch(`/api/feed?area=${currentArea}`);
    const feed = await res.json();
    const tbody = document.getElementById('feed-tbody');
    tbody.innerHTML = '';
    
    feed.forEach(f => {
        const row = `
            <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
                <td class="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">${f.ticket}</td>
                <td class="py-2.5 px-3 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#242426] text-[10px] font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center">${f.avatar}</span>
                    <span class="font-medium text-gray-900 dark:text-white">${f.user}</span>
                </td>
                <td class="py-2.5 px-3 text-snow-muted font-medium">${f.area}</td>
                <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300">${f.task}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800/60 font-mono">+${f.points} pts</span>
                </td>
                <td class="py-2.5 px-3 text-center font-mono text-gray-800 dark:text-gray-200">${f.duration}m</td>
                <td class="py-2.5 px-3 text-right text-snow-muted font-mono">${f.time.split(' ')[1] || ''}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}
// =============================================================
// PROBADOR INTERACTIVO DEL ALGORITMO DE PARSING (CASOS REALES)
// =============================================================

let lastAnalyzedData = null;

function openTesterModal() {
    document.getElementById("modalParserTester").classList.remove("hidden");
    document.getElementById("modalParserTester").classList.add("flex");
    loadExampleText(1);
    lucide.createIcons();
}

function closeTesterModal() {
    document.getElementById("modalParserTester").classList.add("hidden");
    document.getElementById("modalParserTester").classList.remove("flex");
}

function loadExampleText(type) {
    const txtArea = document.getElementById("tester_raw_text");
    if (type === 1) {
        txtArea.value = `Buenas tardes soporte, favor apoyo con el siguiente caso:
AB: 1020491823
Serial: FHTT09182312
OLT: OLT-CHAC-01
Potencia: -19.2 dBm
Falla: El cliente no levanta servicio, la ont queda en discovery permanente. Favor desatascar demonio y pasar a whitelist.`;
    } else if (type === 2) {
        txtArea.value = `Buen dia equipo, tenemos al cliente con AB 2599182341 y serial HWTC88291044 en OLT-CCS-02 que tiene IP certificada modo bridge pero la mac 00:1a:2b:3c:4d:5e sale en rojo en el 815. Favor verificar wanmac.`;
    } else if (type === 3) {
        txtArea.value = `Alerta automática NOC: Enlace troncal OLT-CCS-01 slot uplink 1 presenta saturación al 79% (7.85 Gbps). Requiere evaluar activación de PortChannel a 20G en switch.`;
    }
}

async function executeParserAnalysis() {
    const rawText = document.getElementById("tester_raw_text").value;
    if (!rawText.trim()) return;

    try {
        const res = await fetch('/api/parser/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: rawText })
        });
        const data = await res.json();
        const p = data.parsed;
        lastAnalyzedData = p;

        // Llenar casillas
        document.getElementById("res_subscriber").value = p.subscriber_code || "N/A";
        const pBadge = document.getElementById("res_permisor_badge");
        if (p.permisor && pBadge) {
            pBadge.innerText = `P-${p.permisor}`;
            pBadge.classList.remove("hidden");
        } else if (pBadge) {
            pBadge.classList.add("hidden");
        }

        document.getElementById("res_serial").value = p.serial_pon ? `${p.serial_pon} (${p.vendor})` : "N/A";
        document.getElementById("res_node").value = p.node_name || "N/A";
        document.getElementById("res_slotpon").value = p.slot_pon || "Consultar en OLT vía Serial PON";
        document.getElementById("res_mac").value = p.mac_address || "No provista";
        document.getElementById("res_power").value = p.optical_power || "N/A";
        document.getElementById("res_points").value = `+${p.suggested_points} pts (${p.suggested_task_code})`;
        document.getElementById("res_taskname").innerText = `[${p.detected_area}] ${p.suggested_task_name}`;

        // Alerta bridge
        const bridgeEl = document.getElementById("tester-bridge-alert");
        if (p.is_bridge) {
            bridgeEl.classList.remove("hidden");
        } else {
            bridgeEl.classList.add("hidden");
        }

        document.getElementById("tester-results-container").classList.remove("hidden");
        lucide.createIcons();
    } catch (e) {
        console.error("Error analyzing text:", e);
    }
}

async function convertAnalysisToTicket() {
    if (!lastAnalyzedData) return;
    const rawText = document.getElementById("tester_raw_text").value;
    
    try {
        const res = await fetch('/api/tickets/ingest-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_email: "cuadrilla.terreno@inter.com.ve",
                subject: `Caso Procesado: ${lastAnalyzedData.suggested_task_name} (${lastAnalyzedData.subscriber_code || 'Cliente'})`,
                body_text: rawText
            })
        });
        const result = await res.json();
        if (result.status === 'ok') {
            closeTesterModal();
            loadDashboardData();
            const inboxEl = document.getElementById("inbox-section");
            if (inboxEl) inboxEl.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (e) {
        console.error("Error converting to ticket:", e);
    }
}

// =============================================================
// CONTROLADOR DEL MÓDULO DE REPORTES GERENCIALES Y AUDITORÍA
// =============================================================

let reportCurrentArea = "Todas";
let reportCurrentRange = "all";

function openReportsModal() {
    switchDashboardView('audit');
}

function closeReportsModal() {
    document.getElementById("modalReportsAudit").classList.add("hidden");
    document.getElementById("modalReportsAudit").classList.remove("flex");
}

function changeReportRange(range) {
    reportCurrentRange = range;
    ["all", "month", "7days", "today"].forEach(r => {
        const btn = document.getElementById(`btn-rep-${r}`);
        if (btn) {
            if (r === range) {
                btn.className = "px-2.5 py-1 rounded-lg bg-gray-900 text-white font-semibold transition";
            } else {
                btn.className = "px-2.5 py-1 rounded-lg text-snow-muted hover:text-gray-900 transition";
            }
        }
    });
    loadReportsData();
}

function changeReportArea(areaVal) {
    reportCurrentArea = areaVal;
    loadReportsData();
}

async function loadReportsData() {
    try {
        const res = await fetch(`/api/reports/summary?area=${reportCurrentArea}&range_filter=${reportCurrentRange}`);
        const data = await res.json();
        
        // 1. Llenar Tarjetas KPI
        const elPoints = document.getElementById("rep-kpi-points");
        const elTasks = document.getElementById("rep-kpi-tasks");
        const elMttr = document.getElementById("rep-kpi-mttr");
        const elSla = document.getElementById("rep-kpi-sla");
        if (elPoints) elPoints.innerText = `${data.kpis.total_points} pts`;
        if (elTasks) elTasks.innerText = `${data.kpis.total_tasks}`;
        if (elMttr) elMttr.innerText = `${data.kpis.avg_mttr} min`;
        if (elSla) elSla.innerText = `${data.kpis.sla_compliance}%`;

        // 2. Llenar Tabla de Células
        const tbodyAreas = document.getElementById("rep-table-areas");
        if (tbodyAreas) {
            tbodyAreas.innerHTML = "";
            data.area_breakdown.forEach(a => {
                const badgeClass = a.status === 'Equilibrada' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' 
                    : (a.status === 'Moderada' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60' 
                        : 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700/60');
                const tr = `
                    <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition">
                        <td class="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">${a.area}</td>
                        <td class="py-2.5 px-3 text-center text-snow-muted font-medium">${a.techs_count}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${a.total_tasks}</td>
                        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${a.total_points} pts</td>
                        <td class="py-2.5 px-3 text-center font-semibold text-gray-700 dark:text-gray-300">${a.share_percent}%</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${a.avg_mttr} min</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${badgeClass}">
                                ${a.status}
                            </span>
                        </td>
                    </tr>
                `;
                tbodyAreas.insertAdjacentHTML('beforeend', tr);
            });
        }

        // 3. Llenar Tabla de Especialistas
        const tbodyTechs = document.getElementById("rep-table-techs");
        if (tbodyTechs) {
            tbodyTechs.innerHTML = "";
            data.tech_rankings.forEach(t => {
                const stBadge = t.status === 'Equilibrada' 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60' 
                    : (t.status === 'Moderada' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60' 
                        : 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700/60');
                const tr = `
                    <tr class="hover:bg-gray-50/60 dark:hover:bg-white/5 transition text-xs">
                        <td class="py-2.5 px-3 flex items-center gap-2">
                            <span class="w-6 h-6 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs">${t.avatar}</span>
                            <span class="font-semibold text-gray-900 dark:text-white">${t.name}</span>
                        </td>
                        <td class="py-2.5 px-3 text-snow-muted font-medium">${t.area}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${t.tasks_count}</td>
                        <td class="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">${t.total_points} pts</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p1}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p2}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p3}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p4}</td>
                        <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">${t.p5}</td>
                        <td class="py-2.5 px-3 text-right font-mono text-gray-800 dark:text-gray-200">${t.avg_mttr}m</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs ${stBadge}">
                                ${t.status}
                            </span>
                        </td>
                    </tr>
                `;
                tbodyTechs.insertAdjacentHTML('beforeend', tr);
            });
        }

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading reports data:", err);
    }
}

function downloadExcelReport() {
    window.location.href = `/api/reports/export/excel?area=${reportCurrentArea}&range_filter=${reportCurrentRange}`;
}

// =============================================================
// CONTROLADOR DEL WORKER DE INGESTA DE CORREO (MÓDULO 6)
// =============================================================

let currentWorkerStatus = null;

async function loadMailWorkerStatus() {
    try {
        const res = await fetch('/api/mail-worker/status');
        if (!res.ok) return;
        const status = await res.json();
        currentWorkerStatus = status;

        const cfg = status.config || status;
        const mode = cfg.mode || status.mode || 'SIMULATOR';
        const isEnabled = (cfg.enabled !== undefined) ? cfg.enabled : (status.enabled !== undefined ? status.enabled : true);
        const pollInterval = cfg.poll_interval || status.poll_interval || 30;

        // 1. Badge de Modo
        const modeBadge = document.getElementById("worker-mode-badge");
        const modeText = document.getElementById("worker-mode-text");
        if (modeBadge && modeText) {
            if (mode === 'REAL_IMAP') {
                modeBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5";
                modeText.innerText = "Modo: IMAP Real";
            } else {
                modeBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-snow-blue border border-blue-100 flex items-center gap-1.5";
                modeText.innerText = "Modo: Simulador";
            }
        }

        // 2. Badge de Estado (Activo / Pausado)
        const stateBadge = document.getElementById("worker-state-badge");
        const stateText = document.getElementById("worker-state-text");
        const btnToggleText = document.getElementById("btn-worker-toggle-text");
        const iconToggle = document.getElementById("icon-worker-toggle");

        const isRunning = status.is_running && isEnabled;

        if (stateBadge && stateText) {
            if (isRunning) {
                stateBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5";
                stateBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span id="worker-state-text">Activo (Cada ${pollInterval}s)</span>`;
            } else {
                stateBadge.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1.5";
                stateBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span id="worker-state-text">Pausado</span>`;
            }
        }

        if (btnToggleText && iconToggle) {
            if (isRunning) {
                btnToggleText.innerText = "Pausar";
                iconToggle.setAttribute("data-lucide", "pause");
                iconToggle.className = "w-3.5 h-3.5 text-amber-600";
            } else {
                btnToggleText.innerText = "Reanudar";
                iconToggle.setAttribute("data-lucide", "play");
                iconToggle.className = "w-3.5 h-3.5 text-emerald-600";
            }
        }

        // 3. Telemetría (Última sync y total)
        const lastSyncEl = document.getElementById("worker-last-sync");
        if (lastSyncEl) {
            if (status.last_check) {
                lastSyncEl.innerText = status.last_check.split(' ')[1] || status.last_check;
            } else {
                lastSyncEl.innerText = "Pendiente";
            }
        }

        const totalCountEl = document.getElementById("worker-total-count");
        if (totalCountEl) {
            totalCountEl.innerText = status.total_processed ?? status.emails_processed ?? 0;
        }

        lucide.createIcons();
    } catch (err) {
        console.error("Error loading mail worker status:", err);
    }
}

async function toggleMailWorker() {
    if (!currentWorkerStatus) return;
    const isCurrentlyEnabled = (currentWorkerStatus.config && currentWorkerStatus.config.enabled !== undefined)
        ? currentWorkerStatus.config.enabled
        : (currentWorkerStatus.enabled !== undefined ? currentWorkerStatus.enabled : true);
    const nextState = !isCurrentlyEnabled;
    try {
        const res = await fetch('/api/mail-worker/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: nextState })
        });
        if (res.ok) {
            await loadMailWorkerStatus();
        }
    } catch (err) {
        console.error("Error toggling worker:", err);
    }
}

async function syncMailWorkerNow() {
    const btn = document.getElementById("btn-worker-sync");
    const icon = document.getElementById("icon-sync-spin");
    if (icon) icon.classList.add("animate-spin");
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/mail-worker/sync-now', { method: 'POST' });
        const result = await res.json();
        
        await loadMailWorkerStatus();
        if (result.status === 'ok' || result.new_tickets > 0) {
            await loadInbox();
            await loadDashboardData();
        }
    } catch (err) {
        console.error("Error syncing mail worker now:", err);
    } finally {
        if (icon) icon.classList.remove("animate-spin");
        if (btn) btn.disabled = false;
        lucide.createIcons();
    }
}

async function openMailConfigModal() {
    try {
        let status = {};
        try {
            const res = await fetch('/api/mail-worker/status');
            if (res.ok) status = await res.json();
        } catch (e) {
            console.warn("Could not fetch mail worker status:", e);
        }
        currentWorkerStatus = status;
        const cfg = (status && status.config) ? status.config : (status || {});

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = (val !== undefined && val !== null) ? val : "";
        };

        setVal("cfg_mode", cfg.mode || status.mode || "SIMULATOR");
        setVal("cfg_interval", cfg.poll_interval || status.poll_interval || 60);
        setVal("cfg_imap_server", cfg.imap_server || status.imap_server || "imap.gmail.com");
        setVal("cfg_imap_port", cfg.imap_port || status.imap_port || 993);
        setVal("cfg_imap_mailbox", cfg.imap_mailbox || status.imap_mailbox || "INBOX");
        setVal("cfg_imap_user", cfg.imap_user || status.imap_user || "");
        setVal("cfg_imap_password", "");

        toggleImapFieldsVisibility();

        const feedback = document.getElementById("imap-test-feedback");
        if (feedback) {
            feedback.className = "hidden";
            feedback.innerHTML = "";
        }

        const modal = document.getElementById("modalMailWorkerConfig");
        if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        }
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            lucide.createIcons();
        }
    } catch (err) {
        console.error("Error opening mail config modal:", err);
        const modal = document.getElementById("modalMailWorkerConfig");
        if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        }
    }
}

function closeMailConfigModal() {
    const modal = document.getElementById("modalMailWorkerConfig");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

function toggleImapFieldsVisibility() {
    const mode = document.getElementById("cfg_mode").value;
    const fields = document.getElementById("cfg_imap_fields");
    if (!fields) return;
    if (mode === "SIMULATOR") {
        fields.classList.add("opacity-50");
    } else {
        fields.classList.remove("opacity-50");
    }
}

async function saveMailWorkerConfig(e) {
    e.preventDefault();
    const mode = document.getElementById("cfg_mode").value;
    const interval = parseInt(document.getElementById("cfg_interval").value, 10) || 60;
    const server = document.getElementById("cfg_imap_server").value.trim();
    const port = parseInt(document.getElementById("cfg_imap_port").value, 10) || 993;
    const mailbox = document.getElementById("cfg_imap_mailbox").value.trim() || "INBOX";
    const user = document.getElementById("cfg_imap_user").value.trim();
    const pass = document.getElementById("cfg_imap_password").value;

    const payload = {
        mode: mode,
        poll_interval: interval,
        imap_server: server,
        imap_port: port,
        imap_mailbox: mailbox,
        imap_user: user
    };
    if (pass) {
        payload.imap_password = pass;
    }

    try {
        const res = await fetch('/api/mail-worker/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeMailConfigModal();
            await loadMailWorkerStatus();
            await loadInbox();
        }
    } catch (err) {
        console.error("Error saving mail worker config:", err);
    }
}

async function testMailConnection() {
    const btn = document.getElementById("btn-test-imap");
    const feedback = document.getElementById("imap-test-feedback");
    const server = document.getElementById("cfg_imap_server").value.trim();
    const port = parseInt(document.getElementById("cfg_imap_port").value, 10) || 993;
    const user = document.getElementById("cfg_imap_user").value.trim();
    const password = document.getElementById("cfg_imap_password").value;
    const mailbox = document.getElementById("cfg_imap_mailbox").value.trim() || "INBOX";

    if (!server || !user) {
        alert("Por favor indique el servidor IMAP y el usuario de correo para probar.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Probando...</span>';
        if (window.lucide) lucide.createIcons();
    }

    if (feedback) {
        feedback.className = "p-3 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 flex items-center gap-2";
        feedback.innerHTML = '<span class="animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></span> Conectando con ' + server + ':' + port + ' via SSL/TLS...';
        feedback.classList.remove("hidden");
    }

    try {
        const res = await fetch("/api/mail-worker/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                imap_server: server,
                imap_port: port,
                imap_user: user,
                imap_password: password,
                imap_mailbox: mailbox
            })
        });
        const data = await res.json();

        if (feedback) {
            if (data.status === "ok") {
                feedback.className = "p-3 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 space-y-1";
                feedback.innerHTML = `
                    <div class="flex items-center gap-1.5 font-bold">
                        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                        <span>${data.message}</span>
                    </div>
                    <div class="text-[11px] text-emerald-700 dark:text-emerald-400 pl-5">
                        Protocolo: <strong>${data.ssl_version}</strong> | Latencia: <strong>${data.latency_ms} ms</strong> | Buzón: <strong>${data.mailbox}</strong> (${data.unread_count} no leídos).
                    </div>
                `;
            } else {
                feedback.className = "p-3 rounded-lg text-xs font-medium bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 space-y-1";
                feedback.innerHTML = `
                    <div class="flex items-center gap-1.5 font-bold">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-red-600 shrink-0"></i>
                        <span>${data.message}</span>
                    </div>
                    ${data.advice ? `<p class="text-[11px] text-red-700 dark:text-red-400 pl-5">${data.advice}</p>` : ''}
                `;
            }
            if (window.lucide) lucide.createIcons();
        }
    } catch (err) {
        if (feedback) {
            feedback.className = "p-3 rounded-lg text-xs font-medium bg-red-50 text-red-800 border border-red-200";
            feedback.innerText = "Error en solicitud de prueba: " + err.message;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="activity" class="w-4 h-4"></i><span>Probar Conexión</span>';
            if (window.lucide) lucide.createIcons();
        }
    }
}


// =============================================================
// BUSCADOR RÁPIDO GLOBAL Y ACCESOS DE TECLADO
// =============================================================

function filterInboxBySearch(query) {
    const term = (query || "").trim().toLowerCase();
    const rows = document.querySelectorAll("#inbox-tbody tr");
    rows.forEach(r => {
        if (!term) {
            r.style.display = "";
            return;
        }
        const text = r.innerText.toLowerCase();
        r.style.display = text.includes(term) ? "" : "none";
    });
}

document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById("global-search-input");
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});

// =============================================================
// GESTOR DE ACORDEÓN ANIMADO SIDEBAR (MODELO FIGMA NODE 80-1461)
// =============================================================

function toggleSidebarMenu(groupId, forceState = null) {
    const submenu = document.getElementById(`submenu-${groupId}`);
    const chevron = document.getElementById(`chevron-${groupId}`);
    if (!submenu) return;

    const isExpanded = submenu.classList.contains("expanded");
    const shouldOpen = forceState !== null ? forceState : !isExpanded;

    if (shouldOpen) {
        submenu.classList.remove("collapsed");
        submenu.classList.add("expanded");
        if (chevron) chevron.classList.add("rotate-180");
    } else {
        submenu.classList.remove("expanded");
        submenu.classList.add("collapsed");
        if (chevron) chevron.classList.remove("rotate-180");
    }
}

function handleGroupHover(groupId, isHovering) {
    // Si el usuario pasa el mouse por encima, expandir suavemente
    if (isHovering) {
        toggleSidebarMenu(groupId, true);
    } else {
        // Al quitar el mouse, solo colapsar si esta casilla NO contiene el área actualmente activa
        const isActiveAreaInGroup = checkGroupContainsActiveArea(groupId);
        if (!isActiveAreaInGroup) {
            toggleSidebarMenu(groupId, false);
        }
    }
}

function checkGroupContainsActiveArea(groupId) {
    if (groupId === "acceso") {
        return currentArea === "Acceso" || currentArea === "Redes de Acceso" || currentArea === "Soporte" || currentArea === "Cabecera";
    } else if (groupId === "telefonia") {
        return currentArea === "Telefonía";
    }
    return false;
}

// =============================================================
// GESTIÓN DE SESIÓN, PERFIL DE USUARIO Y CONMUTADOR RÁPIDO
// =============================================================

window.currentUser = null;

async function loadCurrentUserProfile() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
            const user = await res.json();
            window.currentUser = user;
            window._currentUser = user;
            
            // Sidebar Profile
            const nameEl = document.getElementById("sidebar-user-name");
            const roleEl = document.getElementById("sidebar-user-role");
            const avatarEl = document.getElementById("sidebar-user-avatar");
            if (nameEl) nameEl.innerText = user.name;
            if (roleEl) roleEl.innerText = user.role === 'ADMINISTRADOR' ? 'Administrador NOC' : (user.role + ' - ' + user.area);
            if (avatarEl && user.avatar) avatarEl.innerText = user.avatar;

            // Header Profile
            const hdrAvatar = document.getElementById("header-user-avatar");
            const hdrName = document.getElementById("header-user-name");
            const hdrRole = document.getElementById("header-user-role");
            if (hdrAvatar && user.avatar) hdrAvatar.innerText = user.avatar;
            if (hdrName) hdrName.innerText = user.name;
            if (hdrRole) hdrRole.innerText = user.role === 'ADMINISTRADOR' ? 'Administrador NOC' : `${user.role} (${user.area})`;

            // Dropdown Profile
            const dropName = document.getElementById("dropdown-user-fullname");
            const dropEmail = document.getElementById("dropdown-user-email");
            const dropBadge = document.getElementById("dropdown-user-badge");
            if (dropName) dropName.innerText = user.name;
            if (dropEmail) dropEmail.innerText = user.email;
            if (dropBadge) dropBadge.innerText = `${user.role} - ${user.area}`;

            // Población de dropdown de conmutación
            loadUsersDropdownList();

            // Re-evaluar filtros del inbox para refrescar "Directos a Mí"
            if (activeTickets && activeTickets.length > 0) {
                applyInboxFilters();
            }

            // Mesa de Asignación (Triage) exclusiva para Coordinadores
            if (typeof checkCoordinatorRoleAndInitTriage === 'function') {
                checkCoordinatorRoleAndInitTriage(user);
            }

            // Refrescar panel de tareas del Operador
            if (typeof loadOperatorAssignments === 'function') {
                loadOperatorAssignments(true);
            }
        }
    } catch (e) {
        console.error("Error loading user profile:", e);
    }
}

async function loadUsersDropdownList() {
    const listEl = document.getElementById("dropdown-users-list");
    if (!listEl) return;

    try {
        const res = await fetch('/api/auth/users');
        if (!res.ok) return;
        const data = await res.json();
        const users = Array.isArray(data) ? data : (data.users || []);

        listEl.innerHTML = '';
        users.forEach(u => {
            const isMe = window.currentUser && window.currentUser.id === u.id;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.onclick = () => switchUserProfile(u.id);
            btn.className = `w-full flex items-center justify-between p-2 rounded-lg text-left transition cursor-pointer ${isMe ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0056B3] dark:text-[#38BDF8]' : 'hover:bg-gray-100 dark:hover:bg-[#222225] text-gray-800 dark:text-gray-200'}`;
            
            btn.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    <span class="w-6 h-6 rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                        ${u.avatar || u.name.substring(0, 2).toUpperCase()}
                    </span>
                    <div class="overflow-hidden">
                        <p class="text-xs font-semibold truncate leading-tight">${u.name}</p>
                        <p class="text-[10px] text-snow-muted truncate">${u.role} (${u.area})</p>
                    </div>
                </div>
                ${isMe ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0056B3] dark:text-[#38BDF8]">Activo</span>' : ''}
            `;
            listEl.appendChild(btn);
        });
    } catch (e) {
        console.error("Error loading users dropdown:", e);
    }
}

function toggleUserDropdown(forceState = null) {
    const dropdown = document.getElementById("user-profile-dropdown");
    if (!dropdown) return;
    if (forceState !== null) {
        if (forceState) dropdown.classList.remove("hidden");
        else dropdown.classList.add("hidden");
    } else {
        dropdown.classList.toggle("hidden");
    }
}

// Cerrar dropdown al hacer click fuera
document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("user-profile-dropdown");
    const userBtn = document.getElementById("user-menu-btn");
    if (dropdown && !dropdown.classList.contains("hidden")) {
        if (!dropdown.contains(e.target) && (!userBtn || !userBtn.contains(e.target))) {
            dropdown.classList.add("hidden");
        }
    }
});

async function switchUserProfile(userId) {
    try {
        const res = await fetch('/api/auth/switch-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            toggleUserDropdown(false);
            await loadCurrentUserProfile();
            await loadInbox();
            if (typeof loadOperatorAssignments === 'function') {
                await loadOperatorAssignments(true);
            }
            if (typeof loadCoordinatorTriage === 'function') {
                await loadCoordinatorTriage();
            }
            if (typeof loadCurrentWorkload === 'function') {
                await loadCurrentWorkload();
            }
            if (window.currentDashboardView === 'audit') {
                await loadAuditLogs();
            }
        }
    } catch (e) {
        console.error("Error switching user profile:", e);
    }
}

async function logoutSession() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) {
        window.location.href = '/login';
    }
}

// =============================================================
// TOAST NOTIFICATIONS (TELECOM PRECISION ANALYTICS)
// =============================================================

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById("toast-container");
    if (!container) {
        const legacy = document.getElementById("toast-notification");
        const legacyMsg = document.getElementById("toast-message");
        if (legacy && legacyMsg) {
            legacyMsg.innerText = message;
            legacy.classList.remove("translate-y-24", "opacity-0");
            legacy.classList.add("translate-y-0", "opacity-100");
            setTimeout(() => {
                legacy.classList.add("translate-y-24", "opacity-0");
                legacy.classList.remove("translate-y-0", "opacity-100");
            }, duration);
        }
        return;
    }

    const toast = document.createElement("div");
    toast.className = "pointer-events-auto flex items-center gap-3 py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 text-[#0b1c30] dark:text-white border shadow-lg transition-all duration-300 transform -translate-y-2 opacity-0 text-xs";

    let iconSvg = '';
    let borderColor = '';
    if (type === 'success') {
        borderColor = 'border-l-4 border-l-emerald-500 border-slate-200/80 dark:border-slate-700';
        iconSvg = `<div class="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>`;
    } else if (type === 'error') {
        borderColor = 'border-l-4 border-l-rose-500 border-slate-200/80 dark:border-slate-700';
        iconSvg = `<div class="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>`;
    } else if (type === 'warning') {
        borderColor = 'border-l-4 border-l-amber-500 border-slate-200/80 dark:border-slate-700';
        iconSvg = `<div class="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>`;
    } else {
        borderColor = 'border-l-4 border-l-[#0057cd] border-slate-200/80 dark:border-slate-700';
        iconSvg = `<div class="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0057cd] dark:text-blue-400 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </div>`;
    }

    toast.className += ` ${borderColor}`;
    toast.innerHTML = `
        ${iconSvg}
        <div class="flex-1 pr-2 font-medium leading-snug">${escapeHtml(message)}</div>
        <button type="button" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs shrink-0 cursor-pointer p-0.5 rounded transition" onclick="this.parentElement.remove()">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove("-translate-y-2", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
    });

    setTimeout(() => {
        toast.classList.remove("translate-y-0", "opacity-100");
        toast.classList.add("-translate-y-2", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// =============================================================
// COLA DE DESPACHO (TABLERO DE TICKETS — STITCH UI)
// =============================================================

function mapAreaFilterTag(area) {
    const a = (area || '').toLowerCase();
    if (a.includes('ftth') || a.includes('acceso') || a.includes('aprovision')) return 'ftth';
    if (a.includes('cabecera') || a.includes('olt') || a.includes('wan')) return a.includes('wan') && !a.includes('olt') ? 'wan' : 'olt';
    if (a.includes('voip') || a.includes('telef')) return 'voip';
    return 'wan';
}

function buildDispatchPriorityBadge(t) {
    const pts = t.suggested_points || 3;
    const prioLabel = t.priority ? `${t.priority} - ${pts >= 8 ? 'Crítico' : pts >= 5 ? 'Alto' : 'Estándar'}` : (pts >= 8 ? 'P1 - Crítico' : pts >= 5 ? 'P2 - Alto' : 'P3 - Estándar');
    const isP1 = pts >= 8 || (String(t.priority || '').toUpperCase() === 'P1') || (String(t.priority || '').toUpperCase() === 'P5');
    if (isP1) {
        return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-500/30 flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-indicator"></span>${prioLabel}</span>`;
    }
    if (pts >= 5 || String(t.priority || '').toUpperCase() === 'P2') {
        return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-300 w-max">${prioLabel}</span>`;
    }
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#1C58A8] border border-blue-200 w-max">${prioLabel}</span>`;
}

async function loadDispatchQueue() {
    const tbody = document.getElementById('ticket-table-rows');
    const emptyEl = document.getElementById('queue-empty-state');
    const spin = document.getElementById('refresh-spin-icon');
    if (spin) spin.classList.add('animate-spin');

    try {
        const user = window.currentUser;
        const deptoParam = user && user.departamento_id ? `&departamento_id=${user.departamento_id}` : '';
        const areaParam = user && user.area ? `area=${encodeURIComponent(user.area)}` : 'area=Todas';
        const res = await fetch(`/api/tickets/unassigned?${areaParam}${deptoParam}`, { credentials: 'include' });
        if (!res.ok) {
            showToast('No se pudo cargar la cola de despacho', 'error');
            return;
        }
        const tickets = await res.json();
        renderDispatchQueue(Array.isArray(tickets) ? tickets : []);
    } catch (e) {
        console.error('loadDispatchQueue', e);
        showToast('Error de conexión al cargar tickets', 'error');
    } finally {
        if (spin) setTimeout(() => spin.classList.remove('animate-spin'), 400);
    }
}

function renderDispatchQueue(tickets) {
    const tbody = document.getElementById('ticket-table-rows');
    const emptyEl = document.getElementById('queue-empty-state');
    if (!tbody) return;

    if (!tickets.length) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        updateDispatchQueueBadges(0);
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');

    tbody.innerHTML = tickets.slice(0, 50).map(t => {
        const code = t.ticket_code ? (t.ticket_code.startsWith('#') ? t.ticket_code : '#' + t.ticket_code) : `#INC-${t.id}`;
        const client = escapeHtml(t.subscriber_code || t.sender_email || 'Solicitante NOC');
        const subject = escapeHtml(t.subject || 'Incidencia de Telecomunicaciones');
        const area = escapeHtml(t.area || t.departamento_nombre || 'Redes de Acceso');
        const areaTag = mapAreaFilterTag(t.area || t.departamento_nombre);
        const prioBadge = buildDispatchPriorityBadge(t);
        const prioLabel = t.priority || 'P3';
        const safeSerial = escapeHtml(t.serial_pon || '—');
        const safeSlot = escapeHtml(t.slot_pon || '—');

        return `
        <tr class="hover:bg-blue-50/40 transition-colors" data-area="${areaTag}" data-ticket="${code}" data-rawid="${t.id}">
            <td class="py-2.5 px-3 font-mono font-bold text-[#1C58A8]">${code}</td>
            <td class="py-2.5 px-3 font-medium text-gray-900">${client}</td>
            <td class="py-2.5 px-3 text-gray-700 max-w-xs truncate" title="${subject}">${subject}</td>
            <td class="py-2.5 px-3 text-gray-600 font-medium">${area}</td>
            <td class="py-2.5 px-3">${prioBadge}</td>
            <td class="py-2.5 px-3">
                <button type="button" onclick="openTicketWorkspace(${t.id})" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-[#1C58A8] hover:text-[#1C58A8] transition shadow-2xs btn-press">
                    <i data-lucide="file-text" class="w-3 h-3 text-gray-500"></i>Abrir detalles
                </button>
            </td>
            <td class="py-2.5 px-3 text-right">
                <button onclick="promptAssignTicket('${code}', '${area.replace(/'/g, "\\'")}', ${t.id})" class="px-3 py-1 rounded-md bg-[#0056B3] hover:bg-[#1C58A8] text-white text-[11px] font-bold shadow-2xs transition btn-press">Asignar Ahora</button>
            </td>
        </tr>`;
    }).join('');

    if (window.lucide) lucide.createIcons();
    updateDispatchQueueBadges(tickets.length);
}

function updateDispatchQueueBadges(total) {
    ['queue-badge-count', 'kpi-queue-count', 'sidebar-inbox-badge', 'sub-badge-count'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = id === 'queue-badge-count' ? `${total} Tickets` : String(total);
    });
}

async function loadTableroOperators() {
    const user = window.currentUser;
    const area = user && user.area ? user.area : '';
    const deptoParam = user && user.departamento_id ? `&departamento_id=${user.departamento_id}` : '';
    try {
        const res = await fetch(`/api/operators/availability?area=${encodeURIComponent(area)}${deptoParam}`, { credentials: 'include' });
        if (!res.ok) return;
        const ops = await res.json();
        if (!Array.isArray(ops)) return;

        const totalEl = document.getElementById('kpi-total-ops');
        const availEl = document.getElementById('kpi-avail-count');
        const progEl = document.getElementById('kpi-in-progress-count');
        if (totalEl) totalEl.textContent = ops.length;
        const avail = ops.filter(o => (o.active_tickets_count || 0) === 0).length;
        const busy = ops.length - avail;
        if (availEl) availEl.textContent = avail;
        if (progEl) progEl.textContent = busy;

        if (typeof loadCurrentWorkload === 'function') {
            loadCurrentWorkload(user && user.area ? user.area : 'Todas');
        }
    } catch (e) {
        console.warn('loadTableroOperators', e);
    }
}

// =============================================================
// MESA DE ASIGNACIÓN (TRIAGE) - EXCLUSIVA PARA COORDINACIÓN
// =============================================================

window.currentTriageOperators = [];

function getPriorityBadgeClass(p) {
    const pri = (p || '').toUpperCase();
    if (pri === 'P1') return 'bg-rose-50 text-rose-700 border border-rose-200';
    if (pri === 'P2') return 'bg-amber-50 text-amber-800 border border-amber-200';
    if (pri === 'P3') return 'bg-blue-50 text-blue-800 border border-blue-200';
    if (pri === 'P4') return 'bg-surface-container-low text-on-surface-variant border border-outline-variant';
    return 'bg-surface-container-low text-on-surface-variant border border-outline-variant';
}

function getPriorityBarClass(p) {
    const pri = (p || '').toUpperCase();
    if (pri === 'P1') return 'bg-error';
    if (pri === 'P2') return 'bg-amber-500';
    if (pri === 'P3') return 'bg-blue-500';
    return 'bg-outline';
}

function getPrioritySeverityName(p) {
    const pri = (p || '').toUpperCase();
    if (pri === 'P1') return 'CRÍTICO';
    if (pri === 'P2') return 'ALTO';
    if (pri === 'P3') return 'MEDIO';
    return 'PROGRAMADO';
}

function calcWaitTime(dateStr) {
    if (!dateStr) return 'Reciente';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Reciente';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return 'Hace un momento';
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '< 1 min';
    if (diffMin < 60) return `${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
}

function buildOperatorOptions(operators) {
    if (!operators || operators.length === 0) {
        return '<option value="" disabled selected>No hay especialistas disponibles</option>';
    }
    let html = '<option value="" disabled selected>Seleccionar especialista...</option>';
    operators.forEach(op => {
        const ptsText = `${op.active_points || 0} pts`;
        const casesText = `${op.active_tickets_count || 0} caso${op.active_tickets_count === 1 ? '' : 's'}`;
        const sat = op.saturation_level || 'Disponible';
        html += `<option value="${op.id}">${escapeHtml(op.name)} (${ptsText} • ${casesText} - ${sat})</option>`;
    });
    return html;
}

function renderTriageRow(t) {
    const p = (t.priority || 'P3').toUpperCase();
    const pBadgeClass = getPriorityBadgeClass(p);
    const pBarColor = getPriorityBarClass(p);
    const pSeverity = getPrioritySeverityName(p);
    const safeSubject = escapeHtml(t.subject || 'Sin asunto');
    const safeSender = escapeHtml(t.sender_email || t.requester || 'NOC / Solicitud');
    const safeNode = escapeHtml(t.node_name || 'Nodo Central');
    const safeSubscriber = escapeHtml(t.subscriber_code || 'Abonado');
    const techDetails = [t.slot_pon, t.serial_pon, t.mac_address].filter(Boolean).map(escapeHtml).join(' • ');
    const points = t.suggested_points || 1;
    const taskName = escapeHtml(t.suggested_task_name || 'Incidencia de Área');
    const sla = t.sla_minutes || 30;
    const waitTime = calcWaitTime(t.fecha_creacion || t.created_at);
    const opOptions = buildOperatorOptions(window.currentTriageOperators || []);

    return `
    <tr id="triage-row-${t.id}" class="hover:bg-slate-50/70 transition-colors relative group border-b border-slate-100">
        <td class="py-3.5 pl-4 pr-3 align-middle">
            <div class="flex items-center gap-2.5">
                <span class="w-1.5 h-9 rounded-full ${pBarColor} shrink-0" title="Severidad ${p}"></span>
                <div class="flex flex-col">
                    <button onclick="openTicketWorkspace ? openTicketWorkspace(${t.id}) : openTicketFromWorkload(${t.id})" class="font-mono text-xs font-bold text-[#1C58A8] hover:text-[#154687] text-left transition cursor-pointer" title="Ver detalles del ticket">
                        #${escapeHtml(t.ticket_code || t.id)}
                    </button>
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${pBadgeClass} mt-1 w-fit">
                        ${p} ${pSeverity}
                    </span>
                </div>
            </div>
        </td>
        <td class="py-3.5 px-3 align-middle max-w-[260px]">
            <div class="flex flex-col">
                <span class="font-semibold text-slate-800 text-xs line-clamp-1 truncate" title="${safeSubject}">
                    ${safeSubject}
                </span>
                <div class="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5" title="${safeSender}">
                    <i data-lucide="mail" class="w-3 h-3 text-slate-400"></i>
                    <span class="truncate"><span class="font-medium text-slate-500">De:</span> ${safeSender}</span>
                </div>
            </div>
        </td>
        <td class="py-3.5 px-3 align-middle whitespace-nowrap">
            <div class="flex flex-col text-xs font-mono">
                <span class="text-slate-800 font-semibold">${safeNode}</span>
                <span class="text-slate-400 text-[11px]">${safeSubscriber}</span>
                ${techDetails ? `<span class="text-slate-500 text-[10px] mt-0.5 truncate max-w-[190px]" title="${techDetails}">${techDetails}</span>` : ''}
            </div>
        </td>
        <td class="py-3.5 px-3 align-middle whitespace-nowrap">
            <div class="flex flex-col">
                <div class="flex items-center gap-1.5">
                    <span class="font-medium text-slate-800 text-xs truncate max-w-[160px]" title="${taskName}">${taskName}</span>
                    <span class="px-1.5 py-0.2 rounded-md bg-blue-50 text-[#1C58A8] font-mono text-[10px] font-bold border border-blue-100/80">+${points} pts</span>
                </div>
                <span class="text-[10px] text-slate-400 mt-0.5">SLA: <strong>${sla}m</strong></span>
            </div>
        </td>
        <td class="py-3.5 px-3 align-middle whitespace-nowrap">
            <span class="font-mono text-xs font-bold text-slate-700">${waitTime}</span>
        </td>
        <td class="py-3.5 pl-3 pr-4 align-middle whitespace-nowrap">
            <!-- Selector de Asignación Sutil y Minimalista (Stitch Design) -->
            <div class="flex items-center gap-2">
                <div class="relative flex-1 min-w-[200px] max-w-[240px]">
                    <select id="select-operator-${t.id}" data-ticket-id="${t.id}" class="select-operator w-full appearance-none bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white border border-slate-200/90 text-slate-800 text-xs rounded-xl pl-3 pr-8 py-2 outline-none focus:border-[#1C58A8] focus:ring-2 focus:ring-blue-100/60 transition cursor-pointer font-medium shadow-2xs">
                        ${opOptions}
                    </select>
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                </div>
                <button id="btn-assign-${t.id}" onclick="assignTriageTicket(${t.id})" disabled class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C58A8] hover:bg-[#154687] text-white text-xs font-semibold shadow-xs hover:shadow transition duration-150 active:scale-95 cursor-pointer shrink-0 opacity-50 cursor-not-allowed" type="button" title="Asignar caso al especialista seleccionado">
                    <i data-lucide="send" class="w-3 h-3"></i>
                    <span>Asignar</span>
                </button>
            </div>
        </td>
    </tr>
    `;
}

function checkCoordinatorRoleAndInitTriage(user) {
    const triagePanel = document.getElementById("coordinator-triage-panel");
    const tabBtnCoordinacion = document.getElementById("tab-btn-coordinacion");
    const navViewCoordinacion = document.getElementById("nav-view-coordinacion");

    const isCoordinator = user && (user.role === 'COORDINADOR' || user.role === 'ADMINISTRADOR');
    if (isCoordinator) {
        if (triagePanel) triagePanel.classList.remove("hidden");
        if (tabBtnCoordinacion) tabBtnCoordinacion.classList.remove("hidden");
        if (navViewCoordinacion) navViewCoordinacion.classList.remove("hidden");
        const areaBadge = document.getElementById("triage-area-badge");
        if (areaBadge && user.area) {
            areaBadge.textContent = "Área: " + user.area;
        }
        loadCoordinatorTriage();
    } else {
        if (triagePanel) triagePanel.classList.add("hidden");
        if (tabBtnCoordinacion) tabBtnCoordinacion.classList.add("hidden");
        if (navViewCoordinacion) navViewCoordinacion.classList.add("hidden");
    }
}

async function loadCoordinatorTriage() {
    const panel = document.getElementById("coordinator-triage-panel");
    const tbody = document.getElementById("triage-tickets-tbody");
    const container = document.getElementById("triage-table-container");
    const emptyState = document.getElementById("triage-empty-state");
    const countLabel = document.getElementById("triage-count-label");
    const areaBadge = document.getElementById("triage-area-badge");
    const refreshIcon = document.getElementById("icon-refresh-triage");

    if (!panel || !tbody) return;

    const user = window.currentUser;
    if (!user || (user.role !== 'COORDINADOR' && user.role !== 'ADMINISTRADOR')) {
        panel.classList.add("hidden");
        return;
    }

    const area = user.area || '';
    if (areaBadge) {
        areaBadge.textContent = "Área: " + (area || "No especificada");
    }

    if (refreshIcon) refreshIcon.classList.add("animate-spin");

    try {
        // 1. Obtener operadores disponibles del área ordenados por menor carga
        const deptoParam = user.departamento_id ? `&departamento_id=${user.departamento_id}` : '';
        const opsUrl = `/api/operators/availability?area=${encodeURIComponent(area)}${deptoParam}`;
        const opsRes = await fetch(opsUrl, { credentials: 'include' });
        if (opsRes.ok) {
            window.currentTriageOperators = await opsRes.json();
        } else {
            window.currentTriageOperators = [];
        }

        // 2. Obtener tickets pendientes no asignados del área
        const ticketsUrl = `/api/tickets/unassigned?area=${encodeURIComponent(area)}${deptoParam}`;
        const tRes = await fetch(ticketsUrl, { credentials: 'include' });
        
        if (!tRes.ok) {
            const errData = await tRes.json().catch(() => ({}));
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-6 text-center text-rose-600 dark:text-rose-400 text-xs">
                        <div class="flex items-center justify-center gap-2">
                            <i data-lucide="alert-circle" class="w-4 h-4"></i>
                            <span>${escapeHtml(errData.error || "Error consultando tickets sin asignar")}</span>
                        </div>
                    </td>
                </tr>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const tickets = await tRes.json();

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '';
            if (container) container.classList.add("hidden");
            if (emptyState) emptyState.classList.remove("hidden");
            if (countLabel) countLabel.textContent = "0 casos pendientes";
        } else {
            if (container) container.classList.remove("hidden");
            if (emptyState) emptyState.classList.add("hidden");
            if (countLabel) {
                countLabel.textContent = tickets.length === 1 ? "1 caso en espera" : `${tickets.length} casos en espera`;
            }

            tbody.innerHTML = tickets.map(t => renderTriageRow(t)).join('');
            if (window.lucide) lucide.createIcons();
            wireTriageAssignButtons();
        }

        // Sincronizar Módulo de Asignación Rápida
        if (typeof populateQuickAssignControls === 'function') {
            populateQuickAssignControls(tickets || [], window.currentTriageOperators || []);
        }
    } catch (e) {
        console.error("Error cargando Mesa de Asignación:", e);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-6 text-center text-rose-600 text-xs">
                    Error de conexión al cargar la Mesa de Asignación.
                </td>
            </tr>
        `;
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove("animate-spin"), 400);
        }
    }
}

async function refreshTriageOperators() {
    const user = window.currentUser;
    if (!user || !user.area) return;
    try {
        const opsUrl = `/api/operators/availability?area=${encodeURIComponent(user.area)}`;
        const res = await fetch(opsUrl);
        if (res.ok) {
            window.currentTriageOperators = await res.json();
            const selects = document.querySelectorAll("#triage-tickets-tbody select.select-operator, #triage-tickets-tbody select[id^='select-operator-'], #triage-tickets-tbody select[id^='triage-op-']");
            selects.forEach(sel => {
                const currentVal = sel.value;
                sel.innerHTML = buildOperatorOptions(window.currentTriageOperators);
                if (currentVal) sel.value = currentVal;
            });
        }
    } catch (e) {
        console.error("Error refreshing triage operators:", e);
    }
}

async function assignTriageTicket(ticketId) {
    const selectEl = document.getElementById(`select-operator-${ticketId}`)
                  || document.getElementById(`triage-op-${ticketId}`)
                  || document.getElementById("select-operator");
    if (!selectEl) return;

    const opId = selectEl.value;
    if (!opId) {
        showToast("Seleccione un especialista para asignar el caso", "warning");
        selectEl.focus();
        return;
    }

    const btn = document.getElementById(`btn-assign-${ticketId}`);
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg> Asignando...`;
    }

    try {
        const res = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operador_id: parseInt(opId, 10),
                coordinador_id: window.currentUser ? window.currentUser.id : null,
                notas: "Asignado desde Mesa de Asignación (Triage)"
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Eliminar la fila de la tabla visualmente mediante manipulación del DOM con animación
            const row = document.getElementById(`triage-row-${ticketId}`);
            if (row) {
                row.style.transition = "all 0.35s ease-out";
                row.style.transform = "translateX(30px)";
                row.style.opacity = "0";
                row.style.backgroundColor = "#ecfdf5";
                setTimeout(() => {
                    row.remove();
                    checkTriageTableEmpty();
                }, 350);
            }

            showToast(data.message || `Ticket #${ticketId} asignado exitosamente`, "success");

            // Refrescar lista de operadores disponibles (para actualizar sus puntos en los otros selects)
            refreshTriageOperators();

            // Refrescar monitores operativos del dashboard si están presentes
            if (typeof loadCurrentWorkload === 'function') {
                loadCurrentWorkload();
            }
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
            if (typeof loadInbox === 'function') {
                loadInbox();
            }
            if (typeof loadDispatchQueue === 'function') {
                loadDispatchQueue();
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
            showToast(data.error || "No se pudo asignar el ticket.", "error");
        }
    } catch (e) {
        console.error("Error asignando ticket:", e);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
        showToast("Error de conexión al asignar el ticket.", "error");
    }
}

function wireTriageAssignButtons() {
    document.querySelectorAll('#triage-tickets-tbody select.select-operator[data-ticket-id]').forEach(sel => {
        const tid = sel.getAttribute('data-ticket-id');
        const btn = document.getElementById(`btn-assign-${tid}`);
        if (!btn || sel.dataset.wired === '1') return;
        sel.dataset.wired = '1';
        const syncDisabled = () => {
            const hasOp = !!sel.value;
            btn.disabled = !hasOp;
            btn.classList.toggle('opacity-50', !hasOp);
            btn.classList.toggle('cursor-not-allowed', !hasOp);
        };
        syncDisabled();
        sel.addEventListener('change', syncDisabled);
    });
}

function checkTriageTableEmpty() {
    const tbody = document.getElementById("triage-tickets-tbody");
    const container = document.getElementById("triage-table-container");
    const emptyState = document.getElementById("triage-empty-state");
    const countLabel = document.getElementById("triage-count-label");

    if (!tbody) return;
    const remainingRows = tbody.querySelectorAll("tr[id^='triage-row-']");
    const count = remainingRows.length;

    if (countLabel) {
        countLabel.textContent = count === 1 ? "1 caso en espera" : `${count} casos en espera`;
    }

    if (count === 0) {
        if (container) container.classList.add("hidden");
        if (emptyState) emptyState.classList.remove("hidden");
        if (countLabel) countLabel.textContent = "0 casos pendientes";
    } else {
        if (container) container.classList.remove("hidden");
        if (emptyState) emptyState.classList.add("hidden");
    }
}

// =============================================================
// MÓDULO DE ASIGNACIÓN RÁPIDA (STITCH CORPORATE MINIMALISTA)
// =============================================================

function populateQuickAssignControls(tickets, operators) {
    const ticketSelect = document.getElementById("quick-ticket-select");
    const opSelect = document.getElementById("quick-operator-select");
    const countBadge = document.getElementById("quick-ticket-count-badge");

    if (countBadge) {
        countBadge.textContent = `${tickets.length} en cola`;
    }

    if (ticketSelect) {
        const curVal = ticketSelect.value;
        let html = '<option value="">Seleccione un ticket pendiente...</option>';
        tickets.forEach(t => {
            const shortSubj = (t.subject || '').substring(0, 45);
            html += `<option value="${t.id}" data-task-id="${t.suggested_task_id || ''}" data-points="${t.suggested_points || 5}" data-code="${t.ticket_code}">${t.ticket_code} · ${escapeHtml(shortSubj)}</option>`;
        });
        ticketSelect.innerHTML = html;
        if (curVal && tickets.some(t => String(t.id) === String(curVal))) {
            ticketSelect.value = curVal;
        }
    }

    if (opSelect) {
        const curOp = opSelect.value;
        let html = '<option value="">Seleccione especialista...</option>';
        operators.forEach(op => {
            html += `<option value="${op.id}">${op.name} (${op.active_points} pts activos · ${op.saturation_level || 'Disponible'})</option>`;
        });
        opSelect.innerHTML = html;
        if (curOp && operators.some(o => String(o.id) === String(curOp))) {
            opSelect.value = curOp;
        }
    }
}

function onQuickTicketChange(ticketId) {
    const ticketSelect = document.getElementById("quick-ticket-select");
    const taskSelect = document.getElementById("quick-task-select");
    if (!ticketSelect || !ticketId) return;

    const opt = ticketSelect.options[ticketSelect.selectedIndex];
    if (!opt) return;

    const taskId = opt.getAttribute("data-task-id");
    const pts = opt.getAttribute("data-points");

    if (taskSelect && taskId) {
        taskSelect.value = taskId;
        onQuickTaskChange(pts);
    }
}

function onQuickTaskChange(val) {
    const taskSelect = document.getElementById("quick-task-select");
    const dersBadge = document.getElementById("quick-ders-badge");
    if (!dersBadge) return;

    let pts = val;
    if (taskSelect) {
        const opt = taskSelect.options[taskSelect.selectedIndex];
        if (opt && opt.getAttribute("data-points")) {
            pts = opt.getAttribute("data-points");
        }
    }
    dersBadge.textContent = `+${pts || 5} pts DERS`;
}

async function handleQuickAssignSubmit(event) {
    if (event) event.preventDefault();
    const ticketSelect = document.getElementById("quick-ticket-select");
    const taskSelect = document.getElementById("quick-task-select");
    const opSelect = document.getElementById("quick-operator-select");
    const btn = document.getElementById("btn-quick-assign");

    if (!ticketSelect || !opSelect) return;
    const ticketId = ticketSelect.value;
    const opId = opSelect.value;
    const taskTypeId = taskSelect ? taskSelect.value : null;

    if (!ticketId) {
        showStitchSuccessToast("Atención", "Por favor seleccione un ticket pendiente de la cola.");
        ticketSelect.focus();
        return;
    }
    if (!opId) {
        showStitchSuccessToast("Atención", "Por favor seleccione un especialista para asignar.");
        opSelect.focus();
        return;
    }

    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Asignando...`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const payload = {
            operador_id: parseInt(opId, 10),
            task_type_id: taskTypeId ? parseInt(taskTypeId, 10) : null,
            status: "ASIGNADO",
            notas: "Despachado desde Módulo de Asignación Rápida"
        };
        const res = await fetch(`/api/tickets/${ticketId}/assign`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            showStitchSuccessToast("¡Asignación Exitosa!", data.message || `Ticket asignado exitosamente.`);
            // Refrescar Mesa de Asignación y Operadores
            await loadCoordinatorTriage();
            // Refrescar Vista Operativa para ver rendimiento
            if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
            if (typeof loadDashboardData === 'function') loadDashboardData();
            // Refrescar Mis Asignaciones del operador
            loadOperatorAssignments(true);
        } else {
            showStitchSuccessToast("Error de Asignación", data.error || "No se pudo asignar el caso.");
        }
    } catch (e) {
        console.error("Error en asignación rápida:", e);
        showStitchSuccessToast("Error de Conexión", "No se pudo conectar con el servidor.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// =============================================================
// PANEL DEL OPERADOR: TORRE DE EJECUCIÓN & GESTIÓN DE TAREAS
// =============================================================

window._allOperatorAssignments = [];
window._currentOperatorFilter = 'all';
window._knownAssignedTicketIds = new Set();
window._hasInitialAssignmentsLoaded = false;
let _cardTimerInterval = null;

async function loadOperatorAssignments(isManual = false) {
    const listContainer = document.getElementById("operator-assignments-list");
    const refreshIcon = document.getElementById("icon-refresh-operator");

    if (refreshIcon && isManual) refreshIcon.classList.add("animate-spin");

    try {
        const res = await fetch('/api/tickets/my-assignments?filter_status=all', { credentials: 'include' });
        if (!res.ok) return;
        const tickets = await res.json();
        window._allOperatorAssignments = tickets || [];

        // 1. Detección de tickets nuevos para disparar Toast de notificación elegante
        if (window._hasInitialAssignmentsLoaded) {
            for (const t of tickets) {
                if (!window._knownAssignedTicketIds.has(t.id) && (t.status === 'ASIGNADO' || t.status === 'PENDIENTE')) {
                    showStitchAssignmentToast(t);
                    break;
                }
            }
        }

        window._knownAssignedTicketIds = new Set(tickets.map(t => t.id));
        window._hasInitialAssignmentsLoaded = true;

        // 2. Actualizar contadores y pastillas de estado
        updateOperatorFilterCounts(tickets);

        // 3. Renderizar según el filtro activo y búsqueda
        filterOperatorAssignmentsLocal();

        // 4. Iniciar cronómetro de tarjetas activas
        startCardTimers();
    } catch (e) {
        console.error("Error consultando mis asignaciones:", e);
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove("animate-spin"), 400);
        }
    }
}

function updateOperatorFilterCounts(tickets) {
    const all = tickets || [];
    const countAll = all.length;
    const countPending = all.filter(t => t.status === 'ASIGNADO' || t.status === 'PENDIENTE').length;
    const countProgress = all.filter(t => t.status === 'EN PROGRESO').length;
    const countHold = all.filter(t => t.status === 'EN ESPERA').length;
    const countCompleted = all.filter(t => t.status === 'POR_VERIFICAR' || t.status === 'COMPLETADO').length;

    const elAll = document.getElementById("count-optab-all");
    const elPending = document.getElementById("count-optab-pending");
    const elProgress = document.getElementById("count-optab-progress");
    const elHold = document.getElementById("count-optab-hold");
    const elCompleted = document.getElementById("count-optab-completed");
    const badgeCount = document.getElementById("operator-assignments-count");
    const sidebarBadge = document.getElementById("sidebar-operator-badge");
    const ptsBadge = document.getElementById("operator-active-points-badge");

    if (elAll) elAll.textContent = countAll;
    if (elPending) elPending.textContent = countPending;
    if (elProgress) elProgress.textContent = countProgress;
    if (elHold) elHold.textContent = countHold;
    if (elCompleted) elCompleted.textContent = countCompleted;
    
    if (badgeCount) badgeCount.textContent = `${countAll} tickets`;
    
    // Sidebar badge muestra casos activos (por iniciar + en progreso)
    const activeUrgent = countPending + countProgress;
    if (sidebarBadge) {
        sidebarBadge.textContent = activeUrgent;
        sidebarBadge.classList.toggle("hidden", activeUrgent === 0);
    }

    // Calcular puntos de carga activa
    const activePoints = all.filter(t => t.status === 'EN PROGRESO').reduce((sum, t) => sum + (t.suggested_points || 0), 0);
    if (ptsBadge) {
        ptsBadge.textContent = `Carga Activa: ${activePoints} pts`;
    }
}

function setOperatorTaskFilter(filterName) {
    window._currentOperatorFilter = filterName;
    
    const mapping = {
        'all': 'optab-all',
        'pending_start': 'optab-pending',
        'in_progress': 'optab-progress',
        'on_hold': 'optab-hold',
        'completed': 'optab-completed'
    };

    Object.keys(mapping).forEach(k => {
        const btn = document.getElementById(mapping[k]);
        if (!btn) return;
        if (k === filterName) {
            btn.className = "px-3 py-1.5 rounded-lg bg-white font-bold text-slate-900 shadow-2xs transition cursor-pointer flex items-center gap-1.5 border border-slate-200/60";
        } else {
            btn.className = "px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-medium transition cursor-pointer flex items-center gap-1.5";
        }
    });

    filterOperatorAssignmentsLocal();
}

function filterOperatorAssignmentsLocal() {
    const listContainer = document.getElementById("operator-assignments-list");
    const emptyNotice = document.getElementById("operator-empty-assignments");
    const searchInput = document.getElementById("operator-task-search");
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();

    const all = window._allOperatorAssignments || [];
    
    const filtered = all.filter(t => {
        const st = (t.status || '').toUpperCase();
        if (window._currentOperatorFilter === 'pending_start' && st !== 'ASIGNADO' && st !== 'PENDIENTE') return false;
        if (window._currentOperatorFilter === 'in_progress' && st !== 'EN PROGRESO') return false;
        if (window._currentOperatorFilter === 'on_hold' && st !== 'EN ESPERA') return false;
        if (window._currentOperatorFilter === 'completed' && st !== 'POR_VERIFICAR' && st !== 'COMPLETADO') return false;

        if (query) {
            const matchCode = (t.ticket_code || '').toLowerCase().includes(query);
            const matchSubj = (t.subject || '').toLowerCase().includes(query);
            const matchNode = (t.node_name || '').toLowerCase().includes(query);
            const matchAbon = (t.subscriber_code || '').toLowerCase().includes(query);
            const matchTask = (t.suggested_task_name || '').toLowerCase().includes(query);
            if (!matchCode && !matchSubj && !matchNode && !matchAbon && !matchTask) return false;
        }

        return true;
    });

    if (!listContainer) return;

    if (filtered.length === 0) {
        listContainer.innerHTML = '';
        if (emptyNotice) {
            emptyNotice.classList.remove("hidden");
            const emptyTitle = document.getElementById("operator-empty-title");
            const emptyDesc = document.getElementById("operator-empty-desc");
            if (query) {
                if (emptyTitle) emptyTitle.textContent = "No se encontraron tareas coincidentes";
                if (emptyDesc) emptyDesc.textContent = `No hay tareas asignadas que coincidan con la búsqueda "${query}".`;
            } else {
                if (emptyTitle) emptyTitle.textContent = "¡Bandeja de Tareas al Día!";
                if (emptyDesc) emptyDesc.textContent = "No tienes tareas en esta categoría en este momento.";
            }
        }
    } else {
        if (emptyNotice) emptyNotice.classList.add("hidden");
        listContainer.innerHTML = filtered.map(t => renderOperatorAssignmentCard(t)).join('');
        if (window.lucide) lucide.createIcons();
    }
}

function startCardTimers() {
    if (_cardTimerInterval) clearInterval(_cardTimerInterval);
    
    function updateTimers() {
        const timerEls = document.querySelectorAll(".card-live-timer");
        if (!timerEls || timerEls.length === 0) return;
        
        const now = Date.now();
        timerEls.forEach(el => {
            const startStr = el.getAttribute("data-live-timer-start");
            const pausedSec = parseInt(el.getAttribute("data-paused-seconds") || "0", 10);
            if (!startStr) return;
            try {
                const startMs = new Date(startStr.replace(' ', 'T')).getTime();
                const diffSec = Math.max(0, Math.floor((now - startMs - (pausedSec * 1000)) / 1000));
                const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
                const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
                const secs = String(diffSec % 60).padStart(2, '0');
                el.textContent = `${hrs}:${mins}:${secs}`;
            } catch (e) {}
        });
    }

    updateTimers();
    _cardTimerInterval = setInterval(updateTimers, 1000);
}

function renderOperatorAssignmentCard(t) {
    const st = (t.status || '').toUpperCase();
    const pts = t.suggested_points || 1;
    const prio = t.priority || (pts >= 8 ? 'P5' : pts >= 5 ? 'P4' : pts >= 3 ? 'P3' : 'P2');
    const taskName = escapeHtml(t.suggested_task_name || 'Atención Técnica de Fallas');
    const subject = escapeHtml(t.subject || 'Sin asunto');
    const subscriber = t.subscriber_code ? `<span class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60"><strong class="text-slate-400 font-normal">Abonado:</strong> ${escapeHtml(t.subscriber_code)}</span>` : '';
    const node = t.node_name ? `<span class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60"><strong class="text-slate-400 font-normal">Nodo:</strong> ${escapeHtml(t.node_name)}</span>` : '';
    const mac = t.mac_address && t.mac_address !== 'N/A' ? `<span class="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60"><strong class="text-slate-400 font-normal">MAC:</strong> ${escapeHtml(t.mac_address)}</span>` : '';
    const area = escapeHtml(t.departamento_nombre || t.area || 'IP');
    const code = escapeHtml(t.ticket_code || 'INC-' + t.id);

    let borderClass = 'border-l-4 border-l-[#1C58A8]';
    let statusBadge = '';
    let actionButtons = '';
    let timerSnippet = '';

    if (st === 'EN PROGRESO') {
        borderClass = 'border-l-4 border-l-emerald-500 bg-emerald-50/10 shadow-xs';
        statusBadge = `
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                En Atención Activa
            </span>
        `;
        timerSnippet = `
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-800">
                <i data-lucide="timer" class="w-3.5 h-3.5 text-emerald-600"></i>
                <span class="text-[11px] font-medium">Cronómetro:</span>
                <span class="font-mono font-bold text-xs card-live-timer" data-live-timer-start="${t.fecha_inicio_atencion || t.claimed_at || ''}" data-paused-seconds="${t.total_paused_seconds || 0}">00:00:00</span>
            </div>
        `;
        actionButtons = `
            <div class="flex flex-wrap items-center gap-2">
                <button onclick="togglePauseTicketDirect(${t.id})" class="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer" title="Pausar atención por espera de campo">
                    <i data-lucide="pause-circle" class="w-3.5 h-3.5"></i>
                    <span>Pausar</span>
                </button>
                <button onclick="openTicketWorkspace(${t.id})" class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer" title="Abrir espacio de trabajo técnico completo">
                    <i data-lucide="cpu" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>Workspace</span>
                </button>
                <button onclick="openQuickResolveModal(${t.id})" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                    <span>Resolver Tarea</span>
                </button>
            </div>
        `;
    } else if (st === 'EN ESPERA') {
        borderClass = 'border-l-4 border-l-amber-500 bg-amber-50/15';
        statusBadge = `
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                En Espera / Pausada
            </span>
        `;
        actionButtons = `
            <div class="flex items-center gap-2">
                <button onclick="openTicketWorkspace(${t.id})" class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Ver Caso</span>
                </button>
                <button onclick="togglePauseTicketDirect(${t.id})" class="px-4 py-2 rounded-xl bg-[#1C58A8] hover:bg-[#154687] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95">
                    <i data-lucide="play" class="w-3.5 h-3.5"></i>
                    <span>Reanudar Tarea</span>
                </button>
            </div>
        `;
    } else if (st === 'POR_VERIFICAR') {
        borderClass = 'border-l-4 border-l-purple-500 bg-purple-50/10';
        statusBadge = `
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                <i data-lucide="clock" class="w-3 h-3 text-purple-600"></i>
                Esperando Aprobación DERS
            </span>
        `;
        actionButtons = `
            <div class="flex items-center gap-2">
                <span class="text-xs text-purple-700 font-medium">✓ Enviado a Coordinación</span>
                <button onclick="openTicketWorkspace(${t.id})" class="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <span>Ver Ficha</span>
                </button>
            </div>
        `;
    } else if (st === 'COMPLETADO') {
        borderClass = 'border-l-4 border-l-slate-300 bg-slate-50/40';
        statusBadge = `
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>
                Cerrado y Puntos Acreditados
            </span>
        `;
        actionButtons = `
            <button onclick="openTicketWorkspace(${t.id})" class="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Ver Registro</span>
            </button>
        `;
    } else {
        // ASIGNADO o PENDIENTE (Por Iniciar)
        borderClass = 'border-l-4 border-l-[#1C58A8] bg-blue-50/5 shadow-xs';
        statusBadge = `
            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1C58A8] border border-blue-200/80 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-[#1C58A8] animate-pulse"></span>
                Asignado · Por Iniciar
            </span>
        `;
        // Botón "Poner en Proceso" diseñado para destacar suavemente (Stitch Minimalista)
        actionButtons = `
            <div class="flex items-center gap-2.5">
                <button onclick="openTicketWorkspace(${t.id})" class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer" title="Revisar información antes de iniciar">
                    <i data-lucide="eye" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Detalles</span>
                </button>
                <button id="btn-process-${t.id}" onclick="startProcessingTicket(${t.id})" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C58A8] hover:bg-[#154687] text-white text-xs font-semibold shadow-xs hover:shadow transition duration-150 active:scale-[0.98] cursor-pointer" title="Poner ticket en atención activa">
                    <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
                    <span>Poner en Proceso</span>
                </button>
            </div>
        `;
    }

    return `
    <div id="card-assignment-${t.id}" class="clean-card p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all duration-200 space-y-3.5 ${borderClass}">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
                <button onclick="navigator.clipboard.writeText('${code}'); showToast('Código copiado: ${code}', 'success');" class="font-mono font-bold text-xs text-[#1C58A8] bg-blue-50/80 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition flex items-center gap-1.5 cursor-pointer shadow-2xs" title="Hacer clic para copiar código">
                    <span>#${code}</span>
                    <i data-lucide="copy" class="w-3 h-3 text-blue-400"></i>
                </button>
                <span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono">
                    ${prio} · ${pts} pts DERS
                </span>
                ${statusBadge}
            </div>
            <div class="flex items-center gap-3">
                ${timerSnippet}
                <div class="flex items-center gap-1 text-slate-400 text-xs font-mono shrink-0">
                    <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                    <span>${t.created_at ? t.created_at.substring(11, 16) : 'Hoy'}</span>
                </div>
            </div>
        </div>

        <div>
            <h3 class="text-sm font-semibold text-slate-900 leading-snug tracking-tight">
                ${subject}
            </h3>
            <div class="flex flex-wrap items-center gap-2 mt-2">
                <span class="text-xs text-slate-600 font-medium">
                    Tarea: <strong class="text-slate-800">${taskName}</strong>
                </span>
                ${node}
                ${subscriber}
                ${mac}
            </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div class="text-xs text-slate-500 flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200/80 font-medium text-slate-700">
                    <i data-lucide="network" class="w-3.5 h-3.5 text-blue-500"></i>
                    ${area}
                </span>
                <span class="text-slate-300">•</span>
                <span>SLA: <strong class="text-slate-700">${t.sla_minutes || 30}m</strong></span>
                <span class="text-slate-300">•</span>
                <span class="text-slate-400 font-mono text-[11px]">${t.sender_email || 'NOC'}</span>
            </div>
            ${actionButtons}
        </div>
    </div>
    `;
}

async function startProcessingTicket(ticketId) {
    const btn = document.getElementById(`btn-process-${ticketId}`);
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-3 h-3 animate-spin"></i> Iniciando...`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await fetch(`/api/tickets/${ticketId}/start`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            showStitchSuccessToast("Ticket En Progreso", `El Ticket #${data.ticket_code || ticketId} ha sido puesto en proceso exitosamente.`);
            await loadOperatorAssignments(true);
            if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
            if (typeof loadDashboardData === 'function') loadDashboardData();
        } else {
            showStitchSuccessToast("Error", data.error || "No se pudo poner el ticket en proceso.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
                if (window.lucide) lucide.createIcons();
            }
        }
    } catch (e) {
        console.error("Error iniciando ticket:", e);
        showStitchSuccessToast("Error", "Error de red al intentar poner el ticket en proceso.");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function togglePauseTicketDirect(ticketId) {
    const t = (window._allOperatorAssignments || []).find(item => item.id === ticketId);
    const isEnProgreso = t && t.status === 'EN PROGRESO';
    const action = isEnProgreso ? 'pause' : 'resume';

    try {
        const res = await fetch(`/api/tickets/${ticketId}/${action}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            const toastTitle = isEnProgreso ? "Tarea en Pausa" : "Tarea Reanudada";
            const toastMsg = isEnProgreso 
                ? `El Ticket #${t?.ticket_code || ticketId} ha sido puesto en espera.` 
                : `El cronómetro del Ticket #${t?.ticket_code || ticketId} continúa corriendo.`;
            showStitchSuccessToast(toastTitle, toastMsg);
            await loadOperatorAssignments(true);
        } else {
            showStitchSuccessToast("Atención", data.error || "No se pudo cambiar el estado de pausa.");
        }
    } catch (e) {
        console.error("Error pausing/resuming ticket direct:", e);
    }
}

function openQuickResolveModal(ticketId) {
    const t = (window._allOperatorAssignments || []).find(item => item.id === ticketId);
    if (!t) return;

    const modal = document.getElementById("modalQuickResolveTicket");
    const idInput = document.getElementById("quick-resolve-ticket-id");
    const codeEl = document.getElementById("quick-resolve-code");
    const dersEl = document.getElementById("quick-resolve-ders");
    const subjEl = document.getElementById("quick-resolve-subject");
    const taskEl = document.getElementById("quick-resolve-task");
    const timerEl = document.getElementById("quick-resolve-timer");
    const notesEl = document.getElementById("quick-resolve-notes");

    if (idInput) idInput.value = t.id;
    if (codeEl) codeEl.textContent = t.ticket_code || `#INC-${t.id}`;
    if (dersEl) dersEl.textContent = `+${t.suggested_points || 2} pts (${t.priority || 'P2'})`;
    if (subjEl) subjEl.textContent = t.subject || 'Sin asunto';
    if (taskEl) taskEl.textContent = t.suggested_task_name || 'Atención Técnica';

    // Calcular tiempo transcurrido
    if (timerEl) {
        let elapsedSec = 60;
        if (t.fecha_inicio_atencion) {
            const startMs = new Date(t.fecha_inicio_atencion.replace(' ', 'T')).getTime();
            const pausedMs = (t.total_paused_seconds || 0) * 1000;
            elapsedSec = Math.max(30, Math.floor((Date.now() - startMs - pausedMs) / 1000));
        }
        const m = Math.floor(elapsedSec / 60);
        const s = elapsedSec % 60;
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    if (notesEl) {
        notesEl.value = '';
        setTimeout(() => notesEl.focus(), 150);
    }

    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
    if (window.lucide) lucide.createIcons();
}

function closeQuickResolveModal() {
    const modal = document.getElementById("modalQuickResolveTicket");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

async function handleQuickResolveSubmit(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById("quick-resolve-ticket-id");
    const notesEl = document.getElementById("quick-resolve-notes");
    const btn = document.getElementById("btn-quick-resolve-submit");

    const ticketId = idInput ? idInput.value : null;
    const notes = notesEl ? notesEl.value.trim() : "";

    if (!ticketId || !notes) {
        showStitchSuccessToast("Campo Obligatorio", "Por favor ingresa las notas de diagnóstico o resolución.");
        if (notesEl) notesEl.focus();
        return;
    }

    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Finalizando...`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await fetch(`/api/tickets/${ticketId}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution_notes: notes
            })
        });
        const data = await res.json();
        if (res.ok) {
            closeQuickResolveModal();
            showStitchSuccessToast(
                "¡Tarea Resuelta!",
                `Ticket ${data.ticket || '#' + ticketId} completado. En espera de aprobación de ${data.suggested_points || ''} pts por Coordinación.`
            );
            await loadOperatorAssignments(true);
            if (typeof loadCoordinatorTriage === 'function') loadCoordinatorTriage();
            if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
        } else {
            showStitchSuccessToast("Error", data.error || "No se pudo completar el ticket.");
        }
    } catch (e) {
        console.error("Error completing ticket:", e);
        showStitchSuccessToast("Error de Conexión", "No se pudo comunicar con el servidor.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function openTicketWorkspace(ticketId) {
    try {
        const res = await fetch(`/api/tickets/${ticketId}`, { credentials: 'include' });
        if (!res.ok) {
            showToast("No se pudo cargar la información técnica del ticket", "error");
            return;
        }
        const t = await res.json();
        currentOpenTicket = t;

        const modal = document.getElementById("modalTicketWorkspace");
        const codeEl = document.getElementById("ws-ticket-code");
        const sourceBadge = document.getElementById("ws-ticket-source-badge");
        const statusBadge = document.getElementById("ws-ticket-status-badge");
        const senderEl = document.getElementById("ws-ticket-sender");
        const subjEl = document.getElementById("ws-ticket-subject");
        const bodyEl = document.getElementById("ws-ticket-body");
        const bridgeAlert = document.getElementById("ws-bridge-alert");
        const subCode = document.getElementById("ws-param-subscriber");
        const serial = document.getElementById("ws-param-serial");
        const node = document.getElementById("ws-param-node");
        const slotpon = document.getElementById("ws-param-slotpon");
        const mac = document.getElementById("ws-param-mac");
        const ptsBadge = document.getElementById("ws-param-points-badge");
        const taskName = document.getElementById("ws-param-taskname");
        const pauseBtnText = document.getElementById("btn-pause-text");

        if (codeEl) codeEl.textContent = t.ticket_code || `#INC-${t.id}`;
        if (sourceBadge) sourceBadge.textContent = t.source || 'Manual';
        if (senderEl) senderEl.textContent = t.sender_email || 'coordinacion@inter.com.ve';
        if (subjEl) subjEl.textContent = t.subject || 'Sin asunto';
        if (bodyEl) bodyEl.innerHTML = escapeHtml(t.full_body || t.subject || '');
        
        const isBridge = (t.subject + ' ' + (t.full_body || '')).toLowerCase().includes('bridge');
        if (bridgeAlert) bridgeAlert.classList.toggle('hidden', !isBridge);

        if (subCode) subCode.textContent = t.subscriber_code || 'N/A';
        if (serial) serial.textContent = t.serial_pon || 'N/A';
        if (node) node.textContent = t.node_name || 'N/A';
        if (slotpon) slotpon.textContent = t.slot_pon || 'N/A';
        if (mac) mac.textContent = t.mac_address || 'N/A';
        
        const pts = t.suggested_points || 2;
        const prio = t.priority || (pts >= 8 ? 'P5' : pts >= 5 ? 'P4' : pts >= 3 ? 'P3' : 'P2');
        if (ptsBadge) ptsBadge.textContent = `+${pts} pts (${prio})`;
        if (taskName) taskName.textContent = t.suggested_task_name || 'Atención Técnica de Fallas';

        if (statusBadge) {
            if (t.status === 'EN ESPERA') {
                statusBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5";
                statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> En Espera / Pausa`;
            } else if (t.status === 'POR_VERIFICAR') {
                statusBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5";
                statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-purple-500"></span> Por Verificar`;
            } else {
                statusBadge.className = "text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1C58A8] border border-blue-200 flex items-center gap-1.5";
                statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#1C58A8] animate-pulse"></span> En Atención`;
            }
        }

        if (pauseBtnText) {
            pauseBtnText.textContent = t.status === 'EN ESPERA' ? 'Reanudar Caso' : 'Pausar (En Espera)';
        }

        // Timer en vivo
        if (t.status === 'EN PROGRESO') {
            startLiveTimer(t.fecha_inicio_atencion || t.claimed_at);
        } else {
            if (liveTimerInterval) clearInterval(liveTimerInterval);
            const timerEl = document.getElementById("ws-live-timer");
            if (timerEl) {
                timerEl.textContent = t.status === 'COMPLETADO' ? `${t.duracion_atencion_minutos || 15} min` : (t.status === 'EN ESPERA' ? 'En Pausa' : '00:00:00');
            }
        }

        if (modal) {
            modal.classList.remove("hidden");
            modal.classList.add("flex");
        }
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error("Error opening workspace:", e);
        showToast("Error al abrir el espacio de trabajo del ticket", "error");
    }
}

function focusOperatorAssignments() {
    switchDashboardTab('operativa');
    const panel = document.getElementById("operator-assignments-panel");
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panel.classList.add("ring-2", "ring-[#1C58A8]", "ring-offset-2");
        setTimeout(() => {
            panel.classList.remove("ring-2", "ring-[#1C58A8]", "ring-offset-2");
        }, 1500);
    }
}

// =============================================================
// NOTIFICACIONES TOAST (STITCH DESIGN SYSTEM)
// =============================================================

function showStitchAssignmentToast(ticket) {
    const toast = document.getElementById("toast-assignment");
    if (!toast) {
        const code = ticket ? (ticket.ticket_code || `#INC-${ticket.id}`) : 'nuevo ticket';
        showToast(`Nueva asignación: ${code}. Revise sus tareas.`, 'success');
        return;
    }
    const codeEl = document.getElementById("toast-assignment-code");
    const timeEl = document.getElementById("toast-assignment-time");
    const bodyEl = document.getElementById("toast-assignment-body");

    if (!toast) return;

    const tCode = ticket ? (ticket.ticket_code || `#INC-${ticket.id}`) : '#INC-NUEVO';
    if (codeEl) codeEl.textContent = tCode;
    if (timeEl) timeEl.textContent = 'Ahora mismo';
    if (bodyEl && ticket) {
        bodyEl.innerHTML = `Se te ha asignado el Ticket <span class="font-mono font-semibold text-[#1C58A8] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">${escapeHtml(tCode)}</span>. Revisa tu lista para ponerlo en proceso.`;
    }

    window._lastNotifiedTicketId = ticket ? ticket.id : null;
    toast.classList.remove("hidden");
    toast.classList.add("toast-animate");

    clearTimeout(window._toastAssignmentTimer);
    window._toastAssignmentTimer = setTimeout(() => {
        dismissStitchToast("toast-assignment");
    }, 14000);
}

function showStitchSuccessToast(title, desc) {
    const toast = document.getElementById("toast-success");
    const titleEl = document.getElementById("toast-success-title");
    const descEl = document.getElementById("toast-success-desc");

    if (!toast) {
        showToast(desc ? `${title}: ${desc}` : (title || 'Operación completada'), 'success');
        return;
    }

    if (titleEl) titleEl.textContent = title || "Acción Exitosa";
    if (descEl) descEl.textContent = desc || "Operación completada satisfactoriamente.";

    toast.classList.remove("hidden");
    toast.classList.add("toast-animate");

    clearTimeout(window._toastSuccessTimer);
    window._toastSuccessTimer = setTimeout(() => {
        dismissStitchToast("toast-success");
    }, 6000);
}

function dismissStitchToast(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => {
        el.classList.add("hidden");
        el.style.opacity = '';
        el.style.transform = '';
    }, 300);
}

function scrollToMyTicket() {
    dismissStitchToast("toast-assignment");
    if (typeof switchDashboardTab === 'function') {
        switchDashboardTab('operativa');
    }
    const panel = document.getElementById("operator-assignments-panel");
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        panel.classList.add("ring-2", "ring-[#1C58A8]");
        setTimeout(() => panel.classList.remove("ring-2", "ring-[#1C58A8]"), 2000);
    }
}

function startOperatorPolling() {
    if (window._operatorPollingInterval) {
        clearInterval(window._operatorPollingInterval);
    }
    // Polling cada 12 segundos según la especificación
    window._operatorPollingInterval = setInterval(() => {
        loadOperatorAssignments(false);
    }, 12000);
}

// =============================================================
// MODAL DE CREACIÓN DE TICKET / ASIGNACIÓN CON ID AUTOMÁTICO
// =============================================================

let _allDepartamentosCatalog = [];
let _allTaskTypesCache = [];

async function openCreateTicketModal() {
    const modal = document.getElementById("modalCreateTicket");
    if (!modal) return;

    const form = document.getElementById("create-ticket-form");
    if (form) form.reset();

    const deptoSelect = document.getElementById("new-ticket-depto");

    // Cargar departamentos si aún no están en memoria
    if (!_allDepartamentosCatalog || _allDepartamentosCatalog.length === 0) {
        try {
            const res = await fetch('/api/departamentos');
            if (res.ok) {
                _allDepartamentosCatalog = await res.json();
            }
        } catch (e) {
            console.error("Error loading departamentos:", e);
        }
    }

    if (deptoSelect) {
        deptoSelect.innerHTML = '';
        (_allDepartamentosCatalog || []).forEach(d => {
            const opt = document.createElement("option");
            opt.value = d.id;
            opt.textContent = `${d.nombre} (${d.codigo})`;
            deptoSelect.appendChild(opt);
        });

        // Seleccionar departamento del usuario autenticado si es coordinador
        const userDeptoId = window.currentUser?.departamento_id || window._currentUser?.departamento_id;
        if (userDeptoId && (_allDepartamentosCatalog || []).some(d => d.id == userDeptoId)) {
            deptoSelect.value = userDeptoId;
        } else if (_allDepartamentosCatalog.length > 0) {
            deptoSelect.value = _allDepartamentosCatalog[0].id;
        }
    }

    // Disparar carga de tareas y operadores para el depto seleccionado
    if (deptoSelect && deptoSelect.value) {
        await onNewTicketDeptoChange(deptoSelect.value);
    }

    modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();

    const subjectInput = document.getElementById("new-ticket-subject");
    if (subjectInput) subjectInput.focus();
}

function closeCreateTicketModal() {
    const modal = document.getElementById("modalCreateTicket");
    if (modal) modal.classList.add("hidden");
}

async function onNewTicketDeptoChange(deptoId) {
    const taskSelect = document.getElementById("new-ticket-task");
    const opSelect = document.getElementById("new-ticket-operator");
    if (!deptoId) return;

    const numDeptoId = parseInt(deptoId, 10);
    const deptoObj = (_allDepartamentosCatalog || []).find(d => d.id === numDeptoId);
    const areaName = deptoObj ? deptoObj.nombre : '';

    // 1. Cargar tareas técnicas de este departamento
    if (taskSelect) {
        taskSelect.innerHTML = '<option value="">Cargando tareas técnicas...</option>';
        try {
            if (!_allTaskTypesCache || _allTaskTypesCache.length === 0) {
                const resTasks = await fetch('/api/task-types');
                if (resTasks.ok) _allTaskTypesCache = await resTasks.json();
            }
            const relevantTasks = (_allTaskTypesCache || []).filter(tt => {
                if (!areaName) return true;
                return tt.area === areaName || (tt.departamento_id && tt.departamento_id === numDeptoId);
            });
            const tasksToUse = relevantTasks.length > 0 ? relevantTasks : _allTaskTypesCache;
            taskSelect.innerHTML = '<option value="">-- Tarea Técnica Sugerida por Defecto --</option>' +
                tasksToUse.map(tt => `<option value="${tt.id}">${tt.code}: ${escapeHtml(tt.name)} [${tt.points} pts - SLA ${tt.sla_minutes || 30}m]</option>`).join('');
        } catch (e) {
            taskSelect.innerHTML = '<option value="">-- Tarea por defecto (+5 pts) --</option>';
        }
    }

    // 2. Cargar operadores específicos de este departamento
    if (opSelect) {
        opSelect.innerHTML = '<option value="">Cargando especialistas del área...</option>';
        try {
            const resOps = await fetch(`/api/operators/availability?departamento_id=${numDeptoId}`);
            if (resOps.ok) {
                const ops = await resOps.json();
                if (ops.length === 0) {
                    opSelect.innerHTML = '<option value="">-- Sin especialistas registrados en esta área (Quedará Pendiente) --</option>';
                } else {
                    let opHtml = '<option value="">-- Sin Asignar (Dejar en cola Pendiente de despacho) --</option>';
                    ops.forEach(op => {
                        opHtml += `<option value="${op.id}">${op.name} (${op.active_points || 0} pts activos · ${op.saturation_level || 'Disponible'})</option>`;
                    });
                    opSelect.innerHTML = opHtml;
                }
            } else {
                opSelect.innerHTML = '<option value="">-- Sin Asignar (Dejar en cola Pendiente) --</option>';
            }
        } catch (e) {
            opSelect.innerHTML = '<option value="">-- Sin Asignar (Dejar en cola Pendiente) --</option>';
        }
    }
}

async function handleCreateTicketSubmit(event) {
    if (event) event.preventDefault();
    const btn = document.getElementById("btn-create-ticket-submit");
    const deptoSelect = document.getElementById("new-ticket-depto");
    const taskSelect = document.getElementById("new-ticket-task");
    const opSelect = document.getElementById("new-ticket-operator");
    const subjectInput = document.getElementById("new-ticket-subject");
    const subscriberInput = document.getElementById("new-ticket-subscriber");
    const nodeInput = document.getElementById("new-ticket-node");
    const bodyInput = document.getElementById("new-ticket-body");

    const subject = subjectInput ? subjectInput.value.trim() : "";
    if (!subject) {
        showStitchSuccessToast("Campo Obligatorio", "Por favor ingrese el asunto de la incidencia.");
        if (subjectInput) subjectInput.focus();
        return;
    }

    const payload = {
        subject: subject,
        body_text: bodyInput ? bodyInput.value.trim() : "",
        departamento_id: deptoSelect && deptoSelect.value ? parseInt(deptoSelect.value, 10) : null,
        task_type_id: taskSelect && taskSelect.value ? parseInt(taskSelect.value, 10) : null,
        operador_id: opSelect && opSelect.value ? parseInt(opSelect.value, 10) : null,
        subscriber_code: subscriberInput ? subscriberInput.value.trim() : null,
        node_name: nodeInput ? nodeInput.value.trim() : null
    };

    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Guardando...`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await fetch('/api/tickets/create', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            closeCreateTicketModal();
            const actionText = data.operador_nombre ? `Asignado a ${data.operador_nombre}` : 'En cola Pendiente';
            showStitchSuccessToast(
                `¡Ticket #${data.ticket_code} Creado!`,
                `ID generado automáticamente · ${data.departamento_nombre} · ${actionText}`
            );

            // Refrescar Mesa de Coordinación y Triage
            if (typeof loadCoordinatorTriage === 'function') await loadCoordinatorTriage();
            if (typeof loadOperatorAssignments === 'function') await loadOperatorAssignments(true);
            if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
            if (typeof loadFeed === 'function') loadFeed();
        } else {
            showStitchSuccessToast("Error al Crear", data.detail || data.error || "No se pudo crear el ticket.");
        }
    } catch (e) {
        console.error("Error creating ticket:", e);
        showStitchSuccessToast("Error de Conexión", "No se pudo comunicar con el servidor.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// Exportar funciones globales
window.showToast = showToast;
window.checkCoordinatorRoleAndInitTriage = checkCoordinatorRoleAndInitTriage;
window.loadCoordinatorTriage = loadCoordinatorTriage;
window.assignTriageTicket = assignTriageTicket;
window.refreshTriageOperators = refreshTriageOperators;
window.populateQuickAssignControls = populateQuickAssignControls;
window.onQuickTicketChange = onQuickTicketChange;
window.onQuickTaskChange = onQuickTaskChange;
window.handleQuickAssignSubmit = handleQuickAssignSubmit;
window.openCreateTicketModal = openCreateTicketModal;
window.closeCreateTicketModal = closeCreateTicketModal;
window.onNewTicketDeptoChange = onNewTicketDeptoChange;
window.handleCreateTicketSubmit = handleCreateTicketSubmit;
window.loadOperatorAssignments = loadOperatorAssignments;
window.loadDispatchQueue = loadDispatchQueue;
window.renderDispatchQueue = renderDispatchQueue;
window.loadTableroOperators = loadTableroOperators;
window.wireTriageAssignButtons = wireTriageAssignButtons;
window.renderOperatorAssignmentCard = renderOperatorAssignmentCard;
window.startProcessingTicket = startProcessingTicket;
window.showStitchAssignmentToast = showStitchAssignmentToast;
window.showStitchSuccessToast = showStitchSuccessToast;
window.dismissStitchToast = dismissStitchToast;
window.scrollToMyTicket = scrollToMyTicket;
window.startOperatorPolling = startOperatorPolling;
window.setOperatorTaskFilter = setOperatorTaskFilter;
window.filterOperatorAssignmentsLocal = filterOperatorAssignmentsLocal;
window.togglePauseTicketDirect = togglePauseTicketDirect;
window.openQuickResolveModal = openQuickResolveModal;
window.closeQuickResolveModal = closeQuickResolveModal;
window.handleQuickResolveSubmit = handleQuickResolveSubmit;
window.openTicketWorkspace = openTicketWorkspace;
window.closeWorkspaceModal = closeWorkspaceModal;
window.focusOperatorAssignments = focusOperatorAssignments;
window.startCardTimers = startCardTimers;

// Iniciar polling al cargar la página
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        loadOperatorAssignments(true);
        startOperatorPolling();
    });
} else {
    loadOperatorAssignments(true);
    startOperatorPolling();
}

// =============================================================
// MOTOR DE AUDITORÍA Y TRAZABILIDAD OPERATIVA EN TIEMPO REAL
// =============================================================

let currentAuditActionFilter = 'TODAS';

function changeAuditActionFilter(actionVal) {
    currentAuditActionFilter = actionVal;
    loadAuditLogs();
}

async function loadAuditLogs() {
    const tbody = document.getElementById("audit-tbody") || document.getElementById("audit-logs-tbody");
    if (!tbody) return;

    try {
        const url = `/api/audit/logs?limit=50${currentAuditActionFilter !== 'TODAS' ? `&action=${encodeURIComponent(currentAuditActionFilter)}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500 text-xs">Error cargando bitácora de auditoría.</td></tr>`;
            return;
        }

        const data = await res.json();
        const logs = Array.isArray(data) ? data : (data.logs || []);

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-snow-muted text-xs">No hay eventos registrados para el filtro seleccionado.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        logs.forEach(l => {
            const act = l.action || '';
            let actBadge = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
            if (act === 'INICIO_SESION') actBadge = 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300';
            else if (act === 'CAMBIO_PERFIL') actBadge = 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300';
            else if (act === 'TOMA_TICKET') actBadge = 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300';
            else if (act === 'PAUSA_TICKET') actBadge = 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300';
            else if (act === 'REANUDACION_TICKET') actBadge = 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300';
            else if (act === 'CIERRE_TICKET') actBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300';
            else if (act === 'INGESTA_CORREO') actBadge = 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300';

            const userInitials = (l.user_name || 'SIS').substring(0, 2).toUpperCase();
            const tr = document.createElement("tr");
            tr.className = "hover:bg-gray-50/60 dark:hover:bg-white/5 transition text-xs";
            tr.innerHTML = `
                <td class="py-2.5 px-3 font-mono text-[11px] text-snow-muted whitespace-nowrap">${l.created_at || '--'}</td>
                <td class="py-2.5 px-3">
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-md bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-[9px] font-bold flex items-center justify-center shrink-0">${userInitials}</span>
                        <span class="font-semibold text-gray-900 dark:text-white whitespace-nowrap">${l.user_name || 'Sistema'}</span>
                    </div>
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap">
                    <span class="text-snow-muted">${l.user_role || '--'}</span>
                    <span class="text-[10px] text-gray-400 block">${l.area || l.user_area || ''}</span>
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap">
                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold ${actBadge}">
                        ${act}
                    </span>
                </td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    ${l.target_type || l.entity_type || ''} ${l.target_id || l.entity_id ? '#' + (l.target_id || l.entity_id) : ''}
                </td>
                <td class="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-xs truncate" title="${(l.details || '').replace(/"/g, '&quot;')}">
                    ${l.details || '--'}
                </td>
                <td class="py-2.5 px-3 text-right font-mono text-[10px] text-snow-muted whitespace-nowrap">${l.ip_address || '127.0.0.1'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading audit logs:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-red-500 text-xs">Fallo al conectar con el servicio de auditoría.</td></tr>`;
    }
}

// =============================================================
// =============================================================
// CONMUTADOR DE PESTAÑAS (VISTA OPERATIVA / RENDIMIENTO / AUDITORÍA)
// =============================================================

let currentDashboardTab = 'operativa'; // 'operativa' | 'rendimiento' | 'auditoria' | 'assistant'

function switchDashboardTab(tabName) {
    currentDashboardTab = tabName;
    window.currentDashboardTab = tabName;
    window.currentDashboardView = tabName;

    const tabOperativa = document.getElementById('tab-operativa');
    const tabRendimiento = document.getElementById('tab-rendimiento');
    const tabAuditoria = document.getElementById('tab-auditoria');
    const tabCoordinacion = document.getElementById('tab-coordinacion');
    const tabTickets = document.getElementById('tab-tickets');
    const tabInbox = document.getElementById('tab-inbox');
    const tabConfig = document.getElementById('tab-configuracion');
    const viewAssistant = document.getElementById('view-assistant');

    if (tabOperativa) {
        if (tabName === 'operativa') {
            tabOperativa.classList.remove('hidden');
            tabOperativa.style.display = 'block';
        } else {
            tabOperativa.classList.add('hidden');
            tabOperativa.style.display = 'none';
        }
    }
    if (tabRendimiento) {
        if (tabName === 'rendimiento') {
            tabRendimiento.classList.remove('hidden');
            tabRendimiento.style.display = 'block';
        } else {
            tabRendimiento.classList.add('hidden');
            tabRendimiento.style.display = 'none';
        }
    }
    if (tabAuditoria) {
        if (tabName === 'auditoria') {
            tabAuditoria.classList.remove('hidden');
            tabAuditoria.style.display = 'block';
        } else {
            tabAuditoria.classList.add('hidden');
            tabAuditoria.style.display = 'none';
        }
    }
    if (tabCoordinacion) {
        if (tabName === 'coordinacion') {
            tabCoordinacion.classList.remove('hidden');
            tabCoordinacion.style.display = 'block';
        } else {
            tabCoordinacion.classList.add('hidden');
            tabCoordinacion.style.display = 'none';
        }
    }
    if (viewAssistant) {
        if (tabName === 'assistant') {
            viewAssistant.classList.remove('hidden');
            viewAssistant.style.display = 'block';
        } else {
            viewAssistant.classList.add('hidden');
            viewAssistant.style.display = 'none';
        }
    }
    [tabTickets, tabInbox, tabConfig].forEach(el => {
        if (!el) return;
        const id = el.id.replace('tab-', '');
        const active = tabName === id;
        el.classList.toggle('hidden', !active);
        el.style.display = active ? 'block' : 'none';
    });

    // Actualizar botones de pestañas superiores
    const tabBtnOperativa = document.getElementById('tab-btn-operativa');
    const tabBtnRendimiento = document.getElementById('tab-btn-rendimiento');
    const tabBtnAuditoria = document.getElementById('tab-btn-auditoria');
    const tabBtnCoordinacion = document.getElementById('tab-btn-coordinacion');

    [
        { name: 'operativa', el: tabBtnOperativa },
        { name: 'rendimiento', el: tabBtnRendimiento },
        { name: 'auditoria', el: tabBtnAuditoria },
        { name: 'coordinacion', el: tabBtnCoordinacion }
    ].forEach(t => {
        if (!t.el) return;
        t.el.classList.remove('bg-white', 'text-[#1C58A8]', 'shadow-xs', 'font-bold', 'border', 'border-[#E4E9F3]', 'text-[#5B6B89]', 'hover:text-[#101828]', 'font-semibold');
        if (t.name === tabName) {
            t.el.classList.add('dash-tab-active');
        } else {
            t.el.classList.remove('dash-tab-active');
        }
    });

    // Resaltado de botones en el sidebar
    const btnOperativa = document.getElementById('nav-view-operativa');
    const btnRendimiento = document.getElementById('nav-view-rendimiento');
    const btnAuditoria = document.getElementById('nav-view-auditoria');
    const btnCoordinacion = document.getElementById('nav-view-coordinacion');

    if (btnOperativa) btnOperativa.classList.toggle('active', tabName === 'operativa');
    if (btnRendimiento) btnRendimiento.classList.toggle('active', tabName === 'rendimiento');
    if (btnAuditoria) btnAuditoria.classList.toggle('active', tabName === 'auditoria');
    if (btnCoordinacion) btnCoordinacion.classList.toggle('active', tabName === 'coordinacion');
    const btnTickets = document.getElementById('nav-view-tickets');
    const btnInbox = document.getElementById('nav-view-inbox');
    const btnConfig = document.getElementById('nav-view-configuracion');
    if (btnTickets) btnTickets.classList.toggle('active', tabName === 'tickets');
    if (btnInbox) btnInbox.classList.toggle('active', tabName === 'inbox');
    if (btnConfig) btnConfig.classList.toggle('active', tabName === 'configuracion');

    // Actualizar breadcrumb si existe
    const bcView = document.getElementById('breadcrumb-view-name');
    if (bcView) {
        if (tabName === 'operativa') bcView.innerText = 'Vista Operativa';
        else if (tabName === 'rendimiento') bcView.innerText = 'Rendimiento del Turno';
        else if (tabName === 'auditoria') bcView.innerText = 'Auditoría Forense';
        else if (tabName === 'assistant') bcView.innerText = 'Asistente CLI';
        else if (tabName === 'coordinacion') bcView.innerText = 'Mesa de Coordinación';
        else if (tabName === 'tickets') bcView.innerText = 'Tablero de Tickets y Operadores Activos';
        else if (tabName === 'inbox') bcView.innerText = 'Consola de Tickets (M365)';
        else if (tabName === 'configuracion') bcView.innerText = 'Configuración del NOC';
    }

    // Acciones de carga y render por pestaña
    if (tabName === 'auditoria') {
        if (typeof loadReportsData === 'function') loadReportsData();
        if (typeof loadAuditLogs === 'function') loadAuditLogs();
        if (typeof loadLiveAuditLogs === 'function') loadLiveAuditLogs();
    } else if (tabName === 'operativa') {
        if (typeof loadCurrentWorkload === 'function') loadCurrentWorkload();
        if (typeof loadFeed === 'function') loadFeed();
        if (typeof loadOperatorAssignments === 'function') loadOperatorAssignments(false);
        if (window.currentUser && (window.currentUser.role === 'COORDINADOR' || window.currentUser.role === 'ADMINISTRADOR') && typeof loadCoordinatorTriage === 'function') {
            loadCoordinatorTriage();
        }
    } else if (tabName === 'rendimiento') {
        if (window.chartHourly && typeof window.chartHourly.resize === 'function') window.chartHourly.resize();
        if (window.chartTechnicians && typeof window.chartTechnicians.resize === 'function') window.chartTechnicians.resize();
        if (window.chartWeights && typeof window.chartWeights.resize === 'function') window.chartWeights.resize();
        if (typeof loadDashboardData === 'function') loadDashboardData();
    } else if (tabName === 'coordinacion') {
        if (typeof loadCoordinatorTriage === 'function') loadCoordinatorTriage();
        if (typeof loadPendingVerification === 'function') loadPendingVerification();
    } else if (tabName === 'tickets') {
        loadDispatchQueue();
        loadTableroOperators();
    } else if (tabName === 'inbox') {
        if (typeof loadInbox === 'function') loadInbox();
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// Alias backward-compatibility
function switchDashboardView(viewId) {
    if (viewId === 'operative' || viewId === 'operativa') {
        switchDashboardTab('operativa');
    } else if (viewId === 'metrics' || viewId === 'rendimiento') {
        switchDashboardTab('rendimiento');
    } else if (viewId === 'audit' || viewId === 'auditoria' || viewId === 'reports') {
        switchDashboardTab('auditoria');
    } else if (viewId === 'coordinacion') {
        switchDashboardTab('coordinacion');
    } else if (viewId === 'assistant') {
        switchDashboardTab('assistant');
    } else {
        switchDashboardTab('operativa');
    }
}

window.switchDashboardTab = switchDashboardTab;
window.switchTab = switchDashboardTab;
window.switchDashboardView = switchDashboardView;

window.loadCurrentUserProfile = loadCurrentUserProfile;
window.loadUsersDropdownList = loadUsersDropdownList;
window.toggleUserDropdown = toggleUserDropdown;
window.switchUserProfile = switchUserProfile;
window.logoutSession = logoutSession;
window.loadAuditLogs = loadAuditLogs;
window.changeAuditActionFilter = changeAuditActionFilter;
window.claimCurrentTicket = claimCurrentTicket;


// =============================================================
// FUNCIONES PARA RESPUESTA WEB Y VISUALIZACIÓN DE MEMBRETES
// =============================================================

function toggleEmailBodyView(mode) {
    const elHtml = document.getElementById("email-view-html");
    const elPlain = document.getElementById("email-view-plain");
    const btnHtml = document.getElementById("btn-body-html");
    const btnPlain = document.getElementById("btn-body-plain");

    if (mode === 'html') {
        if (elHtml) elHtml.classList.remove("hidden");
        if (elPlain) elPlain.classList.add("hidden");
        if (btnHtml) {
            btnHtml.className = "px-2 py-0.5 rounded bg-white dark:bg-[#333336] text-[#0078D4] dark:text-[#38BDF8] shadow-2xs cursor-pointer";
        }
        if (btnPlain) {
            btnPlain.className = "px-2 py-0.5 rounded text-snow-muted hover:text-gray-900 dark:hover:text-white cursor-pointer";
        }
    } else {
        if (elHtml) elHtml.classList.add("hidden");
        if (elPlain) elPlain.classList.remove("hidden");
        if (btnPlain) {
            btnPlain.className = "px-2 py-0.5 rounded bg-white dark:bg-[#333336] text-[#0078D4] dark:text-[#38BDF8] shadow-2xs cursor-pointer";
        }
        if (btnHtml) {
            btnHtml.className = "px-2 py-0.5 rounded text-snow-muted hover:text-gray-900 dark:hover:text-white cursor-pointer";
        }
    }
}

function applyTechnicalTemplate(val) {
    const area = document.getElementById("ws_reply_body");
    if (!area || !val) return;

    const templates = {
        "homologada": "Buenas tardes equipo.\n\nSe procedió a desatascar demonio de la OLT y se verificó atenuación óptica en -19.2 dBm. La ONT homologó de forma correcta y pasó a Whitelist con MAC en VERDE.\n\nFavor confirmar navegación con el abonado.",
        "datos": "Estimados,\n\nPara avanzar con la homologación requerimos nos confirmen el Serial PON impreso en la etiqueta de la ONT y medición con power meter en el conector SC/APC de la roseta.\n\nQuedamos a la espera de sus datos.",
        "bridge": "ATENCIÓN CUADRILLA:\n\nSe identificó que el cliente posee IP Certificada bajo esquema Modo Bridge. Se validó la MAC en Servidor 815 sin reaprovisionar el equipo para no degradar el servicio.\n\nTráfico WAN verificado y activo.",
        "cierre_ok": "Estimado solicitante,\n\nEl caso reportado ha sido validado y solventado satisfactoriamente por el equipo de Operaciones IP. Parámetros ópticos dentro de norma y enlace operativo al 100%.\n\nProcedemos con el cierre del ticket."
    };

    if (templates[val]) {
        area.value = templates[val];
    }
}

async function sendTicketReply(closeTicket = false) {
    if (!currentOpenTicket) return;

    const replyArea = document.getElementById("ws_reply_body");
    const replyText = replyArea ? replyArea.value.trim() : "";

    if (!replyText) {
        alert("Por favor ingrese el texto de la respuesta a enviar.");
        if (replyArea) replyArea.focus();
        return;
    }

    const btn = document.getElementById(closeTicket ? "btn-complete-and-reply" : "btn-send-reply");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i><span>Enviando...</span>';
        if (window.lucide) lucide.createIcons();
    }

    try {
        const payload = {
            body_text: replyText,
            close_ticket: closeTicket,
            resolution_notes: replyText,
            task_type_id: currentOpenTicket.suggested_task_type_id || 1
        };

        const res = await fetch(`/api/tickets/${currentOpenTicket.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.status === 'ok') {
            if (closeTicket) {
                selectedTicketId = null;
                await loadInbox();
                await loadDashboardData();
                if (window.currentDashboardView === 'audit') await loadAuditLogs();
            } else {
                // Recargar el ticket para mostrar la respuesta en el hilo
                await selectOutlookMessage(currentOpenTicket.id);
            }
        } else {
            alert("Aviso: " + (result.message || "Error al procesar respuesta."));
        }
    } catch (err) {
        console.error("Error enviando respuesta SMTP:", err);
        alert("Fallo al contactar el servidor para despachar respuesta.");
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openAttachmentViewer(filePath, filename) {
    if (!filePath) return;
    // Abrir en nueva pestaña o modal de visualización
    window.open(filePath, '_blank');
}

window.toggleEmailBodyView = toggleEmailBodyView;
window.applyTechnicalTemplate = applyTechnicalTemplate;
window.sendTicketReply = sendTicketReply;
window.openAttachmentViewer = openAttachmentViewer;
window.selectMailFolder = selectMailFolder;
window.selectTechnicalDepartment = selectTechnicalDepartment;
window.assignCurrentTicketToOperator = assignCurrentTicketToOperator;
window.resolveCurrentTicketNow = resolveCurrentTicketNow;
window.moveTicketToFolder = moveTicketToFolder;
window.loadMailStats = loadMailStats;
window.loadOutbox = loadOutbox;
window.selectOutboxMessage = selectOutboxMessage;



/* ==============================================================
   ASISTENTE DE COMANDOS CLI (M5)
============================================================== */
async function loadCommandCategories() {
    const vendor = document.getElementById('m5-vendor').value;
    try {
        const res = await fetch(`/api/commands/categories?vendor=` + encodeURIComponent(vendor));
        const data = await res.json();
        
        const catSelect = document.getElementById('m5-category');
        catSelect.innerHTML = '';
        
        if (data.categories && data.categories.length > 0) {
            data.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat.replace('_', ' ').toUpperCase();
                catSelect.appendChild(opt);
            });
            loadCommandsList();
        } else {
            catSelect.innerHTML = '<option value="">Sin categoras</option>';
            document.getElementById('m5-commands-list').innerHTML = '';
        }
    } catch (e) {
        console.error("Error loading categories", e);
    }
}

async function loadCommandsList() {
    const vendor = document.getElementById('m5-vendor').value;
    const category = document.getElementById('m5-category').value;
    
    if (!category) return;
    
    try {
        const res = await fetch(`/api/commands/list?vendor=` + encodeURIComponent(vendor) + `&category=` + encodeURIComponent(category));
        const data = await res.json();
        
        const listDiv = document.getElementById('m5-commands-list');
        listDiv.innerHTML = '';
        
        if (data.commands) {
            data.commands.forEach(cmd => {
                const div = document.createElement('div');
                div.className = 'p-2 rounded border border-snow-border hover:bg-snow-subtle cursor-pointer transition';
                div.style.background = 'var(--dash-bg)';
                div.onclick = () => generateCommand(cmd.id);
                
                const title = document.createElement('h4');
                title.className = 'text-xs font-bold mb-1';
                title.style.color = 'var(--dash-text-title)';
                title.textContent = cmd.name;
                
                const desc = document.createElement('p');
                desc.className = 'text-[10px]';
                desc.style.color = 'var(--dash-text-muted)';
                desc.textContent = cmd.description;
                
                div.appendChild(title);
                div.appendChild(desc);
                listDiv.appendChild(div);
            });
        }
    } catch (e) {
        console.error("Error loading commands", e);
    }
}

async function generateCommand(commandId) {
    const vendor = document.getElementById('m5-vendor').value;
    const category = document.getElementById('m5-category').value;
    const slot = document.getElementById('m5-slot').value || '{slot}';
    const pon = document.getElementById('m5-pon').value || '{pon}';
    const onu = document.getElementById('m5-onu').value || '{onu}';
    
    try {
        const res = await fetch('/api/commands/generate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                vendor: vendor,
                category: category,
                command_id: commandId,
                params: {slot: slot, pon: pon, onu: onu}
            })
        });
        const data = await res.json();
        
        const out = document.getElementById('m5-output');
        if (data.command) {
            out.textContent = data.command;
        } else {
            out.textContent = data.error || "Error generando comando.";
        }
    } catch (e) {
        console.error("Error generating command", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const vendorSelect = document.getElementById('m5-vendor');
    const catSelect = document.getElementById('m5-category');
    const copyBtn = document.getElementById('m5-copy-btn');
    
    if (vendorSelect) {
        vendorSelect.addEventListener('change', loadCommandCategories);
        loadCommandCategories(); // Init
    }
    if (catSelect) {
        catSelect.addEventListener('change', loadCommandsList);
    }
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const out = document.getElementById('m5-output');
            navigator.clipboard.writeText(out.textContent).then(() => {
                showToast("Comando copiado al portapapeles", "success");
            });
        });
    }
});
