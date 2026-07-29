# ---------------------------------------------------------------------------
# extract_approved.py — קורא את קובץ הנתונים המחוללים המאושר ומקפיא אותו
# ל-approved_stations.json, כדי ש-generate_demo_data.py יציג את המספרים
# המאושרים בפועל (ולא הגרלה). מריצים פעם אחת בכל עדכון של הקובץ המאושר.
#
# דורש openpyxl (כמו build_export_xlsx). ה-JSON שנוצר הוא מקור האמת של ההדגמה
# ואינו דורש openpyxl בהמשך.
#
# הרצה:
#   python to_github/tools/extract_approved.py [נתיב_לאקסל]
# ברירת המחדל: הקובץ המאושר בשורש הפרויקט הפרטי.
# ---------------------------------------------------------------------------
import json
import sys
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
DEFAULT_XLSX = HERE.parent.parent / "נתונים_מחוללים_לאישור_2026-07-22.xlsx"
OUT = HERE / "approved_stations.json"
SHEET = "תחנות ומקצועות"

# קבוצת התפקיד בקובץ -> מפתח המשפחה בהדגמה (זהה ל-ROLE_COLUMNS ב-generate_demo_data)
ROLE_GROUP = {
    "חוקר": "missing_investigators",
    "סייר": "missing_patrol",
    "בלש": "missing_detectives",
    "אחר": "missing_other",
}


def _clean(v):
    return "" if v is None else str(v).replace("״", '"').replace("׳", "'").strip()


def _pct(v):
    if v is None or v == "":
        return None
    x = float(v)
    return round(x * 100 if x <= 1.0 else x, 2)


def _int(v):
    return None if v in (None, "") else int(round(float(v)))


def _column_map(groups, subs):
    filled, last = [], ""
    for g in groups:
        g = _clean(g)
        last = g or last
        filled.append(last)
    return {(grp, _clean(sub)): i for i, (grp, sub) in enumerate(zip(filled, subs))}


def _find(cols, group_contains, sub):
    for (grp, s), i in cols.items():
        if group_contains in grp and s == sub:
            return i
    return None


def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    rows = list(openpyxl.load_workbook(xlsx, data_only=True)[SHEET].iter_rows(values_only=True))
    cols = _column_map(rows[0], rows[1])

    c_district = _find(cols, "זיהוי", "מחוז")
    c_area = _find(cols, "זיהוי", "מרחב")
    c_station = _find(cols, "זיהוי", "תחנה")
    c_req = _find(cols, "סה", "תקנים")
    c_open = _find(cols, "סה", "תקנים פנויים")
    c_pct = _find(cols, "סה", "אחוז איוש")
    c_male = _find(cols, "דמוגרפיה", "% גברים")
    c_jewish = _find(cols, "דמוגרפיה", "% יהודים")
    role_cols = {
        fam: (_find(cols, grp, "תקנים"), _find(cols, grp, "תקנים פנויים"))
        for grp, fam in ROLE_GROUP.items()
    }

    out = {}
    for r in rows[2:]:
        name = _clean(r[c_station])
        if not name:
            continue
        req = _int(r[c_req])
        vac = _int(r[c_open])
        out[name] = {
            "district": _clean(r[c_district]),
            "area": _clean(r[c_area]),
            "staffing_pct": _pct(r[c_pct]),
            "required": req,
            "actual": (req - vac) if (req is not None and vac is not None) else None,
            "pct_male": _pct(r[c_male]) if c_male is not None else None,
            "pct_jewish": _pct(r[c_jewish]) if c_jewish is not None else None,
            "roles": {
                fam: {"required": _int(r[cr]), "vacant": _int(r[co])}
                for fam, (cr, co) in role_cols.items()
            },
        }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"נכתבו {len(out)} תחנות אל {OUT.name}")


if __name__ == "__main__":
    main()
