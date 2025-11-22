/*
  # Make dom_selector nullable for spatial comments

  1. Changes
    - Alter `threads` table to make `dom_selector` nullable
    - This allows spatial comments (free feature) to work without element selectors
    - Element selector comments (advanced feature) will still store the selector

  2. Security
    - No RLS changes needed
*/

ALTER TABLE threads ALTER COLUMN dom_selector DROP NOT NULL;
