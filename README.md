# Speed Analysis API

A Node.js CLI tool to interact with the
[Contentsquare Speed Analysis Lab API](https://docs.contentsquare.com/en/api/speed-analysis-lab/).

It provides six commands covering monitoring inspection, performance history,
regression detection, period comparison, and performance budgets — with optional
TSV export for every command.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/) v8 or higher
- A Contentsquare account with OAuth credentials (see [below](#credentials))

## Installation

```shell
git clone <your-repo-url>
cd speed-analysis-api
pnpm install
```

## Credentials

You will need a **Client ID** and a **Client Secret** generated from the
[Contentsquare console](https://console.contentsquare.com) by a Contentsquare administrator.

Credentials can be created at two levels:

| Level | When to use | Requires Project ID? |
|---|---|---|
| **Project-level** | Access a single specific project | No |
| **Account-level** | Access any project in the account | Yes |

> **Keep your credentials secure.** Never commit them to version control or share
> them publicly. The CLI prompts for credentials interactively and masks sensitive
> input so nothing is stored on disk.

## Usage

```shell
pnpm start
```

The CLI will guide you through a series of prompts:

1. **Mode** — choose one of the six commands below
2. **Project ID** — your numeric Contentsquare project ID (leave empty for project-level credentials)
3. **Client ID** — masked input
4. **Client Secret** — masked input
5. **TSV export** — optional; if yes, prompts for a filename pre-filled with a timestamped default

Press `Ctrl+C` at any prompt to abort.

## Commands

### 1. List monitorings

Retrieves and displays all monitorings configured for the project.

```
? What do you want to do? › List monitorings
```

Output per monitoring: ID, name, URL, state, enabled status, check frequency.

---

### 2. Average report data over X days

For each monitoring, fetches all successful reports over the last X days and
displays the pre-computed averages returned by the API.

```
? What do you want to do? › Average report data over X days
? Number of days to average: 30
```

Output includes: score, load time, request count, weight, and key Web Vitals
(FCP, LCP, Speed Index, TBT, CLS, DOM Interactive, Visually Complete).

Monitorings with no successful reports in the selected period are skipped with a warning.

---

### 3. Detect regressions vs baseline

Compares the **latest report** of each monitoring against its **N-day average**.
Flags any metric that degrades beyond a configurable percentage threshold.

```
? What do you want to do? › Detect regressions vs baseline
? Number of days for the baseline: 30
? Regression threshold (% degradation to flag): 10
```

Metrics checked: Score, LCP, TBT, Speed Index, Load Time.

---

### 4. Compare two time periods

Computes average metrics for two arbitrary date ranges and shows the delta
for each monitoring. Useful for before/after release comparisons or
quarterly reviews.

```
? What do you want to do? › Compare two time periods
? Period A — start date (YYYY-MM-DD): 2026-04-01
? Period A — end date (YYYY-MM-DD):   2026-04-30
? Period B — start date (YYYY-MM-DD): 2026-05-01
? Period B — end date (YYYY-MM-DD):   2026-05-05
```

---

### 5. Set performance budgets

Automatically generates a `budgets/{projectId}.json` file by computing the
**worst observed value** for each metric across all monitorings over the last
N days.

```
? What do you want to do? › Set performance budgets
? Number of days to compute worst values from: 30
? Save budgets to: budgets/42.json
```

The generated file contains global defaults and per-monitoring overrides.
**Review and tighten the thresholds manually** as your performance improves,
then commit the file to version control to make budgets a team-level contract.

---

### 6. Check performance budgets

Loads `budgets/{projectId}.json` and checks each monitoring's **latest report**
against its thresholds. Reports pass/fail per metric and summarises violations.

```
? What do you want to do? › Check performance budgets
```

**Exits with code 1** when any violation is found, making it suitable as a
CI/CD quality gate.

## TSV export

All commands (except *Set performance budgets*, which manages its own output file)
support optional export to a tab-separated values (`.tsv`) file, readable directly
in Excel, Google Sheets, or any spreadsheet tool.

- The `exports/` folder is created automatically if it does not exist.
- The default filename is pre-filled with the project ID and a timestamp:

```
exports/42-monitoring-budget-2026-05-05T17-52.tsv
```

- Each run produces a **new timestamped file** — previous exports are never overwritten.
- The filename can be edited at the prompt before confirming.

## Performance budgets

Budget files live in the `budgets/` folder, named after the project ID:

```
budgets/
└── 42.json
```

The JSON structure supports **global defaults** and **per-monitoring overrides**:

```json
{
  "defaults": {
    "lcp":   { "max": 4000 },
    "tbt":   { "max": 500  },
    "cls":   { "max": 0.20 },
    "score": { "min": 70   }
  },
  "monitorings": {
    "101": {
      "lcp": { "max": 2500 }
    }
  }
}
```

Per-monitoring values override the defaults for that specific page.
Commit this file to version control.

## Testing

```shell
# Run all tests once
pnpm test

# Watch mode (re-runs on file save)
pnpm test:watch
```

The test suite uses [Vitest](https://vitest.dev/) and covers:

| Test file | What it covers |
|---|---|
| `tests/unit/lib/budget.test.js` | Budget path, merging, metric checking, file I/O |
| `tests/unit/lib/export.test.js` | TSV formatting, file writing |
| `tests/integration/api.test.js` | All API functions with mocked `fetch` |

## File structure

```
speed-analysis-api/
├── src/
│   ├── lib/
│   │   ├── auth.js          # Credentials prompt and OAuth token retrieval
│   │   ├── api.js           # All Speed Analysis Lab API calls
│   │   ├── budget.js        # Budget config: load, save, check, format
│   │   └── export.js        # TSV generation and file writing
│   └── commands/
│       ├── list.js          # List monitorings
│       ├── averages.js      # Average metrics over X days
│       ├── regression.js    # Regression detection vs baseline
│       ├── comparison.js    # Period-over-period comparison
│       ├── budget-set.js    # Generate budget file from historical data
│       └── budget-check.js  # Check latest reports against budget file
├── tests/
│   ├── fixtures/
│   │   └── budget-config.js # Shared sample data for tests
│   ├── unit/
│   │   └── lib/
│   │       ├── budget.test.js
│   │       └── export.test.js
│   └── integration/
│       └── api.test.js
├── budgets/                 # Budget JSON files — commit to version control
│   └── 42.json              # One file per project ID
├── exports/                 # Generated TSV exports — git-ignored
├── index.js                 # Entry point and mode selection
├── package.json
├── pnpm-lock.yaml
├── .gitignore
└── README.md
```

## Notes

- The access token is valid for **1 hour**. If it expires mid-session, re-run the script.
- The base URL is returned dynamically by the authentication endpoint and varies
  by cloud region.
- All monitoring report fetches run **sequentially** to respect the API's concurrent
  call limit.

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Authentication failed: 401` | Invalid credentials | Double-check Client ID and Client Secret |
| `JWT_EXPIRED` | Token has expired | Re-run the script |
| `Authentication response is missing endpoint` | Wrong scope | Ensure credentials have the `speed-analysis` scope |
| `Too much concurrent calls (CONCURRENT_API_CALL)` | Rate limit hit | The script already runs sequentially; wait a moment and retry |
| `No budgets/42.json found` | Budget file missing | Run *Set performance budgets* first |
| `API returned success: false` | Unexpected API error | Check the full error message for details |