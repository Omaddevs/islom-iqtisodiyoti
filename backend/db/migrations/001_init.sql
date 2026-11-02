-- Asosiy sxema: tashkilotlar, foydalanuvchilar, guruhlar va onlayn darslar (meeting).
-- ID'lar matn: frontend'dagi mavjud ID'lar ('u_t1', 'g1', ...) bilan mos kelishi uchun.

CREATE TABLE organizations (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             text PRIMARY KEY,
  org_id         text REFERENCES organizations(id) ON DELETE SET NULL,
  role           text NOT NULL CHECK (role IN ('superadmin', 'org_admin', 'teacher', 'student')),
  name           text NOT NULL,
  phone          text NOT NULL UNIQUE,            -- faqat raqamlar: 998901234567
  password_hash  text NOT NULL,
  avatar_color   text,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  last_seen_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_org_idx ON users (org_id);

CREATE TABLE groups (
  id          text PRIMARY KEY,
  org_id      text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  course      text,
  teacher_id  text REFERENCES users(id) ON DELETE SET NULL,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX groups_org_idx ON groups (org_id);
CREATE INDEX groups_teacher_idx ON groups (teacher_id);

CREATE TABLE group_members (
  group_id  text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members (user_id);

CREATE TABLE meetings (
  id             text PRIMARY KEY,
  code           text NOT NULL UNIQUE,              -- havola kodi: abc-defg-hij
  org_id         text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  group_id       text REFERENCES groups(id) ON DELETE SET NULL,
  host_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  topic          text,
  description    text,
  starts_at      timestamptz NOT NULL,
  duration_min   integer NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
  status         text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  started_at     timestamptz,
  ended_at       timestamptz,
  -- Sozlamalar
  passcode       text,                               -- NULL = parolsiz
  allow_guests   boolean NOT NULL DEFAULT true,      -- akkauntsiz, havola orqali qo'shilish
  waiting_room   boolean NOT NULL DEFAULT true,      -- guruhdan tashqaridagilar host ruxsatini kutadi
  mute_on_entry  boolean NOT NULL DEFAULT false,
  locked         boolean NOT NULL DEFAULT false,     -- yangi ishtirokchilar kira olmaydi
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meetings_org_idx ON meetings (org_id, starts_at DESC);
CREATE INDEX meetings_group_idx ON meetings (group_id);
CREATE INDEX meetings_host_idx ON meetings (host_id);
CREATE INDEX meetings_status_idx ON meetings (status) WHERE status <> 'ended';

-- Davomat: har bir kirish/chiqish sessiyasi alohida qator
CREATE TABLE meeting_attendance (
  id            bigserial PRIMARY KEY,
  meeting_id    text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id       text REFERENCES users(id) ON DELETE SET NULL,
  display_name  text NOT NULL,
  is_guest      boolean NOT NULL DEFAULT false,
  role          text NOT NULL,                       -- host | participant
  joined_at     timestamptz NOT NULL DEFAULT now(),
  left_at       timestamptz
);
CREATE INDEX meeting_attendance_meeting_idx ON meeting_attendance (meeting_id);

CREATE TABLE meeting_messages (
  id           bigserial PRIMARY KEY,
  meeting_id   text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id      text REFERENCES users(id) ON DELETE SET NULL,
  author_name  text NOT NULL,
  kind         text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'system')),
  body         text NOT NULL CHECK (char_length(body) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_messages_meeting_idx ON meeting_messages (meeting_id, id);

CREATE TABLE meeting_recordings (
  id            text PRIMARY KEY,
  meeting_id    text NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  created_by    text REFERENCES users(id) ON DELETE SET NULL,
  file_name     text NOT NULL,
  mime          text NOT NULL,
  size_bytes    bigint NOT NULL,
  duration_sec  integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meeting_recordings_meeting_idx ON meeting_recordings (meeting_id);
