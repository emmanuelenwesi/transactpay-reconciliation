-- Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    customer_email VARCHAR(150),
    channel VARCHAR(50) DEFAULT 'Web',
    gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'success',
    merchant_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Merchants Table for TransactPay API Credentials
CREATE TABLE IF NOT EXISTS merchants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    environment VARCHAR(20) DEFAULT 'live',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add Foreign Key Relationship
ALTER TABLE transactions 
    ADD CONSTRAINT fk_merchant 
    FOREIGN KEY (merchant_id) 
    REFERENCES merchants(id) 
    ON DELETE SET NULL;