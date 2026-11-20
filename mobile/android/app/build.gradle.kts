import java.util.Properties
import java.net.URI
import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val signingFile = rootProject.file("key.properties")
val releaseKeys = Properties().apply {
    if (signingFile.exists()) signingFile.inputStream().use { load(it) }
}
val hasReleaseKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all {
    !releaseKeys.getProperty(it).isNullOrBlank()
}
val releaseId = System.getenv("CLYRA_ANDROID_APPLICATION_ID") ?: "com.example.clyra"
val releaseRequested = gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }
val localDemo = System.getenv("CLYRA_LOCAL_DEMO_APK") == "true"
val defines = (project.findProperty("dart-defines") as String?).orEmpty().split(",")
    .filter { it.isNotBlank() }.map { String(Base64.getDecoder().decode(it)) }
val api = defines.firstOrNull { it.startsWith("API_BASE_URL=") }?.substringAfter("=")
if (releaseRequested && localDemo) {
    require(api == "http://127.0.0.1:4001/api/v1") {
        "Local demo APKs must use the USB/adb-reverse loopback API."
    }
}
if (releaseRequested && !localDemo) {
    require(releaseId.matches(Regex("[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*){2,}")) &&
        !releaseId.startsWith("com.example.")) {
        "Set CLYRA_ANDROID_APPLICATION_ID to your approved Play Store application ID."
    }
    require(hasReleaseKeys) { "Release signing requires private mobile/android/key.properties. See docs/deployment/ANDROID.md." }
    require(releaseKeys.getProperty("keyAlias") != "androiddebugkey") { "A debug key cannot sign a store release." }
    val uri = api?.let { URI(it) }
    val host = uri?.host.orEmpty().lowercase()
    val localOrPlaceholder = host == "localhost" || !host.contains(".") ||
        Regex(".*\\.(localhost|local|invalid|test|example)$").matches(host) ||
        host == "example.com" || host.endsWith(".example.com") ||
        Regex("^(0\\.|10\\.|127\\.|169\\.254\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|\\[).*").matches(host)
    require(uri?.scheme == "https" && host.isNotBlank() && !localOrPlaceholder && uri.userInfo == null &&
        uri.path.endsWith("/api/v1") && uri.query == null && uri.fragment == null) {
        "Release builds require --dart-define=API_BASE_URL=https://your-public-api/api/v1."
    }
}

android {
    namespace = "com.example.clyra"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = releaseId
        manifestPlaceholders["clyraCleartext"] = localDemo.toString()
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeys) {
            create("release") {
                keyAlias = releaseKeys.getProperty("keyAlias")
                keyPassword = releaseKeys.getProperty("keyPassword")
                storeFile = rootProject.file(releaseKeys.getProperty("storeFile"))
                storePassword = releaseKeys.getProperty("storePassword")
            }
        }
    }
    buildTypes {
        release {
            // Explicit USB-only demonstration build; never a public/store signing identity.
            signingConfig = if (localDemo) signingConfigs.getByName("debug") else signingConfigs.findByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
