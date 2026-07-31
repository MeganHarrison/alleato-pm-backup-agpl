-- ============================================================================
-- Vermillion Rise Project Budget Import
-- ============================================================================
-- This SQL script imports all 75 budget line items for Project ID 67
-- Run this directly in your Supabase SQL Editor
--
-- Tables affected:
--   - cost_code_divisions: CSI division categories (if not already present)
--   - cost_codes: CSI MasterFormat codes (global, reusable)
--   - budget_items: Project-specific budget line items (linked to project 67)
--
-- Prerequisites:
--   - Project with ID 67 must exist in projects table
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- STEP 0: Ensure Cost Code Divisions Exist
-- ============================================================================
INSERT INTO cost_code_divisions (code, title, sort_order)
VALUES
  ('01', '01 General Requirements', 1),
  ('03', '03 Concrete', 3),
  ('04', '04 Masonry', 4),
  ('05', '05 Metals', 5),
  ('07', '07 Thermal and Moisture Protection', 7),
  ('08', '08 Openings', 8),
  ('09', '09 Finishes', 9),
  ('10', '10 Specialties', 10),
  ('11', '11 Equipment', 11),
  ('21', '21 Fire Suppression', 21),
  ('22', '22 Plumbing', 22),
  ('23', '23 HVAC', 23),
  ('26', '26 Electrical', 26),
  ('27', '27 Communications', 27),
  ('31', '31 Earthwork', 31),
  ('32', '32 Exterior Improvements', 32),
  ('50', '50 Professional Services', 50),
  ('55', '55 Other Costs', 55)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- STEP 1: Insert Cost Codes (CSI MasterFormat)
-- ============================================================================
-- Using SELECT...FROM to properly lookup division UUIDs


-- Division 01
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013120', 'Vice President - Labor', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013126', 'Pre-construction - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013127', 'Sr. Project Manager - Labor', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013128', 'Project Manager - Labor', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013130', 'Project Engineer - Labor', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013132', 'Intern - Labor', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013223', 'Construction Layout - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013236', 'Aerial & Periodic Drones - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013238', 'Jobsite Security - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013245', 'Office Supplies - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013247', 'Printing & Copying - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '013249', 'Postage & Courier - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '014126', 'Permit Requirements - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015113', 'Temporary Electric - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015119', 'Temporary Fuel - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015133', 'Temporary Internet/Telecomm - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015213', 'Field Offices - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015216', 'First Aid / Safety Supplies - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015219', 'Temporary Toilets - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015519', 'Temporary Parking Areas - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015626', 'Tempoary Fencing - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015713', 'Temporary Erosion and Sediment - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '015813', 'Temporary Project Signage - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '016113', 'Software Licensing - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '016500', 'Travel & Entertainment - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '016502', 'Truck Allowance - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '016503', 'Truck Fuel - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '016505', 'Marketing - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017123', 'Construction Surveying - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017333', 'Misc Small Tools - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017336', 'Equipment Rental - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017413', 'Progress Cleaning - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017419', 'Dumpsters - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017423', 'Final Cleaning - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '017425', 'General Labor - Expense', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '01'
ON CONFLICT (id) DO NOTHING;


-- Division 03
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '033000', 'Cast-in-Place Concrete - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '03'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '034100', 'Precast Structural Concrete - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '03'
ON CONFLICT (id) DO NOTHING;


-- Division 04
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '042200', 'Concrete Unit Masonry-Block - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '04'
ON CONFLICT (id) DO NOTHING;


-- Division 05
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '051200', 'Structural Steel Framing - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '05'
ON CONFLICT (id) DO NOTHING;


-- Division 07
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '075400', 'Thermoplastic Roofing (TPO) - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '07'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '078400', 'Firestopping - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '07'
ON CONFLICT (id) DO NOTHING;


-- Division 08
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '081113', 'Hollow Metal Door and Frames - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '08'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '084300', 'Storefronts - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '08'
ON CONFLICT (id) DO NOTHING;


-- Division 09
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '092116', 'Gypsum Board Assemblies - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '09'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '092216', 'Non-Structural Metal Framing - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '09'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '099113', 'Exterior Painting - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '09'
ON CONFLICT (id) DO NOTHING;


-- Division 10
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '101400', 'Signage - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '10'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '102813', 'Toilet Accessories - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '10'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '104116', 'Knox Box - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '10'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '104416', 'Fire Extinguishers - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '10'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '107316', 'Canopies - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '10'
ON CONFLICT (id) DO NOTHING;


