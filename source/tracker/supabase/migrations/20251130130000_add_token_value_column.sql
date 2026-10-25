-- Add token_value column to store the actual token for viewing/copying
-- This allows users to view and copy their tokens after initial creation
ALTER TABLE public.api_tokens
ADD COLUMN IF NOT EXISTS token_value TEXT;
-- Add comment to explain the column
COMMENT ON COLUMN public.api_tokens.token_value IS 'Stores the raw token value for user retrieval. Note: This is less secure than hash-only storage, but provides better UX for token management.';
