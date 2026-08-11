/* ---------------------------------------------------------------------------
   app.js — מסך "מפת חום": תחנות · יחידות · מרחבים · יישובים.

   שני הטאבים הם אותה זרימה בדיוק, רק עם הצדדים מוחלפים: בוחרים ישות אחת
   ורואים את מי שקרוב אליה עד 30 דק'. לכן הם ממומשים כתצורה אחת (MODES) ולא
   כשני עותקים של אותו קוד — אחרת תיקון בצד אחד היה שוכח את השני.

   הצבעים והסטטוסים מגיעים מהשרת (colors.py) ולא מחושבים כאן, כדי שהמקרא,
   הסיכות, הטבלה והייצוא לא יוכלו לסטות זה מזה.
   --------------------------------------------------------------------------- */

const DEFAULT_VIEW = { center: [32.07, 34.83], zoom: 11 };

// גבולות מדינת ישראל. המפה לא ניתנת לגרירה מחוץ להם ולא לזום־אאוט מעבר להם:
// זו מערכת של משטרת ישראל, ומפה שאפשר לגרור לאירופה רק מזמינה איבוד הקשר.
// הטווח נדיב במכוון (כולל שוליים) כדי שהמחוזות בקצוות לא ייחתכו.
const ISRAEL_BOUNDS = [
  [29.35, 34.15], // דרום־מערב, אילת
  [33.40, 35.95], // צפון־מזרח, הר דב
];
const MIN_ZOOM = 7; // רואים את כל המדינה, ולא פחות מזה

// §37: גוון הרקע של כל מחוז. **ההיגיון של המפה הרשמית, לא הצבע שלה** —
// צפון ירוק, חוף כחול, דרום חול — כדי שמי שמכיר את המפה ההיא יזהה כאן
// את אותה חלוקה. הרוויה נמוכה במכוון: הרקע מסביר איפה, והסיכות אומרות
// כמה חסר, ורקע רווי היה מתחרה בהן על אותה עין.
const DISTRICT_TINT = {
  "צפון": "#7fa06a",
  "חוף": "#7ba7cf",
  "מרכז": "#e08a4a",
  "תל אביב": "#6c8296",
  'ש"י': "#a97cc0",
  "ירושלים": "#d9c05e",
  "דרום": "#c2a878",
};

// שמות המחוזות מוצגים רק במבט הרחב. בזום קרוב הם מיותרים — שמות התחנות
// כבר על המסך — והם היו מתחרים בהם על אותו מקום.
//
// §38: ומעליו נכנסים שמות המרחבים, ברמה אחת פנימה. בכל זום יש שכבת
// התמצאות אחת בלבד: שתיהן יחד היו שתי רשתות שמות על אותה מפה.
// §42.1: שני ספי הזום של התוויות הוסרו. שם המרחב מוצג בכל זום, ושם
// המחוז אינו מוצג כלל — אין יותר תלות בזום, ולכן אין מה לכייל.
// §42: אין יותר תקרה עליונה לשם המרחב. היא הסתירה אותו בדיוק כשמסתכלים
// על מרחב אחד מקרוב, והמסך נשאר בלי שום ציון של איפה אתה נמצא.

// מבט הפתיחה. fitBounds על מאגר ארצי מציג את כל המדינה, ובזום כזה סיכות
// גוש דן נדחסות לכתם אחד. ההגדלה מקרבת למרכז הכובד, ששם רוב המידע; התקרה
// מונעת מצב שבו מאגר מצומצם (מחוז אחד) נפתח בזום רחוב. שני מספרים במקום
// אחד — ראו fitToBase, שהוא הצרכן היחיד שלהם.
const DEFAULT_ZOOM_BOOST = 1;
const MAX_DEFAULT_ZOOM = 10;

// §18.1: **רקע אחד, מקומי, בלי שום קישור לאינטרנט.**
//
// עד עכשיו היו כאן חמישה רקעים מספקים חיצוניים (Esri, CARTO,
// OpenStreetMap) ורקע מקומי אחד. כולם הוסרו: מפת חום של משטרת ישראל
// אינה אמורה לפנות לשרת חיצוני בכל תזוזה של המפה, ובוודאי לא ברשת
// סגורה — שם הם ממילא היו מציגים ריבועים אפורים.
//
// האריחים יושבים ב-web/vendor/tiles ומוגשים מהשרת המקומי. הם ירדו פעם
// אחת עם tools/download_tiles.py (כל הארץ, זום 9-14), והם אריחי Esri
// "רחובות" — הרקע היחיד שמציג תוויות בעברית בכל רמות הזום.
//
// אין בורר רקעים: אין ממה לבחור, ובורר עם פריט אחד הוא רעש.
//
// הרקע ניתן להחלפה בזמן פריסה (window.BASEMAPS_OVERRIDE), ולא כדי לפתוח
// את הרשת הסגורה: זו נקודת החיבור של פריסות שאין להן את חבילת האריחים
// המקומית — למשל הדגמת הפורטפוליו הסטטית, שרצה על אירוח ציבורי בלי שרת
// שיגיש אריחים. בהתקנה המבצעית אין override, והרקע נשאר מקומי בלבד.
const BASEMAPS = window.BASEMAPS_OVERRIDE || {
  "מפה מקומית": {
    url: "/web/vendor/tiles/{z}/{x}/{y}.png",
    attribution: "אריחים מקומיים · © Esri",
    maxZoom: 14,
    offline: true,
  },
};

const DEFAULT_BASEMAP = window.DEFAULT_BASEMAP_OVERRIDE || "מפה מקומית";

const state = {
  map: null,
  stations: [],
  settlements: [],
  regions: [],
  relations: [],
  regionRelations: [],
  candidateScopes: [],
  adminRows: [],
  occupationGroups: { items: [], groups: [], unclassified: 0 },
  units_editable: [], // §23: היחידות המגייסות, לעריכה בניהול הנתונים
  changeLog: [],      // §23: יומן השינויים הידניים
  unitAliases: { aliases: [], candidates: [], units: [] }, // §23: איחוד כתיבים
  adminProfessions: [],
  adminRegion: "", // היחידה שנבחרה בטבלת המנהלה, לצמצום רשימת המשרות
  populationKnown: false, // האם יש במאגר נתוני אוכלוסייה בכלל
  largePopulation: 20000, // סף האוכלוסייה — נשאר לתצוגה בלבד; ראה focusSettlements
  focusSettlements: 0,    // כמה יישובי מיקוד — הרשימה שהמפה מציגה ומדגישה
  strategicScope: "core", // core = תפקידי ליבה, admin = מנהלה
  dataset: "relations", // מערך הנתונים המוצג בלשונית ניהול הנתונים
  settingsPane: "manage", // §16.3 — הלשונית הפעילה במסך ההגדרות
  drawerStationId: null,  // §17.3 — התחנה שנבחרה בטאב היישובים
  units: [], // §8 — מרחבים + יחידות לגיוס, רמה 03
  stationsById: new Map(),
  settlementsById: new Map(),
  regionsById: new Map(),
  unitsById: new Map(),
  nearbyMinutes: 30,
  screen: "map",
  mode: "stations",
  selectedId: null,
  baseLayer: null,    // הסיכות של המצב הנוכחי
  nearbyLayer: null,  // שכבת הבחירה: מי שקרוב + קווי החיבור
  orientationLayer: null, // §26 — 20 הערים הגדולות, שמות התמצאות בלבד
  labelLayer: null,   // §27 — שמות התחנות/היחידות/המרחבים, בלי חפיפה
  districtLayer: null,      // §37 — גבולות המחוזות, מהמפה הרשמית
  districtLabelLayer: null, // §37 — שמות המחוזות והמרחבים, לפי הזום
  districtLabels: [],       // {name, lat, lng} — נקודה בתוך כל מחוז
  regionLayer: null,        // §38 — גבולות המרחבים, בתוך המחוזות
  regionLabels: [],         // {name, lat, lng} — נקודה בתוך כל מרחב
  cityBoxes: [],            // §37 — המקום שתפסו שמות הערים שהוצגו בפועל
  baseMarkers: new Map(),
  nearbyStationMarkers: [], // תחנות קרובות בטאב היישובים, לרענון גודל בזום
  // אילו עיסוקים נכללים בכל משפחה, **לפי היקף** (תחנה / מרחב / יחידה).
  // מפתח ההיקף -> התשובה. ראה roleScope.
  roleOccupations: new Map(),
};

/* --- תצורת מצבי המפה ----------------------------------------------------- */
//
// שלושה טאבים, אותו מסלול רינדור. כל מה שנבדל ביניהם יושב בטבלה הזו ולא
// בתנאים מפוזרים בקוד: איזו רשימת ישויות מוצגת, איזה סמן, מה נחשב "קרוב",
// ומה מוצג בכרטיס. טאב רביעי יידרש שורה כאן, לא חיפוש if-ים.

const MODES = {
  stations: {
    hash: "station",
    label: "תחנה",
    placeholder: "חפש תחנה… (או לחץ על סיכה במפה)",
    tab: "tab-stations",
    // מי מוצג כברירת מחדל, ומי "הצד השני" שקופץ בבחירה
    base: () => state.stations,
    byId: (id) => state.stationsById.get(id),
    // קשרים של הישות הנבחרת, מנקודת מבטה
    nearbyOf: (id) =>
      state.relations
        .filter((r) => r.station_id === id && r.within_nearby)
        .map((r) => ({ ...r, otherId: r.settlement_id, otherName: r.settlement_name }))
        .sort((a, b) => a.travel_min - b.travel_min),
    otherById: (id) => state.settlementsById.get(id),
    // §19.1: על המפה מצוירים **רק יישובי המיקוד**, בדיוק כמו במסך
    // המרחבים והיחידות. תחנה מגייסת מ-60 יישובים, ו-60 תוויות סביב סיכה
    // אחת מסתירות את מה שבאו לראות. הרשימה בכרטיס ממשיכה להציג את כולם.
    //
    // הדגל נלקח מהיישוב עצמו ולא מהקשר: ב-state.relations אין עמודת
    // focus, והמקור היחיד לכלל הזה הוא היישוב.
    mapFilter: (rel) => {
      const settlement = state.settlementsById.get(rel.otherId);
      return Boolean(settlement && settlement.focus);
    },
    baseIcon: (entity, selected) => stationIcon(entity, selected),
    // §27: קוטר הסיכה בפיקסלים — ממנו נגזר גם מה שהיא תופסת וגם היכן
    // התווית מתחילה. מספר אחד, כדי שהתווית לא תיפרד מהסיכה בזום.
    pinExtent: (entity, selected) => pinSize(selected),
    nearbyMarkers: (rel, other) => [labelMarker(other.name, rel.travel_min)],
    // צבע קו החיבור. הוא תמיד נלקח מהצד שנצבע לפי אחוז איוש: בתחנות
    // ובמרחבים זו הישות הנבחרת, ביישובים זו התחנה שבקצה השני — ליישוב
    // עצמו אין אחוז איוש ואין צבע.
    lineColor: (entity) => entity.color,
    listTitle: "יישובים",
    // פריטי הרשימה בכרטיס נלחצים ופותחים חלונית תחנה — רק כשהם תחנות.
    itemsAreStations: false,
    head: (entity) =>
      `<span class="pill" style="background:${entity.color}">${entity.status}</span>
       <strong>${escapeHtml(entity.name)}</strong>`,
    grid: (entity) =>
      `<div><span>מרחב</span><b>${escapeHtml(entity.area || "—")}</b></div>
       <div><span>אחוז איוש</span><b>${pctFull(entity)}</b></div>
       <div><span>משרות לגיוס</span><b>${vacantCountText(entity)}</b></div>
       <div title="${vacancyTip(entity)}"><span>תקנים חסרים</span><b>${missingText(entity)}</b></div>
       <div><span>מועמדים בהליך</span><b>${candidatesText(entity)}</b></div>`,
    breakdown: (entity) => demographics(entity) + familyBreakdown(entity),
    suggestionMeta: (e) => `<span class="sugg-dot" style="background:${e.color}"></span>`,
    suggestionTrailing: (e) => `<span class="sugg-pct">${pctText(e)}</span>`,
  },

  // §8: הרזולוציה שבין תחנה למרחב. כל המרחבים, ועוד היחידות שהוגדרו
  // בקובץ "יחידות לגיוס" — ימ"רים, מפקדות מג"ב, יחידות ארציות. לכולן יש
  // תקן ואיוש ברמה 03, ולאף אחת מהן לא היה מסך.
  //
  // §15.7: **יש כאן רשימת יישובים.** למרחב היא מגיעה מ-region_settlement,
  // וליחידה מ-unit_settlement — טבלה חדשה שמועתקת בינתיים מהמרחב שיושב
  // באותו יישוב, כפי שנמסר. ישות בלי קשרים מציגה "טעון הגדרה" ולא רשימה
  // ריקה, שנקראת כמו "אין יישובים בטווח".
  units: {
    hash: "unit",
    label: "יחידה",
    placeholder: "חפש יחידה או מרחב… (או לחץ על סיכה במפה)",
    tab: "tab-units",
    base: () => state.units,
    byId: (id) => state.unitsById.get(id),
    nearbyOf: (id) => {
      const unit = state.unitsById.get(id);
      return ((unit && unit.settlements) || []).map((s) => ({
        otherId: s.settlement_id,
        otherName: s.name,
        travel_min: s.travel_min,
        population: s.population,
        focus: s.focus,
      }));
    },
    // על המפה רק יישובי המיקוד, בדיוק כמו במסך המרחבים. הרשימה בכרטיס
    // מציגה את כולם.
    mapFilter: (rel) => rel.focus,
    otherById: (id) => state.settlementsById.get(id),
    baseIcon: (entity, selected) => regionIcon(entity, selected),
    pinExtent: (entity, selected) => regionPinSize(selected),
    nearbyMarkers: (rel, other) => [labelMarker(other.name, rel.travel_min)],
    lineColor: (entity) => entity.color,
    listTitle: "יישובים",
    // "אין יישובים עד 30 דקות" הוא מספר; זה אינו מספר אלא היעדר הגדרה,
    // ושתי המשמעויות מובילות לפעולה שונה לגמרי.
    emptyList: "טעון הגדרה — טרם נקבעו קשרי יישוב ליחידה הזו",
    itemsAreStations: false,
    head: (entity) =>
      `<span class="pill" style="background:${entity.color}">${entity.status}</span>
       <strong>${escapeHtml(entity.kind_label)} ${escapeHtml(entity.name)}</strong>`,
    grid: (entity) =>
      `<div><span>מחוז / אגף</span><b>${escapeHtml(entity.district || "—")}</b></div>
       <div><span>תקן</span><b>${entity.required_positions ?? "—"}</b></div>
       <div><span>בפועל</span><b>${entity.actual_positions ?? "—"}</b></div>
       <div><span>אחוז איוש</span><b>${pctFull(entity)}</b></div>
       <div><span>משרות לגיוס</span><b>${vacantCountText(entity)}</b></div>
       <div title="${vacancyTip(entity)}"><span>תקנים חסרים</span><b>${missingText(entity)}</b></div>` +
      // §40: "משרות פנויות" הוצג ליחידה בלבד, ולמרחב לא הוצג כלל. עכשיו
      // "משרות לגיוס" מופיע לשניהם למעלה, וכאן נשאר רק מה שמבדיל ביניהם.
      (entity.kind === "unit"
        ? ""
        : `<div class="metric-open" data-open-stations="${entity.id}" role="button" tabindex="0"
                title="פתח את רשימת התחנות במרחב">
             <span>תחנות במרחב</span><b>${entity.stations_count} ›</b>
           </div>`),
    breakdown: (entity) =>
      demographics(entity) +
      (entity.kind === "unit"
        ? `<div class="card-empty">יחידה שאינה מרחב — התקן והאיוש מגיעים מרמה 03 בקובץ התקן והמצבה, ואין לה פילוח לפי תחנה.</div>`
        : ""),
    suggestionMeta: (e) => `<span class="sugg-dot" style="background:${e.color}"></span>`,
    suggestionTrailing: (e) => `<span class="sugg-pct">${pctText(e)}</span>`,
  },

  regions: {
    hash: "region",
    label: "מרחב",
    placeholder: "חפש מרחב… (או לחץ על סיכה במפה)",
    tab: "tab-regions",
    base: () => state.regions,
    byId: (id) => state.regionsById.get(id),
    // למרחב אין שורות ב-station_settlement. ה"קרוב" שלו הוא איחוד יישובי
    // התחנות שבו, וזה מחושב בשרת (settlements ב-/api/regions/heat) כדי
    // שהזמן הקצר ביותר לכל יישוב יחושב במקום אחד.
    nearbyOf: (id) => {
      const region = state.regionsById.get(id);
      return (region ? region.settlements : []).map((s) => ({
        otherId: s.settlement_id,
        otherName: s.name,
        travel_min: s.travel_min,
        population: s.population,
        focus: s.focus,
      }));
    },
    // §14.2: על המפה מוצגים רק **יישובי המיקוד** — הרשימה שנמסרה. מרחב
    // מגייס מיישוב של 40,000 אחרת לגמרי מאשר ממושב של 400, ושישים סיכות
    // שוות‑משקל מסתירות את ההבדל.
    //
    // הרשימה בכרטיס ממשיכה להציג את **כולם** — שם אין צפיפות, ושם יישובי
    // המיקוד מודגשים בשחור. מה שהצטמצם הוא המפה, לא המידע.
    mapFilter: (rel) => rel.focus,
    otherById: (id) => state.settlementsById.get(id),
    baseIcon: (entity, selected) => regionIcon(entity, selected),
    pinExtent: (entity, selected) => regionPinSize(selected),
    nearbyMarkers: (rel, other) => [labelMarker(other.name, rel.travel_min)],
    lineColor: (entity) => entity.color,
    listTitle: "יישובים",
    itemsAreStations: false,
    head: (entity) =>
      `<span class="pill" style="background:${entity.color}">${entity.status}</span>
       <strong>מרחב ${escapeHtml(entity.name)}</strong>`,
    // "תחנות במרחב" הוא כפתור ולא מספר: הוא פותח את רשימת התחנות שבמרחב,
    // ומשם את כרטיס התחנה המלא — בלי לצאת ממפת המרחבים. §4.
    grid: (entity) =>
      `<div><span>מחוז</span><b>${escapeHtml(entity.district || "—")}</b></div>
       <div class="metric-open" data-open-stations="${entity.id}" role="button" tabindex="0"
            title="פתח את רשימת התחנות במרחב">
         <span>תחנות במרחב</span><b>${entity.stations_count} ›</b>
       </div>
       <div><span>אחוז איוש משוקלל</span><b>${pctFull(entity)}</b></div>
       <div><span>משרות לגיוס</span><b>${vacantCountText(entity)}</b></div>
       <div title="${vacancyTip(entity)}"><span>תקנים חסרים</span><b>${missingText(entity)}</b></div>
       <div><span>מועמדים בהליך</span><b>${candidatesText(entity)}</b></div>`,
    // מקור המספר מוצג במפורש: ברמת מרחב הוא נגזר משדה "דרישה" בקובץ
    // המועמדים, וזה נתון אחר מסכימת המועמדים שכן שויכו לתחנות. בלי הכיתוב
    // שני מספרים שונים היו נראים כמו אותו מספר.
    // הריחוף על שבב תפקיד פותח את הפילוח לפי תחנה — "חסרים 40 סיירים
    // במרחב" אינו משימה, וארבע התחנות שהם יושבים בהן הן.
    breakdown: (entity) =>
      demographics(entity) +
      familyChips("חוסר לפי תפקיד במרחב", missingItems(entity), "missing-by-station") +
      familyChips(
        entity.candidates_source === "area"
          ? 'מועמדים בהליך לפי תפקיד (משדה "דרישה")'
          : "מועמדים בהליך לפי תפקיד (מהתחנות שבמרחב)",
        candidateItems(entity),
        entity.candidates_source === "area" ? "candidates-no-stations" : "candidates-by-station"
      ),
    suggestionMeta: (e) => `<span class="sugg-dot" style="background:${e.color}"></span>`,
    suggestionTrailing: (e) => `<span class="sugg-pct">${pctText(e)}</span>`,
  },

  settlements: {
    hash: "settlement",
    label: "יישוב",
    placeholder: "חפש יישוב… (או לחץ על סיכה במפה)",
    tab: "tab-settlements",
    // §14.2: המפה מציגה **רק את יישובי המיקוד** — 77 יישובים שנמסרו
    // ברשימה מפורשת. 1,242 סיכות אינן מפה.
    //
    // `settlementsById` נשאר מלא בכוונה: היישובים שאינם ברשימה עדיין
    // קיימים בחיפוש, בקשרי תחנה‑יישוב ובניהול הנתונים. מה שהצטמצם הוא
    // מה שמצויר, ולא מה שהמערכת יודעת.
    //
    // §26: **והנבחר תמיד בפנים.** בלי זה יישוב שאינו במיקוד היה נבחר
    // מהחיפוש ולא מקבל סיכה — הכרטיס נפתח והמפה נשארה ריקה במקומו.
    base: () => state.settlements.filter((s) => s.focus || s.id === state.selectedId),
    // §26: **החיפוש מכיר את כל 1,242 היישובים.** קודם הוא רץ על base,
    // כלומר על 77 יישובי המיקוד בלבד, וחיפוש "שוהם" החזיר "לא נמצא
    // יישוב" — על יישוב שקיים במאגר, עם קואורדינטה ועם תשעה קשרי תחנה.
    // "לא נמצא" על מה שקיים הוא התשובה הגרועה ביותר שמסך יכול לתת.
    searchBase: () => state.settlements,
    byId: (id) => state.settlementsById.get(id),
    nearbyOf: (id) =>
      state.relations
        .filter((r) => r.settlement_id === id && r.within_nearby)
        .map((r) => ({ ...r, otherId: r.station_id, otherName: r.station_name }))
        .sort((a, b) => a.travel_min - b.travel_min),
    otherById: (id) => state.stationsById.get(id),
    baseIcon: (entity, selected) => settlementIcon(entity, selected),
    // ליישוב יש שם משלו על הנקודה, ולכן renderEntityLabels מדלג עליו.
    // הערך כאן קיים כדי שכל מצב יענה על אותה שאלה.
    pinExtent: () => 13,
    // ביישובים הצד השני הוא תחנה — ולכן הוא נצבע לפי אחוז האיוש, בדיוק
    // כמו בטאב התחנות. זה מה שהופך את המסך ל"מפת חום" ולא לרשימת מרחקים.
    nearbyMarkers: (rel, other) => [stationMarkerFor(other, rel), labelMarker(null, rel.travel_min)],
    lineColor: (entity, other) => other.color,
    listTitle: "תחנות",
    itemsAreStations: true,
    head: (entity) => `<strong>${escapeHtml(entity.name)}</strong>`,
    // יישוב בלי תחנה בטווח אינו "אין נתונים": הוא מקבל את היישוב המקושר
    // הקרוב אליו, כדי שהתשובה תהיה משהו שאפשר לפעול לפיו.
    grid: (entity, nearby) =>
      `<div><span>תחנות עד 30 דק'</span><b>${nearby.length}</b></div>
       <div><span>הקרובה ביותר</span><b>${
         nearby.length ? `${nearby[0].travel_min} דק'` : "—"
       }</b></div>` +
      (nearby.length ? "" : outOfRangeInfo(entity)),
    // ביישוב הפילוח הוא סיכום התחנות שמגייסות ממנו, כלומר תמונת הגיוס של
    // אותו יישוב — ולא נתון של היישוב עצמו.
    // §17.1 + §17.3: הפילוח כאן הוא **סכום התחנות שבטווח**, ולכן חייב
    // להיות אפשר לפתוח אותו ולראות מאיזו תחנה כל חלק מגיע — הרשימה
    // שנפתחת מסתכמת בדיוק למספר שעל השבב.
    //
    // וכשנבחרה תחנה מסוימת (לחיצה על שורה ברשימה או על סיכה במפה),
    // הפילוח מתחלף לפילוח **של אותה תחנה בלבד**: מי שלחץ על יפו שואל
    // על יפו, ולא על ממוצע חמש התחנות שבטווח.
    breakdown: (entity, nearby) => {
      const picked = state.drawerStationId
        ? state.stationsById.get(state.drawerStationId)
        : null;
      if (picked) {
        return (
          demographics(picked) +
          familyChips(`חוסר לפי תפקיד — ${picked.name}`, missingItems(picked), "occupations") +
          familyChips(`מועמדים בהליך — ${picked.name}`, candidateItems(picked), "") +
          `<button class="picker-back" id="back-to-all">‹ כל התחנות בטווח</button>`
        );
      }
      const stations = nearby.map((rel) => state.stationsById.get(rel.otherId)).filter(Boolean);
      return (
        familyChips(
          "חוסר לפי תפקיד בתחנות שבטווח",
          sumFamilies(stations, missingItems),
          "missing-by-station"
        ) +
        familyChips(
          "מועמדים בהליך בתחנות שבטווח",
          sumFamilies(stations, candidateItems),
          "candidates-by-station"
        )
      );
    },
    suggestionMeta: () => "",
    suggestionTrailing: (e) =>
      e.nearby_stations
        ? `<span class="sugg-pct">${e.nearby_stations} תחנות</span>`
        : `<span class="sugg-pct muted">אין תחנה בטווח</span>`,
  },
};

const mode = () => MODES[state.mode];

// §26: מה שהחיפוש רואה. ברוב המסכים זהה למה שמצויר, וביישובים רחב ממנו:
// המפה מציגה 77 והמאגר מכיר 1,242. מסך שמחפש רק במה שהוא מצייר עונה
// "לא נמצא" על מה שקיים.
const searchBase = () => (mode().searchBase || mode().base)();

/* --- עזר ----------------------------------------------------------------- */

const api = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};

const el = (id) => document.getElementById(id);
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/* --- תוויות תאים לתצוגת נייד ---------------------------------------------
   בטלפון כל שורת טבלה נפרשת לכרטיס "תווית: ערך" (ראו style.css). התווית
   נלקחת מכותרת העמודה שמעל התא ונכתבת ל-data-th.

   למה אוטומטית ולא בתבניות השורה: יש כאן עשרות טבלאות ומאות תאים, ותווית
   שנכתבת ביד ליד כל <td> יוצאת מסנכרון ברגע שמישהו מזיז עמודה — וזו תקלה
   שקטה, כי בדסקטופ שום דבר לא נשבר והיא נראית רק בטלפון. כאן מקור התווית
   הוא ה-thead עצמו, ולכן עמודה שזזה גוררת את התווית איתה.

   טבלאות עם כותרת מקוננת (rowspan/colspan) או עשר עמודות של נתוני גלם
   מסומנות .table--wide ונשארות בגלילה אופקית — פרישה לכרטיס של עשרה שדות
   ארוכה מדי מכדי לקרוא. */
function labelTableCells(table) {
  if (!table) return;
  // §34: הטבלאות הרחבות **אינן מוחרגות יותר.** הן הוחרגו כשהן נשארו
  // בגלילה אופקית בנייד ולא נפרשו לכרטיסים; מ-§31 הן נפרשות, ובלי
  // התיוג הכרטיס שלהן הציג ערכים בלי לומר מה כל אחד מהם.
  const headRows = table.querySelectorAll("thead tr");
  if (headRows.length !== 1) return; // כותרת מקוננת — לא ניתן למפות 1:1
  const heads = [...headRows[0].children].map((th) => th.textContent.trim());
  if (!heads.length) return;

  table.querySelectorAll("tbody tr").forEach((tr) => {
    // שורת "אין תוצאות" היא תא יחיד שפרוש על כל הרוחב — היא לא שדה בכרטיס.
    if (tr.querySelector("td[colspan]")) return;
    [...tr.children].forEach((td, i) => {
      if (heads[i]) td.setAttribute("data-th", heads[i]);
      else td.removeAttribute("data-th");
    });
  });
}

// כל טבלה מתמלאת ב-innerHTML מנקודות שונות בקוד. במקום לרדוף אחרי כל
// נקודת רינדור, מאזינים לשינוי בגוף הטבלה ומתייגים מחדש. השינוי הוא
// תכונות על ה-td, ולא childList על ה-tbody, ולכן אין לולאה.
function watchTableLabels() {
  const observer = new MutationObserver((records) => {
    const tables = new Set();
    records.forEach((r) => {
      const table = r.target.closest && r.target.closest("table.table");
      if (table) tables.add(table);
    });
    tables.forEach(labelTableCells);
  });
  document.querySelectorAll("table.table").forEach((table) => {
    labelTableCells(table);
    observer.observe(table, { childList: true, subtree: true });
  });
}

// היקף המשרה — 100% למשרה מלאה, 50% לחצי. משרה חלקית מסומנת, כי זו
// בדיוק הנקודה: "משרה פנויה" של חצי משרה אינה אותה משימת גיוס.
const scopeText = (pct) =>
  pct === null || pct === undefined
    ? '<span class="muted">—</span>'
    : pct === 100
      ? "100%"
      : `<strong class="scope-part">${pct}%</strong>`;

const pctText = (s) => (s.staffing_pct === null ? "—" : `${Math.round(s.staffing_pct)}%`);
const pctFull = (s) => (s.staffing_pct === null ? "—" : `${s.staffing_pct.toFixed(1)}%`);
const missingText = (s) =>
  s.missing_positions === null ? '<span class="muted">אין נתוני תקן</span>' : s.missing_positions;

// מועמדים בהליך: null/undefined = "אין נתון" (טרם נטען קובץ מועמדים, או שהתחנה
// לא הופיעה בו) — שונה מ-0 = "אין מועמדים כרגע". אפס אמיתי מוצג כמספר.
const candidatesText = (s) =>
  s.candidates_in_process === null || s.candidates_in_process === undefined
    ? '<span class="muted">אין נתון</span>'
    : s.candidates_in_process;

// --- משרות: מספר אחד על הכרטיס, ושורה אחת שמסבירה אותו -------------------
//
// §40: **המסך הציג שלושה מספרים שונים תחת המילה "משרות", ואף אחד מהם לא
// היה מה שהמגייס מקבל לטפל בו.** בשדרות: 38 בחלונית הריחוף (משרות
// בתפקיד סייר), 7 "תקנים חסרים", 4 בסכום שבבי החוסר — בזמן שלוח המשרות
// מציג 2. ארבעה מספרים, שאלה אחת.
//
// מעכשיו יש **מספר אחד** שנקרא "משרות לגיוס", והוא בדיוק מה שלוח המשרות
// מציג — אותו כלל, אותו מקור (ראה _station_vacancies ב-app.py).
//
// חוסר תקן לא נעלם: הוא נשאר "תקנים חסרים" ובשבבי הפילוח, בשמו. הוא
// שאלה אחרת — כמה תקן ריק — ולא כמה משרות אפשר לאייש.
//
// **`vacantCountText` ולא `vacantText`** — השם השני כבר תפוס בקובץ הזה
// (אחוז הפנוי במשרה בטבלת לוח המשרות, §38). שתי הצהרות באותו שם ברמה
// העליונה הן SyntaxError, וקובץ שאינו נטען כלל נראה כמו "המפה לא עולה
// ואי אפשר לעבור בין המסכים" — בלי שום רמז שמדובר בשורה אחת.
const vacantCountText = (s) =>
  s.vacant_positions === null || s.vacant_positions === undefined
    ? '<span class="muted">אין נתון</span>'
    : s.vacant_positions;

// שורת ההסבר. מוצגת **רק כשיש מה להסביר** — כלומר כשיש פער בין המשרות
// שמצבן "פנויה" לבין אלה שמסומנות לתכנון גיוס. בלי פער היא רעש.
//
// §43: **הפך מריבוע קבוע על הכרטיס לריחוף על השדה עצמו.** הוא תפס שלוש
// שורות בכל כרטיס תחנה, בזמן שהוא עונה על שאלה שנשאלת פעם אחת. עכשיו
// הוא ה-title של "תקנים חסרים" — מי שרוצה לדעת למה 21 ולא 23, מרחף.
function vacancyTip(entity) {
  const open = entity && entity.open_positions;
  const vacant = entity && entity.vacant_positions;
  if (open === null || open === undefined || vacant === null || vacant === undefined) return "";
  if (!open || open === vacant) return "";
  return escapeHtml(
    `${open} משרות במצב "פנויה", ומתוכן ${vacant} מסומנות "משרה פנויה לתכנון גיוס" — ` +
      `רק הן משימת גיוס, ורק הן מופיעות בלוח המשרות.`
  );
}

// --- פילוח לפי משפחת תפקיד (סייר · בלש · חוקר · אחר) ----------------------
//
// שני הפילוחים שהמפה מציגה — כמה *חסר* וכמה *בהליך* — נבנים מאותה פונקציה
// ובאותו סדר, כדי שאפשר יהיה לקרוא אותם זה מול זה. הכל נשען על r.key, ולכן
// שינוי בסדר או בתוויות לא יכול לשדך משפחה לשגוי.

// שדה שלא נטען הוא null ולא 0. צ'יפ בלי נתון מציג "—", וכשלכל המשפחות אין
// נתון לא מוצגת המחיצה בכלל — ארבעה מקפים אינם מידע.
//
// `kind` נכתב על כל שבב כדי שהריחוף ידע מה להציג: בחוסר — הפילוח לפי תחנה
// או אילו עיסוקים נכללים בקטגוריה; במועמדים — הפילוח לפי תחנה.
//
// §41: הפרמטר `extras` — שבבי "למחיקה" ו"עודף" — **הוסר.** הם
// נולדו כדי שסכום השבבים ישתווה ל"תקנים חסרים", אבל המחיר
// היה שני שבבים שאינם תפקיד ואין מה לעשות איתם — ו"למחיקה" בפרט
// נקרא כמו קטגוריית גיוס. הפילוח מראה עכשיו **תפקידים בלבד**,
// והוא אינו מתיימר להסתכם למספר אחר שעל הכרטיס.
function familyChips(title, items, kind) {
  if (!Array.isArray(items) || !items.length) return "";
  if (items.every((i) => i.value === null || i.value === undefined)) return "";
  // `chip--hover` נוסף **רק כשיש מה לפתוח**. סימן ריחוף על שבב שאינו
  // פותח דבר הוא הבטחה שלא נענית — במסך היישובים, למשל, הפילוח הוא סכום
  // של כמה תחנות ואין לו היקף אחד לשאול עליו.
  const chips = items.map(
    (i) =>
      `<span class="chip${kind ? " chip--hover" : ""}" data-role="${escapeHtml(
        i.key
      )}" data-kind="${kind || ""}">${escapeHtml(i.label)}<b>${
        i.value === null || i.value === undefined ? "—" : i.value
      }</b></span>`
  );
  return `<div class="unit-section">
      <span class="unit-section-title">${escapeHtml(title)}</span>
      <div class="chips">${chips.join("")}</div>
    </div>`;
}

const missingItems = (station) =>
  (station.roles || []).map((r) => ({ key: r.key, label: r.label, value: r.missing }));
const candidateItems = (station) =>
  (station.candidates_by_role || []).map((r) => ({ key: r.key, label: r.label, value: r.count }));

// חוסר ומועמדים של תחנה אחת — הצירוף שמוצג גם בכרטיס התחנה במפה וגם
// בחלונית שנפתחת כשבוחרים תחנה דרך יישוב. אותה תחנה, אותו מידע, שני מסלולים.
// יישוב שאין לו תחנה עד הסף. במקום "אין נתונים" — מה כן קיים: שתי
// התחנות הקרובות ביותר עם המרחק והזמן, וגם היישוב המקושר הקרוב.
// "אין תחנה עד 30 דקות" בלי זה הוא מידע חסר.
function outOfRangeInfo(entity) {
  const nearest = (entity.nearest || [])
    .map(
      (s) => `<li><span>${escapeHtml(s.name)}</span><b>${s.travel_min} דק' · ${
        s.distance_km
      } ק"מ</b></li>`
    )
    .join("");
  const anchor = entity.anchor
    ? `<div class="out-anchor">היישוב המקושר הקרוב: ${escapeHtml(
        entity.anchor.name
      )} — ${entity.anchor.distance_km} ק"מ</div>`
    : "";
  if (!nearest && !anchor) return "";
  return `<div class="out-of-range">
      <div class="out-title">אין תחנה עד ${state.nearbyMinutes} דקות</div>
      ${nearest ? `<div class="out-sub">התחנות הקרובות ביותר:</div><ul class="out-list">${nearest}</ul>` : ""}
      ${anchor}
    </div>`;
}

