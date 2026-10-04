# Desk worker day

PPW Protocol · v1 · Evidence B

Short, regular movement breaks for long days at a desk.

**For:** Office and remote staff who sit for long periods at work.

**Not for:** anyone told by a doctor to limit their activity

**Review after:** 8 weeks

## The plan

1. **Morning daylight** (10 min)
   30 min after waking · Every day · evidence C
   Step outside soon after waking. Daylight is the best source of bright light for your body clock.
2. **Sitting break: walk 2-3 minutes** (3 min)
   09:30 · Weekdays (Mon–Fri) · evidence B
   Every 20-30 minutes of sitting, get up and walk for 2-3 minutes. A timer helps.
3. **Walk after meals** (10 min)
   After meals · Every day · evidence B
   A 10-minute walk soon after eating helps keep blood sugar steadier after meals.
4. **Stand for calls**
   14:00 · Weekdays (Mon–Fri) · evidence B
   Stand for phone or video calls. If you have a sit-stand desk, switch position through the day.
5. **Drink water through the day**
   10:00 · Every day · evidence C
   Aim for 6-8 glasses of fluid a day. Water, tea and coffee all count. Drink more in hot weather.
6. **Rest your eyes** (1 min)
   10:30 · Weekdays (Mon–Fri) · evidence C
   Every 20-30 minutes, look at something far away for a few seconds. Studies are small and mixed.
7. **Vitamin D3 10 µg (400 IU)** — Vitamin D 10 µg
   At breakfast · Every day · evidence B
   Only if you get little sun on your skin, for example if you work indoors and are rarely outside.
8. **Weekly activity target**
   09:00 · Once a week · evidence A
   Breaks and walks all count. Aim for 150 minutes a week of moderate activity, plus strength work twice a week.

## Safety

- Stop and get medical advice if walking brings on chest pain, dizziness or unusual breathlessness.
- On insulin or tablets like gliclazide or glimepiride? Walking can lower blood sugar. Know the signs of a low.
- Vitamin D: no more than 100 µg (4,000 IU) a day in total from all supplements.
- Kidney disease or high calcium: ask your doctor before taking vitamin D.
- Eye strain, headaches or blurry vision that keep coming back: get your eyes checked.

## Key studies

