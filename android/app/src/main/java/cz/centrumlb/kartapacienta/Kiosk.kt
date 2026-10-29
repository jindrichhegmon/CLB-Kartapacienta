package cz.centrumlb.kartapacienta

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import android.telecom.TelecomManager
import java.security.MessageDigest

/**
 * Kiosk režim. Funguje jen tehdy, když je aplikace správcem zařízení (Device Owner):
 *   adb shell dpm set-device-owner cz.centrumlb.kartapacienta/.AdminReceiver
 * Bez toho (např. instalace z Google Play) běží aplikace jako obyčejná aplikace.
 */
object Kiosk {
    /** Servisní odemčení platí do restartu aplikace / telefonu. */
    var servisniRezim = false

    private const val DOMOV = "cz.centrumlb.kartapacienta.DomovskaObrazovka"

    private fun dpm(c: Context) = c.getSystemService(DevicePolicyManager::class.java)
    private fun admin(c: Context) = ComponentName(c, AdminReceiver::class.java)

    fun jeSpravce(c: Context) = dpm(c).isDeviceOwnerApp(c.packageName)

    /** Aplikace právě drží telefon v kiosku. */
    fun jeZamceno(c: Context) = jeSpravce(c) && !servisniRezim

    /** Fotoaparát (čtečka QR) a mikrofon (videohovor): dialog oprávnění se v kiosku nezobrazí, správce zařízení je přidělí rovnou.
     *  Volá se i při každém startu aplikace (0.1.4) – telefon nastavený starší verzí (bez mikrofonu) tak oprávnění dostane po pouhé aktualizaci APK. */
    /** Vrací true, když jsou obě oprávnění opravdu přidělená. Od Androidu 12 správce zařízení fotoaparát a mikrofon přidělit nesmí
     *  (vrací false), pokud telefon nebyl zaveden QR kódem s PROVISIONING_SENSORS_PERMISSION_GRANT_OPT_OUT – pak se zeptá běžný dialog (MainActivity). */
    fun opravneni(c: Context): Boolean {
        if (!jeSpravce(c)) return false
        val d = dpm(c)
        val a = admin(c)
        val p = listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        p.forEach { runCatching { d.setPermissionGrantState(a, c.packageName, it, DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED) } }
        return p.all { c.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    }

    /** Pravidla zařízení – idempotentní, volá se po nastavení správce zařízení (AdminReceiver). */
    fun nastavit(c: Context) {
        if (!jeSpravce(c)) return
        val d = dpm(c)
        val a = admin(c)

        // V kiosku smí běžet jen karta a telefonní aplikace (volání kontaktům z karty a 155).
        val baliky = linkedSetOf(c.packageName)
        baliky += telefonniAplikace(c)
        d.setLockTaskPackages(a, baliky.toTypedArray())
        // Stavový řádek ukazuje čas a baterii (nejde rozbalit), podržení vypínače nabídne restart.
        d.setLockTaskFeatures(
            a,
            DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO or DevicePolicyManager.LOCK_TASK_FEATURE_GLOBAL_ACTIONS,
        )

        // Karta je domovská obrazovka → spustí se po zapnutí telefonu a tlačítko Domů vrací do ní.
        domovskaObrazovka(c, true)
        val domov = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        d.addPersistentPreferredActivity(a, domov, ComponentName(c.packageName, DOMOV))

        d.setKeyguardDisabled(a, true) // bez zámku obrazovky (vrací false, pokud je nastaven PIN telefonu)
        opravneni(c)
        d.addUserRestriction(a, UserManager.DISALLOW_SAFE_BOOT) // nouzový režim by kiosk obešel
        // Zvonění při zhasnuté obrazovce (0.1.8): bez výjimky z úspor energie by telefon v klidu (Doze) službě odpojil síť
        if (Build.VERSION.SDK_INT >= 34) vyjimkaZUspor(d, c.packageName)
    }

    /** DevicePolicyManager.setApplicationExemptions(balíček, {EXEMPT_FROM_POWER_RESTRICTIONS = 2}) – Android 14+; přes reflexi, aby šlo
     *  sestavit i se starším SDK v Android Studiu (0.1.10). Když metoda chybí nebo selže, nic se neděje – jen Doze může v klidu omezit síť. */
    private fun vyjimkaZUspor(d: DevicePolicyManager, balicek: String) {
        try {
            val m = DevicePolicyManager::class.java.getMethod("setApplicationExemptions", String::class.java, java.util.Set::class.java)
            val vyjimky: java.util.Set<Int> = java.util.HashSet<Int>().apply { add(2) } as java.util.Set<Int>
            m.invoke(d, balicek, vyjimky)
        } catch (e: Exception) {
            // bez výjimky
        }
    }

    /** Zamkne aktivitu do kiosku, pokud to jde a není zapnutý servis. */
    fun zamknout(a: Activity) {
        if (!jeZamceno(a)) return
        nastavit(a)
        val am = a.getSystemService(ActivityManager::class.java)
        if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE && dpm(a).isLockTaskPermitted(a.packageName)) {
            a.startLockTask()
        }
    }

