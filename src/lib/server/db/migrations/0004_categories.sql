-- Categories become scoped. A category belongs to exactly one bucket (for
-- outflows) or one income source (for income), and the entry form only offers
-- the ones matching what is selected — the daily-spend shape, where picking
-- "Wants" narrows the list to wants categories.
--
-- One `scope` column rather than a nullable bucket plus a nullable source: the
-- form's filter key is whichever of the two is selected, so one column makes
-- that a single equality, and UNIQUE (scope, name) lets "Travel" exist under
-- both Needs and Wants. Its values are the union of the bucket and
-- income_source enums on transactions, 'other' included, so every row a
-- transaction can hold has a scope it could be categorised under.
--
-- The old flat name-only table is dropped rather than migrated: its rows were
-- seeded from the Emergency Fund import and no transaction referenced any of
-- them. The drop is safe with foreign_keys=ON for that same reason — and were
-- there rows, transactions.category_id is ON DELETE SET NULL.
DROP TABLE categories;

CREATE TABLE categories (
    id       INTEGER PRIMARY KEY,
    scope    TEXT NOT NULL CHECK (scope IN
                 ('needs', 'wants', 'investments', 'job', 'side_hustle', 'other')),
    name     TEXT NOT NULL CHECK (length(trim(name)) > 0),
    -- A used category is archived, never deleted: category_id is ON DELETE SET
    -- NULL, so deleting one would silently strip the label off every past row.
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    UNIQUE (scope, name)
);

-- Covers the settings page's per-category usage count, and any later
-- spend-by-category rollup, without scanning the ledger.
CREATE INDEX idx_transactions_category ON transactions(category_id)
    WHERE category_id IS NOT NULL;
