# ---------------------------------------------------------------------------
# generate_demo_data.py — מחולל נתוני ההדגמה של מפת החום.
#
# למה הקובץ הזה קיים
# ------------------
# בגרסת השרת המלאה, ה-JS פנה ל-Flask ששלף מ-SQLite. גרסת הפורטפוליו הזו
# רצה על GitHub Pages ללא שרת — ולכן הנתונים "מוקפאים" מראש לקובצי JSON
# סטטיים תחת ../data, בדיוק במבנה שה-API היה מחזיר. app.js קורא אותם כמו
# שהיה קורא ל-API, בלי לדעת שאין שרת.
#
# עיקרון פרטיות (חשוב)
# --------------------
# הקובץ הזה *לא* קורא שום מאגר אמיתי. כל המספרים — אחוזי איוש, תקן מול
# מאויש, פילוח דמוגרפי, זמני נסיעה, מועמדים — מוגרלים כאן עם seed קבוע.
# הדבר היחיד ה"אמיתי" הוא גאוגרפיה ציבורית: שמות תחנות ויישובים
# וקואורדינטות, שיושבים ב-geo_seed.json. אף נתון תפעולי אמיתי לא נכנס לכאן.
#
# הרצה:  python generate_demo_data.py   (ללא תלויות — ספרייה סטנדרטית בלבד)
# ---------------------------------------------------------------------------
import json
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SEED_FILE = Path(__file__).resolve().parent / "geo_seed.json"

# seed קבוע = פלט זהה בכל הרצה. שינוי המספר מגריל מערך נתונים אחר.
RNG = random.Random(20260721)

# --- כללים קבועים של המערכת (משוכפלים מ-ingest/colors.py ו-settings.py) -----
THRESHOLDS = {"critical": 70, "urgent": 80, "medium": 90}
NEARBY_MINUTES = 30
URGENCY_WEIGHTS = {"critical": 1.5, "urgent": 1.2, "medium": 1.0, "ok": 0.5, "unknown": 0.0}

CRITICAL = {"status": "קריטי", "color": "#DC2626", "key": "critical"}
URGENT = {"status": "דחוף", "color": "#EA580C", "key": "urgent"}
MEDIUM = {"status": "בינוני", "color": "#EAB308", "key": "medium"}
OK = {"status": "תקין", "color": "#16A34A", "key": "ok"}
UNKNOWN = {"status": "לא ידוע", "color": "#9CA3AF", "key": "unknown"}

# --- פילוח חוסרים לפי מקצוע (תפקיד) --------------------------------------
# בקובץ המקור (אקסל "פערי תקן מצבה - תפקידים ותחנות") מופיעים עשרות מקצועות
# פרטניים — "חוקר/מד"ר", "חוקרת נוער חרדית", "בילוש", "בלש חרדי", "סייר/מגילות"
# ועוד, ולעיתים צצים מקצועות חדשים שאינם משויכים מראש. כדי שהמפה תישאר קריאה
# מרכזים אותם לארבע משפחות מקצוע לפי כלל תת-מחרוזת (ראו classify_role):
#   מכיל "חוקר" או "חקירות"  -> חוקר   (כך "חוקרת נוער" נופל תחת חוקר)
#   מכיל "סייר" או "סיור"    -> סייר
#   מכיל "בלש"  או "בילוש"   -> בלש
#   כל השאר                  -> אחר
ROLE_COLUMNS = [
    ("missing_investigators", "חוקר"),
    ("missing_patrol", "סייר"),
    ("missing_detectives", "בלש"),
    ("missing_other", "אחר"),
]

# כלל השיוך — סדר הבדיקה קובע קדימות. שימוש בתת-מחרוזת (ולא בהתאמה מלאה) הוא
# מה שמאפשר לתפוס מקצועות חדשים/מנוסחים אחרת בלי לתחזק רשימה סגורה.
ROLE_RULES = [
    ("missing_investigators", ("חוקר", "חקירות")),
    ("missing_patrol", ("סייר", "סיור")),
    ("missing_detectives", ("בלש", "בילוש")),
]


