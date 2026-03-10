
-- 1. Bảng lưu trữ đơn hàng cho Designer
CREATE TABLE IF NOT EXISTS designer_orders (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  store_id TEXT,
  sku TEXT,
  category TEXT,
  price NUMERIC DEFAULT 0,
  link_ds TEXT,
  "check" TEXT, -- Sử dụng nháy kép vì 'check' là từ khóa dự phòng trong SQL
  designer_note TEXT,
  product_url TEXT,
  options_text TEXT,
  url_artwork_front TEXT,
  url_mockup TEXT,
  handler TEXT,
  action_role TEXT,
  is_design_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng ánh xạ SKU sang Phân loại (Category)
CREATE TABLE IF NOT EXISTS sku_mappings (
  sku TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng cấu hình giá theo Phân loại
CREATE TABLE IF NOT EXISTS price_mappings (
  category TEXT PRIMARY KEY,
  price NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE designer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_mappings ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách (Policies) - Cho phép người dùng đã đăng nhập thao tác
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'designer_orders' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON designer_orders FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sku_mappings' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON sku_mappings FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'price_mappings' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON price_mappings FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Gán giá trị cho updated_at. 
    -- Nếu bảng không có cột này, trigger này sẽ gây lỗi khi thực thi.
    -- Do đó, ta phải đảm bảo tất cả các bảng có trigger này đều có cột updated_at.
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Migration: Đảm bảo các bảng hiện có có cột updated_at
DO $$ 
BEGIN 
    -- Handovers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='handovers' AND column_name='updated_at') THEN
        ALTER TABLE handovers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='profiles' AND column_name='updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- News
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='news' AND column_name='updated_at') THEN
        ALTER TABLE news ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Designer Orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='designer_orders' AND column_name='updated_at') THEN
        ALTER TABLE designer_orders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- User Notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='user_notes' AND column_name='updated_at') THEN
        ALTER TABLE user_notes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Price Mappings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='price_mappings' AND column_name='updated_at') THEN
        ALTER TABLE price_mappings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Hàm tạo bảng hàng tháng cho Designer
CREATE OR REPLACE FUNCTION create_monthly_designer_table(target_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            store_id TEXT,
            sku TEXT,
            category TEXT,
            price NUMERIC DEFAULT 0,
            link_ds TEXT,
            "check" TEXT,
            designer_note TEXT,
            product_url TEXT,
            options_text TEXT,
            url_artwork_front TEXT,
            url_mockup TEXT,
            handler TEXT,
            action_role TEXT,
            is_design_done BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )', target_table_name);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table_name);
    
    EXECUTE format('
        DO $policy$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = %L) THEN
                CREATE POLICY "Allow all for authenticated users" ON %I FOR ALL USING (auth.role() = ''authenticated'');
            END IF;
        END $policy$', target_table_name, 'Allow all for authenticated users', target_table_name);

    EXECUTE format('
        DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
        CREATE TRIGGER update_%I_updated_at 
        BEFORE UPDATE ON %I 
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()', target_table_name, target_table_name, target_table_name, target_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hàm kiểm tra bảng tồn tại
CREATE OR REPLACE FUNCTION check_table_exists(target_table_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = target_table_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_designer_orders_updated_at ON designer_orders;
CREATE TRIGGER update_designer_orders_updated_at BEFORE UPDATE ON designer_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_price_mappings_updated_at ON price_mappings;
CREATE TRIGGER update_price_mappings_updated_at BEFORE UPDATE ON price_mappings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. Bảng lưu trữ danh sách Store
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  region TEXT,
  status TEXT,
  listing TEXT,
  sale TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng lưu trữ thông tin người dùng (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'Active',
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng lưu trữ tin tức (News)
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  author TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bảng lưu trữ lượt thích tin tức (News Likes)
CREATE TABLE IF NOT EXISTS news_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(news_id, username)
);

-- 8. Bảng lưu trữ bình luận tin tức (News Comments)
CREATE TABLE IF NOT EXISTS news_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  username TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Bảng lưu trữ bàn giao công việc (Handovers)
CREATE TABLE IF NOT EXISTS handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL,
  task TEXT NOT NULL,
  assignee TEXT NOT NULL,
  deadline_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Pending',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  report TEXT,
  file_link TEXT,
  result_link TEXT,
  image_link TEXT,
  created_by TEXT,
  is_seen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Bảng lưu trữ ghi chú người dùng (User Notes)
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  date TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  columns JSONB DEFAULT '[]'::jsonb,
  show_planner BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(username, date)
);

-- Kích hoạt RLS cho các bảng mới
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách (Policies) cho các bảng mới
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stores' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON stores FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON profiles FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'news' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON news FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'news_likes' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON news_likes FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'news_comments' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON news_comments FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'handovers' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON handovers FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notes' AND policyname = 'Allow all for authenticated users') THEN
        CREATE POLICY "Allow all for authenticated users" ON user_notes FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Trigger tự động cập nhật updated_at cho các bảng mới
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_updated_at ON news;
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_handovers_updated_at ON handovers;
CREATE TRIGGER update_handovers_updated_at BEFORE UPDATE ON handovers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_notes_updated_at ON user_notes;
CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON user_notes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
