# Anforderungsdokument: KI-Telefonassistent für medizinische Ordinationen

**Projekt:** ARA-Med Voice AI — ElevenLabs-basierter Telefonassistent für Arztpraxen
**Stand:** Mai 2026
**Zweck:** Systemarchitektur-Referenz für Intent-Engine, Business-Rules und Token-Strategie
**Stack:** ElevenLabs Conversational AI · MEDSTAR PVS · Multi-Tenant SaaS Dashboard

---

## 1. Überblick und Systemziel

Ein KI-Telefonassistent für Arztpraxen ist kein generischer Chatbot — er ist ein **medizinischer Empfangsagent mit eingeschränkten Handlungskompetenzen**. Die Kernspannung des Systems: es muss sich kompetent und menschlich anfühlen, darf aber keine klinischen Entscheidungen treffen und muss in Sekundenbruchteilen reagieren.

**Die drei Systemversprechen:**

1. **Schnell** — Antwort in unter 1 Sekunde (Ziel: 500–700ms First Response). Patienten am Telefon haben keine Toleranz für spürbare Verzögerungen.
2. **Korrekt** — Handelt innerhalb der praxisdefinierten Business Rules. Falsche Terminbuchungen oder fehlerhafte Auskunft schaden dem Arzt-Patient-Vertrauen direkt.
3. **Smart** — Erkennt, wenn ein Fall über seine Kompetenz hinausgeht, und leitet souverän weiter — ohne den Anrufer das Gefühl zu geben, an eine Maschine geraten zu sein.

**Systemarchitektur auf einen Blick:**

```
Anrufer → ElevenLabs Voice AI (ASR + TTS)
              ↓
         Intent Engine (Schema-driven, per Praxistyp konfiguriert)
              ↓                    ↓
     Slot-Filling Loop      Business-Rule-Check
              ↓                    ↓
     MEDSTAR API              Escalation Decision
              ↓                    ↓
     Aktion ausführen      Weiterleiten / Rückruf planen
```

---

## 2. Gemeinsame Intents (Alle Ordinationstypen)

### 2.1 Universelle Intent-Taxonomie

| Intent-ID | Name | Auslöser-Phrasen (Beispiele) | Kritikalität |
|-----------|------|------------------------------|--------------|
| `APPT_BOOK` | Termin vereinbaren | "Ich brauche einen Termin", "Kann ich...kommen?", "Wann haben Sie Zeit?" | MITTEL |
| `APPT_CHANGE` | Termin verschieben | "Ich möchte meinen Termin verlegen", "Der Dienstag passt nicht mehr" | MITTEL |
| `APPT_CANCEL` | Termin stornieren | "Ich kann den Termin nicht wahrnehmen", "Absagen bitte" | NIEDRIG |
| `APPT_STATUS` | Terminbestätigung | "Wann habe ich meinen nächsten Termin?" | NIEDRIG |
| `RX_REQUEST` | Rezept anfordern | "Ich brauche ein Rezept", "Mein Metformin ist alle" | MITTEL |
| `REF_REQUEST` | Überweisung anfordern | "Ich brauche eine Überweisung zum Spezialisten" | MITTEL |
| `RESULT_QUERY` | Befund / Ergebnis abfragen | "Sind meine Laborwerte da?" | MITTEL |
| `INFO_HOURS` | Öffnungszeiten | "Wann haben Sie offen?" | NIEDRIG |
| `INFO_LOCATION` | Adresse / Anfahrt | "Wo sind Sie?" | NIEDRIG |
| `INFO_SERVICES` | Leistungsangebot | "Nehmen Sie Kassenpatientinnen?" | NIEDRIG |
| `CALLBACK_REQ` | Rückruf erbitten | "Kann mich jemand zurückrufen?" | NIEDRIG |
| `EMERGENCY` | Notfall / Akutsituation | "Es ist dringend", "Ich habe starke Schmerzen" | KRITISCH |
| `COMPLAINT` | Beschwerde | "Ich bin unzufrieden" | HOCH |
| `INSURANCE` | Kassenfrage | "Nehmen Sie meine Kasse?" | NIEDRIG |
| `SICK_LEAVE` | Krankmeldung / AU | "Ich brauche eine Krankmeldung" | MITTEL |

