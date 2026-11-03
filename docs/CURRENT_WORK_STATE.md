# מצב עבודה נוכחי (Continuity Snapshot)

עודכן לפני Auto-Compact. ללא סיסמאות/טוקנים/מידע רגיש.

## סבב נוכחי — שדרוג UX/UI של חונך+ (Issue #1, ענף `ux-redesign-honech-plus`)
- מרחב עבודה רספונסיבי (רשימה + סקירה; עוזר AI כעמודה ≥1536, מגירה 1024–1535, אזור נפרד בטלפון),
  חיפוש חניכים, לשוניות סקירה/משובים, טיוטות משוב בזיכרון לכל חניך + אזהרת יציאה.
- חוזה שמירה: `SaveResult` — טופס מתנקה רק אחרי אישור שרת (כולל PR #2).
- סרגל ניווט אחד (מחזורים → אנשי המערכת/עדכונים/ניהול → חשבון), בר עליון רק בטלפון.
- Tokens נגישים (subtle 5:1, control 3:1, focus כחול), טבלאות ניהול ללא גלילה אופקית בטלפון.
- תיעוד: `DESIGN.md` (נכתב מחדש לפי הקוד), `docs/UX_REDESIGN_AUDIT.md`, §24–§31 ב-`MANUAL_ACCEPTANCE_TESTS.md`.
- אומת: typecheck/lint/check:* ירוקים, `next build` עבר ב-worktree מבודד (בלי לגעת ב-`.next` של שרת הפיתוח),
  Playwright ב-1600/1440/1280/1024/768/390/320. ללא שינויי RBAC/API/DB.

## סבב תיקון — "אנשי המערכת" (flyout מעל הסיידבר + אריחים) — הושלם ואומת
- **פתיחה מעל ה-Sidebar** (`DirectoryFlyout`): הפאנל עבר מ-`lg:start-64` ל-`start-0` — נפתח
  מהקצה הימני, מכסה את הסרגל (256px) ומעט רחב יותר (`lg:w-96`), תוכן מרכזי לא זז, אין גלילה
  אופקית. במקום החשכה כבדה — **catcher שקוף** לסגירה בלחיצה בחוץ + `shadow-2xl`. Escape סוגר
  קודם את הפרופיל (דרך `profileOpenRef`), ואז את הרשימה. שכבות: סרגל < flyout(z-40) < preview(z-45) < פרופיל(z-50).
- **אריחים קומפקטיים** (`DirectoryView`): רשת `auto-fill` של אריחים ריבועיים (~4.5rem) עם אווטאר+אות,
  נקודת תפקיד עדינה (slate) / כתר ל-root, `aria-label`+`title`. Hover/Focus מגדיל (200ms ease-out,
  מבוטל ב-`motion-reduce`) ומציג **כרטיס Preview** (portal + `useAnchoredPosition`, flip מעל/מתחת,
  clamp ל-viewport, `pointer-events-none`). לחיצה/Enter/Space פותחים את **מודל הפרופיל** הקיים.
- **הרשאות ללא שינוי** (`directory.ts` לא נגעתי): אומת ש-admin רואה 2 קורסים + שליחת הודעה,
  staff רק קפ"ה + הנהלת מערכת ו**ללא** שליחת הודעה, super רואה הכול + כתר.
- **קבצים**: `src/components/directory/DirectoryView.tsx`, `src/components/directory/DirectoryFlyout.tsx`,
  `docs/MANUAL_ACCEPTANCE_TESTS.md` (§18). `typecheck`/`lint`/`build`/`check:guards` ירוקים.

## סבב תיקון עוקב — בר עליון + פאנל התראות (הושלם ואומת)
תיקון ממוקד שהתגלה אחרי הסבב הקודם, בעיקר במסך הפתיחה וב-Top Bar:
- **מבנה בר עליון אחיד** (Topbar + LandingScreen): פעמון + מלבן המשתמש בצד ימין,
  גלגל ההגדרות **לבד** בקצה שמאל (נדחף ב-`ms-auto`, לא זז עם אורך השם). עמוד הבוט
  (AssistantChat) כבר תאם — שימש כהשראה, ללא שכפול. אין Top Bar/פאנל נפרד למסך הפתיחה.
- **מיקום דינמי לפאנל ההתראות**: Hook חדש `src/lib/hooks/useAnchoredPosition.ts`
  (מדידת `getBoundingClientRect` + `position: fixed`, ללא תלות חיצונית). הפאנל מרונדר
  ב-Portal ל-`document.body`, מיושר לקצה הפעמון (RTL), נצמד פנימה ל-viewport עם מרווח
  ~12px, מוגבל ברוחב/גובה (רשימה נגללת בפנים), נפתח מתחת לפעמון (Flip מעלה בעת מחסור
  במקום), ומתעדכן ב-resize/scroll/zoom. הבועה כבר לא נחתכת בקצה ימני.
- **קבצים**: `src/lib/hooks/useAnchoredPosition.ts` (חדש),
  `src/components/notifications/NotificationPopover.tsx`,
  `src/components/notifications/NotificationBell.tsx`,
  `src/components/layout/Topbar.tsx`, `src/components/landing/LandingScreen.tsx`,
  `docs/MANUAL_ACCEPTANCE_TESTS.md` (§17/§19/§23).
- **אומת**: `typecheck`/`lint`/`build`/`check:guards` ירוקים; בדפדפן (admin.kapeh.test)
  ב-1280/375/300 — פאנל בתוך גבולות המסך בכל צד, יישור לקצה הפעמון, סגירה בחוץ/Escape,
  ללא גלילה אופקית, הפאנל מעל ה-Header (לא נחתך); בר עליון תקין בעמוד הפתיחה/בוט/פנימי;
  ללא שגיאות JS/הידרציה בקונסול (500 של `?_rsc=` הוא מרוץ הידור של `.playwright-mcp`, לא באג).

## מטרת הסבב הנוכחי
סבב תיקוני UX, ניווט והרשאות ב-BOT_MASHOV / מצפן (10 סעיפים): הסרת הקפאת מחזורים,
החזרת אנימציית הרקע בעמוד הפתיחה, "שליחת הודעה" מפרופיל עם בחירת נמען אוטומטית,
סגירת חלונות לפני מעבר לכתיבת הודעה, הוצאת גלגל ההגדרות מכרטיס המשתמש, מיקום "חניך
מקושר" בבר הבוט, פאנל התראות מתחת לפעמון, היפוך אייקון יציאה ל-RTL, ופס גלילה מימין.

## סטטוס: הסבב הושלם ואומת
כל 10 הסעיפים מומשו, עברו `typecheck` (exit 0), `lint` (נקי), `build` (עבר),
`check:guards` (עבר), ונבדקו בדפדפן (Playwright) כמפורט למטה. **אין דרישות פתוחות בסבב זה.**

## הקבצים ששונו בסבב הנוכחי
- הסרת הקפאה: `src/lib/auth/access.ts`, `src/lib/data/trainees.ts`, `src/lib/data/cohorts.ts`,
  `src/lib/data/org-admin.ts`, `src/app/api/admin/cohorts/[id]/route.ts`,
  `src/components/admin/CohortsManager.tsx`, `src/components/trainees/TraineeCohortFilter.tsx`,
  `src/app/(app)/trainees/page.tsx`, הערות ב-`src/models/Trainee.ts` + `src/models/Cohort.ts`.
- אנימציה: `src/components/landing/LandingScreen.tsx` (הוחזר `NetworkBackground`).
- שליחת הודעה/נמען/סגירה: `src/lib/data/recipients.ts` (+`messageableIds`/`canMessageUser`),
  `src/lib/data/directory.ts` (+`canMessage`), `src/components/directory/DirectoryView.tsx`,
  `src/components/directory/DirectoryFlyout.tsx`, `src/app/(app)/messages/compose/page.tsx`,
  `src/components/messages/ComposeForm.tsx`, `src/app/(app)/admin/users/[id]/page.tsx`,
  `src/app/(app)/system/users/[id]/page.tsx`.
- בר עליון/התראות: `src/components/layout/SettingsButton.tsx` (חדש),
  `src/components/layout/UserMenu.tsx`, `src/components/layout/Topbar.tsx`,
  `src/components/assistant/AssistantChat.tsx`,
  `src/components/notifications/NotificationPopover.tsx` (חדש),
  `src/components/notifications/NotificationBell.tsx`
  (נמחק `src/components/notifications/NotificationDrawer.tsx`).
- תיעוד: `docs/MANUAL_ACCEPTANCE_TESTS.md`.

## מה נבדק
- Admin (`admin.maksim.test`): flyout → פרופיל `superadmin.test` → "שליחת הודעה" → שני החלונות
  נסגרים, אין scroll-lock, הנמען נבחר מראש. עמוד הפתיחה: אנימציה + פאנל פעמון. בר עליון: גלגל בקצה.
- Staff (`staff.maksim.1.test`): אין כפתור "שליחת הודעה" בפרופיל; `compose?to=<super>` → שגיאה + 0 נמענים.
- מחזורים: אין נעילה/הקפאה. בר הבוט: גלגל שמאלי + חניך מימינו. אייקון יציאה הפוך (`scale: -1 1`).
- Console: אין שגיאות מהשינויים (רק `favicon.ico` 404 קיים מראש).

## מה עדיין דורש בדיקה (אופציונלי, לא חוסם)
- אימות ידני של פס הגלילה מימין ב-flyout בדפדפן (המימוש `dir:ltr` מיכל + `dir:rtl` תוכן — נכון בקוד).
- בדיקה חוזרת מרובת-דפדפנים (Edge) לפאנל ההתראות ולפס הגלילה.

## פריטים עומדים/נדחים (מסבבים קודמים — לא חלק מסבב זה)
- חשבונות ה-root של הבדיקה זקוקים ל-`rootProfile` דרך בוטסטרפ מקומי (מאושר) כדי להפעיל כתר/ניווט.
- נדחו: מסמכי מחזור (§35) ויבוא מחזור היסטורי (§36).

## מגבלות בטיחות קבועות
אין: איפוס/מחיקת MongoDB, הרצת seed/backfill, שינוי סיסמאות בדיקה, מחיקת משתמשים/חניכים,
שינוי המשתמש האמיתי "עידו גרשון", Migration הרסני, `git reset`/פקודות Git הרסניות,
החלשת בדיקות הרשאה בצד השרת, הוספת AI/SDK/API-Key, נגיעה ב-Blender_TUT. הרשאות רגישות
נבדקות בצד השרת מול MongoDB, לא רק מה-JWT/לקוח.

## שרת פיתוח
חייב להישאר פועל ב-**http://localhost:3000** (מורץ מ-`npm run dev -- -p 3000`, מנותק).
אין להריץ `next build` בזמן ש-`next dev` פעיל (משבש את `.next`); לעצור, לבנות, ולהפעיל מחדש.
