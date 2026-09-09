package expo.modules.finlifenative

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import java.io.File

/** Only this app's pending model-cache transfers. Never removes completed models. */
internal object ModelDownloadCleanup {
  @Synchronized
  fun cancel(context: Context): Int {
    val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
    val roots = listOfNotNull(context.getExternalFilesDir(null), context.filesDir)
      .map { File(it, "react-native-executorch").canonicalFile }
    val ids = mutableListOf<Long>()
    val active = DownloadManager.STATUS_PENDING or DownloadManager.STATUS_RUNNING or DownloadManager.STATUS_PAUSED
    manager.query(DownloadManager.Query().setFilterByStatus(active))?.use { cursor ->
      val idColumn = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_ID)
      val uriColumn = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)
      while (cursor.moveToNext()) {
        val uri = Uri.parse(cursor.getString(uriColumn) ?: continue)
        if (uri.scheme != "file") continue
        val file = File(uri.path ?: continue).canonicalFile
        val parent = file.parentFile ?: continue
        if (parent in roots && file.name.endsWith(".downloading")) {
          ids.add(cursor.getLong(idColumn))
        }
      }
    }
    // DownloadManager.remove cancels the network operation and deletes its partial file.
    return if (ids.isEmpty()) 0 else manager.remove(*ids.toLongArray())
  }
}
