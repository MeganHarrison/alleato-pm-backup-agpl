"use client";

export function DataTablesSection() {
  const rows = [
    { name: "Alleato Group", status: "Active", statusColor: "green", mrr: "$12,400" },
    { name: "Meridian Labs", status: "Active", statusColor: "green", mrr: "$8,200" },
    { name: "Apex Systems", status: "Trial", statusColor: "amber", mrr: "$6,800" },
  ];

  return (
    <section id="tables">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">13</span>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Data Tables — Light Mode</h2>
          <p className="mt-1 text-[13px] text-muted-foreground/60">
            Row hover uses surface-3 instead of rgba white — cleaner on light backgrounds
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-border shadow-sm mb-6">
        {/* Wrong side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-600 bg-red-50 px-2 py-[3px] rounded mb-5">
            ✗ Wrong — Grid borders everywhere
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr>
                {["Name", "Status", "Revenue"].map((col) => (
                  <th
                    key={col}
                    className="bg-muted p-3 px-4 text-left font-bold text-foreground border border-border"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td className="p-3 px-4 text-muted-foreground border border-border">{row.name}</td>
                  <td className="p-3 px-4 text-muted-foreground border border-border">{row.status}</td>
                  <td className="p-3 px-4 text-muted-foreground border border-border">{row.mrr}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            Full cell borders make the table look like Excel. The grid lines compete with the content.
          </p>
        </div>

        {/* Right side */}
        <div className="bg-card p-6">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 px-2 py-[3px] rounded mb-5">
            ✓ Right — Premium table style
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr>
                {["Account", "Status", "MRR"].map((col) => (
                  <th
                    key={col}
                    className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 px-4 pb-2.5 text-left border-b border-border whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} className="hover:bg-muted transition-colors">
                  <td
                    className={`px-4 py-2.5 text-foreground font-medium align-middle${
                      i < rows.length - 1 ? " border-b border-border" : ""
                    }`}
                  >
                    {row.name}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-muted-foreground align-middle${
                      i < rows.length - 1 ? " border-b border-border" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          row.statusColor === "green" ? "bg-green-600" : "bg-amber-600"
                        }`}
                      />
                      {row.status}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-2.5 text-muted-foreground align-middle${
                      i < rows.length - 1 ? " border-b border-border" : ""
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{row.mrr}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground/60 mt-4 pt-3 border-t border-border leading-[1.6]">
            10px uppercase headers, horizontal-only dividers, status dots, monospace numbers.
          </p>
        </div>
      </div>
    </section>
  );
}
