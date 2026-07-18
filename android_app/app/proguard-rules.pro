# Best optimized ProGuard rules for WebView wrapper applications.
# These rules let R8 fully optimize and shrink the code, while protecting JavaScript interfaces and WebView callbacks from being broken by obfuscation.

# 1. Keep JavascriptInterfaces intact so JavaScript code can successfully invoke Kotlin methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 2. Prevent stripping or renaming of WebViewClient and WebChromeClient callback overrides
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(***);
    public *** *(***);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(***);
    public *** *(***);
}

# 3. Optimize and keep general Android components intact
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# 4. Suppress warnings from platform and standard libraries to ensure a clean build
-dontwarn android.webkit.**
