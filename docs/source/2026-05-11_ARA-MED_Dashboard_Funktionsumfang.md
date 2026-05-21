# ARA-MED Dashboard - Funktionsumfang und Produktkonzept

Stand: 2026-05-11

## 1. Zielbild

ARA-MED soll als SaaS-Plattform fuer Arztordinationen entstehen, die eine Voice-KI fuer Medstar steuerbar, nachvollziehbar und auswertbar macht.

Das Dashboard ist keine generische Statistikseite. Es ist die operative Steuerzentrale fuer:

- Kontrolle, ob ARA-MED aktiv ist und wie sie sich verhaelt.
- Nachvollziehbarkeit jedes Telefonats.
- Bearbeitung offener Patientenanliegen.
- Konfiguration von Regeln, Oeffnungszeiten, Routing und Terminarten.
- Messung von Entlastung, Sicherheit, Kosten und Automatisierungsgrad.

Medstar bleibt Quelle der Wahrheit fuer Patientenstatus, Terminarten, Profile, Termine und Rezeptmoeglichkeiten. ARA-MED bzw. das Dashboard steuert, welche dieser Moeglichkeiten der Voice-KI angeboten werden duerfen.

## 2. Produktprinzipien

### Vertrauen vor Automatisierung

Aerzte und Ordinationsmitarbeiter akzeptieren die Voice-KI nur, wenn sie sehen koennen, was passiert ist. Deshalb sind Call-Log, Audio, Transkript, Zusammenfassung, Aktionen und Fehlerstatus MVP-relevant.

### Wenige, wirksame Einstellungen

Das Dashboard darf kein komplexer Regelbaukasten werden. Die Praxis braucht schnelle Schalter fuer den Alltag:

- ARA aktiv oder pausiert.
- Normalbetrieb, Urlaub, Vertretung, Ueberlastung.
- Oeffnungszeiten und Sondertage.
- Welche Terminarten die KI buchen darf.
- Wann weitergeleitet oder ein Ticket erstellt wird.

### SaaS von Anfang an vorbereiten

Auch wenn aktuell nur eine Ordination relevant ist, muss das Datenmodell mandantenfaehig sein. Jede mandantenbezogene Tabelle braucht langfristig eine `tenant_id`.

### Keine Logikverdopplung

Medstar entscheidet nicht im Dashboard, sondern liefert Daten und fuehrt Aktionen aus. Das Dashboard verwaltet nur ARA-MED-spezifische Exposition, Regeln, Prompts, Berechtigungen und Auswertungen.

### Provider bleiben unsichtbar

Die Ordination und Patienten sollen nicht sehen, welche Plattformen im Hintergrund genutzt werden. ElevenLabs, Docker, Postgres, n8n, Messaging-Provider oder Mail-Provider sind technische Infrastruktur und duerfen im Frontend nicht als Marke oder Plattform sichtbar werden.

Das Produkt spricht immer von ARA-MED:

- ARA-MED Voice.
- ARA-MED Nachricht.
- ARA-MED Erinnerung.
- ARA-MED Routing.

Technische Provider muessen austauschbar bleiben.

## 3. Relevanter Marktstandard

Vergleichbare Anbieter zeigen wiederkehrende Kernmodule:

- Zentrale Anfragenliste mit Status und Kategorien.
- KI-Zusammenfassung, Transkript und teilweise Audio.
- Terminbuchung oder Ticket-Erstellung.
- Oeffnungszeiten, Ansagetexte und Praxisinformationen.
- Weiterleitung und Eskalation.
- Basisstatistiken.

ARA-MED kann sich differenzieren durch:

- Medstar-nahe End-to-End-Aktionen fuer Termine und Rezepte.
- Vollstaendige Nachvollziehbarkeit je Call.
- Konfigurierbares Routing inklusive WIP/VIP/Bypass.
- Mandantenfaehige SaaS-Struktur fuer unterschiedliche Fachrichtungen.
- Rechte pro Modul und Kategorie statt nur grober Rollen.

## 4. Empfohlene Ausbaustufen

