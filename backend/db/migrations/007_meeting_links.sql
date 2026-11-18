-- Onlayn dars tashqi xizmatda (Zoom, Google Meet, Teams yoki boshqa havola) o'tishi mumkin.
-- provider = 'platform' — platformaning o'z video xonasi (avvalgidek).
ALTER TABLE meetings
  ADD COLUMN provider       text NOT NULL DEFAULT 'platform' CHECK (provider IN ('platform', 'zoom', 'meet', 'teams', 'link')),
  ADD COLUMN join_url       text CHECK (join_url IS NULL OR char_length(join_url) <= 500),
  ADD COLUMN ext_meeting_id text CHECK (ext_meeting_id IS NULL OR char_length(ext_meeting_id) <= 40),
  ADD COLUMN ext_passcode   text CHECK (ext_passcode IS NULL OR char_length(ext_passcode) <= 40);

-- Tashqi darsda davomat — havolani platforma orqali ochganlar (har biri bir marta)
CREATE UNIQUE INDEX meeting_attendance_ext_once ON meeting_attendance (meeting_id, user_id) WHERE role = 'external';
