-- O'quvchi qaysi materialda qancha vaqt o'tkazgani. Brauzer har ~30 soniyada faol vaqtni yuboradi
-- (sahifa ochiq, ko'rinib turibdi va o'quvchi harakatda), server kun + material bo'yicha qo'shib boradi.
CREATE TABLE study_time (
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id    text REFERENCES organizations(id) ON DELETE CASCADE,
  day       date NOT NULL,                       -- Toshkent vaqti bo'yicha sana
  kind      text NOT NULL CHECK (kind IN ('video', 'library', 'vocab', 'test', 'article', 'homework')),
  ref_id    text NOT NULL,                       -- records.id (video, kutubxona materiali, lug'at to'plami…)
  title     text NOT NULL DEFAULT '',
  seconds   integer NOT NULL DEFAULT 0,
  progress  smallint,                            -- 0–100: ko'rilgan / o'qilgan qismi (eng yuqorisi)
  first_at  timestamptz NOT NULL DEFAULT now(),
  last_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, kind, ref_id)
);
CREATE INDEX study_time_org_day_idx ON study_time (org_id, day);