    /** Dočasné uvolnění (např. kvůli Wi-Fi). Při návratu do aplikace se kiosk zase zamkne. */
    fun pustitNaChvili(a: Activity) {
        runCatching { a.stopLockTask() }
    }

    /** Čas zhasnutí displeje v ms (systémové nastavení); správce ho smí měnit přímo (setSystemSetting), hodnota přežije restart. */
    fun zhasinani(c: Context): Int = runCatching { Settings.System.getInt(c.contentResolver, Settings.System.SCREEN_OFF_TIMEOUT) }.getOrDefault(-1)

    fun nastavZhasinani(c: Context, ms: Int): Boolean {
        if (!jeSpravce(c)) return false
        return runCatching { dpm(c).setSystemSetting(admin(c), Settings.System.SCREEN_OFF_TIMEOUT, ms.toString()); true }.getOrDefault(false)
    }

    /** Servis: kiosk vypnutý do restartu aplikace. */
    fun uvolnit(a: Activity) {
        Zvoneni.zapomen(a); runCatching { a.stopService(Intent(a, ZvoneniService::class.java)) }
        servisniRezim = true
        runCatching { a.stopLockTask() }
    }

    fun znovuZamknout(a: Activity) {
        servisniRezim = false
        zamknout(a)
    }

    /** Vrácení telefonu: zruší všechna pravidla i roli správce. Pak jde aplikaci normálně odinstalovat. */
    fun zrusitSpravu(a: Activity) {
        val d = dpm(a)
        val ad = admin(a)
        servisniRezim = true
        runCatching { a.stopLockTask() }
        d.clearPackagePersistentPreferredActivities(ad, a.packageName)
        d.setLockTaskPackages(ad, emptyArray())
        d.setKeyguardDisabled(ad, false)
        d.clearUserRestriction(ad, UserManager.DISALLOW_SAFE_BOOT)
        d.setPermissionGrantState(ad, a.packageName, Manifest.permission.CAMERA, DevicePolicyManager.PERMISSION_GRANT_STATE_DEFAULT)
        d.setPermissionGrantState(ad, a.packageName, Manifest.permission.RECORD_AUDIO, DevicePolicyManager.PERMISSION_GRANT_STATE_DEFAULT)
        domovskaObrazovka(a, false)
        d.clearDeviceOwnerApp(a.packageName)
    }

    private fun domovskaObrazovka(c: Context, zapnout: Boolean) {
        val komp = ComponentName(c.packageName, DOMOV)
        val chci = if (zapnout) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
        if (c.packageManager.getComponentEnabledSetting(komp) != chci) {
            c.packageManager.setComponentEnabledSetting(komp, chci, PackageManager.DONT_KILL_APP)
        }
    }

    private fun telefonniAplikace(c: Context): Set<String> {
        val vysledek = mutableSetOf<String>()
        c.getSystemService(TelecomManager::class.java)?.defaultDialerPackage?.let { vysledek += it }
        c.packageManager.resolveActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:")), 0)
            ?.activityInfo?.packageName?.let { vysledek += it }
        vysledek += "com.android.server.telecom" // obrazovka hovoru na některých telefonech
        vysledek.remove("android") // výběrový dialog systému, ne aplikace
        return vysledek
    }

    fun sha256(s: String): String =
        MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
}