/* --- חלונית הריחוף על שבב תפקיד ------------------------------------------
 *
 * שבב אחד, שלוש שאלות שונות — לפי היכן הוא יושב:
 *
 *   occupations         (תחנה)  אילו סיווגי תפקיד בכלל נספרים ב"סייר"
 *   missing-by-station  (מרחב)  איפה החוסר יושב — "חסרים 85 סיירים במרחב"
 *                               אינו משימה, וארבע התחנות שהם בהן כן
 *   candidates-by-*     (מרחב)  אותו דבר למועמדים בהליך
 *
 * בכולן מוצג גם פילוח האיוש של אותו תפקיד (יהודים/גברים), כי זו שאלה
 * שנשאלת על אותו שבב בדיוק.
 *
 * ריחוף ולא לחיצה: זו הצצה, לא ניווט. לחיצה הייתה מחליפה מסך ומאבדת את
 * ההקשר שממנו הגיעו.
 */

let chipPopoverEl = null;

function chipPopover() {
  if (!chipPopoverEl) {
    chipPopoverEl = document.createElement("div");
    chipPopoverEl.className = "chip-pop";
    chipPopoverEl.hidden = true;
    document.body.appendChild(chipPopoverEl);
  }
  return chipPopoverEl;
}

function hideChipPopover() {
  chipPopover().hidden = true;
}

// §14.1: ההיקף של הרשימה — הישות שנבחרה במפה, ולא התמונה הארצית.
// מי שפתח את תחנת אשדוד ומרחף על "סייר" שואל מה נספר *באשדוד*.
//
// מרחב מזוהה לפי `station_ids` (יש לו תחנות), יחידה לפי `kind`, וכל השאר
// הוא תחנה. אין כאן דגל מפורש בכוונה: הצורה של הישות כבר אומרת מה היא,
// ודגל נוסף היה עוד מקום שאפשר לשכוח לעדכן.
function roleScope(entity) {
  if (!entity) return { key: "", params: "", label: "" };
  if (entity.kind === "unit") {
    return {
      key: `unit:${entity.name}`,
      params: `unit=${encodeURIComponent(entity.name)}`,
      label: entity.name,
    };
  }
  if (Array.isArray(entity.station_ids)) {
    return {
      key: `area:${entity.name}`,
      params: `area=${encodeURIComponent(entity.name)}`,
      label: `מרחב ${entity.name}`,
    };
  }
  return {
    key: `station:${entity.id}`,
    params: `station_id=${entity.id}`,
    label: entity.name,
  };
}

// נטען פעם אחת **לכל היקף** ונשמר במטמון: הריחוף חוזר על עצמו, ושאילתה
// בכל ריחוף הייתה מהבהבת. עד שהתשובה מגיעה החלונית אומרת "טוען", ולא
// מציגה רשימה ריקה שנקראת כמו "אין כלום".
async function loadRoleOccupations(scope) {
  if (state.roleOccupations.has(scope.key)) return state.roleOccupations.get(scope.key);
  try {
    const data = await api(`/api/role-occupations?${scope.params}`);
    state.roleOccupations.set(scope.key, data);
  } catch (err) {
    state.roleOccupations.set(scope.key, {});
  }
  return state.roleOccupations.get(scope.key);
}

const popRow = (label, value) =>
  `<li><span>${escapeHtml(label)}</span><b>${value}</b></li>`;

// §17.1: התחנות שהמספר על השבב מורכב מהן.
//
//   מרחב / יחידה — התחנות שבו (`station_ids`)
//   יישוב        — התחנות שבטווח, בדיוק אותה רשימה שהסכום חושב ממנה
//
// בלי הענף השני, הריחוף במסך היישובים היה פותח רשימה ריקה: ליישוב אין
// `station_ids`, והמספר שלו כן מורכב מתחנות.
function scopeStations(entity) {
  if (!entity) return [];
  if (Array.isArray(entity.station_ids) && entity.station_ids.length) {
    return entity.station_ids.map((id) => state.stationsById.get(id)).filter(Boolean);
  }
  if (state.mode === "settlements") {
    return state.relations
      .filter((r) => r.settlement_id === entity.id && r.within_nearby)
      .map((r) => state.stationsById.get(r.station_id))
      .filter(Boolean);
  }
  return [];
}

function chipPopoverContent(kind, roleKey, entity) {
  const role = (entity.roles || []).find((r) => r.key === roleKey);
  const label = role ? role.label : roleKey;

  // §41: **רשימה, ותו לא.**
  //
  // החלונית הזו צברה שש שכבות טקסט מסביב לרשימה: שורת סיכום, "ועוד N
  // תיאורי עיסוק", "N תיאורי עיסוק נוספים מאוישים במלואם", שורת סיווג,
  // ופילוח מגדר ודת. מי שמרחף על "סייר 3" רוצה לדעת **אילו שלושה**, וכל
  // היתר הוא קריאה שהוא לא ביקש.
  //
  // מה שנשאר: כותרת של שתי מילים, ושורה לכל עיסוק שחסר בו — השם והמספר.
  // הרשימה מסתכמת למספר שעל השבב, וזו כל העבודה שלה.
  if (kind === "occupations") {
    const scope = roleScope(entity);
    const family = (state.roleOccupations.get(scope.key) || {})[roleKey];
    const title = `${escapeHtml(label)} — ${escapeHtml(scope.label)}`;
    if (!family)
      return `<div class="chip-pop-title">${title}</div>
        <div class="chip-pop-empty">טוען…</div>`;
    const hasTarget = family.target !== null && family.target !== undefined;
    // רק העיסוקים שיש בהם חוסר. עיסוק מאויש במלואו אינו "סוג שחסר",
    // והוא היה מאריך את הרשימה בלי לענות על השאלה שנשאלה.
    const withGap = hasTarget ? family.items.filter((i) => i.missing) : family.items;
    if (!withGap.length) {
      return `<div class="chip-pop-title">${title}</div>
        <div class="chip-pop-empty">אין חוסר בתפקיד הזה</div>`;
    }
    // **בלי חיתוך.** "ועוד 4 תיאורי עיסוק" הוא בדיוק המידע שהרשימה
    // נפתחה בשבילו, והסתרתו מאחורי מספר הפכה אותה לחצי תשובה.
    return `
      <div class="chip-pop-title">${title}</div>
      <ul class="chip-pop-list">${withGap
        .map((i) => popRow(i.name, hasTarget ? i.missing : i.vacant || 0))
        .join("")}</ul>`;
  }

  if (kind === "missing-by-station" || kind === "candidates-by-station") {
    const isMissing = kind === "missing-by-station";
    // §17.1: כל התחנות שהמספר על השבב מורכב מהן — במרחב אלה התחנות שבו,
    // וביישוב אלה התחנות שבטווח. **אותו מקור בדיוק** שממנו חושב הסכום,
    // אחרת הרשימה והמספר אינם מדברים על אותו דבר.
    const rows = scopeStations(entity)
      .map((s) => {
        const list = isMissing ? s.roles : s.candidates_by_role;
        const found = (list || []).find((r) => r.key === roleKey);
        return { name: s.name, value: found ? (isMissing ? found.missing : found.count) : null };
      })
      // §17.1: **כל ערך שאינו אפס, כולל שלילי.** תחנה שהאיוש בה גדול
      // מהתקן מקזזת את החוסר של השכנות שלה, והמספר על השבב כבר מכיל את
      // הקיזוז הזה. סינון השליליות היה מציג רשימה שסכומה גדול מהשבב —
      // בדיוק אי-ההתאמה שדווחה (מרחב עם שבב 3 ורשימה שמסתכמת ל-5).
      .filter((row) => row.value !== null && row.value !== undefined && row.value !== 0)
      .sort((a, b) => b.value - a.value);

    const title = isMissing
      ? `חוסר ב"${escapeHtml(label)}" לפי תחנה`
      : `מועמדים ב"${escapeHtml(label)}" לפי תחנה`;
    if (!rows.length) {
      return `<div class="chip-pop-title">${title}</div>
        <div class="chip-pop-empty">${
          isMissing ? "אין חוסר בתפקיד הזה באף תחנה" : "אין מועמדים משויכים לתחנה"
        }</div>`;
    }
    // §41: **רשימה בלבד, כמו בחלונית העיסוקים.** שורת הסיכום והערת
    // העודף ירדו — מי שמרחף רוצה לדעת באילו תחנות, לא לקרוא הסבר.
    return `<div class="chip-pop-title">${title}</div>
      <ul class="chip-pop-list">${rows
        .map((row) =>
          popRow(
            row.name,
            row.value < 0
              ? `<span class="pop-surplus">עודף ${Math.abs(row.value)}</span>`
              : row.value
          )
        )
        .join("")}</ul>`;
  }

  if (kind === "candidates-no-stations") {
    return `<div class="chip-pop-title">${escapeHtml(label)} — אין פילוח לפי תחנה</div>
      <div class="chip-pop-empty">
        המספר מגיע משדה "דרישה" בקובץ המועמדים, שמוסר מחוז או מרחב ולא תחנה.
        ברגע שעמודת "תחנה" תתמלא — הפילוח ייפתח כאן.
      </div>`;
  }

  // §41: היה `return demo` — משתנה שנמחק כאן. kind שאינו מוכר אינו
  // חלונית ריקה אלא ReferenceError ששובר את הריחוף כולו.
  return "";
}

