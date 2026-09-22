package expo.modules.finlifenative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat

/** Protect only the user-initiated picker/OCR operation, never an idle chat. */
class ChatOcrService : Service() {
  private val timeout = Runnable { finish() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (ready == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    try {
      val manager = getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= 26) {
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Image text", NotificationManager.IMPORTANCE_LOW))
      }
      val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
      builder.setSmallIcon(R.drawable.proxai_notification_icon)
        .setContentTitle("Reading image text")
        .setContentText("Choose a photo to continue your chat.")
        .setCategory(Notification.CATEGORY_PROGRESS)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
      packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
        builder.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      }
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
      } else {
        startForeground(NOTIFICATION_ID, builder.build())
      }
      main.removeCallbacks(timeout)
      // Stop before Android's short-service deadline, even if JS or a picker stalls.
      main.postDelayed(timeout, 150_000)
      completeStart(null)
    } catch (error: Exception) {
      completeStart(error)
      finish()
    }
    return START_NOT_STICKY
  }

  private fun finish() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onTimeout(startId: Int) = finish()
  override fun onTimeout(startId: Int, fgsType: Int) = finish()
  override fun onTaskRemoved(rootIntent: Intent?) = finish()

  override fun onDestroy() {
    main.removeCallbacks(timeout)
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    private const val CHANNEL = "chat-ocr"
    private const val NOTIFICATION_ID = 7419
    private val main = Handler(Looper.getMainLooper())
    private var ready: ((Throwable?) -> Unit)? = null
    private var startTimeout: Runnable? = null

    private fun completeStart(error: Throwable?) {
      startTimeout?.let { main.removeCallbacks(it) }
      startTimeout = null
      val callback = ready
      ready = null
      callback?.invoke(error)
    }

    fun start(context: Context, onReady: (Throwable?) -> Unit) {
      main.post {
        if (ready != null) {
          onReady(IllegalStateException("An image scan is already starting."))
          return@post
        }
        ready = onReady
        val deadline = Runnable {
          completeStart(IllegalStateException("Could not start image capture. Please try again."))
          context.stopService(Intent(context, ChatOcrService::class.java))
        }
        startTimeout = deadline
        main.postDelayed(deadline, 4_000)
        try {
          ContextCompat.startForegroundService(context, Intent(context, ChatOcrService::class.java))
        } catch (error: Exception) {
          completeStart(error)
        }
      }
    }

    fun stop(context: Context) {
      main.post {
        completeStart(IllegalStateException("Image capture was cancelled."))
        context.stopService(Intent(context, ChatOcrService::class.java))
      }
    }
  }
}
