-- Remove .SA suffix from Brazilian stocks in assets_control
UPDATE assets_control 
SET stock_code = REPLACE(stock_code, '.SA', '')
WHERE table_source = 'br_b3_stocks' AND stock_code LIKE '%.SA';

-- Remove -USD suffix from crypto in assets_control
UPDATE assets_control 
SET stock_code = REPLACE(stock_code, '-USD', '')
WHERE table_source = 'crypto_usd' AND stock_code LIKE '%-USD';