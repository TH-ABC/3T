-- SQL Code to create the macrame_products table in Supabase

CREATE TABLE IF NOT EXISTS macrame_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER DEFAULT 1,
  product_name TEXT NOT NULL,
  etsy_link TEXT,
  size TEXT,
  color TEXT,
  unit_price DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  order_date DATE DEFAULT CURRENT_DATE,
  packaging_size TEXT,
  note TEXT,
  label_link TEXT,
  shipping_cost DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT
);

-- Enable Row Level Security
ALTER TABLE macrame_products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to perform all actions
-- You can restrict this further based on your needs
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON macrame_products;
CREATE POLICY "Allow all access for authenticated users" ON macrame_products
  FOR ALL USING (auth.role() = 'authenticated');

-- Index for faster searching
CREATE INDEX IF NOT EXISTS idx_macrame_order_id ON macrame_products(order_id);
CREATE INDEX IF NOT EXISTS idx_macrame_sku ON macrame_products(sku);

-- SQL Code to create the macrame_payments table in Supabase
CREATE TABLE IF NOT EXISTS macrame_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  image_url TEXT,
  image_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT
);

-- Enable Row Level Security
ALTER TABLE macrame_payments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to perform all actions
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON macrame_payments;
CREATE POLICY "Allow all access for authenticated users" ON macrame_payments
  FOR ALL USING (auth.role() = 'authenticated');