## Stufe 1 - MVP: Vertrauen, Kontrolle, Betrieb

Ziel: Eine Ordination kann ARA-MED sicher betreiben und jedes Ergebnis nachvollziehen.

### 4.1 Dashboard-Uebersicht

Kernanzeigen:

- ARA-MED Status: aktiv, pausiert, gestoert.
- Praxisstatus: offen, geschlossen, Sondermodus.
- Aktueller Modus: Normal, Urlaub, Vertretung, Ueberlastung.
- Live-Anrufe oder letzte Aktivitaet.
- Offene Aufgaben.
- Kritische oder eskalierte Faelle.
- Automatisiert geloeste Anliegen heute.
- Kosten oder Minutenverbrauch als Platzhalter.

### 4.2 Telefonate / Call-Log

Der Call-Log ist das zentrale Vertrauensmodul.

Pro Telefonat speichern und anzeigen:

- Zeitstempel.
- Telefonnummer.
- Patient erkannt: ja/nein.
- PID-Status, aber personenbezogene Details nur berechtigungsabhaengig.
- Optional SVNR nur wenn fachlich und rechtlich notwendig; standardmaessig vermeiden oder maskieren.
- Intent und Subintent.
- Sprache.
- Dauer.
- Status: geloest, offen, weitergeleitet, fehlgeschlagen, abgebrochen.
- Aktionen: Termin gebucht, storniert, verschoben, Rezept bestellt, Nachricht erstellt, Weiterleitung, Notfallhinweis.
- Audio-Link.
- Transkript.
- KI-Zusammenfassung.
- technische Fehler.
- Kosten bzw. Verbrauch.

Wichtig: Telefonnummern-Historie anzeigen, z. B. wie oft dieselbe Nummer angerufen hat, welche Intents vorkamen und ob wiederholt Probleme entstehen.

### 4.3 Call-Detail

Detailansicht je Telefonat:

- Audio Player.
- Volltext-Transkript.
- strukturierte Zusammenfassung.
- erkannte Patientendaten.
- Entscheidungsweg der KI.
- ausgefuehrte Medstar-Aktionen.
- Fehler und API-Antwortstatus.
- interne Notizen.
- manuelle Korrektur von Kategorie/Intent.
- Feedback: korrekt, falsch erkannt, Training noetig.

### 4.4 Inbox / Aufgaben

Alle Faelle, bei denen ein Mensch eingreifen muss:

- Patient nicht identifizierbar.
- PID ungueltig oder nicht aktiv.
- mehrere Treffer.
- Rueckruf notwendig.
- Rezept nicht moeglich.
- unklarer Intent.
- Notfall-/Akutfall-Hinweis.
- technische Fehler.

Status:

- offen.
- in Bearbeitung.
- erledigt.
- archiviert.

### 4.5 Basis-Konfiguration

MVP-Konfiguration:

- ARA-MED aktivieren/deaktivieren.
- Oeffnungszeiten.
- Sondertage/geschlossen.
- Vertretungsmodus.
- Weiterleitungsnummern.
- erlaubte Terminarten.
- Rezeptfunktion aktiv/inaktiv.
- Rueckruf/Nachricht aktiv/inaktiv.
- direkte Vermittlung waehrend Oeffnungszeiten.

### 4.6 Intent- und Terminarten-Mapping

Funktionen:

- Medstar-Terminarten synchron anzeigen.
- pro Terminart festlegen: sichtbar, KI-buchbar, nur intern.
- Synonyme und typische Formulierungen zuordnen.
- Standard-Terminart fuer unklare Beschwerden.
- Sonderfall Fuehrerscheinuntersuchung mit PID=0-Regel.

### 4.7 Basis-Statistiken

Nur die wichtigsten Kennzahlen:

- Anrufe pro Tag/Woche/Monat.
- durchschnittliche Dauer.
- automatisch geloeste Quote.
- Weiterleitungsquote.
- offene Aufgaben.
- gebuchte Termine.
- Rezeptanfragen.
- kritische/escalierte Faelle.
- haeufigste Intents.
- Kosten bzw. Verbrauch.

