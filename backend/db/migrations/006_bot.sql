-- Telegram bot: obunachilar (platforma akkauntiga bog'lanishi bilan) va bot administratorlari.
CREATE TABLE bot_users (
  tg_id       bigint PRIMARY KEY,
  user_id     text REFERENCES users(id) ON DELETE SET NULL,   -- telefon orqali bog'langan platforma akkaunti
  first_name  text,
  username    text,
  phone       text,                                           -- faqat raqamlar
  blocked     boolean NOT NULL DEFAULT false,                 -- botni bloklagan (xabar yetib bormaydi)
  started_at  timestamptz NOT NULL DEFAULT now(),
  last_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bot_users_user_idx ON bot_users (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE bot_admins (
  tg_id     bigint PRIMARY KEY,
  name      text,
  added_by  bigint,
  added_at  timestamptz NOT NULL DEFAULT now()
);
