/*
# Delete orphaned storage objects

## Purpose
Remove two orphaned files from storage buckets:
1. designer-profiles bucket: 23029881-cdbf-4b30-affa-95bc33507dd3/profile.png
   (profile image from a deleted test designer)
2. databaseupload bucket: supabase-schema-aqcvftydzrsvahiuurts.svg
   (old schema export artifact)

## Method
The storage.protect_delete() trigger checks the setting
'storage.allow_delete_query'. Setting it to 'true' allows direct DELETE
from storage.objects. We use SELECT set_config() to enable it within the
transaction scope, delete the specific objects, then the setting
automatically reverts.

## Note
This migration targets specific orphaned object IDs only. If those objects
no longer exist (already cleaned up), the DELETEs are no-ops. Safe to re-run.
*/

SELECT set_config('storage.allow_delete_query', 'true', true);

DELETE FROM storage.objects WHERE id = '53445c5e-4834-444d-aea4-8bbb40f23b33';
DELETE FROM storage.objects WHERE id = 'a07c5385-0b36-409a-8893-744e12f5d045';