## Stufe 2 - Praxissteuerung und Differenzierung

Ziel: Die Praxis kann ARA-MED feiner an eigene Prozesse anpassen.

### 4.8 Routing-Regeln

Ein allgemeiner Routing-Layer ersetzt eine zu enge VIP-Funktion.

Regeltypen:

- Telefonnummer-basiert.
- Prompt-/Intent-basiert, z. B. Apotheke, Labor, Krankenhaus.
- Terminart-basiert.
- Zeitraum-basiert.
- Modus-basiert, z. B. Urlaub oder Vertretung.

Moegliche Aktionen:

- direkt verbinden.
- eigenes Prompt verwenden.
- Ticket erstellen.
- Bypass-Slot anbieten.
- an bestimmte Nummer weiterleiten.
- Nachricht aufnehmen.

### 4.9 WIP/VIP/Bypass

WIP: Nummern, die immer durchgestellt werden duerfen.

VIP/Bypass: allgemeinere Sonderregeln fuer:

- Privatpatienten.
- Apotheken.
- Labore.
- andere Aerzte.
- Schulungen.
- private Leistungen ausserhalb normaler Medstar-Logik.

Bypass muss konfigurierbar sein: direkte Weiterleitung, eigener Prompt oder Ticket.

### 4.10 Kalender mit Layern

Der Kalender braucht langfristig mehrere Ebenen:

- regulaere Oeffnungszeiten.
- Sondertage und Feiertage.
- Vertretungszeiträume.
- Terminart-Overrides.
- Bypass-/Privatleistungsfenster.

Im MVP reicht eine einfache Wochen- und Sondertagsverwaltung. Layer-Kalender ist Stufe 2.

### 4.11 Vertretungsmanagement

Funktionen:

- Vertretungsarzt anlegen.
- Zeitraum zuordnen.
- eigener Begruessungstext.
- eigene Weiterleitungsnummer.
- Verhalten fuer Nicht-Patienten bzw. PID=0.
- Modus "Wir vertreten andere Ordination".

### 4.12 Medikamentenliste

Globale Liste fuer die Ordination:

- PZNR.
- Medikamentenname.
- Aussprache fuer Voice-KI.
- aktiv/inaktiv.
- Notiz fuer Operator.

Diese Liste ersetzt nicht Medstar-Rezeptlogik. Sie verbessert Aussprache, Erkennung und Bedienbarkeit.

### 4.13 Training und Praxiswissen

Pflegbare Inhalte:

- FAQ.
- Parkmoeglichkeiten.
- Adresse.
- Kasseninformation.
- Vorbereitung auf Untersuchungen.
- Standardantworten.
- Ansagetexte je Modus.

### 4.14 Kommunikationsrouting

ARA-MED braucht ein eigenes Kommunikationsmodul. Es steuert, wie ARA-MED mit der Ordination kommuniziert und wie die Ordination bzw. ARA-MED Patienten kontaktiert.

Das Modul darf nicht kanalhart gebaut werden. Es braucht einen Routing-Layer:

- Ereignis tritt ein.
- Regel prueft Kontext.
- Empfaenger wird bestimmt.
- Kanal wird bestimmt.
- Template wird gerendert.
- Versand wird protokolliert.

#### Richtung Ordination

Moegliche Ereignisse:

- Patient nicht identifizierbar.
- Rueckruf notwendig.
- kritischer oder akuter Fall.
- Rezeptanfrage offen.
- Medstar-Aktion fehlgeschlagen.
- Termin wurde gebucht/storniert/verschoben.
- VIP/WIP/Bypass-Anruf.
- technische Stoerung.
- ARA-MED deaktiviert oder Fehlerzustand.

Moegliche Kanaele:

- Medstar-Direktnachricht.
- interne ARA-MED Inbox.
- E-Mail.
- Telegram.
- WhatsApp.
- SMS.
- Voicecall.
- Webhook.

#### Richtung Patient

Moegliche Ereignisse:

