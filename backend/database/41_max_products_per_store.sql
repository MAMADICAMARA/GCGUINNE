ALTER table subscription_plans 
ADD COLUMN max_products_per_store int not null default 50;

UPDATE subscription_plans SET max_products_per_store = 50 WHERE name = 'FREEMIUM';
UPDATE subscription_plans SET max_products_per_store = 100 WHERE name = 'STANDARD';
UPDATE subscription_plans SET max_products_per_store = 1000 WHERE name = 'PROFESSIONNEL';
