# First Notes

A self-hosted app for running a one-person piano-lesson business. It runs on your own
PC and is made to be used from an iPhone saved to the home screen.

- **Schedule** of weekly, biweekly and one-time lessons, with moves and cancellations
- **Payments and billing**, weekly or monthly, with rate changes that apply from a
  date forward so past lessons keep their old values
- **Stats** showing actual and forecast income
- **Directions and a map** of your students
- **Mileage** between lessons, using driving distances from Google
- **Student details**, including birthdays, books and notes

No build step and no packages to install.

---

## What you need

| You need | Where to get it |
|---|---|
| Node.js 18 or newer | https://nodejs.org |
| A Google API key with the Routes API enabled (only for mileage) | https://console.cloud.google.com |

---

## Setup

1. Save your Google key as `google-key.txt` next to `server.js`. Without it, everything
   except mileage still works.
2. Double-click `start.bat`, or run `node server.js`.
3. Open **http://localhost:3000**. The server window also lists the address to open on
   your phone, which must be on the same Wi-Fi.
4. In the app, set your home address, which mileage uses as a starting point.

The Google Routes API is a paid service. Results are saved in `route-cache.json`, so
each route is only looked up once.

---

## Security

**The server has no login.** It listens on your whole local network, so anyone on your
Wi-Fi can open the app and read or change your data. Don't expose it to the internet.

---

## Your data

Everything is stored in plain files next to `server.js`:

| File | What it holds |
|---|---|
| `data.json` | Students, schedule and payments |
| `route-cache.json` | Saved driving distances, including addresses |
| `changelog.txt` | A log of every change, including student names |
| `google-key.txt` | Your Google key |

`.gitignore` keeps all of these out of the repository. Back up `data.json` to keep your
records.

Student addresses are sent to OpenStreetMap Nominatim for the map and to Google for
mileage. The map library and tiles load over the internet.

---

## Files

```
start.bat     starts the server
server.js     the server (Node, no packages)
index.html    the whole app: styles, markup and script
CLAUDE.md     notes on the code and data model
```
