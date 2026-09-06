# Subject / Unit / Chapter System — Implementation Plan

## 1. Scope ko clear interpretation

Hjr le upload garnu भएको दुई screenshot दुई फरक content level हुन्। पहिलो screenshot **Subject/Unit level** हो। यसमा parent level ले आफ्ना child topics वा chapters को summary देखाउँछ; उदाहरणका लागि `Surveying` भित्र दुई topics देखिन सक्छन्। दोस्रो screenshot **direct Chapter Subject level** हो। यसमा `General Awareness` जस्तो subject भित्र Unit layer नराखी `1.1`, `1.2`, `1.3` जस्ता chapters सिधै देखिन्छन्। त्यसैले दुवै screen लाई एउटै flat list बनाएर मिलाउनु हुँदैन। Data model र navigation ले यी दुई structure अलग रूपमा support गर्नुपर्छ।

> Final hierarchy: `Course → Subcourse → Content Subject → optional Unit → Chapter → Mode content`.

`General Awareness` र `Public Management` का लागि `Content Subject → Chapter` structure प्रयोग हुनेछ। `Technical Subject` का लागि `Content Subject → Unit → Chapter` structure प्रयोग हुनेछ। त्यसैले `Surveying`, `Construction Materials`, `Hydraulics` आदि Technical Subject का child Units हुनेछन्; `1.1 General`, `1.2 Levelling` जस्ता items ती Unit भित्रका chapters हुनेछन्।

## 2. Existing code audit बाट देखिएको अवस्था

हाल Home को Subject section database-driven छैन; यसले `demoSubjectsForCourse()` बाट demo subjects निकाल्छ र सबै card लाई generic `/subjects` route मा पठाउँछ। Existing content service मा केवल `subjects`, `subjects/{id}/chapters`, र `topics` को सरल legacy structure छ। त्यसमा course/subcourse scope, Unit layer, mode availability, premium metadata, theory URL, user progress वा per-user purchase access छैन। Existing flat `questions` collection exam तथा QOTD flow मा प्रयोग भइरहेको हुनाले त्यसलाई overwrite गर्नु सुरक्षित हुँदैन।

यस कारण नयाँ system लाई existing legacy content माथि जबर्जस्ती राख्ने होइन, **नयाँ namespaced learning collections र services** का रूपमा बनाइनेछ। Existing exam questions, exam seed, subscription settings, payment gateway, discussion/report system र पहिले merge भएका flows untouched रहनेछन्। नयाँ Subject/Chapter routes र services तयार भएपछि मात्र Home र नयाँ screens लाई त्यसतर्फ migrate गरिनेछ।

| Existing area | अहिलेको अवस्था | Plan मा निर्णय |
|---|---|---|
| Home Subject strip | Demo data र hardcoded `Subjects`/`View All` | Firebase बाट current course/subcourse अनुसार fetch गर्ने |
| Legacy `subjects` | Simple name/icon/chapterCount | Compatibility का लागि राख्ने; नयाँ learning schema अलग राख्ने |
| Legacy `questions` | Flat exam/QOTD questions | नछुने; learning Practice/Read question का लागि नयाँ collection |
| Exam purchase flow | `app_exam_purchases` र shared checkout उपलब्ध | Subject/Unit/Chapter purchase का लागि generic branch थप्ने |
| Subscription settings/plans | Existing `app_subscription_settings` र `app_subscription_plans` | सोही settings/plans reuse गर्ने; नयाँ settings collection नबनाउने |
| Admin Seed Money | Exam page को existing control | हटाउने वा reuse नगर्ने; नयाँ Seed Subject Data छुट्टै admin action हुने |
| Firebase | REST-based, Spark plan, no Cloud Functions | Idempotent client-side batch writes र narrow rules प्रयोग गर्ने |

## 3. Proposed Firebase data model

### 3.1 Catalog collections

नयाँ collection names app-specific prefix सहित राखिनेछन् ताकि legacy `subjects`, `chapters`, `topics`, र `questions` सँग conflict नहोस्। Admin website बाट सजिलै manage गर्न एउटै generic tree बनाउनेभन्दा subject type स्पष्ट हुने गरी catalog metadata राखिनेछ।