-- Division 11
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '111300', 'Loading Dock Equipment - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '11'
ON CONFLICT (id) DO NOTHING;


-- Division 21
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '211316', 'Dry-Pipe Sprinkler Systems - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '21'
ON CONFLICT (id) DO NOTHING;


-- Division 22
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '221000', 'Plumbing Piping - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '22'
ON CONFLICT (id) DO NOTHING;


-- Division 23
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '233000', 'HVAC Air Distribution - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '23'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '237000', 'Central HVAC Equipment - Material', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '23'
ON CONFLICT (id) DO NOTHING;


-- Division 26
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '261000', 'Med-Volt Elect Distribution - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '26'
ON CONFLICT (id) DO NOTHING;


-- Division 27
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '274000', 'Fire Alarm & Life Safety Syst - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '27'
ON CONFLICT (id) DO NOTHING;


-- Division 31
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '312213', 'Rough Grading - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '31'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '313200', 'Soil Stabilization - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '31'
ON CONFLICT (id) DO NOTHING;


-- Division 32
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '321216', 'Asphalt Paving - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '321613', 'Curbs and Gutters - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '321623', 'Sidewalks - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '321633', 'Driveways - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '321723', 'Pavement Markings - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '323300', 'Site Furnishings - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '329000', 'Planting - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '32'
ON CONFLICT (id) DO NOTHING;


-- Division 50
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '502000', 'Site Engineering - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '50'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '505000', 'Structural Engineering - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '50'
ON CONFLICT (id) DO NOTHING;


-- Division 52
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '522000', 'Architectural Services - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '52'
ON CONFLICT (id) DO NOTHING;


-- Division 55
INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '550050', 'Insurance - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '55'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '550099', 'Unallocated Costs - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '55'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '550100', 'Contingency - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '55'
ON CONFLICT (id) DO NOTHING;

INSERT INTO cost_codes (id, description, division_id, division_title, status)
SELECT '550500', 'Contractor Fee - Subcontract', d.id, d.title, 'active'
FROM cost_code_divisions d WHERE d.code = '55'
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Insert Budget Items for Project 67 (Vermillion Rise)
-- ============================================================================

