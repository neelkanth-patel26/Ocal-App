package com.ocal.browser.mobile;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.BitmapFactory;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.graphics.drawable.GradientDrawable;
import android.view.VelocityTracker;
import android.view.ViewConfiguration;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.PathInterpolator;
import java.util.ArrayList;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    private WebView nativeWebBrowser;
    private FrameLayout browserSlideContainer;
    private FrameLayout backPeekContainer;
    private ImageView backPeekImageView;
    private View backPeekScrim;
    private View leftEdgeShadow;
    private static class PageSnapshotItem {
        final Bitmap bitmap;
        final String url;
        PageSnapshotItem(Bitmap bitmap, String url) {
            this.bitmap = bitmap;
            this.url = url;
        }
    }
    private final ArrayList<PageSnapshotItem> pageSnapshotStack = new ArrayList<>();
    private Bitmap homeSnapshotBitmap = null;
    private Bitmap lastRenderedPageSnapshot = null;
    private String lastRenderedPageUrl = null;
    private volatile boolean cachedCanGoBack = false;
    private volatile boolean cachedCanGoForward = false;
    private boolean isNavigatingBack = false;
    private boolean isCommitSlideAnimating = false;
    private boolean pageCommittedDuringSlide = false;
    private final Runnable peekSafetyFallback = this::revealCommittedPage;
    private boolean hasWebOverlayOpen = false;
    private boolean webCanGoBack = false;
    private boolean webIsAtRoot = true;
    private OnBackPressedCallback systemBackCallback;

    private float touchStartX = 0f;
    private float touchStartY = 0f;
    private boolean isEdgeGestureActive = false;
    private boolean isHorizontalSwipeLocked = false;
    private VelocityTracker velocityTracker = null;
    private int touchSlop = 0;

    private int dockHeightPx = 0;
    private boolean isDockTop = false;
    private String lastActiveTabThumbnail = null;
    private String mobileUserAgent = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
    private static final String DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    private boolean isDesktopModeEnabled = false;
    private volatile boolean isAdBlockerEnabled = true;
    private volatile int currentSiteBlockedCount = 0;

    private static final java.util.Set<String> AD_DOMAINS = new java.util.HashSet<>(java.util.Arrays.asList(
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
        "pagead2.googlesyndication.com", "adnxs.com", "criteo.com", "criteo.net",
        "amazon-adsystem.com", "adsystem.com", "rubiconproject.com", "pubmatic.com",
        "casalemedia.com", "openx.net", "appnexus.com", "smartadserver.com",
        "serving-sys.com", "bidswitch.net", "yieldmo.com", "indexexchange.com",
        "sovrn.com", "lijit.com", "undertone.com", "outbrain.com", "taboola.com",
        "mgid.com", "revcontent.com", "adblade.com", "zergnet.com", "google-analytics.com",
        "analytics.google.com", "hotjar.com", "clarity.ms", "scorecardresearch.com",
        "quantserve.com", "moatads.com", "pixel.facebook.com", "ads.twitter.com",
        "static.ads-twitter.com", "adroll.com", "advertising.com", "chartbeat.com",
        "chartbeat.net", "yandex.ru/metrika", "mc.yandex.ru", "mouseflow.com",
        "popads.net", "propellerads.com", "exoclick.com", "coinhive.com",
        "adcolony.com", "unityads.unity3d.com", "vungle.com", "ironsrc.com",
        "trafficjunky.com", "inmobi.com", "chartboost.com", "admob.com"
    ));

    private boolean isAdOrTracker(Uri uri) {
        if (!isAdBlockerEnabled || uri == null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase();
        for (String adDomain : AD_DOMAINS) {
            if (host.equals(adDomain) || host.endsWith("." + adDomain)) {
                return true;
            }
        }
        String path = uri.getPath();
        if (path != null) {
            String p = path.toLowerCase();
            if (p.contains("/pagead/") || p.contains("/adsbygoogle") || p.contains("/adservice/") || p.contains("/adserver/")) {
                return true;
            }
        }
        return false;
    }

    public void captureLastRenderedPage() {
        try {
            if (nativeWebBrowser == null || nativeWebBrowser.getWidth() <= 0 || nativeWebBrowser.getHeight() <= 0) return;
            String currentUrl = nativeWebBrowser.getUrl();
            if (currentUrl == null || currentUrl.isEmpty() || currentUrl.startsWith("about:")) return;

            int w = nativeWebBrowser.getWidth();
            int h = nativeWebBrowser.getHeight();
            float scale = 0.65f;
            int sw = Math.max(1, (int) (w * scale));
            int sh = Math.max(1, (int) (h * scale));
            Bitmap bmp = Bitmap.createBitmap(sw, sh, Bitmap.Config.RGB_565);
            Canvas canvas = new Canvas(bmp);
            canvas.scale(scale, scale);
            nativeWebBrowser.draw(canvas);

            if (lastRenderedPageSnapshot != null && !lastRenderedPageSnapshot.isRecycled()) {
                lastRenderedPageSnapshot.recycle();
            }
            lastRenderedPageSnapshot = bmp;
            lastRenderedPageUrl = currentUrl;
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "Error in captureLastRenderedPage", t);
        }
    }

    public void clearSnapshotStack() {
        for (PageSnapshotItem item : pageSnapshotStack) {
            if (item != null && item.bitmap != null && !item.bitmap.isRecycled()) {
                item.bitmap.recycle();
            }
        }
        pageSnapshotStack.clear();
        if (lastRenderedPageSnapshot != null && !lastRenderedPageSnapshot.isRecycled()) {
            lastRenderedPageSnapshot.recycle();
            lastRenderedPageSnapshot = null;
        }
        lastRenderedPageUrl = null;
    }

    private void updatePeekBlur(float progress) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && backPeekContainer != null) {
            try {
                float blurRadius = Math.max(0.1f, 24f * (1f - progress));
                if (blurRadius <= 0.6f) {
                    backPeekContainer.setRenderEffect(null);
                } else {
                    RenderEffect blur = RenderEffect.createBlurEffect(blurRadius, blurRadius, Shader.TileMode.CLAMP);
                    backPeekContainer.setRenderEffect(blur);
                }
            } catch (Throwable ignored) {}
        }
    }

    private void setupPeekImage() {
        if (backPeekContainer == null) return;
        final boolean canGoBack = (nativeWebBrowser != null && nativeWebBrowser.canGoBack()) || cachedCanGoBack;
        Bitmap peekBmp = null;

        if (canGoBack && !pageSnapshotStack.isEmpty()) {
            peekBmp = pageSnapshotStack.get(pageSnapshotStack.size() - 1).bitmap;
        } else if (!canGoBack && homeSnapshotBitmap != null && !homeSnapshotBitmap.isRecycled()) {
            peekBmp = homeSnapshotBitmap;
        }

        if (peekBmp != null && !peekBmp.isRecycled()) {
            backPeekImageView.setImageBitmap(peekBmp);
            backPeekImageView.setVisibility(View.VISIBLE);
        } else {
            backPeekImageView.setImageBitmap(null);
            backPeekImageView.setVisibility(View.GONE);
        }

        backPeekContainer.setVisibility(View.VISIBLE);
        backPeekContainer.bringToFront();
        if (browserSlideContainer != null) {
            browserSlideContainer.bringToFront();
        }
    }

    private void performGoBack() {
        runOnUiThread(() -> {
            try {
                if (browserSlideContainer != null) {
                    browserSlideContainer.removeCallbacks(peekSafetyFallback);
                    browserSlideContainer.setTranslationX(0);
                    browserSlideContainer.setVisibility(View.VISIBLE);
                }
                if (backPeekContainer != null) {
                    backPeekContainer.setVisibility(View.GONE);
                }
                final boolean canGoBack = (nativeWebBrowser != null && nativeWebBrowser.canGoBack()) || cachedCanGoBack;
                if (canGoBack && nativeWebBrowser != null) {
                    isNavigatingBack = true;
                    if (!pageSnapshotStack.isEmpty()) {
                        pageSnapshotStack.remove(pageSnapshotStack.size() - 1);
                    }
                    nativeWebBrowser.goBack();
                } else {
                    isNavigatingBack = false;
                    clearSnapshotStack();
                    if (nativeWebBrowser != null) {
                        nativeWebBrowser.setVisibility(View.GONE);
                    }
                    if (browserSlideContainer != null) {
                        browserSlideContainer.setVisibility(View.GONE);
                        browserSlideContainer.setTranslationX(0);
                    }
                    if (backPeekContainer != null) {
                        backPeekContainer.setVisibility(View.GONE);
                    }
                    notifyWebEvent("NAVIGATE_BACK_TO_INTERNAL", "ocal://home", "Start Page");
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in performGoBack", t);
            }
        });
    }

    private void startPeekAnimation() {
        // Disabled preview back animation per user request
    }

    private void updatePeekProgress(float progress) {
        // Disabled preview back animation per user request
    }

    private void commitPeekAnimation() {
        performGoBack();
    }

    private void revealCommittedPage() {
        runOnUiThread(() -> {
            try {
                isCommitSlideAnimating = false;
                pageCommittedDuringSlide = false;
                isNavigatingBack = false;
                if (browserSlideContainer != null) {
                    browserSlideContainer.removeCallbacks(peekSafetyFallback);
                    browserSlideContainer.setTranslationX(0);
                    browserSlideContainer.setVisibility(View.VISIBLE);
                }
                if (nativeWebBrowser != null) {
                    nativeWebBrowser.setVisibility(View.VISIBLE);
                }
                if (backPeekContainer != null) {
                    backPeekContainer.setVisibility(View.GONE);
                    backPeekContainer.setTranslationX(0);
                    backPeekContainer.setScaleX(1f);
                    backPeekContainer.setScaleY(1f);
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        backPeekContainer.setRenderEffect(null);
                    }
                    if (backPeekImageView != null) {
                        backPeekImageView.setImageBitmap(null);
                    }
                }
            } catch (Throwable ignored) {}
        });
    }

    private void cancelPeekAnimation() {
        runOnUiThread(() -> {
            try {
                if (browserSlideContainer != null) {
                    browserSlideContainer.setTranslationX(0);
                    browserSlideContainer.setVisibility(View.VISIBLE);
                }
                if (backPeekContainer != null) {
                    backPeekContainer.setVisibility(View.GONE);
                }
            } catch (Throwable ignored) {}
        });
    }

    private void notifyWebBackGesture(String action, float progress) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "BACK_GESTURE");
                obj.put("action", action);
                obj.put("progress", progress);
                String js = "window.handleBackGesture && window.handleBackGesture(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Throwable ignored) {}
        });
    }

    private void setupBackGestureDispatcher() {
        systemBackCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackStarted(@NonNull BackEventCompat backEvent) {
                // Disabled preview back animation per user request
            }

            @Override
            public void handleOnBackProgressed(@NonNull BackEventCompat backEvent) {
                // Disabled preview back animation per user request
            }

            @Override
            public void handleOnBackPressed() {
                if (hasWebOverlayOpen) {
                    notifyWebBackGesture("commit", 1f);
                    return;
                }
                if (nativeWebBrowser != null && nativeWebBrowser.getVisibility() == View.VISIBLE) {
                    performGoBack();
                } else {
                    notifyWebBackGesture("commit", 1f);
                }
            }

            @Override
            public void handleOnBackCancelled() {
                // No-op
            }
        };
        getOnBackPressedDispatcher().addCallback(this, systemBackCallback);
    }

    public String captureActiveTabThumbnailNow(final String tabId) {
        try {
            if (nativeWebBrowser == null || nativeWebBrowser.getWidth() <= 0 || nativeWebBrowser.getHeight() <= 0) {
                return lastActiveTabThumbnail != null ? lastActiveTabThumbnail : "";
            }
            int width = nativeWebBrowser.getWidth();
            int height = nativeWebBrowser.getHeight();

            float scale = Math.min(1.0f, 360.0f / (float) width);
            int thumbW = Math.max(1, (int) (width * scale));
            int thumbH = Math.max(1, (int) (height * scale));

            // Immediate synchronous software draw fallback
            Bitmap bitmap = Bitmap.createBitmap(thumbW, thumbH, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.scale(scale, scale);
            nativeWebBrowser.draw(canvas);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 75, baos);
            byte[] bytes = baos.toByteArray();
            bitmap.recycle();
            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
            String dataUrl = "data:image/jpeg;base64," + base64;
            lastActiveTabThumbnail = dataUrl;

            final String targetTabId = tabId != null ? tabId : "";
            final String currentUrl = nativeWebBrowser.getUrl() != null ? nativeWebBrowser.getUrl() : "";

            if (bridge != null && bridge.getWebView() != null) {
                JSONObject obj = new JSONObject();
                obj.put("type", "TAB_THUMBNAIL_CAPTURED");
                obj.put("tabId", targetTabId);
                obj.put("url", currentUrl);
                obj.put("thumbnail", dataUrl);
                String js = "window.onNativeWebEvent && window.onNativeWebEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            }

            // High-fidelity PixelCopy GPU capture for Android 8.0+ (API 26+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O && nativeWebBrowser.isAttachedToWindow() && nativeWebBrowser.getVisibility() == View.VISIBLE) {
                captureWithPixelCopy(targetTabId, thumbW, thumbH);
            }

            return dataUrl;
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "Error capturing tab thumbnail", t);
            return lastActiveTabThumbnail != null ? lastActiveTabThumbnail : "";
        }
    }

    private void captureWithPixelCopy(final String tabId, final int thumbW, final int thumbH) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return;
        try {
            if (nativeWebBrowser == null || nativeWebBrowser.getVisibility() != View.VISIBLE || !nativeWebBrowser.isAttachedToWindow()) {
                return;
            }
            int[] location = new int[2];
            nativeWebBrowser.getLocationInWindow(location);
            int w = nativeWebBrowser.getWidth();
            int h = nativeWebBrowser.getHeight();
            if (w <= 0 || h <= 0) return;

            android.graphics.Rect rect = new android.graphics.Rect(location[0], location[1], location[0] + w, location[1] + h);
            Bitmap copyBmp = Bitmap.createBitmap(thumbW, thumbH, Bitmap.Config.ARGB_8888);
            android.view.PixelCopy.request(getWindow(), rect, copyBmp, (result) -> {
                if (result == android.view.PixelCopy.SUCCESS) {
                    try {
                        if (nativeWebBrowser == null || nativeWebBrowser.getVisibility() != View.VISIBLE || !nativeWebBrowser.isAttachedToWindow()) {
                            copyBmp.recycle();
                            return;
                        }
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        copyBmp.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                        byte[] bytes = baos.toByteArray();
                        copyBmp.recycle();
                        String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                        String dataUrl = "data:image/jpeg;base64," + base64;
                        lastActiveTabThumbnail = dataUrl;

                        if (bridge != null && bridge.getWebView() != null) {
                            JSONObject obj = new JSONObject();
                            obj.put("type", "TAB_THUMBNAIL_CAPTURED");
                            obj.put("tabId", tabId != null ? tabId : "");
                            obj.put("url", nativeWebBrowser != null && nativeWebBrowser.getUrl() != null ? nativeWebBrowser.getUrl() : "");
                            obj.put("thumbnail", dataUrl);
                            String js = "window.onNativeWebEvent && window.onNativeWebEvent(" + obj.toString() + ");";
                            bridge.getWebView().evaluateJavascript(js, null);
                        }
                    } catch (Throwable t) {
                        android.util.Log.e("OcalBrowser", "PixelCopy post process error", t);
                    }
                } else {
                    try {
                        copyBmp.recycle();
                    } catch (Throwable ignored) {}
                }
            }, new android.os.Handler(android.os.Looper.getMainLooper()));
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "PixelCopy request error", t);
        }
    }

    public void captureActiveTabThumbnail(final String tabId) {
        runOnUiThread(() -> captureActiveTabThumbnailNow(tabId));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            WebView.enableSlowWholeDocumentDraw();
        } catch (Throwable ignored) {}
        super.onCreate(savedInstanceState);
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            setStatusBarTheme(false, "#ffffff");
            applyStatusBarInsets();
            setupBackGestureDispatcher();
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "Error in onCreate window setup", t);
        }
    }

    private void applyStatusBarInsets() {
        runOnUiThread(() -> {
            try {
                View contentView = findViewById(android.R.id.content);
                if (contentView != null) {
                    ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                        Insets statusBar = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                        v.setPadding(0, statusBar.top, 0, ime.bottom);
                        return WindowInsetsCompat.CONSUMED;
                    });
                    contentView.requestApplyInsets();
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in applyStatusBarInsets", t);
            }
        });
    }

    public void setStatusBarTheme(boolean isDark, String colorHex) {
        runOnUiThread(() -> {
            try {
                int color = android.graphics.Color.parseColor(colorHex);
                android.view.Window window = getWindow();
                if (window != null) {
                    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                    window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                    window.setStatusBarColor(color);

                    try {
                        window.getDecorView().setBackgroundColor(color);
                    } catch (Throwable ignored) {}

                    try {
                        WindowInsetsControllerCompat insetsController =
                            WindowCompat.getInsetsController(window, window.getDecorView());
                        if (insetsController != null) {
                            insetsController.setAppearanceLightStatusBars(!isDark);
                        }
                    } catch (Throwable ignored) {}

                    try {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                            android.view.WindowInsetsController wic = window.getInsetsController();
                            if (wic != null) {
                                int appearance = !isDark ?
                                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0;
                                wic.setSystemBarsAppearance(appearance,
                                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                            }
                        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            View decorView = window.getDecorView();
                            if (decorView != null) {
                                int flags = decorView.getSystemUiVisibility();
                                if (!isDark) {
                                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                                } else {
                                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                                }
                                decorView.setSystemUiVisibility(flags);
                            }
                        }
                    } catch (Throwable ignored) {}
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in setStatusBarTheme", t);
            }
        });
    }

    @Override
    protected void load() {
        super.load();
        applyStatusBarInsets();

        if (bridge != null && bridge.getWebView() != null) {
            WebView capWebView = bridge.getWebView();
            capWebView.addJavascriptInterface(new OcalNativeBridge(), "OcalNative");

            setupNativeBrowser();

            bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (uri != null) {
                        String path = uri.getPath();
                        if ("/api/suggest".equals(path)) {
                            return handleSuggestRequest(uri);
                        } else if ("/api/proxy".equals(path)) {
                            return handleProxyRequest(uri);
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri url = request.getUrl();
                    if (url != null) {
                        String scheme = url.getScheme();
                        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                            return false;
                        }
                    }
                    return super.shouldOverrideUrlLoading(view, request);
                }

                @Override
                public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                    if (handler != null) {
                        handler.proceed();
                    }
                }
            });

            bridge.getWebView().setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(bridge) {
                @Override
                public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                    runOnUiThread(() -> {
                        try {
                            if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this, new String[]{android.Manifest.permission.CAMERA}, 1099);
                            }
                            request.grant(request.getResources());
                        } catch (Throwable t) {
                            super.onPermissionRequest(request);
                        }
                    });
                }
            });
        }
    }

    private void setupNativeBrowser() {
        runOnUiThread(() -> {
            try {
                ViewGroup root = (ViewGroup) findViewById(android.R.id.content);
                if (root == null) return;

                final WebView capWebView = bridge != null ? bridge.getWebView() : null;
                if (capWebView != null) {
                    capWebView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                }

                if (nativeWebBrowser != null) return;

                nativeWebBrowser = new WebView(this);
                WebSettings s = nativeWebBrowser.getSettings();
                s.setJavaScriptEnabled(true);
                s.setDomStorageEnabled(true);
                s.setDatabaseEnabled(true);
                s.setSupportZoom(true);
                s.setBuiltInZoomControls(true);
                s.setDisplayZoomControls(false);
                s.setLoadWithOverviewMode(true);
                s.setUseWideViewPort(true);
                s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                s.setCacheMode(WebSettings.LOAD_DEFAULT);
                s.setAllowFileAccess(true);
                s.setAllowContentAccess(true);
                s.setGeolocationEnabled(true);

                String defaultUa = s.getUserAgentString();
                if (defaultUa != null) {
                    String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version/\\d+\\.\\d+\\s*", "");
                    mobileUserAgent = cleanUa;
                    s.setUserAgentString(isDesktopModeEnabled ? DESKTOP_USER_AGENT : cleanUa);
                }

                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(nativeWebBrowser, true);

                float density = getResources().getDisplayMetrics().density;
                dockHeightPx = (int) (124 * density);
                touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
                final int edgeThresholdPx = (int) (32 * density);

                nativeWebBrowser.setWebViewClient(new WebViewClient() {
                    @Override
                    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                        super.doUpdateVisitedHistory(view, url, isReload);
                        cachedCanGoBack = view.canGoBack();
                        cachedCanGoForward = view.canGoForward();
                        notifyWebEvent("HISTORY_UPDATED", url, view.getTitle());
                    }

                    @Override
                    public void onPageStarted(WebView view, String url, Bitmap favicon) {
                        super.onPageStarted(view, url, favicon);
                        cachedCanGoBack = view.canGoBack();
                        cachedCanGoForward = view.canGoForward();
                        if (!isNavigatingBack) {
                            if (lastRenderedPageSnapshot != null && !lastRenderedPageSnapshot.isRecycled()
                                && lastRenderedPageUrl != null && !lastRenderedPageUrl.equals(url)) {
                                if (pageSnapshotStack.size() >= 8) {
                                    PageSnapshotItem oldest = pageSnapshotStack.remove(0);
                                    if (oldest != null && oldest.bitmap != null && !oldest.bitmap.isRecycled()) {
                                        oldest.bitmap.recycle();
                                    }
                                }
                                pageSnapshotStack.add(new PageSnapshotItem(lastRenderedPageSnapshot, lastRenderedPageUrl));
                                lastRenderedPageSnapshot = null;
                                lastRenderedPageUrl = null;
                            }
                        }
                        currentSiteBlockedCount = 0;
                        notifyWebEvent("AD_BLOCKED", url, "0");
                        notifyWebEvent("PAGE_STARTED", url, view.getTitle());
                    }

                    @Override
                    public void onPageCommitVisible(WebView view, String url) {
                        super.onPageCommitVisible(view, url);
                        cachedCanGoBack = view.canGoBack();
                        cachedCanGoForward = view.canGoForward();
                        if (isCommitSlideAnimating) {
                            pageCommittedDuringSlide = true;
                        } else {
                            revealCommittedPage();
                        }
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        cachedCanGoBack = view.canGoBack();
                        cachedCanGoForward = view.canGoForward();
                        if (!isCommitSlideAnimating) {
                            revealCommittedPage();
                        } else {
                            pageCommittedDuringSlide = true;
                        }
                        notifyWebEvent("PAGE_FINISHED", url, view.getTitle());
                        view.evaluateJavascript(
                            "(function() { " +
                            "  if (!document.getElementById('ocal-dock-padding')) { " +
                            "    var s = document.createElement('style'); s.id = 'ocal-dock-padding'; " +
                            "    s.innerHTML = 'html, body { min-height: 100%; } body { padding-bottom: 130px !important; }'; " +
                            "    (document.head || document.documentElement).appendChild(s); " +
                            "  } " +
                            "  if (!document.getElementById('ocal-ad-killer')) { " +
                            "    var adStyle = document.createElement('style'); adStyle.id = 'ocal-ad-killer'; " +
                            "    adStyle.innerHTML = '.adsbygoogle, [id^=\"google_ads_\"], [id^=\"div-gpt-ad\"], .ad-banner, .advertisement, [data-ad-client], .taboola, .outbrain, .sponsor-badge { display: none !important; height: 0 !important; max-height: 0 !important; overflow: hidden !important; visibility: hidden !important; }'; " +
                            "    (document.head || document.documentElement).appendChild(adStyle); " +
                            "  } " +
                            "})()",
                            null
                        );
                        view.postDelayed(() -> {
                            captureLastRenderedPage();
                            captureActiveTabThumbnail("");
                        }, 250);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        try {
                            Uri uri = request.getUrl();
                            if (uri != null) {
                                String scheme = uri.getScheme();
                                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme) || "file".equalsIgnoreCase(scheme) || "about".equalsIgnoreCase(scheme)) {
                                    return false;
                                }
                                android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, uri);
                                startActivity(intent);
                                return true;
                            }
                        } catch (Throwable ignored) {}
                        return false;
                    }

                    @Override
                    public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                        if (handler != null) {
                            handler.proceed();
                        }
                    }

                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (isAdBlockerEnabled && request != null && request.getUrl() != null) {
                            Uri uri = request.getUrl();
                            if (isAdOrTracker(uri)) {
                                currentSiteBlockedCount++;
                                final int count = currentSiteBlockedCount;
                                final String host = uri.getHost() != null ? uri.getHost() : "ad-network";
                                runOnUiThread(() -> {
                                    notifyWebEvent("AD_BLOCKED", host, String.valueOf(count));
                                });
                                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                            }
                        }
                        return super.shouldInterceptRequest(view, request);
                    }
                });

                nativeWebBrowser.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onReceivedTitle(WebView view, String title) {
                        super.onReceivedTitle(view, title);
                        notifyWebEvent("TITLE_CHANGED", view.getUrl(), title);
                    }

                    @Override
                    public void onProgressChanged(WebView view, int newProgress) {
                        super.onProgressChanged(view, newProgress);
                        notifyWebProgress(newProgress);
                    }
                });

                nativeWebBrowser.setDownloadListener(new DownloadListener() {
                    @Override
                    public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                        handleDownload(url, userAgent, contentDisposition, mimetype, contentLength);
                    }
                });

                nativeWebBrowser.setOnLongClickListener(new View.OnLongClickListener() {
                    @Override
                    public boolean onLongClick(View v) {
                        return handleNativeLongClick();
                    }
                });

                // Edge swipe touch listener on nativeWebBrowser
                nativeWebBrowser.setOnTouchListener(new View.OnTouchListener() {
                    @Override
                    public boolean onTouch(View v, MotionEvent event) {
                        if (velocityTracker == null) {
                            velocityTracker = VelocityTracker.obtain();
                        }
                        velocityTracker.addMovement(event);

                        switch (event.getActionMasked()) {
                            case MotionEvent.ACTION_DOWN:
                                touchStartX = event.getRawX();
                                touchStartY = event.getRawY();
                                isEdgeGestureActive = (touchStartX <= edgeThresholdPx);
                                isHorizontalSwipeLocked = false;
                                break;

                            case MotionEvent.ACTION_MOVE:
                                if (isEdgeGestureActive) {
                                    float dx = event.getRawX() - touchStartX;
                                    float dy = event.getRawY() - touchStartY;

                                    if (!isHorizontalSwipeLocked) {
                                        if (dx > touchSlop && dx > Math.abs(dy) * 1.25f) {
                                            isHorizontalSwipeLocked = true;
                                            MotionEvent cancelEvent = MotionEvent.obtain(event);
                                            cancelEvent.setAction(MotionEvent.ACTION_CANCEL);
                                            nativeWebBrowser.onTouchEvent(cancelEvent);
                                            cancelEvent.recycle();
                                        } else if (Math.abs(dy) > touchSlop) {
                                            isEdgeGestureActive = false;
                                        }
                                    }

                                    if (isHorizontalSwipeLocked) {
                                        return true;
                                    }
                                }
                                break;

                            case MotionEvent.ACTION_UP:
                            case MotionEvent.ACTION_CANCEL:
                                if (isHorizontalSwipeLocked) {
                                    velocityTracker.computeCurrentVelocity(1000);
                                    float vx = velocityTracker.getXVelocity();
                                    float dx = event.getRawX() - touchStartX;
                                    int width = nativeWebBrowser.getWidth();
                                    if (width <= 0) width = getResources().getDisplayMetrics().widthPixels;
                                    float progress = Math.max(0f, Math.min(1f, dx / (float) width));

                                    if (progress > 0.28f || vx > 1100) {
                                        performGoBack();
                                    }

                                    if (velocityTracker != null) {
                                        velocityTracker.recycle();
                                        velocityTracker = null;
                                    }
                                    isEdgeGestureActive = false;
                                    isHorizontalSwipeLocked = false;
                                    return true;
                                }

                                if (velocityTracker != null) {
                                    velocityTracker.recycle();
                                    velocityTracker = null;
                                }
                                isEdgeGestureActive = false;
                                isHorizontalSwipeLocked = false;
                                break;
                        }
                        return false;
                    }
                });

                // Construct sliding container and back peek view
                browserSlideContainer = new FrameLayout(this);
                browserSlideContainer.setClipChildren(false);
                browserSlideContainer.setVisibility(View.GONE);

                ViewGroup.MarginLayoutParams containerLp = new ViewGroup.MarginLayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
                containerLp.topMargin = 0;
                containerLp.bottomMargin = 0;
                browserSlideContainer.setLayoutParams(containerLp);
                browserSlideContainer.setPadding(0, 0, 0, 0);

                // Add left-edge shadow
                leftEdgeShadow = new View(this);
                int shadowWidthPx = (int) (18 * density);
                FrameLayout.LayoutParams shadowLp = new FrameLayout.LayoutParams(shadowWidthPx, ViewGroup.LayoutParams.MATCH_PARENT);
                shadowLp.leftMargin = -shadowWidthPx;
                leftEdgeShadow.setLayoutParams(shadowLp);
                GradientDrawable shadowGrad = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{0x00000000, 0x48000000});
                leftEdgeShadow.setBackground(shadowGrad);
                browserSlideContainer.addView(leftEdgeShadow);

                // Add nativeWebBrowser to browserSlideContainer
                nativeWebBrowser.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                nativeWebBrowser.setBackgroundColor(0xFFFFFFFF);
                nativeWebBrowser.setPadding(0, 0, 0, 0);
                browserSlideContainer.addView(nativeWebBrowser);

                // Construct backPeekContainer
                backPeekContainer = new FrameLayout(this);
                ViewGroup.MarginLayoutParams peekLp = new ViewGroup.MarginLayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
                peekLp.topMargin = 0;
                peekLp.bottomMargin = 0;
                backPeekContainer.setLayoutParams(peekLp);
                backPeekContainer.setPadding(0, 0, 0, 0);
                backPeekContainer.setVisibility(View.GONE);

                backPeekImageView = new ImageView(this);
                backPeekImageView.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                backPeekImageView.setScaleType(ImageView.ScaleType.FIT_XY);
                backPeekContainer.addView(backPeekImageView);

                backPeekScrim = new View(this);
                backPeekScrim.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                backPeekScrim.setBackgroundColor(0xFF000000);
                backPeekScrim.setAlpha(0.35f);
                backPeekContainer.addView(backPeekScrim);

                ViewGroup parent = capWebView != null && capWebView.getParent() instanceof ViewGroup ?
                    (ViewGroup) capWebView.getParent() : root;

                if (backPeekContainer.getParent() == null) {
                    parent.addView(backPeekContainer, 0);
                }
                if (browserSlideContainer.getParent() == null) {
                    parent.addView(browserSlideContainer, 0);
                }
                if (capWebView != null) {
                    capWebView.bringToFront();
                    capWebView.setOnTouchListener(new View.OnTouchListener() {
                        private boolean isForwardingToWeb = false;

                        @Override
                        public boolean onTouch(View v, MotionEvent event) {
                            if (nativeWebBrowser == null || nativeWebBrowser.getVisibility() != View.VISIBLE || hasWebOverlayOpen) {
                                isForwardingToWeb = false;
                                return false;
                            }

                            int action = event.getActionMasked();
                            if (action == MotionEvent.ACTION_DOWN) {
                                float y = event.getY();
                                int h = v.getHeight();
                                boolean inDock = false;
                                if (isDockTop) {
                                    inDock = (y <= dockHeightPx);
                                } else {
                                    inDock = (y >= (h - dockHeightPx));
                                }

                                if (!inDock) {
                                    isForwardingToWeb = true;
                                    return nativeWebBrowser.dispatchTouchEvent(event);
                                } else {
                                    isForwardingToWeb = false;
                                    return false;
                                }
                            } else if (isForwardingToWeb) {
                                boolean handled = nativeWebBrowser.dispatchTouchEvent(event);
                                if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                                    isForwardingToWeb = false;
                                }
                                return handled;
                            }

                            return false;
                        }
                    });
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in setupNativeBrowser", t);
            }
        });
    }

    private void updateBrowserMargins() {
        runOnUiThread(() -> {
            try {
                if (browserSlideContainer != null) {
                    ViewGroup.LayoutParams rawLp = browserSlideContainer.getLayoutParams();
                    if (rawLp instanceof ViewGroup.MarginLayoutParams) {
                        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) rawLp;
                        lp.topMargin = 0;
                        lp.bottomMargin = 0;
                        browserSlideContainer.setLayoutParams(lp);
                    }
                }
                if (backPeekContainer != null) {
                    ViewGroup.LayoutParams rawLp = backPeekContainer.getLayoutParams();
                    if (rawLp instanceof ViewGroup.MarginLayoutParams) {
                        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) rawLp;
                        lp.topMargin = 0;
                        lp.bottomMargin = 0;
                        backPeekContainer.setLayoutParams(lp);
                    }
                }
            } catch (Throwable ignored) {}
        });
    }

    private void notifyWebEvent(String type, String url, String title) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", type);
                obj.put("url", url != null ? url : "");
                obj.put("title", title != null ? title : "");
                obj.put("canGoBack", nativeWebBrowser != null && nativeWebBrowser.canGoBack());
                obj.put("canGoForward", nativeWebBrowser != null && nativeWebBrowser.canGoForward());
                String js = "window.onNativeWebEvent && window.onNativeWebEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private void notifyWebProgress(int progress) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "PROGRESS");
                obj.put("progress", progress);
                String js = "window.onNativeWebEvent && window.onNativeWebEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private void handleDownload(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
        runOnUiThread(() -> {
            try {
                Uri uri = Uri.parse(url);
                String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);

                DownloadManager.Request request = new DownloadManager.Request(uri);
                if (mimetype != null && !mimetype.isEmpty()) {
                    request.setMimeType(mimetype);
                }

                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("cookie", cookies);
                }
                if (userAgent != null) {
                    request.addRequestHeader("User-Agent", userAgent);
                }

                request.setDescription("Downloading " + filename);
                request.setTitle(filename);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    long downloadId = dm.enqueue(request);
                    String publicPath = "/storage/emulated/0/Download/" + filename;
                    notifyDownloadStarted(String.valueOf(downloadId), filename, url, publicPath, mimetype, contentLength);
                    trackDownloadProgress(downloadId, filename, publicPath);
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in handleDownload", t);
            }
        });
    }

    private void trackDownloadProgress(long downloadId, String filename, String filePath) {
        new Thread(() -> {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm == null) return;
            boolean downloading = true;
            while (downloading) {
                try {
                    Thread.sleep(600);
                } catch (InterruptedException ignored) {}

                DownloadManager.Query q = new DownloadManager.Query();
                q.setFilterById(downloadId);
                try (Cursor cursor = dm.query(q)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        int bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                        int bytesTotalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);

                        int status = statusIdx != -1 ? cursor.getInt(statusIdx) : -1;
                        long bytesDownloaded = bytesDownloadedIdx != -1 ? cursor.getLong(bytesDownloadedIdx) : 0;
                        long bytesTotal = bytesTotalIdx != -1 ? cursor.getLong(bytesTotalIdx) : 0;

                        if (status == DownloadManager.STATUS_RUNNING) {
                            notifyDownloadProgress(String.valueOf(downloadId), bytesDownloaded, bytesTotal);
                        } else if (status == DownloadManager.STATUS_SUCCESSFUL) {
                            downloading = false;
                            notifyDownloadFinished(String.valueOf(downloadId), filename, filePath, bytesTotal > 0 ? bytesTotal : bytesDownloaded, true);
                        } else if (status == DownloadManager.STATUS_FAILED) {
                            downloading = false;
                            notifyDownloadFinished(String.valueOf(downloadId), filename, filePath, bytesTotal, false);
                        }
                    } else {
                        downloading = false;
                    }
                } catch (Throwable ignored) {
                    downloading = false;
                }
            }
        }).start();
    }

    private void notifyDownloadStarted(String downloadId, String filename, String url, String filePath, String mimetype, long contentLength) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "DOWNLOAD_STARTED");
                obj.put("downloadId", downloadId);
                obj.put("filename", filename);
                obj.put("url", url);
                obj.put("filePath", filePath);
                obj.put("mimetype", mimetype != null ? mimetype : "");
                obj.put("contentLength", contentLength);
                String js = "window.onNativeDownloadEvent && window.onNativeDownloadEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private void notifyDownloadProgress(String downloadId, long downloadedBytes, long totalBytes) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "DOWNLOAD_PROGRESS");
                obj.put("downloadId", downloadId);
                obj.put("downloadedBytes", downloadedBytes);
                obj.put("totalBytes", totalBytes);
                String js = "window.onNativeDownloadEvent && window.onNativeDownloadEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private void notifyDownloadFinished(String downloadId, String filename, String filePath, long totalBytes, boolean success) {
        if (bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "DOWNLOAD_FINISHED");
                obj.put("downloadId", downloadId);
                obj.put("filename", filename);
                obj.put("filePath", filePath);
                obj.put("totalBytes", totalBytes);
                obj.put("success", success);
                String js = "window.onNativeDownloadEvent && window.onNativeDownloadEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    private boolean handleNativeLongClick() {
        if (nativeWebBrowser == null) return false;
        try {
            WebView.HitTestResult result = nativeWebBrowser.getHitTestResult();
            if (result == null) return false;

            int type = result.getType();
            String extra = result.getExtra();
            String currentUrl = nativeWebBrowser.getUrl();
            String currentTitle = nativeWebBrowser.getTitle();

            // Only intercept for links and media.
            // For plain text, text boxes, and unknown types, return false so the Android WebView
            // can show native text selection handles and allow the user to drag to select more text!
            if (type != WebView.HitTestResult.SRC_ANCHOR_TYPE &&
                type != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE &&
                type != WebView.HitTestResult.IMAGE_TYPE &&
                type != WebView.HitTestResult.PHONE_TYPE &&
                type != WebView.HitTestResult.EMAIL_TYPE &&
                type != WebView.HitTestResult.GEO_TYPE) {
                return false;
            }

            try {
                nativeWebBrowser.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
            } catch (Throwable ignored) {}

            if (type == WebView.HitTestResult.SRC_ANCHOR_TYPE || type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
                android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
                android.os.Message msg = handler.obtainMessage();
                msg.setTarget(new android.os.Handler(android.os.Looper.getMainLooper()) {
                    @Override
                    public void handleMessage(android.os.Message m) {
                        try {
                            String linkUrl = (String) m.getData().get("url");
                            String title = (String) m.getData().get("title");
                            String src = (String) m.getData().get("src");

                            String hitTypeStr = (type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) ? "image-link" : "link";
                            String finalLink = (linkUrl != null && !linkUrl.isEmpty()) ? linkUrl : extra;
                            notifyContextMenu(hitTypeStr, finalLink, src, title, currentUrl, currentTitle);
                        } catch (Throwable t) {
                            notifyContextMenu("link", extra, null, null, currentUrl, currentTitle);
                        }
                    }
                });
                nativeWebBrowser.requestFocusNodeHref(msg);
                return true;
            } else if (type == WebView.HitTestResult.IMAGE_TYPE) {
                notifyContextMenu("image", null, extra, null, currentUrl, currentTitle);
                return true;
            } else if (type == WebView.HitTestResult.PHONE_TYPE) {
                notifyContextMenu("phone", extra, null, null, currentUrl, currentTitle);
                return true;
            } else if (type == WebView.HitTestResult.EMAIL_TYPE) {
                notifyContextMenu("email", extra, null, null, currentUrl, currentTitle);
                return true;
            } else if (type == WebView.HitTestResult.GEO_TYPE) {
                notifyContextMenu("geo", extra, null, null, currentUrl, currentTitle);
                return true;
            }
            return false;
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "Error in handleNativeLongClick", t);
            return false;
        }
    }

    private void notifyContextMenu(String hitType, String linkUrl, String imageUrl, String title, String pageUrl, String pageTitle) {
        if (bridge == null || bridge.getWebView() == null) return;

        // Synchronously capture a snapshot of the actual web page before opening context menu
        String snapshot = "";
        try {
            if (nativeWebBrowser != null && nativeWebBrowser.getVisibility() == View.VISIBLE && nativeWebBrowser.getWidth() > 0) {
                snapshot = captureActiveTabThumbnailNow("");
            }
        } catch (Throwable ignored) {}
        if ((snapshot == null || snapshot.isEmpty()) && lastActiveTabThumbnail != null) {
            snapshot = lastActiveTabThumbnail;
        }
        final String finalSnapshot = snapshot != null ? snapshot : "";

        bridge.getWebView().post(() -> {
            try {
                JSONObject obj = new JSONObject();
                obj.put("type", "CONTEXT_MENU");
                obj.put("hitType", hitType != null ? hitType : "page");
                obj.put("linkUrl", linkUrl != null ? linkUrl : "");
                obj.put("imageUrl", imageUrl != null ? imageUrl : "");
                obj.put("title", title != null ? title : "");
                obj.put("pageUrl", pageUrl != null ? pageUrl : "");
                obj.put("pageTitle", pageTitle != null ? pageTitle : "");
                obj.put("snapshot", finalSnapshot);
                String js = "window.onNativeWebEvent && window.onNativeWebEvent(" + obj.toString() + ");";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        });
    }

    public class OcalNativeBridge {
        @JavascriptInterface
        public void setAdBlockEnabled(boolean enabled) {
            isAdBlockerEnabled = enabled;
        }

        @JavascriptInterface
        public int getBlockedAdsCount() {
            return currentSiteBlockedCount;
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> {
                try {
                    if (nativeWebBrowser != null && url != null && !url.isEmpty()) {
                        String target = url.trim();
                        updateBrowserMargins();
                        if (bridge != null && bridge.getWebView() != null && bridge.getWebView().getWidth() > 0) {
                            try {
                                int w = bridge.getWebView().getWidth();
                                int h = bridge.getWebView().getHeight();
                                float scale = 0.65f;
                                int sw = Math.max(1, (int) (w * scale));
                                int sh = Math.max(1, (int) (h * scale));
                                Bitmap bmp = Bitmap.createBitmap(sw, sh, Bitmap.Config.RGB_565);
                                Canvas canvas = new Canvas(bmp);
                                canvas.scale(scale, scale);
                                bridge.getWebView().draw(canvas);
                                if (homeSnapshotBitmap != null && !homeSnapshotBitmap.isRecycled()) {
                                    homeSnapshotBitmap.recycle();
                                }
                                homeSnapshotBitmap = bmp;
                            } catch (Throwable ignored) {}
                        }
                        if (browserSlideContainer != null) {
                            browserSlideContainer.setTranslationX(0);
                            browserSlideContainer.setVisibility(View.VISIBLE);
                        }
                        nativeWebBrowser.setVisibility(View.VISIBLE);
                        final WebView capWebView = bridge != null ? bridge.getWebView() : null;
                        if (capWebView != null) {
                            capWebView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                            capWebView.bringToFront();
                        }

                        String current = nativeWebBrowser.getUrl();
                        if (current != null && current.equalsIgnoreCase(target)) {
                            nativeWebBrowser.reload();
                            return;
                        }
                        clearSnapshotStack();
                        nativeWebBrowser.loadUrl(target);
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void setWebVisible(boolean visible) {
            runOnUiThread(() -> {
                try {
                    if (visible) {
                        updateBrowserMargins();
                        if (browserSlideContainer != null) {
                            browserSlideContainer.setVisibility(View.VISIBLE);
                        }
                        if (nativeWebBrowser != null) {
                            nativeWebBrowser.setVisibility(View.VISIBLE);
                        }
                        final WebView capWebView = bridge != null ? bridge.getWebView() : null;
                        if (capWebView != null) {
                            capWebView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                            capWebView.bringToFront();
                        }
                    } else {
                        if (browserSlideContainer != null) {
                            browserSlideContainer.setVisibility(View.GONE);
                        }
                        if (nativeWebBrowser != null) {
                            nativeWebBrowser.setVisibility(View.GONE);
                        }
                        if (backPeekContainer != null) {
                            backPeekContainer.setVisibility(View.GONE);
                        }
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void hideKeyboard() {
            runOnUiThread(() -> {
                try {
                    android.view.inputmethod.InputMethodManager imm = (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        View currentFocus = getCurrentFocus();
                        if (currentFocus != null) {
                            imm.hideSoftInputFromWindow(currentFocus.getWindowToken(), 0);
                            currentFocus.clearFocus();
                        }
                        if (bridge != null && bridge.getWebView() != null) {
                            imm.hideSoftInputFromWindow(bridge.getWebView().getWindowToken(), 0);
                            bridge.getWebView().clearFocus();
                        }
                        if (nativeWebBrowser != null) {
                            imm.hideSoftInputFromWindow(nativeWebBrowser.getWindowToken(), 0);
                            nativeWebBrowser.clearFocus();
                        }
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void setWebNavigationState(boolean canGoBack, boolean hasOverlayOpen, boolean isAtRoot) {
            runOnUiThread(() -> {
                MainActivity.this.hasWebOverlayOpen = hasOverlayOpen;
                MainActivity.this.webCanGoBack = canGoBack;
                MainActivity.this.webIsAtRoot = isAtRoot;
            });
        }

        @JavascriptInterface
        public void setOverlayOpen(boolean open) {
            runOnUiThread(() -> {
                MainActivity.this.hasWebOverlayOpen = open;
            });
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> {
                moveTaskToBack(true);
            });
        }

        @JavascriptInterface
        public void captureActiveTabThumbnail(String tabId) {
            MainActivity.this.captureActiveTabThumbnail(tabId);
        }

        @JavascriptInterface
        public String getLastTabThumbnail() {
            return lastActiveTabThumbnail != null ? lastActiveTabThumbnail : "";
        }

        @JavascriptInterface
        public String captureCurrentThumbnailImmediate(String tabId) {
            final String[] result = new String[]{""};
            try {
                java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
                runOnUiThread(() -> {
                    try {
                        result[0] = captureActiveTabThumbnailNow(tabId);
                    } finally {
                        latch.countDown();
                    }
                });
                latch.await(150, java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (Throwable ignored) {}
            return result[0];
        }

        @JavascriptInterface
        public void setDockLayout(int heightPx, boolean isTop) {
            runOnUiThread(() -> {
                try {
                    if (heightPx > 0) {
                        dockHeightPx = heightPx;
                    }
                    isDockTop = isTop;
                    updateBrowserMargins();
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void goBack() {
            performGoBack();
        }

        @JavascriptInterface
        public void getPageContent() {
            runOnUiThread(() -> {
                try {
                    if (nativeWebBrowser != null && nativeWebBrowser.getVisibility() == View.VISIBLE) {
                        nativeWebBrowser.evaluateJavascript(
                            "(function() { try { var txt = (document.body ? (document.body.innerText || '') : ''); if (txt.length > 6000) txt = txt.slice(0, 6000); return JSON.stringify({ title: document.title || '', url: location.href || '', text: txt }); } catch(e) { return JSON.stringify({ title: document.title || '', url: location.href || '', text: '' }); } })()",
                            value -> {
                                if (bridge != null && bridge.getWebView() != null && value != null) {
                                    String js = "if (window.onNativePageContent) window.onNativePageContent(" + value + ");";
                                    bridge.getWebView().evaluateJavascript(js, null);
                                }
                            }
                        );
                    } else {
                        if (bridge != null && bridge.getWebView() != null) {
                            bridge.getWebView().evaluateJavascript("if (window.onNativePageContent) window.onNativePageContent(null);", null);
                        }
                    }
                } catch (Throwable t) {
                    android.util.Log.e("OcalBrowser", "Error in getPageContent", t);
                }
            });
        }

        @JavascriptInterface
        public boolean canGoBack() {
            return cachedCanGoBack || (nativeWebBrowser != null && nativeWebBrowser.canGoBack());
        }

        @JavascriptInterface
        public boolean canGoForward() {
            return cachedCanGoForward || (nativeWebBrowser != null && nativeWebBrowser.canGoForward());
        }

        @JavascriptInterface
        public void setDesktopMode(boolean enable) {
            setDesktopMode(enable, true);
        }

        @JavascriptInterface
        public void setDesktopMode(boolean enable, boolean reload) {
            runOnUiThread(() -> {
                try {
                    isDesktopModeEnabled = enable;
                    if (nativeWebBrowser != null) {
                        WebSettings settings = nativeWebBrowser.getSettings();
                        if (enable) {
                            settings.setUserAgentString(DESKTOP_USER_AGENT);
                        } else {
                            settings.setUserAgentString(mobileUserAgent != null ? mobileUserAgent : WebSettings.getDefaultUserAgent(MainActivity.this));
                        }
                        settings.setUseWideViewPort(true);
                        settings.setLoadWithOverviewMode(true);
                        settings.setSupportZoom(true);
                        settings.setBuiltInZoomControls(true);
                        settings.setDisplayZoomControls(false);

                        if (reload && nativeWebBrowser.getUrl() != null && !nativeWebBrowser.getUrl().isEmpty()) {
                            nativeWebBrowser.reload();
                        }
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public boolean isDesktopMode() {
            return isDesktopModeEnabled;
        }

        @JavascriptInterface
        public void setHomeSnapshot(String dataUrl) {
            if (dataUrl == null || !dataUrl.contains(",")) return;
            try {
                String base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
                byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                if (bmp != null) {
                    runOnUiThread(() -> {
                        if (homeSnapshotBitmap != null && !homeSnapshotBitmap.isRecycled()) {
                            homeSnapshotBitmap.recycle();
                        }
                        homeSnapshotBitmap = bmp;
                    });
                }
            } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void goForward() {
            runOnUiThread(() -> {
                try {
                    if (nativeWebBrowser != null && nativeWebBrowser.canGoForward()) {
                        nativeWebBrowser.goForward();
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void reload() {
            runOnUiThread(() -> {
                try {
                    if (nativeWebBrowser != null) {
                        nativeWebBrowser.reload();
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void setStatusBarTheme(boolean isDark, String colorHex) {
            try {
                MainActivity.this.setStatusBarTheme(isDark, colorHex);
            } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void openDownloadedFile(String filePath, String mimeType) {
            runOnUiThread(() -> {
                try {
                    File file = new File(filePath);
                    if (!file.exists()) {
                        String name = file.getName();
                        File fallback = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), name);
                        if (fallback.exists()) {
                            file = fallback;
                        }
                    }

                    if (!file.exists()) {
                        android.widget.Toast.makeText(MainActivity.this, "File not found: " + filePath, android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }

                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    Uri uri;
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                        String authority = getPackageName() + ".fileprovider";
                        uri = FileProvider.getUriForFile(MainActivity.this, authority, file);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } else {
                        uri = Uri.fromFile(file);
                    }

                    String resolvedMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "*/*";
                    intent.setDataAndType(uri, resolvedMime);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Throwable t) {
                    android.util.Log.e("OcalBrowser", "Error opening downloaded file: " + filePath, t);
                    android.widget.Toast.makeText(MainActivity.this, "Cannot open file: " + t.getMessage(), android.widget.Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void share(String title, String text, String url) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/plain");
                    if (title != null && !title.isEmpty()) intent.putExtra(Intent.EXTRA_SUBJECT, title);
                    String shareBody = (text != null && !text.isEmpty() ? text + "\n" : "") + (url != null ? url : "");
                    intent.putExtra(Intent.EXTRA_TEXT, shareBody.trim());
                    startActivity(Intent.createChooser(intent, "Share"));
                } catch (Throwable t) {
                    android.util.Log.e("OcalBrowser", "Share error", t);
                }
            });
        }

        @JavascriptInterface
        public void triggerDownload(String url, String filename, String mimetype) {
            runOnUiThread(() -> {
                handleDownload(url, null, filename != null ? "inline; filename=\"" + filename + "\"" : null, mimetype, 0);
            });
        }

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public boolean hasCameraPermission() {
            return androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestCameraPermission() {
            runOnUiThread(() -> {
                if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this, new String[]{android.Manifest.permission.CAMERA}, 1099);
                }
            });
        }
    }

    private WebResourceResponse handleSuggestRequest(Uri uri) {
        String q = uri.getQueryParameter("q");
        if (q == null || q.trim().isEmpty()) {
            return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream("{\"suggestions\":[]}".getBytes(StandardCharsets.UTF_8)));
        }

        try {
            URL url = URI.create("https://suggestqueries.google.com/complete/search?client=firefox&q=" + URLEncoder.encode(q, "UTF-8")).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();

            JSONArray array = new JSONArray(sb.toString());
            JSONArray suggestionsArray = array.getJSONArray(1);

            JSONObject res = new JSONObject();
            res.put("suggestions", suggestionsArray);

            return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream(res.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return new WebResourceResponse("application/json", "UTF-8", new ByteArrayInputStream("{\"suggestions\":[]}".getBytes(StandardCharsets.UTF_8)));
        }
    }

    private WebResourceResponse handleProxyRequest(Uri uri) {
        return createHtmlResponse("<html><body>Native View Active</body></html>");
    }

    private WebResourceResponse createHtmlResponse(String html) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/html", "UTF-8", 200, "OK", headers, new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
    }
}
