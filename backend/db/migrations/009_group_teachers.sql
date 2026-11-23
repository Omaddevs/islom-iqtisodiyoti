-- Bir guruhga bir nechta ustoz, bir ustozga bir nechta guruh.
-- groups.teacher_id «asosiy ustoz» sifatida qoladi (ro'yxatdagi birinchisi, eski kod uchun),
-- ruxsatlar esa shu jadval bo'yicha tekshiriladi.
CREATE TABLE group_teachers (
  group_id  text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_teachers_user_idx ON group_teachers (user_id);

-- Mavjud biriktirishlar ko'chiriladi
INSERT INTO group_teachers (group_id, user_id, added_at)
  SELECT id, teacher_id, created_at FROM groups WHERE teacher_id IS NOT NULL
  ON CONFLICT DO NOTHING;
