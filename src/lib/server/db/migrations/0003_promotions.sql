-- Promotion-driven weights: promotions + policy are the source of truth,
-- budget_periods becomes a projection rebuilt from them.

CREATE TABLE budget_policy (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    base_effective_from TEXT    NOT NULL,
    base_needs_bp       INTEGER NOT NULL CHECK (base_needs_bp  BETWEEN 0 AND 10000),
    base_wants_bp       INTEGER NOT NULL CHECK (base_wants_bp  BETWEEN 0 AND 10000),
    base_invest_bp      INTEGER NOT NULL CHECK (base_invest_bp BETWEEN 0 AND 10000),
    marg_needs_bp       INTEGER NOT NULL CHECK (marg_needs_bp  BETWEEN 0 AND 10000),
    marg_wants_bp       INTEGER NOT NULL CHECK (marg_wants_bp  BETWEEN 0 AND 10000),
    marg_invest_bp      INTEGER NOT NULL CHECK (marg_invest_bp BETWEEN 0 AND 10000),
    CHECK (base_needs_bp + base_wants_bp + base_invest_bp = 10000),
    CHECK (marg_needs_bp + marg_wants_bp + marg_invest_bp = 10000)
);

INSERT INTO budget_policy
    (id, base_effective_from,
     base_needs_bp, base_wants_bp, base_invest_bp,
     marg_needs_bp, marg_wants_bp, marg_invest_bp)
VALUES (1, '2021-09-01', 5000, 3000, 2000, 2000, 3000, 5000);

CREATE TABLE promotions (
    id             INTEGER PRIMARY KEY,
    effective_date TEXT    NOT NULL UNIQUE,
    increment_bp   INTEGER NOT NULL CHECK (increment_bp > 0),
    note           TEXT
);

-- SQLite cannot drop the old UNIQUE(effective_from), so rebuild the table.
-- Nothing references budget_periods, so no foreign keys are orphaned.
ALTER TABLE budget_periods RENAME TO budget_periods_old;

CREATE TABLE budget_periods (
    id             INTEGER PRIMARY KEY,
    effective_from TEXT    NOT NULL,
    needs_bp       INTEGER NOT NULL CHECK (needs_bp  BETWEEN 0 AND 10000),
    wants_bp       INTEGER NOT NULL CHECK (wants_bp  BETWEEN 0 AND 10000),
    invest_bp      INTEGER NOT NULL CHECK (invest_bp BETWEEN 0 AND 10000),
    source         TEXT    NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('base', 'promotion', 'manual')),
    promotion_id   INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
    CHECK (needs_bp + wants_bp + invest_bp = 10000),
    CHECK ((source = 'promotion') = (promotion_id IS NOT NULL)),
    UNIQUE (effective_from, source)
);

INSERT INTO budget_periods
    (id, effective_from, needs_bp, wants_bp, invest_bp, source, promotion_id)
SELECT id, effective_from, needs_bp, wants_bp, invest_bp, 'manual', NULL
FROM budget_periods_old;

DROP TABLE budget_periods_old;