// ממקם את החלונית מתחת לשבב, ומחזיר אותה פנימה כשהיא חורגת מהמסך.
function placeChipPopover(chip) {
  const pop = chipPopover();
  const box = chip.getBoundingClientRect();
  pop.hidden = false;
  const width = pop.offsetWidth;
  let left = box.left + box.width / 2 - width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  let top = box.bottom + 8;
  if (top + pop.offsetHeight > window.innerHeight - 8) {
    top = Math.max(8, box.top - pop.offsetHeight - 8);
  }
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${top + window.scrollY}px`;
}

/**
 * מפעיל את חלונית הריחוף על כל השבבים שבתוך `container`, בהקשר של `entity`.
 * נקרא מחדש בכל רינדור — האלמנטים נבנים מאפס בכל פעם.
 */
// §16.9: **במסך מגע אין ריחוף.** בטלפון כל הפילוח הזה — מה נכלל ב"סייר",
// החוסר לפי תחנה, ושורת הסיכום — היה בלתי נגיש לחלוטין: אין אירוע
// mouseenter, ולחיצה לא עשתה דבר. ולכן במגע החלונית נפתחת בלחיצה
// ונסגרת בלחיצה הבאה או בלחיצה מחוצה לה.
const IS_TOUCH = window.matchMedia("(hover: none)").matches;

function attachChipHovers(container, entity) {
  if (!container) return;
  container.querySelectorAll(".chip--hover").forEach((chip) => {
    const kind = chip.dataset.kind;
    if (!kind) return;

    const open = async () => {
      if (kind === "occupations") await loadRoleOccupations(roleScope(entity));
      chipPopover().innerHTML = chipPopoverContent(kind, chip.dataset.role, entity);
      placeChipPopover(chip);
    };

    if (IS_TOUCH) {
      chip.onclick = async (event) => {
        event.stopPropagation(); // אחרת הסגירה הגלובלית מבטלת את הפתיחה
        const same = chipPopover().dataset.chip === chip.dataset.role + kind;
        if (same && !chipPopover().hidden) return hideChipPopover();
        chipPopover().dataset.chip = chip.dataset.role + kind;
        await open();
      };
      return;
    }

    chip.onmouseenter = async () => {
      if (kind === "occupations") await loadRoleOccupations(roleScope(entity));
      // הריחוף עשוי להסתיים בזמן הטעינה. בלי הבדיקה חלונית הייתה נפתחת
      // אחרי שהעכבר כבר עזב.
      if (!chip.matches(":hover")) return;
      chipPopover().innerHTML = chipPopoverContent(kind, chip.dataset.role, entity);
      placeChipPopover(chip);
    };
    chip.onmouseleave = hideChipPopover;
  });
}

// במגע: לחיצה בכל מקום אחר סוגרת. נרשם פעם אחת, ולא בכל בנייה של כרטיס.
if (IS_TOUCH) {
  document.addEventListener("click", () => hideChipPopover());
}

function familyBreakdown(station) {
  return (
    familyChips("חוסר לפי תפקיד", missingItems(station), "occupations") +
    familyChips("מועמדים בהליך לפי תפקיד", candidateItems(station), "")
  );
}

// סיכום על פני כמה תחנות (התחנות שמגייסות מיישוב נבחר). null נשמר כ"אין
// נתון": תחנה בלי נתוני תקן לא נספרת כאפס, אחרת היישוב נראה מאויש יותר
// ממה שהוא באמת.
function sumFamilies(stations, toItems) {
  const totals = new Map();
  stations.forEach((station) => {
    toItems(station).forEach((item) => {
      const current = totals.get(item.key) || { key: item.key, label: item.label, value: null };
      if (item.value !== null && item.value !== undefined) {
        current.value = (current.value || 0) + item.value;
      }
      totals.set(item.key, current);
    });
  });
  return [...totals.values()];
}

function setHealth(stateName, text) {
  const box = el("health");
  box.className = `health health--${stateName}`;
  box.querySelector(".health-text").textContent = text;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* --- סיכות --------------------------------------------------------------- */

// גודל הסיכה נגזר מהזום: תחנות ת"א יושבות 2-4 ק"מ זו מזו, וסיכה בגודל קבוע
// שנקראת יפה בזום 13 מכסה את שכנותיה בזום 11.
function pinSize(selected) {
  const zoom = state.map ? state.map.getZoom() : 12;
  const base = zoom <= 10 ? 24 : zoom === 11 ? 30 : zoom === 12 ? 36 : 42;
  return selected ? base + 8 : base;
}

// סיכת תחנה: עיגול בצבע הסטטוס עם אחוז האיוש עליו. divIcon ולא תמונה, כדי
// שהצבע יגיע מהשרת ולא נצטרך קבצי PNG שיכולים לצאת מסנכרון עם colors.py.
function stationIcon(station, selected) {
  const size = pinSize(selected);
  return L.divIcon({
    className: "",
    html: `<div class="pin ${selected ? "pin--selected" : ""}"
                style="background:${station.color}; width:${size}px; height:${size}px;
                       font-size:${Math.max(9, Math.round(size * 0.31))}px">
             ${size >= 30 ? pctText(station) : ""}
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function regionPinSize(selected) {
  return selected ? 52 : 44;
}

// סמן מרחב: מרובע ולא עגול, וגדול מסיכת תחנה. מרחב הוא צירוף של תחנות
// ולא מקום — הסיכה יושבת במרכז הכובד שלהן, לא בכתובת. צורה אחרת אומרת
// את זה בלי להסביר, ומונעת מהמשתמש לחשוב שהוא רואה תחנה.
//
// §27: **השם ירד מתוך הסיכה.** הוא היה נחתך ל-9px בתוך ריבוע של 44
// פיקסלים, כלומר כשישה תווים ואז שלוש נקודות — "מרחב אילת ד…". שם קטוע
// אינו שם. הוא עבר לתווית חיצונית שנקראת, ומופיעה רק כשיש לה מקום —
// ראה renderEntityLabels.
function regionIcon(region, selected) {
  const size = regionPinSize(selected);
  return L.divIcon({
    className: "",
    html: `<div class="region-pin ${selected ? "region-pin--selected" : ""}"
                style="background:${region.color}; width:${size}px; height:${size}px">
             <span class="region-pin-pct">${pctText(region)}</span>
           </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// 15 הערים הגדולות בישראל. השם שלהן מוצג תמיד — הן נקודות ההתמצאות של
// המפה, ובלעדיהן מפה של 1,386 נקודות ריקות אינה ניתנת לקריאה.
// §19.1: הרשימה הזו כבר אינה מסננת דבר — היא נשמרת רק כתיעוד של מה
// שהיה. הסינון עבר לרשימת יישובי המיקוד (77 יישובים שנמסרו), והיא
// **מלאה כולה** על המפה.
const MAJOR_CITIES = new Set([
  "ירושלים", "תל אביב", "חיפה", "ראשון לציון", "פתח תקווה",
  "אשדוד", "נתניה", "באר שבע", "בני ברק", "חולון",
  "רמת גן", "רחובות", "אשקלון", "בת ים", "בית שמש",
]);

// §19.1: **כל יישובי המיקוד מקבלים נקודה ותווית.** קודם הוצגו 15 ערים
// מרשימה קבועה בלבד, ושאר היישובים היו סמנים בלתי נראים — כך שמפת חום
// היישובים נפתחה כמעט ריקה, למרות ש-77 יישובים כן היו בה.
//
// זה נכון לעשות רק כי מה שמצויר הצטמצם ל-77: 1,386 תוויות בו-זמנית
// הופכות את המפה לקיר טקסט. הרשימה היא שהופכת את הכול לקריא.
//
// גם 15 הערים הגדולות, שמוצגות מלכתחילה, מוצגות **כשם בלבד** בלי עיגול —
// הן משמשות להתמצאות, ונקודה שחורה לצידן מתחרה בסיכות התחנות. רק היישוב
// שנבחר מקבל סמן מלא, כי הוא מה שהמשתמש מחפש.
function settlementIcon(settlement, selected) {
  // יישוב שאינו במיקוד ואינו נבחר — סמן בלי ציור. הוא עדיין לוכד לחיצה,
  // אבל אינו מכסה את המפה.
  if (!selected && !settlement.focus) {
    return L.divIcon({ className: "", html: "", iconSize: [0, 0] });
  }
  // §37: **נקודה, והשם מגיע מהתווית.** קודם היישוב היה שם בלבד, ושבעים
  // ושבעה שמות במבט הארצי נערמו זה על זה — מפה שאי אפשר לקרוא בה אף שם
  // גרועה ממפה עם פחות שמות. עכשיו הנקודה תמיד על המפה (היא המיקום, והיא
  // מה שנלחץ), והשם עובר דרך אותה בדיקת חפיפה כמו שמות התחנות: ככל
  // שמגדילים, נכנסים עוד שמות.
  const classes = selected ? "dot dot--selected" : "dot dot--place";
  return L.divIcon({
    className: "",
    html: `<div class="${classes}" title="${escapeHtml(settlement.name)}"></div>`,
    iconSize: [null, 20],
    iconAnchor: [7, 10],
  });
}

// תווית צפה: שם ו/או זמן נסיעה. משמשת את שני המצבים.
function labelMarker(name, travelMin) {
  return (latlng) =>
    L.marker(latlng, {
      icon: L.divIcon({
        className: "",
        html: `<div class="settlement-pin">
                 ${name ? `<span class="settlement-name">${escapeHtml(name)}</span>` : ""}
                 <span class="settlement-time">${travelMin}′</span>
               </div>`,
        iconSize: [null, 22],
        iconAnchor: name ? [0, 11] : [-14, 22],
      }),
      title: `${name || ""} ${travelMin} דקות`.trim(),
      // תחנה ועיר שנקראות באותו שם יושבות כמעט באותה נקודה (תחנת גבעתיים /
      // גבעתיים), ואז התווית נוחתת על הסיכה ומסתירה את אחוז האיוש — הנתון
      // שכל המסך קיים בשבילו. הסיכות תמיד מעל.
      zIndexOffset: -1000,
    });
}

// תחנה קרובה בטאב היישובים: נלחצת ופותחת את חלונית המידע שלה.
function stationMarkerFor(station, rel) {
  return (latlng) => {
    const marker = L.marker(latlng, { icon: stationIcon(station, false), title: station.name });
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      openDrawer(station, rel);
    });
    // נרשמת לרענון בזום: היא נוצרת לפני שהמפה ממקדת, ובלי זה היא נשארת
    // בגודל של הזום הקודם — קטנה מכדי להציג את אחוז האיוש, שהוא כל הנקודה.
    state.nearbyStationMarkers.push({ marker, station });
    return marker;
  };
}

/* --- מפה ----------------------------------------------------------------- */

async function initMap() {
  // רקע האופליין מוצג רק אם החבילה קיימת בפועל. רקע שמופיע בבורר ומראה
  // ריבועים ריקים גרוע מרקע שלא מופיע.
  let tiles = { available: false, zooms: [] };
  try {
    tiles = await api("/api/tiles-available");
  } catch (err) {
    // אין סיבה להפיל את המפה בגלל זה
  }

  state.map = L.map("map", {
    zoomControl: true,
    // §21.4: אין קרדיט כלל. הרקע מצויר מקובץ שיושב במאגר, אין לאיש מה
    // לייחס, וקרדיט Leaflet כלל קישור חיצוני ל-leafletjs.com — הכתובת
    // האחרונה שנותרה בקוד המוגש. שורה ריקה עדיפה על שורה שמזמינה שאלה.
    attributionControl: false,
    maxBounds: ISRAEL_BOUNDS,
    // 1.0 = הגבול קשיח. ערך נמוך יותר מאפשר "למתוח" את המפה החוצה ולחזור
    // בקפיצה — אפקט שנראה כמו תקלה, לא כמו גבול מכוון.
    maxBoundsViscosity: 1.0,
    minZoom: MIN_ZOOM,
  }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

  // §21.3: **המפה היא שלנו. אין מקור חיצוני, גם לא מוקפא.**
  //
  // §18.1 הסיר את הרקעים המקוונים והשאיר חבילת אריחים מקומית — אבל
  // האריחים עצמם הם דימוי של ספק חיצוני שנשמר על הדיסק. הם עובדים בלי
  // אינטרנט, ועדיין אינם שלנו: אי אפשר לתקן בהם דבר, אי אפשר לפרסם
  // אותם, והם 500MB.
  //
  // הרקע עכשיו הוא מתאר שאנחנו מציירים מקובץ GeoJSON בן 3KB שיושב
  // במאגר: קו החוף, הגבולות, הכנרת וים המלח. אין בו רחובות — וזה מה
  // שהתבקש. במבט הפתיחה הוא נראה כמו מפה, ובהגדלה ניכר שאין בו שבילים.
  //
  // שכבת האריחים אינה נטענת יותר. tools/download_tiles.py והחבילה
  // נשארו במאגר למי שירצה מפת רחובות בהתקנה מסוימת, אבל הן אינן חלק
  // מברירת המחדל ואינן נדרשות כדי שהמערכת תעבוד.
  // §43: **מתאר "ארץ ישראל" המקורי הוסר — הוא היה המפה השנייה.**
  //
  // הרקע צויר מ-israel.geojson (קו חוף, גבולות, הכנרת וים המלח), ומעליו
  // ישבו מצולעי המחוזות שנגזרו מהמפה הרשמית. שני מקורות, שני קווי חוף,
  // ואי-התאמה של כמה קילומטרים ביניהם — שנראית על המסך כמו שתי מפות
  // מוזזות זו על גבי זו. זה מה שהפריע, וזה מה שירד.
  //
  // **מצולעי המחוזות הם המפה עכשיו.** הם מכסים את כל שטח המדינה, הם
  // מגיעים ממקור אחד, ולכן אין יותר מה שלא יתאים.

  // §37: **גבולות המחוזות.**
  //
  // המחוז הוא הרמה שכל המסכים מסננים לפיה, והוא היה הדבר היחיד שלא נראה
  // על המפה: סיכה אדומה בלי גבול סביבה אומרת "כאן חסר", ולא "בשומרון
  // חסר". הגבולות נגזרו מהמפה הרשמית שנמסרה (tools/build_district_outline.py).
  //
  // **גוון ולא צבע.** לכל מחוז נשמר ההיגיון של המפה המקורית — צפון ירוק,
  // חוף כחול, דרום חול — אבל בשקיפות נמוכה: מפת חום שהרקע שלה צבעוני
  // כמו הסיכות אינה מפת חום. הקו הוא מה שנושא את הגבול, לא המילוי.
  try {
    const districts = await (await fetch("/web/vendor/police-districts.geojson")).json();
    state.districtLayer = L.geoJSON(districts, {
      pane: "tilePane",
      interactive: false,
      // §42: הסגנון תלוי-זום — ראו applyBoundaryZoom. כאן רק ערכי הפתיחה.
      style: (feature) => ({
        color: "#8794a8",
        weight: 1.4,
        dashArray: "5 4",
        fillColor: DISTRICT_TINT[feature.properties.name] || "#c9cfd8",
        fillOpacity: 0.3,
      }),
    }).addTo(state.map);
    state.districtLabels = districts.features
      .filter((feature) => feature.properties.label)
      .map((feature) => ({
        name: feature.properties.name,
        lat: feature.properties.label[1],
        lng: feature.properties.label[0],
      }));
  } catch (err) {
    // אין קובץ גבולות — המפה נשארת כשהייתה, בלי חצי גבול על המסך.
  }

  // §38: **וגם המרחבים.** המחוז לבדו גס מדי: "בצפון חסר" אינו מספיק
  // כשהצפון הוא חמישה מרחבים. הקו כאן דק ובהיר יותר מזה של המחוז ובלי
  // מילוי משלו — היררכיה שנקראת במבט אחד, ולא שתי רשתות שמתחרות זו בזו.
  try {
    const regions = await (await fetch("/web/vendor/police-regions.geojson")).json();
    state.regionLayer = L.geoJSON(regions, {
      pane: "tilePane",
      interactive: false,
      style: { color: "#9aa6b8", weight: 0.9, dashArray: "3 4", fill: false },
    }).addTo(state.map);
    // §42: במבט הרחב המרחבים אינם מוצגים כלל — ראו applyBoundaryZoom.
    state.map.removeLayer(state.regionLayer);
    state.regionLabels = regions.features
      .filter((feature) => feature.properties.label)
      .map((feature) => ({
        name: feature.properties.name,
        lat: feature.properties.label[1],
        lng: feature.properties.label[0],
      }));
  } catch (err) {
    // אין קובץ מרחבים — המחוזות לבדם עדיין נכונים.
  }

  // שמות המחוזות יושבים בשכבה משלהם, מתחת לסיכות ומעל הרקע. **לא**
  // zIndexOffset שלילי גדול: Leaflet גוזר את ה-z מקו הרוחב, וקיזוז של
  // אלף ומשהו הוציא חלק מהשמות ל-z שלילי — שם הם נעלמו מאחורי רקע המפה.
  // שכבה עם z קבוע אינה תלויה במיקום שבו התווית במקרה יושבת.
  state.map.createPane("districtLabels");
  state.map.getPane("districtLabels").style.zIndex = 450;
  state.map.getPane("districtLabels").style.pointerEvents = "none";

  state.districtLabelLayer = L.layerGroup().addTo(state.map);
  state.orientationLayer = L.layerGroup().addTo(state.map);
  state.baseLayer = L.layerGroup().addTo(state.map);
  state.labelLayer = L.layerGroup().addTo(state.map);
  state.nearbyLayer = L.layerGroup().addTo(state.map);

  // לחיצה על רקע המפה מנקה — אחרת אין דרך לחזור למבט הכללי בלי לרענן.
  state.map.on("click", () => selectEntity(null));
  state.map.on("zoomend", refreshBaseIcons);

  // בנייד גובה החלון משתנה בלי שהמשתמש עשה כלום: סרגל הכתובת נעלם בגלילה,
  // והמסך מסתובב. Leaflet לא שם לב מעצמו, ואז נשארת רצועה אפורה בלי אריחים
  // בדיוק בגודל השינוי. debounce קצר, כי resize נורה עשרות פעמים בשנייה.
  let resizeTimer = null;
  const onViewportChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.map) return;
      state.map.invalidateSize();
      refreshBaseIcons();
    }, 180);
  };
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);
}

// מבט הפתיחה נגזר מהנתונים ולא ממספרים קבועים: אם יתווסף מחוז או תזוז
// קואורדינטה, המפה עדיין תיפתח על מה שקיים.
function fitToBase() {
  const points = mode()
    .base()
    .filter((e) => e.lat !== null && e.lng !== null)
    .map((e) => [e.lat, e.lng]);
  if (!points.length) return;
  // padding בפיקסלים ולא pad() יחסי: היחסי הפיל את הזום דרגה שלמה, וברמה
  // הזו סיכות תחנות ת"א נדחסות זו על זו.
  //
  // animate:false קריטי ולא קוסמטי: fitBounds מנפיש את המעבר כברירת מחדל,
  // והאנימציה נשארת תלויה. כשנכנסים דרך קישור ישיר, הבחירה קופצת מיד לזום
  // של הישות — ואז האנימציה התלויה של fitBounds נוחתת ומושכת את המפה חזרה
  // למבט הכללי. התוצאה: הרצליה נבחרה, החלונית נכונה, והמפה הראתה את כל הארץ.
  state.map.fitBounds(L.latLngBounds(points), { padding: [45, 45], animate: false });

  // מאז שהמאגר הפך ארצי, ההתאמה לגבולות מציגה את כל המדינה — ובזום כזה
  // הסיכות נדחסות ואי אפשר לקרוא דבר. ההגדלה מקרבת למרכז הכובד, ששם
  // נמצא רוב המידע. מספר אחד לשינוי, לא פזור בקוד.
  //
  // בטלפון מוותרים עליה: שם המפה צרה ממילא, וההגדלה מוציאה מהמסך את
  // הקצוות (גליל, אילת) — לראות פחות תחנות גרוע מלראות אותן צפופות.
  const boost = window.innerWidth <= 768 ? 0 : DEFAULT_ZOOM_BOOST;
  const zoomed = Math.min(state.map.getZoom() + boost, MAX_DEFAULT_ZOOM);
  state.map.setView(state.map.getCenter(), zoomed, { animate: false });

  DEFAULT_VIEW.center = state.map.getCenter();
  DEFAULT_VIEW.zoom = state.map.getZoom();
}

// §26: 20 היישובים הגדולים כנקודות התמצאות במפת התחנות, המרחבים
// והיחידות. מפה של סיכות בלי שם עיר אחד היא כתם צבע: אפשר לראות שמשהו
// אדום, ואי אפשר לדעת איפה.
//
// **שם בלבד, בלי עיגול ובלי לחיצה.** הן רקע ולא ישות — נקודה לצידן
// מתחרה בסיכות התחנות, ולחיצה עליהן פותחת כרטיס של מה שלא נבחר.
//
// במפת היישובים הן אינן מצוירות כאן: שם הן ישויות אמיתיות שכבר מוצגות
// כיישובי מיקוד, וציור כפול היה מכפיל את השם.
// §37: **וגם הן נעלמות כשאין להן מקום.** במבט הארצי עשרים שמות ערים
// נופלים בדיוק על גוש דן, ששם צפופות גם התחנות — והתוצאה היא ערימת
// טקסט שאי אפשר לקרוא בה לא את העיר ולא את התחנה. עכשיו הן עוברות את
// אותה בדיקת חפיפה כמו שמות התחנות: מי שאין לה מקום יורדת, ובהגדלה היא
// חוזרת מעצמה. הגבולות והשמות של המחוזות נותנים את ההתמצאות במבט הרחב,
// ולכן אין כאן אובדן — יש חילוף.
function renderOrientationCities() {
  if (!state.orientationLayer) return;
  state.orientationLayer.clearLayers();
  state.cityBoxes = [];
  if (state.mode === "settlements") return;

  const point = (item) => state.map.latLngToContainerPoint([item.lat, item.lng]);
  // הסיכות תופסות את מקומן קודם: שם עיר שנוחת על סיכה מסתיר בדיוק את
  // הנתון שהמפה קיימת בשבילו.
  const taken = mode()
    .base()
    .filter((entity) => entity.lat !== null && entity.lng !== null)
    .map((entity) => {
      const p = point(entity);
      return squareBox(p.x, p.y, mode().pinExtent(entity, entity.id === state.selectedId));
    });

  state.settlements
    .filter((s) => s.major && s.lat !== null && s.lng !== null)
    // הגדולה קודמת: כשאין מקום לשתיים, העיר שמזוהה יותר היא זו שמועילה
    // להתמצאות. סדר קבוע גם מונע מפה שנראית אחרת בכל רענון.
    .sort((a, b) => (b.population || 0) - (a.population || 0) || a.name.localeCompare(b.name, "he"))
    .forEach((city) => {
      const p = point(city);
      const box = textBox(p.x, p.y, city.name, { align: "start" });
      if (taken.some((other) => boxesOverlap(box, other))) return;
      taken.push(box);
      state.cityBoxes.push(box);

      L.marker([city.lat, city.lng], {
        interactive: false,
        keyboard: false,
        // §27: מתחת לכל סיכה. סמנים ב-Leaflet מסודרים לפי קו רוחב ולא
        // לפי סדר ההוספה, ולכן סדר השכבות לבדו לא היה מספיק — עיר
        // צפונית הייתה יושבת מעל סיכת תחנה דרומית.
        zIndexOffset: -1000,
        icon: L.divIcon({
          className: "",
          html: `<div class="dot dot--city"><span>${escapeHtml(city.name)}</span></div>`,
          iconSize: [null, 18],
          iconAnchor: [7, 9],
        }),
      }).addTo(state.orientationLayer);
    });
}

/* --- §27: שמות על המפה, בלי שיעלו זה על זה ------------------------------- */
//
// הבעיה: 88 תחנות ו-236 יחידות, וסיכה בלי שם אומרת רק "כאן משהו אדום".
// השם בתוך הסיכה נחתך אחרי שישה תווים, ושם קטוע אינו שם.
//
// הפתרון: תווית חיצונית מודגשת, **ומי שאין לו מקום פשוט לא מקבל אותה**.
// לא הקטנת גופן ולא קיצור — שתיהן הופכות מפה עמוסה למפה עמוסה ובלתי
// קריאה. ככל שמגדילים, המרחק בפיקסלים בין הסיכות גדל, ועוד שמות נכנסים
// מעצמם. זה מה שהופך את הזום לכלי ולא רק לתצוגה.
//
// הבדיקה נעשית בפיקסלים של המסך ולא במעלות: חפיפה היא שאלה של מה שהעין
// רואה, והיא משתנה עם הזום בלבד — הזזה של המפה מזיזה את כולם יחד.
const LABEL_CHAR = 6.15;   // רוחב תו ממוצע ב-11px מודגש
const LABEL_HEIGHT = 15;
const LABEL_MAX = 150;     // רוחב מרבי; מעבר לו הטקסט נחתך ב-CSS
const LABEL_PAD = 3;       // מרווח נשימה, כדי ששתי תוויות לא ייגעו

function textBox(x, y, text, { align = "center" } = {}) {
  const width = Math.min(text.length * LABEL_CHAR + 12, LABEL_MAX);
  const left = align === "start" ? x - 7 : x - width / 2;
  return {
    left: left - LABEL_PAD,
    right: left + width + LABEL_PAD,
    top: y - LABEL_HEIGHT / 2 - LABEL_PAD,
    bottom: y + LABEL_HEIGHT / 2 + LABEL_PAD,
  };
}

function squareBox(x, y, size) {
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

const boxesOverlap = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// סדר הקדימות כשאין מקום לכולם: הנבחר תמיד, ואחריו הגדולים בתקן. מפה
// שמראה שם אקראי מבין שניים חופפים אינה עקבית — אותה מפה בשני רענונים
// הייתה נראית אחרת.
function labelPriority(a, b) {
  if (a.id === state.selectedId) return -1;
  if (b.id === state.selectedId) return 1;
  // §37: ביישובים אין תקן, והמידה המקבילה היא גודל היישוב. אותו כלל
  // בדיוק — מי שגדול יותר מקבל את המקום כשאין לשניים.
  const size = (entity) => entity.required_positions || entity.population || 0;
  return size(b) - size(a) || a.name.localeCompare(b.name, "he");
}

function renderEntityLabels() {
  if (!state.map || !state.labelLayer) return;
  state.labelLayer.clearLayers();

  const point = (entity) => state.map.latLngToContainerPoint([entity.lat, entity.lng]);
  const entities = mode()
    .base()
    .filter((e) => e.lat !== null && e.lng !== null);

  // שמות הערים והסיכות עצמן תופסים את מקומם **לפני** התוויות: תווית
  // שנוחתת על סיכה מסתירה בדיוק את מה שהיא באה להסביר.
  //
  // §37: הערים שנלקחות בחשבון הן אלה **שהוצגו בפועל**, ולא עשרים תמיד.
  // מאז שגם הן נכנעות לחפיפה, שמירת מקום לעיר שלא צוירה הייתה מוחקת שם
  // תחנה בשביל טקסט שאינו על המסך.
  const taken = state.cityBoxes.slice();
  entities.forEach((entity) => {
    const p = point(entity);
    taken.push(squareBox(p.x, p.y, mode().pinExtent(entity, entity.id === state.selectedId)));
  });

  entities
    .slice()
    .sort(labelPriority)
    .forEach((entity) => {
      const selected = entity.id === state.selectedId;
      const gap = mode().pinExtent(entity, selected) / 2 + 4;
      const p = point(entity);
      const box = textBox(p.x, p.y + gap + LABEL_HEIGHT / 2, entity.name);
      if (taken.some((other) => boxesOverlap(box, other))) return;
      taken.push(box);

      L.marker([entity.lat, entity.lng], {
        interactive: false, // התווית אינה נלחצת — הסיכה שמעליה כן
        keyboard: false,
        zIndexOffset: -900, // מתחת לסיכות, מעל שמות הערים
        icon: L.divIcon({
          className: "",
          html: `<div class="map-label ${selected ? "map-label--selected" : ""}">${escapeHtml(
            entity.name
          )}</div>`,
          // iconSize: null — הרוחב נקבע בתוכן, והגובה ב-CSS. ערך מספרי
          // כאן היה נכתב כסגנון inline וגובר על הגיליון.
          iconSize: null,
          iconAnchor: [0, -gap],
        }),
      }).addTo(state.labelLayer);
    });
}

// §37: שם המחוז במרכזו, במבט הרחב בלבד.
//
// זו ההתמצאות שהחליפה את עשרים שמות הערים כשאין להם מקום: במבט הארצי
// שבעה שמות מסבירים את המפה טוב יותר מעשרים שמות שנערמים על גוש דן.
// הנקודה אינה מרכז המסה אלא הנקודה הרחוקה ביותר מהגבול (ראו
// tools/build_district_outline.py) — מרכז המסה של ש"י נופל בירושלים,
// ותווית מחוץ לשטח נקראת כאילו היא של השכן.
// §42.1: **מפה אחת — מפת המרחבים. המחוז הוא קו בלבד.**
//
// §42 הבין את זה הפוך והסתיר את המרחבים במבט הרחב. זו הייתה טעות: המרחב
// הוא הרמה שמגייסים עובדים בה, והבקשה הייתה לבטל את **הכפילות**, לא
// אותו.
//
// מה שיורד: **המילוי הצבעוני של המחוזות** — "המפה הישנה". הוא זה שיצר
// מפה על גבי מפה, והוא היחיד שהיה מיותר.
//
// מה שנשאר, בכל זום:
//   * **גבולות המרחבים ושמותיהם** — תמיד. זו המפה.
//   * **קו המחוז, חזק ורציף** — בלי מילוי ובלי שם. מעבר בין מחוזות
//     נראה במבט אחד, וזה בדיוק מה שהתבקש.
function applyBoundaryZoom() {
  if (!state.map) return;

  if (state.districtLayer) {
    // §43: **הצבעים חזרו, והפעם הם המפה עצמה.**
    //
    // ב-§42.1 הורדתי את המילוי כדי לפתור את הכפילות — אבל הכפילות
    // הייתה מתאר הארץ שמתחת, לא הצבע. בלי המילוי המחוזות הפכו לקווים
    // מרחפים על רקע ריק, ואיתו הם מפה שאפשר לקרוא במבט אחד.
    state.districtLayer.setStyle((feature) => ({
      color: "#6b7789",
      weight: 2.4,
      dashArray: null,
      fillColor: DISTRICT_TINT[feature.properties.name] || "#c9cfd8",
      fillOpacity: 0.42,
    }));
  }

  if (state.regionLayer && !state.map.hasLayer(state.regionLayer)) {
    state.regionLayer.addTo(state.map);
  }
  if (state.regionLayer) {
    state.regionLayer.setStyle({ color: "#7c8ba1", weight: 1.5, dashArray: "4 3", fill: false });
  }
}

function renderDistrictLabels() {
  if (!state.map || !state.districtLabelLayer) return;
  state.districtLabelLayer.clearLayers();

  // §42.1: **שמות המרחבים, בכל זום.** קודם הם הופיעו רק ברמה אחת פנימה,
  // ולכן במבט הפתיחה — המבט שרואים ראשון — לא היה על המפה שם מרחב אחד.
  // בדרום, שהוא ארבעה מרחבים על פני חצי מהמדינה, זה היה בולט במיוחד.
  //
  // שם המחוז ירד לגמרי: הוא היה השכבה השנייה שיצרה מפה על מפה, וקו
  // המחוז לבדו כבר אומר איפה עוברים ממחוז למחוז.
  const items = state.regionLabels || [];
  const wide = false;

  items.forEach((item) => {
    L.marker([item.lat, item.lng], {
      interactive: false,
      keyboard: false,
      pane: "districtLabels", // מתחת לסיכות ולשמותיהן, מעל רקע המפה
      icon: L.divIcon({
        className: "",
        html: `<div class="district-label${wide ? "" : " district-label--region"}">${escapeHtml(
          item.name
        )}</div>`,
        iconSize: null,
        iconAnchor: [0, 8],
      }),
    }).addTo(state.districtLabelLayer);
  });
}

function renderBaseMarkers() {
  applyBoundaryZoom();
  renderDistrictLabels();
  renderOrientationCities();
  state.baseLayer.clearLayers();
  state.baseMarkers.clear();

  mode()
    .base()
    .forEach((entity) => {
      if (entity.lat === null || entity.lng === null) return;
      const icon = mode().baseIcon(entity, false);
      const marker = L.marker([entity.lat, entity.lng], {
        icon,
        title: entity.name,
        riseOnHover: true,
      }).addTo(state.baseLayer);

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e); // אחרת ה-click של המפה ינקה מיד את הבחירה
        selectEntity(entity.id);
      });
      state.baseMarkers.set(entity.id, marker);
    });
  renderEntityLabels();
}

function refreshBaseIcons() {
  mode()
    .base()
    .forEach((entity) => {
      const marker = state.baseMarkers.get(entity.id);
      if (!marker) return;
      const selected = entity.id === state.selectedId;
      marker.setIcon(mode().baseIcon(entity, selected));
    });
  state.nearbyStationMarkers.forEach(({ marker, station }) =>
    marker.setIcon(stationIcon(station, false))
  );
  // §27: גודל הסיכה משתנה עם הזום ועם הבחירה, ולכן גם מה שנשאר פנוי
  // לתוויות. חישוב מחדש כאן מכסה את שני המקרים — refreshBaseIcons נקרא
  // גם ב-zoomend וגם בכל בחירה.
  //
  // §37: וגם שמות הערים והמחוזות — שניהם תלויי זום מאז שהם נכנעים
  // לחפיפה, ורק שמות התחנות חושבו מחדש. התוצאה הייתה עיר שנעלמה בזום
  // אחד ולא חזרה בשני.
  renderDistrictLabels();
  renderOrientationCities();
  renderEntityLabels();
}

/* --- כתובת הדף ----------------------------------------------------------- */

// הכתובת משקפת את הנבחר (#/station/3, #/settlement/7). אפשר לשמור מועדף
// או לשלוח קישור שנפתח עליו, במקום "תפתח את המפה ותחפש".
function parseHash(hash = location.hash) {
  const match = hash.match(/^#\/([a-z]+)\/(\d+)$/);
  if (!match) return null;
  // ה-hash של כל מצב מוגדר ב-MODES, ולכן המצבים והכתובות לא יכולים
  // להיפרד זה מזה (#/region/3 עבד רק אם regions קיים בטבלה).
  const found = Object.entries(MODES).find(([, cfg]) => cfg.hash === match[1]);
  if (!found) return null;
  return { mode: found[0], id: Number(match[2]) };
}

function syncHash(id) {
  // הכתובת שייכת למסך שמוצג. בלי התנאי הזה, רענון נתונים בזמן שהמשתמש
  // נמצא בלוח הבקרה היה דורס את #/dashboard ל-#, כי הרענון מנקה את הבחירה
  // במפה ומסנכרן כתובת של מסך שכלל לא מוצג.
  if (state.screen !== "map") return;
  const target = id === null ? "#" : `#/${mode().hash}/${id}`;
  // replaceState ולא location.hash= : האחרון מוסיף רשומה להיסטוריה בכל לחיצה
  // על סיכה, וכפתור "אחורה" היה הופך למסע בין כל מה שנגעת בו.
  if (location.hash !== target) history.replaceState(null, "", target);
}

/* --- בחירה --------------------------------------------------------------- */

function selectEntity(id, { animate = true } = {}) {
  const entity = searchBase().find((e) => e.id === id);
  if (id !== null && !entity) id = null;
  // ישות בלי קואורדינטה קיימת ויש לה נתונים — היא רק לא ניתנת למיקוד.
  // בחירתה פותחת את הכרטיס ומשאירה את המפה במקומה, במקום להתעלם ממנה
  // (יחידת לגיוס שטרם הוגדר לה יישוב הייתה נעלמת מהמסך לגמרי).
  const placed = Boolean(entity) && entity.lat !== null && entity.lng !== null;

  state.selectedId = id;
  // §26: ב-base של היישובים הנבחר נכנס גם כשאינו במיקוד, ולכן **הרכב
  // הסמנים משתנה עם הבחירה**. refreshBaseIcons מעדכן סמנים קיימים בלבד,
  // ולכן בלי הבנייה מחדש היישוב שנבחר מהחיפוש היה נשאר בלי סיכה — וזו
  // שנעזבה הייתה נשארת מודגשת.
  if (mode().base().filter((e) => e.lat !== null).length !== state.baseMarkers.size) {
    renderBaseMarkers();
  }
  syncHash(id);
  state.nearbyLayer.clearLayers();
  state.nearbyStationMarkers = []; // הסמנים נמחקו עם השכבה; לא להשאיר הפניות מתות
  closeDrawer({ keepCard: true });
  refreshBaseIcons();

  document.querySelectorAll("#stations-table tbody tr").forEach((tr) => {
    tr.classList.toggle("row--selected", state.mode === "stations" && Number(tr.dataset.id) === id);
  });

  if (id === null) {
    el("map-info").hidden = true;
    el("search").value = "";
    el("search-clear").hidden = true;
    state.map.flyTo(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom, { duration: 0.6, animate });
    return;
  }

  const nearby = mode().nearbyOf(id);
  // מה שנמתח על המפה יכול להיות תת‑קבוצה של מה שברשימה. הכרטיס מקבל את
  // הרשימה המלאה, והמפה רק את מי שעובר את הסינון של הטאב.
  const onMap = placed && mode().mapFilter ? nearby.filter(mode().mapFilter) : placed ? nearby : [];

  onMap.forEach((rel) => {
    const other = mode().otherById(rel.otherId);
    if (!other || other.lat === null) return;
    const latlng = [other.lat, other.lng];

    L.polyline([[entity.lat, entity.lng], latlng], {
      color: mode().lineColor(entity, other),
      weight: 2,
      opacity: 0.5,
      dashArray: "5,5",
    }).addTo(state.nearbyLayer);

    mode()
      .nearbyMarkers(rel, other)
      .forEach((factory) => factory(latlng).addTo(state.nearbyLayer));
  });

  renderMapInfo(entity, nearby);
  el("search").value = entity.name;
  el("search-clear").hidden = false;
  hideSuggestions();

  // מיקוד שמכיל את הנבחר וכל מי שקרוב אליו — לא זום קבוע, אחרת מי שבקצה
  // נשאר מחוץ למסך והמשתמש לא יודע שהוא קיים. המיקוד הוא על מה שבאמת
  // מצויר, אחרת המפה הייתה מתרחקת בגלל יישוב שאינו מוצג בה.
  if (!placed) {
    refreshBaseIcons();
    return;
  }
  const points = [[entity.lat, entity.lng]].concat(
    onMap
      .map((r) => mode().otherById(r.otherId))
      .filter((o) => o && o.lat !== null)
      .map((o) => [o.lat, o.lng])
  );
  if (points.length > 1) {
    state.map.flyToBounds(L.latLngBounds(points).pad(0.18), { duration: 0.7, animate });
  } else {
    state.map.flyTo([entity.lat, entity.lng], 13, { duration: 0.7, animate });
  }
  // המיקוד עשוי לא לשנות זום (ואז zoomend לא נורה), אבל הסמנים נבנו לפי
  // הזום הקודם. רענון מפורש מכסה את שני המקרים.
  refreshBaseIcons();
}

function renderMapInfo(entity, nearby) {
  const box = el("map-info");
  const current = mode();

  const head = current.head(entity, nearby);
  const grid = current.grid(entity, nearby);
  // הפילוח לפי מקצוע מוצג בכל הטאבים, ובכולם הוא עונה על אותה שאלה —
  // "איפה החוסר ומה כבר בהליך". מה שמשתנה הוא על מי מסתכלים.
  const breakdown = current.breakdown(entity, nearby);

  // כשפריטי הרשימה הם תחנות הם נושאים את נקודת הצבע של הסטטוס שלהן
  // ונלחצים לפתיחת החלונית. כשהם יישובים אין להם צבע ואין מה לפתוח.
  const items = nearby.length
    ? nearby
        .map((rel) => {
          const other = current.otherById(rel.otherId);
          const dot =
            current.itemsAreStations && other
              ? `<span class="sugg-dot" style="background:${other.color}"></span>`
              : "";
          // §14.2: **יישוב מיקוד מודגש בשחור בולט** — הוא זה שמופיע גם
          // על המפה, ולכן הרשימה חייבת להראות למה.
          //
          // הדגל נלקח מהיישוב עצמו (`other.focus`) ולא מהקשר, כדי שאותו
          // כלל יחול בכל מסך: גם ברשימת היישובים של תחנה, גם של מרחב, וגם
          // בכל רשימה שתתווסף. מקור אחד — הרשימה שנמסרה.
          const isFocus = Boolean(rel.focus || (other && other.focus));
          const classes = [
            current.itemsAreStations ? "clickable" : "",
            isFocus ? "item--large" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const attrs =
            (classes ? ` class="${classes}"` : "") +
            (current.itemsAreStations ? ` data-id="${rel.otherId}"` : "");
          // מספר התושבים מוצג רק כשהוא באמת ידוע. הדגשה בלי מספר עדיין
          // אומרת את מה שהיא צריכה לומר — "זה יישוב שברשימה".
          const population = rel.population ?? (other && other.population);
          const size =
            isFocus && population
              ? `<em class="item-note">${population.toLocaleString("he-IL")} תושבים</em>`
              : "";
          return `<li${attrs}>${dot}<span>${escapeHtml(rel.otherName)}</span>${size}<b>${
            rel.travel_min
          } דק'</b></li>`;
        })
        .join("")
    : `<li class="muted">${
        current.emptyList || `אין ${current.listTitle} עד 30 דקות`
      }</li>`;

  // כשהמפה מציגה תת‑קבוצה, נאמר כמה ולמה. רשימה של 60 מול מפה עם 9
  // סיכות בלי הסבר נקראת כמו באג.
  const onMap = current.mapFilter ? nearby.filter(current.mapFilter) : nearby;
  let listNote = "";
  if (current.mapFilter && nearby.length) {
    listNote = `<span class="info-list-note">על המפה: ${onMap.length} מתוך ${nearby.length} — יישובי המיקוד שברשימה</span>`;
  }

  box.innerHTML = `
    <div class="info-head">
      ${head}
      <button class="info-close" id="info-close" title="סגור">×</button>
    </div>
    <div class="info-grid">${grid}</div>
    ${breakdown}
    ${
      current.hideList
        ? ""
        : `<div class="info-list-head">${current.listTitle} עד 30 דק' <em>(${nearby.length})</em>${listNote}</div>
           <ul class="info-list">${items}</ul>`
    }
    ${
      entity.lat === null || entity.lng === null
        ? '<div class="info-warn">אין ליחידה מיקום — היא אינה מופיעה כסיכה על המפה. הוסף לה יישוב בניהול נתונים › יחידות עניין.</div>'
        : entity.coord_verified
        ? ""
        : '<div class="info-warn">מיקום הסיכה הוא ערך זרע שטרם אומת</div>'
    }`;
  box.hidden = false;
  el("info-close").onclick = () => selectEntity(null);
  attachChipHovers(box, entity);

  // §4: לחיצה על "תחנות במרחב" פותחת את בורר התחנות בתוך אותה מפה.
  box.querySelectorAll("[data-open-stations]").forEach((node) => {
    const open = () => openRegionStations(entity);
    node.onclick = open;
    node.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    };
  });

  const back = box.querySelector("#back-to-all");
  if (back) back.onclick = () => closeDrawer();

  box.querySelectorAll("li.clickable").forEach((li) => {
    li.onclick = () => {
      const station = state.stationsById.get(Number(li.dataset.id));
      const rel = nearby.find((r) => r.otherId === Number(li.dataset.id));
      openDrawer(station, rel);
    };
  });
}

/* --- חלונית תחנה קרובה (טאב יישובים) ------------------------------------- */

function openDrawer(station, rel) {
  const settlement = state.settlementsById.get(state.selectedId);
  // §17.3: הכרטיס הראשי מתחלף לפילוח של התחנה שנבחרה. הבחירה נשמרת
  // במצב ולא רק בחלונית, כדי שהכרטיס והחלונית לא יראו שני דברים שונים.
  if (state.mode === "settlements" && state.drawerStationId !== station.id) {
    state.drawerStationId = station.id;
    const entity = mode().byId(state.selectedId);
    if (entity) renderMapInfo(entity, mode().nearbyOf(state.selectedId));
  }
  const drawer = el("drawer");
  drawer.innerHTML = `
    <div class="info-head">
      <span class="pill" style="background:${station.color}">${station.status}</span>
      <strong>${escapeHtml(station.name)}</strong>
      <button class="info-close" id="drawer-close" title="סגור">×</button>
    </div>
    <div class="info-grid">
      <div><span>זמן נסיעה${
        settlement ? ` מ${escapeHtml(settlement.name)}` : ""
      }</span><b>${rel.travel_min} דק'</b></div>
      <div><span>אחוז איוש</span><b>${pctFull(station)}</b></div>
      <div><span>משרות לגיוס</span><b>${vacantCountText(station)}</b></div>
      <div title="${vacancyTip(station)}"><span>תקנים חסרים</span><b>${missingText(station)}</b></div>
      <div><span>מועמדים בהליך</span><b>${candidatesText(station)}</b></div>
    </div>
    ${demographics(station)}
    ${familyBreakdown(station)}
    <div class="drawer-foot">מרחב ${escapeHtml(station.area || "—")}</div>`;
  drawer.hidden = false;
  el("drawer-close").onclick = closeDrawer;
  attachChipHovers(drawer, station);
}

/* --- bottom-sheet בנייד ---------------------------------------------------
   בטלפון כרטיס התחנה והחלונית נפתחים כגיליון תחתון שמכסה את רוב המפה.
   הכפתור לסגירה יושב בראש הכרטיס, ובכרטיס גלול הוא יוצא מהמסך — ואז הדרך
   היחידה לסגור היא לגלול חזרה עד הסוף. בפועל משתמשים פשוט יצאו מהמסך.

   שלוש דרכי יציאה, כמו בכל גיליון תחתון מוכר:
     · הכותרת דביקה, ולכן ה-× תמיד על המסך (ראו style.css)
     · החלקה מטה סוגרת
     · Escape סוגר (מקלדת חיצונית / טאבלט)

   הגרירה מתחילה רק כשהתוכן כבר בראשו. אחרת כל ניסיון לגלול בתוך הכרטיס
   היה נקרא כהחלקת-סגירה, והכרטיס היה נסגר בדיוק כשמנסים לקרוא אותו. */
const SHEET_CLOSE_PX = 90; // מרחק גרירה שמעליו הכרטיס נסגר

function wireSheetGestures() {
  const sheets = [
    { node: el("map-info"), close: () => selectEntity(null) },
    { node: el("drawer"), close: () => closeDrawer() },
  ];

  sheets.forEach(({ node, close }) => {
    if (!node) return;
    let startY = null;
    let delta = 0;

    node.addEventListener(
      "touchstart",
      (e) => {
        if (node.scrollTop > 0 || e.touches.length !== 1) return;
        startY = e.touches[0].clientY;
        delta = 0;
        node.style.transition = "none";
      },
      { passive: true }
    );

    node.addEventListener(
      "touchmove",
      (e) => {
        if (startY === null) return;
        delta = e.touches[0].clientY - startY;
        // רק מטה. גרירה מעלה אינה סוגרת, ולכן אין סיבה להזיז את הכרטיס.
        if (delta > 0) node.style.transform = `translateY(${delta}px)`;
      },
      { passive: true }
    );

    const end = () => {
      if (startY === null) return;
      const shouldClose = delta > SHEET_CLOSE_PX;
      node.style.transition = "";
      node.style.transform = "";
      startY = null;
      delta = 0;
      if (shouldClose) close();
    };
    node.addEventListener("touchend", end);
    node.addEventListener("touchcancel", end);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const drawer = el("drawer");
    const card = el("map-info");
    // החלונית יושבת מעל הכרטיס, ולכן היא נסגרת ראשונה.
    if (drawer && !drawer.hidden) return closeDrawer();
    if (card && !card.hidden) selectEntity(null);
  });
}

function closeDrawer({ keepCard = false } = {}) {
  el("drawer").hidden = true;
  hideChipPopover();
  // חזרה לפילוח הכולל. `keepCard` קיים כדי שהסגירה שנעשית בתוך
  // selectEntity לא תצייר את הכרטיס פעמיים בכל בחירה.
  const had = state.drawerStationId;
  state.drawerStationId = null;
  if (had && !keepCard && state.mode === "settlements" && state.selectedId !== null) {
    const entity = mode().byId(state.selectedId);
    if (entity) renderMapInfo(entity, mode().nearbyOf(state.selectedId));
  }
}

/* --- §4: תחנות המרחב, בתוך מפת המרחבים -----------------------------------
 *
 * "חסרים 197 תקנים במרחב איילון" הוא מספר, לא משימה. המשימה יושבת בתחנה
 * מסוימת, ועד עכשיו כדי להגיע אליה היה צריך לעבור לטאב התחנות ולחפש —
 * ובדרך לאבד את ההקשר של המרחב שממנו הגיעו.
 *
 * הבורר נפתח באותה חלונית שמשמשת את טאב היישובים, ומאותה סיבה: היא כבר
 * יודעת להיפתח לצד הכרטיס הראשי בלי להחליף אותו.
 */

function openRegionStations(region) {
  const stations = (region.station_ids || [])
    .map((id) => state.stationsById.get(id))
    .filter(Boolean)
    .sort((a, b) => (a.staffing_pct ?? 999) - (b.staffing_pct ?? 999));

  const drawer = el("drawer");
  drawer.innerHTML = `
    <div class="info-head">
      <strong>תחנות במרחב ${escapeHtml(region.name)}</strong>
      <button class="info-close" id="drawer-close" title="סגור">×</button>
    </div>
    <div class="picker-note">${stations.length} תחנות · הנמוכה באחוז איוש למעלה</div>
    <ul class="picker-list">${
      stations.length
        ? stations
            .map(
              (s) => `<li data-id="${s.id}">
                <span class="sugg-dot" style="background:${s.color}"></span>
                <span>${escapeHtml(s.name)}</span>
                <b>${pctText(s)}</b>
              </li>`
            )
            .join("")
        : `<li class="muted">אין תחנות במרחב</li>`
    }</ul>`;
  drawer.hidden = false;
  el("drawer-close").onclick = closeDrawer;
  drawer.querySelectorAll("li[data-id]").forEach((li) => {
    li.onclick = () => openStationInRegion(state.stationsById.get(Number(li.dataset.id)), region);
  });
}

// כרטיס התחנה המלא — אותם שדות בדיוק כמו במפת התחנות, כי זו אותה שאלה
// על אותה תחנה. מה שמשתנה הוא רק הדרך חזרה: לרשימת התחנות של המרחב,
// ולא לטאב אחר.
function openStationInRegion(station, region) {
  if (!station) return;
  const nearby = state.relations
    .filter((r) => r.station_id === station.id && r.within_nearby)
    .sort((a, b) => a.travel_min - b.travel_min)
    .slice(0, 8);

  const drawer = el("drawer");
  drawer.innerHTML = `
    <div class="info-head">
      <span class="pill" style="background:${station.color}">${station.status}</span>
      <strong>${escapeHtml(station.name)}</strong>
      <button class="info-close" id="drawer-close" title="סגור">×</button>
    </div>
    <button class="picker-back" id="picker-back">‹ כל התחנות במרחב ${escapeHtml(region.name)}</button>
    <div class="info-grid">
      <div><span>תקן</span><b>${station.required_positions ?? "—"}</b></div>
      <div><span>בפועל</span><b>${station.actual_positions ?? "—"}</b></div>
      <div><span>אחוז איוש</span><b>${pctFull(station)}</b></div>
      <div><span>משרות לגיוס</span><b>${vacantCountText(station)}</b></div>
      <div title="${vacancyTip(station)}"><span>תקנים חסרים</span><b>${missingText(station)}</b></div>
      <div><span>מועמדים בהליך</span><b>${candidatesText(station)}</b></div>
    </div>
    ${demographics(station)}
    ${familyBreakdown(station)}
    <div class="info-list-head">יישובים עד ${state.nearbyMinutes} דק' <em>(${nearby.length})</em></div>
    <ul class="info-list">${
      nearby.length
        ? nearby
            .map(
              (r) =>
                `<li><span>${escapeHtml(r.settlement_name)}</span><b>${r.travel_min} דק'</b></li>`
            )
            .join("")
        : `<li class="muted">אין יישובים בטווח</li>`
    }</ul>`;
  drawer.hidden = false;
  el("drawer-close").onclick = closeDrawer;
  el("picker-back").onclick = () => openRegionStations(region);
  attachChipHovers(drawer, station);
}

/* --- חיפוש --------------------------------------------------------------- */

function hideSuggestions() {
  el("suggestions").hidden = true;
  el("suggestions").innerHTML = "";
}

function renderSuggestions(term) {
  const box = el("suggestions");
  const q = term.trim();
  if (!q) return hideSuggestions();

  const current = mode();
  const matches = searchBase().filter((e) => e.name.includes(q));
  if (!matches.length) {
    box.innerHTML = `<li class="empty">לא נמצא ${current.label} בשם "${escapeHtml(q)}"</li>`;
    box.hidden = false;
    return;
  }

  box.innerHTML = matches
    .map(
      (e) =>
        `<li data-id="${e.id}">${current.suggestionMeta(e)}<span class="sugg-name">${escapeHtml(
          e.name
        )}</span>${current.suggestionTrailing(e)}</li>`
    )
    .join("");
  box.hidden = false;
  box.querySelectorAll("li[data-id]").forEach((li) => {
    li.onclick = () => selectEntity(Number(li.dataset.id));
  });
}

function wireSearch() {
  const input = el("search");
  input.addEventListener("input", () => renderSuggestions(input.value));
  input.addEventListener("focus", () => renderSuggestions(input.value));

  // Enter בוחר את ההתאמה הראשונה — הקלדה ואישור בלי לגעת בעכבר.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = el("suggestions").querySelector("li[data-id]");
      if (first) selectEntity(Number(first.dataset.id));
    } else if (e.key === "Escape") {
      hideSuggestions();
      input.blur();
    }
  });

  el("search-clear").onclick = () => selectEntity(null);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".map-search")) hideSuggestions();
  });
}

/* --- טאבים --------------------------------------------------------------- */

// מסמן את הטאב הפעיל. עובר על כל המצבים שבטבלה ולא על שניים בשמם, אחרת
// טאב שמתווסף נשאר תקוע במצב "פעיל" של הטאב הקודם.
function markActiveTab(next) {
  Object.entries(MODES).forEach(([name, cfg]) => {
    const button = el(cfg.tab);
    if (button) button.classList.toggle("active", name === next);
  });
}

function switchMode(next, { animate = true } = {}) {
  if (state.mode === next) return;
  state.mode = next;
  state.selectedId = null;

  markActiveTab(next);
  el("search").placeholder = mode().placeholder;
  el("search").value = "";
  el("search-clear").hidden = true;
  el("map-info").hidden = true;
  closeDrawer();
  hideSuggestions();
  state.nearbyLayer.clearLayers();
  document.querySelectorAll("tr.row--selected").forEach((tr) => tr.classList.remove("row--selected"));

  renderBaseMarkers();
  fitToBase();
  if (animate) state.map.flyTo(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom, { duration: 0.5 });
  syncHash(null);
}

function wireTabs() {
  Object.entries(MODES).forEach(([name, cfg]) => {
    const button = el(cfg.tab);
    if (button) button.onclick = () => switchMode(name);
  });
}

/* --- מסך לוח בקרה --------------------------------------------------------- */

// כלל הברזל של מסמך הדרישות: היכן שאין נתון — מצב ריק מפורש, לעולם לא אפס
// ולא ערך משוער. זה כלי למפקדים, ומספר מומצא גרוע יותר מהיעדר מספר.
const EMPTY = (reason) => `<span class="kpi-empty">${escapeHtml(reason)}</span>`;

function bar(pct, color) {
  return `<div class="bar"><div class="bar-fill" style="width:${Math.min(
    100,
    pct
  )}%; background:${color}"></div></div>`;
}

function renderKpis(data) {
  const avg = data.avg_staffing;
  const positions = data.positions;
  const gap = data.manpower_gap;

  // כרטיס 1 — אחוז איוש כללי
  const avgCard =
    avg.value === null
      ? EMPTY("אין נתוני איוש")
      : `<b>${avg.value}%</b>
         <span class="pill" style="background:${avg.color}">${avg.status}</span>
         ${bar(avg.value, avg.color)}
         ${avg.note ? `<em class="kpi-note">${escapeHtml(avg.note)}</em>` : ""}`;

  // כרטיס 2 — תקן מול בפועל. המסמך הגדיר מפורשות נפילה לאחור: אם אין
  // תקן/בפועל — מונה תחנות + התפלגות סטטוס.
  const positionsCard = positions.available
    ? `<b>${positions.actual} / ${positions.required}</b><span>מאויש מתוך תקן</span>`
    : `<b>${positions.stations_count}</b><span>תחנות במחוז</span>
       <div class="kpi-breakdown">
         ${Object.entries(positions.status_counts)
           .map(([status, n]) => `<span>${escapeHtml(status)}: <b>${n}</b></span>`)
           .join("")}
       </div>
       ${EMPTY("אין נתוני תקן")}`;

  // כרטיס 3 — פער כוח אדם + מגמה
  const trendText =
    gap.trend === null
      ? `<em class="kpi-note">מגמת חודש: — <span class="muted">(דורש שתי תקופות מדידה)</span></em>`
      : `<em class="kpi-note">מגמת חודש: ${gap.trend > 0 ? "+" : ""}${gap.trend}%</em>`;
  const gapCard = gap.available
    ? `<b>${gap.total_missing}</b><span>תקנים חסרים</span>${trendText}`
    : `${EMPTY("אין נתוני תקן")}${trendText}`;

  el("kpis").innerHTML = `
    <div class="kpi">
      <h3>אחוז איוש כללי</h3>
      ${avgCard}
    </div>
    <div class="kpi">
      <h3>תקן מול בפועל</h3>
      ${positionsCard}
    </div>
    <div class="kpi kpi--alert">
      <h3>פער כוח אדם</h3>
      ${gapCard}
    </div>`;
}

function renderTop5(data) {
  const family = data.filters.family_label;
  // בסינון מקצוע הדירוג הוא לפי החוסר באותו מקצוע, ולכן גם הכותרת משתנה —
  // "אחוז האיוש הנמוך ביותר" מעל טבלה שממוינת לפי חוסר סיירים היא כותרת
  // שקרית.
  el("top5-note").textContent = !data.top5.length
    ? ""
    : family
    ? `${data.top5.length} התחנות עם החוסר הגדול ביותר בתפקיד ${family}`
    : `${data.top5.length} התחנות עם אחוז האיוש הנמוך ביותר`;

  el("top5-table").querySelector("tbody").innerHTML = data.top5.length
    ? data.top5
        .map(
          (r) => `<tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td class="muted">${escapeHtml(r.district || "—")}</td>
            <td class="muted">${escapeHtml(r.area || "—")}</td>
            <td class="td-bar">
              <span>${r.staffing_pct === null ? "—" : r.staffing_pct.toFixed(1) + "%"}</span>
              ${r.staffing_pct === null ? "" : bar(r.staffing_pct, r.color)}
            </td>
            <td>${
              family
                ? `<b>${r.family_missing ?? "—"}</b> חסרים`
                : `<span class="pill" style="background:${r.color}">${r.status}</span>`
            }</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="muted">אין תחנות התואמות את הסינון.</td></tr>`;
}

// מדדי התחנות ו-Top‑5 חיים עכשיו בתוך לוח הבקרה המאוחד, ולכן הם קוראים
// את **אותו** סרגל סינון כמו שאר המסך. סרגל שני היה מציג שני מספרים
// שונים לאותה שאלה.
async function loadDashboard() {
  const params = new URLSearchParams();
  const filters = strategicFilter
    ? strategicFilter.values()
    : { district: "", region: "", station: "" };
  if (filters.district) params.set("district", filters.district);
  if (filters.region) params.set("region", filters.region);
  if (filters.station) params.set("station", filters.station);
  // המקצוע נשלח לשרת ולא מסונן בלקוח: ה-KPI מחושבים בשרת, וסינון בלקוח
  // היה מציג כותרות שמתארות את כל התפקידים מעל מספרים של מקצוע אחד.
  if (selectedFamily()) params.set("family", selectedFamily());

  const data = await api(`/api/dashboard?${params}`);
  renderKpis(data);
  renderRoleBreakdown(data);
  renderTop5(data);
}

// §3: "לציין עבור מועמדים בהליך + תקן מצבה בחלוקה לתפקידים גם אחוז
// גברים/יהודים". שני מקורות שונים באותה שורה, ולכן שתי כותרות משנה
// נפרדות — "האיוש היום" הוא מי שמשרת, "המועמדים" הם מי שבהליך, ואסור
// שייקראו כמו אותו מספר.
function renderRoleBreakdown(data) {
  const rows = data.by_role || [];
  const panel = el("role-panel");
  if (!panel) return;
  panel.hidden = !rows.length;
  if (!rows.length) return;

  const pct = (value) =>
    value === null || value === undefined ? '<span class="muted">—</span>' : `${value.toFixed(1)}%`;
  const num = (value) =>
    value === null || value === undefined ? '<span class="muted">אין נתון</span>' : value;

  // המקור נאמר במפורש: ברמת מרחב/מחוז המספר נגזר משדה "דרישה" ולא
  // מהתחנות, וזה נתון אחר. בלי הכיתוב שני מספרים שונים נראים זהים.
  const SOURCE_NOTE = {
    stations: "המועמדים לפי התחנות שבטווח",
    area: 'המועמדים לפי שדה "דרישה" ברמת מרחב',
    district: 'המועמדים לפי שדה "דרישה" ברמת מחוז',
    national: 'המועמדים ברמה הארצית — שדה "דרישה" לא מסר מחוז או מרחב',
  };
  el("role-note").textContent = SOURCE_NOTE[data.candidates_source] || "טרם נטען קובץ מועמדים";

  el("role-table").querySelector("tbody").innerHTML = rows
    .map(
      (r) => `<tr>
        <td><strong>${escapeHtml(r.label)}</strong></td>
        <td><b class="${r.missing ? "neg" : ""}">${num(r.missing)}</b></td>
        <td>${pct(r.pct_male)}</td>
        <td>${pct(r.pct_jewish)}</td>
        <td>${num(r.candidates)}</td>
        <td>${pct(r.candidates_pct_male)}</td>
        <td>${pct(r.candidates_pct_jewish)}</td>
      </tr>`
    )
    .join("");
}

// סינון המקצוע היחיד שנשאר. הסינון ההיררכי מגיע מ-`strategicFilter`,
// שהוא הסרגל של לוח הבקרה המאוחד.
function wireFilters() {
  el("f-family").onchange = loadDashboard;
}

// המקצוע הנבחר בלוח הבקרה, או מחרוזת ריקה = כל התפקידים (ברירת המחדל).
const selectedFamily = () => (el("f-family") ? el("f-family").value : "");

/* --- מסך טעינת נתונים ----------------------------------------------------- */

function timeAgo(iso) {
  if (!iso) return "טרם נטענו נתונים";
  const minutes = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (minutes < 1) return "עדכון אחרון: הרגע";
  if (minutes < 60) return `עדכון אחרון: לפני ${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `עדכון אחרון: לפני ${hours} שעות`;
  return `עדכון אחרון: לפני ${Math.floor(hours / 24)} ימים`;
}

// מה שהטעינה גילתה ושהמשתמש חייב לדעת גם כשהיא הצליחה: מועמדים שלא שויכו
// לתחנה, תחנות שלא שודכו, מקצועות שלא זוהו. בלי זה "נטענו 6,837 שורות"
// נראה כמו הצלחה מלאה, בזמן שברמת התחנה לא נטען דבר.
function uploadNotes(data) {
  const notes = [];
  if (data.candidates_national)
    notes.push(`סה"כ ${data.candidates_national} מועמדים בקובץ`);
  if (data.unassigned)
    notes.push(`${data.unassigned} ללא שם תחנה — נספרו ברמת מחוז/מרחב ולא ברמת תחנה`);
  if (data.unit_codes)
    notes.push(`מתוכם ${data.unit_codes} עם קוד יחידה מספרי בעמודת "תחנה" במקום שם`);
  if (data.districts && data.districts.length)
    notes.push(`מחוזות שזוהו מהדרישה: ${data.districts.join(", ")}`);
  if (data.areas && data.areas.length)
    notes.push(`מרחבים שזוהו מהדרישה: ${data.areas.join(", ")}`);
  if (data.groups && data.groups.length)
    notes.push(`${data.groups.length} קבוצות מקצוע סוכמו לארבע משפחות`);
  if (data.unknown_stations && data.unknown_stations.length)
    notes.push(`תחנות שלא נמצאו במאגר: ${data.unknown_stations.join(", ")}`);
  if (data.unmatched_stations && data.unmatched_stations.length)
    notes.push(`תחנות שלא שודכו למאגר: ${data.unmatched_stations.join(", ")}`);
  if (data.unknown_regions && data.unknown_regions.length)
    notes.push(`מרחבים שאינם במאגר ולא נטענו: ${data.unknown_regions.join(", ")}`);
  if (data.settlements_created)
    notes.push(`${data.settlements_created} יישובים חדשים נוצרו מהקובץ`);
  if (data.scope_unmatched && data.scope_unmatched.length)
    notes.push(`היקפים שאינם במאגר: ${data.scope_unmatched.join(", ")}`);
  // קובץ התקן והמצבה: התקן והאיוש שנספרו, כמה מהמשרות אפשר לגייס, וכמה
  // תחנות עודכנו. בלי השלושה יחד "נטענו 49,588 שורות" אינו אומר אם משהו
  // באמת השתנה במסך.
  if (data.required != null)
    notes.push(
      `תקן ${Math.round(data.required).toLocaleString("he-IL")} · ` +
        `איוש ${Math.round(data.actual).toLocaleString("he-IL")} ` +
        `(${((data.actual / data.required) * 100).toFixed(1)}%)`
    );
  if (data.stations_updated)
    notes.push(`${data.stations_updated} תחנות עודכנו · ${data.assigned_rows} משרות שויכו לתחנה`);
  if (data.vacant != null) notes.push(`${data.vacant} משרות לגיוס`);
  if (data.excluded)
    notes.push(`${data.excluded} משרות לא נספרו לפי הכלל — מיועד לביטול או מוקפאת`);
  if (data.unknown_statuses && Object.keys(data.unknown_statuses).length)
    notes.push(
      `מצבי משרה שאינם מוכרים ולא נספרו: ${Object.entries(data.unknown_statuses)
        .map(([name, n]) => `${name} (${n})`)
        .join(", ")}`
    );
  if (data.with_population != null)
    notes.push(
      `אוכלוסייה ידועה כעת ל-${data.with_population} מתוך ${data.settlements_total} יישובים`
    );
  if (data.unknown_settlements && data.unknown_settlements.length)
    notes.push(
      `יישובים שלא זוהו במאגר: ${data.unknown_settlements.slice(0, 15).join(", ")}` +
        (data.unknown_settlements.length > 15
          ? ` ועוד ${data.unknown_settlements.length - 15}`
          : "")
    );
  if (data.areas_filled)
    notes.push(`הושלם מרחב ל-${data.areas_filled} תחנות שלא היה להן`);
  if (data.districts_filled)
    notes.push(`הושלם מחוז ל-${data.districts_filled} תחנות שלא היה להן`);
  if (!notes.length) return "";
  return `<ul class="drop-notes">${notes
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("")}</ul>`;
}

async function uploadFile(type, file, { confirmed = false } = {}) {
  const box = el(`drop-${type}`);
  const result = box.querySelector(".drop-result");
  result.hidden = false;
  result.className = "drop-result drop-result--busy";
  result.innerHTML = `טוען את "${escapeHtml(file.name)}"…`;

  const body = new FormData();
  body.append("file", file);
  body.append("file_type", type);
  if (confirmed) body.append("confirmed", "1");

  try {
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = await response.json();

    if (data.ok) {
      result.className = "drop-result drop-result--ok";
      result.innerHTML = `<strong>התקבל.</strong> נטענו ${data.rows} שורות.
        <span class="muted">נשמר: ${escapeHtml(data.archived)}</span>
        ${uploadNotes(data)}
        ${
          data.conflicts.length
            ? `<div class="drop-warn">אזהרה — סתירות זמנים (נלקח הקצר): ${escapeHtml(
                data.conflicts.join("; ")
              )}</div>`
            : ""
        }`;
      // הנתונים במסך נשענים על מה שנטען, ולכן צריך לרענן הכול — לא רק
      // את המסך הזה. הרענון המלא זול יותר מסנכרון ידני של כל מסך בנפרד.
      await refreshAll();
    } else if (data.rejected && data.needs_confirm) {
      // סף ה-10% עוצר ושואל, לא חוסם: הקובץ עדיין בידי המשתמש, והוא זה
      // שיודע אם השינוי אמיתי. הכפתור טוען שוב את אותו קובץ עם אישור.
      result.className = "drop-result drop-result--rejected";
      result.innerHTML = `<strong>שינוי חריג — נדרש אישור.</strong>
        <div>${escapeHtml(data.error)}</div>
        <div class="drop-confirm">
          <button type="button" class="btn-confirm" data-confirm>טען בכל זאת</button>
          <button type="button" class="btn-cancel" data-cancel>ביטול</button>
        </div>`;
      result.querySelector("[data-confirm]").onclick = () =>
        uploadFile(type, file, { confirmed: true });
      result.querySelector("[data-cancel]").onclick = () => {
        result.className = "drop-result";
        result.innerHTML = `<strong>הטעינה בוטלה.</strong> הנתונים לא שונו.`;
      };
    } else {
      result.className = "drop-result drop-result--err";
      result.innerHTML = `<strong>שגיאה.</strong><div>${escapeHtml(data.error)}</div>`;
    }
  } catch (err) {
    result.className = "drop-result drop-result--err";
    result.innerHTML = `<strong>שגיאה.</strong><div>${escapeHtml(err.message)}</div>`;
  }
}

// כל סוגי הקבצים שהמסך יודע לקבל. מפתח = data-type באזור הגרירה וגם
// file_type ב-POST /api/upload — שם אחד, כדי שאזור שנוסף ל-HTML לא ידרוש
// גם רשימה מקבילה כאן. "candidates" חסר מהרשימה הזו בעבר, ולכן אזור
// הגרירה שלו היה מוצג במסך ולא מחובר לכלום.
// §16.2: "staffing_wide" (איוש תחנות) ירד מהרשימה יחד עם אזור הגרירה שלו.
const UPLOAD_TYPES = [
  "relations",
  "region_relations",
  "candidates",
  "establishment",
  "region_map",
  "population",
];

function wireUpload() {
  UPLOAD_TYPES.forEach((type) => {
    const box = el(`drop-${type}`);
    const zone = box.querySelector(".drop-zone");
    const input = box.querySelector("input[type=file]");

    input.onchange = () => {
      if (input.files[0]) uploadFile(type, input.files[0]);
      input.value = ""; // אחרת בחירה חוזרת של אותו קובץ לא מפעילה change
    };

    // dragover חייב preventDefault, אחרת הדפדפן פשוט יפתח את הקובץ במקום
    // למסור אותו לדף.
    ["dragenter", "dragover"].forEach((evt) =>
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        zone.classList.add("drop-zone--over");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      zone.addEventListener(evt, () => zone.classList.remove("drop-zone--over"))
    );
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(type, file);
    });
  });
}

/* --- סינון היררכי משותף --------------------------------------------------- */
//
// מחוז -> מרחב -> תחנה. בחירה ברמה אחת מצמצמת את הרמות שמתחתיה: להשאיר
// ברשימת המרחבים מרחב ממחוז אחר מזמין בחירה שתחזיר תוצאה ריקה בלי להסביר
// למה. הרשימות נבנות מהנתונים בפועל (state.stations) ולא מרשימה קשיחה,
// ולכן מרחב שיתווסף לנתונים ייכנס מעצמו.
//
// אותו מנגנון משמש את לוח הבקרה, ניהול הנתונים, ממשק המגייס והתכנון
// האסטרטגי — כדי שהסינון יתנהג אותו דבר בכל מסך, וכפתור האיפוס יאפס
// את אותו דבר.

