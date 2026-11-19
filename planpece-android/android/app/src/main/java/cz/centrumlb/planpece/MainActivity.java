package cz.centrumlb.planpece;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Collections;

/**
 * Průkaz pro plán péče – obal stránky /prukaz/ serveru Karty pacienta.
 *
 * Android WebView neumí dvě věci, které stránka používá:
 *  1. stažení souboru přes <a download href="blob:..."> (záloha karty, export) – tiše by se nestalo nic,
 *  2. window.print() (PDF / tisk krizové karty).
 * Proto se do stránky na začátku načtení vloží malý skript, který tyto dvě cesty přesměruje do aplikace:
 * soubor se předá systémové nabídce Sdílet / Uložit (Disk Google, Soubory, e-mail…), tisk otevře
 * systémový tisk Androidu (lze „Uložit jako PDF“). Rozhraní funguje jen pro stránku z adresy serveru Karty.
 */
public class MainActivity extends BridgeActivity {

    static final String SERVER = "https://kartapacienta.95-216-201-2.sslip.io";

    private static final String SKRIPT =
        "(function(){if(window.__planPeceApp)return;window.__planPeceApp=1;" +
        "var A=window.AndroidPrukaz;if(!A)return;" +
        "var puv=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){var h=this.href||'',n=this.getAttribute('download');" +
        "if(n!==null&&(h.indexOf('blob:')===0||h.indexOf('data:')===0)){fetch(h).then(function(r){return r.blob();})" +
        ".then(function(b){var f=new FileReader();f.onload=function(){var s=String(f.result);" +
        "A.ulozSoubor(n||'soubor',b.type||'application/octet-stream',s.slice(s.indexOf(',')+1));};f.readAsDataURL(b);})" +
        ".catch(function(e){alert('Soubor se nepodařilo připravit: '+e);});return;}return puv.apply(this,arguments);};" +
        "window.print=function(){A.tisk(document.title||'Průkaz pro plán péče');};" +
        "})();";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView wv = getBridge().getWebView();
        wv.addJavascriptInterface(new Most(), "AndroidPrukaz");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(wv, SKRIPT, Collections.singleton(SERVER));
        }
    }

    /** Volá se z JavaScriptu (vlákno mimo UI) – vše se ověří a provede na UI vlákně. */
    private class Most {

        @JavascriptInterface
        public void ulozSoubor(final String jmeno, final String mime, final String base64) {
            runOnUiThread(() -> {
                if (!zeServeru()) return;
                try {
                    String bezpecne = jmeno.replaceAll("[^A-Za-z0-9._-]", "_");
                    if (bezpecne.isEmpty()) bezpecne = "soubor";
                    File dir = new File(getCacheDir(), "sdileni");
                    dir.mkdirs();
                    File f = new File(dir, bezpecne);
                    try (FileOutputStream o = new FileOutputStream(f)) {
                        o.write(Base64.decode(base64, Base64.DEFAULT));
                    }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.putExtra(Intent.EXTRA_SUBJECT, bezpecne);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(i, "Uložit nebo poslat: " + bezpecne));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Soubor se nepodařilo uložit: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void tisk(final String nazev) {
            runOnUiThread(() -> {
                if (!zeServeru()) return;
                WebView wv = getBridge().getWebView();
                PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String n = (nazev == null || nazev.isEmpty()) ? "Průkaz pro plán péče" : nazev;
                PrintDocumentAdapter a = wv.createPrintDocumentAdapter(n);
                pm.print(n, a, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        private boolean zeServeru() {
            String u = getBridge().getWebView().getUrl();
            return u != null && u.startsWith(SERVER + "/");
        }
    }
}
