/* ---------------------------------------------------------------------------
   auth.js — שער הכניסה לאתר שבענן.

   **בהתקנה המקומית הקובץ הזה אינו עושה דבר.** הוא בודק אם הוטמעו בעמוד
   פרטי Firebase (window.GEOHEAT_FIREBASE) ורשימת מורשים
   (window.GEOHEAT_ALLOWED). בשרת המקומי אין הטמעה כזו — המערכת נשארת
   קישור אחד בלי הזדהות, כפי שהוגדר — והסקריפט יוצא מיד.

   כשהמערכת כן תעלה לענן, הפרטים מוטמעים בעמוד בזמן הפרסום, והשער פועל:
     · אין משתמש          ➜ מסך התחברות עם גוגל.
     · משתמש שאינו מורשה  ➜ מסך חסימה, עם הכתובת שאיתה נכנס.
     · משתמש מורשה        ➜ העמוד נחשף וממשיך כרגיל.

   שלוש שכבות, ורק השנייה היא ההגנה
   ---------------------------------
   השער הזה חוסם את **הממשק**. את **הנתונים** חוסמים חוקי Firestore
   (cloud/rules.py), שנבדקים בצד השרת של גוגל בכל בקשה — ולכן גם מי
   שפונה ישירות למסמך בלי לעבור כאן נחסם. השכבה השלישית היא בדיקת
   ההרשאה בשרת המקומי (cloud/access.py), שמקבלת את הכתובת בכותרת
   X-Cloud-User שנקבעת כאן.

   רשימת המורשים אינה ניתנת לעריכה מהענן. היא נערכת במערכת המקומית
   בלבד (הגדרות ➜ ענן ושיתוף) ונכנסת בפרסום הבא.

   הקשחת סשן
   ---------
   אין התחברות שנשמרת לטווח ארוך. שני מנגנונים:
     · browserSessionPersistence — האסימון חי בטאב בלבד, וסגירת הדפדפן
       מוחקת אותו.
     · ניתוק אוטומטי אחרי 15 דקות ללא פעילות, עם הודעה שמסבירה למה.
       המכשיר שנשאר פתוח על השולחן הוא הפרצה הנפוצה ביותר, ואין דרך
       לסגור אותה מצד השרת.
   --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var CONFIG = window.GEOHEAT_FIREBASE || {};
  var ALLOWED = (window.GEOHEAT_ALLOWED || []).map(function (value) {
    return String(value).trim().toLowerCase();
  });

  // המצב המקומי: אין הטמעה, אין שער. יציאה שקטה — לא הודעת שגיאה,
  // כי זו ההתנהגות הנכונה ולא תקלה.
  if (!CONFIG.apiKey) return;

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var IDLE_MINUTES = 15;

  document.documentElement.classList.add("gh-locked");

  function shell(title, body, actions) {
    clearGate();
    var host = document.createElement("div");
    host.className = "gh-gate";
    host.innerHTML =
      '<div class="gh-gate-card">' +
      '<div class="gh-gate-mark">מפת חום גיוס</div>' +
      "<h1>" + title + "</h1>" +
      "<p>" + body + "</p>" +
      '<div class="gh-gate-actions"></div>' +
      "</div>";
    var slot = host.querySelector(".gh-gate-actions");
    (actions || []).forEach(function (node) { slot.appendChild(node); });
    document.body.appendChild(host);
    return host;
  }

  function button(label, onClick, ghost) {
    var node = document.createElement("button");
    node.type = "button";
    node.className = "gh-gate-btn" + (ghost ? " ghost" : "");
    node.textContent = label;
    node.addEventListener("click", onClick);
    return node;
  }

  function clearGate() {
    var existing = document.querySelector(".gh-gate");
    if (existing) existing.remove();
  }

  function reveal() {
    clearGate();
    document.documentElement.classList.remove("gh-locked");
  }

  /* מסך התחברות. אין כאן שדות ואין סיסמאות — ההזדהות היא מול גוגל,
     והמערכת רואה רק את כתובת המייל שחזרה ממנה. */
  function askToSignIn(auth, provider, signIn, note) {
    shell(
      "כניסה למערכת",
      note || "הצפייה בנתונים מחייבת הזדהות עם חשבון גוגל מורשה.",
      [
        button("התחברות עם גוגל", function () {
          signIn(auth, provider).catch(function (error) {
            askToSignIn(auth, provider, signIn,
              "ההתחברות לא הושלמה: " +
              (error && error.code ? error.code : "שגיאה לא ידועה") + ".");
          });
        }),
      ]
    );
  }

  /* מסך חסימה. הכתובת שאיתה נכנס המשתמש מוצגת במפורש — בלעדיה אי אפשר
     לדעת אם נכנסת עם החשבון הלא נכון או שאין לך הרשאה בכלל. */
  function blocked(auth, signOut, email, note) {
    shell(
      "אין הרשאת צפייה",
      (note ? note + "<br><br>" : "") +
      'החשבון <b dir="ltr">' + (email || "") + "</b> אינו ברשימת המורשים " +
      "לצפות בנתוני המערכת.<br>רשימת המורשים מנוהלת במערכת המקומית בלבד. " +
      "לקבלת גישה יש לפנות למנהל המערכת.",
      [button("כניסה עם חשבון אחר", function () { signOut(auth); }, true)]
    );
  }

  function fail(message) {
    shell("לא ניתן לאמת את הזהות", message);
  }

  /* כל קריאה ל-API נושאת מכאן ואילך את כתובת המשתחבר. השרת בודק אותה
     ב-cloud/access.py. **הכותרת אינה ההגנה** — היא ניתנת לזיוף, וההגנה
     על הנתונים היא חוקי Firestore. היא מה שמאפשר לשרת לומר "החשבון הזה
     אינו מורשה" בשפה של המערכת, במקום להחזיר נתונים בשקט. */
  function stampRequests(email) {
    var original = window.fetch;
    window.fetch = function (input, init) {
      var options = init || {};
      var headers = new Headers(options.headers || {});
      headers.set("X-Cloud-User", email);
      return original(input, Object.assign({}, options, { headers: headers }));
    };
  }

  /* טיימר חוסר פעילות: אחרי רבע שעה בלי נגיעה — יציאה.

     מאזין אחד לכל סוג אירוע והשוואת זמן, ולא setTimeout שנדרך מחדש בכל
     תזוזה: תזוזת עכבר אחת אינה אמורה להיות טעונה יותר מהשוואת מספרים. */
  function startIdleTimer(auth, signOut) {
    var limit = IDLE_MINUTES * 60 * 1000;
    var last = Date.now();
    var out = false;

    function touch() { last = Date.now(); }

    ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart", "click"]
      .forEach(function (name) {
        window.addEventListener(name, touch, { passive: true });
      });
    // חזרה לטאב נחשבת פעילות, אבל רק אם הזמן עוד לא חלף — אחרת היא
    // מבטלת בדיוק את מה שהטיימר בא למנוע.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - last < limit) touch();
    });

    setInterval(function () {
      if (out || Date.now() - last < limit) return;
      out = true;
      Promise.resolve(signOut(auth)).catch(function () {}).then(askAgainAfterIdle);
    }, 20 * 1000);
  }

  /* הודעה מפורשת אחרי ניתוק אוטומטי. בלעדיה המשתמש חוזר למסך ההתחברות
     בלי לדעת למה, וחושב שהמערכת התקלקלה. */
  function askAgainAfterIdle() {
    document.documentElement.classList.add("gh-locked");
    var who = document.querySelector(".gh-who");
    if (who) who.remove();
    shell(
      "הסשן הסתיים",
      "המערכת ניתקה את החיבור אוטומטית לאחר " + IDLE_MINUTES +
      " דקות ללא פעילות.<br>יש להתחבר מחדש כדי להמשיך.",
      [button("התחברות מחדש", function () { location.reload(); })]
    );
  }

  /* מי מחובר, ואיך יוצאים — פס דק בתחתית המסך. */
  function showWho(auth, signOut, user) {
    if (document.querySelector(".gh-who")) return;
    var bar = document.createElement("div");
    bar.className = "gh-who";
    var name = document.createElement("span");
    name.textContent = user.email || "";
    name.dir = "ltr";
    bar.appendChild(name);
    bar.appendChild(button("יציאה", function () { signOut(auth); }, true));
    document.body.appendChild(bar);
  }

  Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
  ]).then(function (modules) {
    var app = modules[0];
    var authApi = modules[1];

    var instance = app.initializeApp(CONFIG);
    var auth = authApi.getAuth(instance);
    var provider = new authApi.GoogleAuthProvider();
    // בכל כניסה נבחר החשבון מחדש, כדי שמעבר בין חשבונות לא יידרוש
    // התנתקות ידנית מגוגל עצמה.
    provider.setCustomParameters({ prompt: "select_account" });

    // ברירת המחדל של Firebase Auth היא שמירת ההתחברות ללא הגבלת זמן:
    // מי שנכנס פעם אחת נשאר מחובר גם שבועות אחר כך, גם במחשב משותף.
    // במערכת שמציגה נתוני איוש ומועמדים זה לא מקובל.
    authApi.setPersistence(auth, authApi.browserSessionPersistence).catch(function () {
      // דפדפן שאינו תומך — נשארים על ברירת המחדל, וטיימר חוסר
      // הפעילות עדיין מגן.
    });

    startIdleTimer(auth, authApi.signOut);

    authApi.onAuthStateChanged(auth, function (user) {
      if (!user) return askToSignIn(auth, provider, authApi.signInWithPopup);

      var email = String(user.email || "").trim().toLowerCase();
      if (!user.emailVerified) {
        return blocked(auth, authApi.signOut, user.email,
          "כתובת המייל של החשבון אינה מאומתת אצל גוגל.");
      }
      if (ALLOWED.indexOf(email) < 0) {
        return blocked(auth, authApi.signOut, user.email);
      }
      stampRequests(email);
      reveal();
      showWho(auth, authApi.signOut, user);
      window.dispatchEvent(new Event("geoheat-auth-ready"));
    });
  }).catch(function (error) {
    fail("טעינת רכיב האימות נכשלה: " +
         (error && error.message ? error.message : "שגיאה לא ידועה") + ".");
  });
})();
