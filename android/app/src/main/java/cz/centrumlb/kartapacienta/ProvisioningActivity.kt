package cz.centrumlb.kartapacienta

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle

/**
 * Nastavení telefonu QR kódem v průvodci prvního zapnutí (6× klepnout na úvodní obrazovku).
 * Android 12+ se správce ptá na režim – karta chce vždy plně spravované zařízení. Po instalaci pak Android spustí
 * ADMIN_POLICY_COMPLIANCE: tady se (od 0.1.14) rovnou zapne kiosk a otevře karta s párovacím oknem, stejně jako po
 * nastavení kabelem – na telefonu už není co dělat, jen spárovat s pacientem.
 */
class ProvisioningActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.action == DevicePolicyManager.ACTION_GET_PROVISIONING_MODE) {
            setResult(
                RESULT_OK,
                Intent().putExtra(
                    DevicePolicyManager.EXTRA_PROVISIONING_MODE,
                    DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE,
                ),
            )
        } else {
            // ADMIN_POLICY_COMPLIANCE – aplikace už je správcem zařízení: zapnout kiosk a spustit kartu
            runCatching { Kiosk.nastavit(this) }
            runCatching {
                startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
            }
            setResult(RESULT_OK)
        }
        finish()
    }
}
