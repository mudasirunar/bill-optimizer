package com.fyp.aibilloptimizer.ui.screens.webview

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.fyp.aibilloptimizer.R
import com.fyp.aibilloptimizer.ui.theme.DarkObsidian
import com.fyp.aibilloptimizer.ui.theme.MintNeon

@Composable
fun WebViewScreen(
    url: String,
    modifier: Modifier = Modifier
) {
    var webView: WebView? by remember { mutableStateOf(null) }
    var canGoBack by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var isError by remember { mutableStateOf(false) }

    val context = LocalContext.current
    var isOnline by remember { mutableStateOf(true) }

    // Intercept back presses to go back in WebView history
    BackHandler(enabled = canGoBack) {
        webView?.goBack()
    }

    // Real-Time Network Connectivity Monitor with Auto-Reload on Restore
    DisposableEffect(context) {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        // Initial setup check
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
        isOnline = capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        if (!isOnline) {
            isError = true
        }

        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                if (!isOnline) {
                    isOnline = true
                    // Auto-reload the WebView once network is restored!
                    if (isError) {
                        isError = false
                        isLoading = true
                        webView?.post {
                            webView?.reload()
                        }
                    }
                }
            }

            override fun onLost(network: Network) {
                isOnline = false
                isError = true // Instantly trigger offline screen without waiting for page fails
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)

        onDispose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }

    // Animation for spinner
    val infiniteTransition = rememberInfiniteTransition(label = "rotation")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = LinearEasing)
        ),
        label = "angle"
    )

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { context ->
                val swipeRefreshLayout = SwipeRefreshLayout(context).apply {
                    setColorSchemeColors(android.graphics.Color.parseColor("#10B981"))
                    setProgressBackgroundColorSchemeColor(android.graphics.Color.parseColor("#0D1A12"))
                }

                val isAllowedInternalOrAuthUrl: (String?) -> Boolean = { url ->
                    if (url == null) false
                    else {
                        val cleanUrl = url.lowercase().trim()
                        val isExactHomepage = cleanUrl == "https://bill-optimizer.vercel.app" ||
                                cleanUrl == "https://bill-optimizer.vercel.app/" ||
                                cleanUrl == "http://bill-optimizer.vercel.app" ||
                                cleanUrl == "http://bill-optimizer.vercel.app/"
                        
                        if (isExactHomepage) {
                            false // Force exact homepage link to open in external browser
                        } else {
                            cleanUrl.contains("bill-optimizer.vercel.app") ||
                                    cleanUrl.contains("accounts.google.com") ||
                                    cleanUrl.contains("firebaseapp.com") ||
                                    cleanUrl.contains("google.co") ||
                                    (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://"))
                        }
                    }
                }

                val view = WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    
                    // Enable cookies and third-party cookies for Google OAuth session state sharing
                    android.webkit.CookieManager.getInstance().setAcceptCookie(true)
                    android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    
                    // Prevent white flash by setting default background to Dark Obsidian
                    setBackgroundColor(android.graphics.Color.parseColor("#030A06"))
                    
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            swipeRefreshLayout.isRefreshing = false
                            canGoBack = view?.canGoBack() == true
                            // Flush cookies to disk to guarantee session persistence across app launches
                            android.webkit.CookieManager.getInstance().flush()
                            // Only disable loading screen if we didn't hit a connection error
                            if (!isError) {
                                isLoading = false
                            }
                        }

                        private fun handleExternalLink(url: String?): Boolean {
                            if (url == null) return false
                            val isAllowed = isAllowedInternalOrAuthUrl(url)
                            
                            return if (isAllowed) {
                                false // Load internally inside the WebView
                            } else {
                                try {
                                    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)).apply {
                                        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                                    }
                                    context.startActivity(intent)
                                    true // Handled external redirection natively
                                } catch (e: Exception) {
                                    false // Fallback to WebView on failure
                                }
                            }
                        }

                        @Deprecated("Deprecated in Java")
                        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                            return handleExternalLink(url)
                        }

                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            return handleExternalLink(request?.url?.toString())
                        }

                        @Deprecated("Deprecated in Java")
                        override fun onReceivedError(
                            view: WebView?,
                            errorCode: Int,
                            description: String?,
                            failingUrl: String?
                        ) {
                            super.onReceivedError(view, errorCode, description, failingUrl)
                            isError = true
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            super.onReceivedError(view, request, error)
                            // Triggers on mainframe loading failure (e.g. offline)
                            if (request?.isForMainFrame == true) {
                                isError = true
                            }
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        // Redirect JS console logs to Android Logcat to trace web failures
                        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                            android.util.Log.d(
                                "WebViewConsole", 
                                "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}"
                            )
                            return true
                        }

                        override fun onCreateWindow(
                            view: WebView?,
                            isDialog: Boolean,
                            isUserGesture: Boolean,
                            resultMsg: android.os.Message?
                        ): Boolean {
                            val ctx = view?.context ?: return false
                            val popupWebView = WebView(ctx).apply {
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                
                                setBackgroundColor(android.graphics.Color.parseColor("#030A06"))
                                
                                // Enable cookies on popup window
                                android.webkit.CookieManager.getInstance().setAcceptCookie(true)
                                android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                                
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    setSupportMultipleWindows(true)
                                    setJavaScriptCanOpenWindowsAutomatically(true)
                                    val defaultUA = userAgentString
                                    userAgentString = defaultUA.replace(Regex("Version/[0-9.]+"), "") + " AiBillOptimizerAndroid"
                                }
                            }
                            
                            val dialog = android.app.Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen).apply {
                                setContentView(popupWebView)
                                setCancelable(true)
                                setOnDismissListener {
                                    popupWebView.destroy()
                                    android.webkit.CookieManager.getInstance().flush()
                                }
                                show()
                             }

                            popupWebView.webViewClient = object : WebViewClient() {
                                private fun handleExternalPopupLink(url: String?): Boolean {
                                    if (url == null) return false
                                    val isAllowed = isAllowedInternalOrAuthUrl(url)
                                    return if (isAllowed) {
                                        false // Load internally (Google Login flow)
                                    } else {
                                        try {
                                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)).apply {
                                                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                                            }
                                            ctx.startActivity(intent)
                                            dialog.dismiss() // Dismiss the blank dialog popup window
                                            true
                                        } catch (e: Exception) {
                                            false
                                        }
                                    }
                                }

                                @Deprecated("Deprecated in Java")
                                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                                    return handleExternalPopupLink(url)
                                }

                                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                    return handleExternalPopupLink(request?.url?.toString())
                                }
                            }
                            
                            popupWebView.webChromeClient = object : WebChromeClient() {
                                override fun onCloseWindow(window: WebView?) {
                                    super.onCloseWindow(window)
                                    dialog.dismiss()
                                }
                            }
                            
                            val transport = resultMsg?.obj as? WebView.WebViewTransport
                            transport?.webView = popupWebView
                            resultMsg?.sendToTarget()
                            return true
                        }
                    }
                    
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        setSupportMultipleWindows(true)
                        setJavaScriptCanOpenWindowsAutomatically(true)
                        val defaultUA = userAgentString
                        userAgentString = defaultUA.replace(Regex("Version/[0-9.]+"), "") + " AiBillOptimizerAndroid"
                        cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                    }
                    
                    loadUrl(url)
                }
                
                webView = view
                swipeRefreshLayout.setOnRefreshListener {
                    // Reset errors on pull-to-refresh
                    isError = false
                    isLoading = true
                    view.reload()
                }
                swipeRefreshLayout.addView(view)
                swipeRefreshLayout
            },
            update = {
                // Handle dynamic updates if needed
            },
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .graphicsLayer {
                    alpha = if (isLoading || isError) 0f else 1f
                }
        )

        // Loading Overlay (Acts as our brand Custom Splash Screen while WebView loads the URL)
        if (isLoading && !isError) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(DarkObsidian),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(124.dp)
                ) {
                    Canvas(
                        modifier = Modifier
                            .size(124.dp)
                            .graphicsLayer { rotationZ = angle }
                    ) {
                        drawArc(
                            color = MintNeon.copy(alpha = 0.2f),
                            startAngle = 0f,
                            sweepAngle = 360f,
                            useCenter = false,
                            style = Stroke(width = 4.dp.toPx())
                        )
                        drawArc(
                            color = MintNeon,
                            startAngle = -90f,
                            sweepAngle = 90f,
                            useCenter = false,
                            style = Stroke(width = 4.dp.toPx())
                        )
                    }

                    Image(
                        painter = painterResource(id = R.drawable.ic_launcher_foreground),
                        contentDescription = "Loading Logo",
                        modifier = Modifier
                            .size(100.dp)
                            .clip(RoundedCornerShape(20.dp))
                    )
                }
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Text(
                    text = "Smart Bill Optimizer",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    ),
                    color = Color.White
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = "AI Energy Intelligence",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = MintNeon.copy(alpha = 0.8f),
                        letterSpacing = 2.sp
                    )
                )
            }
        }

        // Native Connection Error Screen Overlay (No web-dinosaur pages)
        if (isError) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(DarkObsidian),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = "Connection Warning",
                    tint = MintNeon,
                    modifier = Modifier.size(64.dp)
                )

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Connection Failed",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    ),
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Unable to connect to Smart Bill Optimizer. Please check your network connection and try again.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 32.dp)
                )

                Spacer(modifier = Modifier.height(32.dp))

                Button(
                    onClick = {
                        isError = false
                        isLoading = true
                        webView?.reload()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MintNeon,
                        contentColor = DarkObsidian
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(48.dp)
                ) {
                    Text(
                        text = "Retry Connection",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }
            }
        }
    }
}