### 2.2 Universelle Required Slots (vor jeder Aktion)

```yaml
patient_identification:
  required:
    - full_name
    - date_of_birth
  optional_but_preferred:
    - phone_number
    - health_insurance

slot_filling_strategy:
  max_turns: 3
  escalation_trigger: "ambiguous_identity"
```

### 2.3 Universelle Eskalationsregeln

```yaml
always_escalate:
  - emergency_detected: true
  - medication_dosage_question: true
  - lab_result_interpretation: true
  - new_patient_complex_case: true
  - patient_distress: true
  - explicit_request_human: true
  - legal_question: true
```

---

## 3. Ordinationstyp-spezifische Analyse

### 3.1 Allgemeinmedizin / Hausarzt

**Profil:** Erster Kontaktpunkt im österreichischen Gesundheitssystem. Patientenstruktur breit (0–100 Jahre), Anrufvolumen hoch, Anliegen heterogen.

#### Intent-Verteilung

| Intent | Anteil |
|--------|--------|
| Terminbuchung | ~35% |
| Rezeptanfrage | ~25% |
| Krankmeldung (AU) | ~12% |
| Überweisung | ~10% |
| Befundabfrage | ~8% |
| Info / Öffnungszeiten | ~5% |
| Akut / Notfall | ~3% |
| Sonstiges | ~2% |

#### Business Rules

```yaml
rx_request:
  - condition: "Dauermedikation, Patient bekannt, Bestand erschöpft"
    action: "RX_PREPARE → Bereitstellung in 24–48h kommunizieren"
  - condition: "Erstrezept oder unklar"
    action: "Arzt-Rückruf arrangieren"

sick_leave:
  - condition: "Bekannter Patient, max. 5 Tage"
    action: "AU telefonisch zulässig"
  - condition: "Unbekannter Patient oder > 5 Tage"
    action: "Termin vereinbaren"

home_visit:
  - condition: "Patient immobil oder > 80 Jahre"
    action: "Immer an Mensch weiterleiten"

escalation_keywords:
  - "Brustschmerz", "Atemnot", "Lähmung", "Bewusstlosigkeit"
  - "Selbstverletzung", "Suizid"
  → immediate: "Notruf 112/144 empfehlen + weiterleiten"
```

#### Sprachliche Besonderheiten
- Ältere Patienten (~40%) sprechen Dialekt, nennen Medikamente bei altem Handelsnamen
- Viele Patienten umschreiben ihr Anliegen → NLU muss aus Umschreibungen extrahieren

---

### 3.2 Zahnarzt

**Profil:** Klare Unterscheidung zwischen elektiver und akuter Versorgung. Triage ist hier der Kern.

#### Intent-Verteilung

| Intent | Anteil |
|--------|--------|
| Terminbuchung (elektiv) | ~30% |
| Notfall / Akutschmerz | ~20% |
| Terminverschiebung | ~15% |
| Info / Leistungsangebot | ~12% |
| Kostenfrage | ~10% |
| Post-Treatment-Fragen | ~8% |
| Terminbestätigung | ~5% |

#### Triage-Logik

```yaml
NOTFALL_SOFORT:
  - "Gesichtsschwellung" → Abszess-Verdacht
  - "Zahn ausgeschlagen nach Unfall"
  - "Starke Blutung nach Extraktion"
  action: "Soforttermin oder Notfalldienst"

NOTFALL_HEUTE:
  - "Starke Schmerzen, Schmerzmittel helfen nicht"
  - "Krone rausgefallen, essentieller Zahn"

DRINGEND:
  - "Moderate Schmerzen, nehme Ibuprofen"

ROUTINE:
  - "Kontrolle", "Hygiene", "Ästhetik"

cost_inquiry:
  never_do: "Keine Kostengarantien oder genaue Preise nennen"
```

