import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLines = readFileSync(join(__dirname, "../frontend/.env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const [k, ...v] = t.split("=");
  env[k.trim()] = v.join("=").trim();
}

const loginRes = await fetch("https://alleatogroup.acumatica.com/entity/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: env.ACCOUNTING_USER, password: env.ACCOUNTING_PASSWORD, company: "Alleato Group" }),
  redirect: "manual",
});
const cookies = loginRes.headers.getSetCookie().map(h => h.split(";")[0]).join("; ");
console.log("✓ Logged in\n");

async function tryFetch(expand) {
  const url = `https://alleatogroup.acumatica.com/entity/Default/24.200.001/Invoice?$top=1${expand ? `&$expand=${expand}` : ""}`;
  const r = await fetch(url, { headers: { Cookie: cookies, Accept: "application/json" } });
  const text = await r.text();
  try { return { ok: r.ok, data: JSON.parse(text) }; }
  catch { return { ok: false, data: text.slice(0, 150) }; }
}

function printKeys(obj, prefix = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (["id", "rowNumber", "note", "custom", "files", "_links"].includes(k)) continue;
    const val = (v && typeof v === "object" && "value" in v && Object.keys(v).length === 1) ? v.value : v;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      printKeys(val, prefix ? `${prefix}.${k}` : k);
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      const subKeys = Object.keys(val[0]).filter(x => !["id","rowNumber","note","custom","files"].includes(x));
      console.log(`  ${prefix ? prefix+"." : ""}${k}[] (${val.length} items) → ${subKeys.join(", ")}`);
    } else {
      console.log(`  ${prefix ? prefix+"." : ""}${k}: ${JSON.stringify(val)}`);
    }
  }
}

// Base fields
const base = await tryFetch(null);
if (base.ok && Array.isArray(base.data) && base.data[0]) {
  console.log("=== BASE FIELDS ===");
  printKeys(base.data[0]);
} else {
  console.log("Base fetch failed:", base.data);
}

// Try expands
for (const exp of ["ApplicationsList", "TaxDetails", "Details", "Adjustments", "BillingAddress", "ShippingAddress", "FinancialDetails"]) {
  const r = await tryFetch(exp);
  if (r.ok && Array.isArray(r.data) && r.data[0]) {
    const field = r.data[0][exp];
    if (field !== undefined) {
      console.log(`\n=== $expand=${exp} ===`);
      if (Array.isArray(field) && field.length > 0 && typeof field[0] === "object") {
        const subKeys = Object.keys(field[0]).filter(x => !["id","rowNumber","note","custom","files"].includes(x));
        console.log(`  (${field.length} items) keys: ${subKeys.join(", ")}`);
      } else if (field && typeof field === "object") {
        printKeys(field, exp);
      } else {
        console.log(`  ${JSON.stringify(field)}`);
      }
    } else {
      console.log(`\n$expand=${exp}: field not in response`);
    }
  } else {
    console.log(`\n$expand=${exp}: ERROR`);
  }
}