function createHierarchyFilter({ district, region, station, onChange }) {
  const get = (id) => (id && el(id) ? el(id).value : "");

  function stationsMatching(districtValue, regionValue) {
    return state.stations.filter(
      (s) =>
        (!districtValue || s.district === districtValue) &&
        (!regionValue || s.area === regionValue)
    );
  }

  // בניית רשימה תוך שמירת הבחירה הנוכחית אם היא עדיין חוקית. בלי זה כל
  // רענון נתונים היה מאפס את הסינון שהמשתמש בחר.
  function fill(id, values, allLabel) {
    const select = el(id);
    if (!select) return;
    const previous = select.value;
    select.innerHTML =
      `<option value="">${allLabel}</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    select.value = values.includes(previous) ? previous : "";
  }

  function refresh() {
    const districtValue = get(district);
    fill(district, [...new Set(state.stations.map((s) => s.district).filter(Boolean))].sort(),
         "כל המחוזות");
    // אחרי מילוי מחדש הערך עשוי להתאפס — לכן נקרא שוב.
    const activeDistrict = get(district);
    const regions = [
      ...new Set(stationsMatching(activeDistrict, "").map((s) => s.area).filter(Boolean)),
    ].sort();
    fill(region, regions, "כל המרחבים");

    const activeRegion = get(region);
    const stations = stationsMatching(activeDistrict, activeRegion).map((s) => s.name).sort();
    fill(station, stations, "כל התחנות");
    void districtValue;
  }

  function values() {
    return { district: get(district), region: get(region), station: get(station) };
  }

  // התאמה ברמת התחנה: כל שלוש הרמות נבדקות.
  function matches(entity) {
    const v = values();
    if (v.district && entity.district !== v.district) return false;
    if (v.region && entity.area !== v.region && entity.region !== v.region) return false;
    if (v.station && entity.name !== v.station) return false;
    return true;
  }

  // התאמה לישות שאינה תחנה (מרחב, מחוז, קשר מרחב‑יישוב).
  //
  // למה זו פונקציה נפרדת ולא אותה בדיקה: ישות ברמת מרחב אין לה שם תחנה,
  // ובבדיקה המלאה כל בחירת תחנה הייתה מסתירה את כל השורות. באותו אופן,
  // קשר מרחב‑יישוב אינו נושא מחוז — הוא נגזר מהמרחב, ולכן הוא מושלם כאן
  // מרשימת המרחבים במקום להיחשב "לא תואם".
  function matchesScope(entity) {
    const v = values();
    const region = entity.region || entity.area || null;
    let district = entity.district || null;
    if (!district && region) {
      const known = state.regions.find((r) => r.name === region);
      district = known ? known.district : null;
    }
    if (v.district && district !== v.district) return false;
    if (v.region && region !== v.region) return false;
    return true;
  }

  function reset() {
    [district, region, station].forEach((id) => {
      if (id && el(id)) el(id).value = "";
    });
    refresh();
    if (onChange) onChange();
  }

  [district, region, station].forEach((id) => {
    if (!id || !el(id)) return;
    el(id).addEventListener("change", () => {
      refresh();
      if (onChange) onChange();
    });
  });

  refresh();
  return { refresh, values, matches, matchesScope, reset };
}

/* --- מסך ניהול נתונים ----------------------------------------------------- */

// המדדים משתנים עם המערך הנבחר. שורה קבועה שמונה קשרים ותחנות מעל טבלת
// מועמדים אינה מתארת את מה שרואים — היא רק נראית כמו כותרת שלו.
function renderManageKpis() {
  const config = MANAGE_DATASETS[state.dataset];
  const cards = config.kpis ? config.kpis() : [];
  el("manage-kpis").innerHTML = cards
    .map((k) => `<div class="kpi ${k.cls || ""}"><h3>${escapeHtml(k.label)}</h3><b>${k.n}</b></div>`)
    .join("");
}

// סכום בטוח: מתעלם מ-null ומחזיר "—" כשאין אף ערך, במקום 0 שנקרא כמו נתון.
function sumOr(values) {
  const known = values.filter((v) => v !== null && v !== undefined);
  return known.length ? known.reduce((a, b) => a + b, 0) : "—";
}

/* --- ניהול נתונים: חמישה מערכי נתונים, מבנה אחד ------------------------- */
//
// כל מערך מגדיר כאן את הכותרות שלו, את השורות שהוא מציג ואת שורת הפעולות
// שמעליו. הרינדור, הסינון והחיפוש משותפים — כדי שמערך שיתווסף יידרש
// להגדרה אחת, ולא למסך חדש.

// §23: סוגי היחידות שיש להן מיקום. "unit" הוא היחידה המגייסת שיושבת
// ברמה ההיררכית 05 — הרמה שממנה נגזר מי נחשב יחידה.
// §28: "מחוז / אגף" ולא "מחוז" — 19 מתוך 27 השורות ברמה הזו הן אגפים
// וחטיבות ארציות ולא מחוזות, ותווית שאומרת "מחוז" על חטיבת התביעות
// נקראת כמו שגיאה.
const UNIT_TYPE_LABEL = {
  station: "תחנה",
  region: "מרחב",
  unit: "יחידה",
  district: "רמה 02 — מחוז / אגף",
};

// §28: מה יחידה יכולה להיקרא. הקובץ אינו נושא את זה וההחלטה היא של
// המזמין — לכן רשימה סגורה וקצרה, ולא שדה חופשי: כינוי שנכתב בכל פעם
// אחרת מפצל את הסינון לשתי שורות שנראות זהות.
const UNIT_KINDS = ["יחידה", "מרחב", "מחוז", "אגף", "מפקדה"];

// תא נערך אחד בטבלת היחידות. שבע עמודות באותו מבנה בדיוק — כתיבתן
// בנפרד הייתה שבע הזדמנויות לשכוח את data-original, ובלעדיו התא נשמר
// בכל יציאה ממנו גם כשלא נגעו בו.
function unitCell(row, fieldName, value, placeholder, settlements = false) {
  const text = value || "";
  return `<td class="cell-edit">
      <input class="unit-field" data-field="${fieldName}" data-id="${row.id}"
             ${settlements ? 'list="settlement-options"' : ""}
             value="${escapeHtml(text)}" placeholder="${escapeHtml(placeholder)}"
             data-original="${escapeHtml(text)}">
    </td>`;
}

const MANAGE_DATASETS = {
  relations: {
    title: "קשרי תחנה‑יישוב",
    columns: ["תחנה", "יישוב", "זמן נסיעה (דקות)", `עד ${"30"} דק'`, ""],
    addRow: "add-row",
    addLabel: "+ הוסף קישור",
    filters: [
      { label: "מחוז", of: (r) => stationOf(r).district },
      { label: "מרחב", of: (r) => stationOf(r).area },
      { label: "תחנה", of: (r) => r.station_name },
      { label: "יישוב", of: (r) => r.settlement_name },
    ],
    kpis: () => {
      const rows = MANAGE_DATASETS.relations.rows();
      return [
        { n: rows.length, label: "קשרים" },
        { n: new Set(rows.map((r) => r.station_id)).size, label: "תחנות" },
        { n: new Set(rows.map((r) => r.settlement_id)).size, label: "יישובים" },
        { n: rows.filter((r) => r.within_nearby).length, label: `עד ${state.nearbyMinutes} דק'` },
      ];
    },
    rows: () => state.relations,
    search: (r, term) => r.station_name.includes(term) || r.settlement_name.includes(term),
    render: (r) => `<tr data-id="${r.id}">
        <td><strong>${escapeHtml(r.station_name)}</strong></td>
        <td>${escapeHtml(r.settlement_name)}</td>
        <td class="cell-edit">
          <input type="number" class="travel-input" value="${r.travel_min}" min="0" max="600"
                 data-id="${r.id}" data-original="${r.travel_min}" data-endpoint="relations">
        </td>
        <td>${r.within_nearby ? '<span class="yes">כן</span>' : '<span class="muted">לא</span>'}</td>
        <td class="cell-actions">
          <button class="row-del" data-id="${r.id}" data-endpoint="relations"
                  data-label="${escapeHtml(r.station_name)} → ${escapeHtml(r.settlement_name)}">מחק</button>
        </td>
      </tr>`,
  },

  // "המטרה שזה ירוץ ללא צורך לשנות את הקוד לעולם" — מרחב או תחנה שאינם
  // מוכרים מקבלים כאן יישוב, וכל המרחקים נגזרים ממנו.
  // §23: היחידות המגייסות — הטבלה כולה ניתנת לעריכה.
  //
  // עד עכשיו הרשימה נקבעה אך ורק בקובץ. קובץ הוא דרך טובה להזין 200 שורות
  // בבת אחת ודרך גרועה לתקן שם אחד שגוי — היה צריך לערוך אקסל, לטעון
  // מחדש, ולקוות. השם, המחוז והיישוב נערכים כאן ונשמרים מיד.
  // §28: **כל טבלת הרמות ההיררכיות, עד 05, נערכת כאן.**
  //
  // קודם נערכו שלוש עמודות — שם, רמה 02 ויישוב. שורה שרמה 03 או 04 שלה
  // שגויה הייתה טעונה תיקון בקובץ וטעינה מחדש, וזה בדיוק מה שאי אפשר
  // לעשות אחרי שהמערכת באוויר. מה שאין לו עמודה במסך אי אפשר לתקן במסך.
  //
  // **רמה 05 היא מפתח החיבור לקובץ התקן והמצבה, והשם הוא מה שרואים.**
  // שתי עמודות ולא אחת: תיקון הכיתוב אינו אמור לנתק את היחידה מהמספרים
  // שלה, ותיקון החיבור אינו אמור לשנות את מה שכתוב על המפה.
  units: {
    title: "יחידות עניין",
    columns: [
      "שם להצגה", "סוג", "רמה 02 — מחוז / אגף", "רמה 03 — מרחב / יחידה",
      "רמה 04 — יחידת אם", "רמה 05 — שם בקובץ התקן", "היישוב שבו היא יושבת",
      "תקן", "פנויות", "",
    ],
    addRow: "add-unit-row",
    addLabel: "+ הוסף יחידה",
    filters: [
      { label: "סוג", of: (r) => r.kind },
      { label: "רמה 02 — מחוז / אגף", of: (r) => r.district },
      { label: "רמה 03 — מרחב / יחידה", of: (r) => r.region },
      { label: "מיקום", of: (r) => (r.settlement_name ? "מוגדר" : "טעון הגדרה") },
      { label: "תקן", of: (r) => (r.required ? "יש נתון" : "אין נתון בקובץ המשרות") },
    ],
    rows: () => state.units_editable || [],
    search: (r, term) =>
      [r.name, r.district, r.region, r.parent_unit, r.level5, r.settlement_name]
        .some((v) => (v || "").includes(term)),
    kpis: () => {
      const rows = state.units_editable || [];
      return [
        { n: rows.length, label: "יחידות" },
        { n: rows.filter((r) => r.settlement_name).length, label: "עם מיקום" },
        {
          n: rows.filter((r) => !r.required).length,
          label: "בלי תקן בקובץ המשרות",
          cls: rows.some((r) => !r.required) ? "kpi--bad" : "",
        },
        { n: rows.reduce((a, r) => a + (r.vacant || 0), 0), label: "משרות פנויות" },
      ];
    },
    // יחידה בלי תקן היא יחידה ששמה אינו קיים בקובץ התקן והמצבה — היא תופיע
    // במפה ריקה. מסומנת, כי זו הבעיה שהכי קשה לגלות בלי סימון.
    render: (r) => `<tr class="${r.required ? "" : "row-pending"}" data-unit="${r.id}">
        ${unitCell(r, "name", r.name, "")}
        <td class="cell-edit">
          <select class="unit-field" data-field="kind" data-id="${r.id}"
                  data-original="${escapeHtml(r.kind)}">
            ${UNIT_KINDS.map(
              (k) =>
                `<option${k === r.kind ? " selected" : ""}>${escapeHtml(k)}</option>`
            ).join("")}
          </select>
        </td>
        ${unitCell(r, "district", r.district, "—")}
        ${unitCell(r, "region", r.region, "—")}
        ${unitCell(r, "parent_unit", r.parent_unit, "—")}
        ${unitCell(r, "level5", r.level5, "כשם התצוגה")}
        ${unitCell(r, "settlement_name", r.settlement_name, "הקלד שם יישוב…", true)}
        <td>${r.required ? r.required : '<span class="muted">אין נתון</span>'}</td>
        <td>${r.vacant || 0}</td>
        <td class="cell-actions">
          <button class="row-del" data-unit-del="${r.id}"
                  data-label="${escapeHtml(r.name)}">מחק</button>
        </td>
      </tr>`,
    note:
      "כל העמודות נערכות כאן ונשמרות מיד — שם, סוג, רמות 02 עד 05 והיישוב. " +
      "רמה 05 היא השם שדרכו היחידה מתחברת לקובץ התקן והמצבה; כשהיא ריקה, " +
      "שם התצוגה הוא שמתחבר. יחידה מסומנת כשאין לה תקן — מפתח החיבור שלה " +
      "אינו מזוהה בקובץ, ולכן המפה שלה תהיה ריקה.",
    empty: "עדיין לא הוגדרו יחידות עניין. טען את קובץ סיווג היחידות או הוסף ידנית.",
  },

  // §23: יומן השינויים הידניים.
  //
  // כל עוד הנתונים הגיעו רק מקבצים, "מי שינה ומתי" נענה ע"י יומן הטעינות.
  // מרגע שאפשר לערוך שם יחידה, לשייך עיסוק ולתקן זמן נסיעה ישירות במסך,
  // השינוי לא היה מתועד בשום מקום — הנתון פשוט היה שונה.
  changes: {
    title: "יומן שינויים",
    columns: ["מתי", "מה", "על מה", "שדה", "מ־", "ל־"],
    filters: [
      { label: "סוג", of: (r) => r.entity_label },
      { label: "פעולה", of: (r) => r.action_label },
    ],
    rows: () => state.changeLog || [],
    search: (r, term) =>
      r.entity_name.includes(term) || (r.new_value || "").includes(term),
    kpis: () => {
      const rows = state.changeLog || [];
      const today = new Date().toISOString().slice(0, 10);
      return [
        { n: rows.length, label: "שינויים מתועדים" },
        { n: rows.filter((r) => (r.changed_at || "").startsWith(today)).length, label: "היום" },
        { n: new Set(rows.map((r) => r.entity_label)).size, label: "סוגי נתונים" },
        { n: rows.filter((r) => r.action === "delete").length, label: "מחיקות" },
      ];
    },
    render: (r) => `<tr>
        <td class="muted">${formatDateTime(r.changed_at)}</td>
        <td>${escapeHtml(r.action_label)}</td>
        <td><strong>${escapeHtml(r.entity_label)}: ${escapeHtml(r.entity_name)}</strong></td>
        <td>${escapeHtml(r.field || "—")}</td>
        <td class="muted">${escapeHtml(r.old_value || "—")}</td>
        <td>${escapeHtml(r.new_value || "—")}</td>
      </tr>`,
    note:
      "כל שינוי שנעשה במסכים מתועד כאן, עם הערך הקודם לצד החדש. טעינות " +
      "קבצים מתועדות בנפרד — במסך טעינת נתונים.",
    empty: "עדיין לא נעשו שינויים ידניים.",
  },

  unit_locations: {
    title: "מיקומי יחידות",
    // §23: שלושה סוגים ולא שניים. היחידות המגייסות (רמה 05) נוספו לטבלה
    // כדי שיהיה מה לערוך — מה שאין לו שורה אי אפשר לתקן במסך.
    columns: ["סוג", "יחידה", "היישוב שבו היא יושבת", "מקור", ""],
    filters: [
      { label: "סוג", of: (r) => UNIT_TYPE_LABEL[r.unit_type] || r.unit_type },
      { label: "מקור ההגדרה", of: (r) => r.source },
      { label: "יישוב", of: (r) => (r.located ? r.settlement_name : null) },
    ],
    empty: "אין יחידות. טען קובץ איוש תחנות תחילה.",
    kpis: () => {
      const rows = state.unitLocations || [];
      return [
        { n: rows.length, label: "יחידות" },
        { n: rows.filter((r) => r.located).length, label: "עם מיקום" },
        { n: rows.filter((r) => !r.located).length, label: "טעון הגדרה" },
        { n: rows.filter((r) => r.source === "ידני").length, label: "הוגדרו ידנית" },
      ];
    },
    rows: () => state.unitLocations || [],
    search: (r, term) =>
      r.unit_name.includes(term) || (r.settlement_name || "").includes(term),
    render: (r) => `<tr class="${r.located ? "" : "row-pending"}">
        <td>${escapeHtml(UNIT_TYPE_LABEL[r.unit_type] || r.unit_type)}</td>
        <td><strong>${escapeHtml(r.unit_name)}</strong></td>
        <td class="cell-edit">
          <input class="unit-input" list="settlement-options"
                 value="${escapeHtml(r.located ? r.settlement_name : "")}"
                 placeholder="הקלד שם יישוב…"
                 data-type="${escapeHtml(r.unit_type)}"
                 data-name="${escapeHtml(r.unit_name)}"
                 data-original="${escapeHtml(r.located ? r.settlement_name : "")}">
        </td>
        <td>${r.located ? escapeHtml(r.source) : '<span class="muted">טעון הגדרה</span>'}</td>
        <td></td>
      </tr>`,
  },

  // §29: מבנה הנתונים, ובדיקה שהמסך משקף אותו.
  //
  // "אני רוצה מבנה של טבלאות שניתן לעדכן והן משקפות את עצמן. איך ניתן
  // לוודא שזה המצב?" — כאן. כל טבלה: מה בה, מאיפה, מתי, ואיפה עורכים.
  // ולמעלה: **המספר שבטבלה מול המספר שעל המסך**, זה ליד זה.
  //
  // עד עכשיו התשובה הייתה שני כלים בשורת פקודה. במערכת שאין לה מתחזק,
  // בדיקה שדורשת שורת פקודה היא בדיקה שלא תרוץ.
  model: {
    title: "מבנה הנתונים · בדיקה עצמית",
    columns: ["טבלה", "מה יש בה", "סוג", "שורות", "מאיפה", "עודכן", "נערך ב"],
    filters: [
      { label: "סוג", of: (r) => r.kind },
      { label: "יש נתון", of: (r) => (r.rows ? "כן" : "לא") },
      { label: "נערך במסך", of: (r) => (r.edited_at ? "כן" : "לא") },
    ],
    rows: () => (state.dataModel || {}).tables || [],
    search: (r, term) => r.table.includes(term) || r.label.includes(term),
    kpis: () => {
      const model = state.dataModel || { summary: {} };
      const s = model.summary || {};
      return [
        { n: s.rows || 0, label: "שורות נתונים בסך הכול" },
        { n: s.tables || 0, label: "טבלאות" },
        {
          n: `${(s.checks || 0) - (s.gaps || 0)}/${s.checks || 0}`,
          label: "בדיקות שהמסך משקף את הטבלה",
          cls: s.gaps ? "kpi--bad" : "kpi--ok",
        },
        {
          n: s.errors || 0,
          label: "סתירות פנימיות",
          cls: s.errors ? "kpi--bad" : "",
        },
      ];
    },
    // טבלה בלי שורות מסומנת — היא יכולת שקיימת ואין מאחוריה נתון, וזה
    // מידע שכדאי לראות ולא להסתיר.
    render: (r) => `<tr class="${r.rows ? "" : "row-pending"}">
        <td><code>${escapeHtml(r.table)}</code></td>
        <td><strong>${escapeHtml(r.label)}</strong></td>
        <td>${escapeHtml(r.kind)}</td>
        <td>${r.rows ? r.rows.toLocaleString("he-IL") : '<span class="muted">ריקה</span>'}</td>
        <td class="muted">${escapeHtml(r.source || "—")}</td>
        <td class="muted">${r.updated ? formatDateTime(r.updated) : "—"}</td>
        <td>${
          r.edited_at
            ? escapeHtml(r.edited_at)
            : '<span class="muted">לא נערך במסך</span>'
        }</td>
      </tr>`,
    note:
      "המערכת היא טבלאות, והמסכים הם השתקפות שלהן. הבדיקות שלמעלה מעמידות " +
      "את המספר שבטבלה מול המספר שהמסך מציג — זה ליד זה. הן מוכיחות שהמסך " +
      "אינו מאבד שורות בדרך; הן אינן מוכיחות שהנתון שבקובץ נכון, ולזה יש " +
      "את השורה \"האם המאגר תואם לקבצים\" למעלה.",
    empty: "אין נתונים.",
  },

  // §28: מי מצויר על המפה — החלטה שנעשית כאן ולא בקוד.
  //
  // שתי הרשימות (77 יישובי מיקוד ו-20 נקודות התמצאות) היו קבועות בקוד
  // ונזרעו למאגר **בכל עליית השרת**, כך ששינוי נמחק בהפעלה הבאה. במערכת
  // שאין בה תחזוקת קוד אחרי העלייה לאוויר זה אומר שהמפה קפואה לתמיד.
  //
  // **היישוב עצמו אינו נעלם בשום מקרה** — הוא נשאר בחיפוש, בקשרים
  // ובניהול הנתונים. הסימון קובע מי מצויר, לא מי קיים.
  settlements: {
    title: "יישובים על המפה",
    columns: [
      "יישוב", "תושבים", "מוצג במפת היישובים", "נקודת התמצאות",
      "תחנות בטווח", "קואורדינטה",
    ],
    filters: [
      { label: "מוצג במפה", of: (r) => (r.focus ? "כן" : "לא") },
      { label: "נקודת התמצאות", of: (r) => (r.major ? "כן" : "לא") },
      { label: "תחנה בטווח", of: (r) => (r.nearby_stations ? "יש" : "אין") },
      { label: "קואורדינטה", of: (r) => (r.lat === null ? "חסרה" : "יש") },
    ],
    rows: () => state.settlements || [],
    search: (r, term) => r.name.includes(term),
    kpis: () => {
      const rows = state.settlements || [];
      return [
        { n: rows.length, label: "יישובים במאגר" },
        { n: rows.filter((r) => r.focus).length, label: "מוצגים במפת היישובים" },
        { n: rows.filter((r) => r.major).length, label: "נקודות התמצאות" },
        {
          n: rows.filter((r) => r.lat === null).length,
          label: "בלי קואורדינטה",
          cls: rows.some((r) => r.lat === null) ? "kpi--bad" : "",
        },
      ];
    },
    // יישוב בלי קואורדינטה מסומן: הוא לא יופיע על המפה גם אם יסומן
    // כמוצג, וזו הבעיה שהכי קשה לגלות בלי סימון.
    render: (r) => `<tr class="${r.lat === null ? "row-pending" : ""}">
        <td><strong>${escapeHtml(r.name)}</strong></td>
        <td class="muted">${r.population ? r.population.toLocaleString("he-IL") : "—"}</td>
        <td class="cell-edit">
          <input type="checkbox" class="settlement-flag" data-field="focus"
                 data-id="${r.id}"${r.focus ? " checked" : ""}>
        </td>
        <td class="cell-edit">
          <input type="checkbox" class="settlement-flag" data-field="major"
                 data-id="${r.id}"${r.major ? " checked" : ""}>
        </td>
        <td>${r.nearby_stations || '<span class="muted">אין</span>'}</td>
        <td>${r.lat === null ? '<span class="no">חסרה</span>' : '<span class="yes">יש</span>'}</td>
      </tr>`,
    note:
      "הסימון קובע מי מצויר על המפה — לא מי קיים. יישוב שאינו מסומן נשאר " +
      "בחיפוש, בקשרי התחנות ובכל המסכים. \"נקודת התמצאות\" היא עיר ששמה " +
      "מוצג על מפת התחנות והיחידות בלי סיכה ובלי לחיצה. יישוב בלי " +
      "קואורדינטה מסומן — הוא לא יופיע על המפה גם אם יסומן כמוצג.",
    empty: "אין יישובים במאגר.",
  },

  region_relations: {
    title: "קשרי מרחב‑יישוב",
    columns: ["מרחב", "יישוב", "זמן נסיעה (דקות)", "עד 30 דק'", ""],
    addRow: "add-row-region",
    addLabel: "+ הוסף קישור",
    filters: [
      { label: "מרחב", of: (r) => r.region },
      { label: "יישוב", of: (r) => r.settlement_name },
    ],
    kpis: () => {
      const rows = MANAGE_DATASETS.region_relations.rows();
      return [
        { n: rows.length, label: "קשרים" },
        { n: new Set(rows.map((r) => r.region)).size, label: "מרחבים" },
        { n: new Set(rows.map((r) => r.settlement_id)).size, label: "יישובים" },
        { n: rows.filter((r) => r.within_nearby).length, label: `עד ${state.nearbyMinutes} דק'` },
      ];
    },
    rows: () => state.regionRelations,
    search: (r, term) => r.region.includes(term) || r.settlement_name.includes(term),
    render: (r) => `<tr data-id="${r.id}">
        <td><strong>${escapeHtml(r.region)}</strong></td>
        <td>${escapeHtml(r.settlement_name)}</td>
        <td class="cell-edit">
          <input type="number" class="travel-input" value="${r.travel_min}" min="0" max="600"
                 data-id="${r.id}" data-original="${r.travel_min}" data-endpoint="region-relations">
        </td>
        <td>${r.within_nearby ? '<span class="yes">כן</span>' : '<span class="muted">לא</span>'}</td>
        <td class="cell-actions">
          <button class="row-del" data-id="${r.id}" data-endpoint="region-relations"
                  data-label="${escapeHtml(r.region)} → ${escapeHtml(r.settlement_name)}">מחק</button>
        </td>
      </tr>`,
    empty: "עדיין לא נטען קובץ קשרי מרחב‑יישוב.",
  },

  stations: {
    title: "איוש תחנות",
    columns: ["תחנה", "מחוז", "מרחב", "אחוז איוש", "תקן", "בפועל", "חוסר לפי תפקיד"],
    filters: [
      { label: "מחוז", of: (r) => r.district },
      { label: "מרחב", of: (r) => r.area },
      { label: "סטטוס", of: (r) => r.status },
    ],
    kpis: () => {
      const rows = MANAGE_DATASETS.stations.rows();
      return [
        { n: rows.length, label: "תחנות" },
        { n: sumOr(rows.map((s) => s.required_positions)), label: "תקן" },
        { n: sumOr(rows.map((s) => s.actual_positions)), label: "בפועל" },
        { n: sumOr(rows.map((s) => s.missing_positions)), label: "חסר", cls: "kpi--bad" },
      ];
    },
    rows: () => state.stations,
    search: (s, term) => s.name.includes(term) || (s.area || "").includes(term),
    // §23: השם, המחוז והמרחב נערכים כאן. התקן והאיוש נשארים לקריאה —
    // הם מגיעים מקובץ המשרות, וכתיבתם ידנית הייתה מנתקת אותם ממקורם.
    render: (s) => `<tr>
        <td class="cell-edit">
          <input class="station-field" data-field="name" data-id="${s.id}"
                 value="${escapeHtml(s.name)}" data-original="${escapeHtml(s.name)}">
        </td>
        <td class="cell-edit">
          <input class="station-field" data-field="district" data-id="${s.id}"
                 value="${escapeHtml(s.district || "")}" placeholder="—"
                 data-original="${escapeHtml(s.district || "")}">
        </td>
        <td class="cell-edit">
          <input class="station-field" data-field="area" data-id="${s.id}"
                 value="${escapeHtml(s.area || "")}" placeholder="—"
                 data-original="${escapeHtml(s.area || "")}">
        </td>
        <td><span class="pill" style="background:${s.color}">${pctText(s)}</span></td>
        <td>${s.required_positions ?? '<span class="muted">אין נתון</span>'}</td>
        <td>${s.actual_positions ?? '<span class="muted">אין נתון</span>'}</td>
        <td>${roleSummary(s.roles, "missing")}</td>
      </tr>`,
    note:
      "השם, המחוז והמרחב נערכים כאן ונשמרים מיד. התקן והאיוש מגיעים מקובץ " +
      "המשרות ואינם ניתנים לעריכה ידנית — הם היו מתנתקים ממקורם.",
  },

  regions: {
    title: "איוש מרחבים",
    columns: ["מרחב", "מחוז", "תחנות", "אחוז איוש משוקלל", "חוסר", "בהליך", "חוסר לפי תפקיד"],
    filters: [
      { label: "מחוז", of: (r) => r.district },
      { label: "מרחב", of: (r) => r.name },
    ],
    kpis: () => {
      const rows = MANAGE_DATASETS.regions.rows();
      return [
        { n: rows.length, label: "מרחבים" },
        { n: sumOr(rows.map((r) => r.stations_count)), label: "תחנות" },
        { n: sumOr(rows.map((r) => r.missing_positions)), label: "חסר", cls: "kpi--bad" },
        { n: sumOr(rows.map((r) => r.candidates_in_process)), label: "מועמדים בהליך" },
      ];
    },
    rows: () => state.regions,
    search: (r, term) => r.name.includes(term) || (r.district || "").includes(term),
    // §24: שם המרחב והמחוז נערכים כאן. המספרים נגזרים מהתחנות ואינם
    // ניתנים לעריכה ישירה — הם תוצאה, לא נתון.
    render: (r) => `<tr>
        <td class="cell-edit">
          <input class="org-field" data-level="region" data-name="${escapeHtml(r.name)}"
                 value="${escapeHtml(r.name)}" data-original="${escapeHtml(r.name)}">
        </td>
        <td class="cell-edit">
          <input class="org-field" data-level="district" data-name="${escapeHtml(r.district || "")}"
                 value="${escapeHtml(r.district || "")}" placeholder="—"
                 data-original="${escapeHtml(r.district || "")}">
        </td>
        <td>${r.stations_count}</td>
        <td><span class="pill" style="background:${r.color}">${pctText(r)}</span></td>
        <td>${r.missing_positions ?? '<span class="muted">אין נתון</span>'}</td>
        <td>${candidatesText(r)}</td>
        <td>${roleSummary(r.roles, "missing")}</td>
      </tr>`,
    note:
      "שם המרחב והמחוז נערכים כאן ומתעדכנים בכל מקום — התחנות, שורות " +
      "המשרה והקשרים. המספרים נגזרים מהתחנות ואינם ניתנים לעריכה ישירה.",
  },

  candidates: {
    title: "מועמדים בהליך",
    columns: ["היקף", "רמה", "סה\"כ מועמדים", "פילוח לפי מקצוע"],
    filters: [
      { label: "רמה", of: (r) => ({ national: "ארצי", district: "מחוז", area: "מרחב" }[r.scope_type] || r.scope_type) },
      { label: "היקף", of: (r) => r.scope_name },
    ],
    kpis: () => {
      const rows = MANAGE_DATASETS.candidates.rows();
      const national = rows.find((c) => c.scope_type === "national");
      return [
        { n: national ? national.total : "—", label: "סה\"כ מועמדים" },
        { n: rows.filter((c) => c.scope_type === "district").length, label: "מחוזות" },
        { n: rows.filter((c) => c.scope_type === "area").length, label: "מרחבים" },
      ];
    },
    rows: () => state.candidateScopes,
    search: (c, term) => c.scope_name.includes(term),
    render: (c) => `<tr>
        <td><strong>${escapeHtml(c.scope_name)}</strong></td>
        <td>${{ national: "ארצי", district: "מחוז", area: "מרחב" }[c.scope_type]}</td>
        <td>${c.total ?? '<span class="muted">אין נתון</span>'}</td>
        <td>${roleSummary(c.roles, "count")}</td>
      </tr>`,
    note: "עמודת 'תחנה' בקובץ ריקה, ולכן אין פילוח ברמת התחנה — ראו טעינת נתונים.",
    empty: "עדיין לא נטען קובץ מועמדים בהליך.",
  },

  admin: {
    title: "איוש מנהלה",
    columns: ["יחידה", "מחוז / אגף", "תפקיד", "תקן", "מאויש", "חסר", "אחוז איוש"],
    filters: [
      { label: "אגף / מחוז", of: (r) => r.district },
      { label: "יחידה", of: (r) => r.region },
      { label: "תפקיד", of: (r) => r.profession },
    ],
    rows: () => state.adminRows,
    search: (r, term) =>
      r.region.includes(term) || r.district.includes(term) || r.profession.includes(term),
    kpis: () => {
      const rows = state.adminRows;
      const required = rows.reduce((a, r) => a + r.required, 0);
      const actual = rows.reduce((a, r) => a + r.actual, 0);
      return [
        { n: required || "—", label: "תקנים" },
        { n: required ? required - actual : "—", label: "חסרים", cls: "kpi--bad" },
        {
          n: required ? `${Math.round((actual / required) * 1000) / 10}%` : "—",
          label: "אחוז איוש",
        },
        { n: new Set(rows.map((r) => r.profession)).size, label: "תפקידים" },
      ];
    },
    render: (r) => {
      const pct = r.required ? Math.round((r.actual / r.required) * 1000) / 10 : null;
      return `<tr>
        <td><strong>${escapeHtml(r.region)}</strong></td>
        <td class="muted">${escapeHtml(r.district)}</td>
        <td>${escapeHtml(r.profession)}</td>
        <td>${r.required}</td>
        <td>${r.actual}</td>
        <td><b class="${r.required - r.actual ? "neg" : ""}">${r.required - r.actual}</b></td>
        <td>${pct === null ? '<span class="muted">—</span>' : pct + "%"}</td>
      </tr>`;
    },
    note: "נטען מקובץ 'איוש מנהלה'. לעריכה — טען קובץ מעודכן במסך ההגדרות.",
    empty: "עדיין לא נטען קובץ איוש מנהלה.",
  },

  // §20.2: כל תיאורי העיסוק והקבוצה שאליה שויכו.
  //
  // הצורך: קובץ המשרות מביא ניסוחי עיסוק חופשיים, ורשימת הסיווג שנמסרה
  // מכסה את מה שהיה ידוע ביום המסירה. עיסוק חדש נופל לכלל מילת מפתח —
  // ניחוש סביר, אבל ניחוש. בלי מסך שמראה אותם, אף אחד לא יודע שיש מה
  // להשלים, והם נשארים משויכים לפי ניחוש לנצח.
  //
  // לכן העיסוקים שלא הוכרעו עולים לראש הרשימה ומסומנים באדום — הם
  // המשימה, וכל השאר הוא הקשר.
  occupations: {
    title: "קשרי קבוצות תפקידים",
    columns: ["תיאור עיסוק", "קבוצת תפקידים", "מקור הסיווג", "משרות", "פנויות"],
    filters: [
      { label: "קבוצת תפקידים", of: (r) => r.category || "לא מסווג" },
      { label: "מצב סיווג", of: (r) => (r.unclassified ? "טעון אישור" : "מסווג") },
    ],
    rows: () => {
      // הלא-מסווגים ראשונים, ובתוך כל קבוצה לפי מספר המשרות: עיסוק
      // שיושבות עליו 40 משרות דחוף יותר מאחד שיושבת עליו אחת.
      const items = state.occupationGroups.items || [];
      return [...items].sort(
        (a, b) =>
          Number(b.unclassified) - Number(a.unclassified) ||
          b.positions - a.positions ||
          a.occupation.localeCompare(b.occupation, "he")
      );
    },
    search: (r, term) =>
      r.occupation.includes(term) || (r.category || "").includes(term),
    kpis: () => {
      const items = state.occupationGroups.items || [];
      const pending = items.filter((i) => i.unclassified);
      return [
        { n: items.length, label: "תיאורי עיסוק" },
        { n: (state.occupationGroups.groups || []).length, label: "קבוצות תפקידים" },
        {
          n: pending.length,
          label: "טעונים אישור סיווג",
          cls: pending.length ? "kpi--bad" : "",
        },
        { n: pending.reduce((a, i) => a + i.positions, 0), label: "משרות בעיסוקים אלה" },
      ];
    },
    // §21: הקבוצה היא בורר ולא טקסט. זו הנקודה כולה — השיוך נערך כאן,
    // ולא בקובץ אקסל שצריך לטעון מחדש.
    render: (r) => {
      const groups = state.occupationGroups.groups || [];
      const unclassified = state.occupationGroups.unclassified_group || "מקצועות ללא סיווג";
      const options = [unclassified, ...groups]
        .map(
          (g) =>
            `<option value="${escapeHtml(g)}"${g === r.category ? " selected" : ""}>${escapeHtml(
              g
            )}</option>`
        )
        .join("");
      return `<tr class="${r.unclassified ? "row-unclassified" : ""}">
        <td><strong>${escapeHtml(r.occupation)}</strong></td>
        <td class="cell-edit">
          <select class="occ-group" data-occupation="${escapeHtml(r.occupation)}"
                  data-original="${escapeHtml(r.category)}">${options}</select>
        </td>
        <td class="muted">${escapeHtml(r.source || "—")}</td>
        <td>${r.positions}</td>
        <td>${r.vacant}</td>
      </tr>`;
    },
    note:
      "השיוך נערך כאן ונשמר מיד. עיסוק חדש שמגיע בקובץ נכנס אדום תחת " +
      "\"מקצועות ללא סיווג\" ומחכה לשיוך — המערכת אינה מנחשת לו קבוצה.",
    empty: "עדיין לא נטען קובץ תקן ומצבה, ולכן אין תיאורי עיסוק.",
  },
};

// צ'יפים קומפקטיים לתא בטבלה. null נשאר "—" ולא 0.
function roleSummary(roles, key) {
  if (!Array.isArray(roles) || !roles.length) return '<span class="muted">אין נתון</span>';
  return `<div class="chips chips--tight">${roles
    .map(
      (r) =>
        `<span class="chip">${escapeHtml(r.label)}<b>${
          r[key] === null || r[key] === undefined ? "—" : r[key]
        }</b></span>`
    )
    .join("")}</div>`;
}

// עזר לקשרי תחנה‑יישוב: השורה מחזיקה מזהה תחנה, והסינון צריך את המחוז
// והמרחב שלה.
const stationOf = (relation) => state.stationsById.get(relation.station_id) || {};

