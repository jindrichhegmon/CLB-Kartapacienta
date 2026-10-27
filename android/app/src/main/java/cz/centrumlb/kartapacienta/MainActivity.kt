package cz.centrumlb.kartapacienta

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * Obálka webové karty (/karta/). Karta sama řeší šifrování, offline data i synchronizaci,
 * aplikace jen drží telefon v kiosku, otevírá volání a pustí servis po zadání PINu.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var chyba: View
    private var chybaNacteni = false
    private var cekajiciKamera: PermissionRequest? = null

    private val puvod: String by lazy { puvodUrl(Uri.parse(BuildConfig.KARTA_URL)) }

    // Servisní gesto: 5 klepnutí do levého horního rohu během 3 s.
    private val klepnuti = ArrayDeque<Long>()
    private var spatnychPinu = 0
    private var pinZablokovanDo = 0L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Kreslíme pod systémové lišty a odsadíme sami (Android 15 to vynucuje, na starších sjednotíme).
        window.setDecorFitsSystemWindows(false)
        window.insetsController?.setSystemBarsAppearance(
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
            WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
        )

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().setAcceptCookie(true)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true // IndexedDB a localStorage karty
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportMultipleWindows(false)
            settings.userAgentString = settings.userAgentString + " KartaPacientaAndroid/" + BuildConfig.VERSION_NAME
            webViewClient = Klient()
            webChromeClient = Chrome() // alert()/confirm() a fotoaparát pro čtečku QR
        }

        chyba = obrazovkaChyby()
        val koren = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F3F5F8"))
            addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(chyba, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            setOnApplyWindowInsetsListener { v, insets ->
                val o = insets.getInsets(
                    WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime(),
                )
                v.setPadding(o.left, o.top, o.right, o.bottom)
                WindowInsets.CONSUMED
            }
        }
        setContentView(koren)

        web.loadUrl(BuildConfig.KARTA_URL)
    }

    override fun onResume() {
        super.onResume()
        Kiosk.zamknout(this) // i po návratu z Wi-Fi nebo z hovoru
    }

    override fun onStart() {
        super.onStart()
        getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(sit)
    }

    override fun onStop() {
        super.onStop()
        runCatching { getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(sit) }
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
        super.onDestroy()
    }

    @Deprecated("Zpětné tlačítko – na Androidu 12 až 15 stále volané")
    override fun onBackPressed() {
        when {
            web.canGoBack() -> web.goBack()
            Kiosk.jeZamceno(this) -> Unit // z kiosku se zpět neodchází
            else -> @Suppress("DEPRECATION") super.onBackPressed()
        }
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN && Kiosk.jeSpravce(this)) {
            val roh = 96 * resources.displayMetrics.density
            if (ev.x < roh && ev.y < roh) {
                val ted = SystemClock.elapsedRealtime()
                klepnuti.addLast(ted)
                while (klepnuti.isNotEmpty() && ted - klepnuti.first() > 3000) klepnuti.removeFirst()
                if (klepnuti.size >= 5) {
                    klepnuti.clear()
                    zadatPin()
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    // ---- web ----

    /** Fotoaparát jen pro kartu (čtení párovacího QR kódu); jiné zdroje a cizí původ se zamítnou. */
    private inner class Chrome : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                val kamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                if (!kamera || puvodUrl(request.origin) != puvod) {
                    request.deny()
                    return@runOnUiThread
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                } else {
                    cekajiciKamera = request
                    requestPermissions(arrayOf(Manifest.permission.CAMERA), KAMERA)
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != KAMERA) return
        val r = cekajiciKamera ?: return
        cekajiciKamera = null
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            r.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } else {
            r.deny() // karta sama nabídne ruční opsání kódu
        }
    }

    private inner class Klient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url
            return when {
                u.scheme == "tel" -> { zavolat(u); true }
                puvodUrl(u) == puvod -> false
                Kiosk.jeZamceno(this@MainActivity) -> { zprava("Odkaz mimo kartu je v kiosku zablokovaný"); true }
                else -> { otevrit(Intent(Intent.ACTION_VIEW, u)); true }
            }
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            chybaNacteni = false
        }

        override fun onPageFinished(view: WebView, url: String?) {
            chyba.visibility = if (chybaNacteni) View.VISIBLE else View.GONE
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                chybaNacteni = true
                chyba.visibility = View.VISIBLE
            }
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // Spadlý WebView nesmí shodit kiosk – aktivitu postavíme znovu.
            recreate()
            return true
        }
    }

    private val sit = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            runOnUiThread { if (chybaNacteni) nacistZnovu() }
        }
    }

    private fun nacistZnovu() {
        if (web.url.isNullOrEmpty()) web.loadUrl(BuildConfig.KARTA_URL) else web.reload()
    }

    private fun obrazovkaChyby(): View {
        val d = resources.displayMetrics.density
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#F3F5F8"))
            setPadding((24 * d).toInt(), 0, (24 * d).toInt(), 0)
            visibility = View.GONE
            isClickable = true
            addView(TextView(context).apply {
                text = "Kartu se nepodařilo načíst.\nPřipojte telefon k internetu – stačí jednou, pak karta funguje i bez signálu."
                textSize = 18f
                gravity = Gravity.CENTER
                setTextColor(Color.parseColor("#1F2937"))
            })
            addView(Button(context).apply {
                text = "Zkusit znovu"
                setOnClickListener { nacistZnovu() }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = (16 * d).toInt()
            })
        }
    }

    private fun zavolat(u: Uri) {
        // Vytáčení (ne přímé volání): člověk vidí číslo a hovor potvrdí. Dialer je povolený v kiosku.
        otevrit(Intent(Intent.ACTION_DIAL, u))
    }

    private fun otevrit(i: Intent) {
        try {
            startActivity(i)
        } catch (_: ActivityNotFoundException) {
            zprava("Na telefonu chybí aplikace, která by to otevřela")
        }
    }

    // ---- servis ----

    private fun zadatPin() {
        val ted = SystemClock.elapsedRealtime()
        if (ted < pinZablokovanDo) {
            zprava("Servis je po chybných PINech na chvíli zablokovaný")
            return
        }
        val pole = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "Servisní PIN"
        }
        val obal = FrameLayout(this).apply {
            val p = (20 * resources.displayMetrics.density).toInt()
            setPadding(p, p / 2, p, 0)
            addView(pole)
        }
        AlertDialog.Builder(this)
            .setTitle("Servis telefonu")
            .setView(obal)
            .setPositiveButton("Pokračovat") { _, _ ->
                val pin = pole.text.toString()
                if (pin.isNotEmpty() && Kiosk.sha256(pin) == BuildConfig.SERVIS_PIN_SHA256) {
                    spatnychPinu = 0
                    servisniNabidka()
                } else {
                    spatnychPinu++
                    if (spatnychPinu >= 5) {
                        spatnychPinu = 0
                        pinZablokovanDo = SystemClock.elapsedRealtime() + 15 * 60 * 1000
                    }
                    zprava("Špatný PIN")
                }
            }
            .setNegativeButton("Zrušit", null)
            .show()
    }

    private fun servisniNabidka() {
        val volby = if (Kiosk.servisniRezim) {
            listOf(
                "Znovu zamknout do kiosku" to { Kiosk.znovuZamknout(this) },
                "Obnovit kartu" to { nacistZnovu() },
                "Vrátit telefon (zrušit správu zařízení)" to { potvrditZruseni() },
            )
        } else {
            listOf(
                "Nastavení Wi-Fi" to {
                    Kiosk.pustitNaChvili(this)
                    otevrit(Intent(Settings.Panel.ACTION_WIFI))
                },
                "Obnovit kartu" to { nacistZnovu() },
                "Ukončit kiosk (do restartu)" to { Kiosk.uvolnit(this); zprava("Kiosk je vypnutý do restartu telefonu") },
                "Vrátit telefon (zrušit správu zařízení)" to { potvrditZruseni() },
            )
        }
        AlertDialog.Builder(this)
            .setTitle("Servis")
            .setItems(volby.map { it.first }.toTypedArray()) { _, i -> volby[i].second() }
            .setNegativeButton("Zavřít", null)
            .show()
    }

    private fun potvrditZruseni() {
        AlertDialog.Builder(this)
            .setTitle("Vrátit telefon?")
            .setMessage("Telefon přestane být kioskem a aplikaci půjde odinstalovat. Data karty v telefonu zůstanou, dokud ji nezablokujete v centrální aplikaci nebo telefon neresetujete do továrního nastavení.")
            .setPositiveButton("Vrátit") { _, _ ->
                Kiosk.zrusitSpravu(this)
                zprava("Správa zařízení zrušena")
            }
            .setNegativeButton("Zpět", null)
            .show()
    }

    private fun zprava(t: String) = Toast.makeText(this, t, Toast.LENGTH_LONG).show()

    companion object {
        private const val KAMERA = 1
        fun puvodUrl(u: Uri) = "${u.scheme}://${u.authority}"
    }
}
