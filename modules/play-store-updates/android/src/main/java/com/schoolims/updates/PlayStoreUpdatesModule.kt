package com.schoolims.updates

import android.app.Activity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PlayStoreUpdatesModule : Module() {
  private var updateManager: AppUpdateManager? = null
  private var flowRunning = false
  private val installListener = InstallStateUpdatedListener { state ->
    sendEvent("onInstallState", mapOf(
      "installStatus" to statusName(state.installStatus()),
      "bytesDownloaded" to state.bytesDownloaded().toDouble(),
      "totalBytesToDownload" to state.totalBytesToDownload().toDouble(),
      "installErrorCode" to state.installErrorCode()
    ))
  }

  override fun definition() = ModuleDefinition {
    Name("PlayStoreUpdates")
    Events("onInstallState")

    AsyncFunction("getUpdateInfo") { promise: Promise ->
      manager().appUpdateInfo
        .addOnSuccessListener { promise.resolve(serialize(it)) }
        .addOnFailureListener { promise.reject("CHECK_FAILED", it.message, it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("startUpdate") { mode: String, promise: Promise ->
      if (foregroundActivity() == null) {
        promise.reject("NO_ACTIVITY", "The app must be in the foreground to update", null)
        return@AsyncFunction
      }
      if (flowRunning) {
        promise.resolve("in_progress")
        return@AsyncFunction
      }
      val manager = manager()
      val infoTask = manager.appUpdateInfo
      flowRunning = true
      // AppUpdateInfo is single-use. Always get a fresh instance for retries.
      infoTask.addOnSuccessListener { info ->
        if (info.installStatus() in listOf(InstallStatus.PENDING, InstallStatus.DOWNLOADING,
            InstallStatus.DOWNLOADED, InstallStatus.INSTALLING) &&
            info.updateAvailability() != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
          flowRunning = false
          promise.resolve("in_progress")
          return@addOnSuccessListener
        }
        val resuming = info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        val preferred = if (mode == "immediate" || resuming) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
        val alternate = if (preferred == AppUpdateType.IMMEDIATE) AppUpdateType.FLEXIBLE else AppUpdateType.IMMEDIATE
        val type = when {
          info.isUpdateTypeAllowed(preferred) -> preferred
          !resuming && info.isUpdateTypeAllowed(alternate) -> alternate
          else -> null
        }
        if (type == null || (!resuming && info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE)) {
          flowRunning = false
          promise.resolve("unavailable")
          return@addOnSuccessListener
        }
        try {
          // The Play query is asynchronous: the original Activity may have
          // paused or been recreated while it was running.
          val activity = foregroundActivity()
          if (activity == null) {
            flowRunning = false
            promise.reject("NO_ACTIVITY", "Return to the app to start the update", null)
            return@addOnSuccessListener
          }
          manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(type).build())
            .addOnSuccessListener { result ->
              flowRunning = false
              when (result) {
                Activity.RESULT_OK -> promise.resolve("accepted")
                Activity.RESULT_CANCELED -> promise.resolve("cancelled")
                else -> promise.reject("UPDATE_FAILED", "Google Play could not start the update", null)
              }
            }
            .addOnFailureListener {
              flowRunning = false
              promise.reject("UPDATE_FAILED", it.message, it)
            }
        } catch (error: Exception) {
          flowRunning = false
          promise.reject("UPDATE_FAILED", error.message, error)
        }
      }.addOnFailureListener {
        flowRunning = false
        promise.reject("CHECK_FAILED", it.message, it)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("completeUpdate") { promise: Promise ->
      val manager = manager()
      manager.appUpdateInfo.addOnSuccessListener { info ->
        if (info.installStatus() != InstallStatus.DOWNLOADED) {
          promise.reject("NOT_DOWNLOADED", "The update has not finished downloading", null)
        } else {
          manager.completeUpdate()
            .addOnSuccessListener { promise.resolve(null) }
            .addOnFailureListener { promise.reject("INSTALL_FAILED", it.message, it) }
        }
      }.addOnFailureListener { promise.reject("CHECK_FAILED", it.message, it) }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      updateManager?.unregisterListener(installListener)
      updateManager = null
    }
  }

  private fun foregroundActivity(): Activity? {
    val activity = appContext.currentActivity ?: return null
    val lifecycle = (activity as? LifecycleOwner)?.lifecycle ?: return null
    return activity.takeIf {
      !it.isFinishing && !it.isDestroyed && lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
    }
  }

  private fun manager(): AppUpdateManager {
    return updateManager ?: AppUpdateManagerFactory.create(
      requireNotNull(appContext.reactContext) { "React context is unavailable" }
    ).also {
      it.registerListener(installListener)
      updateManager = it
    }
  }

  private fun serialize(info: AppUpdateInfo): Map<String, Any> = mapOf(
    "updateAvailable" to (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE),
    "immediateInProgress" to (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
    "availableVersionCode" to info.availableVersionCode(),
    "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
    "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
    "installStatus" to statusName(info.installStatus()),
    "bytesDownloaded" to info.bytesDownloaded().toDouble(),
    "totalBytesToDownload" to info.totalBytesToDownload().toDouble()
  )

  private fun statusName(status: Int): String = when (status) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.FAILED -> "failed"
    InstallStatus.CANCELED -> "cancelled"
    else -> "unknown"
  }
}
