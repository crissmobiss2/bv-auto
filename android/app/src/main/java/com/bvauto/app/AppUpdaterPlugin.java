package com.bvauto.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

/**
 * Downloads a newer APK of this app and hands it to the Android package installer.
 * Refuses APKs whose signing certificate differs from the installed app, because
 * Android would reject them with "App not installed".
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String APK_MIME = "application/vnd.android.package-archive";

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("A https download URL is required", "BAD_URL");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, intent, "onInstallPermissionResult");
            return;
        }
        startDownload(call, url);
    }

    @ActivityCallback
    private void onInstallPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Allow \"Install unknown apps\" for B&V Auto to update", "PERMISSION_DENIED");
            return;
        }
        startDownload(call, call.getString("url"));
    }

    private void startDownload(PluginCall call, String url) {
        new Thread(() -> {
            try {
                File apk = download(url);
                verifyAndInstall(call, apk);
            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage(), "DOWNLOAD_FAILED");
            }
        }, "bv-app-updater").start();
    }

    private File download(String url) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot create cache dir");
        File out = new File(dir, "app-update.apk");
        if (out.exists()) out.delete();

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(20_000);
        conn.setReadTimeout(60_000);
        conn.setRequestProperty("Cache-Control", "no-cache");
        try {
            int code = conn.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new Exception("HTTP " + code);
            copyWithProgress(conn, out);
        } finally {
            conn.disconnect();
        }
        return out;
    }

    private void copyWithProgress(HttpURLConnection conn, File out) throws Exception {
        long total = conn.getContentLengthLong();
        long done = 0;
        int lastPercent = -1;
        try (InputStream in = conn.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) {
                os.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int percent = (int) (done * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        notifyListeners("downloadProgress", progress);
                    }
                }
            }
        }
    }

    private void verifyAndInstall(PluginCall call, File apk) throws Exception {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? PackageManager.GET_SIGNING_CERTIFICATES
                : PackageManager.GET_SIGNATURES;
        PackageInfo downloaded = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (downloaded == null || !ctx.getPackageName().equals(downloaded.packageName)) {
            call.reject("Downloaded file is not a B&V Auto APK", "INVALID_APK");
            return;
        }
        PackageInfo installed = pm.getPackageInfo(ctx.getPackageName(), flags);
        if (!certDigests(installed).equals(certDigests(downloaded))) {
            call.reject("This update is signed with a different key than the installed app. "
                    + "Uninstall B&V Auto, then install the new version.", "SIGNATURE_MISMATCH");
            return;
        }

        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, APK_MIME);
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(install);
                JSObject ret = new JSObject();
                ret.put("status", "installer_opened");
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not open the installer: " + e.getMessage(), "INSTALLER_FAILED");
            }
        });
    }

    @SuppressWarnings("deprecation")
    private static Set<String> certDigests(PackageInfo info) throws Exception {
        Signature[] sigs;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
            sigs = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
        } else {
            sigs = info.signatures;
        }
        Set<String> out = new HashSet<>();
        if (sigs == null) return out;
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        for (Signature s : sigs) {
            StringBuilder hex = new StringBuilder();
            for (byte b : md.digest(s.toByteArray())) hex.append(String.format("%02x", b));
            out.add(hex.toString());
        }
        return out;
    }
}