| Collection | मुख्य fields | प्रयोजन |
|---|---|---|
| `app_learning_subjects` | `id`, `courseId`, `subcourseId`, `titleEn`, `titleNe`, `structureType`, `numbering`, `icon`, `order`, `isPremium`, `priceNpr`, `active` | Home र All Subjects मा देखिने root content subject |
| `app_learning_units` | `id`, `subjectId`, `courseId`, `subcourseId`, `titleEn`, `titleNe`, `numbering`, `order`, `isPremium`, `priceNpr`, `active` | Technical Subject जस्ता Unit-containing subject का child Units |
| `app_learning_chapters` | `id`, `subjectId`, `unitId`, `parentType`, `numbering`, `titleEn`, `titleNe`, `order`, `availableModes`, `isPremium`, `priceNpr`, `active` | Direct subject chapter तथा Unit chapter दुवैका लागि shared chapter catalog |
| `app_learning_questions` | `id`, `courseId`, `subcourseId`, `subjectId`, `unitId`, `chapterId`, `mode`, `question`, `questionNe`, `options`, `correctIndex`, `explanation`, `explanationNe`, `level`, `active`, `order` | Practice तथा Read question bank |
| `app_learning_theory` | `id`, `courseId`, `subcourseId`, `subjectId`, `unitId`, `chapterId`, `title`, `pdfUrl`, `active` | Theory mode को PDF/URL metadata |
| `app_learning_progress` | `uid`, `scopeKey`, `practice`, `read`, `theory`, `completedPct`, `attemptedCount`, `totalCount`, `lastOpenedAt` | User-specific chapter/unit/subject progress |
| `app_learning_daily_usage` | `uid`, `dateKey`, `attemptedQuestionIds`, `count` | Practice daily limit र recent-question tracking |
| `app_learning_purchases` | `uid`, `targetType`, `targetId`, `accessScope`, `basePrice`, `finalPrice`, `status`, user metadata, admin response | Subject Details purchase request तथा access control |

`structureType` मा `directChapters` वा `units` हुनेछ। यसले first screenshot र second screenshot को route decision deterministic बनाउँछ। `parentType` मा `subject` वा `unit` राखेर chapter को parent स्पष्ट हुनेछ। Stable numbering जस्तै `1.1`, `1.1.1` लाई display title मा मात्र जोड्नु हुँदैन; separate `numbering` field मा पनि राखिनेछ, जसबाट syllabus order र future sorting सुरक्षित हुन्छ।

### 3.2 Syllabus mapping

Civil Sub Engineer syllabus अनुसार direct chapter subjects यसरी seed हुनेछन्:

| Subject | Structure | Initial chapter numbering |
|---|---|---|
| General Awareness | Direct chapters | `1.1` देखि `1.10` |
| Public Management | Direct chapters | `2.1` देखि `2.10`; उपलब्ध nested subtopics metadata मा राखिने |
| Technical Subject | Units | 13 Units: Surveying, Construction Materials, Mechanics of Materials and Structures, Hydraulics, Soil Mechanics, Structural Design, Building Construction Technology, Water Supply and Sanitation Engineering, Irrigation Engineering, Highway Engineering, Estimating and Costing, Construction Management, Airport Engineering |

Technical Subject का Unit भित्र syllabus को numbering जस्ताको तस्तै राखिनेछ। उदाहरणका लागि Surveying भित्र `1.1 General`, `1.2 Levelling`, `1.3 Plane Tabling`, `1.4 Theodolite and Traverse Surveying`, `1.5 Contouring`, `1.6 Setting Out` हुनेछन्। `1.1.1`, `1.1.2` जस्ता nested syllabus points लाई chapter को `subtopics` array वा छुट्टै future `app_learning_subtopics` collection मा राख्न सकिने गरी schema तयार गरिनेछ। पहिलो implementation मा user-facing Chapter card लाई `1.1 General` level मा राखेर भित्र subtopics पढ्ने content का रूपमा प्रयोग गर्ने प्रस्ताव छ।

