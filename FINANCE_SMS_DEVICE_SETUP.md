# Finance SMS Ingestion - Device Setup Guide

## Overview

This guide explains how to connect a phone to the automated finance pipeline so that incoming
bank SMS messages are parsed and recorded in the cashbook without manual entry.

```
Bank SMS arrives on the phone
  -> companion (Tasker / MacroDroid / iOS Shortcut) POSTs raw text + sender
  -> parser detects bank, direction, amount, balance, card, reference and date
  -> a matching "source" (bank + card -> ledger account) is resolved
  -> confidence >= 70 and auto-post enabled  -> entry created in the cashbook
     otherwise                               -> queued in the review inbox
```

Two things must be configured:

1. An **ingest token** (API key) for the device.
2. At least one **source** per bank/account. A token alone only fills the review queue; it does
   not enable automatic posting.

All timestamps and entry dates are handled in Tehran time by the backend.

---

## Prerequisites

- A user with the `admin_doctor` or `doctor` role (the cashbook owner).
- A cashbook account for each bank account you want to feed.
- The device and the server on the same network (development) or a reachable HTTPS host
  (production).

### Supported bank codes

`melli`, `mellat`, `saderat`, `resalat`, `tejarat`, `parsian`, `pasargad`, `saman`, `sepah`,
`refah`, `shahr`, `keshavarzi`, `maskan`, `ayandeh`, `blubank`, `ansar`, `sarmayeh`.

Messages from an unlisted bank are still parsed by the generic parser but are always queued for
review (their confidence is below the auto-post threshold).

---

## Step 1 - Create the API key (ingest token)

1. Open **Finance** (`/finance`).
2. In the **Bank SMS** panel (`پیامک‌های بانکی`), open the **Sources & devices**
   (`منابع و دستگاه‌ها`) tab.
3. Click **Add device** (`افزودن دستگاه`).
4. Enter a device name (for example `My Pixel`) and choose the platform
   (`android`, `ios`, `web`, `unknown`).
5. Save. The token (`bsi_...`) is displayed **once**; copy it immediately. Only a SHA-256 hash is
   stored on the server.
6. To rotate a token, or if a device is lost, use **Revoke** (`لغو`) on that token and create a
   new one.

The token is bound to the ledger of the user who created it. Anyone holding it can write entries,
so treat it as a password.

---

## Step 2 - Create a source

Still in **Sources & devices**, click **Add source** (`افزودن منبع`):

| Field | Example | Purpose |
| --- | --- | --- |
| Source name | `Melli - clinic` | Display label only |
| Bank | `melli` | Must match the bank detected in the SMS |
| Target account | `Melli cashbook account` | Where entries are posted |
| Card last 4 | `1234` | Strongly disambiguates the account |
| Sender patterns | `BankMelli, Melli` | Comma-separated match against the SMS sender |
| Auto-post | on | Post without review when confidence is high |

Income and expense categories are optional per source; when omitted, fallback categories
(`سایر درآمد` / `سایر هزینه`) are provisioned automatically.

---

## Step 3 - API contract

### Endpoint

```
POST https://<your-host>/api/finance/sms
```

Development (same Wi-Fi): `http://<PC-LAN-IP>:3001/api/finance/sms`
Do not use `localhost` from a phone; use the PC's LAN IP and allow inbound port 3001 in the
Windows firewall.

### Headers

```
Content-Type: application/json
X-Ingest-Token: bsi_xxxxxxxxxxxxxxxxxxxxxxxx
```

Header names are case-insensitive.

### Body

1 to 50 messages per request.

```json
{
  "messages": [
    {
      "clientId": "1712345678901",
      "sender": "BankMelli",
      "text": "بانک ملی ایران\nواریز به حساب شما\nمبلغ: 5,000,000 ریال\nموجودی: 12,450,000 ریال\nشماره پیگیری: 123456",
      "receivedAt": "2026-11-22T09:30:00+03:30"
    }
  ]
}
```

| Field | Required | Limits | Notes |
| --- | --- | --- | --- |
| `text` | yes | 1-2000 chars | The raw SMS body, unmodified |
| `sender` | no | up to 120 chars | Used for source matching and dedupe |
| `clientId` | no | up to 120 chars | Device-generated id; makes retries idempotent |
| `receivedAt` | no | ISO date string | Entry date source; defaults to server time |

Send the SMS exactly as received. The parser handles Persian/Arabic digits, ZWNJ and bidi marks,
thousand separators, rial/toman wording and Persian magnitude words (هزار، میلیون، میلیارد).

### Response

```json
{
  "success": true,
  "data": [
    {
      "messageId": "uuid",
      "status": "posted",
      "entryId": "uuid",
      "reason": null,
      "parserId": "melli.v1",
      "bankCode": "melli",
      "direction": "income",
      "amountRial": "5000000",
      "confidence": 90
    }
  ]
}
```

### Status values

| Status | Meaning | Action |
| --- | --- | --- |
| `posted` | Entry created in the cashbook | None |
| `review` | Parsed but not auto-posted | Approve in the inbox |
| `duplicate` | Same reference/fingerprint already ingested | None |
| `ignored` | OTP, promotional or non-transactional message | None |
| `failed` | Bank message, but amount or direction unclear | Approve manually |

### Review reasons

`no_source`, `auto_post_disabled`, `low_confidence`, `direction_unknown`, `amount_missing`,
`no_account`, `no_category`, `invalid_category`, `category_mismatch`, `category_archived`,
`invalid_account`, `account_archived`, `duplicate_entry`.

---

## Step 4 - Android

### Option A - Tasker (recommended, no code)

1. Install **Tasker** and grant it the **SMS** permission. Disable battery optimization for
   Tasker so it keeps receiving events in the background.
