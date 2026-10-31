package com.schoolims.diary

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DiaryGeminiShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DiaryGeminiShare")

    AsyncFunction("shareImage") { contentUri: String, prompt: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null || activity.isFinishing || activity.isDestroyed) {
        promise.reject("NO_ACTIVITY", "Return to the diary to open Gemini.", null)
        return@AsyncFunction
      }
      val image = Uri.parse(contentUri)
      if (image.scheme != "content" || prompt.isBlank()) {
        promise.reject("INVALID_SHARE", "A readable photo and question are required.", null)
        return@AsyncFunction
      }
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "image/jpeg"
        putExtra(Intent.EXTRA_STREAM, image)
        putExtra(Intent.EXTRA_TEXT, prompt)
        clipData = ClipData.newUri(activity.contentResolver, "Diary photo", image)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val pm = activity.packageManager
      // Gemini can be hosted by the Gemini package or the Google app. Resolve
      // installed share targets; never depend on Google's private activity names.
      for (packageName in listOf("com.google.android.apps.bard", "com.google.android.googlequicksearchbox")) {
        val targets = pm.queryIntentActivities(Intent(send).setPackage(packageName), PackageManager.MATCH_DEFAULT_ONLY)
        for (target in targets) {
          val info = target.activityInfo ?: continue
          if (!info.exported) continue
          // The Google app also contains unrelated targets such as Lens.
          if (packageName != "com.google.android.apps.bard" &&
            !target.loadLabel(pm).toString().contains("Gemini", ignoreCase = true)) continue
          try {
            activity.startActivity(Intent(send).apply {
              component = ComponentName(info.packageName, info.name)
            })
            promise.resolve("opened")
            return@AsyncFunction
          } catch (_: ActivityNotFoundException) {
            // The Google app may have updated between discovery and launch.
          } catch (_: SecurityException) {
            // Fall back to the system share menu when this target is restricted.
          }
        }
      }
      promise.resolve("unavailable")
    }.runOnQueue(Queues.MAIN)
  }
}
