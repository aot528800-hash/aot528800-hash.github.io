package com.cqvie.aid;

import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebSettings;
import androidx.annotation.NonNull;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 系统字号最多放大到 1.6 倍，再大布局会溢出 */
    private static final float MAX_FONT_SCALE = 1.6f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemFontScale();
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // manifest 里声明了 fontScale，所以系统改字号时不会重建 Activity，这里手动跟上
        applySystemFontScale();
    }

    /**
     * 跟随系统字号：Android 的字体缩放通过 WebView 的 textZoom 表达，
     * 网页里再叠加应用内的「字号」档位，两者相乘。
     */
    private void applySystemFontScale() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        float scale = getResources().getConfiguration().fontScale;
        if (scale <= 0f) scale = 1f;
        if (scale > MAX_FONT_SCALE) scale = MAX_FONT_SCALE;

        int zoom = Math.round(scale * 100f);
        WebSettings settings = getBridge().getWebView().getSettings();
        if (settings.getTextZoom() != zoom) {
            settings.setTextZoom(zoom);
        }
    }
}