- Terminbestaetigung.
- Terminerinnerung.
- Terminverschiebung.
- Terminabsage.
- Rueckrufbestaetigung.
- Rezeptbestellung eingegangen.
- Rezept nicht moeglich.
- allgemeine Praxisinformation.
- Vorbereitung auf Termin, z. B. Fuehrerscheinuntersuchung.

Moegliche Kanaele:

- SMS.
- E-Mail.
- WhatsApp.
- Voicecall.
- Medstar-kompatible Nachricht, falls vorhanden.

#### Routing-Regel

Eine Kommunikationsregel sollte mindestens enthalten:

- `tenant_id`.
- Richtung: `ordination` oder `patient`.
- Ereignistyp.
- Prioritaet.
- Empfaengergruppe oder Ziel.
- Kanal.
- Fallback-Kanal.
- Template.
- Aktivitaetsstatus.
- Zeitfenster.
- Wiederholungslogik.
- maximale Versuche.
- Datenschutzklasse.

#### Template-System

Das Dashboard braucht Vorlagen fuer Nachrichten:

- E-Mail-Templates.
- SMS-/WhatsApp-Templates.
- interne Medstar-/Inbox-Nachrichten.
- Voicecall-Skripte.
- Betreffzeilen.
- Variablen wie `patient_name`, `appointment_date`, `appointment_type`, `practice_name`, `callback_phone`.
- Sprachversionen ueber `language_code` vorbereiten.

Ein Template-Generator kann spaeter helfen, Vorlagen aus einer Beschreibung zu erstellen. Im MVP reicht eine sichere Vorlagenverwaltung mit Vorschau und Testversand.

#### Kommunikationslog

Jeder ausgehende oder interne Kommunikationsversuch muss protokolliert werden:

- Ereignis.
- Kanal.
- Empfaenger.
- Template-Version.
- Status: geplant, gesendet, zugestellt, fehlgeschlagen, abgebrochen.
- Fehlergrund.
- Zeitpunkt.
- ausloesender Call oder Task.
- verantwortlicher Benutzer oder System.

Wichtig: Die Plattform darf gegenueber Ordination und Patient nicht offenlegen, ob technisch Telegram, WhatsApp, ElevenLabs oder ein anderer Dienst genutzt wurde. Sichtbar ist nur ARA-MED und der gewaehlte Kommunikationskanal.

## Stufe 3 - SaaS, Skalierung, Business

Ziel: Mehrere Ordinationen und Fachrichtungen koennen auf einer Plattform betrieben werden.

### 4.15 Multi-Tenant Verwaltung

Operator-Funktionen:

- Mandanten anlegen.
- Hostnames verwalten.
- Medstar-Server/API-Konfiguration.
- ElevenLabs-Konfiguration.
- n8n-/Webhook-Konfiguration.
- Fallback-Mailadressen.
- Weiterleitungsnummern.
- aktive Features pro Mandant.
- Support-/News-Block.

### 4.16 Profile, Abteilungen und Gemeinschaftspraxen

Medstar-Profile langfristig abbilden:

- ein Profil pro Arzt, Abteilung oder Leistungsbereich.
- Regeln optional profilbezogen.
- Terminarten pro Profil.
- Oeffnungszeiten pro Profil.
- Auswertungen pro Profil.

Aktuell sollte nur ein Profil aktiv genutzt werden, aber Datenmodell und UI sollten spaeter mehrere Profile erlauben.

### 4.17 Mehrsprachigkeit

Von Anfang an im Datenmodell vorbereiten:

- `language_code` fuer Prompts, Begruessungen, FAQ und Stimmen.
- Deutsch als Standard.
- weitere Sprachen spaeter aktivierbar.
- Stimme pro Sprache.
- unterschiedliche Begruessungstexte je Sprache und Modus.

### 4.18 Kosten, Guthaben und Billing

Spaeteres Modul:

- Minutenverbrauch.
- Kosten pro Call.
- Kosten pro Mandant.
- Guthaben/Quota.
- Warnschwellen.
- ARA remote deaktivieren bei gesperrtem Konto.
- Rechnungsexport.

Im MVP nur Platzhalter und Verbrauchsanzeige vorsehen.