// הבחירה הנוכחית בכל מערך, לפי תווית העמודה. נשמרת בין מעברים כדי
// שחזרה למערך תמצא אותו כפי שהושאר.
const manageChoice = {};

function manageFilters(config) {
  return config.filters || [];
}

// שורה עוברת אם היא תואמת **לכל** הסינונים הפעילים.
function manageMatches(config, row) {
  const chosen = manageChoice[state.dataset] || {};
  return manageFilters(config).every((f) => !chosen[f.label] || f.of(row) === chosen[f.label]);
}

// אפשרויות לתיבה אחת, מחושבות מול *שאר* הסינונים ולא מול עצמה — אחרת
// הבחירה הנוכחית נועלת את המשתמש עליה ואי אפשר להחליף.
function manageOptions(config, field) {
  const chosen = manageChoice[state.dataset] || {};
  const values = new Set();
  config.rows().forEach((row) => {
    const fits = manageFilters(config).every(
      (f) => f.label === field.label || !chosen[f.label] || f.of(row) === chosen[f.label]
    );
    const value = fits ? field.of(row) : null;
    if (value !== null && value !== undefined && value !== "") values.add(value);
  });
  return [...values].sort((a, b) => String(a).localeCompare(String(b), "he"));
}

// סרגל הסינון נבנה מחדש לכל מערך: הוא מציג את **עמודות אותו מערך**
// ולא רשימה קבועה של מחוז/מרחב/תחנה שרובה אינה רלוונטית.
function renderManageFilters(config) {
  const bar = el("manage-filters");
  const chosen = (manageChoice[state.dataset] = manageChoice[state.dataset] || {});

  bar.innerHTML =
    manageFilters(config)
      .map((field) => {
        const options = manageOptions(config, field);
        const current = chosen[field.label] || "";
        return `<label>
            <span>${escapeHtml(field.label)}</span>
            <select data-field="${escapeHtml(field.label)}">
              <option value="">הכול</option>
              ${options
                .map(
                  (v) =>
                    `<option value="${escapeHtml(v)}"${v === current ? " selected" : ""}>${escapeHtml(v)}</option>`
                )
                .join("")}
            </select>
          </label>`;
      })
      .join("") +
    `<label class="filters-grow">
       <span>חיפוש</span>
       <input type="search" id="m-search" placeholder="חיפוש חופשי בטבלה…" value="${escapeHtml(
         manageChoice[state.dataset]._term || ""
       )}">
     </label>
     <button class="filters-reset" id="m-reset">איפוס</button>`;

  bar.querySelectorAll("select[data-field]").forEach((select) => {
    select.onchange = () => {
      chosen[select.dataset.field] = select.value;
      renderManageTable(); // בחירה משנה גם את האפשרויות בשאר התיבות
    };
  });
  // החיפוש מעדכן את הטבלה בלבד ואינו בונה מחדש את הסרגל: בנייה מחדש
  // בכל הקשה הייתה מוחקת את תיבת החיפוש ומאבדת את הסמן שבתוכה.
  el("m-search").oninput = () => {
    chosen._term = el("m-search").value;
    renderManageRows();
  };
  el("m-reset").onclick = () => {
    manageChoice[state.dataset] = {};
    renderManageTable();
  };
}

function renderManageTable() {
  renderManageFilters(MANAGE_DATASETS[state.dataset]);
  renderManageRows();
}

// הטבלה בלבד, בלי לגעת בסרגל הסינון.
function renderManageRows() {
  const config = MANAGE_DATASETS[state.dataset];
  const chosen = (manageChoice[state.dataset] = manageChoice[state.dataset] || {});
  const term = (chosen._term || "").trim();
  const all = config.rows().filter((r) => manageMatches(config, r));
  const rows = term ? all.filter((r) => config.search(r, term)) : all;

  el("manage-title").textContent = config.title;
  el("manage-note").textContent = config.note
    ? config.note
    : `${rows.length} מתוך ${all.length} שורות`;

  const table = el("manage-table");
  table.querySelector("thead").innerHTML =
    `<tr>${config.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
  table.querySelector("tbody").innerHTML = rows.length
    ? rows.map(config.render).join("")
    : `<tr><td colspan="${config.columns.length}" class="muted">${escapeHtml(
        config.empty || "לא נמצאו שורות התואמות את הסינון."
      )}</td></tr>`;

  // שורת ההוספה מוצגת רק למערכי נתונים שאפשר להוסיף להם ידנית.
  ["add-row", "add-row-region", "add-unit-row"].forEach((id) => {
    if (el(id) && id !== config.addRow) el(id).hidden = true;
  });
  el("rel-add").hidden = !config.addRow;
  if (config.addRow) el("rel-add").textContent = config.addLabel;

  renderReflectionChecks();
  wireInlineEdit(table);
}

// §29: בדיקות ההשתקפות — המספר שבטבלה מול המספר שעל המסך.
//
// **שני מספרים זה ליד זה, ולא "תקין".** "תקין" הוא מסקנה שהמערכת מספרת
// על עצמה; שני מספרים הם משהו שאדם יכול לבדוק בעצמו — ואם הוא רואה
// 45,146 בשני הצדדים, הוא אינו צריך להאמין לי.
function renderReflectionChecks() {
  const box = el("model-checks");
  if (!box) return;
  if (state.dataset !== "model") {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const model = state.dataModel || { checks: [], findings: [] };
  const checks = model.checks || [];
  const findings = model.findings || [];
  const base = model.base || {};
  const failed = model.optional_failed || [];

  box.innerHTML = `
    <!-- §30: הבסיס קודם, ולחוד. "מפת חום מנהלה ומשרות פנויות זה הבסיס" —
         ולכן השורה הראשונה במסך אומרת אם הוא שלם, בלי תלות בכל השאר. -->
    <div class="panel-head">
      <h2>הבסיס — מפת חום מנהלה ומשרות פנויות</h2>
      <span class="panel-note">${
        base.ok
          ? "שלם. תקלה בתוספת אינה פוגעת בו."
          : "חסר — טען את קובץ התקן והמצבה."
      }</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>מה</th><th>כמה</th><th></th></tr></thead>
        <tbody>
          <tr><td><strong>שורות תקן ומצבה</strong></td>
            <td>${(base.positions || 0).toLocaleString("he-IL")}</td>
            <td>${base.positions ? '<span class="yes">יש</span>' : '<span class="no">חסר</span>'}</td></tr>
          <tr><td><strong>שורות מפת חום המנהלה</strong></td>
            <td>${(base.admin_rows || 0).toLocaleString("he-IL")}</td>
            <td>${base.admin_rows ? '<span class="yes">יש</span>' : '<span class="no">חסר</span>'}</td></tr>
          <tr><td><strong>משרות פנויות לגיוס</strong></td>
            <td>${(base.vacant || 0).toLocaleString("he-IL")}</td>
            <td>${base.vacant ? '<span class="yes">יש</span>' : '<span class="no">חסר</span>'}</td></tr>
        </tbody>
      </table>
    </div>
    ${
      failed.length
        ? `<p class="panel-note"><strong>${failed.length} תוספות לא נטענו,
             והבסיס לא נפגע:</strong> ${escapeHtml(failed.join(" · "))}</p>`
        : ""
    }

    <div class="panel-head">
      <h2>האם המסך משקף את הטבלאות?</h2>
      <span class="panel-note">${checks.filter((c) => c.ok).length} מתוך
        ${checks.length} בדיקות — המספר בטבלה מול המספר שמוצג</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>מה נבדק</th><th>בטבלה</th><th>על המסך</th><th></th>
          <th>מה זה אומר</th></tr></thead>
        <tbody>${checks
          .map(
            (c) => `<tr class="${c.ok ? "" : "row-pending"}">
              <td><strong>${escapeHtml(c.label)}</strong></td>
              <td>${Number(c.table).toLocaleString("he-IL")}</td>
              <td>${Number(c.screen).toLocaleString("he-IL")}</td>
              <td>${
                c.ok
                  ? '<span class="yes">זהה</span>'
                  : '<span class="no">פער</span>'
              }</td>
              <td class="muted">${escapeHtml(c.note || "")}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>
    </div>
    ${
      findings.length
        ? `<div class="panel-head"><h2>סתירות פנימיות</h2>
             <span class="panel-note">מצבים שאינם אפשריים אם הכול תקין</span></div>
           <div class="table-wrap"><table class="table">
             <thead><tr><th>חומרה</th><th>מה נמצא</th><th>כמה</th>
               <th>מה לעשות</th></tr></thead>
             <tbody>${findings
               .map(
                 (f) => `<tr class="${f.severity === "שגיאה" ? "row-pending" : ""}">
                   <td>${escapeHtml(f.severity)}</td>
                   <td><strong>${escapeHtml(f.title)}</strong></td>
                   <td>${f.count ?? ""}</td>
                   <td class="muted">${escapeHtml(f.hint || "")}</td>
                 </tr>`
               )
               .join("")}</tbody></table></div>`
        : `<p class="panel-note">אין סתירות פנימיות במאגר.</p>`
    }`;
}

// §21: רענון המיפוי אחרי שינוי. הקבוצות והשיוכים מזינים גם את בוררי
// המסך וגם את מסך המנהלה, ולכן מרעננים את שניהם ולא רק את הטבלה.
// §23: רענון היחידות אחרי עריכה. המפה נשענת עליהן, ולכן היא מתרעננת יחד
// — אחרת השם החדש מופיע בטבלה והישן נשאר על הסיכה.
async function refreshUnits() {
  state.units_editable = await api("/api/units");
  state.changeLog = await api("/api/change-log");
  state.unitAliases = await api("/api/unit-aliases");
  const heat = await api("/api/units/heat");
  state.units = heat.items;
  state.unitsById = new Map(heat.items.map((u) => [u.id, u]));
  state.unitLocations = (await api("/api/unit-locations")).units;
  renderManageKpis();
  renderManageTable();
}

async function refreshOccupationGroups() {
  state.occupationGroups = await api("/api/occupation-groups");
  renderManageKpis();
  renderManageTable();
}

// ניהול הקבוצות עצמן — יצירה, שינוי שם ומחיקה. שורה אחת מעל הטבלה, ורק
// במערך העיסוקים: היא חסרת משמעות בכל מערך אחר.
// §23: איחוד כתיבים — מוצג רק במערך היחידות, ששם הוא רלוונטי.
function renderUnitAliasBar() {
  const bar = el("unit-alias-bar");
  if (!bar) return;
  const show = state.dataset === "units";
  bar.hidden = !show;
  if (!show) return;
  const data = state.unitAliases || { candidates: [], units: [] };
  el("alias-candidate").innerHTML = data.candidates
    .map(
      (c) =>
        `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.positions} משרות)</option>`
    )
    .join("");
  el("alias-canonical").innerHTML = (data.units || [])
    .map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`)
    .join("");
}

function renderOccupationGroupBar() {
  const bar = el("occ-group-bar");
  if (!bar) return;
  const isOccupations = state.dataset === "occupations";
  bar.hidden = !isOccupations;
  if (!isOccupations) return;

  const groups = state.occupationGroups.groups || [];
  el("occ-group-pick").innerHTML = groups
    .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
    .join("");
  el("occ-group-count").textContent = `${groups.length} קבוצות`;
}

async function occupationGroupAction(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!data.ok) {
    alert(data.error);
    return false;
  }
  await refreshOccupationGroups();
  renderOccupationGroupBar();
  return true;
}

function wireOccupationGroups() {
  el("occ-group-add").onclick = async () => {
    const name = (prompt("שם הקבוצה החדשה:") || "").trim();
    if (name) await occupationGroupAction("/api/occupation-groups", "POST", { name });
  };
  el("occ-group-rename").onclick = async () => {
    const current = el("occ-group-pick").value;
    if (!current) return;
    const name = (prompt(`שם חדש לקבוצה "${current}":`, current) || "").trim();
    if (name && name !== current) {
      await occupationGroupAction(
        `/api/occupation-groups/${encodeURIComponent(current)}`, "PUT", { name }
      );
    }
  };
  el("occ-group-delete").onclick = async () => {
    const current = el("occ-group-pick").value;
    if (!current) return;
    if (!confirm(`למחוק את הקבוצה "${current}"?\n\nמחיקה אפשרית רק כשאין תחתיה עיסוקים.`)) return;
    await occupationGroupAction(`/api/occupation-groups/${encodeURIComponent(current)}`, "DELETE");
  };
}

// §28: שלוש הפונקציות הבאות היו חמישה עותקים של אותו קוד.
//
// חמש קריאות ל-`querySelectorAll` הכילו את אותן שש שורות של Enter/Escape,
// ושלוש מהן גם את אותן 20 שורות של fetch → בדיקת ok → שחזור בשגיאה. זה
// אינו רק אורך: תא נערך חדש נכתב בהעתקה, וכל העתקה היא הזדמנות לשכוח את
// שחזור הערך בשגיאה — ואז השדה מציג ערך שלא נשמר.

/** Enter שומר, Escape מחזיר. `SELECT` נשמר גם ב-change (ראו בורר הסוג). */
function bindCellKeys(input, save) {
  if (input.tagName === "SELECT") input.onchange = save;
  input.onblur = save;
  input.onkeydown = (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = input.dataset.original;
      input.blur();
    }
  };
}

/** שולח את הערך, ובשגיאה **מחזיר את מה שהיה** ומסמן את השדה באדום. */
async function saveField(input, url, body, after) {
  const original = input.dataset.original;
  const data = await (
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
  if (!data.ok) {
    input.value = original;
    input.classList.add("input--err");
    setTimeout(() => input.classList.remove("input--err"), 1500);
    return alert(data.error);
  }
  input.dataset.original = input.value;
  input.classList.add("input--ok");
  await after();
}

/** תא `data-field` על ישות אחת: נשמר רק כשהערך באמת השתנה. */
function fieldSave(input, url, after) {
  if (input.value === input.dataset.original) return undefined;
  return saveField(input, url, { [input.dataset.field]: input.value.trim() }, after);
}

async function refreshAndRerender() {
  await refreshAll();
  renderManageTable();
}

// עריכה בשורה: נשמרת ב-blur או ב-Enter, ורק אם הערך באמת השתנה — אחרת
// כל מעבר עם Tab על הטבלה היה יוצר גיבוי וכתיבה מיותרים.
function wireInlineEdit(table) {
  // §21: שיוך עיסוק לקבוצה. נשמר מיד בבחירה — אין כאן "שמור", כי הבחירה
  // עצמה היא הפעולה, וכפתור נוסף רק מזמין לשכוח ללחוץ עליו.
  table.querySelectorAll(".occ-group").forEach((select) => {
    select.onchange = async () => {
      const original = select.dataset.original;
      if (select.value === original) return;
      const response = await fetch(
        `/api/occupations/${encodeURIComponent(select.dataset.occupation)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: select.value }),
        }
      );
      const data = await response.json();
      if (!data.ok) {
        select.value = original; // לא נשמר — לא להשאיר במסך בחירה שלא קרתה
        select.classList.add("input--err");
        setTimeout(() => select.classList.remove("input--err"), 1500);
        return alert(data.error);
      }
      select.dataset.original = select.value;
      select.classList.add("input--ok");
      await refreshOccupationGroups();
    };
  });

  // §24: שינוי שם מחוז או מרחב. שינוי כזה נוגע בכל הטבלאות שמחזיקות את
  // השם, ולכן אחריו נדרש רענון מלא ולא עדכון מקומי.
  table.querySelectorAll(".org-field").forEach((input) => {
    bindCellKeys(input, () => {
      const original = input.dataset.original;
      if (input.value === original || !original) return undefined;
      return saveField(
        input,
        `/api/org/${input.dataset.level}/${encodeURIComponent(original)}`,
        { name: input.value.trim() },
        refreshAndRerender
      );
    });
  });

  // §23: עריכת שדות התחנה. שינוי בתחנה משנה את המפה, המדדים והמרחבים —
  // רענון מלא ולא מקומי.
  table.querySelectorAll(".station-field").forEach((input) => {
    bindCellKeys(input, () =>
      fieldSave(input, `/api/stations/${input.dataset.id}`, refreshAndRerender)
    );
  });

  // §23: עריכת שדות היחידה. §28: כל שבע העמודות, כולל בורר הסוג.
  table.querySelectorAll(".unit-field").forEach((input) => {
    bindCellKeys(input, () =>
      fieldSave(input, `/api/units/${input.dataset.id}`, refreshUnits)
    );
  });

  table.querySelectorAll("[data-unit-del]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm(`למחוק את היחידה "${button.dataset.label}"?\n\nשורות המשרה שלה אינן נמחקות.`))
        return;
      const data = await (
        await fetch(`/api/units/${button.dataset.unitDel}`, { method: "DELETE" })
      ).json();
      if (!data.ok) return alert(data.error);
      await refreshUnits();
    };
  });

  // §28: סימון יישוב על המפה. שמירה מיד ורענון מלא — הסימון משנה את
  // המפה עצמה, ולא רק את השורה בטבלה.
  table.querySelectorAll(".settlement-flag").forEach((box) => {
    box.onchange = async () => {
      const body = {};
      body[box.dataset.field] = box.checked;
      const data = await (
        await fetch(`/api/settlements/${box.dataset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      ).json();
      if (!data.ok) {
        box.checked = !box.checked;
        return alert(data.error);
      }
      await refreshAll();
      renderManageKpis();
      renderManageTable();
    };
  });

  table.querySelectorAll(".unit-input").forEach((input) => {
    bindCellKeys(input, () => saveUnitLocation(input));
  });
  table.querySelectorAll(".travel-input").forEach((input) => {
    bindCellKeys(input, () => saveTravel(input));
  });
  table.querySelectorAll(".row-del").forEach((button) => {
    button.onclick = () =>
      deleteRelationRow(button.dataset.endpoint, button.dataset.id, button.dataset.label);
  });
}

async function saveTravel(input) {
  const original = input.dataset.original;
  if (input.value === original) return;

  const response = await fetch(`/api/${input.dataset.endpoint}/${input.dataset.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ travel_min: Number(input.value) }),
  });
  const data = await response.json();

  if (!data.ok) {
    input.value = original; // הערך נדחה — לא להשאיר במסך מספר שלא נשמר
    input.classList.add("input--err");
    setTimeout(() => input.classList.remove("input--err"), 1500);
    alert(data.error);
    return;
  }
  input.dataset.original = input.value;
  input.classList.add("input--ok");
  setTimeout(() => input.classList.remove("input--ok"), 900);
  await refreshAll();
}

async function deleteRelationRow(endpoint, id, label) {
  if (!confirm(`למחוק את הקישור?\n\n${label}\n\nהפעולה נשמרת מיד. גיבוי נוצר לפני המחיקה.`)) return;
  const data = await (await fetch(`/api/${endpoint}/${id}`, { method: "DELETE" })).json();
  if (!data.ok) return alert(data.error);
  await refreshAll();
}

// שמירת היישוב של יחידה. כמו עריכת זמן נסיעה — נשמר רק אם באמת השתנה.
async function saveUnitLocation(input) {
  const value = input.value.trim();
  if (value === input.dataset.original) return;

  const response = await fetch("/api/unit-locations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unit_type: input.dataset.type,
      unit_name: input.dataset.name,
      settlement_name: value,
    }),
  });
  const data = await response.json();
  if (!data.ok) {
    alert(data.error);
    input.value = input.dataset.original;
    return;
  }
  input.dataset.original = value;
  await refreshAll();
}

async function switchDataset(name) {
  state.dataset = name;
  document.querySelectorAll("#manage-tabs .tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.dataset === name);
  });
  // §29: מבנה הנתונים נטען בכל כניסה למסך ולא בעליית המערכת. הוא סופר את
  // כל הטבלאות ומריץ 12 בדיקות — עבודה שאין טעם לעשות למי שלא ביקש
  // לראות אותה, וכשכן ביקש הוא רוצה את המצב **עכשיו** ולא מלפני שעה.
  if (name === "model") {
    state.dataModel = await api("/api/data-model");
  }
  ["add-row", "add-row-region", "add-unit-row"].forEach((id) => {
    if (el(id)) el(id).hidden = true;
  });
  // המדדים שייכים למערך הנבחר ולא למסך. בלי הרענון כאן הם נשארו של המערך
  // הקודם — שורת "4,937 קשרים · 88 תחנות" מעל טבלת תיאורי העיסוק נראית
  // כמו כותרת שלה, ואינה.
  renderManageKpis();
  renderOccupationGroupBar();
  renderUnitAliasBar();
  renderManageTable();
}

function wireManage() {
  // אין כאן חיווט של סרגל הסינון: הוא נבנה מחדש בכל רינדור, לפי עמודות
  // המערך הנבחר. ראה renderManageFilters.
  wireOccupationGroups();
  el("alias-add").onclick = async () => {
    const alias = el("alias-candidate").value;
    const canonical = el("alias-canonical").value;
    if (!alias || !canonical) return;
    if (!confirm(`לסמן ש-"${alias}" הוא אותה יחידה כמו "${canonical}"?`)) return;
    const data = await (
      await fetch("/api/unit-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, canonical }),
      })
    ).json();
    if (!data.ok) return alert(data.error);
    await refreshUnits();
    renderUnitAliasBar();
  };
  el("add-unit-cancel").onclick = () => (el("add-unit-row").hidden = true);
  // §28: שורת ההוספה מקבלת את אותן עמודות שהטבלה נערכת בהן. יחידה שנוספת
  // בשלושה שדות ואז נערכת בשבעה היא שני מסכים לאותה פעולה.
  el("add-unit-save").onclick = async () => {
    const name = el("add-unit-name").value.trim();
    if (!name) return (el("add-unit-error").textContent = "יש להזין שם יחידה.");
    const response = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        kind: el("add-unit-kind").value,
        district: el("add-unit-district").value.trim(),
        region: el("add-unit-region").value.trim(),
        parent_unit: el("add-unit-parent").value.trim(),
        level5: el("add-unit-level5").value.trim(),
        settlement_name: el("add-unit-settlement").value.trim(),
      }),
    });
    const data = await response.json();
    if (!data.ok) return (el("add-unit-error").textContent = data.error);
    ["add-unit-name", "add-unit-district", "add-unit-region", "add-unit-parent",
     "add-unit-level5", "add-unit-settlement"].forEach((id) => (el(id).value = ""));
    el("add-unit-error").textContent = "";
    el("add-unit-row").hidden = true;
    await refreshUnits();
  };
  document.querySelectorAll("#manage-tabs .tab").forEach((tab) => {
    tab.onclick = () => switchDataset(tab.dataset.dataset);
  });

  el("rel-add").onclick = () => {
    const config = MANAGE_DATASETS[state.dataset];
    if (!config.addRow) return;
    el(config.addRow).hidden = false;
    if (state.dataset === "relations") {
      el("add-error").textContent = "";
      el("add-travel").value = "";
    } else if (state.dataset === "units") {
      el("add-unit-error").textContent = "";
    } else {
      el("add-region-error").textContent = "";
      el("add-region-travel").value = "";
    }
  };

  el("add-cancel").onclick = () => (el("add-row").hidden = true);
  el("add-region-cancel").onclick = () => (el("add-row-region").hidden = true);

  el("add-save").onclick = () =>
    submitRelation("/api/relations", "add-row", "add-error", {
      station_id: Number(el("add-station").value),
      settlement_id: Number(el("add-settlement").value),
      travel_min: Number(el("add-travel").value),
    }, el("add-travel").value);

  el("add-region-save").onclick = () =>
    submitRelation("/api/region-relations", "add-row-region", "add-region-error", {
      region: el("add-region").value,
      settlement_id: Number(el("add-region-settlement").value),
      travel_min: Number(el("add-region-travel").value),
    }, el("add-region-travel").value);
}

async function submitRelation(url, rowId, errorId, payload, travelValue) {
  if (!travelValue) {
    el(errorId).textContent = "יש להזין זמן נסיעה.";
    return;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!data.ok) {
    el(errorId).textContent = data.error;
    return;
  }
  el(rowId).hidden = true;
  await refreshAll();
}

function fillManageSelects() {
  const settlementOptions = state.settlements
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  el("add-station").innerHTML = state.stations
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");
  el("add-settlement").innerHTML = settlementOptions;
  el("add-region-settlement").innerHTML = settlementOptions;
  el("add-region").innerHTML = state.regions
    .map((r) => `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`)
    .join("");

}

/* --- מסך ממשק מגייס ------------------------------------------------------- */

function renderRecruiterKpis(kpis) {
  const cards = [
    {
      title: 'סה"כ תקנים',
      body: kpis.total_required.available
        ? `<b>${kpis.total_required.value.toLocaleString("he-IL")}</b><span>משרות מאושרות</span>`
        : EMPTY("אין נתוני תקן"),
    },
    {
      title: "תפוסה בפועל",
      body: kpis.actual.available
        ? `<b>${kpis.actual.value.toLocaleString("he-IL")}</b><span>${kpis.actual.pct}% מיצוי</span>`
        : EMPTY("אין נתוני תקן"),
    },
    {
      title: "פער גיוס",
      alert: true,
      body: kpis.gap.available
        ? `<b>${kpis.gap.value.toLocaleString("he-IL")}</b><span>משרות פתוחות</span>`
        : EMPTY("אין נתוני תקן"),
    },
    {
      title: "יחידות קריטיות",
      alert: kpis.critical_units.value > 0,
      body: `<b>${kpis.critical_units.value}</b><span>מתחת ל‑${kpis.critical_units.threshold}% איוש</span>`,
    },
  ];

  el("rec-kpis").innerHTML = cards
    .map(
      (c) => `<div class="kpi ${c.alert ? "kpi--alert" : ""}">
        <h3>${c.title}</h3>${c.body}
      </div>`
    )
    .join("");
}

// אחוז גברים / אחוז יהודים הם שדות רשות. כשהם חסרים הם **לא מוצגים כלל** —
// בשונה מתקן/בפועל, שמציגים "אין נתונים" כי מדדים שלמים תלויים בהם ומשתמש
// צריך לדעת למה הם ריקים. כאן אין במה לתלות: שדה שלא נטען פשוט לא קיים,
// ותווית "אין נתוני אחוז גברים" הייתה רעש קבוע בכל 11 הכרטיסים.
//
// הכותרת אומרת **על מי** המספר: פילוח האיוש הוא של מי שמשרת היום, ופילוח
// המועמדים הוא של מי שנמצא בהליך. שני מספרים שנראים אותו הדבר ומתארים שתי
// אוכלוסיות שונות חייבים להיקרא בשמם — אחרת קוראים את האחד כאילו הוא השני.
//
// ברמת מרחב המספר משוקלל לפי מספר המאוישים בכל תחנה (ראה _region_demographics
// ב-app.py), ולא ממוצע של אחוזים.
function demographicsChips(title, male, jewish) {
  // §18.2: אחוז גברים בלבד — המדד המגדרי השני הוסר לבקשת המזמין.
  const items = [
    { label: "אחוז גברים", value: male },
    { label: "אחוז יהודים", value: jewish },
  ].filter((item) => item.value !== null && item.value !== undefined);

  if (!items.length) return "";
  return `<div class="unit-section">
    <span class="unit-section-title">${escapeHtml(title)}</span>
    <div class="chips">
      ${items
        .map((i) => `<span class="chip">${i.label}<b>${i.value.toFixed(1)}%</b></span>`)
        .join("")}
    </div>
  </div>`;
}

// פילוח האיוש ופילוח המועמדים, זה מתחת לזה. שניהם אופציונליים ושניהם
// נעלמים לגמרי כשאין להם נתון.
function demographics(s) {
  return (
    demographicsChips("פילוח האיוש", s.pct_male, s.pct_jewish) +
    demographicsChips(
      "פילוח המועמדים בהליך",
      s.candidates_pct_male,
      s.candidates_pct_jewish
    )
  );
}

// אותם שבבים כמו ב-familyChips, בתוך כרטיס התחנה ברשימה.
// §41: בלי השבבים הדהויים — ראה familyChips.
function roleChips(station) {
  const roles = station.roles || [];
  // כל התפקידים NULL עד שיגיע קובץ. תווית אחת במקום חמש תוויות "אין נתונים"
  // — חמש פעמים אותה הודעה היא רעש, לא מידע.
  if (roles.every((r) => r.missing === null)) {
    return `<div class="card-empty">אין נתוני פילוח תפקידים</div>`;
  }
  const chips = roles.map(
    (r) =>
      `<span class="chip chip--hover" data-role="${escapeHtml(
        r.key
      )}" data-kind="occupations">${escapeHtml(r.label)}<b>${
        r.missing === null ? "—" : r.missing
      }</b></span>`
  );
  return `<div class="chips">${chips.join("")}</div>`;
}

function stationCard(s) {
  const pct = s.staffing_pct === null ? null : s.staffing_pct;
  const nearby = s.nearby_settlements;

  return `<div class="unit-card" data-id="${s.id}">
    <div class="unit-head">
      <div class="unit-title">
        <strong>${escapeHtml(s.name)}</strong>
        <span class="unit-meta">${escapeHtml(s.district || "—")} · ${escapeHtml(s.area || "—")}</span>
      </div>
      <span class="pill" style="background:${s.color}">${s.status}</span>
    </div>

    <div class="unit-metrics">
      <div><span>תקן</span><b>${s.required_positions ?? "—"}</b></div>
      <div><span>בפועל</span><b>${s.actual_positions ?? "—"}</b></div>
      <div><span>חוסר</span><b class="${s.missing_positions ? "neg" : ""}">${
    s.missing_positions === null ? "—" : "-" + s.missing_positions
  }</b></div>
    </div>
    ${
      s.required_positions === null
        ? `<div class="card-empty">אין נתוני תקן ובפועל</div>`
        : ""
    }

    <div class="unit-bar">
      <div class="unit-bar-head">
        <span>אחוז איוש</span><b>${pct === null ? "—" : pct.toFixed(1) + "%"}</b>
      </div>
      ${pct === null ? "" : bar(pct, s.color)}
    </div>

    ${demographics(s)}

    <div class="unit-section">
      <span class="unit-section-title">חוסרים לפי תפקיד</span>
      ${roleChips(s)}
    </div>

    <div class="unit-section">
      <span class="unit-section-title">מועמדים בהליך</span>
      ${
        s.candidates_in_process === null
          ? `<div class="card-empty">כרגע אין נתון — טען קובץ מועמדים</div>`
          : `<b class="unit-big">${s.candidates_in_process}</b>`
      }
    </div>
    ${
      // אותן ארבע משפחות של החוסר, ובאותו סדר — כדי שאפשר יהיה לקרוא את שתי
      // המחיצות זו מול זו ("חסרים 12 סיירים, 3 בהליך"). זו הסיבה שהמסך הזה
      // עבר לפילוח המשותף במקום לחמשת התפקידים שהיו לו קודם.
      familyChips("מועמדים בהליך לפי תפקיד", candidateItems(s), "")
    }

    <div class="unit-section">
      <span class="unit-section-title">נקודות עניין לגיוס</span>
      ${
        nearby.length
          ? `<select class="poi-select">
               ${nearby
                 .map(
                   (n) =>
                     `<option>${escapeHtml(n.name)} — ${n.travel_min} דק'</option>`
                 )
                 .join("")}
             </select>`
          : `<div class="card-empty">אין יישובים בטווח הנסיעה</div>`
      }
    </div>

    <div class="unit-actions">
      <button class="unit-btn unit-btn--ghost" data-insight="${s.id}">תובנות גיוס חכמות</button>
      <button class="unit-btn unit-btn--ghost" disabled title="דורש נתוני מועמדים">
        הפקת דוח מועמדים
      </button>
    </div>

    <div class="unit-insights" id="insights-${s.id}"></div>
  </div>`;
}