Uploaded PDF को General Awareness/Public Management भाग legacy Nepali font encoding मा आएको छ। त्यसैले unreadable encoded text लाई जबर्जस्ती Unicode Nepali भनेर seed गरिने छैन। GA/PM का Nepali display titles verified Unicode source वा admin-entered mapping बाट भरिनेछन्। Technical Subject का readable English names र numbering चाहिँ syllabus अनुसार safely seed गर्न सकिन्छ।

## 4. Seed strategy र backward compatibility

Subject page को header मा **admin-only `Seed Subject Data`** button राखिनेछ। यसले Civil Sub Engineer का baseline subjects, Units, chapters, mode availability र initial price metadata एक पटकमा लेख्नेछ। Existing **Exam Seed Money** button र त्यसको logic यस update को कारणले हटाइने छैन; नयाँ learning seed लाई त्यससँग मिसाइने पनि छैन।

Seed function idempotent हुनेछ। Stable IDs र `schemaVersion` प्रयोग गरेर दोहोर्‍याएर click गर्दा duplicate records नबन्ने, existing admin-edited title/price अनावश्यक रूपमा overwrite नहुने, र missing records मात्र create/update हुने व्यवस्था गरिनेछ। Large syllabus seed लाई Firestore REST batch limit अनुसार chunks मा commit गरिनेछ र प्रत्येक chunk मा progress/loading feedback देखाइनेछ।

Seed ले सबै course/subcourse मा एउटै copy राख्ने होइन; initial baseline लाई Civil course र Civil Sub Engineer subcourse मा राखिनेछ। पछि admin website बाट अर्को subcourse मा content assign गर्दा `courseId` र `subcourseId` अनुसार मात्र देखिनेछ। यसले prompt मा भनिएको “पछि एउटा subcourse मा add गर्दा सबैमा नदेखियोस्” requirement पूरा गर्छ।

## 5. Screen तथा navigation plan

### 5.1 Home Subject section

Home मा अहिलेको demo subject strip हटाएर current user को course/subcourse अनुसार `app_learning_subjects` fetch गरिनेछ। Header को text bilingual translation बाट आउनेछ। `View All` लाई `See all` बनाइनेछ र `/subjects` मा जानेछ। Home card press गर्दा generic list होइन, selected subject को stable route खोलिनेछ। Loading मा existing premium skeleton, error मा retry, empty मा content-coming-soon state राखिनेछ।

### 5.2 All Subjects page

`/subjects` मा top app bar, course/subcourse detail card, total available subjects, Complete, In Progress, Premium counts र database बाट आएको subject list देखाइनेछ। Horizontal filter/tabs मा `All`, `Direct Chapters`, `Units` राख्न सकिन्छ, तर first release मा user को screenshot जस्तै clean All view प्राथमिकता हुनेछ। Cards मा title, icon, available chapter/unit count, progress ring/bar र `Premium`, `Purchased` वा `Active` badge देखिनेछन्।

### 5.3 Direct Chapter Subject page

`/subjects/[subjectId]` मा `structureType === 'directChapters'` भए second screenshot जस्तो direct chapter cards देखाइनेछन्। General Awareness का `1.1`, `1.2`, `1.3` आदि र Public Management का `2.1`, `2.2` आदि यसै page मा आउँछन्। Chapter card मा title, available modes को P/R/T chips, attempted count, progress percentage, premium badge र arrow हुनेछन्। Subject summary card ले total chapters र total questions वास्तविक fetched data बाट निकाल्नेछ; hardcoded `60` वा `99` राखिने छैन।

### 5.4 Unit-based Subject page

`/subjects/[subjectId]` मा `structureType === 'units'` भए first screenshot को pattern देखाइनेछ। Technical Subject का Units cards देखिनेछन्। प्रत्येक Unit card मा title, number of chapters/topics, progress ring, premium badge र expand/open affordance हुनेछ। Unit select गरेपछि `/subjects/[subjectId]/unit/[unitId]` खोलिनेछ। Unit detail page मा त्यस Unit का chapters cards देखाइनेछन्। एकैचोटि धेरै expandable sections खुला नराखी एउटा खोल्दा अघिल्लो बन्द गरिनेछ।

