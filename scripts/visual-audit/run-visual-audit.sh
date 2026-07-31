#!/usr/bin/env bash
# Visual Audit — screenshots every key page at 375, 768, 1280, and 1440px viewports
# Usage: bash scripts/visual-audit/run-visual-audit.sh
# Output: scripts/visual-audit/output/<timestamp>/
#
# Resilience features:
#   - --session-name persists auth across browser crashes
#   - Checks for auth redirects mid-run and re-logins
#   - || true on every command — never aborts the run

AB="agent-browser --session-name alleato-audit"

BASE_URL="http://localhost:3000"
PROJECT_ID="67"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUT="$(dirname "$0")/output/${TIMESTAMP}"
mkdir -p "$OUT"

# Load credentials
set -a
source "$(dirname "$0")/../../.env"
set +a

EMAIL="${TEST_USER_1:-test1@mail.com}"
PASSWORD="${TEST_PASSWORD_1:-test12026!!!}"

# Viewports to capture: name|width|height
VIEWPORTS=(
  "mobile|375|812"
  "tablet|768|1024"
  "desktop|1280|900"
  "wide|1440|900"
)

echo "=== Alleato Visual Audit ==="
echo "Viewports: mobile(375) · tablet(768) · desktop(1280) · wide(1440)"
echo "Output: $OUT"
echo ""

# ─── Login helper (used at start and on auth redirects) ───────────────────────
do_login() {
  $AB open "$BASE_URL/auth/login" 2>/dev/null || true
  $AB wait --load networkidle 2>/dev/null || true
  # Use snapshot refs — avoids matching wrong "Email" elements on non-login pages
  SNAP=$($AB snapshot -i 2>/dev/null || echo "")
  EMAIL_REF=$(echo "$SNAP" | grep -o '@e[0-9]*.*Email' | grep -o '@e[0-9]*' | head -1)
  PASS_REF=$(echo "$SNAP"  | grep -o '@e[0-9]*.*Password' | grep -o '@e[0-9]*' | head -1)
  BTN_REF=$(echo "$SNAP"   | grep -o '@e[0-9]*.*Login' | grep -o '@e[0-9]*' | head -1)
  if [ -n "$EMAIL_REF" ] && [ -n "$PASS_REF" ] && [ -n "$BTN_REF" ]; then
    $AB fill "$EMAIL_REF" "$EMAIL" 2>/dev/null || true
    $AB fill "$PASS_REF" "$PASSWORD" 2>/dev/null || true
    $AB click "$BTN_REF" 2>/dev/null || true
    $AB wait --load networkidle 2>/dev/null || true
    echo "  ✓ Logged in as $EMAIL"
  else
    echo "  ✓ Already authenticated (not on login page)"
  fi
}

# ─── Initial login ────────────────────────────────────────────────────────────
echo "→ Logging in..."
# Check if session is already valid
$AB open "$BASE_URL/$PROJECT_ID/home" 2>/dev/null || true
$AB wait --load networkidle 2>/dev/null || true
CURR=$($AB get url 2>/dev/null || echo "unknown")
if echo "$CURR" | grep -qE "login|auth"; then
  do_login
else
  echo "  ✓ Session already valid"
fi

# ─── Route list ───────────────────────────────────────────────────────────────
P="$BASE_URL/$PROJECT_ID"

declare -a ROUTES=(
  # label|url
  "home|$BASE_URL/$PROJECT_ID/home"
  "pipeline|$BASE_URL/pipeline"
  "directory-companies|$BASE_URL/directory/companies"
  "directory-contacts|$BASE_URL/directory/contacts"
  "directory-employees|$BASE_URL/directory/employees"
  "settings|$BASE_URL/settings"
  "settings-profile|$BASE_URL/settings/profile"
  "settings-members|$BASE_URL/settings/members"
  "settings-integrations|$BASE_URL/settings/integrations"
  "updates|$BASE_URL/updates"
  "project-home|$P/home"
  "budget|$P/budget"
  "prime-contracts|$P/prime-contracts"
  "prime-contracts-new|$P/prime-contracts/new"
  "commitments|$P/commitments"
  "commitments-new|$P/commitments/new"
  "change-events|$P/change-events"
  "change-events-new|$P/change-events/new"
  "change-orders|$P/change-orders"
  "direct-costs|$P/direct-costs"
  "direct-costs-new|$P/direct-costs/new"
  "invoicing|$P/invoicing"
  "schedule|$P/schedule"
  "rfis|$P/rfis"
  "rfis-new|$P/rfis/new"
  "submittals|$P/submittals"
  "drawings|$P/drawings"
  "specifications|$P/specifications"
  "directory-project|$P/directory"
  "daily-log|$P/daily-log"
  "photos|$P/photos"
  "documents|$P/documents"
  "meetings|$P/meetings"
  "punch-list|$P/punch-list"
  "reporting|$P/reporting"
  "sov|$P/sov"
  "estimates|$P/estimates"
)