def classify_role(profession):
    """ממפה שם מקצוע חופשי לאחת מארבע משפחות המקצוע (מפתח missing_*)."""
    text = profession or ""
    for key, needles in ROLE_RULES:
        if any(n in text for n in needles):
            return key
    return "missing_other"


# רשימת המקצועות הקנונית — משקפת אחד-לאחד את שמות השדות בקובץ המקור
# ("תחנות 22.7.xlsx", גיליון "פערי תקן מצבה - תפקידים ותחנות"). זהו מקור האמת
# ל*שמות השדות בלבד* — אין כאן, ולא נגזר מכאן, שום נתון תפעולי אמיתי. כשמתווסף
# מקצוע חדש לקובץ, מוסיפים אותו לרשימה כאן והוא משויך אוטומטית לאחת מארבע
# המשפחות ע"י classify_role (כלל תת-מחרוזת) — בלי שינוי קוד נוסף.
PROFESSIONS = [
    "אחר", "בילוש", "בלש חרדי", "חוקר/מד\"ר", "חוקר משפחה",
    "חוקר משפחה/מפקד צוות חקירות", "חוקרת נוער חרדית", "חקירות",
    "לוחם בלש מ\"ט", "מפקד בסיס מג\"ב/כוננות", "מפקד מחלק חקירות/ראש מחלק משפחה",
    "מפקד מש\"ח בית שמש", "מפקד צוות חקירות/אלימות במשפחה", "מפקד קבוצת סיור/מגילות",
    "סיור", "סייר/מגילות", "סייר/מד\"ר", "קצין הערכה ומחקר/קצין היתוך",
    "קצין סיור/מגילות", "רכז איסוף רשתי",
]
# כל מקצוע חייב ליפול לאחת מארבע המשפחות המוגדרות ב-ROLE_COLUMNS.
_families = {k for k, _ in ROLE_COLUMNS}
assert all(classify_role(p) in _families for p in PROFESSIONS), "מקצוע לא שויך למשפחה"


# משקל בסיס לפילוח החוסר בין המשפחות, ו"טעם" מחוזי שיוצר סיפור מעניין על המפה:
# בפריפריה (דרום/ש"י) בולט חוסר חוקרים; במרכז הצפוף חוסר סיירים; בצפון בלשים.
ROLE_BASE_WEIGHTS = {
    "missing_patrol": 0.42, "missing_investigators": 0.28,
    "missing_detectives": 0.16, "missing_other": 0.14,
}
DISTRICT_ROLE_TILT = {
    "דרום": {"missing_investigators": 0.16, "missing_patrol": -0.10},
    "ש\"י": {"missing_investigators": 0.14, "missing_detectives": 0.04, "missing_patrol": -0.12},
    "מרכז": {"missing_patrol": 0.14, "missing_other": -0.06},
    "תל אביב": {"missing_patrol": 0.12, "missing_investigators": 0.04, "missing_other": -0.10},
    "צפון": {"missing_detectives": 0.12, "missing_patrol": -0.08},
    "ירושלים": {"missing_other": 0.08, "missing_detectives": 0.04},
    "חוף": {"missing_patrol": 0.06},
}


def _largest_remainder(total, weights, keys):
    """מפצל מספר שלם total בין keys לפי weights, כך שהסכום מדויק == total."""
    if total <= 0:
        return {k: 0 for k in keys}
    s = sum(weights[k] for k in keys) or 1.0
    raw = {k: total * weights[k] / s for k in keys}
    floor = {k: int(math.floor(raw[k])) for k in keys}
    remainder = total - sum(floor.values())
    order = sorted(keys, key=lambda k: raw[k] - floor[k], reverse=True)
    for k in order[:remainder]:
        floor[k] += 1
    return floor


