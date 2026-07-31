#!/usr/bin/env python3
"""
CSV import templates for the Alleato PM platform, keyed to real table/column names.
Example rows reproduce the same worked example as the Excel workbook
(Morrisville, $1,000,000 base + $75,000 approved COs, App No. 4).
"""

import csv
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

PID = 876
PRIME_CONTRACT_ID = '00000000-0000-0000-0000-0000000000pc'   # replace with prime_contracts.id
SUBCONTRACT_ID = '00000000-0000-0000-0000-0000000000sc'      # replace with subcontracts.id
PAYAPP_ID = '00000000-0000-0000-0000-000000000pa4'           # replace with prime_contract_payment_applications.id
BILLING_PERIOD_ID = '00000000-0000-0000-0000-00000000bp04'   # replace with billing_periods.id


def write(name, header, rows):
    p = os.path.join(OUT, name)
    with open(p, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)
    print(f'{name:58} {len(header):>2} cols  {len(rows)} example rows')


# ------------------------------------------------------------------ OWNER SOV
write('01-owner-sov__contract_line_items.csv',
      ['contract_id', 'line_number', 'description', 'budget_code_id', 'cost_code_id',
       'quantity', 'unit_cost', 'unit_of_measure', 'total_cost', 'markup_type'],
      [
          [PRIME_CONTRACT_ID, 1, 'General Conditions', '', '', 1, 100000.00, 'LS', 100000.00, ''],
          [PRIME_CONTRACT_ID, 2, 'Cast-in-Place Concrete', '', '', 1, 400000.00, 'LS', 400000.00, ''],
          [PRIME_CONTRACT_ID, 3, 'Structural Steel', '', '', 1, 500000.00, 'LS', 500000.00, ''],
      ])

# -------------------------------------------- OWNER PAY APP — System A header
write('02-owner-payapp-header__prime_contract_payment_applications.csv',
      ['contract_id', 'project_id', 'application_number', 'period_from', 'period_to',
       'billing_date', 'billing_period_id', 'amount', 'retention_amount', 'net_amount',
       'percent_complete', 'status', 'notes'],
      [
          [PRIME_CONTRACT_ID, PID, '4', '2026-07-01', '2026-07-31', '2026-07-31',
           BILLING_PERIOD_ID, 175000.00, 48500.00, 196500.00, 45.12, 'draft',
           'Line 4 = 485,000.00; Line 6 = 436,500.00; Line 7 = 240,000.00'],
      ])

# ---------------------------------- OWNER PAY APP — System A lines (full 5a/5b)
write('03-owner-payapp-lines__payment_application_line_items.csv',
      ['payment_application_id', 'sov_item_id', 'change_order_id', 'item_number', 'description',
       'budget_code', 'scheduled_value', 'work_completed_previous', 'work_completed_this_period',
       'materials_stored', 'retainage_this_period_work_pct', 'retainage_this_period_work',
       'retainage_this_period_materials_pct', 'retainage_this_period_materials',
       'retainage_previous_work', 'retainage_previous_materials',
       'retainage_released_work', 'retainage_released_materials', 'sort_order'],
      [
          [PAYAPP_ID, '', '', '1', 'General Conditions', '01-1000',
           100000.00, 40000.00, 10000.00, 0.00, 10.0, 1000.00, 10.0, 0.00, 4000.00, 0.00, 0.00, 0.00, 1],
          [PAYAPP_ID, '', '', '2', 'Cast-in-Place Concrete', '03-3000',
           400000.00, 200000.00, 50000.00, 20000.00, 10.0, 5000.00, 10.0, 2000.00, 20000.00, 0.00, 0.00, 0.00, 2],
          [PAYAPP_ID, '', '', '3', 'Structural Steel', '05-1200',
           500000.00, 0.00, 100000.00, 30000.00, 10.0, 10000.00, 10.0, 3000.00, 0.00, 0.00, 0.00, 0.00, 3],
          [PAYAPP_ID, '', '', 'CO-001', 'Dock levelers', '11-1300',
           50000.00, 20000.00, 10000.00, 0.00, 10.0, 1000.00, 10.0, 0.00, 2000.00, 0.00, 0.00, 0.00, 4],
          [PAYAPP_ID, '', '', 'CO-002', 'Roof insulation revision', '07-2100',
           25000.00, 0.00, 5000.00, 0.00, 10.0, 500.00, 10.0, 0.00, 0.00, 0.00, 0.00, 0.00, 5],
      ])