#### Sensible Kontexte
- **Zahnangst:** Signal erkennen → besondere Sensibilität, Beruhigung, Sedierungsberatung anbieten
- **Kostensensitivität:** Kassenleistungsstatus kommunizieren, keine Preise nennen

---

### 3.3 Kinderarzt (Pädiatrie)

**Profil:** Fundamentaler Unterschied — **Anrufer ist fast immer nicht der Patient.** Eltern rufen für ihre Kinder an. Datenschutz: Informationsweitergabe nur an legitimierte Erziehungsberechtigte.

#### Intent-Verteilung

| Intent | Anteil |
|--------|--------|
| Akutsymptom-Beratung / Triage | ~28% |
| Terminbuchung (Vorsorge U/J) | ~22% |
| Krankmeldung Kind | ~18% |
| Attest / Dokument | ~12% |
| Terminbuchung (Erkrankung) | ~10% |
| Impfberatung | ~6% |
| Info | ~4% |

#### Business Rules

```yaml
caller_verification:
  required: "Erziehungsberechtigter oder autorisierte Aufsichtsperson"
  edge_case: "Großeltern, Au-Pair → immer weiterleiten, keine Aktionen"

age_classification:
  neonate: "0–28 Tage → Jedes Anliegen SOFORT eskalieren"
  infant: "1–12 Monate → Fieber, Trinkverweigerung → HEUTE"

fever_triage:
  - age: "< 3 Monate" + fever: "> 38.0°C" → NOTFALL sofort
  - age: "3–6 Monate" + fever: "> 39.0°C" → HEUTE
  - age: "> 6 Monate" + fever: "> 40.0°C" → HEUTE
  - febrile_seizure_history: true → immer HEUTE
```

#### Kommunikation
- Empathie signalisieren **bevor** Informationen gesammelt werden
- Eltern benutzen Kosedimensionen ("der Kleine") → aktiv nach Namen fragen

---

### 3.4 Physiotherapeut

**Profil:** Längere Termine (45–60 Min.), Serien üblich (10 Einheiten), keine Rezepte im medizinischen Sinne, Erst-Kontakt oft über Arzt-Überweisung.

#### Intent-Verteilung

| Intent | Anteil |
|--------|--------|
| Terminbuchung (Erst) | ~25% |
| Terminverschiebung / Absage | ~25% |
| Info (Kassenleistung, Ablauf) | ~18% |
| Post-Session Fragen | ~12% |
| Dokumentenanforderung | ~10% |

#### Business Rules

```yaml
referral_required:
  kassenkassen_patient:
    valid_referral_required: true
    max_units_per_referral: 10

cancellation_policy:
  notice_required: "24h"
  ki_can_cancel: true  # Aber Hinweis auf Stornierungsfrist

post_session_pain:
  response: "Info (Muskelkater normal) + Eskalationsangebot"
  escalation_triggers:
    - "starke Zunahme der Beschwerden"
    - "Taubheit, Kribbeln"
```

---

### 3.5 Facharzt (Internist / Orthopäde)

**Profil:** Längere Vorlaufzeiten, selektiveres Patientengut, höhere Anfragekomplexität.

#### Business Rules

```yaml
referral_check:
  kassenkassen: "Überweisung vom Hausarzt meist erforderlich"
  privat: "Kein Überweisungserfordernis"

procedural_appointments:  # Gastroskopie, Koloskopie
  always_via_human: "Aufklärungspflicht → kein KI-Booking"

post_procedure_complications:
  keywords: ["Blut", "Schmerzen nach", "Fieber nach"]
  action: "SOFORT eskalieren"

result_disclosure:
  ki_can_say: "Befund ist vorhanden / noch nicht vorhanden"
  ki_cannot_say: "Kein Wert, keine Interpretation"
```

---

### 3.6 Gynäkologe

**Profil:** Hochpersönliche, sensitive Themen. Schwangerschaft ist eigener Sonderkomplex.

#### Business Rules