function renderRecruiterTree(data) {
  if (!data.tree.length) {
    el("rec-tree").innerHTML = `<div class="panel"><div class="empty-state">
      לא נמצאו יחידות התואמות את הסינון.</div></div>`;
    return;
  }

  el("rec-tree").innerHTML = data.tree
    .map(
      (district) => `<div class="acc">
        <div class="acc-district">
          <span>מחוז ${escapeHtml(district.district)}</span>
          <em>${district.areas.reduce((n, a) => n + a.stations.length, 0)} יחידות</em>
        </div>
        ${district.areas
          .map(
            (area) => `<details class="acc-area" open>
              <summary>
                <span>מרחב ${escapeHtml(area.area)}</span>
                <em>${area.stations.length} יחידות</em>
              </summary>
              <div class="unit-grid">
                ${area.stations.map(stationCard).join("")}
              </div>
            </details>`
          )
          .join("")}
      </div>`
    )
    .join("");

  el("rec-tree")
    .querySelectorAll("[data-insight]")
    .forEach((button) => {
      button.onclick = () => showSmartInsights(Number(button.dataset.insight));
    });

  // הריחוף על שבב תפקיד — לכל כרטיס ההקשר שלו, כלומר התחנה שלו.
  el("rec-tree")
    .querySelectorAll(".unit-card")
    .forEach((card) => {
      const station = state.stationsById.get(Number(card.dataset.id));
      if (station) attachChipHovers(card, station);
    });
}

// "תובנות גיוס חכמות" מהמסמך נשענות על ריכוז מועמדים לפי יישוב מגורים —
// נתון שאין. מה שכן אפשר לגזור מהקיים: היישובים הקרובים ביותר לתחנה.
// מוצג כמה שהוא, ולא מוצג כהמלצה מבוססת מועמדים שהיא לא.
async function showSmartInsights(stationId) {
  const box = el(`insights-${stationId}`);
  const station = state.stationsById.get(stationId);
  const detail = await api(`/api/stations/${stationId}/detail`);
  const nearby = (state.recruiterNearby && state.recruiterNearby[stationId]) || [];

  box.innerHTML = `
    <div class="insight-panel">
      <div class="insight-head">
        <strong>תובנות גיוס — ${escapeHtml(station.name)}</strong>
        <button class="info-close" data-close="${stationId}">×</button>
      </div>

      <div class="insight-warn">
        המלצה מבוססת ריכוז מועמדים דורשת נתוני מגורי מועמדים, שאינם במערכת.
        להלן מה שניתן לגזור מזמני הנסיעה בלבד:
      </div>

      ${
        nearby.length
          ? `<ol class="insight-list">
               ${nearby
                 .slice(0, 5)
                 .map(
                   (n) =>
                     `<li><span>${escapeHtml(n.name)}</span><b>${n.travel_min} דק'</b></li>`
                 )
                 .join("")}
             </ol>`
          : `<div class="card-empty">אין יישובים בטווח הנסיעה</div>`
      }

      <div class="insight-add">
        <input type="text" placeholder="תובנה או החלטה לתיעוד…" data-text="${stationId}" maxlength="500">
        <button class="add-save" data-save="${stationId}">שמור</button>
      </div>

      <div class="insight-saved">
        <span class="unit-section-title">תובנות שמורות</span>
        ${
          detail.insights.length
            ? detail.insights
                .map(
                  (i) => `<div class="saved-item ${i.done ? "saved-item--done" : ""}">
                    <input type="checkbox" data-toggle="${i.id}" ${i.done ? "checked" : ""}>
                    <span>${escapeHtml(i.text)}</span>
                    <button class="row-del" data-del="${i.id}">מחק</button>
                  </div>`
                )
                .join("")
            : `<div class="card-empty">טרם נשמרו תובנות</div>`
        }
      </div>
    </div>`;

  box.querySelector("[data-close]").onclick = () => (box.innerHTML = "");
  box.querySelector("[data-save]").onclick = async () => {
    const input = box.querySelector("[data-text]");
    const text = input.value.trim();
    if (!text) return;
    const response = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ station_id: stationId, text }),
    });
    const result = await response.json();
    if (!result.ok) return alert(result.error);
    showSmartInsights(stationId);
  };
  box.querySelectorAll("[data-toggle]").forEach((cb) => {
    cb.onchange = async () => {
      await fetch(`/api/insights/${cb.dataset.toggle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: cb.checked }),
      });
      showSmartInsights(stationId);
    };
  });
  box.querySelectorAll("[data-del]").forEach((button) => {
    button.onclick = async () => {
      await fetch(`/api/insights/${button.dataset.del}`, { method: "DELETE" });
      showSmartInsights(stationId);
    };
  });
}

async function loadRecruiter() {
  const params = new URLSearchParams();
  const filters = recruiterFilter
    ? recruiterFilter.values()
    : { district: "", region: "", station: "" };
  const status = el("rec-status").value;
  const term = el("rec-search").value.trim();
  if (filters.district) params.set("district", filters.district);
  if (filters.region) params.set("region", filters.region);
  if (filters.station) params.set("station", filters.station);
  if (status) params.set("status", status);
  if (term) params.set("q", term);

  const data = await api(`/api/recruiter?${params}`);
  state.recruiterNearby = {};
  data.tree.forEach((d) =>
    d.areas.forEach((a) =>
      a.stations.forEach((s) => (state.recruiterNearby[s.id] = s.nearby_settlements))
    )
  );
  renderRecruiterKpis(data.kpis);
  renderRecruiterTree(data);
}

let recruiterFilter = null;

function wireRecruiter() {
  // אותו סינון היררכי של שאר המסכים: בחירת מחוז מצמצמת את המרחבים,
  // ובחירת מרחב מצמצמת את התחנות.
  recruiterFilter = createHierarchyFilter({
    district: "rec-district",
    region: "rec-region",
    station: "rec-station",
    onChange: loadRecruiter,
  });

  el("rec-status").onchange = loadRecruiter;
  el("rec-search").oninput = loadRecruiter;
  el("rec-reset").onclick = () => {
    ["rec-status", "rec-search"].forEach((id) => (el(id).value = ""));
    recruiterFilter.reset();
  };
  // "עדכון אוטומטי" מהמסמך: מרענן מהמאגר. הוא לא טוען קבצים מחדש — לכך יש
  // את טעינת הנתונים במסך ההגדרות, שעוברת דרך ה-Data Guard.
}

/* --- מסך תכנון אסטרטגי ---------------------------------------------------- */

function renderStrategicKpis(kpis) {
  // "יעד גיוס שנתי" הוסר: אין במערכת נתוני יעדים, והכרטיס הציג
  // "אין נתונים" לנצח — מקום שנתפס בלי להוסיף מידע.
  const cards = [
    {
      title: "מועמדים בתהליך",
      body: kpis.candidates_in_process.available
        ? `<b>${kpis.candidates_in_process.value.toLocaleString("he-IL")}</b><span>בשלבי מיון פעילים</span>`
        : EMPTY("כרגע אין נתון — טען קובץ מועמדים"),
    },
    {
      title: "יחידות במחסור",
      body: `<b>${kpis.units_below.value}</b><span>מתחת ל‑${kpis.units_below.threshold}% תקן</span>`,
    },
  ];

  el("str-kpis").innerHTML = cards
    .map((c) => `<div class="kpi ${c.alert ? "kpi--alert" : ""}"><h3>${c.title}</h3>${c.body}</div>`)
    .join("");
}

// הנוסחה מוצגת במסך, לא מוסתרת בקוד. מנהל מקצה לפי הציון הזה תקציב פרסום,
// ומספר שאי אפשר לשחזר איך התקבל אינו בר-ערעור.
function renderFormula(weights) {
  el("str-formula").innerHTML = `
    <div class="formula-line">
      <b>ציון דחיפות</b> = (100 − אחוז איוש) × מקדם קריטיות × (1 + תקנים חסרים / 10)
    </div>
    <div class="formula-weights">
      ${[
        ["קריטי", weights.critical, "#DC2626"],
        ["דחוף", weights.urgent, "#EA580C"],
        ["בינוני", weights.medium, "#EAB308"],
        ["תקין", weights.ok, "#16A34A"],
      ]
        .map(
          ([label, value, color]) =>
            `<span class="chip"><span class="legend-swatch" style="background:${color}"></span>${label}<b>×${value}</b></span>`
        )
        .join("")}
      <span class="formula-note">מכפיל התקנים החסרים פעיל רק כשקיימים נתוני תקן · ניתן לכוונון בהגדרות</span>
    </div>`;
}

function renderStrategicTable(data) {
  el("str-note").textContent = `${data.top.length} תחנות, ממוינות לפי ציון דחיפות`;

  // דירוג מספרי גלוי: הטבלה ממוינת לפי ציון דחיפות, והמספר אומר את זה
  // מפורשות במקום להשאיר את הקורא להסיק מהסדר.
  const top = Math.max(...data.top.map((t) => t.score), 1);
  el("str-table").querySelector("tbody").innerHTML = data.top.length
    ? data.top
        .map(
          (t, index) => `<tr>
            <td><span class="rank rank--${
              index < 3 ? "top" : "rest"
            }">${index + 1}</span> <strong>${escapeHtml(t.name)}</strong></td>
            <td class="muted">${escapeHtml(t.area || "—")}</td>
            <td>${
              t.missing_positions === null
                ? '<span class="muted">אין נתוני תקן</span>'
                : `<b class="neg">${t.missing_positions} תקנים</b>`
            }</td>
            <td class="td-bar">
              <span>${t.gap_pct}%</span>
              ${bar(t.gap_pct, t.color)}
            </td>
            <td class="td-bar">
              <span><b>${t.score}</b></span>
              ${bar((t.score / top) * 100, t.color)}
            </td>
            <td><span class="pill" style="background:${t.color}">${t.status}</span></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">אין תחנות עם אחוז איוש.</td></tr>`;
}

function renderTargets(data) {
  el("str-targets").innerHTML = data.targets.length
    ? `<div class="targets-note">מבוסס על ${data.top.length} התחנות הדחופות ביותר ועל
         זמני נסיעה עד ${data.nearby_minutes} דק'</div>
       <ol class="targets">
         ${data.targets
           .slice(0, 5)
           .map(
             (t) => `<li>
               <div class="target-head">
                 <strong>${escapeHtml(t.name)}</strong>
                 <span class="target-score">ציון ${t.score}</span>
               </div>
               <div class="target-meta">בטווח נסיעה מ‑${t.station_count} תחנות</div>
               <div class="target-stations">
                 ${t.stations
                   .map(
                     (s) =>
                       `<span class="chip"><span class="legend-swatch" style="background:${s.color}"></span>${escapeHtml(
                         s.name
                       )}<b>${s.travel_min}′</b></span>`
                   )
                   .join("")}
               </div>
             </li>`
           )
           .join("")}
       </ol>`
    : `<div class="empty-state">אין יישובים בטווח הנסיעה של התחנות הדחופות.</div>`;
}

function renderDays(data) {
  el("str-days").innerHTML = data.recruitment_days.length
    ? `<div class="table-wrap"><table class="table">
         <thead><tr><th>תאריך</th><th>תחנה</th><th>מיקום</th><th>% צפוי</th><th></th></tr></thead>
         <tbody>
           ${data.recruitment_days
             .map(
               (d) => `<tr>
                 <td>${escapeHtml(d.date)}</td>
                 <td><strong>${escapeHtml(d.station_name)}</strong></td>
                 <td class="muted">${escapeHtml(d.location || "—")}</td>
                 <td>${d.expected_success_pct === null ? "—" : d.expected_success_pct + "%"}</td>
                 <td class="cell-actions"><button class="row-del" data-day="${d.id}">מחק</button></td>
               </tr>`
             )
             .join("")}
         </tbody></table></div>`
    : `<div class="empty-state">טרם תוכננו ימי גיוס.</div>`;

  el("str-days")
    .querySelectorAll("[data-day]")
    .forEach((button) => {
      button.onclick = async () => {
        if (!confirm("למחוק את יום הגיוס?")) return;
        await fetch(`/api/recruitment-days/${button.dataset.day}`, { method: "DELETE" });
        loadStrategic();
      };
    });
}

let strategicFilter = null;

// תכנון מנהלה: אותה שאלה, עולם נתונים אחר. אין כאן ציון דחיפות — הוא
// נשען על תקן ובפועל ברמת תחנה, ולמנהלה אין רמה כזו. הדירוג הוא לפי
// גודל הפער בפועל, שהוא מה שהתכנון נשען עליו.
async function loadStrategicAdmin() {
  // §31: סינון יחידה — אותו סינון בדיוק כמו בלוח המשרות.
  const scope = el("str-scope-filter") ? el("str-scope-filter").value : "";
  const data = await api(`/api/admin-gaps${scope ? `?scope=${scope}` : ""}`);
  const totals = data.totals;

  el("str-kpis").innerHTML = [
    { title: "תקני מנהלה", value: totals.required || "—" },
    { title: "חסרים", value: totals.missing || "—" },
    {
      title: "אחוז איוש",
      value: totals.staffing_pct === null ? "—" : `${totals.staffing_pct}%`,
    },
    { title: "תפקידים", value: `${totals.professions} ב-${totals.units} יחידות` },
  ]
    .map((k) => `<div class="kpi"><h3>${k.title}</h3><b>${k.value}</b></div>`)
    .join("");

  renderGapChart(el("str-admin-chart"), data.by_profession.slice(0, 10));

  el("str-admin-table").querySelector("tbody").innerHTML = data.by_profession.length
    ? data.by_profession
        .map(
          (r) => `<tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${r.required}</td>
            <td>${r.actual}</td>
            <td><b class="${r.missing ? "neg" : ""}">${r.missing}</b></td>
            <td>${r.staffing_pct === null ? "—" : r.staffing_pct + "%"}</td>
            <td class="muted">${r.units_with_gap}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="muted">אין נתוני מנהלה. טען קובץ במסך ההגדרות.</td></tr>`;

  el("str-admin-units").querySelector("tbody").innerHTML = data.by_unit.length
    ? data.by_unit
        .slice(0, 12)
        .map(
          (r) => `<tr>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td class="muted">${escapeHtml(r.department || r.area || "—")}</td>
            <td>${r.required}</td>
            <td><b class="${r.missing ? "neg" : ""}">${r.missing}</b></td>
            <td>${r.staffing_pct === null ? "—" : r.staffing_pct + "%"}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="muted">אין נתוני מנהלה.</td></tr>`;
}

// גרף עמודות אופקי: כמה תקנים חסרים בכל תפקיד, הגדול למעלה.
//
// עמודות אופקיות ולא אנכיות — שמות התפקידים ארוכים ("לוחם / יחידות
// מיוחדות"), ובעמודות אנכיות הם היו נאלצים להיטות או להיחתך.
//
// **סדרה אחת, ולכן צבע אחד ובלי מקרא.** אורך העמודה הוא ההצפנה; צביעה
// לפי גודל החוסר הייתה מקודדת את אותו נתון פעמיים ושורפת את הערוץ החופשי
// היחיד. אחוז האיוש מוצג כטקסט לצד העמודה, לא כצבעה.
//
// הכותרות מגיעות מקובץ אקסל ולכן נכתבות ב-textContent ולא ב-innerHTML.
const CHART_HUE = "#2563eb";

function renderGapChart(container, items) {
  container.textContent = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted chart-empty";
    empty.textContent = "אין נתוני מנהלה. טען קובץ במסך ההגדרות.";
    container.appendChild(empty);
    return;
  }

  // הסקאלה נמתחת לחוסר הגדול ביותר ומתחילה מאפס. תחילת ציר שאינה אפס
  // מנפחת הפרשים ואינה מותרת בעמודות.
  const max = Math.max(...items.map((i) => i.missing), 1);
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  container.appendChild(tip);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "chart-row";
    row.tabIndex = 0;

    const name = document.createElement("span");
    name.className = "chart-label";
    name.textContent = item.name;

    const track = document.createElement("span");
    track.className = "chart-track";
    const fill = document.createElement("span");
    fill.className = "chart-fill";
    // הסקאלה נמתחת ל-90% מרוחב הציר ולא ל-100%: העשירית שנשארת היא
    // המקום שבו יושב הערך, בקצה העמודה. בלי השוליים האלה הערך של
    // העמודה הארוכה ביותר היה נדחק אל מחוץ לציר או נחתך.
    fill.style.width = `${(item.missing / max) * 90}%`;
    fill.style.background = CHART_HUE;

    // הערך יושב **בקצה העמודה** ולא בעמודה נפרדת: בעמודה קבועה הוא היה
    // מתרחק מעמודות קצרות עד שהקשר ביניהם מתנתק.
    const value = document.createElement("b");
    value.className = "chart-value";
    value.textContent = item.missing.toLocaleString("he-IL");
    track.append(fill, value);

    const pct = document.createElement("em");
    pct.className = "chart-pct";
    pct.textContent = item.staffing_pct === null ? "—" : `${item.staffing_pct}%`;

    row.append(name, track, pct);

    // העמודה עצמה היא יעד ההצבעה, והשורה כולה היא שטח הפגיעה — עמודה
    // של 12 פיקסלים היא מטרה שקשה לפגוע בה.
    const show = () => {
      tip.textContent = "";
      const lines = [
        [item.name, ""],
        [item.missing.toLocaleString("he-IL"), "תקנים חסרים"],
        [item.required.toLocaleString("he-IL"), "תקן"],
        [item.actual.toLocaleString("he-IL"), "מאויש"],
        [item.staffing_pct === null ? "—" : `${item.staffing_pct}%`, "אחוז איוש"],
        [String(item.units_with_gap), "יחידות עם חוסר"],
      ];
      lines.forEach(([strong, label], index) => {
        const line = document.createElement("div");
        line.className = index === 0 ? "chart-tip-head" : "chart-tip-row";
        const b = document.createElement("b");
        b.textContent = strong;
        line.appendChild(b);
        if (label) {
          const span = document.createElement("span");
          span.textContent = label;
          line.appendChild(span);
        }
        tip.appendChild(line);
      });
      // הפאנל חותך את מה שגולש ממנו (overflow: hidden), ולכן טולטיפ על
      // השורות התחתונות נפתח **כלפי מעלה**. בלי ההיפוך הזה החצי התחתון
      // של הגרף היה מציג טולטיפ קטוע.
      tip.hidden = false;
      const below = row.offsetTop + row.offsetHeight;
      const flip = below + tip.offsetHeight > container.clientHeight;
      tip.style.top = flip ? `${Math.max(0, row.offsetTop - tip.offsetHeight)}px` : `${below}px`;
      row.classList.add("is-hovered");
    };
    const hide = () => {
      tip.hidden = true;
      row.classList.remove("is-hovered");
    };
    row.addEventListener("pointerenter", show);
    row.addEventListener("focus", show);
    row.addEventListener("pointerleave", hide);
    row.addEventListener("blur", hide);

    container.appendChild(row);
  });
}

// מתאים את לוח הבקרה לתחום הנבחר. הסינון ההיררכי, כמות התחנות ומדדי
// התחנות שייכים לעולם הליבה בלבד — למנהלה יש היררכיה משלה (אגפים
// ויחידות), ואין לה רמת תחנה.
function applyStrategicScope() {
  const core = state.strategicScope === "core";
  document.querySelectorAll("#str-scope .scope-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.scope === state.strategicScope);
  });
  // §31: סרגל הסינון נשאר גלוי בשני התחומים, ומחליף תוכן.
  //
  // קודם הוא הוסתר לגמרי בתצוגת המשרות, כי הסינונים שבו (מחוז · מרחב ·
  // תחנה · מקצוע) הם של התחנות ואין להם משמעות שם. אבל **סינון היחידה כן
  // רלוונטי דווקא שם** — הוא נשען על רמת המשרה. הסתרת הסרגל כולו הייתה
  // מסתירה אותו יחד עם מה שלא שייך.
  el("str-filters").hidden = false;
  ["str-district", "str-region", "str-station", "f-family"].forEach((id) => {
    if (el(id) && el(id).parentElement) el(id).parentElement.hidden = !core;
  });
  if (el("str-scope-label")) el("str-scope-label").hidden = core;
  el("str-reset").hidden = false;
  el("str-core-panel").hidden = !core;
  el("str-admin-panel").hidden = core;
  el("str-n").parentElement.hidden = !core;
  el("kpis").hidden = !core;
  el("top5-panel").hidden = !core;
  // הפילוח לפי תפקיד שייך לליבה: ארבע המשפחות הן חלוקה של תפקידי
  // התחנה, ולמנהלה יש היררכיה משלה. loadDashboard מחזיר אותו למסך.
  if (!core) el("role-panel").hidden = true;
}

// לוח הבקרה טוען את שני חלקיו יחד. במנהלה אין רמת תחנה, ולכן חלק
// המדדים והתחנות אינו נטען שם כלל.
async function loadBoard() {
  if (state.strategicScope === "admin") return loadStrategic();
  await Promise.all([loadStrategic(), loadDashboard()]);
}

async function loadStrategic() {
  if (state.strategicScope === "admin") return loadStrategicAdmin();
  const params = new URLSearchParams({ n: el("str-n").value || 10 });
  const filters = strategicFilter
    ? strategicFilter.values()
    : { district: "", region: "", station: "" };
  if (filters.district) params.set("district", filters.district);
  if (filters.region) params.set("region", filters.region);
  if (filters.station) params.set("station", filters.station);

  const data = await api(`/api/strategic?${params}`);
  renderStrategicKpis(data.kpis);
  renderFormula(data.weights);
  renderStrategicTable(data);
  renderTargets(data);
  renderDays(data);
}

async function wireStrategic() {
  // אפשרויות ה-N מגיעות מהשרת ולא מרשימה קשיחה ב-JS: המסמך סותר את עצמו
  // בנקודה הזו (טקסט מול איור), וההכרעה צריכה לחיות במקום אחד.
  const options = (await api("/api/strategic?n=10")).n_options;
  el("str-n").innerHTML = options
    .map((n) => `<option value="${n}"${n === 10 ? " selected" : ""}>${n}</option>`)
    .join("");
  el("str-n").onchange = loadBoard;

  strategicFilter = createHierarchyFilter({
    district: "str-district",
    region: "str-region",
    station: "str-station",
    onChange: loadBoard,
  });
  el("str-reset").onclick = () => {
    el("f-family").value = "";
    if (el("str-scope-filter")) el("str-scope-filter").value = "";
    strategicFilter.reset();
  };
  if (el("str-scope-filter")) el("str-scope-filter").onchange = loadBoard;

  document.querySelectorAll("#str-scope .scope-btn").forEach((button) => {
    button.onclick = () => {
      state.strategicScope = button.dataset.scope;
      applyStrategicScope();
      loadBoard();
    };
  });
  // סנכרון ראשוני: עד עכשיו התאמת המסך לתחום הנבחר ישבה **רק** בתוך
  // מטפל הלחיצה, ולכן במצב הפתיחה היא הסתמכה על כך שסימון ה-active
  // ב-HTML תואם את ברירת המחדל ב-state. שני מקורות אמת לאותו דבר.
  applyStrategicScope();

  el("day-station").innerHTML = state.stations
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");

  el("day-add").onclick = () => {
    el("day-row").hidden = false;
    el("day-error").textContent = "";
  };
  el("day-cancel").onclick = () => (el("day-row").hidden = true);
  el("day-save").onclick = async () => {
    const response = await fetch("/api/recruitment-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        station_id: Number(el("day-station").value),
        date: el("day-date").value,
        location: el("day-location").value,
        expected_success_pct: el("day-pct").value || null,
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      el("day-error").textContent = data.error;
      return;
    }
    el("day-row").hidden = true;
    ["day-date", "day-location", "day-pct"].forEach((id) => (el(id).value = ""));
    loadStrategic();
  };
}

/* --- מסך לוח משרות לגיוס -------------------------------------------------- */
//
// **במסך הזה יש טבלה אחת בלבד**: המשרות שאפשר לגייס אליהן, עם מספר המשרה.
// סקירת החוסרים (הגרף, התפקידים החסרים, היחידות המרוקנות) עברה ללוח
// הבקרה — שם שואלים "איפה הפער", וכאן שואלים "על מה בדיוק לפעול".
//
// בפתיחה מוצג הכול; כל סינון בסרגל שלמעלה מצמצם את הטבלה.

// ארבעת הסינונים מתעדכנים זה מזה: בחירת אזור מצמצמת את רשימת התפקידים
// לאלה שקיימים שם, ובחירת תפקיד מצמצמת את האזורים. בלי זה בחירה בתפקיד
// שאינו קיים באזור מחזירה מסך ריק בלי להסביר למה.
async function loadAdminOptions() {
  const params = new URLSearchParams();
  const chosen = resolveProfession(el("a-profession").value);
  if (chosen.value) params.set("profession", chosen.value);
  if (el("a-area").value) params.set("area", el("a-area").value);
  if (el("a-department").value) params.set("department", el("a-department").value);
  if (el("a-unit").value) params.set("region", el("a-unit").value);
  // §33: סינון היחידה נשלח גם לרשימת האפשרויות. בלעדיו המספר שליד כל
  // תפקיד נספר על כל המשרות, והלחיצה עליו מחזירה רשימה ריקה.
  if (el("a-scope") && el("a-scope").value) params.set("scope", el("a-scope").value);

  const data = await api(`/api/admin-options?${params}`);
  state.adminProfessions = data.professions.map((p) => p.name);

  // §43: רשימת התחנות נטענת פעם אחת. היא אינה תלויה בשאר הסינונים —
  // 88 התחנות הן רשימה סגורה, ולא תוצאה של שאילתה שמצטמצמת.
  if (!state.adminStations) {
    state.adminStations = await api("/api/admin-stations");
    const select = el("a-station");
    if (select) {
      select.innerHTML =
        `<option value="">כל התחנות</option>` +
        state.adminStations
          .map(
            (s) =>
              `<option value="${s.id}">${escapeHtml(s.name)} — ${
                s.vacant ? `${s.vacant} לגיוס` : "אין"
              }</option>`
          )
          .join("");
    }
  }

  // המספר הוא **משרות פנויות**, ולא חוסר תקן. חוסר של תקן אחד שכולו
  // משרה מוקפאת אינו משרה שאפשר לגייס אליה, והמספר שמופיע כאן חייב
  // להיות בדיוק מה שייפתח בטבלה מתחת — אחרת הסינון מבטיח ומאכזב.
  el("a-profession-list").innerHTML = data.professions
    .map(
      (p) =>
        `<option value="${escapeHtml(p.name)}">${
          p.vacant
            ? `${p.vacant} משרות פנויות מתוך ${p.required} תקנים`
            : `אין משרות פנויות (${p.required} תקנים)`
        }</option>`
    )
    .join("");

  // בחירה קיימת נשמרת אם היא עדיין תקפה. אחרת היא מתאפסת — אחרת המסך
  // מציג סינון שאינו קיים ברשימה ומחזיר תוצאה ריקה.
  fillOptions("a-area", data.areas, "כל האזורים");
  fillOptions("a-department", data.departments, "כל האגפים");
  fillOptions("a-unit", data.units, "כל היחידות");
}

function fillOptions(id, items, allLabel) {
  const select = el(id);
  const previous = select.value;
  const names = items.map((i) => i.name);
  select.innerHTML =
    `<option value="">${allLabel}</option>` +
    items
      .map(
        (i) =>
          `<option value="${escapeHtml(i.name)}">${escapeHtml(i.name)} — ${
            i.vacant ? `${i.vacant} פנויות` : "אין פנויות"
          }</option>`
      )
      .join("");
  select.value = names.includes(previous) ? previous : "";
}

// שם התפקיד שהוקלד, אחרי יישור לרשימה. התאמה חלקית יחידה מתקבלת — מי
// שהקליד "IT" ויש רק תפקיד אחד שמכיל אותו, התכוון אליו.
function resolveProfession(typed) {
  const term = (typed || "").trim();
  if (!term) return { value: "", error: "" };
  const names = state.adminProfessions;
  if (names.includes(term)) return { value: term, error: "" };
  const matches = names.filter((n) => n.includes(term));
  if (matches.length === 1) return { value: matches[0], error: "" };
  // כמה תפקידים תואמים אינו שגיאה: החיפוש החופשי יציג את המשרות של
  // כולם. זו הודעה, לא חסימה.
  if (matches.length > 1) return { value: "", error: `${matches.length} תפקידים תואמים` };
  return { value: "", error: `לא נמצא תפקיד בשם "${term}"` };
}

