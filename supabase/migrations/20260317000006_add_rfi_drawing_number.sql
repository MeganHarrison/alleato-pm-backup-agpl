-- Add drawing_number column to rfis table
-- This field stores the drawing/sheet number associated with the RFI
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS drawing_number text;