def role_breakdown(required, actual, district):
    """מפרק את התחנה לארבע משפחות המקצוע, ולכל משפחה מחזיר תקן/מאויש/פנוי/אחוז.
    שומר על עקביות מלאה מול רמת התחנה: סכום התקנים == תקן התחנה, וסכום
    המאויש == המאויש בתחנה (ולכן גם אחוז האיוש של התחנה נשמר בדיוק)."""
    keys = [k for k, _ in ROLE_COLUMNS]
    req_total = int(round(required))
    vac_total = int(round(required - actual))

    # (1) חלוקת התקן בין המשפחות לפי מבנה ארגוני (סיור הגדול ביותר) + רעש קל.
    w_struct = {k: max(0.02, ROLE_BASE_WEIGHTS[k] * (1 + RNG.uniform(-0.12, 0.12))) for k in keys}
    fam_req = _largest_remainder(req_total, w_struct, keys)

    # (2) חלוקת החוסר בין המשפחות לפי משקל מוטה-מחוז (זה מה שיוצר את הסיפור).
    w_vac = dict(ROLE_BASE_WEIGHTS)
    for k, d in DISTRICT_ROLE_TILT.get(district, {}).items():
        w_vac[k] = max(0.0, w_vac[k] + d)
    w_vac = {k: max(0.001, w_vac[k] * (1 + RNG.uniform(-0.15, 0.15))) for k in keys}
    fam_vac = _largest_remainder(vac_total, w_vac, keys)

    # (3) חוסר במשפחה לא יכול לעלות על התקן שלה — קוטמים ומחלקים עודף למשפחות
    # עם עתודה. תמיד ניתן (vac_total <= req_total), כך שהסכום נשמר מדויק.
    overflow = 0
    for k in keys:
        if fam_vac[k] > fam_req[k]:
            overflow += fam_vac[k] - fam_req[k]
            fam_vac[k] = fam_req[k]
    while overflow > 0:
        slack = sorted((k for k in keys if fam_req[k] - fam_vac[k] > 0),
                       key=lambda k: fam_req[k] - fam_vac[k], reverse=True)
        if not slack:
            break
        for k in slack:
            if overflow <= 0:
                break
            fam_vac[k] += 1
            overflow -= 1

    out = {}
    for k in keys:
        req, vac = fam_req[k], fam_vac[k]
        act = req - vac
        out[k] = {
            "required": req, "actual": act, "vacant": vac,
            "pct": round(act / req * 100, 2) if req > 0 else None,
        }
    return out

ROLES = ["מגייס ארצי", "ראש ענף גיוס", "קצין גיוס מחוזי", "מנהל מערכת"]
DEFAULTS = {
    "threshold_critical": 70, "threshold_urgent": 80, "threshold_medium": 90,
    "nearby_minutes": 30,
    "urgency_critical": 1.5, "urgency_urgent": 1.2, "urgency_medium": 1.0, "urgency_ok": 0.5,
    "alert_critical": True, "alert_weekly_report": False, "alert_new_candidate": False,
    "user_name": "", "user_role": "מגייס ארצי",
}


def classify(pct):
    if pct is None:
        return dict(UNKNOWN)
    if pct < THRESHOLDS["critical"]:
        return dict(CRITICAL)
    if pct < THRESHOLDS["urgent"]:
        return dict(URGENT)
    if pct < THRESHOLDS["medium"]:
        return dict(MEDIUM)
    return dict(OK)


def legend():
    limits = THRESHOLDS
    return [
        {**CRITICAL, "label": f"מתחת ל‑{limits['critical']}%"},
        {**URGENT, "label": f"{limits['critical']}% - {limits['urgent']}%"},
        {**MEDIUM, "label": f"{limits['urgent']}% - {limits['medium']}%"},
        {**OK, "label": f"{limits['medium']}% ומעלה"},
    ]


