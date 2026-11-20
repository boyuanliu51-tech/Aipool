package com.aipool.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 供网页调用的原生 HTTP 请求，支持流式返回。JS 端见 index.html 中的 nfetch。 */
public class HttpBridge {
    private final Activity act;
    private final WebView web;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final Map<String, HttpURLConnection> conns = new ConcurrentHashMap<>();

    HttpBridge(Activity act, WebView web) {
        this.act = act;
        this.web = web;
    }

    @JavascriptInterface
    public void request(final String id, final String url, final String method, final String headersJson, final String body) {
        pool.execute(() -> run(id, url, method, headersJson, body));
    }

    @JavascriptInterface
    public void abort(final String id) {
        final HttpURLConnection c = conns.remove(id);
        if (c != null) pool.execute(c::disconnect);
    }

    @JavascriptInterface
    public void status(final String json) {
        act.runOnUiThread(() -> StatusNotifier.update(act, json));
    }

    @JavascriptInterface
    public void copy(String text) {
        act.runOnUiThread(() -> {
            ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("AI协同台", text));
        });
    }

    private void run(String id, String url, String method, String headersJson, String body) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            conns.put(id, c);
            c.setRequestMethod(method);
            c.setConnectTimeout(30000);
            c.setReadTimeout(300000);
            c.setUseCaches(false);
            JSONObject h = new JSONObject(headersJson == null || headersJson.isEmpty() ? "{}" : headersJson);
            Iterator<String> it = h.keys();
            while (it.hasNext()) {
                String k = it.next();
                c.setRequestProperty(k, h.getString(k));
            }
            if (body != null && !body.isEmpty() && !"GET".equals(method)) {
                byte[] b = body.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(b.length);
                try (OutputStream os = c.getOutputStream()) {
                    os.write(b);
                }
            }
            int code = c.getResponseCode();
            JSONObject rh = new JSONObject();
            for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                if (e.getKey() != null && e.getValue() != null) rh.put(e.getKey().toLowerCase(), TextUtils.join(", ", e.getValue()));
            }
            js("window.__nh&&__nh.start(" + q(id) + "," + code + "," + q(rh.toString()) + ")");
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in != null) {
                try (Reader r = new InputStreamReader(in, StandardCharsets.UTF_8)) {
                    char[] buf = new char[4096];
                    int n;
                    while ((n = r.read(buf)) != -1) {
                        js("window.__nh&&__nh.chunk(" + q(id) + "," + q(new String(buf, 0, n)) + ")");
                    }
                }
            }
            js("window.__nh&&__nh.end(" + q(id) + ",null)");
        } catch (Exception e) {
            String msg = conns.containsKey(id) ? (e.getMessage() == null ? e.toString() : e.getMessage()) : "aborted";
            js("window.__nh&&__nh.end(" + q(id) + "," + q("网络错误：" + msg) + ")");
        } finally {
            conns.remove(id);
            if (c != null) c.disconnect();
        }
    }

    private static String q(String s) {
        return JSONObject.quote(s);
    }

    private void js(final String code) {
        act.runOnUiThread(() -> web.evaluateJavascript(code, null));
    }
}
