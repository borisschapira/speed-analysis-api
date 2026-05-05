# Speed Analysis API (proof of concept)

A Node.js CLI tool to interact with the
[Contentsquare Speed Analysis Lab API](https://docs.contentsquare.com/en/api/speed-analysis-lab/).
It supports listing monitorings and computing averaged performance metrics over a
custom time range, with optional TSV export.

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

> **Keep your credentials secure.** Never commit them to version control or share them publicly.

## Usage

```shell
pnpm start
```

The CLI will guide you through a series of prompts:

1. **Mode** - Choose between the two available commands (see below).
2. **Project ID** - Your numeric Contentsquare project ID. Leave empty for project-level credentials.
3. **Client ID** - Your OAuth client ID (input hidden).
4. **Client Secret** - Your OAuth client secret (input hidden).
5. **TSV export** - Whether to export the results to a file (optional).
6. **Output filename** - Pre-filled with a timestamped default (editable).

Press `Ctrl+C` at any prompt to abort.

## Commands

### List monitorings

Retrieves and displays all monitorings configured for the project.

```
? What do you want to do? › List monitorings
```

Output includes: ID, name, URL, state, enabled status, and check frequency.

### Average report data over X days

For each monitoring, fetches all successful reports over the last X days
and displays the pre-computed averages returned by the API.

```
? What do you want to do? › Average report data over X days
? Number of days to average: 30
```

Monitorings are fetched **sequentially** to respect API rate limits.
Monitorings with no successful reports in the selected period are skipped with a warning.

Output includes: score, load time, request count, weight, and key Web Vitals
(FCP, LCP, Speed Index, TBT, CLS, DOM Interactive, Visually Complete, etc.).

## TSV export

Both commands support optional export to a tab-separated values (`.tsv`) file,
which can be opened directly in Excel, Google Sheets, or any spreadsheet tool.

- The `exports/` folder is created automatically if it does not exist.
- The default filename is pre-filled with the project ID and a timestamp:

```
exports/42-monitoring-averages-2026-05-05T15-43.tsv
```

- Each run produces a **new timestamped file**, so previous exports are never overwritten.
- The filename can be edited at the prompt before confirming.

## File structure

```
speed-analysis-api/
├── src/
│   ├── lib/
│   │   ├── auth.js        # Credentials prompt and token retrieval
│   │   ├── api.js         # All Speed Analysis Lab API calls
│   │   └── export.js      # TSV formatting and file writing
│   └── commands/
│       ├── list.js        # List monitorings command
│       └── averages.js    # Averaged metrics command
├── exports/               # Generated export files (git-ignored)
├── index.js               # Entry point and mode selection
├── package.json
├── pnpm-lock.yaml
├── .gitignore
└── README.md
```

## Example session

```
? What do you want to do?           › Average report data over X days
? Project ID:                         42
? Client ID:                          ****************************************
? Client Secret:                      ****************************************
? Export results to a TSV file?     › yes
? Output filename:                    exports/42-monitoring-averages-2026-05-05T15-43.tsv

? Number of days to average:          30

Authenticated successfully. Token expires in 3600s.
Base URL: https://api.eu-west-1.production.contentsquare.com

Found 16 monitoring(s). Fetching averages over the last 30 day(s)...

Fetching [101] Homepage... done (28 report(s))
Fetching [102] Checkout... done (28 report(s))
Fetching [103] Product page... done (0 report(s))
...

⚠ [103] Product page: no successful reports in the last 30 day(s).

┌─ [101] Homepage
│  URL:              https://example.com
│  Reports averaged: 28
│
│  Score:            87
│  Load time:        2340 ms
│  ...
└──────────────────────────────────────────────────

Exported to exports/42-monitoring-averages-2026-05-05T15-43.tsv (15 row(s)).
```

## Notes

- The access token is valid for **1 hour**. If it expires mid-session, re-run the script.
- The base URL is returned dynamically by the authentication endpoint and varies
  depending on which cloud your project is hosted on.

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Authentication failed: 401` | Invalid credentials | Double-check your Client ID and Client Secret |
| `JWT_EXPIRED` | Token has expired | Re-run the script to get a fresh token |
| `Authentication response is missing endpoint` | Wrong scope or credentials | Ensure credentials have the `speed-analysis` scope |
| `Too much concurrent calls (CONCURRENT_API_CALL)` | API rate limit hit | The script already runs requests sequentially; retry after a moment |
| `API returned success: false` | Unexpected API error | Check the full error message for details |