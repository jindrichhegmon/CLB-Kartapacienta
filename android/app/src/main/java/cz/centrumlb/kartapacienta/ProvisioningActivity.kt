package cz.centrumlb.kartapacienta

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle

/**
 * Nastavení telefonu QR kódem v průvodci prvního zapnutí (6× klepnout na úvodní obrazovku).
 * Android 12+ se správce ptá na režim – karta chce vždy plně spravované zařízení. V kroku ADMIN_POLICY_COMPLIANCE se jen
 * potvrdí výsledek a spustí čekání na konec průvodce (Zavedeni.dokoncit); kiosk se zapne až potom – zapnutý uprostřed
 * průvodce vracel průvodce na začátek (0.1.13–0.1.15).
 */
class ProvisioningActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.action == DevicePolicyManager.ACTION_GET_PROVISIONING_MODE) {
            Zavedeni.hlas(this, "dotaz na režim – plně spravované zařízení")
            setResult(
                RESULT_OK,
                Intent().putExtra(
                    DevicePolicyManager.EXTRA_PROVISIONING_MODE,
                    DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE,
                ),
            )
        } else {
            Zavedeni.hlas(this, "ADMIN_POLICY_COMPLIANCE", "správce: " + Kiosk.jeSpravce(this))
            Zavedeni.dokoncit(this, "compliance")
            setResult(RESULT_OK)
        }
        finish()
    }
}
