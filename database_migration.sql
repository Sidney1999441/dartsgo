-- ============================================
-- 数据库迁移脚本：添加个人赛功能支持
-- ============================================
-- 执行此脚本以添加个人赛和瑞士轮功能所需的数据库字段
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 为 tournaments 表添加 tournament_type 字段
-- 用于区分团队赛和个人赛
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'team';

-- 添加检查约束，确保值只能是 'team' 或 'individual'
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS tournaments_tournament_type_check;

ALTER TABLE tournaments
ADD CONSTRAINT tournaments_tournament_type_check 
CHECK (tournament_type IN ('team', 'individual'));

-- 2. 为 matches 表添加个人赛相关字段
-- 用于存储个人赛的选手ID
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS home_player_id UUID REFERENCES profiles(id);

ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS away_player_id UUID REFERENCES profiles(id);

-- 3. 添加检查约束：确保团队赛有team_id，个人赛有player_id
-- 但不能同时存在
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS check_match_type;

ALTER TABLE matches
ADD CONSTRAINT check_match_type 
CHECK (
  -- 团队赛：必须有 team_id，不能有 player_id
  (home_team_id IS NOT NULL AND away_team_id IS NOT NULL AND home_player_id IS NULL AND away_player_id IS NULL) OR
  -- 个人赛：必须有 player_id，不能有 team_id
  (home_team_id IS NULL AND away_team_id IS NULL AND home_player_id IS NOT NULL AND away_player_id IS NOT NULL)
);

-- 4. 为现有数据设置默认值（如果有旧数据）
-- 将所有现有的 tournaments 设置为团队赛（默认值）
UPDATE tournaments 
SET tournament_type = 'team' 
WHERE tournament_type IS NULL;

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE '数据库迁移完成！';
  RAISE NOTICE '已添加字段：';
  RAISE NOTICE '  - tournaments.tournament_type';
  RAISE NOTICE '  - matches.home_player_id';
  RAISE NOTICE '  - matches.away_player_id';
END $$;




