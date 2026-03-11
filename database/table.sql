-- 기존 테이블들을 초기화 (데이터 타입 충돌 방지)
DROP TABLE IF EXISTS community_reports CASCADE;
DROP TABLE IF EXISTS community_likes CASCADE;
DROP TABLE IF EXISTS community_posts CASCADE;
DROP TABLE IF EXISTS deficiency_alerts CASCADE;
DROP TABLE IF EXISTS notification_type_settings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS recommendation_feedback CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS nutrition_goals CASCADE;
DROP TABLE IF EXISTS diary_entries CASCADE;
DROP TABLE IF EXISTS ai_scans CASCADE;
DROP TABLE IF EXISTS custom_foods CASCADE;
DROP TABLE IF EXISTS foods CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS meal_logs CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ✅ 확장 설치 불가 환경: DB에서 UUID 자동생성하지 않음
-- → Node(서버)에서 uuidv4() 만들어서 INSERT 할 때 id/user_id에 넣어야 함


-- 1. users (사용자)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT gen_random_uuid() 제거
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    profile_image_url VARCHAR(255),
    gender VARCHAR(20),
    age_group VARCHAR(20),
    height NUMERIC(5,2),
    weight NUMERIC(5,2),
    goals JSONB DEFAULT '[]'::jsonb,
    dietary_restrictions JSONB DEFAULT '[]'::jsonb,
    receive_notifications BOOLEAN DEFAULT true,  -- 기존 설정에서 이동
    eating_habits TEXT,                          -- 기존 설정에서 이동
    allergies TEXT[],                            -- 기존 설정에서 이동
    breakfast_time TIME DEFAULT '08:00',         -- meal_nudge 아침 알림 시간
    lunch_time TIME DEFAULT '12:30',             -- meal_nudge 점심 알림 시간
    dinner_time TIME DEFAULT '19:00',            -- meal_nudge 저녁 알림 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),        -- 기존 설정에서 이동
    deleted_at TIMESTAMPTZ
);

-- 1.5. password_resets (비밀번호 재설정)
CREATE TABLE IF NOT EXISTS password_resets (
    email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
    code VARCHAR(10),
    reset_token VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -- 2. user_settings (사용자 설정) 1:1
-- CREATE TABLE IF NOT EXISTS user_settings (
--     user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
--     receive_notifications BOOLEAN DEFAULT true,
--     eating_habits TEXT,
--     allergies TEXT[],
--     height NUMERIC(5,2),
--     weight NUMERIC(5,2),
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 3. foods (식품 DB)
CREATE TABLE IF NOT EXISTS foods (
    food_code VARCHAR(50) PRIMARY KEY,
    food_name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255),
    category VARCHAR(100),
    serving_size NUMERIC,
    calories NUMERIC,
    carbohydrate NUMERIC,
    protein NUMERIC,
    fat NUMERIC,
    sugars NUMERIC,
    sodium NUMERIC,
    cholesterol NUMERIC,
    saturated_fat NUMERIC,
    trans_fat NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. custom_foods (사용자 등록 식품) users 1:N
CREATE TABLE IF NOT EXISTS custom_foods (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_name VARCHAR(255) NOT NULL,
    serving_size NUMERIC,
    calories NUMERIC,
    carbohydrate NUMERIC,
    protein NUMERIC,
    fat NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ai_scans (AI 스캔) users 1:N
CREATE TABLE IF NOT EXISTS ai_scans (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    scan_result JSONB,
    model_version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'COMPLETED',
    error_message TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. diary_entries (식단 기록) users 1:N, ai_scans N:1
CREATE TABLE IF NOT EXISTS diary_entries (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ai_scan_id UUID REFERENCES ai_scans(id) ON DELETE SET NULL,
    meal_type VARCHAR(20) NOT NULL,
    meal_time TIMESTAMPTZ NOT NULL,
    food_code VARCHAR(50) REFERENCES foods(food_code) ON DELETE SET NULL,
    custom_food_id UUID REFERENCES custom_foods(id) ON DELETE SET NULL,
    serving_size NUMERIC,
    snap_food_name VARCHAR(255),
    snap_calories NUMERIC,
    snap_carbohydrate NUMERIC,
    snap_protein NUMERIC,
    snap_fat NUMERIC,
    snap_sugars NUMERIC,
    snap_sodium NUMERIC,
    snap_cholesterol NUMERIC,
    snap_saturated_fat NUMERIC,
    snap_trans_fat NUMERIC,
    image_url TEXT,
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. nutrition_goals (영양 목표) users 1:N
CREATE TABLE IF NOT EXISTS nutrition_goals (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    target_calories NUMERIC,
    target_carbohydrate NUMERIC,
    target_protein NUMERIC,
    target_fat NUMERIC,
    target_sugars NUMERIC,
    target_sodium NUMERIC,
    target_cholesterol NUMERIC,
    target_saturated_fat NUMERIC,
    target_trans_fat NUMERIC,
    daily_activity_level VARCHAR(50),
    goal_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. daily_summaries (일별 집계 캐시) users 1:N
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_calories NUMERIC DEFAULT 0,
    total_carbohydrate NUMERIC DEFAULT 0,
    total_protein NUMERIC DEFAULT 0,
    total_fat NUMERIC DEFAULT 0,
    total_sugars NUMERIC DEFAULT 0,
    total_sodium NUMERIC DEFAULT 0,
    total_cholesterol NUMERIC DEFAULT 0,
    total_saturated_fat NUMERIC DEFAULT 0,
    total_trans_fat NUMERIC DEFAULT 0,
    total_water NUMERIC DEFAULT 0,
    goal_achieved BOOLEAN DEFAULT false,
    score INTEGER DEFAULT 0,
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, summary_date)
);

-- 9. recommendations (추천 결과) users 1:N
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type VARCHAR(50) NOT NULL,
    recommendation_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    reason TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. recommendation_feedback (추천 피드백) recommendations 1:1
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    recommendation_id UUID NOT NULL UNIQUE REFERENCES recommendations(id) ON DELETE CASCADE,
    user_action VARCHAR(50) NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10.5. notification_type_settings (알림 유형별 사용자 설정) users 1:N
CREATE TABLE IF NOT EXISTS notification_type_settings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, type)
);

-- 11. notifications (알림) users 1:N
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. deficiency_alerts (결핍 알림 이력) users 1:N, notifications N:1
CREATE TABLE IF NOT EXISTS deficiency_alerts (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    deficiency_type VARCHAR(50) NOT NULL,
    current_value NUMERIC,
    target_value NUMERIC,
    consecutive_days INTEGER DEFAULT 3,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. community_posts (커뮤니티 게시물) users 1:N
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 14. community_likes (좋아요) UNIQUE(post_id, user_id)
CREATE TABLE IF NOT EXISTS community_likes (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (post_id, user_id)
);

-- 15. community_reports (신고) UNIQUE(post_id, user_id)
CREATE TABLE IF NOT EXISTS community_reports (
    id UUID PRIMARY KEY,  -- ✅ DEFAULT 제거
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (post_id, user_id)
);

-- ✅ 생성 확인용
SELECT tablename
FROM pg_tables
WHERE schemaname='public'
ORDER BY tablename;