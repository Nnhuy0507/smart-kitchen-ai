CREATE TABLE IF NOT EXISTS password_resets (
  user_id BIGINT NOT NULL PRIMARY KEY,
  challenge_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  code_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  reset_digest CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  channel ENUM('email', 'sms') NULL,
  destination VARCHAR(254) NULL,
  password_hash_snapshot VARCHAR(255) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_sent_at DATETIME NULL,
  expires_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB
