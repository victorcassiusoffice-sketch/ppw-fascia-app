# Evidence table — what the app will use

Plain-language summary of the research behind every meter. Check it before the build ships.

**How to read it**

- **Daily need** = the official RDA or adequate intake for adults (US figures; EU often similar).
- **App target** = where the meter fills to. It only goes above the daily need when good studies support it for general health *and* it stays under the safe maximum.
- **Studied** = doses used in trials, what they tested, and how strong the evidence is (A strong, B moderate, C weak or mixed).
- **Safe max** = the lower of the US (IOM) and EU (EFSA) upper limits. The app warns at 80% and over 100%.
- **Watch** = every "avoid" and "ask your doctor first" rule the app enforces for this nutrient (from rules.json), with its dose or form condition.

**Big picture:** for most vitamins and minerals, trials found no extra benefit above the daily need in healthy people, and some found harm (vitamin E, beta-carotene in smokers, selenium, high-dose niacin, very large vitamin D doses). Vitamin C is the one nutrient where studies support a target above the RDA (200 mg). So the app shows the studied ranges in each nutrient's detail, but fills the meter to the evidence-based everyday amount.

## Vitamins

### Vitamin A · evidence C
- **Daily need (RDA):** men 900 µg, women 700 µg
- **App target:** 900/700 µg — Extra vitamin A has no proven benefit and can cause harm. Only above this with a blood test and a doctor's advice.
- **Safe max:** 3,000 µg a day, retinol only (not beta-carotene) (upper limit, the app warns; US (IOM) and EU (EFSA 2024) agree)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Pregnancy → avoid (retinol); Pregnancy → doctor first (unknown); Trying to get pregnant → avoid (retinol) above 3,000 µg; Trying to get pregnant → doctor first (unknown) above 3,000 µg; Liver disease → doctor first above 1,500 µg; Smoking → avoid (beta carotene)

### Vitamin D · evidence C
- **Daily need (RDA):** men 15 µg, women 15 µg; from 71: 20/20 µg
- **App target:** 15/15 µg — Guidelines say healthy adults under 75 need only the daily amount: 15 µg, or 20 µg from age 71. Take more only with a blood test and a doctor's advice.
- **Studied:** 22.5–50 µg for General disease prevention in adults, at about 900 to 2,000 IU a day: cancer, heart disease, falls, fractures, infections and autoimmune disease. Big trials at 2,000 IU found no effect on cancer, heart disease or fractures, with only small gains for infections and autoimmune disease.
- **Safe max:** 100 µg a day, food + supplements (upper limit, the app warns; US (IOM) and EU (EFSA 2023) agree)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Pregnancy → doctor first above 25 µg; Prediabetes → doctor first above 25 µg; Kidney disease → doctor first; Osteoporosis or weak bones → doctor first above 25 µg; Epilepsy → doctor first above 25 µg; Statins → doctor first above 25 µg; Thiazide water tablets → doctor first above 25 µg

### Vitamin E · evidence C
- **Daily need (RDA):** men 15 mg, women 15 mg
- **App target:** 15/15 mg — Extra vitamin E showed no benefit and some harm in trials. Only above this with a blood test and a doctor's advice.
- **Safe max:** 300 mg a day, food + supplements (upper limit, the app warns; EU (EFSA 2024); US limit is 1,000 mg from supplements)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Type 1 diabetes → doctor first above 100 mg; Type 2 diabetes → doctor first above 100 mg; Liver disease → doctor first above 100 mg; Heart disease → doctor first above 100 mg; Taking a blood thinner → doctor first above 100 mg; Surgery or a procedure coming up → avoid above 100 mg from 14 days before; Recent surgery → doctor first above 100 mg; Having cancer treatment → doctor first; Warfarin → doctor first above 100 mg; DOACs, blood thinners → doctor first above 100 mg; Antiplatelet medicines → doctor first above 100 mg

### Vitamin K · evidence C
- **Daily need (AI):** men 120 µg, women 90 µg
- **App target:** 120/90 µg — Higher doses had mixed results in trials, so the meter fills to the daily need.
- **Studied:** 180–500 µg for Slowing bone loss after menopause (MK-7, 180 µg) and slowing calcium build-up in heart arteries (K1, 500 µg). Single trials with mixed results, and no proven drop in fractures outside Japan.
- **Safe max:** none set — No limit set (US or EU)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Osteoporosis or weak bones → doctor first above 120 µg; Warfarin → doctor first

### Vitamin C · evidence B
- **Daily need (RDA):** men 90 mg, women 75 mg
- **App target:** 200/200 mg — Blood levels level off near 200 mg a day, fruit and vegetables can supply it, and regular use from 200 mg slightly shortened colds.
- **Studied:** 200–1,000 mg for Shorter colds with regular daily use, and fewer colds in people under heavy physical stress. Many trials show colds end a little sooner, and blood levels level off near 200 mg.
- **Safe max:** 2,000 mg a day, food + supplements (upper limit, the app warns; US (IOM); EU set none)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Kidney disease → doctor first; Haemochromatosis → avoid; Having cancer treatment → doctor first

### Choline · evidence C
- **Daily need (AI):** men 550 mg, women 425 mg
- **App target:** 550/425 mg — No benefit has been shown above the daily need in healthy adults.
- **Studied:** 480–930 mg for Baby's attention and processing speed when the mother had this total daily intake in late pregnancy. Only one small trial of 26 women, in late pregnancy.
- **Safe max:** 3,500 mg a day, food + supplements (upper limit, the app warns; US (IOM); EU set none)
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first.
- **Watch:** Liver disease → doctor first above 500 mg

### Vitamin B1 (Thiamin) · evidence C
- **Daily need (RDA):** men 1.2 mg, women 1.1 mg
- **App target:** 1.2/1.1 mg — Extra B1 has only been tested for illness in small trials, so the meter fills to the daily need.
- **Studied:** 150–300 mg for Lowering blood sugar in type 2 diabetes or prediabetes (thiamin). Only small, short trials (12 to 24 people) in people with high blood sugar.
- **Safe max:** 100 mg a day, supplements only (guidance, info only, no warning; UK expert group (EVM 2003) guidance)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Having cancer treatment → doctor first

### Vitamin B2 (Riboflavin) · evidence B
- **Daily need (RDA):** men 1.3 mg, women 1.1 mg
- **App target:** 1.3/1.1 mg — The 400 mg migraine dose is a treatment dose, so the meter fills to the daily need.
- **Studied:** 400 mg for Preventing migraine attacks in adults. One adult trial and later reviews show fewer migraine days, but trials are small and results vary.
- **Safe max:** 40 mg a day, supplements only (guidance, info only, no warning; UK expert group (EVM 2003) guidance)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Migraine → doctor first above 40 mg

### Vitamin B3 (Niacin) · evidence C
- **Daily need (RDA):** men 16 mg, women 14 mg
- **App target:** 16/14 mg — High-dose niacin brought no heart benefit and caused harm, so the meter fills to the daily need (mg NE).
- **Studied:** 1,500–2,000 mg for Preventing heart attacks and strokes with prescription nicotinic acid (no benefit found). Large trials found no fewer heart attacks, strokes or deaths, and more side effects.
- **Safe max:** 10 mg a day, supplements only (upper limit, the app warns; EU (EFSA) 10 mg for nicotinic acid; US (IOM) 35 mg for nicotinamide) · by form: nicotinic acid 10, nicotinamide 35, unknown 10
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first.
- **Watch:** Kidney disease → doctor first; Liver disease → doctor first above 35 mg; Heart disease → doctor first above 35 mg; High cholesterol → doctor first above 35 mg; Gout → avoid above 35 mg; Insulin and sulfonylureas → doctor first above 35 mg; Statins → doctor first above 35 mg

### Vitamin B5 (Pantothenic acid) · evidence C
- **Daily need (AI):** men 5 mg, women 5 mg
- **App target:** 5/5 mg — No study supports more for healthy adults, so the meter fills to the daily adequate amount.
- **Studied:** 600–900 mg for Lowering LDL cholesterol with pantethine (a form of B5). Only small, short trials of pantethine (a review of 28 trials plus two 16-week RCTs) show modest drops in blood fats.
- **Safe max:** 200 mg a day, supplements only (guidance, info only, no warning; UK expert group (EVM 2003) guidance)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** High cholesterol → doctor first above 100 mg

### Vitamin B6 · evidence B
- **Daily need (RDA):** men 1.3 mg, women 1.3 mg; from 51: 1.7/1.5 mg
- **App target:** 1.3/1.3 mg — Studied doses are above the EU safe limit, so use the daily need; it rises to 1.7 mg (men) and 1.5 mg (women) after 50.
- **Studied:** 30–75 mg for Easing nausea in early pregnancy (doctor-led). Two trials eased nausea, but a Cochrane review could not draw firm conclusions.
- **Safe max:** 12 mg a day, food + supplements (upper limit, the app warns; EU (EFSA 2023); US limit is 100 mg)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Pregnancy → doctor first above 10 mg; Kidney disease → doctor first; Epilepsy → doctor first above 12 mg; Anti-seizure medicines → doctor first above 12 mg

### Vitamin B7 (Biotin) · evidence C
- **Daily need (AI):** men 30 µg, women 30 µg
- **App target:** 30/30 µg — No good evidence supports more, and high doses upset blood tests, so the meter fills to the daily adequate amount.
- **Studied:** 2,500 µg for Brittle nails. Only three small studies, none with a placebo group.
- **Safe max:** 900 µg a day, supplements only (guidance, info only, no warning; UK expert group (EVM 2003) guidance)
- **Meter:** Fills to a daily target. Low means: Food first.

### Vitamin B9 (Folate) · evidence A
- **Daily need (RDA):** men 400 µg, women 400 µg
- **App target:** 400/400 µg — Daily need for adults; anyone who could become pregnant should also take 400 µg folic acid a day (see pregnancy flags).
- **Studied:** 400–800 µg for Lowering the risk of spine and brain birth defects, before and in early pregnancy (µg folic acid). Trials and a US Task Force grade A rating show high certainty of benefit.
- **Safe max:** 1,000 µg a day, folic acid only (upper limit, the app warns; US (IOM) and EU (EFSA 2023) agree)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Type 1 diabetes → doctor first above 400 µg; Type 2 diabetes → doctor first above 400 µg; Kidney disease → doctor first; Low vitamin B12 → doctor first above 400 µg; Weight-loss surgery → doctor first above 400 µg; Having cancer treatment → doctor first; Epilepsy → doctor first above 400 µg; Methotrexate → doctor first above 400 µg; Anti-seizure medicines → doctor first above 400 µg

### Vitamin B12 · evidence B
- **Daily need (RDA):** men 2.4 µg, women 2.4 µg
- **App target:** 2.4/2.4 µg — Healthy adults need only a little; high doses are for treating low B12 with a doctor.
- **Studied:** 1,000–2,000 µg for Correcting low B12 with tablets instead of injections. Three small trials (153 people) show tablets raise B12 levels about as well as injections; the evidence is low quality.
- **Safe max:** 2,000 µg a day, supplements only (guidance, info only, no warning; UK expert group (EVM 2003) guidance)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Kidney disease → doctor first; Low vitamin B12 → doctor first above 500 µg

## Minerals

### Calcium · evidence C
- **Daily need (RDA):** men 1,000 mg, women 1,000 mg; from 51: 1,000/1,200 mg; from 71: 1,200/1,200 mg
- **App target:** 1,000/1,000 mg — RDA for ages 19 to 50; women over 50 and everyone over 70 need 1,200 mg, mostly from food.
- **Studied:** 500–1,200 mg for Slowing bone loss and preventing fractures in adults aged 50 and over, usually with vitamin D. Trials disagree: the best-quality trials found no fracture benefit, and some found more heart attacks and kidney stones.
- **Safe max:** 2,000 mg a day, food + supplements (upper limit, the app warns; US (IOM) 2,500 mg to age 50 and 2,000 mg from 51; EU (EFSA) 2,500 mg) · by age: to 50 2,500, from 51 2,000
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first.
- **Watch:** Kidney disease → doctor first; Kidney stones → doctor first above 500 mg; Thiazide water tablets → doctor first above 500 mg; Lithium → doctor first above 500 mg

### Magnesium · evidence B
- **Daily need (RDA):** men 420 mg, women 320 mg
- **App target:** 420/320 mg — RDA from food and supplements together; supplements alone should stay at 250 mg or less.
- **Studied:** 300–600 mg for Lowering blood pressure, improving blood sugar in type 2 diabetes, and preventing migraine. Meta-analyses show small benefits for blood pressure and blood sugar, but many trials are small and mixed; sleep evidence is weak.
- **Safe max:** 250 mg a day, supplements only (upper limit, the app warns; EU (EFSA); US limit is 350 mg)
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first.
- **Watch:** Kidney disease → doctor first; High blood pressure → doctor first above 150 mg; Migraine → doctor first above 250 mg; Potassium-sparing water tablets → doctor first above 100 mg

### Potassium · evidence A
- **Daily need (AI):** men 3,400 mg, women 2,600 mg
- **App target:** 3,400/2,600 mg — Adequate intake from food; never use pills to reach it.
- **Studied:** 3,510–4,680 mg for Lowering blood pressure and stroke risk, mainly by eating more potassium-rich food. Several meta-analyses agree that more potassium lowers blood pressure in people with high blood pressure; there is little effect in people with normal pressure.
- **Safe max:** none set — No limit set (US 2019, EU 2005)
- **Meter:** Shows amounts and limits only — the app never suggests pills. Low means: No low alert.
- **Watch:** Type 1 diabetes → doctor first above 100 mg; Type 2 diabetes → doctor first above 100 mg; Kidney disease → avoid; Heart disease → doctor first above 100 mg; High blood pressure → doctor first above 100 mg; Aged 65 or over → doctor first above 100 mg; ACE inhibitors and ARBs → avoid above 100 mg; Potassium-sparing water tablets → avoid above 100 mg; Thiazide water tablets → doctor first above 100 mg; Loop water tablets → doctor first above 100 mg; Steroid tablets → doctor first above 100 mg

### Iron · evidence B
- **Daily need (RDA):** men 8 mg, women 18 mg; from 51: 8/8 mg
- **App target:** 8/18 mg — RDA; only go above this with a blood test (ferritin) and a doctor's advice; women over 50 need 8 mg.
- **Studied:** 30–120 mg for Restoring low iron stores or treating iron-deficiency anaemia confirmed by a blood test, under medical care. Iron pills work well for proven low iron; the best schedule (daily or every other day) is still being studied.
- **Safe max:** 40 mg a day, food + supplements (EU safe level, the app warns; EU (EFSA 2024) safe level; US limit is 45 mg)
- **Meter:** Shows amounts; "low" only from a recent ferritin blood test. Low means: Only act on a blood test.
- **Watch:** Kidney disease → doctor first; Haemochromatosis → avoid; Low iron or iron-deficiency anaemia → doctor first above 18 mg; Inflammatory bowel disease → doctor first above 18 mg; Having cancer treatment → doctor first

### Zinc · evidence B
- **Daily need (RDA):** men 11 mg, women 8 mg
- **App target:** 11/8 mg — RDA; staying at or under 25 mg a day protects copper levels.
- **Studied:** 75–100 mg for Shortening a common cold with lozenges started within 24 hours of symptoms, for a few days only. Several meta-analyses found colds were 2 to 3 days shorter, but the 2024 Cochrane review rated this low certainty and found no prevention benefit.
- **Safe max:** 25 mg a day, food + supplements (upper limit, the app warns; EU (EFSA); US limit is 40 mg)
- **Meter:** Fills to a daily target. Low means: Food first.

## Trace minerals

### Copper · evidence C
- **Daily need (RDA):** men 0.9 mg, women 0.9 mg
- **App target:** 0.9/0.9 mg — Fills to the adult RDA. Trials do not support more copper for general health.
- **Studied:** 2–2.5 mg for Copper given together with zinc or other minerals: a large eye-disease trial (2 mg with 80 mg zinc) and a bone-loss trial in older women (2.5 mg with calcium, zinc and manganese). Copper on its own has not shown a benefit. No trial shows a benefit from copper alone; it only appears in mixed formulas.
- **Safe max:** 5 mg a day, food + supplements (upper limit, the app warns; EU (EFSA); US limit is 10 mg)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Liver disease → doctor first above 2 mg

### Selenium · evidence C
- **Daily need (RDA):** men 55 µg, women 55 µg
- **App target:** 55/55 µg — Fills to the adult RDA. Higher doses showed no benefit and some risk in large trials.
- **Studied:** 80–200 µg for Lowering thyroid antibodies in Hashimoto's thyroiditis (80–200 µg a day for 3–12 months), and preventing cancer or heart disease (200 µg a day for years). Large trials found no cancer or heart benefit and a possible rise in type 2 diabetes. Thyroid antibody drops are real, but their health value is unclear.
- **Safe max:** 255 µg a day, food + supplements (upper limit, the app warns; EU (EFSA 2023); US limit is 400 µg)
- **Meter:** Fills to a daily target. Low means: Food first.
- **Watch:** Kidney disease → doctor first; Thyroid condition → doctor first above 100 µg; Having cancer treatment → doctor first

### Iodine · evidence B
- **Daily need (RDA):** men 150 µg, women 150 µg
- **App target:** 150/150 µg — Fills to the adult RDA. More is only advised in pregnancy and breastfeeding.
- **Studied:** 150–200 µg for Iodine supplements before and during pregnancy and while breastfeeding, to support the mother's and baby's thyroid. Trials show better iodine levels and experts advise 150 µg in pregnancy, but benefits for babies' growth and development are not proven.
- **Safe max:** 600 µg a day, food + supplements (upper limit, the app warns; EU (EFSA); US limit is 1,100 µg)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Pregnancy → doctor first above 250 µg; Breastfeeding → doctor first above 290 µg; Thyroid condition → doctor first; ACE inhibitors and ARBs → doctor first above 500 µg; Potassium-sparing water tablets → doctor first above 500 µg
- **Per product:** One product with more than 500 µg iodine is more than thyroid experts advise. Kelp and seaweed vary a lot.

### Manganese · evidence C
- **Daily need (AI):** men 2.3 mg, women 1.8 mg
- **App target:** 2.3/1.8 mg — Fills to the adult adequate intake. European adults already eat about 3 mg a day on average.
- **Studied:** 5 mg for Bone loss in older women, with manganese given alongside calcium, zinc and copper. No trial has tested manganese on its own. Only one small mixed-mineral trial; manganese's own effect is unknown.
- **Safe max:** 8 mg a day, food + supplements (EU safe level, the app warns; EU (EFSA 2023) safe level; US limit is 11 mg)
- **Meter:** Shows amounts and limits only — the app never suggests pills. Low means: No low alert.
- **Watch:** Liver disease → avoid above 2.3 mg
- **Caution:** More than 4 mg a day from supplements (0.5 mg from age 65) is above what UK experts advise.

### Chromium · evidence C
- **Daily need (AI):** men 35 µg, women 25 µg; from 51: 30/20 µg
- **App target:** 35/25 µg — Fills to the adequate intake for ages 19–50 (30 µg for men and 20 µg for women after 50). Higher doses are a diabetes treatment question for a doctor.
- **Studied:** 200–1,000 µg for Blood sugar control in type 2 diabetes. This is a treatment use, not a general health dose. Results are mixed. One large early trial in China was positive, but other trials and reviews found small or unclear effects.
- **Safe max:** 250 µg a day, supplements only (guidance, the app warns; WHO advice (via EU SCF 2003); no formal limit)
- **Meter:** Shows amounts and limits only — the app never suggests pills. Low means: No low alert.
- **Watch:** Type 1 diabetes → doctor first above 100 µg; Type 2 diabetes → doctor first above 100 µg; Kidney disease → doctor first; Liver disease → doctor first above 120 µg; Metformin → doctor first above 120 µg; Insulin and sulfonylureas → doctor first above 120 µg

### Molybdenum · evidence C
- **Daily need (RDA):** men 45 µg, women 45 µg
- **App target:** 45/45 µg — Fills to the adult RDA. Deficiency is unknown in healthy people, and no study supports more.
- **Safe max:** 600 µg a day, food + supplements (upper limit, the app warns; EU (EFSA); US limit is 2,000 µg)
- **Meter:** Shows amounts and limits only — the app never suggests pills. Low means: No low alert.
- **Watch:** Kidney disease → doctor first

### Boron · evidence C
- **Daily need:** none set
- **App target:** none — No RDA or AI exists, so 'ai' here means typical US food intake (about 1.17 mg for men and 0.96 mg for women, rounded); no supplement is needed to reach it.
- **Studied:** 3–10 mg for Joint discomfort (6 mg), bone and mineral markers (3 mg), sex hormones (2.5–10 mg) and period pain (10 mg). Only small, short studies (8 to 113 people, 1 week to 10 months) with mixed results.
- **Safe max:** 10 mg a day, food + supplements (upper limit, the app warns; EU (EFSA); US limit is 20 mg)
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Pregnancy → avoid above 1 mg; Breastfeeding → doctor first above 1 mg; Kidney disease → doctor first; Having cancer treatment → doctor first

