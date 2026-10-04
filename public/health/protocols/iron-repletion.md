# Iron top-up (low iron confirmed)

PPW Protocol · v1 · Evidence B · **Doctor first**

Every-other-day iron, timed well, with planned blood tests.

**For:** Adults whose blood test shows low iron (low ferritin) and whose doctor has advised iron tablets.

**Not for:** Haemochromatosis (iron overload); no blood test showing low iron; Pregnancy; Kidney disease (reduced kidney function); Inflammatory bowel disease (Crohn's disease or ulcerative colitis); Weight-loss surgery

**Review after:** 4 weeks · **Length:** 12 weeks

## The plan

1. **Iron 65 mg (one ferrous sulfate 200 mg tablet)** — Iron 65 mg
   30 min before breakfast · Every other day · *doctor-supervised dose* · evidence B
   Doctor-supervised dose for a confirmed deficiency, above the daily limit for healthy people. Every other morning on an empty stomach. Follow your doctor's dose.
2. **2-hour gap: tea, coffee, dairy, eggs**
   30 min before breakfast · Every other day · evidence B
   On iron days, keep tea, coffee, milk, eggs and calcium 2 hours away from your iron tablet.
3. **Vitamin C is optional**
   30 min before breakfast · Once · evidence B
   A large trial found adding vitamin C did not help iron work better. A glass of orange juice is fine if your doctor suggests it.
4. **Iron-rich foods**
   At lunch · Every day · evidence C
   Meat, fish, beans, lentils, tofu and fortified cereals. Eat fruit or vegetables with plant sources to help absorption.
5. **Side effects check-in**
   09:00 · Once a week · evidence C
   Tell your doctor about stomach pain, sickness or constipation. Every-other-day dosing may be easier on the stomach.
6. **Blood test: is the iron working?**
   09:00 · on day 28 · Once · evidence B
   Your doctor checks haemoglobin within about 4 weeks of starting.
7. **Blood test: ferritin and blood count**
   09:00 · on day 84 · Once · evidence B
   Iron is usually continued for about 3 months after haemoglobin is normal, to refill stores. Your doctor decides whether to continue and for how long.

## Safety

- Only take iron if a blood test shows low iron and your doctor agrees.
- This dose is above the daily upper limit for healthy people (40-45 mg). Use it only for a confirmed deficiency, under a doctor's care.
- Never take iron if you have haemochromatosis (iron overload).
- Keep iron tablets out of reach of children. An iron overdose can be fatal for young children.
- Take thyroid tablets (levothyroxine) at least 4 hours apart from iron.
- Indigestion medicines can lower iron absorption. Ask your pharmacist about timing.
- Low iron needs a cause found, especially in men and in women after menopause. Your doctor will advise on checks.
- Pregnant? Your midwife or doctor will set your iron plan.
- After the course, ask your doctor about a repeat blood count (often about 6 months later) to catch low iron coming back.

## Key studies

- Iron absorption from oral iron supplements given on consecutive versus alternate days and as single morning doses versus twice-daily split dosing in iron-depleted women: two open-label, randomised controlled trials (2017, RCT). In women with low iron, 60 mg every other day was absorbed better than daily. Splitting into two doses a day did not help. [Link](https://pubmed.ncbi.nlm.nih.gov/29032957/)
- Iron absorption from supplements is greater with alternate day than with consecutive day dosing in iron-deficient anemic women (2020, RCT). Small isotope crossover study in 19 women (only dose order randomised): absorption was 40-50% higher on an alternate day than on the second day in a row. [Link](https://pubmed.ncbi.nlm.nih.gov/31413088/)
- Alternate day versus daily oral iron for treatment of iron deficiency anemia: a randomized controlled trial (2023, RCT). In 200 adults, alternate-day and daily iron raised haemoglobin by a similar amount over 8 weeks. [Link](https://pubmed.ncbi.nlm.nih.gov/36725875/)
- Efficacy of daily versus alternate day oral iron supplementation for management of anaemia among general population: a systematic review and meta-analysis (2025, meta-analysis). 11 trials: daily and alternate-day iron worked about the same. Alternate-day was better tolerated. Very low certainty. [Link](https://pubmed.ncbi.nlm.nih.gov/40841680/)
- The Efficacy and Safety of Vitamin C for Iron Supplementation in Adult Patients With Iron Deficiency Anemia: A Randomized Clinical Trial (2020, RCT). In 440 adults, adding vitamin C to iron did not improve haemoglobin or ferritin. [Link](https://pubmed.ncbi.nlm.nih.gov/33136134/)
- British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in adults (2021, guideline). One iron tablet a day, or every other day if side effects. Check response within 4 weeks. Continue about 3 months after haemoglobin is normal. [Link](https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/)

## Sources

- https://pubmed.ncbi.nlm.nih.gov/29032957/
- https://pubmed.ncbi.nlm.nih.gov/31413088/
- https://pubmed.ncbi.nlm.nih.gov/36725875/
- https://pubmed.ncbi.nlm.nih.gov/40841680/
- https://pubmed.ncbi.nlm.nih.gov/33136134/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/
- https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/
- https://ods.od.nih.gov/factsheets/Iron-Consumer/
- https://www.nhs.uk/medicines/ferrous-sulfate/how-and-when-to-take-ferrous-sulfate/
- https://www.efsa.europa.eu/sites/default/files/2024-05/ul-summary-report.pdf

Educational information from Peak Performance Wellness, not medical advice. Check with a qualified professional before starting supplements, especially if you are pregnant, on medicines or unwell.

To use it: open the app → Library → Protocols → **Import protocol** → pick this file.

```ppw-protocol
{
  "ppw": "protocol",
  "v": 1,
  "id": "iron-repletion",
  "title": "Iron top-up (low iron confirmed)",
  "tagline": "Every-other-day iron, timed well, with planned blood tests.",
  "for": "Adults whose blood test shows low iron (low ferritin) and whose doctor has advised iron tablets.",
  "notFor": [
    "hemochromatosis",
    "no blood test showing low iron",
    "pregnancy",
    "kidney_disease",
    "inflammatory_bowel_disease",
    "bariatric_surgery"
  ],
  "doctorFirst": true,
  "evidence": "B",
  "durationWeeks": 12,
  "reviewAfterWeeks": 4,
  "anchorDate": "start",
  "version": "1",
  "items": [
    {
      "kind": "supplement",
      "title": "Iron 65 mg (one ferrous sulfate 200 mg tablet)",
      "time": "07:00",
      "anchor": "breakfast",
      "offsetMin": -30,
      "repeat": "2",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [
        {
          "id": "iron",
          "amount": 65,
          "unit": "mg"
        }
      ],
      "withFood": false,
      "supervised": true,
      "notes": "Doctor-supervised dose for a confirmed deficiency, above the daily limit for healthy people. Every other morning on an empty stomach. Follow your doctor's dose.",
      "evidence": "B",
      "source": "https://pubmed.ncbi.nlm.nih.gov/29032957/"
    },
    {
      "kind": "habit",
      "title": "2-hour gap: tea, coffee, dairy, eggs",
      "time": "07:00",
      "anchor": "breakfast",
      "offsetMin": -30,
      "repeat": "2",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "On iron days, keep tea, coffee, milk, eggs and calcium 2 hours away from your iron tablet.",
      "evidence": "B",
      "source": "https://www.nhs.uk/medicines/ferrous-sulfate/how-and-when-to-take-ferrous-sulfate/"
    },
    {
      "kind": "note",
      "title": "Vitamin C is optional",
      "time": "07:00",
      "anchor": "breakfast",
      "offsetMin": -30,
      "repeat": "once",
      "durationMin": null,
      "dayOffset": 0,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "A large trial found adding vitamin C did not help iron work better. A glass of orange juice is fine if your doctor suggests it.",
      "evidence": "B",
      "source": "https://pubmed.ncbi.nlm.nih.gov/33136134/"
    },
    {
      "kind": "meal",
      "title": "Iron-rich foods",
      "time": "12:30",
      "anchor": "lunch",
      "offsetMin": 0,
      "repeat": "daily",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Meat, fish, beans, lentils, tofu and fortified cereals. Eat fruit or vegetables with plant sources to help absorption.",
      "evidence": "C",
      "source": "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/"
    },
    {
      "kind": "note",
      "title": "Side effects check-in",
      "time": "09:00",
      "anchor": null,
      "offsetMin": null,
      "repeat": "weekly",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Tell your doctor about stomach pain, sickness or constipation. Every-other-day dosing may be easier on the stomach.",
      "evidence": "C",
      "source": "https://pubmed.ncbi.nlm.nih.gov/40841680/"
    },
    {
      "kind": "test",
      "title": "Blood test: is the iron working?",
      "time": "09:00",
      "anchor": null,
      "offsetMin": null,
      "repeat": "once",
      "durationMin": null,
      "dayOffset": 28,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Your doctor checks haemoglobin within about 4 weeks of starting.",
      "evidence": "B",
      "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/"
    },
    {
      "kind": "test",
      "title": "Blood test: ferritin and blood count",
      "time": "09:00",
      "anchor": null,
      "offsetMin": null,
      "repeat": "once",
      "durationMin": null,
      "dayOffset": 84,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Iron is usually continued for about 3 months after haemoglobin is normal, to refill stores. Your doctor decides whether to continue and for how long.",
      "evidence": "B",
      "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/"
    }
  ],
  "safety": [
    "Only take iron if a blood test shows low iron and your doctor agrees.",
    "This dose is above the daily upper limit for healthy people (40-45 mg). Use it only for a confirmed deficiency, under a doctor's care.",
    "Never take iron if you have haemochromatosis (iron overload).",
    "Keep iron tablets out of reach of children. An iron overdose can be fatal for young children.",
    "Take thyroid tablets (levothyroxine) at least 4 hours apart from iron.",
    "Indigestion medicines can lower iron absorption. Ask your pharmacist about timing.",
    "Low iron needs a cause found, especially in men and in women after menopause. Your doctor will advise on checks.",
    "Pregnant? Your midwife or doctor will set your iron plan.",
    "After the course, ask your doctor about a repeat blood count (often about 6 months later) to catch low iron coming back."
  ],
  "keyStudies": [
    {
      "title": "Iron absorption from oral iron supplements given on consecutive versus alternate days and as single morning doses versus twice-daily split dosing in iron-depleted women: two open-label, randomised controlled trials",
      "year": 2017,
      "type": "RCT",
      "finding": "In women with low iron, 60 mg every other day was absorbed better than daily. Splitting into two doses a day did not help.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/29032957/"
    },
    {
      "title": "Iron absorption from supplements is greater with alternate day than with consecutive day dosing in iron-deficient anemic women",
      "year": 2020,
      "type": "RCT",
      "finding": "Small isotope crossover study in 19 women (only dose order randomised): absorption was 40-50% higher on an alternate day than on the second day in a row.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/31413088/"
    },
    {
      "title": "Alternate day versus daily oral iron for treatment of iron deficiency anemia: a randomized controlled trial",
      "year": 2023,
      "type": "RCT",
      "finding": "In 200 adults, alternate-day and daily iron raised haemoglobin by a similar amount over 8 weeks.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/36725875/"
    },
    {
      "title": "Efficacy of daily versus alternate day oral iron supplementation for management of anaemia among general population: a systematic review and meta-analysis",
      "year": 2025,
      "type": "meta-analysis",
      "finding": "11 trials: daily and alternate-day iron worked about the same. Alternate-day was better tolerated. Very low certainty.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/40841680/"
    },
    {
      "title": "The Efficacy and Safety of Vitamin C for Iron Supplementation in Adult Patients With Iron Deficiency Anemia: A Randomized Clinical Trial",
      "year": 2020,
      "type": "RCT",
      "finding": "In 440 adults, adding vitamin C to iron did not improve haemoglobin or ferritin.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/33136134/"
    },
    {
      "title": "British Society of Gastroenterology guidelines for the management of iron deficiency anaemia in adults",
      "year": 2021,
      "type": "guideline",
      "finding": "One iron tablet a day, or every other day if side effects. Check response within 4 weeks. Continue about 3 months after haemoglobin is normal.",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/"
    }
  ],
  "sources": [
    "https://pubmed.ncbi.nlm.nih.gov/29032957/",
    "https://pubmed.ncbi.nlm.nih.gov/31413088/",
    "https://pubmed.ncbi.nlm.nih.gov/36725875/",
    "https://pubmed.ncbi.nlm.nih.gov/40841680/",
    "https://pubmed.ncbi.nlm.nih.gov/33136134/",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC8515119/",
    "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
    "https://ods.od.nih.gov/factsheets/Iron-Consumer/",
    "https://www.nhs.uk/medicines/ferrous-sulfate/how-and-when-to-take-ferrous-sulfate/",
    "https://www.efsa.europa.eu/sites/default/files/2024-05/ul-summary-report.pdf"
  ]
}
```
