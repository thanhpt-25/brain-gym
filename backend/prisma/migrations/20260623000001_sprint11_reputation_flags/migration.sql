-- US-1102 (Sprint 11): Anti-gaming reputation flags
-- Stores suspicious vote records (velocity_burst, vote_ring) for admin review.
-- Points from flagged votes are withheld until admin resolves the flag.

CREATE TABLE reputation_flags (
  id              TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flagged_user_id TEXT        NOT NULL,
  voter_id        TEXT        NOT NULL,
  explanation_id  TEXT        NOT NULL,
  squad_id        TEXT        NOT NULL,
  reason          TEXT        NOT NULL,
  points_held     INTEGER     NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,

  CONSTRAINT fk_reputation_flags_flagged_user FOREIGN KEY (flagged_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reputation_flags_voter        FOREIGN KEY (voter_id)        REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reputation_flags_explanation  FOREIGN KEY (explanation_id)  REFERENCES peer_explanations(id) ON DELETE CASCADE,
  CONSTRAINT fk_reputation_flags_squad        FOREIGN KEY (squad_id)        REFERENCES organizations(id)    ON DELETE CASCADE
);

CREATE INDEX idx_reputation_flags_squad_status      ON reputation_flags (squad_id, status);
CREATE INDEX idx_reputation_flags_flagged_user_date ON reputation_flags (flagged_user_id, created_at);