- Breaking up prolonged sitting reduces postprandial glucose and insulin responses (2012, RCT). 2-minute walks every 20 minutes lowered blood sugar and insulin after a drink compared with sitting still. [Link](https://pubmed.ncbi.nlm.nih.gov/22374636/)
- The Acute Effects of Interrupting Prolonged Sitting Time in Adults with Standing and Light-Intensity Walking on Biomarkers of Cardiometabolic Health in Adults (2022, meta-analysis). Light walking breaks lowered blood sugar and insulin after meals. Standing breaks helped less. [Link](https://pubmed.ncbi.nlm.nih.gov/35147898/)
- Advice to walk after meals is more effective for lowering postprandial glycaemia in type 2 diabetes mellitus than advice that does not specify timing (2016, RCT). 10-minute walks after each meal lowered post-meal blood sugar more than one 30-minute walk a day. [Link](https://pubmed.ncbi.nlm.nih.gov/27747394/)
- Effectiveness of an intervention for reducing sitting time and improving health in office workers: three arm cluster randomised controlled trial (2022, RCT). A workplace programme plus a sit-stand desk cut sitting by about an hour a day after 12 months. [Link](https://pubmed.ncbi.nlm.nih.gov/35977732/)
- The impact of break schedules on digital eye strain symptoms and ocular accommodation during prolonged near work (2025, RCT). Regular or self-paced breaks eased eye strain compared with no breaks in a 40-minute reading task. [Link](https://pubmed.ncbi.nlm.nih.gov/40466853/)

## Sources

- https://pubmed.ncbi.nlm.nih.gov/22374636/
- https://pubmed.ncbi.nlm.nih.gov/35147898/
- https://pubmed.ncbi.nlm.nih.gov/27747394/
- https://pubmed.ncbi.nlm.nih.gov/35977732/
- https://pubmed.ncbi.nlm.nih.gov/40466853/
- https://pubmed.ncbi.nlm.nih.gov/36473088/
- https://pubmed.ncbi.nlm.nih.gov/35963776/
- https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3001571
- https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/
- https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/
- https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/

Educational information from Peak Performance Wellness, not medical advice. Check with a qualified professional before starting supplements, especially if you are pregnant, on medicines or unwell.

To use it: open the app → Library → Protocols → **Import protocol** → pick this file.

```ppw-protocol
{
  "ppw": "protocol",
  "v": 1,
  "id": "desk-worker-day",
  "title": "Desk worker day",
  "tagline": "Short, regular movement breaks for long days at a desk.",
  "for": "Office and remote staff who sit for long periods at work.",
  "notFor": [
    "anyone told by a doctor to limit their activity"
  ],
  "doctorFirst": false,
  "evidence": "B",
  "durationWeeks": null,
  "reviewAfterWeeks": 8,
  "anchorDate": "start",
  "version": "1",
  "items": [
    {
      "kind": "habit",
      "title": "Morning daylight",
      "time": "07:30",
      "anchor": "wake",
      "offsetMin": 30,
      "repeat": "daily",
      "durationMin": 10,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Step outside soon after waking. Daylight is the best source of bright light for your body clock.",
      "evidence": "C",
      "source": "https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3001571"
    },
    {
      "kind": "movement",
      "title": "Sitting break: walk 2-3 minutes",
      "time": "09:30",
      "anchor": null,
      "offsetMin": null,
      "repeat": "weekdays",
      "durationMin": 3,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Every 20-30 minutes of sitting, get up and walk for 2-3 minutes. A timer helps.",
      "evidence": "B",
      "source": "https://pubmed.ncbi.nlm.nih.gov/22374636/"
    },
    {
      "kind": "movement",
      "title": "Walk after meals",
      "time": "13:00",
      "anchor": "after_meals",
      "offsetMin": 0,
      "repeat": "daily",
      "durationMin": 10,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "A 10-minute walk soon after eating helps keep blood sugar steadier after meals.",
      "evidence": "B",
      "source": "https://pubmed.ncbi.nlm.nih.gov/27747394/"
    },
    {
      "kind": "habit",
      "title": "Stand for calls",
      "time": "14:00",
      "anchor": null,
      "offsetMin": null,
      "repeat": "weekdays",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Stand for phone or video calls. If you have a sit-stand desk, switch position through the day.",
      "evidence": "B",
      "source": "https://pubmed.ncbi.nlm.nih.gov/35977732/"
    },
    {
      "kind": "habit",
      "title": "Drink water through the day",
      "time": "10:00",
      "anchor": null,
      "offsetMin": null,
      "repeat": "daily",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Aim for 6-8 glasses of fluid a day. Water, tea and coffee all count. Drink more in hot weather.",
      "evidence": "C",
      "source": "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/"
    },
    {
      "kind": "habit",
      "title": "Rest your eyes",
      "time": "10:30",
      "anchor": null,
      "offsetMin": null,
      "repeat": "weekdays",
      "durationMin": 1,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [],
      "withFood": null,
      "supervised": false,
      "notes": "Every 20-30 minutes, look at something far away for a few seconds. Studies are small and mixed.",
      "evidence": "C",
      "source": "https://pubmed.ncbi.nlm.nih.gov/40466853/"
    },
    {
      "kind": "supplement",
      "title": "Vitamin D3 10 µg (400 IU)",
      "time": "07:30",
      "anchor": "breakfast",
      "offsetMin": 0,
      "repeat": "daily",
      "durationMin": null,
      "dayOffset": null,
      "endDayOffset": null,
      "nutrients": [
        {
          "id": "vitamin_d",
          "amount": 10,
          "unit": "µg"
        }
      ],
      "withFood": true,
      "supervised": false,
      "notes": "Only if you get little sun on your skin, for example if you work indoors and are rarely outside.",
      "evidence": "B",
      "source": "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/"
    },
    {
      "kind": "note",
      "title": "Weekly activity target",
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
      "notes": "Breaks and walks all count. Aim for 150 minutes a week of moderate activity, plus strength work twice a week.",
      "evidence": "A",
      "source": "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/"
    }
  ],
  "safety": [
    "Stop and get medical advice if walking brings on chest pain, dizziness or unusual breathlessness.",
    "On insulin or tablets like gliclazide or glimepiride? Walking can lower blood sugar. Know the signs of a low.",
    "Vitamin D: no more than 100 µg (4,000 IU) a day in total from all supplements.",
    "Kidney disease or high calcium: ask your doctor before taking vitamin D.",
    "Eye strain, headaches or blurry vision that keep coming back: get your eyes checked."
  ],
  "keyStudies": [
    {
      "title": "Breaking up prolonged sitting reduces postprandial glucose and insulin responses",
      "year": 2012,
      "type": "RCT",
      "finding": "2-minute walks every 20 minutes lowered blood sugar and insulin after a drink compared with sitting still.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/22374636/"
    },
    {
      "title": "The Acute Effects of Interrupting Prolonged Sitting Time in Adults with Standing and Light-Intensity Walking on Biomarkers of Cardiometabolic Health in Adults",
      "year": 2022,
      "type": "meta-analysis",
      "finding": "Light walking breaks lowered blood sugar and insulin after meals. Standing breaks helped less.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/35147898/"
    },
    {
      "title": "Advice to walk after meals is more effective for lowering postprandial glycaemia in type 2 diabetes mellitus than advice that does not specify timing",
      "year": 2016,
      "type": "RCT",
      "finding": "10-minute walks after each meal lowered post-meal blood sugar more than one 30-minute walk a day.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/27747394/"
    },
    {
      "title": "Effectiveness of an intervention for reducing sitting time and improving health in office workers: three arm cluster randomised controlled trial",
      "year": 2022,
      "type": "RCT",
      "finding": "A workplace programme plus a sit-stand desk cut sitting by about an hour a day after 12 months.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/35977732/"
    },
    {
      "title": "The impact of break schedules on digital eye strain symptoms and ocular accommodation during prolonged near work",
      "year": 2025,
      "type": "RCT",
      "finding": "Regular or self-paced breaks eased eye strain compared with no breaks in a 40-minute reading task.",
      "url": "https://pubmed.ncbi.nlm.nih.gov/40466853/"
    }
  ],
  "sources": [
    "https://pubmed.ncbi.nlm.nih.gov/22374636/",
    "https://pubmed.ncbi.nlm.nih.gov/35147898/",
    "https://pubmed.ncbi.nlm.nih.gov/27747394/",
    "https://pubmed.ncbi.nlm.nih.gov/35977732/",
    "https://pubmed.ncbi.nlm.nih.gov/40466853/",
    "https://pubmed.ncbi.nlm.nih.gov/36473088/",
    "https://pubmed.ncbi.nlm.nih.gov/35963776/",
    "https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.3001571",
    "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/",
    "https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/",
    "https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/"
  ]
}
```