### 5.5 Chapter mode selector

Chapter card press भएपछि screen बदल्नु अघि compact bottom sheet/modal खुल्नेछ। यसमा database को `availableModes` अनुसार मात्र Practice, Read, Theory buttons देखाइनेछन्। कुनै mode content नभए button render हुँदैन। Premium chapter मा access check पहिला चल्नेछ; access नभए existing shared purchase page मा जानेछ।

### 5.6 Mode routes

Proposed routes:

| Route | काम |
|---|---|
| `/subjects/[subjectId]/chapter/[chapterId]` | Chapter overview तथा mode selector |
| `/subjects/[subjectId]/chapter/[chapterId]/practice` | Daily Practice Quiz |
| `/subjects/[subjectId]/chapter/[chapterId]/read` | Read mode question cards |
| `/subjects/[subjectId]/chapter/[chapterId]/theory` | In-app PDF/theory viewer |
| `/subscription/content-purchase/[id]` | Subject/Unit/Chapter purchase detail |

Existing `/subjects/[id]/[chapterId]` legacy topic route लाई तुरुन्त delete नगरी compatibility redirect वा legacy fallback राखिनेछ। यसले पुराना deep links र existing content flow नबिगार्नेछ।

## 6. Mode behavior र progress rules

### Practice Quiz

Practice screen मा chapter title, mode subtitle, current question number, daily remaining count, difficulty tag, bookmark र report actions हुनेछन्। चार options press गरेपछि answer state तुरुन्त save हुनेछ। Correct भए green, wrong भए red feedback र explanation देखाइनेछ। पहिलो question मा Previous disabled हुनेछ; Next ले saved state सहित अगाडि लैजानेछ। Question order प्रत्येक session मा random हुनेछ।

Daily limit 30 हुनेछ, तर chapter मा 30 भन्दा कम questions भए उपलब्ध संख्या मात्र देखाइनेछ। Kathmandu local date अनुसार `dateKey` राखेर midnight पछि नयाँ count सुरु हुनेछ। Limit पुगेपछि option press गर्दा Daily Limit Reached dialog आउनेछ। `View My Analytics` हाल under-construction toast मा जान सक्छ; `Preview Your Question` ले पहिले answer गरिएका questions read-only रूपमा देखाउनेछ। Limit dialog मा active subscription वा chapter purchase link पनि राखिनेछ।

Prompt मा “daily नयाँ questions, repeat एक हप्तापछि मात्र” भनिएको छ। Client-side algorithm ले current day र पछिल्ला 7 दिनका attempted IDs filter गरेर नयाँ question छान्नेछ; उपलब्ध नयाँ question सकिएमा मात्र पुराना repeat हुनेछन्। यो behavior UX स्तरमा लागू गर्न सकिन्छ, तर Spark plan र no-Cloud-Functions architecture मा malicious client बाट 100% enforce गर्न सकिँदैन। यसलाई plan मा transparent limitation का रूपमा राखिनेछ।

### Read mode

Read mode मा question, चार options, correct option, explanation, bookmark र report देखाइनेछ। सुरुमा question body compact रहनेछ; accordion खोल्दा detail देखिनेछ। एकपटकमा एउटा question मात्र expanded हुनेछ। Refresh वा screen मा फर्किँदा question order फेरि random हुन सक्छ, तर user progress र bookmarks नहराउनेछन्।

### Theory mode

Theory mode ले existing exam PDF viewer pattern reuse गर्नेछ। URL सबै supported PDF links का लागि database बाट आउनेछ। In-app viewer मा explicit download, share वा screenshot action buttons राखिने छैन। तर Android/iOS operating system ले बाहिरबाट screenshot रोक्न सधैँ guarantee नगर्ने भएकाले requirement लाई “app-level download/share controls हटाउने” रूपमा implement गरिनेछ, OS-level absolute screenshot prevention भनेर promise गरिने छैन।

### Progress र autosave

हर answer, read expansion completion, theory open/complete, bookmark र mode exit मा progress document update हुनेछ। Chapter progress बाट Unit progress, Unit बाट Subject progress, र Subject बाट summary percentage derive गरिनेछ। `await` लाई React state setter भित्र नराखी पहिले result variable तयार गरेर मात्र state update गरिनेछ। Back icon वा iOS swipe back मा confirmation dialog देखाइनेछ: “Your data has been autosaved.” Existing hardware/back gesture behavior लाई पनि route-level guard बाट सुरक्षित रूपमा handle गरिनेछ।

## 7. Subscription तथा purchase plan

Existing `app_subscription_settings`, `app_subscription_plans`, manual QR/bank details, gateway flags र shared checkout reuse गरिनेछन्। Subject/Unit/Chapter purchase का लागि नयाँ top-level settings वा payment system बनाइने छैन। Checkout input मा `purchaseType: 'content'`, `targetType`, `targetId`, `accessScope` र parent metadata थपिनेछ। Existing exam purchase branch र Google Form/Discord report flow प्रभावित हुने छैन।

Premium state को नियम यस्तो हुनेछ:

| अवस्था | UI tag | Access |
|---|---|---|
| Premium तर access छैन | `Premium` | Purchase page खुल्छ |
| Pending request | `To Purchase (Pending)` | Duplicate request रोकिन्छ; existing request detail खुल्छ |
| Approved individual purchase | `Purchased` | Target content active |
| Active subscription | `Active` | Subscription policy अनुसार premium content खुल्छ |
| Parent full-access purchase | `Purchased — Full Access` | Selected parent का सबै child chapters/units active |

Parent Subject/Unit purchase page मा `Access all chapters/units` tick box हुनेछ। Tick भए final price `basePrice × 2` हुनेछ र price details मा किन बढेको हो स्पष्ट देखाइनेछ। Tick नभए partial access policy लागू हुनेछ; उदाहरणका लागि 10 chapters भए पहिलो पाँच वा admin-defined half-access set मात्र active हुने गरी deterministic rule राखिनेछ। Price र premium flags code मा hardcode नगरी Firebase बाट fetch हुनेछन्।

Payment submit भएपछि request `/purchase-details` मा Subject Details track अन्तर्गत जानेछ। User purchase history र Admin Purchase Request Control दुवैमा `Subject`, `Unit`, `Chapter`, `Subject Details` tags छुट्टाछुट्टै filter गर्न मिल्नेछन्। Existing exam request flow को fields, 30-minute edit window र admin approve/reject logic copy गरेर content-specific target fields थपिनेछन्; shared service helper बनाएर duplicate bugs कम गरिनेछ।

## 8. Firebase security plan

Rules मा content catalog read लाई authenticated users वा published public records का लागि सीमित गरिनेछ। Progress, daily usage, bookmarks र user purchase request मा user ले आफ्नो UID को document मात्र create/read/update गर्न पाउनेछ। Purchase approval, price, premium flag, seed action र content publish/update admin UID वा verified admin role बाट मात्र हुनुपर्नेछ। Client-readable subscription settings मा gateway secret keys राखिने छैन; existing payment security rule कायम रहनेछ।

महत्त्वपूर्ण रूपमा, Firestore rules ले client-side 30-question daily limit को पूर्ण anti-cheat guarantee दिन सक्दैन, विशेषगरी Cloud Functions/server transaction नभएको Spark-only setup मा। UX limit, user-owned usage records र rules-based ownership सुरक्षित रूपमा लागू गरिनेछ; future backend उपलब्ध भएपछि server-enforced quota थप्न सकिनेछ।

## 9. Recommended PR implementation order

यो scope एकैपटक ठूलो PR मा नराखी hjr को manual-merge workflow अनुसार साना reviewable PR मा विभाजन गर्नु राम्रो हुनेछ।

