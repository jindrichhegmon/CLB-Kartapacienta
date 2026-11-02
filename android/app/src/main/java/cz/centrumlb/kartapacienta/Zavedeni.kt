package cz.centrumlb.kartapacienta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Zavedení telefonu QR kódem (0.1.16). Průvodce prvního zapnutí Androidu nainstaluje aplikaci, nastaví ji jako správce
 * zařízení a zavolá ADMIN_POLICY_COMPLIANCE. Kiosk (domovská obrazovka, zámek úlohy, spuštění karty) se ale nesmí zapnout,
 * dokud průvodce běží – jinak se průvodce vrátí na začátek (na skener QR kódu). Tahle služba proto počká, až Android ohlásí
 * dokončení nastavení (USER_SETUP_COMPLETE + DEVICE_PROVISIONED), a teprve pak kiosk zapne a kartu otevře.
 * Každý krok se navíc hlásí na server Karty (POST /api/d/zavedeni) – do logu serveru, bez identity pacienta – ať jde
 * zavedení sledovat i bez kabelu.
 */
object Zavedeni {
    private const val PREFS = "zavedeni"

    fun nastavenoDokonceno(c: Context): Boolean =
        runCatching { Settings.Secure.getInt(c.contentResolver, "user_setup_complete", 0) == 1 }.getOrDefault(false) &&
            runCatching { Settings.Global.getInt(c.contentResolver, Settings.Global.DEVICE_PROVISIONED, 0) == 1 }.getOrDefault(false)

    /** Krok zavedení: zapsat do logu, do předvoleb (servis → diagnostika) a ohlásit serveru. */
    fun hlas(c: Context, krok: String, detail: String = "") {
        val radek = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date()) + " " + krok + (if (detail.isNotEmpty()) " – $detail" else "")
        android.util.Log.i("kp-zavedeni", radek)
        runCatching {
            val p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val stare = p.getString("kroky", "") ?: ""
            p.edit().putString("kroky", (stare + "\n" + radek).takeLast(1500)).apply()
        }
        Thread {
            runCatching {
                val u = Uri.parse(BuildConfig.KARTA_URL)
                val con = URL("${u.scheme}://${u.authority}/api/d/zavedeni").openConnection() as HttpURLConnection
                try {
                    con.connectTimeout = 6000; con.readTimeout = 6000
                    con.requestMethod = "POST"; con.doOutput = true
                    con.setRequestProperty("Content-Type", "application/json")
                    val telo = JSONObject()
                        .put("krok", krok).put("detail", detail.take(300))
                        .put("model", Build.MANUFACTURER + " " + Build.MODEL).put("android", Build.VERSION.RELEASE)
                        .put("verze", BuildConfig.VERSION_NAME).put("dokonceno", nastavenoDokonceno(c))
                    con.outputStream.use { it.write(telo.toString().toByteArray()) }
                    con.responseCode
                } finally { con.disconnect() }
            }
        }.apply { isDaemon = true }.start()
    }

    /** Diagnostika zavedení QR kódem (0.1.18, na výslovné přání provozovatele): během průvodce zapne ladění USB, aby šel z Macu
     *  vyčíst logcat průvodce Androidu ve chvíli, kdy se vrací na začátek. Správce zařízení smí globální nastavení měnit.
     *  Po zavedení se ladění vypíná v servisu (Nastavení Wi-Fi → Možnosti pro vývojáře) jako dosud. */
    fun zapnoutLadeni(c: Context) {
        runCatching {
            c.getSystemService(android.app.admin.DevicePolicyManager::class.java)
                .setGlobalSetting(android.content.ComponentName(c, AdminReceiver::class.java), Settings.Global.ADB_ENABLED, "1")
            hlas(c, "ladění USB zapnuto pro diagnostiku zavedení")
        }.onFailure { hlas(c, "ladění USB nejde zapnout", it.toString()) }
    }

    fun kroky(c: Context): String = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("kroky", "")?.trim().orEmpty().ifEmpty { "–" }

    /** Po nastavení správce: hned, když průvodce neběží (kabel), jinak počkat na jeho dokončení (QR). */
    fun dokoncit(c: Context, odkud: String) {
        if (nastavenoDokonceno(c)) {
            hlas(c, "kiosk hned", odkud)
            runCatching { Kiosk.nastavit(c) }.onFailure { hlas(c, "chyba nastavení kiosku", it.toString()) }
            runCatching { c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        } else {
            hlas(c, "průvodce běží – čekám na dokončení", odkud)
            runCatching { c.startForegroundService(Intent(c, DokonceniService::class.java)) }.onFailure { hlas(c, "službu dokončení nejde spustit", it.toString()) }
        }
    }
}

class DokonceniService : Service() {
    @Volatile private var bezi = false
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(KANAL, "Nastavení telefonu", NotificationManager.IMPORTANCE_MIN))
        val n: Notification = Notification.Builder(this, KANAL).setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentTitle("Karta pacienta").setContentText("Dokončuji nastavení telefonu").setOngoing(true).build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID, n)
        if (!bezi) {
            bezi = true
            Thread({
                val konec = System.currentTimeMillis() + 30 * 60_000L
                while (bezi && System.currentTimeMillis() < konec) {
                    if (Zavedeni.nastavenoDokonceno(this)) {
                        Thread.sleep(3000) // ať průvodce stihne zmizet
                        Zavedeni.hlas(this, "průvodce dokončen – zapínám kiosk")
                        runCatching { Kiosk.nastavit(this) }.onFailure { Zavedeni.hlas(this, "chyba nastavení kiosku", it.toString()) }
                        runCatching { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                            .onFailure { Zavedeni.hlas(this, "kartu nejde spustit", it.toString()) }
                        Zavedeni.hlas(this, "hotovo")
                        break
                    }
                    Thread.sleep(2000)
                }
                bezi = false
                stopSelf()
            }, "kp-zavedeni").apply { isDaemon = true; start() }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() { bezi = false; super.onDestroy() }

    companion object { private const val KANAL = "zavedeni"; private const val ID = 8 }
}
