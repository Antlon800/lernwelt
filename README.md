# Lernwelt

Eine allgemeine, responsive Lernplattform für verschiedene Schulfächer.

## Technischer Aufbau

- Cloudflare Workers als Backend und Hosting
- Cloudflare D1 als Datenbank (EU-Jurisdiktion vorgesehen)
- HTML, CSS und JavaScript für die Oberfläche
- SQL-Migrationen unter `migrations/`

## Lokal starten

```bash
npm install
npm run dev
```

## D1-Datenbank einrichten

1. Cloudflare-Konto verbinden und im Projektverzeichnis anmelden: `npx wrangler login`
2. Datenbank erstellen: `npm run db:create`
3. Die von Wrangler ausgegebene Datenbank-ID als D1-Binding `DB` in `wrangler.jsonc` eintragen.
4. Migration lokal testen: `npm run db:migrate:local`
5. Migration in der Remote-Datenbank anwenden: `npm run db:migrate:remote`

## Sicherheit

- Keine Passwörter, Admin-Codes oder API-Schlüssel committen.
- Geheimnisse ausschließlich als Cloudflare Worker Secrets speichern.
- Rollen und Berechtigungen immer serverseitig prüfen.
- Inhalte dürfen später nur von Admin-Konten bearbeitet werden.

## Entwicklungsstand

Das Repository enthält aktuell das responsive Grundlayout, einen Worker-Health-Endpunkt und das erste Datenbankschema. Registrierung, Anmeldung, Admin-CMS und Lernfunktionen werden schrittweise ergänzt.