## 5. Rechte- und Berechtigungssystem

Das Rechtesystem ist nicht optional. Es muss frueh implementiert werden, weil medizinische Daten, Konfigurationen und SaaS-Betrieb unterschiedliche Verantwortlichkeiten haben.

## 5.1 Grundrollen

### Operator

Plattformbetreiber bzw. ITEX/ARA-MED Admin.

Darf:

- Mandanten verwalten.
- System-Settings bearbeiten.
- API-Konfigurationen pflegen.
- globale Features aktivieren/deaktivieren.
- technische Logs sehen.
- Benutzerrollen innerhalb technischer Grenzen setzen.
- Supportinformationen und News pflegen.

### Ordinationsadmin / Arzt

Medizinisch bzw. organisatorisch verantwortliche Person eines Mandanten.

Darf:

- Praxisregeln konfigurieren.
- Oeffnungszeiten bearbeiten.
- Vertretung konfigurieren.
- erlaubte Terminarten verwalten.
- Routingregeln verwalten, sofern freigeschaltet.
- Mitarbeiter anlegen.
- Rechte vergeben, aber maximal im eigenen Rechteumfang.
- Calls, Transkripte und Audio sehen, sofern Datenschutz-/Mandantenrechte greifen.

### Ordinationsassistenz

Operative Rolle fuer Empfang und Backoffice.

Darf typischerweise:

- Call-Log lesen.
- Inbox bearbeiten.
- Notizen erstellen.
- Aufgaben abschliessen.
- Rueckrufe bearbeiten.
- je nach Freigabe einfache Einstellungen aendern, z. B. Tagesmodus oder Ressourcenstatus.

### Viewer

Reine Leseberechtigung.

Darf:

- freigegebene Dashboards sehen.
- Statistiken sehen.
- keine personenbezogenen Details sehen, wenn nicht explizit erlaubt.
- nichts bearbeiten.

## 5.2 Modul- und Kategorie-Rechte

Neben Rollen braucht es feingranulare Rechte je Modul/Kategorie.

Empfohlenes Schema:

- `none`: kein Zugriff.
- `view`: lesen.
- `edit`: bearbeiten.
- `manage`: bearbeiten plus Unterobjekte verwalten.
- `admin`: volle Kontrolle inklusive Rechtevergabe.

Kategorien:

- Dashboard-Uebersicht.
- Telefonate.
- Audio.
- Transkripte.
- Patientendaten.
- Inbox/Aufgaben.
- Termine.
- Rezepte.
- Routing.
- Kommunikation.
- Kommunikations-Templates.
- Oeffnungszeiten.
- Vertretung.
- Prompts/Texte.
- Training/FAQ.
- Statistiken.
- Kosten.
- Benutzerverwaltung.
- System-Settings.
- Audit-Log.

## 5.3 Delegationsregel

Ein Benutzer darf niemals mehr Rechte vergeben, als er selbst besitzt.

Beispiel:

- Ein Ordinationsadmin mit `manage` fuer Telefonate darf anderen Benutzern maximal `manage` fuer Telefonate geben, nicht `admin`.
- Hat ein Ordinationsadmin keinen Zugriff auf Kosten, darf er Kostenrechte nicht vergeben.
- Operator kann mandantenuebergreifend Rechte setzen.
- Rechtevergabe muss serverseitig geprueft werden, nicht nur im Frontend.

## 5.4 Rechtevergabe im UI

Ordinationsadmin bekommt eine Benutzerverwaltung:

- Benutzer einladen.
- Rolle auswaehlen.
- Rechteprofil aus Vorlage waehlen.
- einzelne Modulrechte anpassen.
- nur erlaubte Rechte auswählbar.
- Aenderungen mit Audit-Log.

Vorlagen:

- Arzt Admin.
- Arzt Viewer.
- Assistenz Standard.
- Assistenz erweitert.
- Statistik Viewer.
- Abrechnung Viewer.

## 5.5 Datenschutz und Maskierung

Personenbezogene Felder muessen rechteabhaengig maskiert werden.

Beispiele:

- Telefonnummer: voll sichtbar nur mit Call-Detail-Recht, sonst maskiert.
- SVNR: standardmaessig nicht anzeigen oder stark maskieren.
- PID: fuer technische Nachvollziehbarkeit sichtbar, aber nur im Mandantenkontext.
- Audio/Transkript: eigenes Recht, nicht automatisch mit Call-Log.
- Rezeptdetails: eigenes Recht.

## 5.6 Audit-Log

Audit ist Pflicht fuer alle kritischen Aenderungen:

- Benutzer angelegt/geaendert/deaktiviert.
- Rechte geaendert.
- ARA aktiviert/deaktiviert.
- Oeffnungszeiten geaendert.
- Routingregel geaendert.
- Kommunikationsregel geaendert.
- Kommunikations-Template geaendert.
- Terminart KI-buchbar geaendert.
- Vertretungsmodus aktiviert.
- Prompt/Text geaendert.
- API-/System-Setting geaendert.

Audit-Daten:

- Mandant.
- Benutzer.
- Aktion.
- Objekt.
- alter Wert.
- neuer Wert.
- Zeitpunkt.
- IP/User-Agent wenn verfuegbar.

## 6. Empfohlene MVP-Navigation

Sidebar:

- Uebersicht.
- Telefonate.
- Inbox.
- Statistiken.
- Einstellungen.
- Kommunikation.
- Benutzer & Rechte.
- Logs.

Unter Einstellungen:

- Allgemein.
- Oeffnungszeiten.
- Vertretung.
- Terminarten.
- Routing.
- Kommunikationsrouting.
- Nachrichtenvorlagen.
- Texte & FAQ.

Operator-Zusatznavigation:

- Mandanten.
- System-Settings.
- Integrationen.
- Billing.
- News/Changelog.

## 7. Bewusst nicht im MVP

Diese Funktionen sollen vorbereitet, aber nicht zuerst gebaut werden:

- komplexe Rule Engine.
- vollstaendiger Layer-Kalender.
- Multi-Profil UI fuer Aerztezentren.
- mehrsprachige Prompt-Verwaltung.
- automatisiertes Billing.
- Outbound Recall.
- komplexe Omnichannel-Kampagnen.
- KI-Optimierungsempfehlungen.
- umfangreiche BI-Dashboards.
- automatische Feiertagslogik mit Sonderfaellen.

## 8. Kritische Umsetzungsentscheidungen

### 8.1 Mandantenfaehigkeit sofort

Auch fuer den MVP sollte jede fachliche Tabelle eine `tenant_id` erhalten. Nachtraegliche Mandantenfaehigkeit ist teuer und riskant.

### 8.2 RBAC sofort

Das Rechtekonzept muss vor den sensiblen Modulen stehen. Audio, Transkripte, Patientendaten, Rezeptdaten und Benutzerverwaltung duerfen nicht spaeter "drangehaengt" werden.

### 8.3 Decision Trace speichern

Bei wichtigen Entscheidungen sollte gespeichert werden, warum ARA etwas getan hat:

- welche Oeffnungszeiten galten.
- welcher Modus aktiv war.
- welcher Intent erkannt wurde.
- welche Regel gegriffen hat.
- welche Medstar-Aktion ausgefuehrt wurde.

Das ist fuer Vertrauen, Support und Haftungsreduktion zentral.

### 8.4 Medstar-Profile vorbereiten

Aktuell nur eine Ordination verwenden. Trotzdem sollte das Datenmodell optional `medstar_profile_id` bzw. `profile_scope` erlauben.

### 8.5 Keine Secrets im Frontend

API-Keys fuer Medstar, ElevenLabs, n8n oder Supabase duerfen nur serverseitig gespeichert/verwendet werden.

### 8.6 Technischer Ziel-Stack

Der technische Ziel-Stack ist:

- ElevenLabs fuer Voice-Funktionen, aber ohne sichtbares Branding im Produkt.
- Docker fuer Deployment und reproduzierbare Services.
- PostgreSQL als zentrale Datenbank.
- n8n bzw. Webhooks fuer Orchestrierung, soweit sinnvoll.
- Webframework noch offen.