### Silicon · evidence C
- **Daily need:** none set
- **App target:** none — No RDA or AI exists, so 'ai' here means typical US food intake (about 30 mg for men and 25 mg for women); food covers this, so no supplement is needed.
- **Studied:** 3–12 mg for Bone markers in women with low bone density (3–12 mg as choline-stabilised orthosilicic acid, with calcium and vitamin D, for 12 months), and hair, nails and skin (10 mg, for 20 weeks to 9 months). A few small trials. Bone density did not change, and the hair, nail and skin results each come from a single study.
- **Safe max:** 10 mg a day, supplements only (guidance, the app warns; EFSA checks (10 mg for well-absorbed forms); UK EVM 700 mg for silica) · by form: silica 700, orthosilicic acid 10, monomethylsilanetriol 10, unknown 10
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Kidney disease → doctor first

## Protein, carbs and fibre

### Fibre · evidence A
- **Daily need (AI):** men 38 g, women 25 g; from 51: 30/21 g
- **App target:** 38/25 g — IOM adequate intake: 14 g per 1,000 kcal, so 38 g for men and 25 g for women up to age 50 (30 g and 21 g after 50).
- **Studied:** 7–10.2 g for Psyllium on top of food fibre: the FDA heart claim uses 7 g or more a day of soluble fibre from psyllium husk; trials used about 10 g of psyllium a day to lower LDL cholesterol and improve blood sugar in type 2 diabetes. Many trials and meta-analyses show psyllium lowers LDL cholesterol; blood sugar benefits are seen mainly in type 2 diabetes.
- **Safe max:** none set — No limit set
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first, supplement if needed.
- **Watch:** Type 1 diabetes → doctor first; Kidney disease → doctor first

### Protein · evidence A
- **Daily need (RDA):** men 56 g, women 46 g; from 51: 56/46 g
- **App target:** 56/48 g — RDA is 0.8 g per kg a day (56 g at 70 kg, 48 g at 60 kg); 1.2–1.6 g per kg with strength training; 1.0–1.2 g per kg over 65.
- **Studied:** 84–112 g for 1.2–1.6 g per kg of body weight a day with regular strength training, shown here in grams for a 70 kg adult (72–96 g at 60 kg). Gains in muscle and strength level off above about 1.6 g per kg. A meta-analysis of 49 trials found small but consistent gains in muscle and strength when protein was added to strength training.
- **Safe max:** none set — No limit set
- **Meter:** Mostly from food — "low" only shows when food is logged for it. Low means: Food first, supplement if needed.
- **Watch:** Kidney disease → doctor first; Having cancer treatment → doctor first

### Carbohydrates · evidence C
- **Daily need (RDA):** men 130 g, women 130 g
- **App target:** none — 130 g a day is the minimum the brain needs; most adults eat more, so the app should let each person set their own goal.
- **Studied:** 130 g for 130 g is the minimum that covers the brain's daily glucose needs, not a tested health benefit. The healthy range is 45–65% of energy. The 130 g floor comes from the brain's glucose use; no single best carb amount has been shown, and diabetes advice is personal.
- **Safe max:** none set — No limit set
- **Meter:** No target unless you set one. Low means: No low alert.
- **Watch:** Type 1 diabetes → doctor first; Type 2 diabetes → doctor first

## Other supplements

### Omega-3 (EPA + DHA) · evidence B
- **Daily need (AI):** men 250 mg, women 250 mg
- **App target:** 250/250 mg — EFSA says 250 mg a day of EPA plus DHA is enough for most adults.
- **Studied:** 840–4,000 mg for Heart events and blood fats. About 1 g a day (840 mg EPA plus DHA) was tested for prevention in healthy older adults. 4 g a day (prescription medicines) was tested in people at high heart risk with high triglycerides. Triglycerides clearly fall, but heart results are mixed: one 4 g trial helped, another did not, and 1 g a day did not lower major heart events overall.
- **Safe max:** 5,000 mg a day, supplements only (EU safe level, the app warns; EU (EFSA 2012) safe intake; no formal limit)
- **Meter:** Fills to a daily target. Low means: Food first, supplement if needed.
- **Watch:** Heart disease → doctor first above 1,000 mg; Taking a blood thinner → doctor first above 1,000 mg; Surgery or a procedure coming up → doctor first from 14 days before
- **Caution:** Above 1 g a day of EPA + DHA, the risk of an irregular heartbeat (AF) rises a little. Ask your doctor if you have a heart condition.