# ─── Capture loop ─────────────────────────────────────────────────────────────
total=0
for vp in "${VIEWPORTS[@]}"; do
  IFS='|' read -r vp_name vp_w vp_h <<< "$vp"
  vp_dir="$OUT/$vp_name"
  mkdir -p "$vp_dir"

  echo ""
  echo "── Viewport: $vp_name (${vp_w}×${vp_h}) ──"

  # Set viewport (keep same browser session — never close between passes)
  $AB set viewport "${vp_w}" "${vp_h}" 2>/dev/null || true
  $AB wait 300 2>/dev/null || true

  for route in "${ROUTES[@]}"; do
    IFS='|' read -r label url <<< "$route"
    echo "  📸 $label"
    $AB open "$url" 2>/dev/null || true
    $AB wait --load networkidle 2>/dev/null || true
    $AB wait 1500 2>/dev/null || true

    # Detect auth redirect → re-login and retry
    CURR=$($AB get url 2>/dev/null || echo "unknown")
    if echo "$CURR" | grep -qE "login|auth"; then
      echo "    ↺ Auth redirect — re-logging in..."
      do_login
      $AB set viewport "${vp_w}" "${vp_h}" 2>/dev/null || true
      $AB open "$url" 2>/dev/null || true
      $AB wait --load networkidle 2>/dev/null || true
      $AB wait 1000 2>/dev/null || true
    fi

    $AB screenshot --full "$vp_dir/${label}.png" 2>/dev/null || \
      $AB screenshot "$vp_dir/${label}.png" 2>/dev/null || true
    total=$((total + 1))
  done
done

# ─── HTML report ──────────────────────────────────────────────────────────────
echo ""
echo "── Generating HTML report ──"

REPORT="$OUT/report.html"

cat > "$REPORT" << HTMLEOF
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Alleato Visual Audit — ${TIMESTAMP}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #e5e5e5; }
  header { padding: 24px 32px; border-bottom: 1px solid #1e1e1e; display: flex; align-items: center; justify-content: space-between; }
  h1 { font-size: 18px; font-weight: 600; }
  .meta { color: #555; font-size: 12px; }
  .tabs { display: flex; gap: 2px; padding: 16px 32px 0; border-bottom: 1px solid #1e1e1e; }
  .tab { padding: 8px 16px; font-size: 13px; cursor: pointer; border-radius: 6px 6px 0 0; color: #666; background: none; border: none; }
  .tab.active { color: #e5e5e5; background: #1a1a1a; border: 1px solid #1e1e1e; border-bottom: 1px solid #1a1a1a; }
  .panel { display: none; padding: 24px 32px; }
  .panel.active { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; overflow: hidden; }
  .card-header { padding: 9px 14px; background: #141414; border-bottom: 1px solid #1e1e1e; display: flex; align-items: center; justify-content: space-between; }
  .card-label { font-size: 12px; font-family: monospace; color: #aaa; }
  .card img { width: 100%; display: block; cursor: zoom-in; }
  .card img:hover { opacity: .9; }
  #lb { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.92); z-index: 9999; align-items: center; justify-content: center; }
  #lb.open { display: flex; }
  #lb img { max-width: 95vw; max-height: 95vh; object-fit: contain; border-radius: 4px; }
  #lb-close { position: fixed; top: 16px; right: 20px; font-size: 28px; color: #888; cursor: pointer; line-height: 1; }
</style>
</head>
<body>
<header>
  <h1>Alleato Visual Audit</h1>
  <span class="meta">${TIMESTAMP} · Project ${PROJECT_ID} · ${total} screenshots</span>
</header>

<div class="tabs">
  <button class="tab active" onclick="show('mobile',this)">Mobile 375px</button>
  <button class="tab" onclick="show('tablet',this)">Tablet 768px</button>
  <button class="tab" onclick="show('desktop',this)">Desktop 1280px</button>
  <button class="tab" onclick="show('wide',this)">Wide 1440px</button>
</div>
HTMLEOF

for vp in "${VIEWPORTS[@]}"; do
  IFS='|' read -r vp_name vp_w vp_h <<< "$vp"
  active=""
  [ "$vp_name" = "mobile" ] && active=" active"

  echo "<div id=\"panel-${vp_name}\" class=\"panel${active}\"><div class=\"grid\">" >> "$REPORT"

  for route in "${ROUTES[@]}"; do
    IFS='|' read -r label url <<< "$route"
    img="${vp_name}/${label}.png"
    if [ -f "$OUT/$img" ]; then
      echo "  <div class=\"card\">
    <div class=\"card-header\">
      <span class=\"card-label\">${label}</span>
      <span class=\"card-label\" style=\"color:#444;font-size:11px\">${url//$BASE_URL/}</span>
    </div>
    <img src=\"${img}\" alt=\"${label}\" loading=\"lazy\" onclick=\"openLb(this.src)\">
  </div>" >> "$REPORT"
    fi
  done

  echo "</div></div>" >> "$REPORT"
done

cat >> "$REPORT" << 'ENDHTML'
<div id="lb"><span id="lb-close" onclick="closeLb()">✕</span><img id="lb-img" src="" alt=""></div>
<script>
function show(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
}
function openLb(src) {
  document.getElementById('lb-img').src = src;
  document.getElementById('lb').classList.add('open');
}
function closeLb() { document.getElementById('lb').classList.remove('open'); }
document.getElementById('lb').addEventListener('click', function(e) { if(e.target===this) closeLb(); });
document.addEventListener('keydown', function(e) { if(e.key==='Escape') closeLb(); });
</script>
</body></html>
ENDHTML

echo ""
echo "════════════════════════════════════════"
echo "✅ Visual audit complete"
echo "   Screenshots: ${total}"
echo "   Report:      $REPORT"
echo ""
echo "   open '$REPORT'"
echo "════════════════════════════════════════"

open "$REPORT"