```yaml
pregnancy_triage:
  SOFORT:
    - "Blutungen in der Schwangerschaft"
    - "Starke Bauchschmerzen SSW > 20"
    - "Kind bewegt sich nicht mehr"
    → action: "144 empfehlen + sofort an Mensch"

sensitive_result_handling:
  abnormal_pap: "Nie Befund nennen — Termin für Besprechung"
  oncology_concern: "Immer sofort Mensch-Weiterleitung"

caller_privacy:
  question_before_info: "Bin ich mit [Name] verbunden?"
  never_confirm_to_third_party: true
```

#### Sensible Kontexte
- Onkologischer Verdacht → sofortige menschliche Verbindung, keine KI-Beruhigung
- Gynäkologische Befunde werden **nie durch KI kommuniziert**

---

### 3.7 Psychiater / Psychologe / Psychotherapeut

**Profil:** Sensibelste Fachrichtung. Therapeutische Beziehung lebt von Vertrauen. Ein schlechter Erstkontakt kann vulnerablen Patienten dauerhaft vom Zugang abhalten.

#### Business Rules

```yaml
crisis_detection:
  keywords_immediate:
    - "Ich halte es nicht mehr aus"
    - "Ich will nicht mehr"
    - "Suizid", "umbringen", "Ende machen"
  action: "IMMER sofort Mensch + Krisenlinien-Info (147, Telefonseelsorge 142)"
  ki_must_not: "Alleine mit Krisen-Caller sein"

initial_contact:
  new_patient_style: "Besonders behutsam, keine Formulare-Feeling"
  slots_minimal: "Nur Name + Kontakt — keine ausführliche Anamnese"

confidentiality:
  third_party: "Kein Bestätigen ob Person Patient ist"

medication:
  controlled_substances: "NIEMALS via KI — immer Mensch"
```

#### Kritisch
- **Suizidalität:** Weiterleitungszeit auf Mensch muss unter 5 Sekunden liegen
- **Schweigepflicht:** Patienten dürfen unter keinen Umständen von Dritten identifiziert werden
- **Stigma:** Onboarding-Erlebnis muss warm sein — Maschinen-Feeling verhindert Erstkontakt

---

### 3.8 Augenarzt / HNO-Arzt

**Profil:** Hoher Anteil Elektivpatienten, aber klare Notfallsituationen die schnell erkannt werden müssen.

#### Business Rules

```yaml
augenarzt_NOTFALL_SOFORT:
  - "Plötzlicher Sehverlust"
  - "Blitze + Vorhang im Gesichtsfeld" → Netzhautablösung-Verdacht
  - "Chemikalien ins Auge"
  → action: "144 oder sofortige Zuweisung Augenklinik"

hno_NOTFALL_SOFORT:
  - "Plötzliche einseitige Taubheit" → Hörsturz-Verdacht
    time_critical: true  # Kortison-Therapie zeitkritisch, max. 24h Fenster
  - "Schwere Dysphagie mit Atemnot"

hoersturz_protocol:
  ki_must_say: "Hörsturz ist ein medizinischer Notfall — bitte sofort kommen"
```

---

## 4. Schema-driven Intent Engine — Generisches Systemdesign

### 4.1 Das dreilagige Schema-Modell

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: CORE ENGINE                      │
│  Intent Recognition · Slot Filling · Escalation Logic       │
│  Gilt für alle Praxistypen — unveränderlich                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ lädt
┌─────────────────────────────────────────────────────────────┐
│                 LAYER 2: PRACTICE TYPE SCHEMA                │
│  Welche Intents aktiv · Business Rules · Triage-Logik       │
└─────────────────────────────────────────────────────────────┘
                            ↓ lädt
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 3: TENANT CONFIG                      │
│  Öffnungszeiten · Ärzte · Telefonnummern · Kassenverträge   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Intent-Schema-Struktur

