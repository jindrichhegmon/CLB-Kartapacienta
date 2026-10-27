package cz.centrumlb.kartapacienta

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/** Správce zařízení. Po nastavení (adb nebo QR kód při prvním zapnutí) zapne kiosk a spustí kartu. */
class AdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        Kiosk.nastavit(context)
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        Kiosk.nastavit(context)
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
