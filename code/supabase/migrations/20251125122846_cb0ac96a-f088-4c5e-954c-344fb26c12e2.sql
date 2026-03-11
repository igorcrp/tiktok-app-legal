-- Add column to track if user needs to change password
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;

-- Update the column to be non-nullable after adding default
ALTER TABLE public.users 
ALTER COLUMN must_change_password SET NOT NULL;

COMMENT ON COLUMN public.users.must_change_password IS 'Indicates if user must change their temporary password on next login';