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
    private android.webkit.ValueCallback<Uri[]> uploadMessageCallback = null;
    private final static int FILE_CHOOSER_REQUEST_CODE = 2001;
    private final static int PERMISSION_ALL_REQUEST_CODE = 2002;
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
    private volatile boolean isDarkModeEnabled = true;
    private View statusBarView = null;
    private int statusBarHeightPx = 0;
    private int navBarHeightPx = 0;
    private int keyboardHeightPx = 0;
    private int currentDetectedPageColor = 0xFF000000;
    private final Runnable themeColorCheckRunnable = this::detectAndApplyPageThemeColor;

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
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().bringToFront();
        }
        if (statusBarView != null) {
            statusBarView.bringToFront();
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
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) {
                statusBarHeightPx = getResources().getDimensionPixelSize(resourceId);
            }
            int navResId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
            if (navResId > 0) {
                navBarHeightPx = getResources().getDimensionPixelSize(navResId);
            }
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            setupStatusBarAndInsets();
            setupBackGestureDispatcher();
            setStatusBarTheme(isDarkModeEnabled, isDarkModeEnabled ? "#000000" : "#ffffff");
        } catch (Throwable t) {
            android.util.Log.e("OcalBrowser", "Error in onCreate window setup", t);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (uploadMessageCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                android.content.ClipData clipData = data.getClipData();
                if (clipData != null) {
                    results = new Uri[clipData.getItemCount()];
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        results[i] = clipData.getItemAt(i).getUri();
                    }
                } else if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            uploadMessageCallback.onReceiveValue(results);
            uploadMessageCallback = null;
        }
    }

    private void setupStatusBarAndInsets() {
        runOnUiThread(() -> {
            try {
                View contentView = findViewById(android.R.id.content);
                if (contentView != null) {
                    ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, insets) -> {
                        Insets sb = insets.getInsets(WindowInsetsCompat.Type.statusBars());
                        Insets nb = insets.getInsets(WindowInsetsCompat.Type.navigationBars());
                        Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());

                        if (sb.top > 0) {
                            statusBarHeightPx = sb.top;
                        }
                        if (nb.bottom > 0) {
                            navBarHeightPx = nb.bottom;
                        }
                        int imeBottom = ime.bottom;
                        keyboardHeightPx = Math.max(0, imeBottom);

                        float density = getResources().getDisplayMetrics().density;
                        int sbDp = (int) (statusBarHeightPx / density);
                        int nbDp = (int) (navBarHeightPx / density);
                        int kbDp = (int) (keyboardHeightPx / density);

                        updateStatusBarViewLayout();
                        updateBrowserMargins();

                        // Notify Capacitor WebView of exact safe areas & keyboard height
                        if (bridge != null && bridge.getWebView() != null) {
                            final String js = String.format(java.util.Locale.US,
                                "(function() { " +
                                "  var r = document.documentElement; " +
                                "  r.style.setProperty('--status-bar-height', '%dpx'); " +
                                "  r.style.setProperty('--safe-top', '%dpx'); " +
                                "  r.style.setProperty('--nav-bar-height', '%dpx'); " +
                                "  r.style.setProperty('--safe-bottom', '%dpx'); " +
                                "  r.style.setProperty('--keyboard-height', '%dpx'); " +
                                "  if (%d > 60) { document.body.classList.add('keyboard-open-native'); } " +
                                "  else { document.body.classList.remove('keyboard-open-native'); } " +
                                "})()",
                                sbDp, sbDp, nbDp, nbDp, kbDp, kbDp
                            );
                            bridge.getWebView().evaluateJavascript(js, null);
                        }

                        return insets;
                    });
                    contentView.requestApplyInsets();
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in setupStatusBarAndInsets", t);
            }
        });
    }

    private void updateStatusBarViewLayout() {
        runOnUiThread(() -> {
            try {
                if (statusBarView != null) {
                    ViewGroup.LayoutParams rawLp = statusBarView.getLayoutParams();
                    if (rawLp != null) {
                        int h = Math.max(1, statusBarHeightPx);
                        if (rawLp.height != h) {
                            rawLp.height = h;
                            statusBarView.setLayoutParams(rawLp);
                        }
                    }
                }
            } catch (Throwable ignored) {}
        });
    }

    public static int parseColorSafe(String str, int defaultColor) {
        if (str == null || str.trim().isEmpty()) return defaultColor;
        String s = str.trim().toLowerCase();
        try {
            if (s.equals("transparent") || s.equals("rgba(0, 0, 0, 0)") || s.equals("rgba(0,0,0,0)")) {
                return defaultColor;
            }
            if (s.equals("black")) return 0xFF000000;
            if (s.equals("white")) return 0xFFFFFFFF;
            if (s.equals("gray") || s.equals("grey")) return 0xFF808080;

            if (s.startsWith("#")) {
                if (s.length() == 4) {
                    char r = s.charAt(1);
                    char g = s.charAt(2);
                    char b = s.charAt(3);
                    s = "#" + r + r + g + g + b + b;
                }
                return android.graphics.Color.parseColor(s);
            }
            if (s.startsWith("rgb")) {
                int openParen = s.indexOf('(');
                int closeParen = s.indexOf(')');
                if (openParen != -1 && closeParen != -1) {
                    String inner = s.substring(openParen + 1, closeParen);
                    String[] parts = inner.split(",");
                    if (parts.length >= 3) {
                        int r = (int) Math.round(Double.parseDouble(parts[0].trim()));
                        int g = (int) Math.round(Double.parseDouble(parts[1].trim()));
                        int b = (int) Math.round(Double.parseDouble(parts[2].trim()));
                        int a = 255;
                        if (parts.length >= 4) {
                            double alphaVal = Double.parseDouble(parts[3].trim());
                            if (alphaVal <= 0.05) return defaultColor;
                            a = (int) Math.round(Math.min(1.0, Math.max(0.0, alphaVal)) * 255.0);
                        }
                        return android.graphics.Color.argb(a, r, g, b);
                    }
                }
            }
            return android.graphics.Color.parseColor(s);
        } catch (Throwable t) {
            return defaultColor;
        }
    }

    public static boolean isColorLight(int color) {
        int r = android.graphics.Color.red(color);
        int g = android.graphics.Color.green(color);
        int b = android.graphics.Color.blue(color);
        double lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        return lum > 0.55;
    }

    public void applyStatusBarAppearance(final int color) {
        runOnUiThread(() -> {
            try {
                if (statusBarView != null) {
                    statusBarView.setBackgroundColor(color);
                }
                android.view.Window window = getWindow();
                if (window != null) {
                    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                    window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                    window.setStatusBarColor(color);
                    boolean isLight = isColorLight(color);

                    try {
                        WindowInsetsControllerCompat insetsController =
                            WindowCompat.getInsetsController(window, window.getDecorView());
                        if (insetsController != null) {
                            insetsController.setAppearanceLightStatusBars(isLight);
                        }
                    } catch (Throwable ignored) {}

                    try {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                            android.view.WindowInsetsController wic = window.getInsetsController();
                            if (wic != null) {
                                int appearance = isLight ?
                                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS : 0;
                                wic.setSystemBarsAppearance(appearance,
                                    android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
                            }
                        } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            View decorView = window.getDecorView();
                            if (decorView != null) {
                                int flags = decorView.getSystemUiVisibility();
                                if (isLight) {
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
                android.util.Log.e("OcalBrowser", "Error in applyStatusBarAppearance", t);
            }
        });
    }

    public void detectAndApplyPageThemeColor() {
        if (nativeWebBrowser == null) return;
        nativeWebBrowser.post(() -> {
            try {
                String js = 
                    "(function() { " +
                    "  try { " +
                    "    var meta = document.querySelector('meta[name=\"theme-color\"]'); " +
                    "    if (meta && meta.content && meta.content.trim() !== '' && meta.content !== 'transparent') { " +
                    "      return meta.content.trim(); " +
                    "    } " +
                    "    var metaApple = document.querySelector('meta[name=\"apple-mobile-web-app-status-bar-style\"]'); " +
                    "    if (metaApple && metaApple.content === 'black') return '#000000'; " +
                    "    var topEl = document.elementFromPoint(Math.floor(window.innerWidth / 2), 6); " +
                    "    var elements = [topEl, document.querySelector('header'), document.querySelector('nav'), document.querySelector('[role=\"banner\"]'), document.body, document.documentElement]; " +
                    "    for (var i = 0; i < elements.length; i++) { " +
                    "      var el = elements[i]; " +
                    "      while (el && el !== document) { " +
                    "        var bg = window.getComputedStyle(el).backgroundColor; " +
                    "        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') { " +
                    "          return bg; " +
                    "        } " +
                    "        el = el.parentElement; " +
                    "      } " +
                    "    } " +
                    "    return ''; " +
                    "  } catch(e) { return ''; } " +
                    "})()";
                nativeWebBrowser.evaluateJavascript(js, value -> {
                    int fallback = isDarkModeEnabled ? 0xFF000000 : 0xFFFFFFFF;
                    if (value != null && !value.equals("null") && !value.equals("\"\"")) {
                        String cleanColor = value.replace("\"", "").trim();
                        int parsed = parseColorSafe(cleanColor, fallback);
                        currentDetectedPageColor = parsed;
                    } else {
                        currentDetectedPageColor = fallback;
                    }
                    if (nativeWebBrowser != null && nativeWebBrowser.getVisibility() == View.VISIBLE && !hasWebOverlayOpen) {
                        applyStatusBarAppearance(currentDetectedPageColor);
                    }
                });
            } catch (Throwable ignored) {}
        });
    }

    public void setStatusBarTheme(boolean isDark, String colorHex) {
        runOnUiThread(() -> {
            try {
                int fallback = isDark ? 0xFF000000 : 0xFFFFFFFF;
                int color = parseColorSafe(colorHex, fallback);
                if (nativeWebBrowser == null || nativeWebBrowser.getVisibility() != View.VISIBLE || hasWebOverlayOpen) {
                    applyStatusBarAppearance(color);
                }
            } catch (Throwable t) {
                android.util.Log.e("OcalBrowser", "Error in setStatusBarTheme", t);
            }
        });
    }

    public void updateSearchEngineThemeCookies(boolean isDark) {
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            if (nativeWebBrowser != null) {
                cm.setAcceptThirdPartyCookies(nativeWebBrowser, true);
            }
            // Google Search PREF cookie (f6=400 enables dark theme on Google)
            cm.setCookie("https://www.google.com", isDark ? "PREF=f6=400; path=/; domain=.google.com" : "PREF=f6=0; path=/; domain=.google.com");
            cm.setCookie("https://google.com", isDark ? "PREF=f6=400; path=/; domain=.google.com" : "PREF=f6=0; path=/; domain=.google.com");
            // DuckDuckGo kae cookie (kae=d enables dark theme, kae=-1 light)
            cm.setCookie("https://duckduckgo.com", isDark ? "kae=d; path=/; domain=.duckduckgo.com" : "kae=-1; path=/; domain=.duckduckgo.com");
            // Bing b_drk cookie (b_drk=1 enables dark theme)
            cm.setCookie("https://www.bing.com", isDark ? "b_drk=1; path=/; domain=.bing.com" : "b_drk=0; path=/; domain=.bing.com");
            // Twitter/X night_mode cookie
            cm.setCookie("https://x.com", isDark ? "night_mode=1; path=/; domain=.x.com" : "night_mode=0; path=/; domain=.x.com");
            cm.flush();
        } catch (Throwable ignored) {}
    }

    public void evaluatePageThemeScript(WebView view, boolean isDark) {
        if (view == null) return;
        view.post(() -> {
            try {
                String js = 
                    "(function() { " +
                    "  try { " +
                    "    var isDark = " + (isDark ? "true" : "false") + "; " +
                    "    var docEl = document.documentElement; " +
                    "    if (!docEl) return; " +
                    "    var meta = document.querySelector('meta[name=\"color-scheme\"]'); " +
                    "    if (!meta) { " +
                    "      meta = document.createElement('meta'); " +
                    "      meta.name = 'color-scheme'; " +
                    "      (document.head || docEl).appendChild(meta); " +
                    "    } " +
                    "    meta.content = isDark ? 'dark light' : 'light dark'; " +
                    "    var styleEl = document.getElementById('__ocal_theme_override'); " +
                    "    if (!styleEl) { " +
                    "      styleEl = document.createElement('style'); " +
                    "      styleEl.id = '__ocal_theme_override'; " +
                    "      (document.head || docEl).appendChild(styleEl); " +
                    "    } " +
                    "    styleEl.textContent = isDark ? ':root { color-scheme: dark !important; }' : ':root { color-scheme: light !important; }'; " +
                    "    if (!window.__ocalMatchMediaOverridden) { " +
                    "      window.__ocalMatchMediaOverridden = true; " +
                    "      window.__ocalMediaListeners = new Set(); " +
                    "      var origMM = window.matchMedia; " +
                    "      window.matchMedia = function(q) { " +
                    "        if (!q) return origMM.call(window, q); " +
                    "        var qStr = String(q).toLowerCase(); " +
                    "        if (qStr.indexOf('prefers-color-scheme') !== -1) { " +
                    "          var match = qStr.indexOf('dark') !== -1 ? isDark : !isDark; " +
                    "          return { " +
                    "            matches: match, media: q, onchange: null, " +
                    "            addListener: function(fn) { window.__ocalMediaListeners.add(fn); }, " +
                    "            removeListener: function(fn) { window.__ocalMediaListeners.delete(fn); }, " +
                    "            addEventListener: function(t, fn) { if (t === 'change') window.__ocalMediaListeners.add(fn); }, " +
                    "            removeEventListener: function(t, fn) { if (t === 'change') window.__ocalMediaListeners.delete(fn); }, " +
                    "            dispatchEvent: function() { return true; } " +
                    "          }; " +
                    "        } " +
                    "        return origMM.call(window, q); " +
                    "      }; " +
                    "    } " +
                    "    var host = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : ''; " +
                    "    if (host.indexOf('duckduckgo.com') !== -1) { " +
                    "      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch(e){} " +
                    "      if (isDark) { docEl.classList.add('dark-bg', 'theme-dark'); if (document.body) document.body.classList.add('dark-bg', 'theme-dark'); } " +
                    "      else { docEl.classList.remove('dark-bg', 'theme-dark'); if (document.body) document.body.classList.remove('dark-bg', 'theme-dark'); } " +
                    "    } " +
                    "    if (host.indexOf('google.') !== -1) { " +
                    "      if (isDark) { docEl.classList.add('darkmode'); if (document.body) document.body.classList.add('darkmode'); docEl.setAttribute('data-darkmode', 'true'); } " +
                    "      else { docEl.classList.remove('darkmode'); if (document.body) document.body.classList.remove('darkmode'); docEl.removeAttribute('data-darkmode'); } " +
                    "    } " +
                    "    if (host.indexOf('bing.com') !== -1) { " +
                    "      if (isDark) { if (document.body) document.body.classList.add('b_dark'); } " +
                    "      else { if (document.body) document.body.classList.remove('b_dark'); } " +
                    "    } " +
                    "    if (host.indexOf('wikipedia.org') !== -1) { " +
                    "      try { localStorage.setItem('skin-client-pref-vector-night-mode', isDark ? 'night' : 'day'); } catch(e){} " +
                    "      if (isDark) { docEl.classList.add('skin-theme-clientpref-night'); docEl.classList.remove('skin-theme-clientpref-day'); } " +
                    "      else { docEl.classList.add('skin-theme-clientpref-day'); docEl.classList.remove('skin-theme-clientpref-night'); } " +
                    "    } " +
                    "    if (host.indexOf('github.com') !== -1) { " +
                    "      docEl.setAttribute('data-color-mode', isDark ? 'dark' : 'light'); " +
                    "      docEl.setAttribute('data-dark-theme', 'dark'); docEl.setAttribute('data-light-theme', 'light'); " +
                    "    } " +
                    "    if (host.indexOf('youtube.com') !== -1) { " +
                    "      if (isDark) { docEl.setAttribute('dark', 'true'); } else { docEl.removeAttribute('dark'); } " +
                    "    } " +
                    "    if (docEl.hasAttribute('data-theme')) docEl.setAttribute('data-theme', isDark ? 'dark' : 'light'); " +
                    "    if (docEl.hasAttribute('data-bs-theme')) docEl.setAttribute('data-bs-theme', isDark ? 'dark' : 'light'); " +
                    "    if (docEl.hasAttribute('theme')) docEl.setAttribute('theme', isDark ? 'dark' : 'light'); " +
                    "    if (window.__ocalMediaListeners && window.__ocalMediaListeners.size > 0) { " +
                    "      window.__ocalMediaListeners.forEach(function(l) { try { l({ matches: isDark, media: '(prefers-color-scheme: dark)' }); } catch(e){} }); " +
                    "    } " +
                    "    if (!document.getElementById('ocal-ad-killer')) { " +
                    "      var adStyle = document.createElement('style'); adStyle.id = 'ocal-ad-killer'; " +
                    "      adStyle.innerHTML = '#tvcap, #taw, #bottomads, .commercial-unit-mobile-top, .commercial-unit-mobile-bottom, iframe[id^=\"aswift_\"], iframe[name^=\"google_ads_\"], [id*=\"wix-ads\"], [class*=\"wix-ads\"], #WIX_ADS, .adsbygoogle, [id^=\"google_ads_\"], [id^=\"div-gpt-ad\"], .ad-banner, .advertisement, [data-ad-client], [data-ad-slot], [data-google-query-id], .taboola, .outbrain, .sponsor-badge, [id*=\"ad-container\"], [class*=\"ad-container\"] { display: none !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; visibility: hidden !important; }'; " +
                    "      (document.head || document.documentElement).appendChild(adStyle); " +
                    "    } " +
                    "  } catch(err) {} " +
                    "})()";
                view.evaluateJavascript(js, null);
            } catch (Throwable ignored) {}
        });
    }

    @Override
    protected void load() {
        super.load();
        setupStatusBarAndInsets();

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

                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    try {
                        s.setForceDark(isDarkModeEnabled ? WebSettings.FORCE_DARK_ON : WebSettings.FORCE_DARK_OFF);
                    } catch (Throwable ignored) {}
                }
                if (android.os.Build.VERSION.SDK_INT >= 33) {
                    try {
                        s.setAlgorithmicDarkeningAllowed(isDarkModeEnabled);
                    } catch (Throwable ignored) {}
                }
                updateSearchEngineThemeCookies(isDarkModeEnabled);

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
                        updateSearchEngineThemeCookies(isDarkModeEnabled);
                        evaluatePageThemeScript(view, isDarkModeEnabled);
                        detectAndApplyPageThemeColor();
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
                        evaluatePageThemeScript(view, isDarkModeEnabled);
                        detectAndApplyPageThemeColor();
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
                        evaluatePageThemeScript(view, isDarkModeEnabled);
                        detectAndApplyPageThemeColor();
                        view.postDelayed(MainActivity.this::detectAndApplyPageThemeColor, 300);
                        view.postDelayed(MainActivity.this::detectAndApplyPageThemeColor, 800);
                        view.evaluateJavascript(
                            "(function() { " +
                            "  if (!document.getElementById('ocal-dock-padding')) { " +
                            "    var s = document.createElement('style'); s.id = 'ocal-dock-padding'; " +
                            "    s.innerHTML = 'body { padding-bottom: 60px !important; }'; " +
                            "    (document.head || document.documentElement).appendChild(s); " +
                            "  } " +
                            "  if (!document.getElementById('ocal-ad-killer')) { " +
                            "    var adStyle = document.createElement('style'); adStyle.id = 'ocal-ad-killer'; " +
                            "    adStyle.innerHTML = '#tvcap, #taw, #bottomads, .commercial-unit-mobile-top, .commercial-unit-mobile-bottom, iframe[id^=\"aswift_\"], iframe[name^=\"google_ads_\"], [id*=\"wix-ads\"], [class*=\"wix-ads\"], #WIX_ADS, .adsbygoogle, [id^=\"google_ads_\"], [id^=\"div-gpt-ad\"], .ad-banner, .advertisement, [data-ad-client], [data-ad-slot], [data-google-query-id], .taboola, .outbrain, .sponsor-badge, [id*=\"ad-container\"], [class*=\"ad-container\"] { display: none !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; visibility: hidden !important; }'; " +
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

                    @Override
                    public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                        super.onReceivedError(view, errorCode, description, failingUrl);
                        notifyWebEvent("PAGE_ERROR", failingUrl, description);
                    }

                    @Override
                    public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                        super.onReceivedError(view, request, error);
                        if (request != null && request.isForMainFrame()) {
                            String desc = error != null && error.getDescription() != null ? error.getDescription().toString() : "Connection failed";
                            String url = request.getUrl() != null ? request.getUrl().toString() : "";
                            notifyWebEvent("PAGE_ERROR", url, desc);
                        }
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

                    @Override
                    public void onGeolocationPermissionsShowPrompt(final String origin, final android.webkit.GeolocationPermissions.Callback callback) {
                        runOnUiThread(() -> {
                            try {
                                if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                    androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this, new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION}, 1098);
                                }
                                callback.invoke(origin, true, false);
                            } catch (Throwable t) {
                                callback.invoke(origin, false, false);
                            }
                        });
                    }

                    @Override
                    public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                        runOnUiThread(() -> {
                            try {
                                ArrayList<String> needed = new ArrayList<>();
                                for (String res : request.getResources()) {
                                    if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                        if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                            needed.add(android.Manifest.permission.CAMERA);
                                        }
                                    } else if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                        if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                                            needed.add(android.Manifest.permission.RECORD_AUDIO);
                                        }
                                    }
                                }
                                if (!needed.isEmpty()) {
                                    androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this, needed.toArray(new String[0]), 1099);
                                }
                                request.grant(request.getResources());
                            } catch (Throwable t) {
                                super.onPermissionRequest(request);
                            }
                        });
                    }

                    @Override
                    public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<Uri[]> filePathCallback, WebChromeClient.FileChooserParams fileChooserParams) {
                        if (uploadMessageCallback != null) {
                            uploadMessageCallback.onReceiveValue(null);
                            uploadMessageCallback = null;
                        }
                        uploadMessageCallback = filePathCallback;
                        try {
                            Intent intent = null;
                            if (fileChooserParams != null) {
                                intent = fileChooserParams.createIntent();
                            }
                            if (intent == null) {
                                intent = new Intent(Intent.ACTION_GET_CONTENT);
                                intent.addCategory(Intent.CATEGORY_OPENABLE);
                                intent.setType("*/*");
                            }
                            startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                            return true;
                        } catch (Throwable t) {
                            try {
                                Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                                fallback.addCategory(Intent.CATEGORY_OPENABLE);
                                fallback.setType("*/*");
                                startActivityForResult(Intent.createChooser(fallback, "Select File"), FILE_CHOOSER_REQUEST_CODE);
                                return true;
                            } catch (Throwable e) {
                                if (uploadMessageCallback != null) {
                                    uploadMessageCallback.onReceiveValue(null);
                                    uploadMessageCallback = null;
                                }
                                return false;
                            }
                        }
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

                // Add scroll change listener for live status bar color updates on sticky headers
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    nativeWebBrowser.setOnScrollChangeListener((view, scrollX, scrollY, oldScrollX, oldScrollY) -> {
                        if (Math.abs(scrollY - oldScrollY) > 24) {
                            view.removeCallbacks(themeColorCheckRunnable);
                            view.postDelayed(themeColorCheckRunnable, 160);
                        }
                    });
                }

                // Construct sliding container and back peek view
                browserSlideContainer = new FrameLayout(this);
                browserSlideContainer.setClipChildren(false);
                browserSlideContainer.setVisibility(View.GONE);

                ViewGroup.MarginLayoutParams containerLp = new ViewGroup.MarginLayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                );
                containerLp.topMargin = statusBarHeightPx;
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
                peekLp.topMargin = statusBarHeightPx;
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

                // Dedicated Seamless Status Bar Background View
                if (statusBarView == null) {
                    statusBarView = new View(this);
                    FrameLayout.LayoutParams sbLp = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        Math.max(1, statusBarHeightPx)
                    );
                    sbLp.gravity = android.view.Gravity.TOP;
                    statusBarView.setLayoutParams(sbLp);
                    statusBarView.setBackgroundColor(isDarkModeEnabled ? 0xFF000000 : 0xFFFFFFFF);
                    statusBarView.setClickable(false);
                    statusBarView.setFocusable(false);
                }
                if (statusBarView.getParent() == null) {
                    parent.addView(statusBarView);
                }
                statusBarView.bringToFront();

                if (capWebView != null) {
                    capWebView.bringToFront();
                    if (statusBarView != null) {
                        statusBarView.bringToFront();
                    }
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
                                    inDock = (y <= (dockHeightPx + statusBarHeightPx));
                                } else {
                                    inDock = (y >= (h - dockHeightPx));
                                }

                                if (!inDock) {
                                    isForwardingToWeb = true;
                                    MotionEvent shifted = MotionEvent.obtain(event);
                                    shifted.offsetLocation(0, -statusBarHeightPx);
                                    boolean handled = nativeWebBrowser.dispatchTouchEvent(shifted);
                                    shifted.recycle();
                                    return handled;
                                } else {
                                    isForwardingToWeb = false;
                                    return false;
                                }
                            } else if (isForwardingToWeb) {
                                MotionEvent shifted = MotionEvent.obtain(event);
                                shifted.offsetLocation(0, -statusBarHeightPx);
                                boolean handled = nativeWebBrowser.dispatchTouchEvent(shifted);
                                shifted.recycle();
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
                int topOffset = statusBarHeightPx;
                int bottomOffset = 0;
                if (browserSlideContainer != null) {
                    ViewGroup.LayoutParams rawLp = browserSlideContainer.getLayoutParams();
                    if (rawLp instanceof ViewGroup.MarginLayoutParams) {
                        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) rawLp;
                        lp.topMargin = topOffset;
                        lp.bottomMargin = bottomOffset;
                        browserSlideContainer.setLayoutParams(lp);
                    }
                }
                if (backPeekContainer != null) {
                    ViewGroup.LayoutParams rawLp = backPeekContainer.getLayoutParams();
                    if (rawLp instanceof ViewGroup.MarginLayoutParams) {
                        ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) rawLp;
                        lp.topMargin = topOffset;
                        lp.bottomMargin = bottomOffset;
                        backPeekContainer.setLayoutParams(lp);
                    }
                }
                if (statusBarView != null) {
                    ViewGroup.LayoutParams rawLp = statusBarView.getLayoutParams();
                    if (rawLp != null) {
                        int h = Math.max(1, statusBarHeightPx);
                        if (rawLp.height != h) {
                            rawLp.height = h;
                            statusBarView.setLayoutParams(rawLp);
                        }
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
        public void setDarkMode(boolean isDark) {
            runOnUiThread(() -> {
                try {
                    isDarkModeEnabled = isDark;
                    updateSearchEngineThemeCookies(isDark);
                    if (nativeWebBrowser != null) {
                        WebSettings s = nativeWebBrowser.getSettings();
                        if (android.os.Build.VERSION.SDK_INT >= 29) {
                            try {
                                s.setForceDark(isDark ? WebSettings.FORCE_DARK_ON : WebSettings.FORCE_DARK_OFF);
                            } catch (Throwable ignored) {}
                        }
                        if (android.os.Build.VERSION.SDK_INT >= 33) {
                            try {
                                s.setAlgorithmicDarkeningAllowed(isDark);
                            } catch (Throwable ignored) {}
                        }
                        evaluatePageThemeScript(nativeWebBrowser, isDark);
                    }
                } catch (Throwable ignored) {}
            });
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> {
                try {
                    if (nativeWebBrowser != null && url != null && !url.isEmpty()) {
                        String target = url.trim();
                        if (target.contains("duckduckgo.com") && !target.contains("kae=")) {
                            target = target + (target.contains("?") ? "&" : "?") + (isDarkModeEnabled ? "kae=d" : "kae=-1");
                        } else if (target.contains("google.") && target.contains("/search") && !target.contains("cs=")) {
                            target = target + "&cs=" + (isDarkModeEnabled ? "1" : "0");
                        }
                        updateSearchEngineThemeCookies(isDarkModeEnabled);
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
                        nativeWebBrowser.setBackgroundColor(isDarkModeEnabled ? 0xFF000000 : 0xFFFFFFFF);
                        final WebView capWebView = bridge != null ? bridge.getWebView() : null;
                        if (capWebView != null) {
                            capWebView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                            capWebView.bringToFront();
                        }
                        if (statusBarView != null) {
                            statusBarView.bringToFront();
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
                            nativeWebBrowser.setBackgroundColor(isDarkModeEnabled ? 0xFF000000 : 0xFFFFFFFF);
                        }
                        final WebView capWebView = bridge != null ? bridge.getWebView() : null;
                        if (capWebView != null) {
                            capWebView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                            capWebView.bringToFront();
                        }
                        if (statusBarView != null) {
                            statusBarView.bringToFront();
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
                        if (bridge != null && bridge.getWebView() != null) {
                            bridge.getWebView().bringToFront();
                        }
                        if (statusBarView != null) {
                            statusBarView.bringToFront();
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
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().bringToFront();
                }
                if (statusBarView != null) {
                    statusBarView.bringToFront();
                }
            });
        }

        @JavascriptInterface
        public void setOverlayOpen(boolean open) {
            runOnUiThread(() -> {
                MainActivity.this.hasWebOverlayOpen = open;
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().bringToFront();
                }
                if (statusBarView != null) {
                    statusBarView.bringToFront();
                }
            });
        }

        @JavascriptInterface
        public void setWebBlurred(boolean blurred) {
            runOnUiThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        if (browserSlideContainer != null) {
                            if (blurred) {
                                RenderEffect blur = RenderEffect.createBlurEffect(28f, 28f, Shader.TileMode.CLAMP);
                                browserSlideContainer.setRenderEffect(blur);
                            } else {
                                browserSlideContainer.setRenderEffect(null);
                            }
                        }
                    }
                } catch (Throwable ignored) {}
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

        @JavascriptInterface
        public void requestAllPermissions() {
            runOnUiThread(() -> {
                try {
                    ArrayList<String> perms = new ArrayList<>();
                    if (android.os.Build.VERSION.SDK_INT >= 33) {
                        perms.add(android.Manifest.permission.POST_NOTIFICATIONS);
                        perms.add(android.Manifest.permission.READ_MEDIA_IMAGES);
                        perms.add(android.Manifest.permission.READ_MEDIA_VIDEO);
                        perms.add(android.Manifest.permission.READ_MEDIA_AUDIO);
                    } else {
                        perms.add(android.Manifest.permission.READ_EXTERNAL_STORAGE);
                        perms.add(android.Manifest.permission.WRITE_EXTERNAL_STORAGE);
                    }
                    perms.add(android.Manifest.permission.ACCESS_FINE_LOCATION);
                    perms.add(android.Manifest.permission.ACCESS_COARSE_LOCATION);
                    perms.add(android.Manifest.permission.CAMERA);
                    perms.add(android.Manifest.permission.RECORD_AUDIO);

                    ArrayList<String> missing = new ArrayList<>();
                    for (String p : perms) {
                        if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, p) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            missing.add(p);
                        }
                    }
                    if (!missing.isEmpty()) {
                        androidx.core.app.ActivityCompat.requestPermissions(MainActivity.this, missing.toArray(new String[0]), PERMISSION_ALL_REQUEST_CODE);
                    }
                } catch (Throwable t) {
                    android.util.Log.e("OcalBrowser", "Error requesting all permissions", t);
                }
            });
        }

        @JavascriptInterface
        public String getPermissionsStatus() {
            try {
                JSONObject obj = new JSONObject();
                obj.put("notifications", android.os.Build.VERSION.SDK_INT < 33 || androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED);
                obj.put("location", androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED);
                obj.put("camera", androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.CAMERA) == android.content.pm.PackageManager.PERMISSION_GRANTED);
                obj.put("microphone", androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.RECORD_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED);
                return obj.toString();
            } catch (Throwable t) {
                return "{}";
            }
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
