package cz.centrumlb.kartapacienta

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/** Správce zařízení. Po nastavení (adb nebo QR kód při prvním zapnutí) zapne kiosk a spustí kartu – u QR až po dokončení průvodce (Zavedeni). */
class AdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        val d = context.getSystemService(android.app.admin.DevicePolicyManager::class.java)
        val spravce: Boolean = d.isDeviceOwnerApp(context.packageName)
        val stavUzivatele: Int = try { d.userProvisioningState } catch (e: Exception) { -1 }
        val provisioned: Int = try { android.provider.Settings.Global.getInt(context.contentResolver, android.provider.Settings.Global.DEVICE_PROVISIONED, 0) } catch (e: Exception) { -1 }
        Zavedeni.hlas(context, "správce zařízení zapnut", "správce: $spravce; stav zavedení uživatele: $stavUzivatele; provisioned: $provisioned")
        if (Zavedeni.nastavenoDokonceno(context)) Kiosk.nastavit(context)
        else Zavedeni.zapnoutLadeni(context) // zavedení QR kódem: diagnostika průvodce (0.1.18)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        Zavedeni.hlas(context, "PROFILE_PROVISIONING_COMPLETE")
        Zavedeni.dokoncit(context, "provisioning complete")
    }
}