| PR | Scope | Merge पछि verification |
|---|---|---|
| PR-A | Collections, shared types, content services, rules, idempotent seed schema | Firebase emulator/manual test; existing exam/discussion unaffected |
| PR-B | Home Subject strip, All Subjects, Subject summary cards, direct-chapter and Unit navigation | Civil Sub Engineer user ले सही subject/structure देख्ने |
| PR-C | Unit detail, Chapter cards, mode selector, P/R/T availability, skeleton/error/empty states | Screenshot-level UI and navigation test |
| PR-D | Practice mode, Read mode, Theory viewer, bookmarks/reports, randomization, daily limit, autosave | Answer, reset, exit, refresh, and progress tests |
| PR-E | Progress aggregation and summary analytics | Chapter → Unit → Subject percentages match real records |
| PR-F | Content subscription, doubled full-access price, checkout reuse, Subject Details request track | QR/manual payment request, duplicate guard, admin approval |
| PR-G | Admin seed button, content management compatibility, admin purchase control, final rules hardening | Admin/non-admin permission matrix and regression test |

हरेक PR अघि focused TypeScript, changed-file ESLint, JSON parity, Firebase rule review, `git diff --check`, Android navigation, iOS back gesture र manual seeded-data test चलाइनेछ। Main मा direct push गरिने छैन; हरेक PR hjr ले manually merge गर्नुहुनेछ।

## 10. Acceptance criteria

Implementation complete मान्नुअघि Home मा demo subject होइन real Firebase subjects देखिनुपर्छ। General Awareness/Public Management direct chapter list र Technical Subject Unit-first list सही रूपमा छुट्टिनुपर्छ। `1.1`, `1.1.1` जस्ता syllabus numbering नहराउनुपर्छ। Chapter card मा P/R/T मध्ये database मा उपलब्ध mode मात्र देखिनुपर्छ। Practice answer, Read accordion, Theory viewer, daily limit, randomization, bookmarks, report action, autosave र progress aggregation वास्तविक data बाट चल्नुपर्छ। Premium state, subscription, individual purchase, full-access tick, doubled price, pending request, admin approval र Subject Details track एकै consistent target ID मा आधारित हुनुपर्छ। Existing Exam Seed Money, exam purchase, payment gateway, Discussion report, Google Form/Spreadsheet/Discord flow र Report History नबिग्रिनुपर्छ।

## 11. User confirmation अघि रोक्नुपर्ने विषय

Code लेख्नुअघि दुई कुरा confirm गर्नुपर्छ। पहिलो, `General Awareness` र `Public Management` का exact Unicode Nepali titles चाहिन्छ, किनकि uploaded PDF को Nepali text legacy encoding मा छ र गलत conversion गरेर seed गर्नु उचित हुँदैन। दोस्रो, partial purchase tick नगरेपछि “half chapters” कुन deterministic rule ले दिने भन्ने पुष्टि चाहिन्छ: पहिलो 50%, random 50%, वा admin-selected chapters। यी दुई confirmation बिना data seed गर्दा पछि ठूलो migration र title correction हुन सक्छ।

मेरो recommendation अनुसार पहिले PR-A मा schema/services/rules/seed foundation बनाउने, त्यसलाई merge गरेर मात्र UI सुरु गर्ने, र पहिलो seed run लाई Civil Sub Engineer subcourse मा सीमित राख्ने हो। यसरी existing app को working systems सुरक्षित रहन्छन् र screenshot अनुसार Subject/Unit तथा direct Chapter दुवै structure सही रूपमा निर्माण हुन्छन्।

## Sources

1. User-provided `pasted_content.txt` — Subject Section, Chapter Page, Practice/Read/Theory, database, seed, progress, subscription र UI requirements.
2. User-provided `syllabus.pdf` — Civil Sub Engineer PSC syllabus, General Awareness/Public Management structure तथा Technical Subject numbering.
3. Existing repository architecture — `app/(tabs)/index.tsx`, `app/subjects/*`, `src/core/firebase/services/content.ts`, `src/core/firebase/collections.ts`, `src/core/firebase/seed.ts`, subscription and exam-purchase services.
