package cz.centrumlb.kartapacienta

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.net.HttpURLConnection
import java.net.URL

/**
 * Zvonění při zhasnuté obrazovce (0.1.8). Stránka karty se na server ptá jen, když je vidět; po zhasnutí displeje by hovor z centrály
 * nezazvonil. Karta proto aplikaci předá klíč jen pro zvonění (videoToken – nic jiného s ním nejde) a aplikace se při zhasnuté obrazovce
 * ptá serveru sama. Když centrála volá, probudí a rozsvítí telefon – karta se ukáže, sama se zeptá serveru a zazvoní jako obvykle.
 */
object Zvoneni {
    private const val PREFS = "zvoneni"

    fun uloz(c: Context, adresa: String, token: String) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("adresa", adresa).putString("token", token).apply()
        spustit(c)
    }

    fun zapomen(c: Context) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun nastaveni(c: Context): Pair<String, String>? {
        val p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val a = p.getString("adresa", null) ?: return null
        val t = p.getString("token", null) ?: return null
        return a to t
    }

    fun spustit(c: Context) {
        if (nastaveni(c) == null) return
        runCatching { c.startForegroundService(Intent(c, ZvoneniService::class.java)) }
    }
}

class ZvoneniService : Service() {
    @Volatile private var bezi = false
    private var vlakno: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        doPopredi()
        if (!bezi) {
            bezi = true
            vlakno = Thread({ smycka() }, "kp-zvoneni").apply { isDaemon = true; start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        bezi = false
        vlakno?.interrupt()
        super.onDestroy()
    }

    private fun doPopredi() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(KANAL, "Videohovory", NotificationManager.IMPORTANCE_MIN).apply { description = "Karta je připravená přijmout videohovor i při zhasnuté obrazovce" },
        )
        val n: Notification = Notification.Builder(this, KANAL)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Karta pacienta")
            .setContentText("Připravena přijmout videohovor")
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID, n)
    }

    /** Každých 15 s při zhasnuté obrazovce: GET /api/d/video s klíčem pro zvonění; „ZVONI“ od centrály → probudit telefon. */
    private fun smycka() {
        val pm = getSystemService(PowerManager::class.java)
        while (bezi) {
            try {
                if (!pm.isInteractive) {
                    val n = Zvoneni.nastaveni(this)
                    if (n == null) { stopSelf(); return }
                    when (zjisti(n.first, n.second)) {
                        Stav.ZVONI -> { probud(pm); Thread.sleep(45_000) }
                        Stav.NEPLATNY -> { Zvoneni.zapomen(this); stopSelf(); return }
                        else -> Unit
                    }
                }
                Thread.sleep(15_000)
            } catch (e: InterruptedException) {
                return
            } catch (e: Exception) {
                runCatching { Thread.sleep(15_000) }
            }
        }
    }

    private enum class Stav { KLID, ZVONI, NEPLATNY }

    private fun zjisti(adresa: String, token: String): Stav {
        val c = URL("$adresa/api/d/video").openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 8000; c.readTimeout = 8000
            c.setRequestProperty("Authorization", "Video $token")
            c.setRequestProperty("Accept", "application/json")
            val kod = c.responseCode
            if (kod == 401) return Stav.NEPLATNY
            if (kod != 200) return Stav.KLID
            val telo = c.inputStream.bufferedReader().readText()
            return if (telo.contains("\"stav\":\"ZVONI\"") && telo.contains("\"zahajil\":\"CENTRALA\"")) Stav.ZVONI else Stav.KLID
        } finally {
            c.disconnect()
        }
    }

    /** Rozsvítí displej a dá kartu do popředí (správce zařízení smí aktivitu spustit i z pozadí; zámek obrazovky je v kiosku vypnutý). */
    private fun probud(pm: PowerManager) {
        @Suppress("DEPRECATION")
        val wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE, "kp:zvoneni")
        runCatching { wl.acquire(20_000) }
        runCatching {
            startActivity(
                Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            )
        }
    }

    companion object {
        private const val KANAL = "zvoneni"
        private const val ID = 7
    }
}
