-- Create API tokens table for Bearer token authentication
CREATE TABLE IF NOT EXISTS public.api_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  note TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  game_mode VARCHAR(10) NOT NULL CHECK (game_mode IN ('pvp', 'pve')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);
-- Create index for user lookups
CREATE INDEX idx_api_tokens_user_id ON public.api_tokens(user_id);
-- Create index for token hash lookups
CREATE INDEX idx_api_tokens_token_hash ON public.api_tokens(token_hash);
-- Create index for active tokens
CREATE INDEX idx_api_tokens_active ON public.api_tokens(is_active, expires_at) WHERE is_active = TRUE;
-- Row Level Security Policies
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
-- Users can only view their own tokens
CREATE POLICY "Users can view own API tokens" ON public.api_tokens
  FOR SELECT USING (auth.uid() = user_id);
-- Users can only insert their own tokens
CREATE POLICY "Users can create own API tokens" ON public.api_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can only update their own tokens
CREATE POLICY "Users can update own API tokens" ON public.api_tokens
  FOR UPDATE USING (auth.uid() = user_id);
-- Users can only delete their own tokens
CREATE POLICY "Users can delete own API tokens" ON public.api_tokens
  FOR DELETE USING (auth.uid() = user_id);
