# Catalog review — the 10 iHerb products in the app

All 10 products in `src/config/supps-affiliates.json` are marked `needs_evidence_review` and `publishable: false`.
This is that review, checked against the research in this pack.

**Why it matters:** once the new meters ship, the app will flag its own recommended products if they go over a safe maximum. Four of them would.

| # | Product (as listed) | Verdict | Why |
|---|---|---|---|
| 1 | Vitamin D3 + K2 — 5,000 IU D3 + 90–100 µg K2 | **Change product** | 5,000 IU = 125 µg. The safe max is 100 µg (4,000 IU) a day — US and EU agree. Very large single doses gave more falls and fractures in trials, and 2,000 IU a day did not prevent fractures in healthy adults. Swap for a 1,000 IU (25 µg) product. K2 is fine, but warfarin users must ask their doctor first. |
| 2 | Magnesium glycinate — 400 mg per serving | **Change dose** | The EU safe max for magnesium from supplements is 250 mg a day (US: 350 mg). Food magnesium doesn't count. List a 100–150 mg serving (200 mg already shows "near max"). Kidney disease: doctor first. |
| 3 | Zinc picolinate — 15–30 mg | **List 10–15 mg** | EU safe max is 25 mg a day from food + supplements, and the UK NHS says no more than 25 mg a day from supplements unless a doctor advises. 30 mg goes over before food is counted, and 15 mg plus a normal diet sits close to 25 mg — 10 mg is the safer pick. Long-term high zinc lowers copper. |
| 4 | Boron — 5–10 mg | **Hold, or 3 mg max** | Food gives about 1 mg, so a 10 mg product goes over the EU max (10 mg). For testosterone, the only placebo-controlled trial (2.5 mg, 19 men, 7 weeks) found no effect. The 10 mg studies were tiny and uncontrolled. Evidence C. |
| 5 | Ashwagandha KSM-66 — 600 mg | **OK with clear warnings** | 300–600 mg a day is the studied range (stress and sleep, evidence B). Rare liver injury reported; banned in Denmark (2023), France advises at-risk groups to avoid it. The app blocks it in pregnancy, breastfeeding, heart disease, thyroid disease and liver disease. |
| 6 | NMN (Uthever) — 175–500 mg | **Hold** | Human evidence is small and short (C). The EU still treats NMN as an unauthorised novel food (EFSA judged 300 mg a day safe in May 2026, but no approval yet). US status changed in Sept 2025. 500 mg is above the 300 mg EFSA looked at. |
| 7 | Omega-3 (IFOS) — about 2,000 mg EPA + DHA | **Use a lower dose** | 250–500 mg a day is enough for most adults (EFSA). Above 1 g a day, the risk of an irregular heartbeat (AF) rises a little. EU safe up to 5 g, so it's not dangerous — but the app will show a caution above 1 g. Suggest 1 capsule, not 2. |
| 8 | CoQ10 Ubiquinol — 100 mg | **OK with caution** | Within studied doses (100–600 mg a day). Statin muscle pain results are mixed (2 positive, 2 negative meta-analyses). Can affect warfarin. |
| 9 | Hydrolysed collagen — 20 g | **OK at 15 g** | Studies used 2.5–15 g a day (skin) and up to 30 g around training. Evidence is mixed and the skin benefit shrinks in independent trials. Suggest 15 g (the app shows a gentle note above 15 g). Good fit for the fascia protocol (15 g + vitamin C before sessions). Kidney stones: ask first (gelatin raised urine oxalate). |
| 10 | Creatine monohydrate — 5 g | **OK** | 3–5 g a day with strength training is strong evidence (A); long-term safety is best shown up to 5 g. Kidney disease: avoid. Raises creatinine on blood tests — tell your doctor. |

**Also worth knowing**

- The testosterone protocol groups D3 + K2, zinc, boron and ashwagandha. Items 1, 3 and 4 are the ones that would trip the safe-max warnings.
- When you swap products, update `catalog.json` in `ppw-affiliates` and regenerate the manifest, so the app's Supps tab and the meters agree.
- Every verdict here traces to the sources in `data/nutrients.json` (fields `studyRange`, `limit`, `limitResearch`, `sources`).
