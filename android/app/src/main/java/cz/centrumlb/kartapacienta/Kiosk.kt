package cz.centrumlb.kartapacienta

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.UserManager
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

    /** Pravidla zařízení – idempotentní, volá se při každém návratu do aplikace. */
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
        d.addUserRestriction(a, UserManager.DISALLOW_SAFE_BOOT) // nouzový režim by kiosk obešel
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

    /** Servis: kiosk vypnutý do restartu aplikace. */
    fun uvolnit(a: Activity) {
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
