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

async function fetch1(expand) {
  const url = `https://alleatogroup.acumatica.com/entity/Default/24.200.001/Vendor?$top=1${expand ? `&$expand=${expand}` : ""}`;
  const r = await fetch(url, { headers: { Cookie: cookies, Accept: "application/json" } });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

function printKeys(obj, prefix = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (["id", "rowNumber", "note", "custom", "files"].includes(k)) continue;
    const val = (v && typeof v === "object" && "value" in v && Object.keys(v).length === 1) ? v.value : v;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      printKeys(val, prefix ? `${prefix}.${k}` : k);
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      const subKeys = Object.keys(val[0]).filter(x => !["id","rowNumber","note","custom","files"].includes(x));
      console.log(`  ${prefix ? prefix + "." : ""}${k}[] → ${subKeys.join(", ")}`);
    } else {
      console.log(`  ${prefix ? prefix + "." : ""}${k}: ${JSON.stringify(val)}`);
    }
  }
}

// Base fields
console.log("=== BASE FIELDS ===");
const base = await fetch1(null);
if (Array.isArray(base)) printKeys(base[0]);
else console.log("Error:", base);

// Try each expand
const expands = ["MainContact", "ShippingContact", "ShippingAddress", "Locations", "Contacts", "Attributes", "PaymentInstructions"];
for (const exp of expands) {
  const data = await fetch1(exp);
  if (Array.isArray(data)) {
    const expanded = data[0][exp];
    if (expanded !== undefined) {
      console.log(`\n=== $expand=${exp} ===`);
      if (Array.isArray(expanded) && expanded.length > 0) {
        const subKeys = Object.keys(expanded[0]).filter(x => !["id","rowNumber","note","custom","files"].includes(x));
        console.log(`  (array, ${expanded.length} items) keys: ${subKeys.join(", ")}`);
      } else if (expanded && typeof expanded === "object") {
        printKeys(expanded, exp);
      } else {
        console.log(`  ${JSON.stringify(expanded)}`);
      }
    } else {
      console.log(`\n$expand=${exp}: field not present in response`);
    }
  } else {
    console.log(`\n$expand=${exp}: ERROR - ${JSON.stringify(data).slice(0, 100)}`);
  }
}