### Collagen peptides · evidence B
- **Daily need:** none set
- **App target:** none — Optional and not needed by everyone; studies mostly used 2.5–15 g a day.
- **Studied:** 2.5–15 g for Skin (2.5–10 g a day for 8–12 weeks), joint comfort (about 10 g a day) and tendons with strength training (5–15 g a day, some with vitamin C about 1 hour before exercise). Some exercise studies gave 30 g around training sessions. Many small trials show benefits for skin, joint pain and tendons, but independent and high-quality skin trials found no clear effect.
- **Safe max:** none set — No limit set
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Kidney disease → doctor first; Kidney stones → doctor first

### Probiotics · evidence B
- **Daily need:** none set
- **App target:** none — Optional; effects depend on the strain and there is no daily amount everyone needs.
- **Studied:** 5–20 billion CFU for Preventing diarrhoea during antibiotics with specific strains (Lactobacillus rhamnosus GG or Saccharomyces boulardii), started within 2 days of the first antibiotic dose. Reviews show fewer antibiotic-related diarrhoea cases, but certainty is low to moderate and results depend on the strain.
- **Safe max:** none set — No limit set
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Recent surgery → doctor first; Inflammatory bowel disease → doctor first; Having cancer treatment → doctor first; Weakened immune system → avoid

### Creatine (monohydrate) · evidence A
- **Daily need:** none set
- **App target:** none — Optional; most studies used 3–5 g a day, mainly alongside strength training.
- **Studied:** 3–5 g for Daily amount that fills muscle creatine stores within 3–4 weeks, used with strength training to build strength and lean mass, including in older adults. Many trials and meta-analyses show added strength and lean mass when creatine is used with strength training, including in over-55s.
- **Safe max:** none set — No limit set
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Pregnancy → avoid; Breastfeeding → doctor first; Kidney disease → avoid

### Coenzyme Q10 (CoQ10) · evidence C
- **Daily need:** none set
- **App target:** none — Optional; the body makes its own, and studies mostly used 100–300 mg a day.
- **Studied:** 100–600 mg for Statin-related muscle aches (100–600 mg a day for 30–90 days) and heart failure as add-on care (300 mg a day, in three doses). Results for statin muscle aches are mixed; one heart failure trial was positive but needs confirming; it has no clear effect on blood pressure.
- **Safe max:** none set — No limit set
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Pregnancy → doctor first; Breastfeeding → avoid; Heart disease → doctor first; Taking a blood thinner → doctor first; Having cancer treatment → doctor first; Insulin and sulfonylureas → doctor first; Warfarin → doctor first

### Ashwagandha (root extract) · evidence B
- **Daily need:** none set
- **App target:** none — Optional; not needed by everyone, and there are safety concerns for some groups.
- **Studied:** 300–600 mg for Stress, anxiety and sleep in adults, usually for 6–12 weeks. Benefits were larger at about 600 mg a day and for 8 weeks or more. Several small, short trials show less stress and anxiety and slightly better sleep, but study quality and results vary.
- **Safe max:** none set — No safe level set (Denmark 2020)
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Pregnancy → avoid; Breastfeeding → avoid; Trying to get pregnant → doctor first; Type 1 diabetes → doctor first; Type 2 diabetes → doctor first; Liver disease → avoid; Heart disease → avoid; High blood pressure → doctor first; Surgery or a procedure coming up → avoid from 14 days before; Thyroid condition → avoid; Having cancer treatment → doctor first; Weakened immune system → doctor first; Epilepsy → doctor first; Levothyroxine → doctor first; ACE inhibitors and ARBs → doctor first; Anti-seizure medicines → doctor first

### NMN (nicotinamide mononucleotide) · evidence C
- **Daily need:** none set
- **App target:** none — Optional; benefits in people are not proven and long-term safety is unknown.
- **Studied:** 250–900 mg for Raising blood NAD (a molecule cells use for energy), and possible effects on insulin sensitivity, walking distance and blood pressure in middle-aged and older adults, over 2–24 weeks. Some trials in reviews used up to 2,000 mg a day. Trials are small and short; reviews found no clear benefit for blood sugar, blood fats or muscle.
- **Safe max:** none set — No limit set; EU (EFSA 2026) judged 300 mg a day safe
- **Meter:** Tracked only — not everyone needs it. Low means: No low alert.
- **Watch:** Pregnancy → avoid; Breastfeeding → avoid; Trying to get pregnant → doctor first; Having cancer treatment → doctor first
