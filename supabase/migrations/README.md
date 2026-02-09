# Database Migrations

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of the migration file (e.g., `add_invite_code_used_column.sql`)
5. Paste into the SQL Editor
6. Click **Run** or press `Ctrl+Enter` / `Cmd+Enter`
7. Verify the output shows success

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Current Migrations

### add_invite_code_used_column.sql

**Purpose**: Add `invite_code_used` column to `submolt_members` table for tracking which invite link was used when a member joined.

**Status**: ⏳ Pending

**Instructions**:
1. Open Supabase SQL Editor
2. Copy and paste the SQL from `add_invite_code_used_column.sql`
3. Run the migration
4. Verify the column exists by checking the last SELECT statement output

**What it does**:
- Adds `invite_code_used TEXT` column to `submolt_members`
- Creates an index on the column for better query performance
- Adds a comment explaining the column's purpose

**After running**: The invite links feature will be able to track which members joined through each invite link.
