package expo.modules.finlifenative

import android.content.ContentUris
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Scoped MediaStore access; never reads unrelated photo folders or uploads images. */
internal object ScreenshotReader {
  fun folders(context: Context): List<Map<String, Any>> {
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val counts = linkedMapOf<String, Int>()
    context.contentResolver.query(
      collection,
      arrayOf(MediaStore.Images.Media.BUCKET_DISPLAY_NAME),
      null,
      null,
      null,
    )?.use { cursor ->
      val idx = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
      while (cursor.moveToNext()) {
        val name = (if (idx >= 0) cursor.getString(idx) else null)?.trim().orEmpty().ifEmpty { "Other" }
        counts[name] = (counts[name] ?: 0) + 1
      }
    }
    if (counts.keys.none { it.contains("screenshot", ignoreCase = true) }) {
      counts.putIfAbsent("Screenshots", 0)
    }
    return counts.entries.sortedBy { it.key.lowercase() }.map { (name, count) ->
      mapOf("name" to name, "count" to count.toDouble())
    }
  }

  fun list(context: Context, since: Long, until: Long, afterId: Long, folders: List<String>): List<Map<String, Any>> {
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val folder = if (Build.VERSION.SDK_INT >= 29) MediaStore.Images.Media.RELATIVE_PATH else MediaStore.Images.Media.DATA
    val captured = "COALESCE(NULLIF(datetaken, 0), date_added * 1000)"
    val names = folders.map { it.trim().take(80) }.filter { it.isNotEmpty() }
    val selection: String
    val args: Array<String>
    if (names.isEmpty()) {
      selection = "_id > ? AND $captured >= CAST(? AS INTEGER) AND $captured < CAST(? AS INTEGER) AND (LOWER(bucket_display_name) LIKE ? OR LOWER($folder) LIKE ?)"
      args = arrayOf(afterId.toString(), since.toString(), until.toString(), "%screenshot%", "%screenshot%")
    } else {
      val inClause = names.joinToString(",") { "?" }
      val pathClause = names.joinToString(" OR ") { "LOWER($folder) LIKE ?" }
      selection = "_id > ? AND $captured >= CAST(? AS INTEGER) AND $captured < CAST(? AS INTEGER) AND (LOWER(IFNULL(bucket_display_name,'')) IN ($inClause) OR $pathClause)"
      args = ArrayList<String>().apply {
        add(afterId.toString())
        add(since.toString())
        add(until.toString())
        names.forEach { add(it.lowercase()) }
        names.forEach { add("%${it.lowercase()}%") }
      }.toTypedArray()
    }
    val rows = mutableListOf<Map<String, Any>>()
    context.contentResolver.query(
      collection, arrayOf("_id", "_display_name", "datetaken", "date_added", "date_modified", "_size"),
      selection,
      args,
      "_id ASC"
    )?.use { cursor ->
      while (cursor.moveToNext() && rows.size < 50) {
        val id = cursor.getLong(0)
        val taken = cursor.getLong(2).takeIf { it > 0 } ?: cursor.getLong(3) * 1000
        rows.add(mapOf(
          "id" to id.toString(), "uri" to ContentUris.withAppendedId(collection, id).toString(),
          "name" to (cursor.getString(1) ?: "Image"), "capturedAt" to taken.toDouble(),
          "revision" to "${cursor.getLong(4)}:${cursor.getLong(5)}"
        ))
      }
    }
    return rows
  }

  private fun localUri(context: Context, value: String): Uri {
    val uri = Uri.parse(value)
    when (uri.scheme) {
      "content" -> return uri
      "file" -> {
        val path = uri.path ?: throw IllegalArgumentException("Expected a local image")
        val file = File(path).canonicalFile
        val cache = context.cacheDir.canonicalPath
        val files = context.filesDir.canonicalPath
        val externalCache = context.externalCacheDir?.canonicalPath
        val allowed = file.path.startsWith(cache) || file.path.startsWith(files) ||
          (externalCache != null && file.path.startsWith(externalCache))
        require(allowed && file.isFile) { "Expected a local image" }
        return Uri.fromFile(file)
      }
      else -> throw IllegalArgumentException("Expected a local image")
    }
  }

  fun hash(context: Context, value: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    context.contentResolver.openInputStream(localUri(context, value))!!.use { stream ->
      val buffer = ByteArray(32 * 1024)
      while (true) {
        val count = stream.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  fun recognize(context: Context, value: String): String {
    val uri = localUri(context, value)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, bounds) }
    require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Image cannot be decoded" }
    val options = BitmapFactory.Options().apply { inSampleSize = 1 }
    while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 4096) options.inSampleSize *= 2
    val bitmap = context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, options) }
      ?: throw IllegalArgumentException("Image cannot be decoded")
    val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    try {
      val result = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)), 30, TimeUnit.SECONDS)
      return result.text
    } finally {
      recognizer.close()
      bitmap.recycle()
    }
  }
}
