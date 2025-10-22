-- Add company_url column to portfolio_positions table
ALTER TABLE portfolio_positions
ADD COLUMN company_url text;