Das Webframework sollte spaeter nach diesen Kriterien gewaehlt werden:

- starke Auth-Integration.
- serverseitige Zugriffskontrolle.
- gute Formular- und Dashboard-Entwicklung.
- API-Routen oder Backend-for-Frontend.
- Docker-taugliches Deployment.
- gute Postgres-Integration.
- langfristig wartbar fuer SaaS.

Realistische Kandidaten:

- Next.js mit separatem oder integriertem Backend.
- NestJS plus React/Next.js Frontend.
- Django, wenn Admin, RBAC und Sicherheit wichtiger als maximale Frontend-Flexibilitaet sind.

Die Entscheidung sollte vor Implementierung des Datenmodells und Auth-Flows getroffen werden.

### 8.7 Moderne Authentifizierung

Authentifizierung muss von Anfang an sicher geplant werden:

- E-Mail/Passwort oder Magic Link.
- Passwort-vergessen-Funktion.
- Zwei-Faktor-Authentifizierung fuer mindestens Operator und Ordinationsadmins.
- optional verpflichtende 2FA je Mandant.
- Session-Management.
- sichere Passwortregeln.
- Login-Audit.
- Account-Lockout oder Rate-Limits bei Angriffen.
- Rollen- und Rechtepruefung serverseitig.

OAuth/OIDC sollte vorbereitet werden, z. B. fuer spaetere SSO-Integrationen.

### 8.8 Datenverschluesselung

PostgreSQL sollte mindestens transport- und storage-seitig sicher betrieben werden. Zusaetzlich sollte optionale Feldverschluesselung fuer sensible Daten vorbereitet werden:

- Audio-Referenzen.
- Transkript.
- Telefonnummern.
- Patientendaten.
- Kommunikationsinhalte.
- API-Konfigurationen und Tokens.

Wichtig: Verschluesselung auf Datenbank-/Feldebene erhoeht Aufwand bei Suche, Filterung und Support. Deshalb sollte pro Datenklasse entschieden werden:

- Klartext mit strenger Zugriffskontrolle.
- maskiert/indexiert.
- verschluesselt.
- gar nicht speichern.

Secrets gehoeren nicht als Klartext in Tabellen. Fuer API-Keys und Tokens braucht es serverseitige Secret-Verwaltung oder verschluesselte Speicherung mit sauberer Rotation.

### 8.9 Kommunikationsprovider abstrahieren

Telegram, WhatsApp, E-Mail, SMS, Voicecall und Medstar-Nachrichten duerfen nicht direkt in der Fachlogik auftauchen. Die Fachlogik erzeugt ein Kommunikationsereignis. Ein Provider-Adapter uebernimmt den Versand.

So bleibt spaeter austauschbar:

- welcher WhatsApp-Provider genutzt wird.
- welcher E-Mail-Service genutzt wird.
- ob Voicecalls ueber ElevenLabs oder einen anderen Anbieter laufen.
- ob Telegram fuer einen Mandanten erlaubt ist.

Jeder Provider braucht:

- Mandantenkonfiguration.
- Aktivitaetsstatus.
- Rate-Limits.
- Fehlerhandling.
- Audit/Delivery Log.
- Fallback-Kanal.

## 9. Praktikables MVP-Ergebnis

Ein guter erster Release waere erreicht, wenn eine Ordination:

- ARA aktivieren und pausieren kann.
- Oeffnungszeiten und Vertretung pflegen kann.
- erlaubte Terminarten steuern kann.
- alle Telefonate mit Audio, Transkript, Zusammenfassung und Aktionen nachvollziehen kann.
- offene Aufgaben bearbeiten kann.
- interne Nachrichten und Patientenbenachrichtigungen ueber definierte Kommunikationsregeln ausloesen kann.
- einfache KPIs sieht.
- Benutzer mit passenden Rechten verwalten kann.
- alle kritischen Aenderungen im Audit-Log nachvollziehen kann.

Das ist verkaufbar, betreibbar und eine stabile Basis fuer die spaetere SaaS-Plattform.
