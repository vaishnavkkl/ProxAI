package expo.modules.finlifenative

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import java.io.File
import android.os.Debug
import android.provider.CalendarContract
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class FinlifeNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinlifeNative")

    AsyncFunction("getMemorySnapshot") {
      memorySnapshot()
    }

    AsyncFunction("getTodaysInbox") {
      inboxSince(startOfToday(), 20)
    }

    AsyncFunction("getInboxSince") { sinceMillis: Double, limit: Double, afterId: Double ->
      val cap = limit.toInt().coerceIn(1, 400)
      inboxSince(sinceMillis.toLong(), cap, afterId.toLong())
    }

    AsyncFunction("getCalendarEvents") { startMillis: Double, endMillis: Double, limit: Double, account: String ->
      calendarEvents(startMillis.toLong(), endMillis.toLong(), limit.toInt().coerceIn(1, 250), account)
    }

    AsyncFunction("getCalendarAccounts") {
      calendarAccounts()
    }

    AsyncFunction("filterInstalledPackages") { packages: List<String> ->
      installedPackages(packages)
    }

    AsyncFunction("getAppIcon") { packageName: String ->
      require(packageName.matches(Regex("[A-Za-z0-9_.]+"))) { "Invalid package" }
      val context = appContextOrThrow()
      val manager = context.packageManager
      val info = manager.getPackageInfo(packageName, 0)
      val folder = File(context.cacheDir, "subscription-icons").apply { mkdirs() }
      val file = File(folder, "$packageName.png")
      if (!file.exists() || file.lastModified() < info.lastUpdateTime) {
        val drawable = manager.getApplicationIcon(packageName)
        val bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        try {
          drawable.setBounds(0, 0, 128, 128)
          drawable.draw(Canvas(bitmap))
          file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        } finally { bitmap.recycle() }
      }
      Uri.fromFile(file).toString()
    }

    AsyncFunction("resolveSubscriptionLinks") { links: List<Map<String, String>> ->
      val manager = appContextOrThrow().packageManager
      links.filter { link ->
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link["url"])).setPackage(link["packageName"])
        manager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY) != null
      }.mapNotNull { it["packageName"] }
    }

    AsyncFunction("openSubscriptionApp") { packageName: String, url: String ->
      val context = appContextOrThrow()
      val deepLink = Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(packageName)
      val intent = if (url.isNotEmpty() && context.packageManager.resolveActivity(deepLink, PackageManager.MATCH_DEFAULT_ONLY) != null) deepLink
        else context.packageManager.getLaunchIntentForPackage(packageName)
      requireNotNull(intent) { "App is no longer available" }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("getScreenshotPage") { since: Double, until: Double, afterId: Double ->
      ScreenshotReader.list(appContextOrThrow(), since.toLong(), until.toLong(), afterId.toLong())
    }

    AsyncFunction("getScreenshotHash") { uri: String ->
      ScreenshotReader.hash(appContextOrThrow(), uri)
    }

    AsyncFunction("recognizeScreenshot") { uri: String ->
      ScreenshotReader.recognize(appContextOrThrow(), uri)
    }
  }

  private fun appContextOrThrow(): Context {
    return appContext.reactContext ?: throw IllegalStateException("React context lost")
  }

  private fun startOfToday(): Long {
    return Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
  }

  private fun memorySnapshot(): Map<String, Double> {
    val context = appContextOrThrow()
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val info = ActivityManager.MemoryInfo()
    manager.getMemoryInfo(info)
    val runtime = Runtime.getRuntime()

    return mapOf(
      "totalBytes" to info.totalMem.toDouble(),
      "availBytes" to info.availMem.toDouble(),
      "nativeHeapBytes" to Debug.getNativeHeapAllocatedSize().toDouble(),
      "javaUsedBytes" to (runtime.totalMemory() - runtime.freeMemory()).toDouble(),
    )
  }

  private fun inboxSince(sinceMillis: Long, limit: Int, afterId: Long = 0L): List<Map<String, String>> {
    val context = appContextOrThrow()
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return emptyList()
    }

    val rows = mutableListOf<Map<String, String>>()
    val cursor =
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
        "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms._ID} > ?",
        arrayOf(sinceMillis.toString(), afterId.toString()),
        "${Telephony.Sms._ID} ASC",
      ) ?: return emptyList()

    cursor.use {
      val idIdx = it.getColumnIndexOrThrow(Telephony.Sms._ID)
      val addressIdx = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
      val bodyIdx = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
      val dateIdx = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
      while (it.moveToNext() && rows.size < limit) {
        rows.add(
          mapOf(
            "id" to it.getString(idIdx),
            "sender" to (it.getString(addressIdx) ?: "unknown"),
            "body" to (it.getString(bodyIdx) ?: ""),
            "date" to it.getLong(dateIdx).toString(),
          ),
        )
      }
    }

    return rows
  }

  private fun calendarAccounts(): List<String> {
    val context = try {
      appContextOrThrow()
    } catch (_: Exception) {
      return emptyList()
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return emptyList()
    }
    val found = linkedSetOf<String>()
    val cursor =
      try {
        context.contentResolver.query(
          CalendarContract.Calendars.CONTENT_URI,
          arrayOf(CalendarContract.Calendars.ACCOUNT_NAME, CalendarContract.Calendars.ACCOUNT_TYPE),
          null,
          null,
          null,
        )
      } catch (_: Exception) {
        return emptyList()
      } ?: return emptyList()

    cursor.use {
      val nameIdx = it.getColumnIndex(CalendarContract.Calendars.ACCOUNT_NAME)
      val typeIdx = it.getColumnIndex(CalendarContract.Calendars.ACCOUNT_TYPE)
      while (it.moveToNext()) {
        val name = if (nameIdx >= 0) it.getString(nameIdx).orEmpty() else ""
        val type = if (typeIdx >= 0) it.getString(typeIdx).orEmpty() else ""
        if (name.isBlank()) {
          continue
        }
        if (type.contains("google", ignoreCase = true) || name.contains("@")) {
          found.add(name)
        }
      }
    }
    return found.toList()
  }

  private fun calendarEvents(startMillis: Long, endMillis: Long, limit: Int, account: String): List<Map<String, String>> {
    val context = try {
      appContextOrThrow()
    } catch (_: Exception) {
      return emptyList()
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return emptyList()
    }

    val selection = StringBuilder(
      "${CalendarContract.Events.DTSTART} >= ? AND ${CalendarContract.Events.DTSTART} < ? AND ${CalendarContract.Events.DELETED} != 1",
    )
    val args = mutableListOf(startMillis.toString(), endMillis.toString())
    if (account.isNotBlank()) {
      selection.append(" AND ${CalendarContract.Events.ACCOUNT_NAME} = ?")
      args.add(account)
    }

    val rows = mutableListOf<Map<String, String>>()
    val cursor =
      try {
        context.contentResolver.query(
          CalendarContract.Events.CONTENT_URI,
          arrayOf(
            CalendarContract.Events._ID,
            CalendarContract.Events.TITLE,
            CalendarContract.Events.DESCRIPTION,
            CalendarContract.Events.EVENT_LOCATION,
            CalendarContract.Events.DTSTART,
            CalendarContract.Events.CALENDAR_DISPLAY_NAME,
            CalendarContract.Events.ACCOUNT_NAME,
          ),
          selection.toString(),
          args.toTypedArray(),
          "${CalendarContract.Events.DTSTART} ASC",
        )
      } catch (_: Exception) {
        return emptyList()
      } ?: return emptyList()

    cursor.use {
      val idIdx = it.getColumnIndex(CalendarContract.Events._ID)
      val titleIdx = it.getColumnIndex(CalendarContract.Events.TITLE)
      val notesIdx = it.getColumnIndex(CalendarContract.Events.DESCRIPTION)
      val locationIdx = it.getColumnIndex(CalendarContract.Events.EVENT_LOCATION)
      val startIdx = it.getColumnIndex(CalendarContract.Events.DTSTART)
      val calendarIdx = it.getColumnIndex(CalendarContract.Events.CALENDAR_DISPLAY_NAME)
      val accountIdx = it.getColumnIndex(CalendarContract.Events.ACCOUNT_NAME)
      while (it.moveToNext() && rows.size < limit) {
        val start = if (startIdx >= 0) it.getLong(startIdx) else 0L
        rows.add(
          mapOf(
            "id" to if (idIdx >= 0) (it.getString(idIdx) ?: "") else "",
            "title" to if (titleIdx >= 0) (it.getString(titleIdx) ?: "") else "",
            "notes" to if (notesIdx >= 0) (it.getString(notesIdx) ?: "") else "",
            "location" to if (locationIdx >= 0) (it.getString(locationIdx) ?: "") else "",
            "start" to start.toString(),
            "calendar" to if (calendarIdx >= 0) (it.getString(calendarIdx) ?: "") else "",
            "account" to if (accountIdx >= 0) (it.getString(accountIdx) ?: "") else "",
          ),
        )
      }
    }

    return rows
  }

  private fun installedPackages(packages: List<String>): List<String> {
    val context = try {
      appContextOrThrow()
    } catch (_: Exception) {
      return emptyList()
    }
    val manager = context.packageManager
    return packages.filter { name ->
      try {
        manager.getPackageInfo(name, 0)
        true
      } catch (_: Exception) {
        false
      }
    }
  }
}
