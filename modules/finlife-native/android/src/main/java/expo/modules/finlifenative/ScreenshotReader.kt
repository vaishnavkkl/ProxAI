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
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Scoped MediaStore access; never reads unrelated photo folders or uploads images. */
internal object ScreenshotReader {
  fun list(context: Context, since: Long, until: Long, afterId: Long): List<Map<String, Any>> {
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val folder = if (Build.VERSION.SDK_INT >= 29) MediaStore.Images.Media.RELATIVE_PATH else MediaStore.Images.Media.DATA
    val captured = "COALESCE(NULLIF(datetaken, 0), date_added * 1000)"
    val rows = mutableListOf<Map<String, Any>>()
    context.contentResolver.query(
      collection, arrayOf("_id", "_display_name", "datetaken", "date_added", "date_modified", "_size"),
      "_id > ? AND $captured >= CAST(? AS INTEGER) AND $captured < CAST(? AS INTEGER) AND (LOWER(bucket_display_name) LIKE ? OR LOWER($folder) LIKE ?)",
      arrayOf(afterId.toString(), since.toString(), until.toString(), "%screenshot%", "%screenshot%"),
      "_id ASC"
    )?.use { cursor ->
      while (cursor.moveToNext() && rows.size < 50) {
        val id = cursor.getLong(0)
        val taken = cursor.getLong(2).takeIf { it > 0 } ?: cursor.getLong(3) * 1000
        rows.add(mapOf(
          "id" to id.toString(), "uri" to ContentUris.withAppendedId(collection, id).toString(),
          "name" to (cursor.getString(1) ?: "Screenshot"), "capturedAt" to taken.toDouble(),
          "revision" to "${cursor.getLong(4)}:${cursor.getLong(5)}"
        ))
      }
    }
    return rows
  }

  private fun mediaUri(value: String): Uri {
    val uri = Uri.parse(value)
    require(uri.scheme == "content" && uri.authority == "media") { "Expected a local gallery image" }
    return uri
  }

  fun hash(context: Context, value: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    context.contentResolver.openInputStream(mediaUri(value))!!.use { stream ->
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
    val uri = mediaUri(value)
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
