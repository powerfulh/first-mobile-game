package com.powerful.promotd;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 게임 활성 중 시스템 throttling / 화면 꺼짐 방지
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // BGM 자동재생 허용 — 타이틀 진입 즉시 재생 (기본값은 제스처 필요)
        WebSettings ws = this.bridge.getWebView().getSettings();
        ws.setMediaPlaybackRequiresUserGesture(false);
    }
}
