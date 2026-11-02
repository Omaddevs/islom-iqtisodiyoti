-- Saytdagi arizalar: kursga yozilish, aloqa formasi, yangiliklarga obuna.
-- Ochiq (akkauntsiz) yuboriladi, faqat bosh administrator ko'radi.
CREATE TABLE leads (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,                    -- enroll | start | contact | subscribe | ...
  name        text,
  phone       text,
  email       text,
  course      text,
  topic       text,
  message     text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_created_idx ON leads (created_at DESC);
