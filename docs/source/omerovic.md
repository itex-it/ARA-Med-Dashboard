
# Organisations- und Prozessregeln Ordination

## 1. Patientenstatus & PID-Regelung

### Grundregel

* Es werden **nur aktive Patienten (PID > 0)** behandelt.
* Alle anderen werden unter Hinweis auf eine Wartefrist vertröstet.

### Ausnahmen

#### 🔁 Vertretungsmodus

* Wenn der Arzt eine Vertretung übernimmt.
* Wenn ein Patient angibt, wegen der Vertretung zu kommen:

  * **Falls kein bestehender Kunde → PID = 0 buchen**

#### 🚗 Führerscheinuntersuchung

* **PID muss negativ sein**
* Kunde darf **kein Patient** der Ordination sein.
* Führerscheinuntersuchung wird **immer mit PID = 0** gebucht.

---

## 2. Öffnungszeiten & Gesprächslogik

* Öffnungszeiten werden aus der **Ordinations-DB (OrdiDB)** entnommen.
* Unterschiedliche Öffnungszeitenarten → unterschiedliche (konfigurierbare) Reaktionen.

### Gesprächsweiterleitung

* Während erlaubter Zeiten:

  * Nur auf **ausdrücklichen Wunsch**
  * Oder wenn **Ara (VoiceKI)** das Anliegen nicht lösen kann
* Außerhalb der Zeiten:

  * Immer Nachricht laut OrdiDB

---

## 3. Terminarten

* Im System existieren unterschiedliche Terminarten.
* In der Datenbank werden nur **buchbare Terminarten** selektiert.
* Beispiel:

  * Terminart *Impfung* ist in Medstar vorhanden
  * Wird von der API gemeldet
  * Wenn nicht VoiceKI-buchbar → **nicht anbieten oder aussprechen**

---

## 4. Kommunikation & Backoffice-Entlastung

### Grundsatz

* Backoffice möglichst entlasten.

### Nachrichten an Medstar

* Nur möglich, wenn **gültige PID vorhanden**.

### Ungültige PID

* Nachricht an Backoffice über definierten Kommunikationskanal:

  * E-Mail
  * WhatsApp
  * Telegram
  * SMS
  * Voice-Anruf
* Kontaktmöglichkeiten stehen in der OrdiDB.

---

## 5. Notfälle

* Wenn kein Kunde oder außerhalb der Öffnungszeiten:

  * **Gesundheitsberatung 1450 kontaktieren**

---

# Symptombeschreibung & Triage

## 🔴 Akute Symptome → Telefonische Vermittlung

* Thoraxschmerzen
* Allergische Reaktion (Hautausschlag, Juckreiz, Atemnot)
* Bauchschmerzen
* Hoher Blutdruck
* Nasenbluten
* Starke Ohrenschmerzen
* Angina
* Blutende Wunde
* Starke Schmerzen

---

## 🟡 Standard-Erkrankungen

* Fieber
* Halsschmerzen
* Husten
* Kopfschmerzen
* Übelkeit
* Durchfall & Erbrechen
* Rückenschmerzen
* Schulterschmerzen
* Fußschmerzen
* Knieschmerzen
* Bekannte Symptomatik (Migräne, Regelbeschwerden, Grippe, Magen-Darm-Grippe)

---

# KI-Dialoglogik

## 1. Erste Frage

**„Haben Sie Medikamente zuhause?“**

### Antwortmöglichkeiten

#### ➜ Ja / „Ich brauche nur eine Krankmeldung“

* Hinweis:

  * Während Öffnungszeiten vorbeikommen
  * Ohne Termin → Wartezeit

#### ➜ Nein / „Ich brauche einen Termin“

* KI vergibt Termin.

---

# Spezielle Anliegen

## 🚗 Führerscheinuntersuchung

### KI-Frage

„Sind Sie Patient bei uns?“

* Wenn **Nein (war noch nie Patient)**:

  * Benötigt:

    * E-Card
    * Amtlicher Lichtbildausweis (Reisepass)
    * Brillenpass (falls vorhanden)
    * Brille (falls getragen)
  * Gebühren:

    * AM, A (A1, A2), B, BE, F → **35 € bar**
    * C (C1), CE (C1E), D (D1), DE (D1E) → **50 € bar**
  * Termin nur während Öffnungszeiten
  * Beim Eintragen notieren:

    * Name
    * Telefonnummer
    * „Führerscheinuntersuchung“

---

## 🧾 Befundbesprechungen

* An Ordination weiterleiten.

---

## 👶 Pflegeurlaub / Pflegefreistellung

* Ohne Termin während Öffnungszeiten möglich.
* **10 € bar**
* Abwicklung am Schalter.

---

## 🩸 Überweisungen für Blutabnahmen

(z.B. Vorsorgeuntersuchung, Jahrescheck, Diabetes Mellitus Kontrolle)

* Ohne Termin während Öffnungszeiten.
* Abwicklung am Schalter.

---

# Leistungen (RAG DB / OrdiDB)

## Kassenleistungen

* Stromtherapien
* Ultraschalltherapien
* Schmerzinfusionen
* Vitamininfusionen
* Vorsorgeuntersuchungen
* Therapie Aktiv – Diabetes im Griff
* Infiltrationen bei Muskel- oder Gelenksschmerzen
* MKP-Untersuchungen
* EKG
* Wundmanagement
* Labor:

  * INR
  * CRP
  * Troponin
  * D-Dimer

---

## Privatleistungen

* Führerscheinuntersuchungen
* Ärztliche Atteste
* Bestimmung des Vitamin-D-Spiegels

---
