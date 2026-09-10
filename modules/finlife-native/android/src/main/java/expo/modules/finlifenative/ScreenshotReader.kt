package expo.modules.finlifenative

import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Scoped MediaStore access; never reads unrelated photo folders or uploads images. */
internal object ScreenshotReader {
  private const val MAX_OCR_EDGE = 4096
  private const val MIN_MAL_BYTES = 4_000_000L
  private const val MIN_ENG_BYTES = 3_000_000L

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

  fun saveGenerated(context: Context, value: String): String {
    val source = localUri(context, value)
    val name = "ProxAI-${System.currentTimeMillis()}.png"
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, name)
      put(MediaStore.Images.Media.MIME_TYPE, "image/png")
      if (Build.VERSION.SDK_INT >= 29) {
        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ProxAI")
        put(MediaStore.Images.Media.IS_PENDING, 1)
      }
    }
    val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    val dest = context.contentResolver.insert(collection, values)
      ?: throw IllegalStateException("Could not create a Photos entry")
    try {
      context.contentResolver.openOutputStream(dest)?.use { output ->
        context.contentResolver.openInputStream(source)?.use { input -> input.copyTo(output) }
          ?: throw IllegalArgumentException("Expected a local image")
      } ?: throw IllegalStateException("Could not write the image")
      if (Build.VERSION.SDK_INT >= 29) {
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        context.contentResolver.update(dest, values, null, null)
      }
    } catch (error: Exception) {
      context.contentResolver.delete(dest, null, null)
      throw error
    }
    return dest.toString()
  }

  @Synchronized
  fun recognize(context: Context, value: String, malayalam: Boolean = false): String {
    val uri = localUri(context, value)
    val bitmap = decodeOcrBitmap(context, uri)
    try {
      if (malayalam) {
        val dataRoot = prepareMalayalamData(context)
        val recognizer = TessBaseAPI()
        try {
          check(recognizer.init(dataRoot.absolutePath, "mal+eng", TessBaseAPI.OEM_LSTM_ONLY)) {
            "Could not initialize offline Malayalam OCR. Reinstall the updated Android build."
          }
          recognizer.setPageSegMode(TessBaseAPI.PageSegMode.PSM_AUTO_OSD)
          recognizer.setVariable("preserve_interword_spaces", "1")
          recognizer.setVariable("user_defined_dpi", "300")
          recognizer.setImage(bitmap)
          return recognizer.getUTF8Text().orEmpty().trim()
        } finally {
          recognizer.recycle()
        }
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        return Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)), 30, TimeUnit.SECONDS).text
      } finally {
        recognizer.close()
      }
    } finally {
      bitmap.recycle()
    }
  }

  private fun decodeOcrBitmap(context: Context, uri: Uri): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it, null, bounds) }
    require(bounds.outWidth > 0 && bounds.outHeight > 0) { "Image cannot be decoded" }
    val options = BitmapFactory.Options().apply {
      inSampleSize = 1
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > MAX_OCR_EDGE) {
      options.inSampleSize *= 2
    }
    var bitmap = context.contentResolver.openInputStream(uri)!!.use {
      BitmapFactory.decodeStream(it, null, options)
    } ?: throw IllegalArgumentException("Image cannot be decoded")
    bitmap = applyExifOrientation(context, uri, bitmap)
    return ensureArgb8888(bitmap)
  }

  private fun applyExifOrientation(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
    val orientation = context.contentResolver.openInputStream(uri)!!.use { stream ->
      ExifInterface(stream).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    }
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.preScale(-1f, 1f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.preScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.postRotate(90f)
        matrix.preScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.postRotate(270f)
        matrix.preScale(-1f, 1f)
      }
      else -> return bitmap
    }
    val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (rotated !== bitmap) {
      bitmap.recycle()
    }
    return rotated
  }

  private fun ensureArgb8888(bitmap: Bitmap): Bitmap {
    if (bitmap.config == Bitmap.Config.ARGB_8888) {
      return bitmap
    }
    val converted = bitmap.copy(Bitmap.Config.ARGB_8888, true)
    bitmap.recycle()
    return converted
  }

  // Bundled files: no network or extra permissions. Version the directory when data changes.
  // Called under recognize's lock; atomic copies also recover from interrupted first use.
  private fun prepareMalayalamData(context: Context): File {
    val root = File(context.noBackupFilesDir, "ocr-fast-87416418")
    val data = File(root, "tessdata")
    check(data.isDirectory || data.mkdirs()) { "Could not create offline OCR directory" }
    val expectedSizes = mapOf("mal" to MIN_MAL_BYTES, "eng" to MIN_ENG_BYTES)
    for (language in listOf("mal", "eng")) {
      val target = File(data, "$language.traineddata")
      val minBytes = expectedSizes.getValue(language)
      if (target.isFile && target.length() >= minBytes) continue
      target.delete()
      val pending = File(data, "$language.traineddata.tmp")
      try {
        context.assets.open("tessdata/$language.traineddata").use { input ->
          pending.outputStream().use { output -> input.copyTo(output) }
        }
        check(pending.length() >= minBytes) {
          "Offline OCR language file for $language looks incomplete. Reinstall the app."
        }
        check(pending.renameTo(target)) { "Could not install offline OCR language" }
      } finally {
        pending.delete()
      }
    }
    return root
  }
}
