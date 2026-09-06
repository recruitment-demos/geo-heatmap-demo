/* ---------------------------------------------------------------------------
   demo.js — שכבת ההדגמה. נטענת **לפני** app.js, ומיישרת את ההבדלים בין
   הרצה על שרת Flask לבין אירוח סטטי.

   העיקרון: app.js כאן **זהה בייט-לבייט** לזה שרץ על השרת. אין פה פורק ואין
   שני קודים שיכולים להיפרד — כל ההתאמה יושבת בקובץ הזה, וכל שינוי במערכת
   מגיע לדמו בהעתקת קובץ והרצת שני סקריפטים.

   שלושה דברים מטופלים כאן:

   1. **נתונים.** אין שרת, ולכן fetch של /api/* מוסט לקובצי JSON סטטיים
      תחת data/. הקבצים אינם כתובים ביד — הם הוקפאו מהשרת האמיתי כשהוא רץ
      מול מאגר שכל הנתונים בו מוגרלים (tools/build_demo_db.py +
      tools/freeze_demo_api.py בפרויקט המלא). לכן צורות התשובה נכונות תמיד.

   2. **כתיבה.** טעינת אקסל, עריכת קשרים, שמירת הגדרות ומחיקות — כולן
      מחזירות תשובת "מוקפא" מנומסת במקום להיכשל ברשת. המשתמש רואה למה,
      ולא שגיאה סתומה.

   3. **רקע המפה.** בהתקנה המבצעית הרקע הוא חבילת אריחים מקומית (§18.1,
      רשת סגורה). באירוח ציבורי אין מי שיגיש אותה, ולכן כאן מוזרק רקע
      מקוון דרך נקודת החיבור שהמערכת חושפת.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  /* --- 3. רקע המפה ------------------------------------------------------- */
  //
  // אין כאן override יותר. הרקע הוא אותו מתאר מקומי שהמערכת מציירת בשרת
  // (web/vendor/israel.geojson) — הדמו מציג בדיוק את מה שהמזמין רואה,
  // ולא מפה יפה יותר שאינה קיימת אצלו. גם כאן: אפס פניות לספק חיצוני.

  /* --- 1. ניתוב הנתונים -------------------------------------------------- */

  // רוב הנתיבים הם קובץ-לנתיב: /api/regions/heat -> data/regions__heat.json.
  const flatten = (apiPath) =>
    "data/" + apiPath.replace(/^\/api\//, "").replace(/\/+$/, "").replace(/\//g, "__") + ".json";

  // שתי נקודות קצה שהפרמטר בהן משנה את התשובה נשמרו כ"חבילה" — אובייקט אחד
  // שממפה שאילתה לתשובה. הסיבה מעשית: שם מרחב יכול להכיל גרשיים, וויסנדוז
  // אינה מרשה אותם בשם קובץ. המטמון מונע הורדה חוזרת בכל ריחוף.
  const bundles = {};
  async function fromBundle(file, key) {
    if (!bundles[file]) {
      const res = await fetch("data/" + file);
      if (!res.ok) throw new Error(file + " → " + res.status);
      bundles[file] = await res.json();
    }
    return bundles[file][key];
  }

  const json = (payload, status) =>
    new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });

  const FROZEN = {
    ok: false,
    error:
      "פעולה זו זמינה בגרסת השרת המלאה. ההדגמה הזו היא תצוגה בלבד — " +
      "היא רצה ללא שרת, על נתונים מוגרלים קפואים.",
  };

  async function serve(url, init) {
    const method = ((init && init.method) || "GET").toUpperCase();
    const [path, query = ""] = url.split("?");

    // כל מה שאינו GET הוא פעולת כתיבה: טעינת קובץ, עריכה, מחיקה, שמירה.
    if (method !== "GET") return json(FROZEN, 200);

    // פירוט תחנה — קובץ לכל תחנה.
    const detail = path.match(/^\/api\/stations\/(\d+)\/detail$/);
    if (detail) {
      const res = await fetch(`data/station-detail/${detail[1]}.json`);
      if (!res.ok) throw new Error(path + " → " + res.status);
      return json(await res.json());
    }

    // פילוח עיסוקים — המפתח הוא מחרוזת השאילתה כלשונה (ריקה = ארצי).
    if (path === "/api/role-occupations") {
      const found = await fromBundle("role-occupations__by-scope.json", query);
      return json(found || {});
    }

    // --- הסינון ההיררכי: מחוז → מרחב → תחנה ------------------------------
    //
    // שלושת המסכים האלה נשענים עליו, וקודם הם קיבלו תמיד את התמונה הארצית:
    // הבורר זז והמסך לא. עכשיו כל 119 מצבי הסינון מוקפאים מראש מהשרת
    // האמיתי, ולכן גם המספרים וגם הכותרות נכונים — הם מגיעים מאותה תשובה
    // בדיוק שהשרת היה מחזיר.
    //
    // המפתח הוא **הרמה הספציפית ביותר בלבד**. הסינון היררכי, ולכן תחנה
    // מגדירה חד-משמעית גם את המרחב וגם את המחוז; צירופים היו מכפילים את
    // מספר הקבצים בלי להוסיף ולו תשובה אחת שונה.
    //
    // לשני מסכים יש בורר נוסף מעל ההיררכיה, והוא קידומת למפתח: המקצוע
    // בלוח הבקרה, וכמות התחנות (N) בתכנון האסטרטגי. שניהם מחושבים בשרת
    // ולכן אינם ניתנים לסינון כאן.
    const SCOPED = {
      "/api/dashboard": "dashboard__by-scope.json",
      "/api/recruiter": "recruiter__by-scope.json",
      "/api/strategic": "strategic__by-scope.json",
    };
    if (SCOPED[path]) {
      const p = new URLSearchParams(query);
      const station = p.get("station");
      const region = p.get("region");
      const district = p.get("district");
      const scope = station
        ? `s|${station}`
        : region
          ? `r|${region}`
          : district
            ? `d|${district}`
            : "all";
      const prefix =
        path === "/api/dashboard"
          ? p.get("family") || ""
          : path === "/api/strategic"
            ? p.get("n") || "10"
            : "";
      const found = await fromBundle(SCOPED[path], prefix ? `${prefix}|${scope}` : scope);
      // ממשק המגייס מסנן גם לפי סטטוס וטקסט חופשי. אלה אינם ניתנים
      // להקפאה — טקסט חופשי אינו רשימה סגורה — ולכן הם מיושמים כאן,
      // על התשובה המוקפאת. ראו recruiterFilter.
      if (found) return json(path === "/api/recruiter" ? recruiterFilter(found, p) : found);
    }

    // §57: "המלצה לפי יישוב" (§55) — קובץ לכל יישוב, כמו פירוט תחנה.
    //
    // המסך שולח **שם**, והקבצים נקראים לפי **מזהה**: שם יישוב יכול
    // להכיל גרשיים, וויסנדוז אינה מרשה אותם בשם קובץ. התרגום שביניהם
    // הוא settlementId, והוא מיישם את כלל ההתאמה של השרת ולא כלל משלו.
    if (path === "/api/settlement-advice") {
      const p = new URLSearchParams(query);
      const id = p.get("settlement_id") || (await settlementId(p.get("settlement") || ""));
      const res = await fetch(`data/settlement-advice/${id || "none"}.json`);
      if (!res.ok) throw new Error(path + " → " + res.status);
      return json(await res.json());
    }

    // מסך המנהלה — הסינון מחושב כאן, ראו adminOptions/adminPositions.
    if (path === "/api/admin-options") return json(await adminOptions(query));
    if (path === "/api/admin-positions") return json(await adminPositions(query));
    // §58: בורר התחנה. המספר שליד כל תחנה תלוי בכל שאר הסינונים, ולכן
    // הוא מחושב ואינו נקרא מהקובץ הקפוא — הקובץ נותן את הרשימה והסדר.
    if (path === "/api/admin-stations") return json(await adminStations(query));
    if (path === "/api/admin-gaps") {
      const scope = new URLSearchParams(query).get("scope") || "";
      const found = await fromBundle("admin-gaps__by-scope.json", scope);
      if (found) return json(found);
    }

    const res = await fetch(flatten(path));
    if (!res.ok) throw new Error(path + " → " + res.status);
    return json(await res.json());
  }

  /* --- שם יישוב ➜ מזהה --------------------------------------------------
     אותו כלל של השרת (_settlement_row ב-app.py): התאמה מדויקת קודם, ורק
     אחר כך "מכיל" — הקצר ביותר, ואז לפי סדר האותיות. "רמלה" ו"רמת גן"
     מכילות שתיהן "רמ", ומי שהקליד שם מלא צריך לקבל אותו ולא את הראשון
     ברשימה שבמקרה מתחיל כמוהו.

     הרשימה נטענת פעם אחת ונשמרת: היא כבר מוגשת למסך (data/settlements.json),
     וזו אותה הורדה. */
  let settlementList = null;
  async function settlementId(term) {
    term = term.trim();
    if (!term) return null;
    if (!settlementList) {
      const res = await fetch("data/settlements.json");
      if (!res.ok) throw new Error("settlements → " + res.status);
      settlementList = await res.json();
    }
    const exact = settlementList.find((s) => s.name === term);
    if (exact) return exact.id;
    // SQLite: ORDER BY LENGTH(name), name LIMIT 1 — השוואה בינארית, ולכן
    // לא localeCompare: היא הייתה ממיינת אחרת ובוחרת יישוב אחר.
    const like = settlementList
      .filter((s) => s.name.indexOf(term) !== -1)
      .sort(
        (a, b) =>
          a.name.length - b.name.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
      );
    return like.length ? like[0].id : null;
  }

  /* --- ממשק המגייס: סטטוס וחיפוש חופשי -----------------------------------
     שני הסינונים האלה אינם ניתנים להקפאה. הסטטוס היה אפשרי (ארבעה ערכים),
     אבל החיפוש החופשי אינו רשימה סגורה — ומסך שבו חצי מהסרגל עובד גרוע
     ממסך שבו כולו עובד.

     בשרת שניהם **מסננים את רשימת התחנות אחרי שהיא נבנתה**, ואז ה-KPI
     והעץ נגזרים ממה שנשאר. אותו סדר בדיוק כאן, על התשובה המוקפאת: אין
     חישוב חדש, יש בחירה מתוך שורות שהשרת כבר חישב. העץ נשמר במבנהו
     המקורי ורק נחתך, כדי שסדר המחוזות והמרחבים יישאר של השרת. */
  function recruiterFilter(payload, p) {
    const status = p.get("status") || "";
    const term = (p.get("q") || "").trim();
    if ((!status && !term) || !payload.tree) return payload;

    const matches = (s) =>
      [s.name, s.district || "", s.area || ""]
        .concat((s.nearby_settlements || []).map((n) => n.name))
        .some((value) => value.indexOf(term) !== -1);

    const kept = new Set();
    payload.tree.forEach((d) =>
      d.areas.forEach((a) =>
        a.stations.forEach((s) => {
          if ((!term || matches(s)) && (!status || s.status_key === status)) kept.add(s);
        })
      )
    );

    const tree = payload.tree
      .map((d) => ({
        district: d.district,
        areas: d.areas
          .map((a) => ({ area: a.area, stations: a.stations.filter((s) => kept.has(s)) }))
          .filter((a) => a.stations.length),
      }))
      .filter((d) => d.areas.length);

    // סכום מה שיש עליו נתון. אין לאף אחד — null, ולא 0: אפס נקרא כמו
    // מספר, והיעדר נתון נקרא כמו מה שהוא.
    const rows = [...kept];
    const sum = (key) => {
      const values = rows.map((s) => s[key]).filter((v) => v !== null && v !== undefined);
      return values.length ? values.reduce((a, b) => a + b, 0) : null;
    };
    const required = sum("required_positions");
    const actual = sum("actual_positions");
    const missing = sum("missing_positions");
    const pct = required ? Math.round((actual / required) * 1000) / 10 : null;

    return Object.assign({}, payload, {
      units_count: rows.length,
      kpis: {
        total_required: { available: Boolean(required), value: required },
        actual: { available: actual !== null, value: actual, pct: actual === null ? null : pct },
        gap: { available: missing !== null, value: missing === null ? null : -missing },
        critical_units: Object.assign({}, payload.kpis.critical_units, {
          value: rows.filter((s) => s.status_key === "critical").length,
        }),
      },
      tree: tree,
    });
  }

  /* --- סינון מסך המנהלה -------------------------------------------------
     ארבעת הסינונים (תפקיד · אזור · אגף · יחידה) הם מכפלה קרטזית של אלפי
     צירופים, ולכן אי אפשר להקפיא קובץ לכל אחד. הפשרה: מקפיאים את חומר
     הגלם פעם אחת, והסינון עצמו רץ בדפדפן.

     זה **המקום היחיד בדמו שמחשב משהו** במקום להציג תשובה של השרת, והוא
     מוגבל בכוונה לשוויון על ארבעה שדות ולחיפוש תת-מחרוזת. ההגדרות שקל
     לטעות בהן — מהי "משרה שאפשר לגייס אליה", מהו היקף המשרה, ומה סדר
     המיון — נשארו בשרת: הקובץ admin-vacancies כבר מסונן, מחושב וממוין
     על ידו, וכאן רק בוררים ממנו. */

  const cache = {};
  async function table(name) {
    if (!cache[name]) {
      const res = await fetch("data/" + name + ".json");
      if (!res.ok) throw new Error(name + " → " + res.status);
      cache[name] = await res.json();
    }
    return cache[name];
  }

  // שם הפרמטר במסך אינו שם העמודה בנתונים — "אזור" הוא geo_area, "יחידה"
  // היא region. המיפוי במקום אחד, כדי ששני הצרכנים לא יסטו זה מזה.
  const FIELD = { profession: "profession", area: "geo_area",
                  department: "department", region: "region" };

  const params = (q) => {
    const p = new URLSearchParams(q);
    return {
      profession: p.get("profession") || "", area: p.get("area") || "",
      department: p.get("department") || "", region: p.get("region") || "",
      q: (p.get("q") || "").trim(), position: (p.get("position") || "").trim(),
      // §58: תחנה בודדת. מזהה ולא שם — כמו בשרת.
      station: p.get("station") || "",
      // §31: סינון היחידה. הוא **אינו** מחושב כאן — הוא נשען על רשימת
      // היחידות המוגדרות ועל טבלת ההיררכיה, ושתיהן בשרת. חומר הגלם מוקפא
      // פעם לכל אחד מחמשת הערכים, וכאן רק נבחר הנכון.
      scope: p.get("scope") || "",
    };
  };

  const matches = (row, f, skip) =>
    Object.keys(FIELD).every(
      (key) => key === skip || !f[key] || row[FIELD[key]] === f[key]
    ) &&
    // §58: התחנה אינה ב-FIELD כי היא מזהה מספרי ולא שם, אבל היא מסננת
    // בדיוק כמו השאר — ו-skip חל גם עליה: בורר התחנה מחושב בלי עצמו.
    (skip === "station" || !f.station || String(row.station_id) === f.station);

  async function adminOptions(query) {
    const f = params(query);
    const facets = (await table("admin-facets"))[f.scope] || [];

    // כל רשימה מחושבת מול *שאר* הסינונים ולא מול עצמה — אחרת הבחירה
    // הנוכחית מצמצמת את הרשימה שממנה היא נבחרה, והמשתמש ננעל עליה.
    // §58: "שאר הסינונים" כולל את התחנה, ולכן חומר הגלם נושא station_id.
    const group = (key) => {
      const totals = new Map();
      facets.forEach((row) => {
        const name = row[FIELD[key]];
        if (!name || !matches(row, f, key)) return;
        const acc = totals.get(name) || { name: name, vacant: 0, required: 0 };
        acc.vacant += row.vacant || 0;
        acc.required += row.required || 0;
        totals.set(name, acc);
      });
      // §59: אפשרות בלי משרה פנויה אינה מוצגת — חוץ מהבחירה הנוכחית,
      // שנשארת גם ב-0 כדי שלא תיעלם מתחת לאצבע. אותו כלל של השרת.
      const keep = f[key] || null;
      return [...totals.values()]
        .filter((o) => o.vacant > 0 || o.name === keep)
        .map((o) => ({ name: o.name, vacant: o.vacant, required: Math.round(o.required) }))
        .sort((a, b) => a.name.localeCompare(b.name, "he"));
    };

    return {
      professions: group("profession"), areas: group("area"),
      departments: group("department"), units: group("region"),
    };
  }

  const like = (value, term) => String(value || "").indexOf(term) !== -1;

  // §58: **תנאי אחד לשורת משרה**, לטבלה ולבורר התחנה כאחד. שני מסננים
  // לאותה שאלה נפרדים ביום שאחד מהם משתנה, וזו בדיוק התקלה שתוקנה כאן.
  // skip: הסינון שיש להתעלם ממנו (בורר אינו מצמצם את עצמו).
  function vacancyMatches(row, f, skip) {
    if (!matches(row, f, skip || null)) return false;
    // §31: השורה נושאת את הסינונים שהיא שייכת להם, כי מי שקובע זאת הוא
    // השרת — ראו הערת scope למעלה.
    if (f.scope && (row.scopes || []).indexOf(f.scope) === -1) return false;
    // חיפוש חופשי מחפש גם בסיווג, גם בתיאור העיסוק, גם במספר המשרה וגם
    // בשם רמה 05: מי שמדביק מספר לשדה מחפש משרה, ומי שמקליד שם יחידה
    // מחפש אותה — ורשימה שמחפשת רק בסיווג מחזירה לשניהם ריק.
    if (f.q && !f.profession &&
        !(like(row.profession, f.q) || like(row.occupation, f.q) ||
          like(row.position_no, f.q) || like(row.subunit, f.q)))
      return false;
    if (f.position && !like(row.position_no, f.position)) return false;
    return true;
  }

  async function adminPositions(query) {
    const f = params(query);
    const meta = await table("admin-meta");
    const LIMIT = meta.limit; // POSITIONS_LIMIT בשרת

    const rows = (await table("admin-vacancies")).filter((row) =>
      vacancyMatches(row, f, null)
    );

    // §38: כל שורה בקובץ הקפוא היא **משרה אחת**: מספר שחוזר בכמה שורות
    // בקובץ המקור אוחד כבר בשרת, לפני ההקפאה. הספירה כאן היא לכן ספירת
    // משרות, לא ספירת שורות.
    const counts = new Map();
    rows.forEach((row) => counts.set(row.profession, (counts.get(row.profession) || 0) + 1));
    const byLabel = [...counts.entries()]
      .map(([name, n]) => ({ name: name, n: n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    // `scopes` ו-`station_id` הם חומר עבודה של ההדגמה ולא שדות שהשרת
    // מחזיר בפריט. הם יורדים כאן, כדי שהתשובה תהיה **זהה** לזו של השרת
    // ולא "כמעט זהה": שדה עודף בתשובה מזמין קוד שנשען עליו, וכזה לא
    // יעבוד בהתקנה האמיתית.
    const items = rows.slice(0, LIMIT).map((row) => {
      const item = Object.assign({}, row);
      delete item.scopes;
      delete item.station_id;
      return item;
    });
    return {
      profession: f.profession || null, q: f.q, position: f.position,
      area: f.area || null, department: f.department || null, region: f.region || null,
      scope: f.scope,
      // §25: עמודת רמה 05 מוצגת רק כשיש במאגר נתון כזה. זו תשובה של
      // השרת (admin-meta), ולא ניחוש מתוך אלף השורות שהוחזרו במקרה.
      has_subunit: meta.has_subunit,
      total: rows.length, shown: items.length, limit: LIMIT,
      by_label: byLabel, items: items,
    };
  }

  // §58: **כמה משרות תציג כל תחנה, תחת הסינון שפעיל עכשיו.**
  //
  // קודם זה היה קובץ קפוא אחד: המספר הארצי של כל תחנה, בלי קשר לסרגל.
  // מי שסינן וקיבל שש משרות פתח את הבורר וראה מאות — וזה נקרא כמו סינון
  // שאינו עובד. הספירה כאן היא על **אותן שורות שהטבלה מציגה** (קובץ
  // admin-vacancies, שכבר מסונן ומאוחד בשרת), ולכן שני המספרים אינם
  // יכולים להיפרד.
  //
  // בלי הסינון של התחנה עצמה — הבורר אינו מצמצם את עצמו — ועם כל
  // התחנות ברשימה, גם אלה שאין להן משרה (0 מפורש), כדי שבחירה קיימת
  // לא תיעלם מתחת לאצבע.
  async function adminStations(query) {
    const f = params(query);
    const counts = new Map();
    (await table("admin-vacancies")).forEach((row) => {
      if (row.station_id === null || row.station_id === undefined) return;
      if (!vacancyMatches(row, f, "station")) return;
      counts.set(row.station_id, (counts.get(row.station_id) || 0) + 1);
    });
    // §59: רק תחנות שיש בהן משרה תחת הסינון, והתחנה שנבחרה בכל מקרה.
    const keep = f.station ? Number(f.station) : null;
    return (await table("admin-stations"))
      .filter((s) => (counts.get(s.id) || 0) > 0 || s.id === keep)
      .map((s) => ({
        id: s.id,
        name: s.name,
        area: s.area,
        vacant: counts.get(s.id) || 0,
      }));
  }

  // פרמטרי סינון אינם נתמכים בלי שרת: מסכי הסינון מוקפאים, וכל בקשה
  // מקבלת את התמונה הארצית המלאה — בדיוק מה שהמסכים מציגים.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    if (typeof url === "string" && url.indexOf("/api/") === 0) {
      return serve(url, init).catch((err) => json({ ok: false, error: err.message }, 502));
    }
    // נכסי המערכת נטענים ב-app.js בנתיב מוחלט תחת /web — כך הם מוגשים
    // בשרת. באירוח סטטי האתר יושב תחת נתיב משנה (‎/geo-heatmap-demo/‎),
    // ולכן /web/... מצביע לשורש הדומיין ומחזיר 404. זה מה שהשאיר את
    // המפה ריקה כאן בזמן שבשרת היא נראתה תקינה.
    if (typeof url === "string" && url.indexOf("/web/") === 0) {
      return nativeFetch(url.slice(5), init);
    }
    return nativeFetch(input, init);
  };

  /* --- 2. הקפאת פקדי הכתיבה ---------------------------------------------

     הדרישה: **הכול מוצג, שום דבר לא ניתן ללחיצה, והריחוף מסביר למה.**

     לכן לא משתמשים כאן ב-disabled. אלמנט מנוטרל אינו מקבל אירועי עכבר
     בכלל — ה-title שלו אינו נפתח וה-cursor שלו אינו משתנה, ולכן המשתמש
     מגלה שהוא מוקפא רק אחרי שלחץ ולא קרה כלום. במקום זה הפקד נשאר "חי"
     לדפדפן, ומסומן ב-aria-disabled + title, והחסימה עצמה נעשית בשלב
     ה-capture על document: לחיצה, הקלדה ושינוי נבלעים לפני שהם מגיעים
     ל-app.js. התוצאה: tooltip עובד, סמן "אסור" מופיע, והערכים נשארים
     קריאים — אבל שום פעולה אינה יוצאת לדרך.

     מה **אינו** מוקפא, בכוונה: סינון, חיפוש, לשוניות, ניווט ובוררי המפה.
     אלה פעולות צפייה ולא שינוי, והקפאתן הייתה הופכת את ההדגמה לתמונה
     סטטית במקום למערכת שאפשר להסתובב בה. */

  const FROZEN_TITLE =
    "מוקפא בהדגמה — הפעולה משנה נתונים, וזמינה בגרסת השרת המלאה";

  // כל מה שכותב, עורך, מוחק או טוען. מקובץ לפי המסך שהוא יושב בו.
  const MUTATORS = [
    // הגדרות — ספי צבע, סף מרחק, התראות, פרטי משתמש, שמירה
    "#pane-config input", "#pane-config select", "#pane-config textarea",
    "#pane-config .toggle", "#settings-save",
    // טעינת נתונים — בוחרי קבצים וכפתורי הבחירה
    "#pane-upload input", "#pane-upload button", ".drop-btn",
    // ניהול נתונים — הוספה, עריכה בשורה, מחיקה
    ".add-btn", ".add-save", ".add-cancel", ".row-del",
    ".travel-input", ".unit-input",
    "#add-station", "#add-settlement", "#add-travel",
    "#add-region", "#add-region-settlement", "#add-region-travel",
    // ימי גיוס מתוכננים
    "#day-add", "#day-save", "#day-cancel",
    "#day-station", "#day-date", "#day-location", "#day-pct", "[data-day]",
    // תובנות המגייס — כתיבה, סימון בוצע, מחיקה
    "[data-save]", "[data-text]", "[data-toggle]", "[data-del]",
  ].join(",");

  const isFrozen = (node) => node && node.closest && node.closest(".is-frozen");

  function freezeControls() {
    document.querySelectorAll(MUTATORS).forEach((node) => {
      if (node.classList.contains("is-frozen")) return;
      node.classList.add("is-frozen");
      node.setAttribute("aria-disabled", "true");
      node.title = FROZEN_TITLE;
      // שדה טקסט/מספר נשאר קריא אך לא ניתן לעריכה. readOnly (ולא disabled)
      // כדי שהערך לא יאפור והריחוף ימשיך לעבוד.
      if (node.tagName === "INPUT" && /^(text|number|search|date)$/.test(node.type)) {
        node.readOnly = true;
      }
      // התווית שמעל השדה נושאת את אותו הסבר: בשדה עצמו הסמן כבר "אסור",
      // ומי שמרחף על השם שלצדו צריך לקבל את אותה תשובה.
      const label = node.closest("label");
      if (label && !label.title) label.title = FROZEN_TITLE;
    });

    // גרירת קובץ אל אזור ההשלכה — בלי החסימה הדפדפן פותח את הקובץ במקומנו.
    document.querySelectorAll(".drop-zone").forEach((zone) => {
      if (zone.classList.contains("drop-zone--locked")) return;
      zone.classList.add("drop-zone--locked", "is-frozen");
      zone.title = FROZEN_TITLE;
      ["dragenter", "dragover", "drop"].forEach((evt) =>
        zone.addEventListener(evt, (e) => e.preventDefault())
      );
    });
  }

  // החסימה עצמה. capture=true כדי להקדים כל מאזין ש-app.js רשם על האלמנט.
  ["click", "mousedown", "keydown", "change", "input", "paste"].forEach((evt) =>
    document.addEventListener(
      evt,
      (e) => {
        if (!isFrozen(e.target)) return;
        // Tab וניווט במקלדת נשארים — חסימתם הייתה כולאת משתמש מקלדת במסך.
        if (evt === "keydown" && (e.key === "Tab" || e.key === "Escape")) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true
    )
  );

  // המסכים נבנים אחרי טעינת נתונים אסינכרונית, ולכן פקדים מופיעים גם אחרי
  // ה-load הראשוני. משגיחים ומקפיאים שוב במקום לנחש תזמון.
  window.addEventListener("load", () => {
    freezeControls();
    new MutationObserver(freezeControls).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
})();
