package cz.centrumlb.kartapacienta

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/** Správce zařízení. Po nastavení (adb nebo QR kód při prvním zapnutí) zapne kiosk a spustí kartu – u QR až po dokončení průvodce (Zavedeni). */
class AdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Zavedeni.hlas(context, "správce zařízení zapnut")
        if (Zavedeni.nastavenoDokonceno(context)) Kiosk.nastavit(context)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        Zavedeni.hlas(context, "PROFILE_PROVISIONING_COMPLETE")
        Zavedeni.dokoncit(context, "provisioning complete")
    }
}