INSERT INTO budget_items (
  project_id,
  cost_code_id,
  original_budget_amount,
  budget_modifications,
  approved_cos,
  revised_budget,
  forecast_to_complete
) VALUES
(67, '013120', 60945.0, 0, 0, 60945.0, 60945.0),
(67, '013126', 49356.0, 0, 0, 49356.0, 49356.0),
(67, '013127', 63983.0, 0, 0, 63983.0, 63983.0),
(67, '013128', 152340.0, 0, 0, 152340.0, 152340.0),
(67, '013130', 54847.0, 0, 0, 54847.0, 54847.0),
(67, '013132', 29255.0, 0, 0, 29255.0, 29255.0),
(67, '013223', 1500.0, 0, 0, 1500.0, 1500.0),
(67, '013236', 3500.0, 0, 0, 3500.0, 3500.0),
(67, '013238', 3500.0, 0, 0, 3500.0, 3500.0),
(67, '013245', 5000.0, 0, 0, 5000.0, 4832.01),
(67, '013247', 5000.0, 0, 0, 5000.0, 5000.0),
(67, '013249', 7500.0, 0, 0, 7500.0, 7500.0),
(67, '014126', 0.0, 0, 0, 0.0, 0.0),
(67, '015113', 5000.0, 0, 0, 5000.0, 5000.0),
(67, '015119', 1500.0, 0, 0, 1500.0, 1500.0),
(67, '015133', 2500.0, 0, 0, 2500.0, 2117.85),
(67, '015213', 20000.0, 0, 0, 20000.0, 20000.0),
(67, '015216', 3500.0, 0, 0, 3500.0, 3500.0),
(67, '015219', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '015519', 20339.0, 0, 0, 20339.0, 20339.0),
(67, '015626', 25000.0, 0, 0, 25000.0, 25000.0),
(67, '015713', 5000.0, 0, 0, 5000.0, 5000.0),
(67, '015813', 1500.0, 0, 0, 1500.0, 1500.0),
(67, '016113', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '016500', 50000.0, 0, 0, 50000.0, 49185.47),
(67, '016502', 15000.0, 0, 0, 15000.0, 15000.0),
(67, '016503', 9000.0, 0, 0, 9000.0, 9000.0),
(67, '016505', 2500.0, 0, 0, 2500.0, 2335.44),
(67, '017123', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '017333', 5000.0, 0, 0, 5000.0, 5000.0),
(67, '017336', 12000.0, 0, 0, 12000.0, 12000.0),
(67, '017413', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '017419', 21250.0, 0, 0, 21250.0, 21250.0),
(67, '017423', 25000.0, 0, 0, 25000.0, 25000.0),
(67, '017425', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '033000', 1575000.0, 0, 0, 1575000.0, 573446.0),
(67, '034100', 1175720.0, 0, 0, 1175720.0, 80620.0),
(67, '042200', 350000.0, 0, 0, 350000.0, 350000.0),
(67, '051200', 1443720.0, 0, 0, 1443720.0, 387470.0),
(67, '075400', 550000.0, 0, 0, 550000.0, 550000.0),
(67, '078400', 60000.0, 0, 0, 60000.0, 60000.0),
(67, '081113', 30000.0, 0, 0, 30000.0, 30000.0),
(67, '084300', 40000.0, 0, 0, 40000.0, 40000.0),
(67, '092116', 216200.0, 0, 0, 216200.0, 216200.0),
(67, '092216', 625000.0, 0, 0, 625000.0, 625000.0),
(67, '099113', 113750.0, 0, 0, 113750.0, 113750.0),
(67, '101400', 2500.0, 0, 0, 2500.0, 2500.0),
(67, '102813', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '104116', 1500.0, 0, 0, 1500.0, 1500.0),
(67, '104416', 5000.0, 0, 0, 5000.0, 5000.0),
(67, '107316', 15000.0, 0, 0, 15000.0, 15000.0),
(67, '111300', 238274.0, 0, 0, 238274.0, 238274.0),
(67, '211316', 503000.0, 0, 0, 503000.0, 503000.0),
(67, '221000', 275000.0, 0, 0, 275000.0, 275000.0),
(67, '233000', 1000000.0, 0, 0, 1000000.0, 1000000.0),
(67, '237000', 1300000.0, 0, 0, 1300000.0, 1300000.0),
(67, '261000', 795000.0, 0, 0, 795000.0, 795000.0),
(67, '274000', 35000.0, 0, 0, 35000.0, 35000.0),
(67, '312213', 318728.0, 0, 0, 318728.0, 318728.0),
(67, '313200', 225000.0, 0, 0, 225000.0, 225000.0),
(67, '321216', 375475.0, 0, 0, 375475.0, 375475.0),
(67, '321613', 15000.0, 0, 0, 15000.0, 15000.0),
(67, '321623', 20000.0, 0, 0, 20000.0, 20000.0),
(67, '321633', 30000.0, 0, 0, 30000.0, 30000.0),
(67, '321723', 10000.0, 0, 0, 10000.0, 10000.0),
(67, '323300', 30000.0, 0, 0, 30000.0, 30000.0),
(67, '329000', 65000.0, 0, 0, 65000.0, 65000.0),
(67, '502000', 75000.0, 0, 0, 75000.0, 24500.0),
(67, '505000', 85000.0, 0, 0, 85000.0, 85000.0),
(67, '522000', 50000.0, 0, 0, 50000.0, 50000.0),
(67, '550050', 166991.0, 0, 0, 166991.0, 166991.0),
(67, '550099', 0.0, 0, 0, 0.0, 0.0),
(67, '550100', 618485.0, 0, 0, 618485.0, 618485.0),
(67, '550500', 1403960.0, 0, 0, 1403960.0, 1403960.0);

-- Commit transaction
COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify the import was successful:

-- Count budget items for project 67
SELECT COUNT(*) as total_budget_items
FROM budget_items
WHERE project_id = 67;
-- Expected: 75

-- Sum of original budget amounts
SELECT
  SUM(original_budget_amount) as total_original,
  SUM(revised_budget) as total_revised,
  SUM(forecast_to_complete) as total_forecast
FROM budget_items
WHERE project_id = 67;
-- Expected Original: $14,559,118
-- Expected Revised: $14,559,118
-- Expected Forecast: $11,354,185

-- View budget summary by division
SELECT
  LEFT(cc.id, 2) as division,
  cc.division_title,
  COUNT(*) as item_count,
  SUM(bi.original_budget_amount) as division_budget,
  SUM(bi.forecast_to_complete) as division_forecast
FROM budget_items bi
JOIN cost_codes cc ON bi.cost_code_id = cc.id
WHERE bi.project_id = 67
GROUP BY LEFT(cc.id, 2), cc.division_title
ORDER BY LEFT(cc.id, 2);
