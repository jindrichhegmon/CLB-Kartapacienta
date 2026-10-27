package cz.centrumlb.kartapacienta

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle

/**
 * Nastavení telefonu QR kódem v průvodci prvního zapnutí (6× klepnout na úvodní obrazovku).
 * Android 12+ se správce ptá na režim – karta chce vždy plně spravované zařízení.
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
            setResult(RESULT_OK) // ADMIN_POLICY_COMPLIANCE – pravidla se nastaví v AdminReceiver
        }
        finish()
    }
}
