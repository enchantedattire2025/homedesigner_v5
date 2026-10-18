/*
# Add second image URL to wallpapers_3d

Adds an optional second image column to the wallpapers_3d table so each
wallpaper can display a secondary image (e.g. alternate view or detail shot).
The column is nullable, so existing rows remain valid. Idempotent.
*/

ALTER TABLE wallpapers_3d
  ADD COLUMN IF NOT EXISTS second_image_url text;