# -------------------------------------------- OWNER PAY APP — System B header
write('04-owner-invoice-header__owner_invoices.csv',
      ['prime_contract_id', 'payment_application_id', 'billing_period_id', 'invoice_number',
       'period_start', 'period_end', 'billing_date', 'due_date', 'gross_amount', 'net_amount',
       'paid_amount', 'percent_complete', 'status', 'notes'],
      [
          [PRIME_CONTRACT_ID, PAYAPP_ID, BILLING_PERIOD_ID, 'INV-2026-118-004',
           '2026-07-01', '2026-07-31', '2026-07-31', '2026-08-30',
           175000.00, 196500.00, 0.00, 45.12, 'draft', 'Application No. 4'],
      ])

# --------------------------------------------- OWNER PAY APP — System B lines
write('05-owner-invoice-lines__owner_invoice_line_items.csv',
      ['invoice_id', 'description', 'category', 'scheduled_value', 'work_completed_previous',
       'work_completed_period', 'work_completed_pct', 'materials_stored', 'retainage_pct',
       'retainage_amount', 'retainage_released', 'approved_amount', 'sort_order'],
      [
          ['<owner_invoices.id>', 'General Conditions', 'Base Contract',
           100000.00, 40000.00, 10000.00, 50.00, 0.00, 10.0, 1000.00, 0.00, '', 1],
          ['<owner_invoices.id>', 'Cast-in-Place Concrete', 'Base Contract',
           400000.00, 200000.00, 50000.00, 67.50, 20000.00, 10.0, 7000.00, 0.00, '', 2],
          ['<owner_invoices.id>', 'Structural Steel', 'Base Contract',
           500000.00, 0.00, 100000.00, 26.00, 30000.00, 10.0, 13000.00, 0.00, '', 3],
          ['<owner_invoices.id>', 'CO-001 Dock levelers', 'Change Order',
           50000.00, 20000.00, 10000.00, 60.00, 0.00, 10.0, 1000.00, 0.00, '', 4],
          ['<owner_invoices.id>', 'CO-002 Roof insulation revision', 'Change Order',
           25000.00, 0.00, 5000.00, 20.00, 0.00, 10.0, 500.00, 0.00, '', 5],
      ])

# --------------------------------------------------- OWNER CHANGE ORDERS (Form CO)
write('06-owner-change-orders__prime_contract_change_orders.csv',
      ['prime_contract_id', 'project_id', 'pcco_number', 'title', 'description', 'total_amount',
       'status', 'revision', 'executed', 'field_change', 'schedule_impact', 'change_reason',
       'contract_company', 'location', 'reference', 'request_received_from',
       'designated_reviewer', 'review_date', 'due_date', 'signed_co_received_date',
       'revised_substantial_completion_date', 'is_private'],
      [
          [PRIME_CONTRACT_ID, PID, 'PCCO-001', 'Added dock levelers',
           'Add four 30,000 lb dock levelers at doors 12-15 per ASI-004.', 50000.00,
           'Approved', 0, 'TRUE', 'FALSE', 0, 'Owner Request', 'Alleato Group, LLC',
           'Loading dock', 'ASI-004', 'Northpoint Development LLC', '', '2026-06-18',
           '2026-06-25', '2026-06-20', '', 'FALSE'],
          [PRIME_CONTRACT_ID, PID, 'PCCO-002', 'Revised roof insulation / deleted skylights',
           'Increase roof insulation to R-38 and delete six skylights per Bulletin 3.', 25000.00,
           'Approved', 0, 'TRUE', 'FALSE', 5, 'Design Development', 'Alleato Group, LLC',
           'Roof', 'Bulletin 3', 'Harmon Architects', '', '2026-07-14',
           '2026-07-21', '2026-07-18', '2026-11-15', 'FALSE'],
      ])

write('07-owner-change-order-lines__pcco_line_items.csv',
      ['pcco_id', 'pco_id', 'description', 'cost_code', 'line_amount', 'quantity', 'unit_cost', 'uom'],
      [
          ['<prime_contract_change_orders.id>', '', 'Dock levelers — furnish and install',
           '11-1300', 44000.00, 4, 11000.00, 'EA'],
          ['<prime_contract_change_orders.id>', '', 'Electrical rough-in for levelers',
           '26-0500', 6000.00, 1, 6000.00, 'LS'],
      ])

# --------------------------------------------------------------------- SUB SOV
write('08-sub-sov__subcontract_sov_items.csv',
      ['subcontract_id', 'line_number', 'sort_order', 'description', 'budget_code',
       'project_budget_code_id', 'quantity', 'unit_cost', 'unit_of_measure', 'amount',
       'retainage_percent', 'billed_to_date'],
      [
          [SUBCONTRACT_ID, 1, 1, 'Mobilization', '03-3000', '', 1, 15000.00, 'LS', 15000.00, 10.0, 0.00],
          [SUBCONTRACT_ID, 2, 2, 'Footings and foundations', '03-3000', '', 1, 185000.00, 'LS', 185000.00, 10.0, 0.00],
          [SUBCONTRACT_ID, 3, 3, 'Slab on grade', '03-3000', '', 62000, 3.23, 'SF', 200000.00, 10.0, 0.00],
      ])

