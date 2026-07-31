import { useState } from "react";

const UOM_OPTIONS = ["SF", "LF", "EA", "LS", "CY", "TN", "HR", "DAY"];
const BUDGET_CODES = [
  "01-1000 · General Conditions",
  "02-2000 · Site Work",
  "03-3000 · Concrete",
  "04-4000 · Masonry",
  "05-5000 · Metals",
  "06-6000 · Wood & Plastics",
  "07-7000 · Thermal & Moisture",
  "08-8000 · Doors & Windows",
  "09-9000 · Finishes",
];

function formatCurrency(val) {
  if (!val && val !== 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val);
}

function parseCurrency(str) {
  const n = parseFloat(str.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function LineItemCard({ item, index, copyUOM, firstUOM, onChange, onRemove, isOnly }) {
  const [codeSearch, setCodeSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUOM, setShowUOM] = useState(false);
  const [unitCostInput, setUnitCostInput] = useState(
    item.unitCost ? item.unitCost.toString() : ""
  );

  const filtered = BUDGET_CODES.filter((c) =>
    c.toLowerCase().includes(codeSearch.toLowerCase())
  );

  const amount = (item.qty || 0) * (item.unitCost || 0);

  return (
    <div className="line-item-card">
      {/* Card header */}
      <div className="card-header">
        <span className="item-number">#{index + 1}</span>
        {!isOnly && (
          <button className="remove-btn" onClick={() => onRemove(item.id)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Budget Code — full width */}
      <div className="field-group full-width">
        <label className="field-label">Budget Code <span className="required">*</span></label>
        <div className="select-wrapper" style={{ position: "relative" }}>
          <div
            className={`code-select ${showDropdown ? "focused" : ""}`}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span className={item.budgetCode ? "selected-value" : "placeholder"}>
              {item.budgetCode || "Select budget code..."}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {showDropdown && (
            <div className="dropdown">
              <input
                className="dropdown-search"
                placeholder="Search codes..."
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <div className="dropdown-list">
                {filtered.length === 0 ? (
                  <div className="dropdown-empty">No results</div>
                ) : (
                  filtered.map((code) => (
                    <div
                      key={code}
                      className={`dropdown-item ${item.budgetCode === code ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(item.id, "budgetCode", code);
                        setShowDropdown(false);
                        setCodeSearch("");
                      }}
                    >
                      {code}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Qty + UOM row */}
      <div className="field-row two-col">
        <div className="field-group">
          <label className="field-label">Qty</label>
          <input
            className="field-input text-right"
            type="number"
            min="0"
            value={item.qty}
            onChange={(e) => onChange(item.id, "qty", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field-group">
          <label className="field-label">UOM</label>
          <div style={{ position: "relative" }}>
            <div
              className={`uom-select ${showUOM ? "focused" : ""}`}
              onClick={() => setShowUOM(!showUOM)}
            >
              <span className={item.uom ? "selected-value" : "placeholder"}>
                {item.uom || "Select"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            {showUOM && (
              <div className="dropdown uom-dropdown">
                <div className="dropdown-list">
                  {UOM_OPTIONS.map((u) => (
                    <div
                      key={u}
                      className={`dropdown-item ${item.uom === u ? "active" : ""}`}
                      onClick={() => {
                        onChange(item.id, "uom", u);
                        setShowUOM(false);
                      }}
                    >
                      {u}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unit Cost + Amount row */}
      <div className="field-row two-col">
        <div className="field-group">
          <label className="field-label">Unit Cost</label>
          <div className="currency-input">
            <span className="currency-symbol">$</span>
            <input
              className="field-input currency-field"
              type="text"
              inputMode="decimal"
              value={unitCostInput}
              onChange={(e) => {
                setUnitCostInput(e.target.value);
                onChange(item.id, "unitCost", parseCurrency(e.target.value));
              }}
              onBlur={() => {
                setUnitCostInput(item.unitCost ? item.unitCost.toFixed(2) : "0.00");
              }}
              onFocus={() => {
                setUnitCostInput(item.unitCost ? item.unitCost.toString() : "");
              }}
            />
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Amount <span className="required">*</span></label>
          <div className="amount-display">
            {formatCurrency(amount)}
          </div>
        </div>
      </div>
    </div>
  );
}

let nextId = 2;

export default function AddBudgetLineItems() {
  const [copyUOM, setCopyUOM] = useState(true);
  const [items, setItems] = useState([
    { id: 1, budgetCode: "", qty: 1, uom: "", unitCost: 0 },
  ]);

  const firstUOM = items[0]?.uom || "";

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        return updated;
      })
    );
    // If updating UOM on first item and copyUOM is on, propagate
    if (field === "uom" && copyUOM) {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          uom: item.id === id ? value : copyUOM ? value : item.uom,
        }))
      );
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: nextId++,
        budgetCode: "",
        qty: 1,
        uom: copyUOM ? firstUOM : "",
        unitCost: 0,
      },
    ]);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const total = items.reduce((sum, i) => sum + (i.qty || 0) * (i.unitCost || 0), 0);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif;
          background: #f0f0f2;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 16px;
        }

        .modal-backdrop {
          background: rgba(0,0,0,0.45);
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .modal {
          background: #fff;
          border-radius: 16px;
          width: 100%;
          max-width: 680px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18);
        }

        .modal-header {
          padding: 20px 20px 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 17px;
          font-weight: 700;
          color: #111;
          letter-spacing: -0.3px;
        }

        .close-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f2f2f2;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #555;
          transition: background 0.15s;
        }
        .close-btn:hover { background: #e5e5e5; }

        .modal-options {
          padding: 12px 20px;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }

        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }
        .checkbox-row input[type="checkbox"] { display: none; }
        .custom-checkbox {
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 1.5px solid #d0d0d0;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .custom-checkbox.checked {
          background: #7c3aed;
          border-color: #7c3aed;
        }
        .checkbox-label {
          font-size: 13px;
          color: #555;
          font-weight: 500;
        }

        /* ---- DESKTOP TABLE HEADER ---- */
        .table-header {
          display: grid;
          grid-template-columns: 28px 1fr 72px 88px 100px 100px;
          gap: 8px;
          padding: 8px 20px;
          background: #fafafa;
          border-bottom: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
        .th {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .th.right { text-align: right; }

        /* ---- DESKTOP TABLE ROW ---- */
        .table-row {
          display: grid;
          grid-template-columns: 28px 1fr 72px 88px 100px 100px;
          gap: 8px;
          padding: 10px 20px;
          align-items: center;
          border-bottom: 1px solid #f7f7f7;
        }
        .row-num {
          font-size: 12px;
          color: #bbb;
          font-weight: 500;
          display: flex;
          align-items: center;
        }

        /* ---- ITEMS SCROLL AREA ---- */
        .items-scroll {
          overflow-y: auto;
          flex: 1;
          padding: 8px 0;
        }

        /* ---- MOBILE CARD ---- */
        .line-item-card {
          margin: 8px 16px;
          background: #fafafa;
          border: 1px solid #eee;
          border-radius: 12px;
          padding: 14px;
          display: none;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .item-number {
          font-size: 11px;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .remove-btn {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #fee2e2;
          border: none;
          color: #dc2626;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .remove-btn:hover { background: #fecaca; }

        .field-group { display: flex; flex-direction: column; gap: 4px; }
        .field-group.full-width { margin-bottom: 10px; }

        .field-label {
          font-size: 11px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .required { color: #e53e3e; }

        .field-row { display: flex; gap: 10px; margin-bottom: 10px; }
        .field-row.two-col > .field-group { flex: 1; }

        .field-input {
          height: 36px;
          border: 1.5px solid #e5e5e5;
          border-radius: 8px;
          padding: 0 10px;
          font-size: 14px;
          color: #111;
          background: #fff;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
          -webkit-appearance: none;
        }
        .field-input:focus { border-color: #7c3aed; }
        .field-input.text-right { text-align: right; }

        .code-select, .uom-select {
          height: 36px;
          border: 1.5px solid #e5e5e5;
          border-radius: 8px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background: #fff;
          transition: border-color 0.15s;
        }
        .code-select:hover, .uom-select:hover { border-color: #bbb; }
        .code-select.focused, .uom-select.focused { border-color: #7c3aed; }

        .placeholder { font-size: 13px; color: #aaa; }
        .selected-value { font-size: 13px; color: #111; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 20px); }

        .dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1.5px solid #e5e5e5;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          z-index: 100;
          overflow: hidden;
        }
        .dropdown-search {
          width: 100%;
          border: none;
          border-bottom: 1px solid #f0f0f0;
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
          color: #111;
        }
        .dropdown-list { max-height: 180px; overflow-y: auto; }
        .dropdown-item {
          padding: 9px 12px;
          font-size: 13px;
          color: #333;
          cursor: pointer;
          transition: background 0.1s;
        }
        .dropdown-item:hover { background: #f5f0ff; }
        .dropdown-item.active { background: #ede9fe; color: #5b21b6; font-weight: 600; }
        .dropdown-empty { padding: 12px; font-size: 13px; color: #aaa; text-align: center; }

        .uom-dropdown { min-width: 80px; }

        .currency-input {
          position: relative;
          display: flex;
          align-items: center;
        }
        .currency-symbol {
          position: absolute;
          left: 10px;
          font-size: 13px;
          color: #888;
          pointer-events: none;
        }
        .currency-field { padding-left: 20px !important; }

        .amount-display {
          height: 36px;
          border-radius: 8px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 10px;
          font-size: 14px;
          font-weight: 600;
          color: #111;
        }

        /* ---- ADD LINE ITEM ---- */
        .add-row {
          padding: 10px 20px;
          flex-shrink: 0;
        }
        .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1.5px dashed #ddd;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 13px;
          color: #888;
          cursor: pointer;
          width: 100%;
          justify-content: center;
          transition: all 0.15s;
          font-weight: 500;
        }
        .add-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

        /* ---- TOTAL ROW ---- */
        .total-row {
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #f0f0f0;
          flex-shrink: 0;
        }
        .total-label {
          font-size: 13px;
          font-weight: 700;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .total-amount {
          font-size: 16px;
          font-weight: 800;
          color: #111;
          min-width: 100px;
          text-align: right;
          letter-spacing: -0.3px;
        }

        /* ---- FOOTER ---- */
        .modal-footer {
          padding: 14px 20px;
          border-top: 1px solid #f0f0f0;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-shrink: 0;
        }
        .btn-cancel {
          height: 40px;
          padding: 0 20px;
          border-radius: 10px;
          border: 1.5px solid #e5e5e5;
          background: #fff;
          font-size: 14px;
          font-weight: 600;
          color: #444;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-cancel:hover { background: #f5f5f5; }
        .btn-create {
          height: 40px;
          padding: 0 20px;
          border-radius: 10px;
          border: none;
          background: #7c3aed;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-create:hover { background: #6d28d9; }
        .btn-create:disabled { background: #c4b5fd; cursor: not-allowed; }

        /* ---- DESKTOP INLINE FIELDS ---- */
        .desktop-qty {
          height: 32px;
          border: 1.5px solid #e5e5e5;
          border-radius: 6px;
          padding: 0 8px;
          font-size: 13px;
          text-align: right;
          width: 100%;
          outline: none;
          -webkit-appearance: none;
        }
        .desktop-qty:focus { border-color: #7c3aed; }

        .desktop-code-select {
          height: 32px;
          border: 1.5px solid #e5e5e5;
          border-radius: 6px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .desktop-code-select:hover { border-color: #bbb; }
        .desktop-uom-select {
          height: 32px;
          border: 1.5px solid #e5e5e5;
          border-radius: 6px;
          padding: 0 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .desktop-amount {
          height: 32px;
          background: #f5f5f5;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 8px;
          font-size: 13px;
          font-weight: 600;
          color: #111;
        }
        .desktop-cost-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .desktop-cost-sym {
          position: absolute;
          left: 8px;
          font-size: 12px;
          color: #888;
        }
        .desktop-cost-input {
          height: 32px;
          border: 1.5px solid #e5e5e5;
          border-radius: 6px;
          padding: 0 8px 0 18px;
          font-size: 13px;
          text-align: right;
          width: 100%;
          outline: none;
        }
        .desktop-cost-input:focus { border-color: #7c3aed; }
        .desktop-remove {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: #bbb;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .desktop-remove:hover { color: #dc2626; background: #fee2e2; }

        /* ---- RESPONSIVE ---- */
        @media (max-width: 560px) {
          .modal { border-radius: 20px; max-height: 95vh; }
          .table-header { display: none !important; }
          .table-row { display: none !important; }
          .line-item-card { display: block !important; }
          .add-row { padding: 8px 16px; }
          .total-row { padding: 10px 16px; }
          .modal-footer { padding: 12px 16px; }
        }

        /* ---- DEMO TOGGLE ---- */
        .demo-toggle {
          position: fixed;
          top: 16px;
          right: 16px;
          display: flex;
          gap: 4px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          padding: 4px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          z-index: 200;
        }
        .toggle-btn {
          padding: 6px 12px;
          border-radius: 7px;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          color: #777;
          background: transparent;
        }
        .toggle-btn.active {
          background: #7c3aed;
          color: #fff;
          box-shadow: 0 2px 6px rgba(124,58,237,0.3);
        }

        .demo-label {
          position: fixed;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: #fff;
          font-size: 11px;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 500;
          pointer-events: none;
          white-space: nowrap;
        }
      `}</style>

      <DemoWrapper>
        <ModalContent
          items={items}
          copyUOM={copyUOM}
          firstUOM={firstUOM}
          total={total}
          setCopyUOM={setCopyUOM}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
        />
      </DemoWrapper>
    </>
  );
}

function DemoWrapper({ children }) {
  const [mode, setMode] = useState("auto");

  return (
    <>
      <div className="demo-toggle">
        <button className={`toggle-btn ${mode === "auto" ? "active" : ""}`} onClick={() => setMode("auto")}>Auto</button>
        <button className={`toggle-btn ${mode === "mobile" ? "active" : ""}`} onClick={() => setMode("mobile")}>Mobile</button>
        <button className={`toggle-btn ${mode === "desktop" ? "active" : ""}`} onClick={() => setMode("desktop")}>Desktop</button>
      </div>

      <style>{`
        ${mode === "mobile" ? `
          .table-header { display: none !important; }
          .table-row { display: none !important; }
          .line-item-card { display: block !important; }
          .modal { max-width: 390px; }
        ` : ""}
        ${mode === "desktop" ? `
          .line-item-card { display: none !important; }
          .table-header { display: grid !important; }
          .table-row { display: grid !important; }
        ` : ""}
      `}</style>

      <div className="modal-backdrop">
        {children}
      </div>

      <div className="demo-label">
        {mode === "auto" ? "Auto-responsive · resize window to toggle" : mode === "mobile" ? "Mobile layout" : "Desktop layout"}
      </div>
    </>
  );
}

function ModalContent({ items, copyUOM, firstUOM, total, setCopyUOM, updateItem, addItem, removeItem }) {
  return (
    <div className="modal">
      {/* Header */}
      <div className="modal-header">
        <span className="modal-title">Add Budget Line Items</span>
        <button className="close-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Options */}
      <div className="modal-options">
        <label className="checkbox-row" onClick={() => setCopyUOM(!copyUOM)}>
          <input type="checkbox" checked={copyUOM} onChange={() => {}} />
          <div className={`custom-checkbox ${copyUOM ? "checked" : ""}`}>
            {copyUOM && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <span className="checkbox-label">Copy UOM to new rows</span>
        </label>
      </div>

      {/* Desktop table header */}
      <div className="table-header">
        <div className="th">#</div>
        <div className="th">Budget Code <span style={{ color: "#e53e3e" }}>*</span></div>
        <div className="th right">Qty</div>
        <div className="th">UOM</div>
        <div className="th right">Unit Cost</div>
        <div className="th right">Amount <span style={{ color: "#e53e3e" }}>*</span></div>
      </div>

      {/* Items */}
      <div className="items-scroll">
        {items.map((item, index) => (
          <div key={item.id}>
            {/* Mobile card */}
            <LineItemCard
              item={item}
              index={index}
              copyUOM={copyUOM}
              firstUOM={firstUOM}
              onChange={updateItem}
              onRemove={removeItem}
              isOnly={items.length === 1}
            />
            {/* Desktop row */}
            <DesktopRow
              item={item}
              index={index}
              onChange={updateItem}
              onRemove={removeItem}
              isOnly={items.length === 1}
            />
          </div>
        ))}

        {/* Add line item */}
        <div className="add-row">
          <button className="add-btn" onClick={addItem}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Line Item
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="total-row">
        <span className="total-label">Total</span>
        <span className="total-amount">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</span>
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button className="btn-cancel">Cancel</button>
        <button className="btn-create">
          Create {items.length} Line Item{items.length !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}

function DesktopRow({ item, index, onChange, onRemove, isOnly }) {
  const [showCode, setShowCode] = useState(false);
  const [showUOM, setShowUOM] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [costInput, setCostInput] = useState(item.unitCost ? item.unitCost.toFixed(2) : "0.00");

  const filtered = BUDGET_CODES.filter((c) =>
    c.toLowerCase().includes(codeSearch.toLowerCase())
  );
  const amount = (item.qty || 0) * (item.unitCost || 0);

  return (
    <div className="table-row">
      {/* # */}
      <div className="row-num">{index + 1}</div>

      {/* Budget code */}
      <div style={{ position: "relative" }}>
        <div
          className="desktop-code-select"
          onClick={() => setShowCode(!showCode)}
        >
          <span className={item.budgetCode ? "selected-value" : "placeholder"} style={{ fontSize: 13 }}>
            {item.budgetCode || "Select budget code..."}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {showCode && (
          <div className="dropdown">
            <input
              className="dropdown-search"
              placeholder="Search..."
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <div className="dropdown-list">
              {filtered.map((code) => (
                <div key={code} className={`dropdown-item ${item.budgetCode === code ? "active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onChange(item.id, "budgetCode", code); setShowCode(false); setCodeSearch(""); }}>
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Qty */}
      <input
        className="desktop-qty"
        type="number"
        min="0"
        value={item.qty}
        onChange={(e) => onChange(item.id, "qty", parseFloat(e.target.value) || 0)}
      />

      {/* UOM */}
      <div style={{ position: "relative" }}>
        <div className="desktop-uom-select" onClick={() => setShowUOM(!showUOM)}>
          <span style={{ fontSize: 12, color: item.uom ? "#111" : "#aaa", fontWeight: item.uom ? 500 : 400 }}>
            {item.uom || "Select"}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {showUOM && (
          <div className="dropdown uom-dropdown">
            <div className="dropdown-list">
              {UOM_OPTIONS.map((u) => (
                <div key={u} className={`dropdown-item ${item.uom === u ? "active" : ""}`}
                  onClick={() => { onChange(item.id, "uom", u); setShowUOM(false); }}>
                  {u}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Unit Cost */}
      <div className="desktop-cost-wrap">
        <span className="desktop-cost-sym">$</span>
        <input
          className="desktop-cost-input"
          type="text"
          inputMode="decimal"
          value={costInput}
          onChange={(e) => { setCostInput(e.target.value); onChange(item.id, "unitCost", parseCurrency(e.target.value)); }}
          onBlur={() => setCostInput(item.unitCost ? item.unitCost.toFixed(2) : "0.00")}
          onFocus={() => setCostInput(item.unitCost ? item.unitCost.toString() : "")}
        />
      </div>

      {/* Amount */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className="desktop-amount" style={{ flex: 1 }}>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)}
        </div>
        {!isOnly && (
          <button className="desktop-remove" onClick={() => onRemove(item.id)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
