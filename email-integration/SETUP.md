# Email Integration Setup

## Provider setup
- **GMX**: Settings → Email → POP3 & IMAP → enable IMAP
- **Gmail**: needs an App Password (real password won't work) — generate at myaccount.google.com/apppasswords (requires 2FA)
- **Outlook/Hotmail/Yahoo**: enable IMAP in account settings

## Run
```sh
EMAIL=you@gmx.net PASSWORD=yourpassword node index.js
```

## Supported providers
Auto-detects IMAP host by email domain. Supported out of the box:
`gmail.com`, `googlemail.com`, `outlook.com`, `hotmail.com`, `live.com`, `gmx.net`, `gmx.de`, `yahoo.com`

For other providers it guesses `imap.<domain>` which works for most custom domains.
