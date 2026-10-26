"""
Renders a custom branded Swagger UI HTML page with AcademiQ styling,
interactive demo token generator, and spec switcher.
"""

def render_swagger_ui_html() -> str:
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AcademiQ API Documentation — Swagger UI</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234f46e5' stroke-width='2.2'><path d='M22 10v6M2 10l10-5 10 5-10 5z'/><path d='M6 12v5c3 3 9 3 12 0v-5'/></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css">
    <style>
        :root {
            --bg-canvas: #090d16;
            --bg-surface: #111827;
            --bg-elevated: #1f2937;
            --border-subtle: #374151;
            --border-primary: #4b5563;
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --text-main: #f9fafb;
            --text-muted: #9ca3af;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background-color: var(--bg-canvas);
            color: var(--text-main);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }

        /* ── Top Header Navigation Bar ───────────────────────────────────────── */
        .academiq-header {
            background: linear-gradient(180deg, #131b2e 0%, #0d1322 100%);
            border-bottom: 1px solid var(--border-subtle);
            padding: 14px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .brand-container {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
        }

        .brand-logo-icon {
            width: 36px;
            height: 36px;
            border-radius: 9px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(99, 102, 241, 0.4);
        }

        .brand-logo-icon svg {
            width: 20px;
            height: 20px;
            stroke: #ffffff;
        }

        .brand-title {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #ffffff;
            line-height: 1.2;
        }

        .brand-subtitle {
            font-size: 11px;
            font-weight: 500;
            color: #818cf8;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .spec-select {
            background: var(--bg-surface);
            color: #e5e7eb;
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 500;
            outline: none;
            cursor: pointer;
            transition: all 0.2s;
        }

        .spec-select:hover, .spec-select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .btn-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 600;
            color: #cbd5e1;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            text-decoration: none;
            transition: all 0.2s;
        }

        .btn-link:hover {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff;
            border-color: var(--primary);
        }

        /* ── Demo Credentials & Quick Auth Banner ──────────────────────────── */
        .auth-banner {
            background: #111827;
            border-bottom: 1px solid var(--border-subtle);
            padding: 12px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }

        .auth-banner-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .auth-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .auth-buttons {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .btn-auth {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.15s ease-in-out;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn-admin {
            background: rgba(239, 68, 68, 0.12);
            color: #fca5a5;
            border-color: rgba(239, 68, 68, 0.3);
        }
        .btn-admin:hover {
            background: rgba(239, 68, 68, 0.22);
            color: #ffffff;
        }

        .btn-faculty {
            background: rgba(99, 102, 241, 0.12);
            color: #a5b4fc;
            border-color: rgba(99, 102, 241, 0.3);
        }
        .btn-faculty:hover {
            background: rgba(99, 102, 241, 0.22);
            color: #ffffff;
        }

        .btn-student {
            background: rgba(16, 185, 129, 0.12);
            color: #6ee7b7;
            border-color: rgba(16, 185, 129, 0.3);
        }
        .btn-student:hover {
            background: rgba(16, 185, 129, 0.22);
            color: #ffffff;
        }

        .btn-worker {
            background: rgba(245, 158, 11, 0.12);
            color: #fcd34d;
            border-color: rgba(245, 158, 11, 0.3);
        }
        .btn-worker:hover {
            background: rgba(245, 158, 11, 0.22);
            color: #ffffff;
        }

        .btn-clear {
            background: transparent;
            color: #94a3b8;
            border: 1px dashed var(--border-subtle);
            padding: 6px 10px;
            font-size: 11px;
        }
        .btn-clear:hover {
            color: #ef4444;
            border-color: #ef4444;
        }

        .auth-status {
            font-size: 12px;
            font-weight: 500;
            color: var(--success);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* ── Swagger UI Overrides for Dark Modern Styling ──────────────────── */
        .swagger-ui {
            font-family: 'Inter', sans-serif !important;
            color: #e2e8f0;
        }

        .swagger-ui .topbar {
            display: none !important;
        }

        .swagger-ui .wrapper {
            max-width: 1300px;
            padding: 24px 28px;
        }

        .swagger-ui .info {
            margin: 20px 0 30px;
        }

        .swagger-ui .info .title {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.03em;
        }

        .swagger-ui .info p, .swagger-ui .info li {
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.6;
        }

        .swagger-ui .info a {
            color: #818cf8;
        }

        .swagger-ui .scheme-container {
            background: var(--bg-surface) !important;
            box-shadow: none !important;
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 24px;
        }

        .swagger-ui .opblock-tag {
            color: #ffffff;
            font-size: 18px;
            font-weight: 700;
            border-bottom: 1px solid var(--border-subtle);
            padding: 12px 0 8px;
            margin: 28px 0 12px;
        }

        .swagger-ui .opblock-tag small {
            color: #94a3b8;
            font-size: 13px;
        }

        .swagger-ui .opblock {
            border-radius: 10px !important;
            margin: 0 0 14px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
            border: 1px solid var(--border-subtle) !important;
            background: #111827 !important;
        }

        .swagger-ui .opblock .opblock-summary {
            padding: 10px 16px;
        }

        .swagger-ui .opblock .opblock-summary-method {
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
            padding: 6px 14px;
            letter-spacing: 0.05em;
        }

        .swagger-ui .opblock .opblock-summary-path {
            color: #f1f5f9;
            font-weight: 600;
            font-size: 14px;
            font-family: 'JetBrains Mono', monospace;
        }

        .swagger-ui .opblock .opblock-summary-description {
            color: #94a3b8;
            font-size: 13px;
        }

        .swagger-ui .btn.authorize {
            background: #4f46e5 !important;
            border-color: #6366f1 !important;
            color: #ffffff !important;
            border-radius: 8px;
            font-weight: 600;
            padding: 8px 18px;
        }

        .swagger-ui .btn.authorize svg {
            fill: #ffffff;
        }

        .swagger-ui .btn.try-out__btn {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--border-subtle);
            color: #f8fafc;
            border-radius: 6px;
        }

        .swagger-ui .btn.execute {
            background: #4f46e5 !important;
            border-color: #4f46e5 !important;
            color: #ffffff !important;
            border-radius: 6px;
            font-weight: 600;
        }

        .swagger-ui section.models {
            border: 1px solid var(--border-subtle);
            border-radius: 12px;
            background: var(--bg-surface);
        }

        .swagger-ui section.models h4 {
            color: #ffffff;
        }

        .swagger-ui .model-title {
            color: #e2e8f0;
        }

        .swagger-ui table.headers td, .swagger-ui table.headers th {
            color: #cbd5e1;
        }

        .swagger-ui .response-col_status {
            color: #ffffff;
            font-weight: 700;
        }

        .swagger-ui select {
            background: var(--bg-elevated);
            color: #ffffff;
            border-color: var(--border-subtle);
        }

        .swagger-ui input[type="text"] {
            background: var(--bg-canvas);
            color: #ffffff;
            border-color: var(--border-subtle);
        }

        .swagger-ui textarea {
            background: var(--bg-canvas);
            color: #ffffff;
            border-color: var(--border-subtle);
            font-family: 'JetBrains Mono', monospace;
        }

        .swagger-ui .filter .operation-filter-input {
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            padding: 8px 14px;
            background: var(--bg-surface);
            color: #ffffff;
            font-size: 14px;
        }

        /* Method badge specifics */
        .swagger-ui .opblock.opblock-get { border-color: rgba(59, 130, 246, 0.3) !important; background: rgba(59, 130, 246, 0.04) !important; }
        .swagger-ui .opblock.opblock-post { border-color: rgba(16, 185, 129, 0.3) !important; background: rgba(16, 185, 129, 0.04) !important; }
        .swagger-ui .opblock.opblock-put { border-color: rgba(245, 158, 11, 0.3) !important; background: rgba(245, 158, 11, 0.04) !important; }
        .swagger-ui .opblock.opblock-delete { border-color: rgba(239, 68, 68, 0.3) !important; background: rgba(239, 68, 68, 0.04) !important; }

        @media (max-width: 768px) {
            .academiq-header { padding: 12px 16px; flex-direction: column; gap: 12px; align-items: flex-start; }
            .header-actions { width: 100%; justify-content: space-between; }
            .auth-banner { padding: 12px 16px; flex-direction: column; align-items: flex-start; }
            .swagger-ui .wrapper { padding: 12px; }
        }
    </style>
</head>
<body>
    <!-- ── Brand Navigation Bar ─────────────────────────────────────────── -->
    <header class="academiq-header">
        <a href="/" class="brand-container">
            <div class="brand-logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
            </div>
            <div>
                <div class="brand-title">AcademiQ API Documentation</div>
                <div class="brand-subtitle">Interactive Swagger UI · API Gateway v1.0</div>
            </div>
        </a>

        <div class="header-actions">
            <!-- Service Selector Dropdown -->
            <select id="spec-select" class="spec-select" onchange="switchSpec(this.value)">
                <option value="/openapi.json">🌐 Unified API Gateway (All Services)</option>
                <option value="/openapi/auth.json">🔐 Auth Service (Port 8001)</option>
                <option value="/openapi/academic.json">🎓 Academic Data Service (Port 8002)</option>
                <option value="/openapi/prediction.json">🤖 ML Risk Prediction Service (Port 8006)</option>
                <option value="/openapi/rag.json">🧠 NLP & RAG Service (Port 8005)</option>
                <option value="/openapi/reports.json">📑 NBA SAR Report Service (Port 8007)</option>
                <option value="/openapi/documents.json">📂 Document OCR Service (Port 8004)</option>
                <option value="/openapi/contact.json">📞 Parent Contact Service (Port 8003)</option>
            </select>

            <a href="/openapi.json" target="_blank" class="btn-link" title="Download OpenAPI 3.0 JSON specification">
                <span>{ } JSON</span>
            </a>
            <a href="/openapi.yaml" target="_blank" class="btn-link" title="Download OpenAPI 3.0 YAML specification">
                <span>≡ YAML</span>
            </a>
            <a href="http://localhost:3000" target="_blank" class="btn-link" style="background: rgba(99, 102, 241, 0.2); border-color: var(--primary);">
                <span>← Back to App</span>
            </a>
        </div>
    </header>

    <!-- ── Quick Auth Demo Bar ──────────────────────────────────────────── -->
    <div class="auth-banner">
        <div class="auth-banner-left">
            <span class="auth-label">⚡ 1-Click Quick Auth:</span>
            <div class="auth-buttons">
                <button type="button" class="btn-auth btn-admin" onclick="quickLogin('admin@academiq.edu', 'admin123', 'Admin')">
                    👑 Login as Admin
                </button>
                <button type="button" class="btn-auth btn-faculty" onclick="quickLogin('meena.iyer@faculty.academiq.edu', 'teacher123', 'Faculty (Dr. Meena)')">
                    🎓 Login as Faculty
                </button>
                <button type="button" class="btn-auth btn-student" onclick="quickLogin('aarav.stu001@student.academiq.edu', 'student123', 'Student (Aarav)')">
                    🎒 Login as Student
                </button>
                <button type="button" class="btn-auth btn-worker" onclick="quickLogin('worker@academiq.edu', 'worker123', 'Worker Staff')">
                    📋 Login as Worker
                </button>
                <button type="button" class="btn-auth btn-clear" onclick="clearAuth()">
                    ✕ Clear Auth
                </button>
            </div>
        </div>
        <div id="auth-status" class="auth-status">
            <span>● Ready to test endpoints</span>
        </div>
    </div>

    <!-- ── Swagger UI Container ─────────────────────────────────────────── -->
    <div id="swagger-ui"></div>

    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
    <script>
        let ui;

        window.onload = function() {
            initSwagger("/openapi.json");
        };

        function initSwagger(specUrl) {
            ui = SwaggerUIBundle({
                url: specUrl,
                dom_id: '#swagger-ui',
                deepLinking: true,
                persistAuthorization: true,
                displayRequestDuration: true,
                filter: true,
                docExpansion: 'list',
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 2,
                showExtensions: true,
                showCommonExtensions: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "BaseLayout",
                onComplete: function() {
                    console.log("[AcademiQ Swagger UI] Ready");
                    // Check if token already exists in localStorage
                    const savedRole = localStorage.getItem("academiq_active_role");
                    if (savedRole) {
                        const statusEl = document.getElementById("auth-status");
                        if (statusEl) {
                            statusEl.innerHTML = `<span style="color: var(--success)">✓ Authorized as ${savedRole}</span>`;
                        }
                    }
                }
            });
            window.ui = ui;
        }

        function switchSpec(url) {
            initSwagger(url);
        }

        async function quickLogin(email, password, roleLabel) {
            const statusEl = document.getElementById("auth-status");
            statusEl.innerHTML = `<span style="color: #93c5fd">⏳ Authenticating as ${roleLabel}…</span>`;

            try {
                const res = await fetch("/api/v1/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                const token = data.access_token;

                if (!token) throw new Error("No access_token returned");

                // Inject Bearer token into Swagger UI
                window.ui.preauthorizeApiKey("bearerAuth", token);
                localStorage.setItem("academiq_active_role", `${roleLabel} (${data.user_id})`);

                statusEl.innerHTML = `<span style="color: var(--success); font-weight: 700;">✓ Authorized as ${roleLabel} (${data.user_id}) — Token Applied!</span>`;
            } catch (err) {
                statusEl.innerHTML = `<span style="color: var(--danger)">✕ Login failed: ${err.message}</span>`;
            }
        }

        function clearAuth() {
            if (window.ui) {
                window.ui.authActions.logout(["bearerAuth"]);
            }
            localStorage.removeItem("academiq_active_role");
            document.getElementById("auth-status").innerHTML = `<span style="color: var(--text-muted)">● Authorization cleared</span>`;
        }
    </script>
</body>
</html>
"""
