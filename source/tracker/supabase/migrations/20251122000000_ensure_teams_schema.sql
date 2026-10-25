-- Migration to ensure teams and team_memberships tables exist with proper RLS policies
-- This migration uses IF NOT EXISTS to avoid breaking existing setups

-- Create teams table if it doesn't exist
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    join_code TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create team_memberships table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
-- Enable RLS on both tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
-- Create RLS policies for teams table
-- Users can view teams they are members of
CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM team_memberships 
            WHERE user_id = auth.uid()
        )
    );
-- Owners can update their teams
CREATE POLICY "Owners can update their teams" ON teams
    FOR UPDATE USING (
        owner_id = auth.uid()
    );
-- Owners can delete their teams
CREATE POLICY "Owners can delete their teams" ON teams
    FOR DELETE USING (
        owner_id = auth.uid()
    );
-- Users can insert teams (become owners)
CREATE POLICY "Users can insert teams" ON teams
    FOR INSERT WITH CHECK (
        owner_id = auth.uid()
    );
-- Create RLS policies for team_memberships table
-- Users can view memberships for teams they belong to
CREATE POLICY "Users can view memberships for their teams" ON team_memberships
    FOR SELECT USING (
    user_id = auth.uid()
    );
-- Users can insert themselves into teams (joining)
CREATE POLICY "Users can insert themselves into teams" ON team_memberships
    FOR INSERT WITH CHECK (
    user_id = auth.uid()
    );
-- Team owners can update memberships
CREATE POLICY "Team owners can update memberships" ON team_memberships
    FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE id = team_id AND owner_id = auth.uid()
    )
    );
-- Team owners can delete memberships
CREATE POLICY "Team owners can delete memberships" ON team_memberships
    FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM teams 
        WHERE id = team_id AND owner_id = auth.uid()
    )
    OR user_id = auth.uid() -- Users can leave their own teams
    );
-- Add performance indexes on team_memberships
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_id ON team_memberships(team_id);
-- Add unique constraint for join_code to ensure uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_code ON teams(join_code);
