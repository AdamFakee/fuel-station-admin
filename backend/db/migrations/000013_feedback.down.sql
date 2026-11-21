DELETE FROM station.role_permission WHERE permission_code LIKE 'feedback.item:%';
DELETE FROM station.permission WHERE module = 'feedback.item';
DROP TABLE IF EXISTS station.feedback;
