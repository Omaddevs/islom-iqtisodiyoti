-- Platformaning qolgan modullari serverga ko'chiriladi (avval brauzer localStorage'ida edi).
-- Tashkilot/foydalanuvchi/guruh — alohida jadvallar (auth va darslar ularga tayanadi),
-- qolgan kontent (video, test, maqola, …) — umumiy `records` jadvalida JSON ko'rinishida.

ALTER TABLE organizations
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  ADD COLUMN data   jsonb NOT NULL DEFAULT '{}'::jsonb;   -- slug, plan, color, phone, email, description

ALTER TABLE users
  ADD COLUMN data jsonb NOT NULL DEFAULT '{}'::jsonb;     -- title, bio, createdBy

ALTER TABLE groups
  ADD COLUMN data jsonb NOT NULL DEFAULT '{}'::jsonb;     -- level, room, schedule

ALTER TABLE group_members
  ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE records (
  collection  text NOT NULL,
  id          text NOT NULL,
  org_id      text REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id    text,                     -- muallif / o'quvchi / bildirishnoma egasi
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX records_org_idx ON records (collection, org_id);
CREATE INDEX records_owner_idx ON records (collection, owner_id);