```yaml
practice_type: "hausarzt"

active_intents:
  - APPT_BOOK
  - RX_REQUEST
  - SICK_LEAVE
  - EMERGENCY
  # nicht aktiv: PHYSIO_SERIES, TRIAGE_DENTAL

intent_configs:
  APPT_BOOK:
    required_slots:
      - patient.full_name
      - patient.date_of_birth
      - appointment.reason
      - appointment.urgency
    medstar_action: "create_appointment_request"
    max_slot_filling_turns: 4

  EMERGENCY:
    slot_filling: SKIP
    keywords_de:
      - "Brustschmerz", "Atemnot", "Bewusstlos"
      - "Suizid", "nicht mehr leben"
    action: "immediate_escalate"
```

### 4.3 Intent-Abdeckung nach Praxistyp

| Intent | Hausarzt | Zahnarzt | Kinderarzt | Physio | Facharzt | Gynäkologie | Psychiatrie | Augenarzt/HNO |
|--------|----------|----------|------------|--------|----------|-------------|-------------|---------------|
| APPT_BOOK | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| RX_REQUEST | ✓ | — | — | — | ✓ | ✓ | ✓⚠ | ✓ |
| RESULT_QUERY | ✓ | — | ✓ | — | ✓ | ✓⚠ | ✓⚠ | ✓ |
| SICK_LEAVE | ✓ | — | ✓ | — | — | — | ✓ | — |
| EMERGENCY | ✓ | ✓⚠ | ✓ | — | ✓ | ✓ | ✓⚠⚠ | ✓ |
| TRIAGE | — | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| PHYSIO_SERIES | — | — | — | ✓ | — | — | — | — |
| PREGNANCY | — | — | — | — | — | ✓ | — | — |

**Legende:** ✓ aktiv · — nicht aktiv · ⚠ aktiv mit starken Restriktionen · ⚠⚠ nur Krisen-Erkennung

### 4.4 Komplexitätsprofil

| Dimension | Hausarzt | Zahnarzt | Kinderarzt | Physio | Facharzt | Gynäkologie | Psychiatrie | Augenarzt/HNO |
|-----------|----------|----------|------------|--------|----------|-------------|-------------|---------------|
| Triage-Komplexität | MITTEL | HOCH | HOCH | NIEDRIG | MITTEL | HOCH | SEHR HOCH | HOCH |
| Datenschutz-Sensitivität | MITTEL | NIEDRIG | MITTEL | NIEDRIG | MITTEL | HOCH | SEHR HOCH | NIEDRIG |
| Eskalationsrate (erwartet) | ~15% | ~20% | ~25% | ~10% | ~18% | ~22% | ~40% | ~20% |

---

## 5. Token-Optimierung: Kontext-Architektur

### 5.1 Die drei Kontext-Schichten

```
┌─────────────────────────────────────────────────────────────┐
│              ALWAYS-ON CONTEXT (~300-500 Token)              │
│  - Rolle der KI                                             │
│  - Heutige Öffnungszeiten                                   │
│  - Verfügbare Intents (flache Liste)                        │
│  - Absolute No-Go-Rules (Notfall, Datenschutz)              │
│  - Eskalationsnummer                                         │
└─────────────────────────────────────────────────────────────┘
                    ↓ Intent erkannt →
┌─────────────────────────────────────────────────────────────┐
│           ON-DEMAND CONTEXT (geladen per Intent)            │
│  - Detaillierte Business Rules für diesen Intent            │
│  - Required Slots Liste                                     │
│  - MEDSTAR-Action-Template                                  │
└─────────────────────────────────────────────────────────────┘
                    ↓ Patient identifiziert →
┌─────────────────────────────────────────────────────────────┐
│           PATIENT CONTEXT (on-demand aus MEDSTAR)           │
│  - Nächster Termin                                          │
│  - Laufende Medikation                                      │
│  - Bekannt/Neu Flag                                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Token-Budget (Ziel)

| Schicht | Token-Ziel |
|---------|------------|
| Always-On Core | 200–350 |
| Intent-Context | 100–200 |
| Patient-Context | 50–150 |
| **Gesamt** | **< 700 Token** |

### 5.3 Async-Pattern für MEDSTAR-Calls

```
User: "Ich möchte einen Termin am Dienstag"
→ KI startet MEDSTAR-API-Call (async)
→ KI antwortet sofort: "Ich schaue kurz nach freien Terminen..."
→ MEDSTAR-Response kommt (200–500ms)
→ KI integriert: "Am Dienstag hätten wir 10:00 oder 14:30 Uhr..."
```

### 5.4 Latenz-Strategie

| Komponente | Latenz | Optimierung |
|------------|--------|-------------|
| ASR | ~100ms | ElevenLabs intern |
| LLM (Gemini Flash) | ~200–350ms | Kleiner Kontext |
| TTS | ~75–135ms | Flash-Voice, Streaming |
| MEDSTAR API | ~200–500ms | Async mit Überbrückungssatz |
| **Gesamt (Ziel)** | **< 700ms** | |

---

## 6. Übergreifende Systemanforderungen

### 6.1 Sprach-Anforderungen

```yaml
primary_language: "de-AT"

