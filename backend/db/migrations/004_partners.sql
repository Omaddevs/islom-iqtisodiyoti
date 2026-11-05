-- Saytdagi «Hamkorlar» bo'limi. Bosh administrator boshqaradi; jadval bo'sh bo'lsa bo'lim saytda ko'rinmaydi.
CREATE TABLE partners (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  type        text,
  logo        text,                             -- /api/files/<nom> (yo'q bo'lsa nom harfi ko'rsatiladi)
  color       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partners_logo_idx ON partners (logo) WHERE logo IS NOT NULL;
