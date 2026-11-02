package cz.centrumlb.kartapacienta

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/** Správce zařízení. Po nastavení (adb nebo QR kód při prvním zapnutí) zapne kiosk a spustí kartu – u QR až po dokončení průvodce (Zavedeni). */
class AdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        val d = context.getSystemService(android.app.admin.DevicePolicyManager::class.java)
        Zavedeni.hlas(context, "správce zařízení zapnut", "správce: ${d.isDeviceOwnerApp(context.packageName)}; stav zavedení uživatele: ${runCatching { d.userProvisioningState }.getOrDefault(-1)}; provisioned: ${runCatching { android.provider.Settings.Global.getInt(context.contentResolver, android.provider.Settings.Global.DEVICE_PROVISIONED, 0) }.getOrDefault(-1)}")
        if (Zavedeni.nastavenoDokonceno(context)) Kiosk.nastavit(context)
        else Zavedeni.zapnoutLadeni(context) // zavedení QR kódem: diagnostika průvodce (0.1.18)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        Zavedeni.hlas(context, "PROFILE_PROVISIONING_COMPLETE")
        Zavedeni.dokoncit(context, "provisioning complete")
    }
}
