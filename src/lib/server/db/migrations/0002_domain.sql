CREATE TABLE categories (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE locations (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE goals (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    kind         TEXT NOT NULL CHECK (kind IN ('goal', 'pot')),
    target_paise INTEGER CHECK (target_paise IS NULL OR target_paise > 0),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'archived')),
    planned_for  TEXT
);

CREATE TABLE lendings (
    id                  INTEGER PRIMARY KEY,
    person              TEXT NOT NULL,
    principal_paise     INTEGER NOT NULL CHECK (principal_paise > 0),
    with_interest_paise INTEGER CHECK (with_interest_paise IS NULL OR with_interest_paise > 0),
    lent_on             TEXT,
    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'written_off')),
    notes               TEXT
);

CREATE TABLE transactions (
    id            INTEGER PRIMARY KEY,
    date          TEXT NOT NULL,
    amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
    direction     TEXT NOT NULL CHECK (direction IN ('income', 'outflow')),
    bucket        TEXT CHECK (bucket IN ('needs', 'wants', 'investments')),
    income_source TEXT CHECK (income_source IN ('job', 'side_hustle', 'other')),
    note          TEXT,
    imported      INTEGER NOT NULL DEFAULT 0 CHECK (imported IN (0, 1)),
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    goal_id       INTEGER REFERENCES goals(id),
    location_id   INTEGER REFERENCES locations(id),
    lending_id    INTEGER REFERENCES lendings(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (direction = 'income' AND bucket IS NULL AND income_source IS NOT NULL)
        OR (direction = 'outflow' AND bucket IS NOT NULL AND income_source IS NULL)
    ),
    CHECK ((goal_id IS NULL) = (location_id IS NULL))
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_goal ON transactions(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX idx_transactions_lending ON transactions(lending_id) WHERE lending_id IS NOT NULL;

CREATE TABLE budget_periods (
    id             INTEGER PRIMARY KEY,
    effective_from TEXT NOT NULL UNIQUE,
    needs_bp       INTEGER NOT NULL CHECK (needs_bp BETWEEN 0 AND 10000),
    wants_bp       INTEGER NOT NULL CHECK (wants_bp BETWEEN 0 AND 10000),
    invest_bp      INTEGER NOT NULL CHECK (invest_bp BETWEEN 0 AND 10000),
    CHECK (needs_bp + wants_bp + invest_bp = 10000)
);

CREATE TABLE salary_projections (
    id                  INTEGER PRIMARY KEY,
    year                INTEGER NOT NULL UNIQUE,
    ending_salary_paise INTEGER NOT NULL CHECK (ending_salary_paise > 0),
    increment_bp        INTEGER
);

CREATE TABLE goal_moves (
    id               INTEGER PRIMARY KEY,
    goal_id          INTEGER NOT NULL REFERENCES goals(id),
    from_location_id INTEGER NOT NULL REFERENCES locations(id),
    to_location_id   INTEGER NOT NULL REFERENCES locations(id),
    amount_paise     INTEGER NOT NULL CHECK (amount_paise > 0),
    date             TEXT NOT NULL,
    note             TEXT
);

CREATE TABLE insurance_policies (
    id                   INTEGER PRIMARY KEY,
    policy_type          TEXT NOT NULL CHECK (policy_type IN ('mediclaim', 'term')),
    person               TEXT NOT NULL,
    policy_number        TEXT,
    activation_date      TEXT,
    cover_paise          INTEGER CHECK (cover_paise IS NULL OR cover_paise > 0),
    cover_post_ncb_paise INTEGER,
    notes                TEXT
);

CREATE TABLE insurance_premiums (
    id           INTEGER PRIMARY KEY,
    policy_id    INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    year         INTEGER NOT NULL,
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    UNIQUE (policy_id, year)
);

CREATE TABLE big_purchases (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    purchase_date TEXT,
    price_paise   INTEGER CHECK (price_paise IS NULL OR price_paise > 0),
    notes         TEXT
);

CREATE TABLE cards (
    id               INTEGER PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE,
    annual_fee_paise INTEGER,
    spend_benefit    TEXT,
    tier1_merchants  TEXT,
    tier2_merchants  TEXT,
    tier3_desc       TEXT,
    caps             TEXT,
    lounge_rule      TEXT,
    exceptions       TEXT,
    use_case         TEXT,
    status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

CREATE TABLE card_rewards (
    id           INTEGER PRIMARY KEY,
    card_id      INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    merchant     TEXT NOT NULL,
    reward_paise INTEGER NOT NULL,
    points       INTEGER,
    period       TEXT
);

CREATE TABLE sip_plans (
    id                  INTEGER PRIMARY KEY,
    monthly_total_paise INTEGER NOT NULL CHECK (monthly_total_paise > 0)
);

CREATE TABLE sip_plan_funds (
    id       INTEGER PRIMARY KEY,
    plan_id  INTEGER NOT NULL REFERENCES sip_plans(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    cap_type TEXT,
    pct_bp   INTEGER NOT NULL CHECK (pct_bp BETWEEN 0 AND 10000)
);

CREATE TABLE emergency_fund_plans (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    planned_months INTEGER NOT NULL CHECK (planned_months > 0)
);

CREATE TABLE emergency_fund_items (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    monthly_paise INTEGER NOT NULL CHECK (monthly_paise > 0)
);