def haversine_km(a_lat, a_lng, b_lat, b_lng):
    r = 6371.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlmb = math.radians(b_lng - a_lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ---------------------------------------------------------------------------
# 1. בניית המערך הסינתטי מתוך הגאוגרפיה הציבורית
# ---------------------------------------------------------------------------
seed = json.loads(SEED_FILE.read_text(encoding="utf-8"))

# הנתונים המאושרים (נתונים_מחוללים_לאישור) — הוקפאו ל-JSON ע"י extract_approved.py.
# כשתחנה קיימת כאן, ההדגמה מציגה את המספרים המאושרים בפועל במקום הגרלה.
APPROVED_FILE = Path(__file__).resolve().parent / "approved_stations.json"
APPROVED = json.loads(APPROVED_FILE.read_text(encoding="utf-8")) if APPROVED_FILE.exists() else {}


def role_breakdown_from_approved(roles):
    """בונה את פירוק המשפחות מהמספרים המאושרים (תקן/פנוי אמיתיים לכל משפחה)."""
    out = {}
    for k, _ in ROLE_COLUMNS:
        req = int(roles.get(k, {}).get("required") or 0)
        vac = min(int(roles.get(k, {}).get("vacant") or 0), req)
        act = req - vac
        out[k] = {"required": req, "actual": act, "vacant": vac,
                  "pct": round(act / req * 100, 2) if req > 0 else None}
    return out

# אחוזי האיוש מוגרלים מהתפלגות נורמלית (עקומת פעמון) סביב ממוצע ארצי — כך
# הפיזור בין 88 התחנות נראה טבעי ומעניין לעין: רוב התחנות סביב הממוצע, וזנבות
# דקים של תחנות קריטיות (אדום) ותחנות מצוינות (ירוק). התוחלת והסטייה נבחרו כך
# שכל ארבעת הסטטוסים יופיעו במפה (קריטי<70, דחוף 70-80, בינוני 80-90, תקין≥90).
STAFFING_MEAN = 81.0   # תוחלת אחוז האיוש
STAFFING_STD = 11.0    # סטיית תקן — קובעת את רוחב הפעמון
STAFFING_MIN, STAFFING_MAX = 50.0, 100.0  # קטימה לטווח ריאלי


def gauss_target():
    return max(STAFFING_MIN, min(STAFFING_MAX, RNG.gauss(STAFFING_MEAN, STAFFING_STD)))


stations = []
for i, s in enumerate(seed["stations"]):
    ap = APPROVED.get(s["name"])
    if ap:
        # מספרים מאושרים מהקובץ — כולל פילוח תפקידים ודמוגרפיה אמיתיים.
        required, actual = ap["required"], ap["actual"]
        pct = ap["staffing_pct"]
        pct_male, pct_jewish = ap["pct_male"], ap["pct_jewish"]
        rb = role_breakdown_from_approved(ap["roles"])
    else:
        # נפילה חלופית (תחנה שאין לה נתון מאושר) — הגרלה עקבית, כמו קודם.
        required = RNG.choice([55, 60, 70, 80, 90, 100, 110, 120, 130, 140])
        target = gauss_target()
        actual = max(0, min(required, round(required * target / 100) + RNG.randint(-2, 2)))
        pct = round(actual / required * 100, 2)
        pct_male = float(RNG.randint(60, 78))
        pct_jewish = float(RNG.randint(55, 95))
        rb = role_breakdown(required, actual, s["district"])
    stations.append({
        "id": i + 1,
        "name": s["name"],
        "district": s["district"],
        "area": s["area"],
        "lat": s["lat"],
        "lng": s["lng"],
        "coord_verified": 0,
        "staffing_pct": pct,
        "required_positions": required,
        "actual_positions": actual,
        "pct_male": pct_male,
        "pct_jewish": pct_jewish,
        "role_breakdown": rb,
        # שדה שטוח לתאימות: החוסר (תקנים פנויים) לכל משפחה — כפי ש-roleChips קורא.
        **{col: rb[col]["vacant"] for col, _ in ROLE_COLUMNS},
    })

settlements = []
for i, s in enumerate(seed["settlements"]):
    settlements.append({
        "id": i + 1, "name": s["name"], "lat": s["lat"], "lng": s["lng"], "coord_verified": 0,
    })

stations_by_name = {s["name"]: s for s in stations}
settlements_by_name = {s["name"]: s for s in settlements}

# קשרי תחנה-יישוב: הזוגות (מי סמוך למי) הם גאוגרפיה ציבורית מ-geo_seed;
# זמן הנסיעה מוגרל אך ריאלי — נגזר ממרחק אווירי ב~28 קמ"ש עירוני + רעש.
relations = []
rid = 0
for pair in seed["pairs"]:
    st = stations_by_name.get(pair["station"])
    se = settlements_by_name.get(pair["settlement"])
    if not st or not se:
        continue
    km = haversine_km(st["lat"], st["lng"], se["lat"], se["lng"])
    minutes = max(3, round(km / 0.47 + RNG.uniform(-2, 4)))
    rid += 1
    relations.append({
        "id": rid,
        "station_id": st["id"], "station_name": st["name"],
        "settlement_id": se["id"], "settlement_name": se["name"],
        "travel_min": minutes,
    })

# מועמדים בהליך — מקובץ המועמדים המאושר (approved_candidates.json, סך 2000),
# לפי שם תחנה. תחנה שאינה בקובץ → None ("אין נתון", שונה מ-0). נבנה ע"י
# generate_candidates.py מתוך אותו מקור-אמת של הקובץ למסירה.
CANDIDATES_FILE = Path(__file__).resolve().parent / "approved_candidates.json"
APPROVED_CANDIDATES = (
    json.loads(CANDIDATES_FILE.read_text(encoding="utf-8")) if CANDIDATES_FILE.exists() else {}
)
candidates = {s["id"]: APPROVED_CANDIDATES.get(s["name"]) for s in stations}


# ---------------------------------------------------------------------------
# 2. פונקציות תשלובת (payloads) — זהות במבנה למה שהשרת החזיר
# ---------------------------------------------------------------------------
def missing_positions(s):
    if s["required_positions"] is None or s["actual_positions"] is None:
        return None
    return s["required_positions"] - s["actual_positions"]


def station_payload(s):
    palette = classify(s["staffing_pct"])
    return {
        "id": s["id"], "name": s["name"], "district": s["district"], "area": s["area"],
        "staffing_pct": s["staffing_pct"],
        "status": palette["status"], "status_key": palette["key"], "color": palette["color"],
        "lat": s["lat"], "lng": s["lng"], "coord_verified": bool(s["coord_verified"]),
        "missing_positions": missing_positions(s),
        "required_positions": s["required_positions"], "actual_positions": s["actual_positions"],
        "pct_male": s["pct_male"], "pct_jewish": s["pct_jewish"],
        # פילוח החוסר לפי תפקיד — כדי שכרטיס התחנה במפה יציג "כמה חסר מכל מגזר"
        # בלי לשלוף את קובץ הפירוט. הפירוט המלא (תקן/מאויש לתפקיד) נשאר ב-detail.
        "roles": [{"key": k, "label": lbl, "missing": s[k]} for k, lbl in ROLE_COLUMNS],
        # מועמדים בהליך לתחנה — None = "אין נתון" (שונה מ-0 = "אין מועמדים").
        "candidates_in_process": candidates.get(s["id"]),
    }


def nearby_of(station_id):
    items = [
        {"name": r["settlement_name"], "travel_min": r["travel_min"]}
        for r in relations
        if r["station_id"] == station_id and r["travel_min"] <= NEARBY_MINUTES
    ]
    return sorted(items, key=lambda x: x["travel_min"])


def recruiter_station(s):
    p = station_payload(s)
    return {
        **p,
        "roles": [
            {"key": k, "label": lbl, "missing": s[k],
             "required_positions": s["role_breakdown"][k]["required"],
             "actual_positions": s["role_breakdown"][k]["actual"],
             "staffing_pct": s["role_breakdown"][k]["pct"]}
            for k, lbl in ROLE_COLUMNS
        ],
        "candidates_in_process": candidates.get(s["id"]),
        "nearby_settlements": nearby_of(s["id"]),
    }


def urgency(p):
    pct = p["staffing_pct"]
    if pct is None:
        return {"score": None, "gap_pct": None, "weight": None, "positions_factor": None}
    gap = 100 - pct
    weight = URGENCY_WEIGHTS.get(p["status_key"], 0.0)
    score = gap * weight
    missing = p["missing_positions"]
    factor = None
    if missing is not None:
        factor = 1 + missing / 10
        score *= factor
    return {
        "score": round(score, 1), "gap_pct": round(gap, 1), "weight": weight,
        "positions_factor": None if factor is None else round(factor, 2),
    }


# ---------------------------------------------------------------------------
# 3. חישוב מדדים כלל-מערכתיים (לוח בקרה / אסטרטגי)
# ---------------------------------------------------------------------------
payloads = [station_payload(s) for s in sorted(stations, key=lambda s: s["name"])]
required_sum = sum(p["required_positions"] for p in payloads)
actual_sum = sum(p["actual_positions"] for p in payloads)
weighted_avg = round(actual_sum / required_sum * 100, 1)
total_missing = sum(p["missing_positions"] for p in payloads)

# שני צילומי KPI כדי שלוח הבקרה יוכל להציג "מגמת חודש" (מחייבת שתי נקודות).
now = datetime.now()
snapshots = [  # ordered DESC by taken_at, כמו בשאילתה
    {"avg_staffing": weighted_avg, "total_missing": total_missing,
     "taken_at": now.isoformat(timespec="seconds")},
    {"avg_staffing": round(weighted_avg - 1.4, 1), "total_missing": total_missing + 6,
     "taken_at": (now - timedelta(days=30)).isoformat(timespec="seconds")},
]
trend = round(snapshots[0]["avg_staffing"] - snapshots[1]["avg_staffing"], 2)

# יומן טעינות דמו — שמות קבצים סינתטיים, בלי נתיבים אמיתיים.
load_log = [
    {"loaded_at": (now - timedelta(days=1, hours=2)).isoformat(timespec="seconds"),
     "file_type": "staffing", "source_file": "אחוזי_איוש_דמו.xlsx",
     "archived_file": None, "rows_loaded": len(stations), "status": "ok", "message": ""},
    {"loaded_at": (now - timedelta(days=1, hours=2, minutes=3)).isoformat(timespec="seconds"),
     "file_type": "relations", "source_file": "קשרי_תחנה_יישוב_דמו.xlsx",
     "archived_file": None, "rows_loaded": len(relations), "status": "ok", "message": ""},
    {"loaded_at": (now - timedelta(days=5)).isoformat(timespec="seconds"),
     "file_type": "staffing", "source_file": "אחוזי_איוש_טיוטה.xlsx",
     "archived_file": None, "rows_loaded": None, "status": "rejected",
     "message": "נדחה ע\"י Data Guard — סטייה של 14% מהמאגר הקיים."},
]

insights_raw = [
    {"id": 1, "station_id": 6, "text": "ריכוז גבוה של מועמדים ביפו — כדאי יום גיוס ממוקד.",
     "done": 0, "created_at": (now - timedelta(days=3)).isoformat(timespec="seconds")},
    {"id": 2, "station_id": 1, "text": "בני ברק יציבה — להסיט מאמץ פרסום לתחנות הקריטיות.",
     "done": 1, "created_at": (now - timedelta(days=8)).isoformat(timespec="seconds")},
    {"id": 3, "station_id": 8, "text": "מסובים בפער מתמשך — לבחון שיתוף עם מרחב דן.",
     "done": 0, "created_at": (now - timedelta(days=1)).isoformat(timespec="seconds")},
]

recruitment_days = [
    {"id": 1, "date": (date.today() + timedelta(days=7)).isoformat(),
     "location": "לשכת גיוס דן", "expected_success_pct": 65.0, "station_name": "תחנת מסובים"},
    {"id": 2, "date": (date.today() + timedelta(days=18)).isoformat(),
     "location": "מתחם יפו", "expected_success_pct": 58.0, "station_name": "תחנת יפו"},
]


def dashboard_data():
    with_pct = payloads
    status_counts = {}
    for p in payloads:
        status_counts[p["status"]] = status_counts.get(p["status"], 0) + 1
    top5 = sorted(with_pct, key=lambda p: p["staffing_pct"])[:5]
    return {
        "filters": {"region": None, "station": None},
        "avg_staffing": {
            "value": weighted_avg, "weighted": True, "note": None,
            **classify(weighted_avg),
        },
        "positions": {
            "available": True, "required": required_sum, "actual": actual_sum,
            "stations_count": len(payloads), "status_counts": status_counts,
        },
        "manpower_gap": {
            "available": True, "total_missing": total_missing,
            "trend": trend, "snapshots": len(snapshots),
        },
        "top5": [
            {"name": p["name"], "district": p["district"], "area": p["area"],
             "staffing_pct": p["staffing_pct"], "status": p["status"],
             "color": p["color"], "missing_positions": p["missing_positions"]}
            for p in top5
        ],
    }


def recruiter_data():
    rows = sorted(stations, key=lambda s: (s["district"], s["area"], s["name"]))
    rec_stations = [recruiter_station(s) for s in rows]
    required = [s["required_positions"] for s in rec_stations if s["required_positions"] is not None]
    actual = [s["actual_positions"] for s in rec_stations if s["actual_positions"] is not None]
    missing = [s["missing_positions"] for s in rec_stations if s["missing_positions"] is not None]
    critical = [s for s in rec_stations if s["status_key"] == "critical"]

    tree = {}
    for s in rec_stations:
        tree.setdefault(s["district"] or "ללא מחוז", {}).setdefault(s["area"] or "ללא מרחב", []).append(s)

    return {
        "kpis": {
            "total_required": {"available": bool(required), "value": sum(required) if required else None},
            "actual": {
                "available": bool(actual), "value": sum(actual) if actual else None,
                "pct": round(sum(actual) / sum(required) * 100, 1) if required and actual else None,
            },
            "gap": {"available": bool(missing), "value": -sum(missing) if missing else None},
            "critical_units": {"available": True, "value": len(critical), "threshold": THRESHOLDS["critical"]},
        },
        "units_count": len(rec_stations),
        "nearby_minutes": NEARBY_MINUTES,
        "tree": [
            {"district": d, "areas": [{"area": a, "stations": items} for a, items in sorted(areas.items())]}
            for d, areas in sorted(tree.items())
        ],
    }


def advertising_targets(top_stations):
    by_id = {s["id"]: s for s in top_stations}
    ids = set(by_id)
    targets = {}
    for r in relations:
        if r["station_id"] not in ids or r["travel_min"] > NEARBY_MINUTES:
            continue
        entry = targets.setdefault(
            r["settlement_id"], {"name": r["settlement_name"], "stations": [], "score": 0.0}
        )
        station = by_id[r["station_id"]]
        entry["stations"].append({
            "name": station["name"], "travel_min": r["travel_min"],
            "status": station["status"], "color": station["color"],
        })
        entry["score"] += station["urgency"]["score"]
    result = []
    for settlement_id, entry in targets.items():
        entry["stations"].sort(key=lambda s: s["travel_min"])
        result.append({
            "settlement_id": settlement_id, "name": entry["name"],
            "score": round(entry["score"], 1), "station_count": len(entry["stations"]),
            "stations": entry["stations"],
        })
    result.sort(key=lambda t: (-t["score"], t["name"]))
    return result


def strategic_data(n=10):
    scored = []
    for s in stations:
        p = station_payload(s)
        u = urgency(p)
        if u["score"] is None:
            continue
        scored.append({**p, "urgency": u})
    scored.sort(key=lambda s: s["urgency"]["score"], reverse=True)
    top_n = scored[:n]

    below = [p for p in payloads if p["staffing_pct"] < THRESHOLDS["medium"]]
    critical = [p for p in payloads if p["status_key"] == "critical"]
    critical_missing = [p["missing_positions"] for p in critical if p["missing_positions"] is not None]

    return {
        "n": n, "n_options": [5, 10, 20, 30, 50], "nearby_minutes": NEARBY_MINUTES,
        "weights": URGENCY_WEIGHTS,
        "kpis": {
            "annual_goal": {"available": False, "value": None},
            "candidates_in_process": {
                "available": bool(candidates),
                "value": sum(candidates.values()) if candidates else None,
            },
            "units_below": {"available": True, "value": len(below), "threshold": THRESHOLDS["medium"]},
            "critical_gap": {
                "available": bool(critical_missing),
                "value": sum(critical_missing) if critical_missing else None,
                "units": len(critical),
            },
        },
        "top": [
            {"id": s["id"], "name": s["name"], "district": s["district"], "area": s["area"],
             "staffing_pct": s["staffing_pct"], "status": s["status"], "status_key": s["status_key"],
             "color": s["color"], "missing_positions": s["missing_positions"], **s["urgency"]}
            for s in top_n
        ],
        "targets": advertising_targets(top_n),
        "recruitment_days": recruitment_days,
    }


# ---------------------------------------------------------------------------
# 4. כתיבת כל קובצי ה-JSON הסטטיים
# ---------------------------------------------------------------------------
def settlements_payload():
    out = []
    for se in sorted(settlements, key=lambda s: s["name"]):
        nearby = sum(
            1 for r in relations
            if r["settlement_id"] == se["id"] and r["travel_min"] <= NEARBY_MINUTES
        )
        out.append({
            "id": se["id"], "name": se["name"], "lat": se["lat"], "lng": se["lng"],
            "coord_verified": bool(se["coord_verified"]), "nearby_stations": nearby,
        })
    return out


def relations_payload():
    ordered = sorted(relations, key=lambda r: (r["station_name"], r["travel_min"]))
    return [
        {**{k: r[k] for k in ("id", "station_id", "station_name", "settlement_id",
                              "settlement_name", "travel_min")},
         "within_nearby": r["travel_min"] <= NEARBY_MINUTES}
        for r in ordered
    ]


def write(name, obj):
    path = DATA_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    write("tiles-available.json", {"available": False, "zooms": []})
    write("health.json", {
        "ok": True, "db": "(demo)", "stations": len(stations),
        "settlements": len(settlements), "relations": len(relations),
        "nearby_minutes": NEARBY_MINUTES,
    })
    write("legend.json", legend())
    write("stations.json", payloads)
    write("settlements.json", settlements_payload())
    write("relations.json", relations_payload())
    write("regions.json", {
        "regions": sorted({s["area"] for s in stations if s["area"]}),
        "districts": sorted({s["district"] for s in stations if s["district"]}),
    })
    write("last-update.json", {
        "last_update": load_log[0]["loaded_at"], "file_type": load_log[0]["file_type"],
        "archived_file": load_log[0]["archived_file"], "rows_loaded": load_log[0]["rows_loaded"],
    })
    write("loaded-files.json", {"archive_dir": "(demo)", "loads": load_log})
    write("dashboard.json", dashboard_data())
    write("recruiter.json", recruiter_data())
    write("strategic.json", strategic_data(10))
    write("settings.json", {**{k: DEFAULTS[k] for k in DEFAULTS}, "roles": ROLES, "defaults": DEFAULTS})

    insights_list = sorted(insights_raw, key=lambda i: (i["done"], -i["id"]))
    write("insights.json", [
        {**i, "station_name": stations[i["station_id"] - 1]["name"]} for i in insights_list
    ])

    # פירוט לכל תחנה — נצרך ע"י חלונית ממשק המגייס.
    for s in stations:
        detail = recruiter_station(s)
        detail["insights"] = [
            {"id": i["id"], "text": i["text"], "done": i["done"], "created_at": i["created_at"]}
            for i in sorted((x for x in insights_raw if x["station_id"] == s["id"]),
                            key=lambda x: -x["id"])
        ]
        write(f"station-detail/{s['id']}.json", detail)

    print(f"נכתבו קובצי JSON אל {DATA_DIR}")
    print(f"  תחנות: {len(stations)} · יישובים: {len(settlements)} · קשרים: {len(relations)}")
    print(f"  אחוז איוש משוקלל: {weighted_avg}% · תקנים חסרים: {total_missing}")

    # קובץ הייצוא לאקסל (data/export.xlsx) — מה שכפתורי "ייצוא אקסל" באתר מורידים.
    # דורש openpyxl; אם אינו מותקן, מדלגים בלי להיכשל (ה-JSON כבר נכתב).
    try:
        import build_export_xlsx
        path = build_export_xlsx.build(DATA_DIR)
        print(f"  נכתב גם {path.name} (ייצוא לאקסל)")
    except ImportError:
        print("  (דילוג על export.xlsx — openpyxl אינו מותקן)")


if __name__ == "__main__":
    main()
