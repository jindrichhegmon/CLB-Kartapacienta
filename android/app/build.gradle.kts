import java.security.MessageDigest
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Nastavení mimo git: android/local.properties (nebo ~/.gradle/gradle.properties)
//   kp.url=https://…/karta/        adresa karty (výchozí = živý server)
//   kp.servisPin=…                 servisní PIN pro odchod z kiosku (povinný pro release)
val lokalni = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun nastaveni(klic: String): String? = lokalni.getProperty(klic) ?: (findProperty(klic) as String?)

val kartaUrl = nastaveni("kp.url") ?: "https://kartapacienta.95-216-201-2.sslip.io/karta/"
fun sha256(s: String) = MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
val servisPin = nastaveni("kp.servisPin")

android {
    namespace = "cz.centrumlb.kartapacienta"
    compileSdk = 35

    defaultConfig {
        // Pozor: applicationId nejde po prvním nahrání do Google Play změnit.
        applicationId = "cz.centrumlb.kartapacienta"
        minSdk = 31
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "KARTA_URL", "\"$kartaUrl\"")
    }

    buildTypes {
        debug {
            // Bez nastaveného PINu má ladicí verze PIN 1234.
            buildConfigField("String", "SERVIS_PIN_SHA256", "\"${sha256(servisPin ?: "1234")}\"")
        }
        release {
            if (servisPin == null) {
                // Release bez servisního PINu by z kiosku nešel ukončit.
                gradle.taskGraph.whenReady {
                    if (allTasks.any { it.name.contains("Release") }) {
                        throw GradleException("Chybí kp.servisPin v android/local.properties – bez něj nejde release sestavit.")
                    }
                }
            }
            buildConfigField("String", "SERVIS_PIN_SHA256", "\"${sha256(servisPin ?: "")}\"")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
