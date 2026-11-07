-- Kutubxonaga yuklangan himoyalangan fayllar. Asl fayl foydalanuvchiga berilmaydi: o'quvchi sahifa rasmlarini
-- (ustida ismi yozilgan holda) ko'radi, shuning uchun fayl diskda, bazada esa faqat uning holati saqlanadi.
CREATE TABLE material_files (
  id          text PRIMARY KEY,
  org_id      text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id    text REFERENCES users(id) ON DELETE SET NULL,
  name        text NOT NULL,
  ext         text NOT NULL DEFAULT '',
  size        bigint NOT NULL,
  kind        text NOT NULL,                     -- pages | video | audio | none
  status      text NOT NULL DEFAULT 'processing', -- processing | ready | failed
  pages       integer NOT NULL DEFAULT 0,
  ratio       real,                              -- birinchi sahifa: balandlik / kenglik
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_files_org_idx ON material_files (org_id);

-- Kim qachon ochdi va skrinshotga urindi: ustoz jurnalda ko'radi
CREATE TABLE material_events (
  id          bigserial PRIMARY KEY,
  file_id     text NOT NULL REFERENCES material_files(id) ON DELETE CASCADE,
  user_id     text REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,                     -- open | capture
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX material_events_file_idx ON material_events (file_id, created_at DESC);

CREATE INDEX records_library_file_idx ON records ((data->>'fileId')) WHERE collection = 'library';
