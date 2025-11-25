/*
  # Add Thread Delete Policy
  
  1. Changes
    - Add DELETE policy for threads table to allow users with app access to delete threads
  
  2. Security
    - Users can only delete threads in apps they have access to
    - Uses existing has_app_access function for consistency
*/

CREATE POLICY "Users can delete threads in accessible apps"
  ON threads
  FOR DELETE
  TO authenticated
  USING (has_app_access(app_id, auth.uid()));
