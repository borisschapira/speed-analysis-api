# Speed Analysis API - Monitoring List

A simple Node.js script to retrieve the monitoring list from the
[Contentsquare Speed Analysis Lab API](https://docs.contentsquare.com/en/api/speed-analysis-lab/).

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

The script will prompt you for the following, in order:

1. **Project ID** - Your numeric Contentsquare project ID. Leave empty if you are using project-level credentials.
2. **Client ID** - Your OAuth client ID (input hidden).
3. **Client Secret** - Your OAuth client secret (input hidden).

### Example session

```
? Project ID (leave empty for project-level credentials): 42
? Client ID: ****************************************
? Client Secret: ****************************************

Authenticated successfully. Token expires in 3600s.
Base URL: https://api.eu-west-1.production.contentsquare.com

Found 2 monitoring(s):

- [101] Homepage
  URL:       https://example.com
  State:     ok
  Enabled:   true
  Frequency: every 60 min

- [102] Checkout
  URL:       https://example.com/checkout
  State:     ok
  Enabled:   true
  Frequency: every 120 min
```

Press `Ctrl+C` at any prompt to abort.

## Notes

- The access token retrieved during authentication is valid for **1 hour**.
  If you run the script again after that period, a new token will be fetched automatically.
- The base URL used to query the API is returned dynamically by the authentication
  endpoint and depends on which cloud your project is hosted on.

## Troubleshooting

| Error | Likely cause | Fix |
|---|---|---|
| `Authentication failed: 401` | Invalid credentials | Double-check your Client ID and Client Secret |
| `JWT_EXPIRED` | Token has expired | Re-run the script to get a fresh token |
| `Authentication response is missing endpoint` | Wrong scope or credentials | Ensure credentials have the `speed-analysis` scope |
| `API returned success: false` | Unexpected API error | Check the full error message for details |