# ---------------------------------------------------------- SUB PAY APP header
write('09-sub-invoice-header__subcontractor_invoices.csv',
      ['project_id', 'subcontract_id', 'purchase_order_id', 'billing_period_id', 'invoice_number',
       'jobplanner_pay_app_number', 'period_start', 'period_end', 'billing_date',
       'is_retainage_release', 'status', 'notes'],
      [
          [PID, SUBCONTRACT_ID, '', BILLING_PERIOD_ID, '10482', '4',
           '2026-07-01', '2026-07-31', '2026-07-31', 'FALSE', 'pending',
           'Concrete — App No. 4'],
      ])

# ----------------------------------------------------------- SUB PAY APP lines
write('10-sub-invoice-lines__subcontractor_invoice_line_items.csv',
      ['invoice_id', 'description', 'line_item_type', 'budget_code', 'commitment_value',
       'change_value', 'scheduled_value', 'work_completed_previous', 'work_completed_previous_pct',
       'work_completed_period', 'work_completed_pct', 'materials_stored',
       'retainage_pct', 'retainage_amount', 'retainage_released', 'previous_work_retainage',
       'work_retainage_released', 'materials_retainage_pct', 'materials_retainage_amount',
       'materials_retainage_released', 'previous_materials_retainage', 'sort_order'],
      [
          ['<subcontractor_invoices.id>', 'Mobilization', 'base_contract', '03-3000',
           15000.00, 0.00, 15000.00, 15000.00, 100.00, 0.00, 100.00, 0.00,
           10.0, 0.00, 0.00, 1500.00, 0.00, 10.0, 0.00, 0.00, 0.00, 1],
          ['<subcontractor_invoices.id>', 'Footings and foundations', 'base_contract', '03-3000',
           185000.00, 0.00, 185000.00, 120000.00, 64.86, 40000.00, 86.49, 0.00,
           10.0, 4000.00, 0.00, 12000.00, 0.00, 10.0, 0.00, 0.00, 0.00, 2],
          ['<subcontractor_invoices.id>', 'Slab on grade', 'base_contract', '03-3000',
           200000.00, 0.00, 200000.00, 0.00, 0.00, 60000.00, 40.00, 20000.00,
           10.0, 6000.00, 0.00, 0.00, 0.00, 10.0, 2000.00, 0.00, 0.00, 3],
          ['<subcontractor_invoices.id>', 'CCO-001 Thickened slab at rack posts', 'change_order', '03-3000',
           0.00, 18000.00, 18000.00, 0.00, 0.00, 18000.00, 100.00, 0.00,
           10.0, 1800.00, 0.00, 0.00, 0.00, 10.0, 0.00, 0.00, 0.00, 4],
      ])

# ----------------------------------------------------------- SUB CHANGE ORDERS
write('11-sub-change-orders__contract_change_orders.csv',
      ['contract_id', 'contract_type', 'project_id', 'change_order_number', 'title', 'description',
       'amount', 'status', 'revision', 'executed', 'field_change', 'schedule_impact',
       'prime_change_order_id', 'requested_by', 'requested_date', 'approved_by', 'approved_date',
       'change_reason', 'contract_company', 'location', 'reference', 'request_received_from',
       'designated_reviewer', 'due_date', 'signed_co_received_date', 'is_private'],
      [
          [SUBCONTRACT_ID, 'subcontract', PID, 'CCO-001', 'Thickened slab at rack posts',
           'Thicken slab to 8 in. at 96 rack post locations per structural RFI-041 response.',
           18000.00, 'Approved', 0, 'TRUE', 'FALSE', 0, '', 'Field Superintendent',
           '2026-07-08', 'Project Manager', '2026-07-15', 'Design Clarification',
           'Midwest Concrete Co.', 'Warehouse slab', 'RFI-041', 'Midwest Concrete Co.',
           '', '2026-07-18', '2026-07-16', 'FALSE'],
      ])

write('12-sub-change-order-lines__commitment_change_order_lines.csv',
      ['commitment_change_order_id', 'description', 'amount', 'cost_code_id', 'cost_type_id', 'budget_line_id'],
      [
          ['<contract_change_orders.id>', 'Additional concrete — 34 cy @ $185', 6290.00, '', '', ''],
          ['<contract_change_orders.id>', 'Additional forming and labor', 11710.00, '', '', ''],
      ])

print('\nAll CSV templates written to', OUT)