// המשרות שאפשר לגייס אליהן. **מוצגות תמיד** — בפתיחה כל 5,432, וכל סינון
// מצמצם. החיפוש רץ גם על תיאור העיסוק ולא רק על הסיווג: "אופנוען" הוא
// עיסוק, והסיווג שלו הוא "סיור" או "יס\"מ".
async function loadAdminPositions() {
  const chosen = resolveProfession(el("a-profession").value);
  const typed = el("a-profession").value.trim();
  el("a-profession").classList.toggle("input--err", Boolean(chosen.error) && !typed);
  el("a-profession").title = chosen.error || "";

  const position = el("a-position").value.trim();

  const params = new URLSearchParams();
  if (chosen.value) params.set("profession", chosen.value);
  else if (typed) params.set("q", typed);
  if (el("a-unit").value) params.set("region", el("a-unit").value);
  if (el("a-area").value) params.set("area", el("a-area").value);
  if (el("a-department").value) params.set("department", el("a-department").value);
  // §16.6: מספר משרה. סינון בפני עצמו ולא חלק מהחיפוש החופשי — מגייס
  // שיש בידו מספר משרה מחפש **אותה**, ולא תפקיד ששמו מכיל ספרות.
  if (position) params.set("position", position);
  // §24: "יחידות בלבד" — הצגת המשרות שיושבות ביחידות שהוגדרו, לצד
  // המחוזות ולא במקומם. ברירת המחדל היא הכול.
  const scopeFilter = el("a-scope") ? el("a-scope").value : "";
  if (scopeFilter) params.set("scope", scopeFilter);
  // §43: תחנה בודדת. `station_id` הוא מה שמפת החום סופרת לפיו, ולכן
  // המספר כאן זהה למה שהכרטיס מציג בשדה "תקנים חסרים".
  const stationFilter = el("a-station") ? el("a-station").value : "";
  if (stationFilter) params.set("station", stationFilter);

  const data = await api(`/api/admin-positions?${params}`);

  const stationName = stationFilter
    ? ((state.adminStations || []).find((s) => String(s.id) === stationFilter) || {}).name
    : "";
  const scope = [
    chosen.value || (typed ? `"${typed}"` : ""),
    stationName || "",
    position ? `משרה ${position}` : "",
    el("a-unit").value,
    el("a-area").value,
    el("a-department").value,
  ]
    .filter(Boolean)
    .join(" · ");
  el("admin-positions-title").textContent = scope ? `משרות פנויות — ${scope}` : "כל המשרות הפנויות";

  // §32: **אותו נוסח בכל סינון — מספר המשרות, וזה הכול.**
  //
  // קודם ההערה התחלפה: כשהרשימה לא נחתכה היא הוסיפה 'מסומנות "פנויה
  // לתכנון גיוס" עם תקן פנוי', וכשנחתכה (מעל 1,000 שורות) הטקסט הזה נעלם.
  // התוצאה: סינון מרחב (84 שורות) הציג אותו וסינון תחנות (1,048) לא —
  // וזה נראה כאילו הכלל חל רק על חלק מהסינונים. הוא חל על כולם תמיד,
  // ולכן אין מה לכתוב אותו בכלל.
  //
  // החיתוך כן נאמר, בקצרה. רשימה חתוכה שנראית שלמה היא תמונה חלקית שמגייס
  // עובד לפיה בלי לדעת — וזה גרוע יותר מהערה אחת.
  el("admin-positions-note").textContent =
    data.total > data.shown
      ? `${data.total.toLocaleString("he-IL")} משרות · מוצגות ${data.shown.toLocaleString(
          "he-IL"
        )} הראשונות`
      : `${data.total.toLocaleString("he-IL")} משרות`;

  // פילוח לפי סיווג התפקיד. כשמקלידים טקסט חופשי התוצאה עשויה לחצות כמה
  // סיווגים, והפילוח הוא מה שמראה זאת במקום להסתיר בסכום אחד.
  el("admin-positions-chips").innerHTML = data.by_label
    .map((l) => `<span class="chip">${escapeHtml(l.name)} <b>${l.n}</b></span>`)
    .join("");

  // §25: רמה 05 מוצגת רק כשיש לה נתון. קובץ בלי העמודה הזו השאיר עמודה
  // שלמה של מקפים, שנראית כמו יכולת שבורה ולא כמו נתון שטרם נטען.
  const showSubunit = Boolean(data.has_subunit);
  const th = el("th-subunit");
  if (th) th.hidden = !showSubunit;

  // §35: **מספר המשרה חזר לשורה אחת עם השאר.**
  //
  // §34 הוציא אותו לשורה משלו כי 11 עמודות לא נכנסו למסך. "מצב משרה" ירד
  // — הוא היה "פנוי" בכל שורה, כי זו כל הרשימה — והתפנה המקום.
  //
  // שדות אחרים רשאים לגלוש לשתי שורות; **מספר המשרה לא.** מזהה שנחתך
  // אינו מזהה, ולכן הוא `nowrap` גם כשהעמודה צרה.
  const columns = showSubunit ? 12 : 11;
  el("admin-positions-table").querySelector("tbody").innerHTML = data.items.length
    ? data.items
        .map(
          (p) => `<tr>
            <td class="col-position"><strong class="mono">${escapeHtml(p.position_no)}</strong></td>
            <td>${employmentText(p.employment)}</td>
            <td class="mono">${scopeText(p.scope_pct)}</td>
            <td class="mono">${vacantText(p.vacant_pct)}</td>
            <td>${escapeHtml(p.occupation || "—")}</td>
            <td>${escapeHtml(p.profession)}</td>
            <td>${escapeHtml(p.subgroup || "—")}</td>
            <td class="muted">${escapeHtml(p.rank || "—")}</td>
            <td class="muted">${escapeHtml(p.district || "—")}</td>
            <td>${escapeHtml(p.region || "—")}</td>
            <td class="muted">${escapeHtml(p.unit || "—")}</td>
            <td class="col-subunit"${showSubunit ? "" : " hidden"}>${escapeHtml(
              p.subunit || "—"
            )}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="${columns}" class="muted">אין משרות פנויות בסינון הזה.</td></tr>`;
}

// §35: סטודנט או רגיל. **סטודנט מסומן, רגיל לא** — ברשימה של אלף שורות
// שבה 96% רגילות, סימון של שתיהן מוסיף רעש ולא מידע. הצבע נושא את ההבחנה
// יחד עם המילה, ולא במקומה.
// §38: כמה מהמשרה פנוי. 100% הוא משרה שאיש אינו יושב בה, ו-25% היא משרה
// שרבע ממנה פנוי — מצב שנוצר כששניים או שלושה חולקים משרה אחת בחלקי משרה.
// מלא מוצג דהוי, וחלקי מודגש: החלקי הוא מה שדורש מהמגייס תשומת לב.
function vacantText(pct) {
  if (pct === null || pct === undefined) return '<span class="muted">—</span>';
  return pct >= 100
    ? `<span class="muted">100%</span>`
    : `<strong class="tag-partial">${pct}%</strong>`;
}

function employmentText(value) {
  if (value === "סטודנט") return '<span class="tag-student">סטודנט</span>';
  return `<span class="muted">${escapeHtml(value || "רגיל")}</span>`;
}

async function refreshAdmin() {
  // סדר קבוע: קודם האפשרויות (שמצמצמות זו את זו), ואז הטבלה לפי מה
  // שנשאר תקף. הפוך — הטבלה הייתה נבנית לפי סינון שהרגע התאפס.
  await loadAdminOptions();
  await loadAdminPositions();
}

function wireAdmin() {
  ["a-area", "a-department", "a-unit", "a-scope", "a-station"].forEach((id) => {
    if (el(id)) el(id).onchange = refreshAdmin;
  });
  // input ולא change: הסינון מגיב תוך כדי הקלדה, בלי להמתין ליציאה מהשדה.
  el("a-profession").oninput = refreshAdmin;
  el("a-position").oninput = loadAdminPositions;
  el("a-reset").onclick = () => {
    ["a-profession", "a-area", "a-department", "a-unit", "a-position", "a-scope",
     "a-station"].forEach(
      (id) => el(id) && (el(id).value = "")
    );
    refreshAdmin();
  };
}

/* --- מסך התראות ----------------------------------------------------------- */
//
// אדום = נכנס לסטטוס קריטי, ירוק = יצא ממנו. הסף נקבע במסך ההגדרות, ולכן
// שינוי סף הוא גם אירוע שמייצר התראות — וזה מכוון.

// §17.4: מי קריטי כרגע — בשמו, עם אחוז האיוש, ועם סימון האם המעבר שלו
// לקריטי נרשם ביומן. **החשבון שסוגר**: נרשמו + היו קריטיים מלכתחילה =
// קריטיים כרגע. בלי זה שני המספרים במסך נראים כמו שגיאה.
function renderCriticalNow(data) {
  const typeLabel = { station: "תחנה", region: "מרחב" };
  const items = data.critical || [];

  el("critical-note").textContent = items.length
    ? `${data.entered_open} נרשמו ביומן ככניסה · ${data.unlogged} היו קריטיים כבר בצפייה הראשונה` +
      ` — היומן רושם שינויים, לא מצב`
    : `אין ישות מתחת ל‑${data.threshold}%`;

  el("critical-list").innerHTML = items.length
    ? items
        .map(
          (c) => `<div class="alert alert--entered">
            <span class="alert-mark"></span>
            <div class="alert-body">
              <strong>${escapeHtml(typeLabel[c.entity_type] || c.entity_type)} ${escapeHtml(
            c.entity_name
          )}</strong>
              <span class="alert-text">אחוז איוש ${
                c.staffing_pct === null ? "—" : `${c.staffing_pct.toFixed(1)}%`
              } — מתחת לסף ${data.threshold}%</span>
              <span class="alert-meta">${escapeHtml(c.district || "—")} · ${
            c.logged ? "הכניסה לקריטי רשומה ביומן" : "היה קריטי כבר בצפייה הראשונה"
          }</span>
            </div>
          </div>`
        )
        .join("")
    : `<div class="card-empty">אין כרגע תחנה או מרחב מתחת לסף הקריטי.</div>`;
}

async function loadAlerts() {
  const data = await api("/api/alerts");

  el("alerts-threshold").textContent = `סף קריטי: מתחת ל‑${data.threshold}%`;

  // §17.4: **המצב קודם, ההיסטוריה אחריו.** "קריטיים כרגע" הוא המספר
  // שדורש פעולה, ושני האחרים הם היומן — כמה מהם נרשמו ככניסה, וכמה יצאו.
  // הסדר הזה הוא מה שהופך את "0 נכנסו · 1 קריטי" ממה שנראה כמו סתירה
  // למה שהוא באמת: ישות שהייתה קריטית עוד לפני שהיומן התחיל.
  el("alerts-kpis").innerHTML = [
    { n: data.critical_now, label: "קריטיים כרגע", cls: data.critical_now ? "kpi--bad" : "" },
    { n: data.entered, label: "נכנסו לסטטוס קריטי (ביומן)", cls: "" },
    { n: data.left, label: "יצאו מסטטוס קריטי (ביומן)", cls: "kpi--good" },
  ]
    .map((k) => `<div class="kpi ${k.cls}"><h3>${k.label}</h3><b>${k.n}</b></div>`)
    .join("");

  renderCriticalNow(data);

  el("alerts-note").textContent = data.enabled
    ? `${data.alerts.length} אירועים`
    : "ההתראות מכובות בהגדרות — היומן ממשיך להירשם";

  const typeLabel = { station: "תחנה", region: "מרחב" };
  el("alerts-list").innerHTML = data.alerts.length
    ? data.alerts
        .map(
          (a) => `<div class="alert alert--${a.direction}">
            <span class="alert-mark"></span>
            <div class="alert-body">
              <strong>${escapeHtml(typeLabel[a.entity_type] || a.entity_type)} ${escapeHtml(
            a.entity_name
          )}</strong>
              <span class="alert-text">${
                a.direction === "entered" ? "נכנס לסטטוס קריטי" : "יצא מסטטוס קריטי"
              }${
            a.staffing_pct === null ? "" : ` — אחוז איוש ${a.staffing_pct.toFixed(1)}%`
          }</span>
              <span class="alert-meta">${escapeHtml(a.district || "—")} · ${formatDateTime(
            a.created_at
          )}</span>
            </div>
          </div>`
        )
        .join("")
    : `<div class="card-empty">אין התראות. שינוי סטטוס קריטי יירשם כאן אוטומטית
       אחרי טעינת נתונים או שינוי סף.</div>`;

  // §17.4: התג בתפריט סופר את **מי שקריטי כרגע**, ולא את אירועי היומן.
  // תג שמראה 0 בזמן שיש תחנה קריטית הוא בדיוק אותה אי-התאמה, רק בתפריט.
  const badge = el("alerts-badge");
  badge.textContent = data.critical_now || "";
  badge.hidden = !data.critical_now;
}

function wireAlerts() {
  el("alerts-clear").onclick = async () => {
    if (!confirm("לנקות את יומן ההתראות?\n\nהמצב הנוכחי נשמר — רק היומן מתרוקן.")) return;
    await fetch("/api/alerts/clear", { method: "POST" });
    await loadAlerts();
  };
}

/* --- מסך הגדרות ----------------------------------------------------------- */

const SETTINGS_FIELDS = {
  "s-critical": "threshold_critical",
  "s-urgent": "threshold_urgent",
  "s-medium": "threshold_medium",
};

async function loadSettings() {
  const data = await api("/api/settings");
  state.settings = data;

  Object.entries(SETTINGS_FIELDS).forEach(([id, key]) => {
    const field = el(id);
    if (field.type === "checkbox") field.checked = Boolean(data[key]);
    else field.value = data[key];
  });
  renderSettingsPreview();
}

// תצוגה מקדימה של המקרא לפי מה שמוקלד כרגע, לפני שמירה. בלי זה המשתמש
// מגלה את המשמעות של המספר שהקליד רק אחרי שהוא כבר החליף צבע לכל תחנה.
function renderSettingsPreview() {
  const critical = Number(el("s-critical").value);
  const urgent = Number(el("s-urgent").value);
  const medium = Number(el("s-medium").value);
  const valid = critical < urgent && urgent < medium;

  const rows = [
    { color: "#DC2626", status: "קריטי", label: `מתחת ל‑${critical}%` },
    { color: "#EA580C", status: "דחוף", label: `${critical}% - ${urgent}%` },
    { color: "#EAB308", status: "בינוני", label: `${urgent}% - ${medium}%` },
    { color: "#16A34A", status: "תקין", label: `${medium}% ומעלה` },
  ];

  el("settings-legend").innerHTML = valid
    ? rows
        .map(
          (r) => `<div class="legend-item">
            <span class="legend-swatch" style="background:${r.color}"></span>
            <strong>${r.status}</strong><span>${r.label}</span>
          </div>`
        )
        .join("")
    : `<span class="preview-bad">הספים חייבים לעלות בסדר: קריטי &lt; דחוף &lt; בינוני</span>`;
}

async function saveSettings() {
  const payload = {};
  Object.entries(SETTINGS_FIELDS).forEach(([id, key]) => {
    const field = el(id);
    payload[key] = field.type === "checkbox" ? field.checked : field.value;
  });

  const error = el("settings-error");
  const status = el("save-status");
  error.hidden = true;
  status.textContent = "שומר…";

  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!data.ok) {
    status.textContent = "";
    error.textContent = data.error;
    error.hidden = false;
    return;
  }

  status.textContent = "נשמר ✓";
  setTimeout(() => (status.textContent = ""), 2500);

  // ספי הצבע וסף הנסיעה משנים את כל מה שמוצג. בלי רענון מלא, המפה ולוח
  // הבקרה היו ממשיכים להציג את הצבעים הישנים עד רענון ידני של הדף.
  await refreshAll();
}

function wireSettings() {
  ["s-critical", "s-urgent", "s-medium"].forEach((id) => {
    el(id).oninput = renderSettingsPreview;
  });
  el("settings-save").onclick = saveSettings;
}

/* --- ניווט בין מסכים ------------------------------------------------------ */

const SCREENS = {
  map: { el: "screen-map", nav: "nav-map", hash: "#" },
  admin: { el: "screen-admin", nav: "nav-admin", hash: "#/admin" },
  recruiter: { el: "screen-recruiter", nav: "nav-recruiter", hash: "#/recruiter" },
  strategic: { el: "screen-strategic", nav: "nav-strategic", hash: "#/strategic" },
  alerts: { el: "screen-alerts", nav: "nav-alerts", hash: "#/alerts" },
  // §16.3: ניהול הנתונים, ההגדרות וטעינת הנתונים הם **שלוש לשוניות בתוך
  // המסך הזה**, ולא שלושה מסכים. הכתובות הישנות ממשיכות לעבוד ופותחות
  // את הלשונית הנכונה.
  settings: { el: "screen-settings", nav: "nav-settings", hash: "#/settings" },
};

// #/dashboard היה מסך נפרד ואוחד לתוך לוח הבקרה. קישור שנשמר בעבר
// ממשיך לעבוד.
const SCREEN_ALIASES = {
  "#/upload": "settings",
  "#/manage": "settings",
  "#/dashboard": "strategic",
};

// כתובת -> הלשונית שנפתחת איתה. מועדף ישן ל-#/manage חייב לנחות על ניהול
// הנתונים ולא על ההגדרות, אחרת "המסך נעלם" מבחינת מי ששמר אותו.
const SETTINGS_PANE_BY_HASH = {
  "#/manage": "manage",
  "#/upload": "upload",
  "#/settings": "config",
};

const SETTINGS_PANES = ["manage", "config", "upload"];

// §16.3: הלשונית הפעילה. "שמור הגדרות" מוצג רק בלשונית ההגדרות — על מסך
// טעינת קבצים הוא כפתור שלא ברור מה הוא שומר.
function showSettingsPane(name) {
  const pane = SETTINGS_PANES.includes(name) ? name : "manage";
  state.settingsPane = pane;
  SETTINGS_PANES.forEach((key) => {
    el(`pane-${key}`).hidden = key !== pane;
  });
  document.querySelectorAll("#settings-tabs .tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.pane === pane);
  });
  el("settings-actions").hidden = pane !== "config";
  // הכתובת עוקבת אחרי הלשונית, כדי שרענון יחזיר למקום ושאפשר יהיה לשלוח
  // קישור ללשונית מסוימת. replaceState ולא hash: שינוי hash היה מפעיל את
  // המאזין ומחזיר אותנו לכאן שוב.
  if (state.screen === "settings") {
    const hash = Object.keys(SETTINGS_PANE_BY_HASH).find(
      (key) => SETTINGS_PANE_BY_HASH[key] === pane
    );
    if (hash && location.hash !== hash) history.replaceState(null, "", hash);
  }
  if (pane === "config") loadSettings();
}

function wireSettingsTabs() {
  document.querySelectorAll("#settings-tabs .tab").forEach((tab) => {
    tab.onclick = () => showSettingsPane(tab.dataset.pane);
  });
}

// מחזיר [שם המסך, ההגדרה שלו] לפי כתובת. מכבד כתובות ישנות דרך
// SCREEN_ALIASES, כדי שקישור שנשמר בעבר לא ינחת על מסך שאינו קיים.
function findScreenByHash(hash) {
  const aliased = SCREEN_ALIASES[hash];
  if (aliased) return [aliased, SCREENS[aliased]];
  return Object.entries(SCREENS).find(([, c]) => c.hash === hash);
}

function showScreen(name) {
  state.screen = name;
  Object.entries(SCREENS).forEach(([key, cfg]) => {
    el(cfg.el).hidden = key !== name;
    el(cfg.nav).classList.toggle("active", key === name);
  });

  if (name === "map") {
    syncHash(state.selectedId);
    // המפה נבנתה בזמן שהמסך שלה היה מוסתר או בגודל אחר, ואז Leaflet מחשיב
    // גודל שגוי ומצייר אריחים באזור חלקי. invalidateSize מיישר אותה לגודל
    // האמיתי בכל חזרה למסך.
    if (state.map) state.map.invalidateSize();
    return;
  }

  const hash = SCREENS[name].hash;
  if (location.hash !== hash) history.replaceState(null, "", hash);

  if (name === "recruiter") loadRecruiter();
  if (name === "strategic") loadBoard();
  if (name === "alerts") loadAlerts();
  if (name === "admin") refreshAdmin();
  // ההגדרות נטענות מחדש בכל כניסה ללשונית שלהן: אם נשמרו במקום אחר,
  // המסך היה מציג ערך ישן.
  if (name === "settings") {
    loadManageData().then(() => showSettingsPane(state.settingsPane || "manage"));
  }
}

// §31: מערכי הנתונים של מסך ההגדרות — נטענים בכניסה אליו ולא בעליית
// המערכת.
//
// הם היו 2.8MB מתוך 6.3MB שהדפדפן הוריד **בכל רענון**, גם למי שרק פתח את
// המפה. בפלאפון זה נראה כמו מערכת תקועה, וזה מה שדווח.
//
// **נטענים פעם אחת ומרועננים אחרי כל עריכה** (refreshUnits ואחיותיה עושות
// זאת ממילא). `loaded` מונע הורדה חוזרת של 1.4MB בכל מעבר בין לשוניות.
let manageDataLoaded = false;

async function loadManageData(force = false) {
  if (manageDataLoaded && !force) return;
  const [adminRows, occupationGroups, editableUnits, changeLog, unitAliases] =
    await Promise.all([
      api("/api/admin-rows"),
      api("/api/occupation-groups"),
      api("/api/units"),
      api("/api/change-log"),
      api("/api/unit-aliases"),
    ]);
  state.adminRows = adminRows;
  state.occupationGroups = occupationGroups;
  state.units_editable = editableUnits;
  state.changeLog = changeLog;
  state.unitAliases = unitAliases;
  manageDataLoaded = true;
}

function wireNav() {
  Object.entries(SCREENS).forEach(([key, cfg]) => {
    el(cfg.nav).onclick = () => showScreen(key);
  });
}

/* --- הזדהות למסך העריכה --------------------------------------------------- */
//
// הצפייה פתוחה; השינוי דורש סיסמה. הכתובת /admin היא הקישור הנפרד לעריכה —
// אותו דף, הרשאה אחרת. אין כאן החלטת אבטחה: הבדיקה האמיתית היא בשרת
// (before_request חוסם כל בקשה שמשנה נתונים). מה שכאן הוא מה שמוצג.

/* --- לוחות מידע ----------------------------------------------------------- */

function renderStats(health, stations, unitHeat) {
  const critical = stations.filter((s) => s.status_key === "critical").length;
  const urgent = stations.filter((s) => s.status_key === "urgent").length;
  const unverified = stations.filter((s) => !s.coord_verified).length;
  const units = unitHeat || { regions_count: 0, units_count: 0, units_defined: false };

  el("stats").innerHTML = [
    { n: health.stations, label: "תחנות" },
    // "יישובים במפה" הוא מספר יישובי המיקוד, ולא כל היישובים שבמאגר:
    // המפה מציגה רק אותם, וכל השאר עדיין קיימים לחיפוש ולקשרים.
    { n: state.focusSettlements, label: "יישובים במפה" },
    { n: health.relations, label: "קשרי תחנה‑יישוב" },
    {
      n: units.regions_count + units.units_count,
      // המספר בלי הקובץ הוא המרחבים בלבד. בלי הכיתוב הוא נקרא כאילו
      // אלה כל היחידות.
      label: units.units_defined ? "יחידות ומחוזות" : "מחוזות (טרם נטען קובץ יחידות)",
    },
    { n: critical + urgent, label: "תחנות קריטי / דחוף" },
    { n: unverified, label: "תחנות בלי אימות קואורדינטה" },
  ]
    .map((s) => `<div class="stat"><b>${s.n}</b><span>${s.label}</span></div>`)
    .join("");
}

function renderLegend(legend) {
  el("legend").innerHTML =
    `<div class="legend-title">אחוז איוש</div>` +
    legend
      .map(
        (l) => `<div class="legend-item">
          <span class="legend-swatch" style="background:${l.color}"></span>
          <strong>${l.status}</strong><span>${l.label}</span>
        </div>`
      )
      .join("");
}

function renderStationsTable(stations) {
  const nearbyCount = new Map();
  state.relations
    .filter((r) => r.within_nearby)
    .forEach((r) => nearbyCount.set(r.station_id, (nearbyCount.get(r.station_id) || 0) + 1));

  el("stations-note").textContent = `${stations.length} תחנות · לחיצה על שורה בוחרת את התחנה במפה`;

  el("stations-table").querySelector("tbody").innerHTML = stations
    .map(
      (s) => `<tr data-id="${s.id}">
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td class="muted">${escapeHtml(s.area || "—")}</td>
        <td>${pctFull(s)}</td>
        <td><span class="pill" style="background:${s.color}">${s.status}</span></td>
        <td>${missingText(s)}</td>
        <td>${nearbyCount.get(s.id) || 0}</td>
      </tr>`
    )
    .join("");

  el("stations-table")
    .querySelectorAll("tbody tr")
    .forEach((tr) => {
      // לחיצה על שורה בזמן שהטאב השני פתוח חייבת קודם לחזור לטאב התחנות,
      // אחרת היינו בוחרים id של תחנה בתוך מצב שמכיר רק יישובים.
      tr.onclick = () => {
        switchMode("stations");
        selectEntity(Number(tr.dataset.id));
      };
    });
}

/* --- טעינה ורענון --------------------------------------------------------- */

// כל מסך במערכת נשען על אותם נתונים. אחרי העלאה או עריכה הכול חייב
// להתעדכן — מפה, לוח בקרה וטבלאות — ולכן יש נקודת רענון אחת ולא סנכרון
// ידני של כל מסך בנפרד, שהיה משאיר מסך אחד מציג נתון מת.
async function refreshAll() {
  const health = await api("/api/health");
  setHealth("ok", "מערכת מחוברת");
  state.nearbyMinutes = health.nearby_minutes;
  // בלי נתוני אוכלוסייה אין סינון "יישובים גדולים" — מפה ריקה נראית כמו
  // תקלה ולא כמו נתון חסר.
  state.populationKnown = health.population_known > 0;
  state.largePopulation = health.large_settlement_population || 20000;
  // §14.2: הרשימה שנמסרה מחליפה את סף האוכלוסייה כקובעת מי מוצג ומי
  // מודגש. הסף עצמו נשאר במערכת — כשיגיע קובץ אוכלוסייה הוא עדיין
  // המספר שמוצג לצד היישוב.
  state.focusSettlements = health.focus_settlements || 0;

  // /api/regions מחזיר את שמות המרחבים לרשימות הסינון; /api/regions/heat
  // מחזיר את מפת החום שלהם. שני נתונים שונים, ולכן שני נתיבים.
  // §31: **חמישה מערכי נתונים ירדו מהטעינה הראשונית.** הם נצרכים רק במסך
  // ההגדרות, והם היו 2.8MB מתוך 6.3MB שהדפדפן הוריד בכל רענון — גם למי
  // שרק רצה לראות את המפה. בפלאפון זה נראה כמו מערכת תקועה.
  //
  // הם נטענים עכשיו בכניסה למסך ההגדרות (ראו loadManageData), בדיוק כמו
  // שמסך מבנה הנתונים נטען בכניסה אליו.
  const [legend, stations, settlements, relations, lastUpdate, regions, regionHeat,
         regionRelations, candidates, unitLocations, unitHeat] =
    await Promise.all([
      api("/api/legend"),
      api("/api/stations"),
      api("/api/settlements"),
      api("/api/relations"),
      api("/api/last-update"),
      api("/api/regions"),
      api("/api/regions/heat"),
      api("/api/region-relations"),
      api("/api/candidates-breakdown"),
      api("/api/unit-locations"),
      api("/api/units/heat"),
    ]);

  state.stations = stations;
  state.settlements = settlements;
  state.regions = regionHeat;
  state.relations = relations;
  state.stationsById = new Map(stations.map((s) => [s.id, s]));
  state.settlementsById = new Map(settlements.map((s) => [s.id, s]));
  state.regionsById = new Map(regionHeat.map((r) => [r.id, r]));
  state.units = unitHeat.items;
  state.unitsById = new Map(unitHeat.items.map((u) => [u.id, u]));
  state.regionRelations = regionRelations;
  state.candidateScopes = candidates.scopes;

  state.unitLocations = unitLocations.units;
  // רשימת היישובים ל-datalist נבנית פעם אחת: 1,400 אפשרויות בכל שורה
  // היו הופכות את הטבלה לאיטית בלי להוסיף דבר.
  el("settlement-options").innerHTML = unitLocations.settlements
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");

  // תת-הכותרות בבורר המפה נגזרות מהנתונים ולא כתובות בקשיח, אחרת הן
  // מתיישנות ברגע שנטען קובץ אחר.
  const sub = {
    "tab-stations": `${stations.length} תחנות`,
    // התיאור נקבע על ידי המזמין (שינויים 14, סעיף 3) ואינו נגזר מהנתונים.
    // המונים עברו לכותרת הפאנל שמתחת למפה, כדי שהתיאור יישאר כפי שנמסר.
    "tab-units": "יחידות ומחוזות",
    "tab-regions": `${regionHeat.length} מרחבים`,
    "tab-settlements": `${settlements.length.toLocaleString("he-IL")} יישובים`,
  };
  Object.entries(sub).forEach(([id, text]) => {
    const node = el(id) && el(id).querySelector(".scope-sub");
    if (node) node.textContent = text;
  });

  el("last-update").textContent = formatDateTime(lastUpdate.last_update);
  el("live-age").textContent = timeAgo(lastUpdate.last_update);
  renderStats(health, stations, unitHeat);
  renderLegend(legend);
  renderStationsTable(stations);
  renderManageKpis();
  fillManageSelects();
  renderManageTable();

  if (state.map) {
    // טעינה חדשה יכולה למחוק את מה שהיה נבחר. אם הוא עדיין קיים — הבחירה
    // נשמרת; אם לא — חוזרים למבט הכללי במקום להשאיר חלונית של ישות שאיננה.
    const previous = state.selectedId;
    renderBaseMarkers();
    const stillExists = searchBase().some((e) => e.id === previous);
    selectEntity(stillExists ? previous : null, { animate: false });
  }

  if (state.screen === "recruiter") await loadRecruiter();
  if (state.screen === "strategic") await loadBoard();
  // רשימות הסינון נבנות מהנתונים, ולכן הן מתרעננות אחרי טעינת קובץ מנהלה.
  await loadAdminOptions().catch(() => {});
  if (state.screen === "admin") await loadAdminPositions();
  // התג בתפריט מתעדכן תמיד, גם כשמסך ההתראות סגור — אחרת התראה חדשה
  // נראית רק למי שכבר נמצא שם.
  await loadAlerts().catch(() => {});
  // הסינונים נבנים מרשימת התחנות, ולכן הם מתרעננים אחרי כל טעינת נתונים —
  // מרחב שנוסף או נעלם חייב להופיע ברשימה בלי לרענן את הדף.
  [recruiterFilter, strategicFilter].forEach((f) => {
    if (f) f.refresh();
  });
}

/* --- אתחול ---------------------------------------------------------------- */

async function init() {
  try {
    // נקרא ראשון: refreshAll מנקה את הבחירה במפה ומסנכרן כתובת, וזה דורס
    // את ה-hash שאיתו המשתמש נכנס לפני שהספקנו לקרוא אותו.
    const initialHash = location.hash;

    wireSearch();
    wireSheetGestures();
    wireTabs();
    wireNav();
    wireUpload();
    wireManage();
    wireSettings();
    wireSettingsTabs();
    wireAlerts();
    wireAdmin();
    watchTableLabels();

    await initMap();
    await refreshAll();
    wireFilters();
    wireRecruiter();
    await wireStrategic();

    // כניסה דרך קישור ישיר נוחתת על הטאב והישות הנכונים, בלי אנימציה —
    // אין טעם להנפיש מעבר ממבט שהמשתמש מעולם לא ראה.
    const target = parseHash(initialHash);
    if (target) {
      state.mode = target.mode;
      markActiveTab(target.mode);
      el("search").placeholder = mode().placeholder;
      renderBaseMarkers();
    }
    fitToBase();
    if (target) selectEntity(target.id, { animate: false });

    const screenByHash = findScreenByHash(initialHash);

    window.addEventListener("hashchange", () => {
      const match = findScreenByHash(location.hash);
      if (match && match[0] !== "map") {
        if (match[0] === "settings" && SETTINGS_PANE_BY_HASH[location.hash])
          state.settingsPane = SETTINGS_PANE_BY_HASH[location.hash];
        return showScreen(match[0]);
      }
      const next = parseHash();
      if (!next) return selectEntity(null);
      showScreen("map");
      switchMode(next.mode, { animate: false });
      selectEntity(next.id);
    });

    // §22.1: **הפתיחה תמיד על מפת החום.**
    //
    // הדפדפן שומר את ה-hash, ולכן מי שסגר את המערכת במסך ההגדרות נחת שם
    // גם בפתיחה הבאה — לפעמים ימים אחרי. זו התנהגות נכונה לקישור שנשלח,
    // ושגויה לפתיחה יומיומית: המסך הראשון הוא נקודת ההתחלה של העבודה.
    //
    // ההבחנה: **קישור שנפתח בכוונה מול חזרה למערכת.** קישור לישות
    // (#station/5) הוא כוונה מפורשת ונשמר; hash של מסך (#/settings)
    // הוא רק היכן שהמשתמש היה, ולכן מנוקה.
    if (screenByHash && screenByHash[0] !== "map" && !target) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  } catch (err) {
    setHealth("err", "אין חיבור למאגר");
    document
      .querySelector(".content")
      .insertAdjacentHTML(
        "afterbegin",
        `<div class="error-banner">השרת עלה אבל המאגר לא נענה (${escapeHtml(err.message)}).
         הרץ טעינה: <code>python tools\\load_all.py</code></div>`
      );
  }
}

init();