2. Create a profile: **Profiles -> + -> Event -> Phone -> Received Text** (SMS Received).
   Optionally set the *Sender* to the bank sender ids.
3. Create the task and add a **JavaScriptlet** action:
   ```js
   var payload = JSON.stringify({
     messages: [{
       clientId: String(Date.now()),
       sender: SMSRN,
       text: SMSRB
     }]
   });
   ```
   `SMSRB` is the message body and `SMSRN` is the sender, both provided by the event.
4. Add a **Net -> HTTP Request** action:
   - Method: `POST`
   - URL: `https://<your-host>/api/finance/sms`
   - Headers:
     ```
     Content-Type:application/json
     X-Ingest-Token:bsi_xxxxxxxx
     ```
   - Body: `%payload`
5. Save and test by receiving a bank-style SMS, or run the task manually once.

Building JSON with Tasker variables directly (instead of `JSON.stringify`) breaks when the SMS
contains quotes or newlines; prefer the JavaScriptlet above.

### Option B - MacroDroid (simpler UI)

1. Create a macro with the trigger **SMS Received** (optionally filtered by sender).
2. Add the action **HTTP Request**: method `POST`, the URL above, both headers, and the body:
   ```json
   {"messages":[{"clientId":"[timestamp]","sender":"[sms_sender]","text":"[sms_message]"}]}
   ```
3. Grant MacroDroid the SMS permission and exclude it from battery optimization.

### Option C - Custom Android app

A `BroadcastReceiver` for `android.provider.Telephony.SMS_RECEIVED` plus an HTTP client, with the
`RECEIVE_SMS` permission. Note that Google Play restricts SMS permissions to the default SMS
handler, so a custom app is suitable for personal/sideloaded builds only. Tasker and MacroDroid
exist because of this restriction.

---

## Step 5 - iOS (Shortcuts automation)

iOS cannot read SMS history, but it can trigger an automation on new messages (iOS 15+).

1. Open **Shortcuts -> Automation -> + -> Message**.
2. Choose the bank's sender. Create one automation per bank sender.
3. Select **Run Immediately** and turn off *Ask Before Running* so it runs in the background.
4. Add actions:
   1. **Get Details of Shortcut Input** -> *Message Content* (repeat for *Sender* if needed).
   2. **Get Contents of URL**:
      - URL: `https://<your-host>/api/finance/sms`
      - Method: `POST`
      - Headers: `X-Ingest-Token: bsi_xxxxxxxx`
      - Request Body: `JSON`, then add:
        - `messages` -> **Array** -> item 1 -> **Dictionary**:
          - `text` -> the *Message Content* variable
          - `sender` -> the *Sender* variable
          - `clientId` -> *Current Date* (Unix or ISO format)
5. Test by receiving a real bank SMS.

If the JSON editor is difficult to use, build the JSON with a **Text** action and
**Combine Text**, then set *Request Body* to `File` with that text and
`Content-Type: application/json`.

iOS caveats:

- Automations fire on message arrival; nothing is processed retroactively.
- Alphanumeric bank sender ids must be selected explicitly.
- The phone must be on and connected when the message arrives.

---

## Step 6 - Test the connection

PowerShell:

```powershell
$body = @{ messages = @(@{
  clientId = [string][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  sender   = 'BankMelli'
  text     = "واریز 1,000,000 ریال به حساب شما`nموجودی: 2,000,000 ریال`nشماره پیگیری: 999111"
}) } | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/finance/sms' `
  -Headers @{ 'X-Ingest-Token' = 'bsi_xxxx'; 'Content-Type' = 'application/json' } `
  -Body $body
```

curl:

```bash
curl -X POST http://localhost:3001/api/finance/sms \
  -H "X-Ingest-Token: bsi_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"sender":"BankMelli","text":"واریز 1000000 ریال به حساب شما"}]}'
```

Expected: `status: "posted"` and a new cashbook entry. Repeating the same call returns
`duplicate`.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `status: review`, `reason: no_source` | Bank not matched. Add or fix a source with the correct bank, sender pattern or card last 4. |
| `reason: auto_post_disabled` | Enable **Auto-post** on that source. |
| `reason: low_confidence` | Unknown bank or ambiguous wording. Approve manually; add the real phrasing as a parser fixture. |
| `reason: no_category` / `no_account` | Source points at a missing or archived category/account. Recreate the source. |
| `reason: category_mismatch` | The chosen category kind does not match the detected direction. |
| `reason: direction_unknown` | Neither deposit nor withdrawal wording was detected. Approve manually. |
| `reason: amount_missing` | No amount found in the text. Check the raw message and the parser. |
| `401` | Token missing, invalid or revoked. Create a new device token. |
| `403` | A JWT-only endpoint was called. Use `POST /api/finance/sms` with `X-Ingest-Token`. |
| Phone cannot reach the server | Use the PC's LAN IP, same Wi-Fi, and allow inbound port 3001 in the firewall. |
| Nothing appears | Check that the automation is enabled and not set to *Ask Before Running*. |

---

## Security notes

- Use HTTPS in production; the token travels in a request header.
- Use one token per device and revoke it immediately if the device is lost.
- Do not embed the token in exported Tasker profiles or shared Shortcuts.
- Tokens are stored hashed. If the plaintext is lost, create a new device token; there is no way
  to recover the old one.

---

## Reference

- Parser: `src/modules/finance-ingest/sms-parser.ts`
- Service and auto-post logic: `src/modules/finance-ingest/finance-ingest.service.ts`
- DTOs: `src/modules/finance-ingest/finance-ingest.schema.ts`
- Routes: `src/modules/finance-ingest/finance-ingest.routes.ts`
- Migration: `drizzle/0028_finance_ingest.sql`
- Frontend panel: `../frontend/app/components/finance/SmsPanel.vue`