dialect_handling:
  supported: ["Wienerisch", "Steirisch", "Tirolerisch", "Vorarlbergerisch"]
  strategy: "Tolerant → versteht Dialekt, antwortet in Hochdeutsch"

medical_vocabulary:
  brand_names: true       # "Aspirin" → Acetylsalicylsäure intern
  lay_terms: true         # "Brustweh" → Thoraxschmerzen intern

tone_by_context:
  emergency: "Klar, ruhig, direktiv"
  standard: "Professionell, warm, österreichisch"
  elderly: "Langsam, bestätigend, geduldig"
  psychiatric: "Sehr warm, nicht-wertend, sicher"
  pediatric_parent: "Empathisch zuerst, dann strukturiert"
```

### 6.2 DSGVO-Anforderungen

```yaml
disclosure_at_call_start:
  required: true
  template: "Hinweis: Dieses Gespräch wird von einer KI entgegengenommen."

data_minimization:
  principle: "Nur Daten erheben die für Aktion nötig sind"

patient_right_to_human:
  always_available: true

retention:
  call_transcripts: "30 Tage"
  action_logs: "7 Jahre"

eu_ai_act_2024:
  synthetic_voice_disclosure: required
  human_escalation_right: required
```

### 6.3 Kritische Risiken

| Risiko | Mitigationsstrategie |
|--------|---------------------|
| Notfallerkennung versagt | Keyword-Liste + Sentiment + Fallback: immer Mensch anbieten |
| Falsche Patientenidentität | Name + Geburtsdatum + dritte Verifizierungsfrage |
| Rezept für falschen Patienten | Double-Check vor MEDSTAR-Write mit Bestätigung |
| Psychiatrie-Krise eskaliert nicht | Konservative Keywords + "Im Zweifel eskalieren"-Default |

---

## 7. Implementierungs-Prioritäten

### Phase 1 — MVP
- Hausarzt + Zahnarzt
- Universelle Intents: APPT_BOOK, APPT_CANCEL, RX_REQUEST, INFO_HOURS
- Einfache Notfall-Erkennung + Weiterleitung
- MEDSTAR-Anbindung (Termin-Request, Aufgabe erstellen)

### Phase 2 — Erweiterung
- Kinderarzt, Physiotherapeut, Facharzt
- Verfeinertes Triage-System
- Patientenkontext aus MEDSTAR (bekannte Patienten)
- Dynamic Context Injection

### Phase 3 — Spezialisierung
- Gynäkologie + Psychiatrie
- Fine-Tuning auf medizinisches Vokabular
- Analytics Dashboard
- Augenarzt / HNO

---

## 8. Offene Fragen für Implementation

1. **MEDSTAR API:** Welche Endpoints existieren? Ist Echtzeit-Slot-Abfrage möglich?
2. **ElevenLabs Dynamic Context:** Wie wird mid-conversation der System Prompt erweitert?
3. **Österreichische Rechtslage:** Formaler Datenschutzbeauftragter bei Gesundheitsdaten?
4. **Triage-Haftung:** Wer übernimmt Haftung bei falscher KI-Triage-Entscheidung?
