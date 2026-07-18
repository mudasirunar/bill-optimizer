package com.fyp.aibilloptimizer.ui.screens.webview

import android.view.ViewGroup
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
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

    // Intercept back presses to go back in WebView history
    BackHandler(enabled = canGoBack) {
        webView?.goBack()
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

                val view = WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    
                    // Prevent white flash by setting default background to Dark Obsidian
                    setBackgroundColor(android.graphics.Color.parseColor("#030A06"))
                    
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            swipeRefreshLayout.isRefreshing = false
                            canGoBack = view?.canGoBack() == true
                            isLoading = false // Hide loader when content is ready
                        }

                        @Deprecated("Deprecated in Java")
                        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                            return false // Let WebView handle redirection naturally
                        }
                    }

                    webChromeClient = object : android.webkit.WebChromeClient() {
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
                                webViewClient = object : WebViewClient() {}
                                
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    setSupportMultipleWindows(true)
                                    setJavaScriptCanOpenWindowsAutomatically(true)
                                    val defaultUA = userAgentString
                                    userAgentString = defaultUA.replace(Regex("Version/[0-9.]+"), "")
                                }
                            }
                            
                            val dialog = android.app.Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen).apply {
                                setContentView(popupWebView)
                                show()
                            }
                            
                            popupWebView.webChromeClient = object : android.webkit.WebChromeClient() {
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
                        userAgentString = defaultUA.replace(Regex("Version/[0-9.]+"), "")
                        cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
                    }
                    
                    loadUrl(url)
                }
                
                webView = view
                swipeRefreshLayout.setOnRefreshListener {
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
        )

        // Loading Overlay (Acts as our brand Custom Splash Screen while WebView loads the URL)
        if (isLoading) {
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
    }
}
